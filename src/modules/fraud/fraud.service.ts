import Claim from '../claim/claim.model';
import Item from '../item/item.model';
import { IActivityModel } from '../../common/types';
import logger from '../../common/utils/logger';

const FRAUD_THRESHOLDS = {
  HIGH_RISK: parseFloat(process.env.FRAUD_HIGH_RISK_THRESHOLD || '70'),
  RAPID_CLAIMS_24H: 5,      // >5 claims in 24 hours
  RAPID_CLAIMS_30D: parseInt(process.env.FRAUD_MONTHLY_LIMIT || '5'), // spec: 5+ claims in a month
};

export interface FraudDetail {
  score: number;
  flags: string[];
  patterns: Record<string, { triggered: boolean; points: number; description: string }>;
}

class FraudService {
  /**
   * Calculate a fraud risk score (0-100) for a user making a claim.
   * Returns score + flag details for storage and staff review.
   */
  async calculateFraudRiskScore(
    userId: string,
    userActivities: IActivityModel[],
    claimData?: { itemId: string; claimDescription?: string }
  ): Promise<FraudDetail> {
    const flags: string[] = [];
    const patterns: FraudDetail['patterns'] = {};
    let score = 0;

    // Pattern 1: Rapid claims in 24 hours
    const rapid24hScore = await this.checkRapidClaims24h(userId, userActivities);
    patterns.rapid24h = {
      triggered: rapid24hScore > 0,
      points: rapid24hScore,
      description: `Filed >5 claims within 24h`,
    };
    if (rapid24hScore > 0) {
      score += rapid24hScore;
      flags.push('RAPID_CLAIMS_24H');
    }

    // Pattern 2: Volume of claims in past 30 days
    const monthly30dScore = await this.checkMonthlyClaims(userId);
    patterns.monthlyVolume = {
      triggered: monthly30dScore > 0,
      points: monthly30dScore,
      description: `Filed >${FRAUD_THRESHOLDS.RAPID_CLAIMS_30D - 1} claims in 30 days`,
    };
    if (monthly30dScore > 0) {
      score += monthly30dScore;
      flags.push('HIGH_MONTHLY_VOLUME');
    }

    // Pattern 3: History of claims rejected for this user
    const rejectedScore = this.checkRecentRejections(userActivities);
    patterns.rejectedHistory = {
      triggered: rejectedScore > 0,
      points: rejectedScore,
      description: `High rejection rate in claim history`,
    };
    if (rejectedScore > 0) {
      score += rejectedScore;
      flags.push('REJECTED_CLAIMS_HISTORY');
    }

    // Pattern 4: Claim filed before item was found (date anomaly)
    if (claimData?.itemId) {
      const dateAnomalyScore = await this.checkDateAnomaly(claimData.itemId);
      patterns.dateAnomaly = {
        triggered: dateAnomalyScore > 0,
        points: dateAnomalyScore,
        description: `Claim filed before item was registered as found`,
      };
      if (dateAnomalyScore > 0) {
        score += dateAnomalyScore;
        flags.push('DATE_ANOMALY');
      }
    }

    // Pattern 5: Repeated claims on same item after rejection
    if (claimData?.itemId && userId) {
      const repeatedScore = await this.checkRepeatedClaimsOnItem(userId, claimData.itemId);
      patterns.repeatedSameItem = {
        triggered: repeatedScore > 0,
        points: repeatedScore,
        description: `Multiple claims on same item after previous rejection`,
      };
      if (repeatedScore > 0) {
        score += repeatedScore;
        flags.push('REPEATED_CLAIM_SAME_ITEM');
      }
    }

    // Pattern 6: Exact description match with public listing
    if (claimData?.itemId && claimData?.claimDescription) {
      const exactMatchScore = await this.checkExactDescriptionMatch(claimData.itemId, claimData.claimDescription);
      patterns.exactMatch = {
        triggered: exactMatchScore > 0,
        points: exactMatchScore,
        description: `Description exactly matches the public listing`,
      };
      if (exactMatchScore > 0) {
        score += exactMatchScore;
        flags.push('EXACT_DESCRIPTION_MATCH');
      }
    }

    const finalScore = Math.min(Math.round(score), 100);
    if (finalScore >= FRAUD_THRESHOLDS.HIGH_RISK) {
      logger.warn(`[Fraud] High-risk claim from user ${userId} — score ${finalScore}, flags: ${flags.join(', ')}`);
    }

    return { score: finalScore, flags, patterns };
  }

