import Match, { IMatch } from './match.model';
import Item, { IItem } from '../item/item.model';
import LostReport, { ILostReport } from '../lost-report/lost-report.model';
import Settings from '../settings/settings.model';
import { MatchScore, NotificationEvent, ISettingsModel } from '../../common/types';
import { NotFoundError } from '../../common/errors';
import notificationService from '../notification/notification.service';
import { calculateDateScore, calculateFeatureScore, calculateKeywordScore, calculateLocationScore, calculateColorScore } from './scoring';
import logger from '../../common/utils/logger';
import mongoose from 'mongoose';
import pLimit from 'p-limit';

class MatchService {
  private async getSettings(): Promise<ISettingsModel> {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    return settings;
  }

  /** Get current threshold configuration */
  async getConfig() {
    const settings = await this.getSettings();
    return {
      autoMatchThreshold: settings.autoMatchThreshold,
      rejectThreshold: settings.rejectThreshold,
      weights: settings.matchWeights,
    };
  }

  /** Update thresholds and weights at runtime (Admin/Staff) */
  async updateConfig(config: { autoMatchThreshold?: number; rejectThreshold?: number; weights?: Partial<ISettingsModel['matchWeights']> }) {
    const settings = await this.getSettings();
    if (config.autoMatchThreshold !== undefined) settings.autoMatchThreshold = config.autoMatchThreshold;
    if (config.rejectThreshold !== undefined) settings.rejectThreshold = config.rejectThreshold;
    if (config.weights) {
      settings.matchWeights = { ...settings.matchWeights, ...config.weights };
    }
    await settings.save();
    return this.getConfig();
  }

  async generateMatches(source: { lostReportId?: string; itemId?: string }): Promise<IMatch[]> {
    if (source.lostReportId) return this.handleNewReport(source.lostReportId);
    if (source.itemId) return this.handleNewItem(source.itemId);
    return [];
  }

  private async handleNewReport(reportId: string): Promise<IMatch[]> {
    const report = await LostReport.findById(reportId);
    if (!report) throw new NotFoundError('Lost report not found');

    const items = await Item.find({ category: report.category, status: 'AVAILABLE' });
    return this.processItemsForReport(items, report);
  }

  private async handleNewItem(itemId: string): Promise<IMatch[]> {
    const item = await Item.findById(itemId).select('+secretIdentifiers');
    if (!item) throw new NotFoundError('Item not found');

    const reports = await LostReport.find({ category: item.category });
    return this.processReportsForItem(item, reports);
  }

