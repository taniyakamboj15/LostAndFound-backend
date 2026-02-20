import LostReport, { ILostReport } from './lost-report.model';
import { ForbiddenError, NotFoundError } from '../../common/errors';
import {
  LostReportSearchFilters,
  PaginatedResponse,
  PaginationParams,
} from '../../common/types';
import activityService from '../activity/activity.service';
import { ActivityAction } from '../../common/types';
import * as matchQueue from '../match/match.queue';
import mongoose, { FilterQuery } from 'mongoose';

class LostReportService {
  async createLostReport(data: {
    category: string;
    description: string;
    locationLost: string;
    dateLost: Date;
    reportedBy: string;
    contactEmail: string;
    contactPhone?: string;
    identifyingFeatures: string[];
    brand?: string;
    color?: string;
    itemSize?: string;
    bagContents?: string[];
  }): Promise<ILostReport> {
    const report = await LostReport.create(data);

    // Log activity
    await activityService.logActivity({
      action: ActivityAction.LOST_REPORT_SUBMITTED,
      userId: data.reportedBy,
      entityType: 'LostReport',
      entityId: report._id.toString(),
      metadata: {
        category: report.category,
        locationLost: report.locationLost,
      },
    });

    // Trigger matching engine
    // await matchService.generateMatches({ lostReportId: report._id.toString() });
    await matchQueue.addMatchJob({ type: 'REPORT_CREATED', id: report._id.toString() });

    return report;
  }

  async getLostReportById(reportId: string): Promise<ILostReport> {
    const report = await LostReport.findById(reportId).populate(
      'reportedBy',
      'name email'
    );

    if (!report) {
      throw new NotFoundError('Lost report not found');
    }

    return report;
  }

  async searchLostReports(
    filters: LostReportSearchFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<ILostReport>> {
    const query: Record<string, unknown> = {};

    if (filters.reportedBy) {
      query.reportedBy = filters.reportedBy;
    }

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.location) {
      query.locationLost = new RegExp(filters.location, 'i');
    }

    if (filters.dateLostFrom || filters.dateLostTo) {
      query.dateLost = {};
      if (filters.dateLostFrom) {
        (query.dateLost as Record<string, unknown>).$gte = filters.dateLostFrom;
      }
      if (filters.dateLostTo) {
        (query.dateLost as Record<string, unknown>).$lte = filters.dateLostTo;
      }
    }

    if (filters.keyword) {
      query.$or = [
        { description: { $regex: filters.keyword, $options: 'i' } },
        { locationLost: { $regex: filters.keyword, $options: 'i' } },
        { category: { $regex: filters.keyword, $options: 'i' } }
      ];
    }

    const total = await LostReport.countDocuments(query);
    const totalPages = Math.ceil(total / pagination.limit);

    const reports = await LostReport.find(query)
      .sort({
        [pagination.sortBy || 'dateLost']: pagination.sortOrder === 'asc' ? 1 : -1,
      })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .populate('reportedBy', 'name email');

    return {
      data: reports,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
      },
    };
  }

  async getMyReports(
    userId: string,
    filters: LostReportSearchFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<ILostReport>> {
    const query: Record<string, unknown> = { reportedBy: userId };

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.location) {
      query.locationLost = new RegExp(filters.location, 'i');
    }

    if (filters.dateLostFrom || filters.dateLostTo) {
      query.dateLost = {};
      if (filters.dateLostFrom) {
        (query.dateLost as Record<string, unknown>).$gte = filters.dateLostFrom;
      }
      if (filters.dateLostTo) {
        (query.dateLost as Record<string, unknown>).$lte = filters.dateLostTo;
      }
    }

    if (filters.keyword) {
      query.$or = [
        { description: { $regex: filters.keyword, $options: 'i' } },
        { locationLost: { $regex: filters.keyword, $options: 'i' } },
        { category: { $regex: filters.keyword, $options: 'i' } }
      ];
    }

    const total = await LostReport.countDocuments(query);
    const totalPages = Math.ceil(total / pagination.limit);

    const reports = await LostReport.find(query)
      .sort({ createdAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit);

    return {
      data: reports,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
      },
    };
  }

  async updateLostReport(
    reportId: string,
    userId: string,
    userRole: string,
    data: Partial<Pick<ILostReport, 'description' | 'contactPhone' | 'identifyingFeatures'>>
  ): Promise<ILostReport> {
    const report = await LostReport.findById(reportId);
    if (!report) throw new NotFoundError('Lost report not found');

    if (userRole === 'CLAIMANT' && report.reportedBy.toString() !== userId) {
      throw new ForbiddenError('You do not have permission to update this report');
    }

    Object.assign(report, data);
    await report.save();

    return report;
  }

  async deleteLostReport(reportId: string, userId: string, userRole: string): Promise<void> {
    const query: FilterQuery<ILostReport> = { _id: reportId };
    if (userRole === 'CLAIMANT') {
      query.reportedBy = new mongoose.Types.ObjectId(userId);
    }

    const report = await LostReport.findOne(query);

    if (!report) {
      throw new NotFoundError('Lost report not found or unauthorized');
    }

    report.deletedAt = new Date();
    await report.save();

    // Log activity
    await activityService.logActivity({
      action: ActivityAction.ITEM_UPDATED, // Reuse or add LOST_REPORT_DELETED
      userId,
      entityType: 'LostReport',
      entityId: reportId,
      metadata: { action: 'DELETED_SOFT' },
    });
  }

  async toggleStarReport(reportId: string, userId: string): Promise<ILostReport> {
    const report = await LostReport.findById(reportId);
    if (!report) throw new NotFoundError('Lost report not found');

    const starredByIds = report.starredBy.map(id => id.toString());
    const index = starredByIds.indexOf(userId);

    if (index === -1) {
      report.starredBy.push(new mongoose.Types.ObjectId(userId));
    } else {
      report.starredBy.splice(index, 1);
    }

    await report.save();
    return report;
  }
}

export default new LostReportService();
