import Activity, { IActivity } from './activity.model';
import { ActivityAction, PaginatedResponse, PaginationParams } from '../../common/types';

interface LogActivityParams {
  action: ActivityAction;
  userId: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

class ActivityService {
  async logActivity(params: LogActivityParams): Promise<IActivity> {
    return Activity.create(params);
  }

  async getActivitiesByUser(
    userId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<IActivity>> {
    const total = await Activity.countDocuments({ userId });
    const totalPages = Math.ceil(total / pagination.limit);

    const activities = await Activity.find({ userId })
      .sort({ createdAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .populate('userId', 'name email');

    return {
      data: activities,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
      },
    };
  }

  async getActivitiesByEntity(
    entityType: string,
    entityId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<IActivity>> {
    const query = { entityType, entityId };
    const total = await Activity.countDocuments(query);
    const totalPages = Math.ceil(total / pagination.limit);

    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .populate('userId', 'name email');

    return {
      data: activities,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
      },
    };
  }

  async getAllActivities(
    filters: {
      action?: ActivityAction;
      userId?: string;
      entityType?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
    pagination: PaginationParams
  ): Promise<PaginatedResponse<IActivity>> {
    const query: Record<string, unknown> = {};

    if (filters.action) query.action = filters.action;
    if (filters.userId) query.userId = filters.userId;
    if (filters.entityType) query.entityType = filters.entityType;

    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) {
        (query.createdAt as Record<string, unknown>).$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        (query.createdAt as Record<string, unknown>).$lte = filters.dateTo;
      }
    }

    const total = await Activity.countDocuments(query);
    const totalPages = Math.ceil(total / pagination.limit);

    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .populate('userId', 'name email role');

    return {
      data: activities,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
      },
    };
  }
}

export default new ActivityService();
