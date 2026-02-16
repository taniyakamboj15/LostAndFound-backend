import Item from '../item/item.model';
import Claim from '../claim/claim.model';
import Match from '../match/match.model';
import Disposition from '../disposition/disposition.model';
import { ItemStatus, ClaimStatus, ItemCategory, AnalyticsMetrics } from '../../common/types';

class AnalyticsService {
  async getDashboardMetrics(user: { id: string; role: string }): Promise<AnalyticsMetrics> {
    if (user.role === 'CLAIMANT') {
      const [pendingClaims] = await Promise.all([
        Claim.countDocuments({ claimantId: user.id, status: { $ne: ClaimStatus.RETURNED } }),
      ]);

      // Initialize category breakdown with zero for all categories
      const categoryBreakdown: Record<string, number> = {};
      Object.values(ItemCategory).forEach((cat) => {
        categoryBreakdown[cat] = 0;
      });

      return {
        totalItemsFound: await Item.countDocuments({ status: ItemStatus.AVAILABLE }),
        totalItemsClaimed: 0,
        totalItemsReturned: 0,
        totalItemsDisposed: 0,
        matchSuccessRate: 0,
        averageRecoveryTime: 0,
        pendingClaims,
        expiringItems: 0,
        categoryBreakdown: categoryBreakdown as Record<ItemCategory, number>,
      };
    }

    const [
      totalItemsFound,
      totalItemsClaimed,
      totalItemsReturned,
      totalItemsDisposed,
      totalMatches,
      successfulMatches,
      pendingClaims,
      expiringItems,
      categoryBreakdown,
      avgRecoveryTime,
    ] = await Promise.all([
      Item.countDocuments(),
      Item.countDocuments({ status: ItemStatus.CLAIMED }),
      Item.countDocuments({ status: ItemStatus.RETURNED }),
      Item.countDocuments({ status: ItemStatus.DISPOSED }),
      Match.countDocuments(),
      Match.countDocuments({ confidenceScore: { $gte: 0.8 } }),
      Claim.countDocuments({ status: { $in: [ClaimStatus.FILED, ClaimStatus.IDENTITY_PROOF_REQUESTED, ClaimStatus.VERIFIED] } }),
      Item.countDocuments({
        status: ItemStatus.AVAILABLE,
        retentionExpiryDate: {
          $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          $gte: new Date(),
        },
      }),
      this.getCategoryBreakdown(),
      this.getAverageRecoveryTime(),
    ]);

    const matchSuccessRate = totalMatches > 0 ? successfulMatches / totalMatches : 0;

    return {
      totalItemsFound,
      totalItemsClaimed,
      totalItemsReturned,
      totalItemsDisposed,
      matchSuccessRate,
      averageRecoveryTime: avgRecoveryTime,
      pendingClaims,
      expiringItems,
      categoryBreakdown,
    };
  }

  async getCategoryBreakdown(): Promise<Record<ItemCategory, number>> {
    const result = await Item.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
    ]);

    const breakdown: Record<string, number> = {};
    Object.values(ItemCategory).forEach((cat) => {
      breakdown[cat] = 0;
    });

    result.forEach((item: { _id: string; count: number }) => {
      breakdown[item._id] = item.count;
    });

    return breakdown as Record<ItemCategory, number>;
  }

  async getAverageRecoveryTime(): Promise<number> {
    const result = await Claim.aggregate([
      {
        $match: {
          status: ClaimStatus.RETURNED,
          verifiedAt: { $exists: true },
        },
      },
      {
        $lookup: {
          from: 'items',
          localField: 'itemId',
          foreignField: '_id',
          as: 'item',
        },
      },
      {
        $unwind: '$item',
      },
      {
        $project: {
          recoveryTime: {
            $divide: [
              { $subtract: ['$verifiedAt', '$item.createdAt'] },
              1000 * 60 * 60 * 24, // Convert to days
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: '$recoveryTime' },
        },
      },
    ]);

    return result.length > 0 ? result[0].avgTime : 0;
  }

  async getItemTrends(days: number = 30): Promise<{
    date: string;
    found: number;
    claimed: number;
    returned: number;
  }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const items = await Item.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.date': 1 },
      },
    ]);

    const trendsMap: Record<string, { found: number; claimed: number; returned: number }> = {};

    items.forEach((item: { _id: { date: string; status: string }; count: number }) => {
      if (!trendsMap[item._id.date]) {
        trendsMap[item._id.date] = { found: 0, claimed: 0, returned: 0 };
      }

      if (item._id.status === ItemStatus.AVAILABLE) {
        trendsMap[item._id.date].found += item.count;
      } else if (item._id.status === ItemStatus.CLAIMED) {
        trendsMap[item._id.date].claimed += item.count;
      } else if (item._id.status === ItemStatus.RETURNED) {
        trendsMap[item._id.date].returned += item.count;
      }
    });

    return Object.entries(trendsMap).map(([date, data]) => ({
      date,
      ...data,
    }));
  }

  async getDispositionStats(): Promise<{
    total: number;
    byType: Record<string, number>;
  }> {
    const result = await Disposition.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    const byType: Record<string, number> = {};
    let total = 0;

    result.forEach((item: { _id: string; count: number }) => {
      byType[item._id] = item.count;
      total += item.count;
    });

    return { total, byType };
  }
}

export default new AnalyticsService();
