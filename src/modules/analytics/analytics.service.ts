import Item from '../item/item.model';
import Claim from '../claim/claim.model';
import Match from '../match/match.model';
import Disposition from '../disposition/disposition.model';
import { ItemStatus, ClaimStatus, ItemCategory, AnalyticsMetrics } from '../../common/types';

class AnalyticsService {
  async getDashboardMetrics(user: { id: string; role: string }): Promise<AnalyticsMetrics | any> {
    if (user.role === 'CLAIMANT') {
      const [pendingClaims] = await Promise.all([
        Claim.countDocuments({ claimantId: user.id, status: { $ne: ClaimStatus.RETURNED } }),
      ]);

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
        pendingReviewClaims: 0,
        readyForHandoverClaims: 0,
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
      pendingReviewClaims,
      readyForHandoverClaims,
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
      // New granular metrics
      Claim.countDocuments({ 
        status: { $in: [ClaimStatus.FILED, ClaimStatus.IDENTITY_PROOF_REQUESTED] } 
      }),
      Claim.countDocuments({ 
        status: { $in: [ClaimStatus.VERIFIED, ClaimStatus.PICKUP_BOOKED] },
        paymentStatus: 'PAID'
      }),
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
      pendingReviewClaims,
      readyForHandoverClaims,
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
    const now = new Date();
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days));
    startDate.setUTCHours(0, 0, 0, 0);

    const [foundItems, claimedItems, returnedItems] = await Promise.all([
      // Found items based on createdAt
      Item.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
      ]),
      // Claimed items based on claim createdAt
      Claim.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
      ]),
      // Returned items based on claim verifiedAt (or could use Pickup completedAt)
      // Using verifiedAt as proxy for successful return process initiation/completion effectively
      Claim.aggregate([
        { 
          $match: { 
            status: ClaimStatus.RETURNED,
            updatedAt: { $gte: startDate } // Approximate date
          } 
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const trendsMap: Record<string, { found: number; claimed: number; returned: number }> = {};

    // Initialize map with empty data for all days
    for (let i = 0; i <= days; i++) {
        const d = new Date(startDate);
        d.setUTCDate(d.getUTCDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        trendsMap[dateStr] = { found: 0, claimed: 0, returned: 0 };
    }

    foundItems.forEach((item: { _id: string; count: number }) => {
      if (trendsMap[item._id]) trendsMap[item._id].found = item.count;
    });

    claimedItems.forEach((item: { _id: string; count: number }) => {
      if (trendsMap[item._id]) trendsMap[item._id].claimed = item.count;
    });

    returnedItems.forEach((item: { _id: string; count: number }) => {
      if (trendsMap[item._id]) trendsMap[item._id].returned = item.count;
    });

    return Object.entries(trendsMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date));
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

  async getPaymentAnalytics(): Promise<{
    totalRevenue: number;
    totalPaidClaims: number;
    totalPendingPaymentClaims: number;
    averageFee: number;
    revenueByMonth: { month: string; revenue: number; count: number }[];
    topPayingUsers: { userId: string; name: string; email: string; totalPaid: number; claimCount: number }[];
    recentPayments: { claimId: string; claimantName: string; claimantEmail: string; amount: number; paidAt: Date; itemDescription: string }[];
  }> {
    const [
      revenueAgg,
      totalPaidClaims,
      totalPendingPaymentClaims,
      revenueByMonthAgg,
      topPayingUsersAgg,
      recentPaymentsAgg,
    ] = await Promise.all([
      // Total revenue
      Claim.aggregate([
        { $match: { paymentStatus: 'PAID', 'feeDetails.totalAmount': { $exists: true } } },
        { $group: { _id: null, total: { $sum: '$feeDetails.totalAmount' }, count: { $sum: 1 }, avg: { $avg: '$feeDetails.totalAmount' } } },
      ]),
      Claim.countDocuments({ paymentStatus: 'PAID' }),
      // Verified claims awaiting payment
      Claim.countDocuments({ status: 'VERIFIED', paymentStatus: { $ne: 'PAID' } }),
      // Revenue by month (last 12 months)
      Claim.aggregate([
        { $match: { paymentStatus: 'PAID', 'feeDetails.paidAt': { $exists: true } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$feeDetails.paidAt' } },
            revenue: { $sum: '$feeDetails.totalAmount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 12 },
      ]),
      // Top paying users
      Claim.aggregate([
        { $match: { paymentStatus: 'PAID' } },
        { $group: { _id: '$claimantId', totalPaid: { $sum: '$feeDetails.totalAmount' }, claimCount: { $sum: 1 } } },
        { $sort: { totalPaid: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { userId: '$_id', name: '$user.name', email: '$user.email', totalPaid: 1, claimCount: 1 } },
      ]),
      // Recent payments
      Claim.find({ paymentStatus: 'PAID' })
        .sort({ 'feeDetails.paidAt': -1 })
        .limit(10)
        .populate<{ claimantId: { name: string; email: string } }>('claimantId', 'name email')
        .populate<{ itemId: { description: string } }>('itemId', 'description'),
    ]);

    const totalRevenue = revenueAgg[0]?.total ?? 0;
    const averageFee = revenueAgg[0]?.avg ?? 0;

    return {
      totalRevenue,
      totalPaidClaims,
      totalPendingPaymentClaims,
      averageFee: Math.round(averageFee * 100) / 100,
      revenueByMonth: revenueByMonthAgg.map((r: { _id: string; revenue: number; count: number }) => ({
        month: r._id,
        revenue: r.revenue,
        count: r.count,
      })),
      topPayingUsers: topPayingUsersAgg.map((u: { userId: string; name: string; email: string; totalPaid: number; claimCount: number }) => ({
        userId: u.userId?.toString(),
        name: u.name,
        email: u.email,
        totalPaid: u.totalPaid,
        claimCount: u.claimCount,
      })),
      recentPayments: recentPaymentsAgg.map((claim) => ({
        claimId: claim._id.toString(),
        claimantName: (claim.claimantId as unknown as { name: string })?.name ?? 'Unknown',
        claimantEmail: (claim.claimantId as unknown as { email: string })?.email ?? '',
        amount: claim.feeDetails?.totalAmount ?? 0,
        paidAt: claim.feeDetails?.paidAt ?? new Date(),
        itemDescription: (claim.itemId as unknown as { description: string })?.description ?? 'Unknown Item',
      })),
    };
  }
}

export default new AnalyticsService();
