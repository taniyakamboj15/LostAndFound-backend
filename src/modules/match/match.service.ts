import Match, { IMatch } from './match.model';
import Item from '../item/item.model';
import LostReport from '../lost-report/lost-report.model';
import { MatchScore } from '../../common/types';
import { NotFoundError } from '../../common/errors';
import notificationService from '../notification/notification.service';
import { NotificationEvent } from '../../common/types';

class MatchService {
  private readonly MATCH_THRESHOLD = parseFloat(
    process.env.MATCH_CONFIDENCE_THRESHOLD || '0.4'
  );
  private readonly NOTIFICATION_THRESHOLD = parseFloat(
    process.env.MATCH_NOTIFICATION_THRESHOLD || '0.5'
  );

  async generateMatches(source: { lostReportId?: string; itemId?: string }): Promise<IMatch[]> {
    const matches: IMatch[] = [];

    if (source.lostReportId) {
      // Case 1: New Lost Report -> Search for existing Items
      const report = await LostReport.findById(source.lostReportId);
      if (!report) throw new NotFoundError('Lost report not found');

      const items = await Item.find({
        category: report.category,
        status: 'AVAILABLE',
      });

      for (const item of items) {
        const score = this.calculateMatchScore(item, report);
        if (score.totalScore >= this.MATCH_THRESHOLD) {
          const match = await this.createMatch(item._id.toString(), report._id.toString(), score);
          matches.push(match);
          
          await this.triggerNotification(match, report.reportedBy.toString(), score.totalScore);
        }
      }
    } else if (source.itemId) {
      // Case 2: New Item -> Search for existing Lost Reports
      const item = await Item.findById(source.itemId);
      if (!item) throw new NotFoundError('Item not found');

      const reports = await LostReport.find({
        category: item.category,
      });

      for (const report of reports) {
        const score = this.calculateMatchScore(item, report);
        if (score.totalScore >= this.MATCH_THRESHOLD) {
          const match = await this.createMatch(item._id.toString(), report._id.toString(), score);
          matches.push(match);

          await this.triggerNotification(match, report.reportedBy.toString(), score.totalScore);
        }
      }
    }

    return matches;
  }

  private async createMatch(itemId: string, lostReportId: string, score: MatchScore): Promise<IMatch> {
    // Check if match already exists to avoid duplicates
    const existingMatch = await Match.findOne({ itemId, lostReportId });
    if (existingMatch) return existingMatch;

    return Match.create({
      itemId,
      lostReportId,
      confidenceScore: score.totalScore,
      categoryScore: score.categoryScore,
      keywordScore: score.keywordScore,
      dateScore: score.dateScore,
      locationScore: score.locationScore,
      featureScore: score.featureScore,
    });
  }

  private async triggerNotification(match: IMatch, userId: string, score: number): Promise<void> {
    if (score >= this.NOTIFICATION_THRESHOLD && !match.notified) {
      await notificationService.queueNotification({
        event: NotificationEvent.MATCH_FOUND,
        userId,
        data: {
          matchId: match._id.toString(),
          itemId: match.itemId.toString(),
          confidenceScore: score,
        },
      });

      match.notified = true;
      await match.save();
    }
  }

  async getMatchesForReport(lostReportId: string): Promise<IMatch[]> {
    return Match.find({ lostReportId })
      .sort({ confidenceScore: -1 })
      .populate('itemId')
      .populate('lostReportId');
  }

  async getMatchesForItem(itemId: string): Promise<IMatch[]> {
    return Match.find({ itemId })
      .sort({ confidenceScore: -1 })
      .populate('itemId')
      .populate('lostReportId');
  }