  /** Get all claims above fraud risk threshold for staff review */
  async getHighRiskClaims(threshold = FRAUD_THRESHOLDS.HIGH_RISK, page = 1, limit = 20) {
    const query = { fraudRiskScore: { $gte: threshold } };
    const total = await Claim.countDocuments(query);
    const data = await Claim.find(query)
      .sort({ fraudRiskScore: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('claimantId', 'name email')
      .populate('itemId', 'category description');

    return { data, total, threshold };
  }

  /** Get fraud detail for a specific claim */
  async getClaimFraudDetail(claimId: string) {
    const claim = await Claim.findById(claimId)
      .select('fraudRiskScore fraudFlags claimantId itemId createdAt')
      .populate('claimantId', 'name email')
      .populate('itemId', 'category description dateFound');

    if (!claim) return null;
    return {
      claimId,
      fraudRiskScore: claim.fraudRiskScore,
      fraudFlags: claim.fraudFlags,
      claim,
    };
  }

  // ─── Private Pattern Checkers ───────────────────────────────────────────────

  private async checkRapidClaims24h(userId: string, activities: IActivityModel[]): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Check from activity log first (faster), fall back to DB query
    const recentFromLogs = activities.filter(
      (a) => a.action === 'CLAIM_FILED' && new Date(a.createdAt) > cutoff
    ).length;

    if (recentFromLogs > FRAUD_THRESHOLDS.RAPID_CLAIMS_24H) return 35;

    const dbCount = await Claim.countDocuments({
      claimantId: userId,
      createdAt: { $gte: cutoff },
    });
    return dbCount > FRAUD_THRESHOLDS.RAPID_CLAIMS_24H ? 35 : 0;
  }

  private async checkMonthlyClaims(userId: string): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const count = await Claim.countDocuments({
      claimantId: userId,
      createdAt: { $gte: cutoff },
    });
    if (count > FRAUD_THRESHOLDS.RAPID_CLAIMS_30D) return 25;
    if (count > FRAUD_THRESHOLDS.RAPID_CLAIMS_30D * 0.7) return 10;
    return 0;
  }

  private checkRecentRejections(activities: IActivityModel[]): number {
    const claimActivityCount = activities.filter(a => a.action === 'CLAIM_FILED').length;
    const rejectedCount = activities.filter(a => a.action === 'CLAIM_REJECTED').length;
    if (claimActivityCount === 0) return 0;
    const rejectionRate = rejectedCount / claimActivityCount;
    if (rejectionRate > 0.6) return 20;
    if (rejectionRate > 0.4) return 10;
    return 0;
  }

  private async checkDateAnomaly(itemId: string): Promise<number> {
    try {
      const item = await Item.findById(itemId).select('dateFound createdAt');
      if (!item) return 0;
      // If claim was filed BEFORE item was registered (a temporal anomaly)
      const itemFoundDate = new Date(item.dateFound);
      const now = new Date();
      // Claim is being filed now; if item was found in the future, that's anomalous
      if (itemFoundDate > now) return 40;
    } catch {
      // fall through
    }
    return 0;
  }

  private async checkRepeatedClaimsOnItem(userId: string, itemId: string): Promise<number> {
    const previousRejected = await Claim.countDocuments({
      claimantId: userId,
      itemId,
      status: 'REJECTED',
    });
    if (previousRejected >= 2) return 30;
    if (previousRejected === 1) return 15;
    return 0;
  }

  private async checkExactDescriptionMatch(itemId: string, claimDescription: string): Promise<number> {
    try {
      const item = await Item.findById(itemId).select('description');
      if (!item) return 0;

      const publicDesc = item.description.trim().toLowerCase();
      const claimDesc = claimDescription.trim().toLowerCase();

      // If they are identical (ignoring case/whitespace), flag it
      // Valid claimants should provide personalized detail, not copy-paste
      if (publicDesc === claimDesc && publicDesc.length > 5) {
        return 60; // High penalty for verbatim copy
      }
    } catch {
      // fall through
    }
    return 0;
  }
}

export default new FraudService();