  private async processItemsForReport(items: IItem[], report: ILostReport): Promise<IMatch[]> {
    const settings = await this.getSettings();
    const limit = pLimit(10);
    const matches: IMatch[] = [];

    await Promise.all(items.map((item) => limit(async () => {
      const score = this.calculateMatchScore(item, report, settings.matchWeights);
      if (score.totalScore < settings.rejectThreshold) return; 

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const match = await this.createMatch(item._id.toString(), report._id.toString(), score, session);
          matches.push(match);
          await this.handleAutoMatch(match, report.reportedBy.toString(), score.totalScore, settings.autoMatchThreshold, settings.rejectThreshold, session);
        });
      } finally {
        await session.endSession();
      }
    })));

    return matches;
  }

  private async processReportsForItem(item: IItem, reports: ILostReport[]): Promise<IMatch[]> {
    const settings = await this.getSettings();
    const limit = pLimit(10);
    const matches: IMatch[] = [];

    await Promise.all(reports.map((report) => limit(async () => {
      const score = this.calculateMatchScore(item, report, settings.matchWeights);
      if (score.totalScore < settings.rejectThreshold) return;

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const match = await this.createMatch(item._id.toString(), report._id.toString(), score, session);
          matches.push(match);
          await this.handleAutoMatch(match, report.reportedBy.toString(), score.totalScore, settings.autoMatchThreshold, settings.rejectThreshold, session);
        });
      } finally {
        await session.endSession();
      }
    })));

    return matches;
  }

  private async createMatch(itemId: string, lostReportId: string, score: MatchScore, session?: mongoose.ClientSession): Promise<IMatch> {
    const existing = await Match.findOne({ itemId, lostReportId }).session(session || null);
    if (existing) return existing;

    const [match] = await Match.create([{
      itemId,
      lostReportId,
      confidenceScore: score.totalScore,
      categoryScore:   score.categoryScore,
      keywordScore:    score.keywordScore,
      dateScore:       score.dateScore,
      locationScore:   score.locationScore,
      featureScore:    score.featureScore,
      colorScore:      score.colorScore,
    }], { session });

    return match;
  }

  private async handleAutoMatch(
    match: IMatch, 
    userId: string, 
    score: number, 
    autoThreshold: number, 
    rejectThreshold: number,
    session?: mongoose.ClientSession
  ): Promise<void> {
    if (score >= autoThreshold && match.status === 'PENDING') {
      match.status = 'AUTO_CONFIRMED';
      match.notified = true;
      await match.save({ session });

      await notificationService.queueNotification({
        event: NotificationEvent.MATCH_FOUND,
        userId,
        data: {
          matchId: match._id.toString(),
          itemId: match.itemId.toString(),
          confidenceScore: score,
          autoConfirmed: true,
        },
      });
      logger.info(`[Match] Auto-confirmed match ${match._id} (score=${score})`);
      return;
    }

    if (score >= rejectThreshold && !match.notified) {
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
      await match.save({ session });
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

  async reScanAll(): Promise<void> {
    const settings = await this.getSettings();
    const pendingMatches = await Match.find({ status: 'PENDING' })
      .populate('itemId')
      .populate('lostReportId');

    const limit = pLimit(5); // Conservative limit for re-scan
    await Promise.all(pendingMatches.map((match) => limit(async () => {
      if (!match.itemId || !match.lostReportId) return;
      
      const item = match.itemId as unknown as IItem;
      const report = match.lostReportId as unknown as ILostReport;
      
      const newScore = this.calculateMatchScore(item, report, settings.matchWeights);
      
      if (newScore.totalScore < settings.rejectThreshold) {
        await Match.deleteOne({ _id: match._id });
        return;
      }
      
      match.confidenceScore = newScore.totalScore;
      match.categoryScore   = newScore.categoryScore;
      match.keywordScore    = newScore.keywordScore;
      match.dateScore       = newScore.dateScore;
      match.locationScore   = newScore.locationScore;
      match.featureScore    = newScore.featureScore;
      match.colorScore      = newScore.colorScore;
      
      if (newScore.totalScore >= settings.autoMatchThreshold) {
        match.status = 'AUTO_CONFIRMED';
      }
      
      await match.save();
    })));
  }

  private calculateMatchScore(
    item: { keywords: string[]; dateFound: Date; locationFound: string; identifyingFeatures?: string[]; color?: string; brand?: string; itemSize?: string; bagContents?: string | string[] },
    report: { keywords: string[]; dateLost: Date; locationLost: string; identifyingFeatures?: string[]; color?: string; brand?: string; itemSize?: string; bagContents?: string | string[] },
    weights: ISettingsModel['matchWeights']
  ): MatchScore {
    const categoryScore = 100;

    const keywordScore  = calculateKeywordScore(item.keywords, report.keywords)     * 100;
    const dateScore     = calculateDateScore(item.dateFound, report.dateLost)        * 100;
    const locationScore = calculateLocationScore(item.locationFound, report.locationLost) * 100;
    
    const featureScore  = calculateFeatureScore(
        item.identifyingFeatures || [], report.identifyingFeatures || [],
        item.brand, report.brand,
        item.itemSize, report.itemSize,
        item.bagContents, report.bagContents
    ) * 100;

    const colorScore    = calculateColorScore(item.color, report.color) * 100;

    const totalScore =
      categoryScore * weights.category +
      keywordScore  * weights.keyword  +
      dateScore     * weights.date     +
      locationScore * weights.location +
      featureScore  * weights.feature  +
      colorScore    * weights.color;

    return {
      categoryScore:  parseFloat((categoryScore * weights.category).toFixed(1)),
      keywordScore:   parseFloat((keywordScore  * weights.keyword).toFixed(1)),
      dateScore:      parseFloat((dateScore     * weights.date).toFixed(1)),
      locationScore:  parseFloat((locationScore * weights.location).toFixed(1)),
      featureScore:   parseFloat((featureScore  * weights.feature).toFixed(1)),
      colorScore:     parseFloat((colorScore    * weights.color).toFixed(1)),
      totalScore:     Math.round(totalScore),
    };
  }

  async getAllMatches(
    filters: { status?: string; minConfidence?: number; fromDate?: string; toDate?: string; search?: string },
    pagination: { page: number; limit: number }
  ): Promise<{ data: IMatch[]; total: number }> {
    const query: mongoose.FilterQuery<IMatch> = {};

    if (filters.status) query.status = filters.status;
    if (filters.minConfidence) query.confidenceScore = { $gte: filters.minConfidence };

    if (filters.fromDate || filters.toDate) {
      query.createdAt = {};
      if (filters.fromDate) (query.createdAt as Record<string, unknown>).$gte = new Date(filters.fromDate);
      if (filters.toDate)   (query.createdAt as Record<string, unknown>).$lte = new Date(filters.toDate);
    }

    if (filters.search) {
      const searchTerms = filters.search.split(/\s+/).filter(t => t.length > 2);
      if (searchTerms.length > 0) {
        // Use text search if indexed, otherwise fallback to pre-filtered keywords
        const [items, reports] = await Promise.all([
          Item.find({ $text: { $search: filters.search } }).select('_id'),
          LostReport.find({ $text: { $search: filters.search } }).select('_id')
        ]);
        
        const itemIds = items.map(i => i._id);
        const reportIds = reports.map(r => r._id);
        
        query.$or = [
          { itemId: { $in: itemIds } },
          { lostReportId: { $in: reportIds } }
        ];
      }
    }

    const total = await Match.countDocuments(query);
    const matches = await Match.find(query)
      .sort({ confidenceScore: -1, createdAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .populate('itemId')
      .populate('lostReportId');

    return { data: matches, total };
  }

  async updateMatchStatus(matchId: string, status: 'CONFIRMED' | 'REJECTED'): Promise<IMatch> {
    const match = await Match.findById(matchId);
    if (!match) throw new NotFoundError('Match not found');

    match.status = status;
    await match.save();

    if (status === 'CONFIRMED' && !match.notified) {
      const report = await LostReport.findById(match.lostReportId);
      if (report) {
        const settings = await this.getSettings();
        await this.handleAutoMatch(match, report.reportedBy.toString(), match.confidenceScore, settings.autoMatchThreshold, settings.rejectThreshold);
      }
    }
    return match;
  }
}

export default new MatchService();