  private calculateMatchScore(
    item: { keywords: string[]; dateFound: Date; locationFound: string; identifyingFeatures?: string[] },
    report: { keywords: string[]; dateLost: Date; locationLost: string; identifyingFeatures?: string[] }
  ): MatchScore {
    // Category score (already filtered, so 1.0)
    const categoryScore = 1.0;

    // Keyword overlap score
    const keywordScore = this.calculateKeywordScore(
      item.keywords,
      report.keywords
    );

    // Date proximity score
    const dateScore = this.calculateDateScore(item.dateFound, report.dateLost);

    // Location similarity score
    const locationScore = this.calculateLocationScore(
      item.locationFound,
      report.locationLost
    );

    // Feature score
    const featureScore = this.calculateFeatureScore(
      item.identifyingFeatures || [],
      report.identifyingFeatures || []
    );

    // Weighted total score
    // Updated weights: Keywords 0.3, Location 0.2, Date 0.1, Features 0.3, Category 0.1
    const totalScore =
      categoryScore * 0.1 +
      keywordScore * 0.3 +
      dateScore * 0.1 +
      locationScore * 0.2 +
      featureScore * 0.3;

    return {
      categoryScore,
      keywordScore,
      dateScore,
      locationScore,
      featureScore,
      totalScore,
    };
  }

  private calculateFeatureScore(itemFeatures: string[], reportFeatures: string[]): number {
    if (!itemFeatures.length || !reportFeatures.length) return 0;

    // Normalize features
    const f1 = itemFeatures.map(f => this.normalizeText(f));
    const f2 = reportFeatures.map(f => this.normalizeText(f));

    let matchCount = 0;
    
    // Check for fuzzy matches between features
    for (const feat1 of f1) {
      for (const feat2 of f2) {
        if (feat1 === feat2 || feat1.includes(feat2) || feat2.includes(feat1)) {
          matchCount++;
          break; // Count each item feature at most once
        }
      }
    }

    // Score is based on the proportion of report features matched
    // We prioritize matching what the loser reported
    return Math.min(matchCount / f2.length, 1.0);
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }

  private expandAbbreviations(text: string): string {
    const expansions: Record<string, string> = {
      't1': 'terminal 1',
      't2': 'terminal 2',
      't3': 'terminal 3',
      'apt': 'apartment',
      'st': 'street',
      'ave': 'avenue',
      'rd': 'road',
      'rm': 'room',
      'flr': 'floor',
      'lib': 'library',
      'dept': 'department',
      'bldg': 'building',
    };

    return text.split(' ').map(word => expansions[word] || word).join(' ');
  }

  private calculateKeywordScore(
    itemKeywords: string[],
    reportKeywords: string[]
  ): number {
    if (itemKeywords.length === 0 || reportKeywords.length === 0) {
      return 0;
    }

    const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'for', 'of', 'with']);
    const filterKeywords = (keywords: string[]) => 
      keywords.filter(k => !stopWords.has(k) && k.length > 2);

    const k1 = filterKeywords(itemKeywords);
    const k2 = filterKeywords(reportKeywords);

    if (k1.length === 0 || k2.length === 0) return 0;

    const intersection = k1.filter((k) =>
      k2.some(k2Word => k2Word.includes(k) || k.includes(k2Word)) // Partial match
    ).length;
    
    const union = new Set([...k1, ...k2]).size;

    return intersection / union;
  }

  private calculateDateScore(dateFound: Date, dateLost: Date): number {
    const daysDiff = Math.abs(
      (dateFound.getTime() - dateLost.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 0) return 1.0;
    if (daysDiff <= 1) return 0.95;
    if (daysDiff <= 3) return 0.8;
    if (daysDiff <= 7) return 0.6;
    if (daysDiff <= 14) return 0.4;
    return 0.1;
  }

  private calculateLocationScore(
    locationFound: string,
    locationLost: string
  ): number {
    let loc1 = this.normalizeText(locationFound);
    let loc2 = this.normalizeText(locationLost);

    // Expand common abbreviations (e.g. "T3" -> "terminal 3")
    loc1 = this.expandAbbreviations(loc1);
    loc2 = this.expandAbbreviations(loc2);

    if (loc1 === loc2) return 1.0;
    if (loc1.includes(loc2) || loc2.includes(loc1)) return 0.9;

    // Token matching
    const words1 = loc1.split(/\s+/);
    const words2 = loc2.split(/\s+/);
    
    // Calculate intersection
    const intersection = words1.filter(w1 => 
      words2.some(w2 => w2 === w1 || (w2.length > 4 && w1.includes(w2)))
    ).length;

    return intersection / Math.max(words1.length, words2.length);
  }
}

export default new MatchService();
