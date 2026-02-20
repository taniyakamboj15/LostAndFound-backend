import Item from '../item/item.model';
import Claim from '../claim/claim.model';
import Storage from '../storage/storage.model';
import { 
    ItemCategory, 
    ClaimStatus, 
    ItemStatus,
    PredictionResult,
    CategoryCount,
    AnalyticsMetrics,
    StaffWorkload
} from '../../common/types';
import { subDays, startOfDay } from 'date-fns';
import cacheService from '../../common/services/cache.service';
import { CACHE_TTL } from '../../common/constants';

class AnalyticsService {
    async predictTimeToClaim(category: ItemCategory, location: string): Promise<PredictionResult> {
        const cacheKey = `analytics:prediction:${category}:${location.toLowerCase().replace(/\s+/g, '_')}`;

        return cacheService.wrap(
            cacheKey,
            async () => {
        const historicalStats = await Item.aggregate([
            { 
                $match: { 
                    category, 
                    status: { $in: [ItemStatus.CLAIMED, ItemStatus.RETURNED] },
                    createdAt: { $exists: true },
                    updatedAt: { $exists: true }
                } 
            },
            {
                $project: {
                    daysToClaim: {
                        $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 1000 * 60 * 60 * 24]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgDays: { $avg: '$daysToClaim' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const totalInCategory = await Item.countDocuments({ category });
        const claimedInCategory = await Item.countDocuments({ 
            category, 
            status: { $in: [ItemStatus.CLAIMED, ItemStatus.RETURNED] } 
        });
        
        const baseLikelihood = totalInCategory > 0 ? claimedInCategory / totalInCategory : 0.5;

        const hasEnoughData = historicalStats.length > 0 && historicalStats[0].count >= 5;
        const avgDays = hasEnoughData ? Math.round(historicalStats[0].avgDays) : 7;
        
        const prediction = {
            minDays: Math.max(1, Math.floor(avgDays * 0.7)),
            maxDays: Math.max(2, Math.ceil(avgDays * 1.3)),
            confidence: hasEnoughData ? Math.min(0.95, 0.5 + (historicalStats[0].count / 100)) : 0.4
        };

        const highTrafficLocations = ['terminal', 'lobby', 'entrance', 'cafe', 'station', 'gate'];
        const isHighTraffic = highTrafficLocations.some(loc => location.toLowerCase().includes(loc));

        if (isHighTraffic) {
             return {
                minDays: Math.max(1, Math.floor(prediction.minDays * 0.8)),
                maxDays: Math.max(2, Math.floor(prediction.maxDays * 0.8)),
                confidence: Math.min(0.99, prediction.confidence + 0.05),
                likelihood: Math.min(1, baseLikelihood * 1.1)
             };
        }

        return { ...prediction, likelihood: baseLikelihood };
      },
      CACHE_TTL.ANALYTICS_PREDICTION
    );
  }

    async optimizeStorage(): Promise<{
        usage: number;
        recommendations: string[];
        slowMovingCategories: string[];
    }> {
        const stats = await Item.aggregate([
            { $match: { status: ItemStatus.AVAILABLE } },
            {
                $group: {
                    _id: '$category',
                    avgAge: { $avg: { $subtract: [new Date(), '$dateFound'] } },
                    count: { $sum: 1 }
                }
            }
        ]);

        const msPerDay = 1000 * 60 * 60 * 24;
        const slowMoving = stats
            .filter(s => (s.avgAge / msPerDay) > 30)
            .map(s => s._id);

        const recommendations = [];
        if (slowMoving.length > 0) {
            recommendations.push(`Consider running a donation drive for: ${slowMoving.join(', ')}`);
        }
        
        // Fetch real storage capacity from all active storage units
        const storageUnits = await Storage.find({ isActive: true });
        const totalCapacity = storageUnits.reduce((acc, unit) => {
            return acc + (unit.capacity.small + unit.capacity.medium + unit.capacity.large);
        }, 0);
        
        const totalItems = stats.reduce((acc, curr) => acc + curr.count, 0);
        const finalCapacity = totalCapacity || 500; // Fallback to 500 if no storage units defined

        if (totalItems > finalCapacity * 0.8) {
            recommendations.push('Storage is nearing capacity (80%+). Review disposal policies or add storage units.');
        }

        return {
            usage: (totalItems / finalCapacity) * 100,
            recommendations,
            slowMovingCategories: slowMoving
        };
    }

    async getOptimizationInsights() {
        const stats = await Item.aggregate([
            {
                $group: {
                    _id: '$category',
                    avgRetention: { $avg: { $subtract: ['$retentionExpiryDate', '$dateFound'] } },
                    count: { $sum: 1 }
                }
            }
        ]);
        return stats;
    }

    async getPredictionAccuracy() {
        const stats = await Item.aggregate([
            { $match: { 'prediction.isAccuracyTracked': true, actualClaimDays: { $exists: true } } },
            {
                $project: {
                    error: { $abs: { $subtract: ['$prediction.estimatedDaysToClaim', '$prediction.actualClaimDays'] } },
                    category: 1
                }
            },
            {
                $group: {
                    _id: '$category',
                    avgError: { $avg: '$error' },
                    count: { $sum: 1 }
                }
            }
        ]);
        return stats;
    }

    async getStaffWorkloadTrends(): Promise<StaffWorkload> {
        const stats = await Item.aggregate([
            {
                $group: {
                    _id: { $hour: '$createdAt' },
                    intakeCount: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    hour: '$_id',
                    intakeCount: 1,
                    _id: 0
                }
            }
        ]) as { hour: number; intakeCount: number }[];
        
        // Also combine with claim peaks if possible
        const claimStats = await Claim.aggregate([
            {
                $group: {
                    _id: { $hour: '$createdAt' },
                    claimCount: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    hour: '$_id',
                    claimCount: 1,
                    _id: 0
                }
            }
        ]) as { hour: number; claimCount: number }[];

        return { intake: stats, claims: claimStats };
    }

    async getDashboardMetrics(): Promise<AnalyticsMetrics> {
        const totalItemsFound = await Item.countDocuments();
        const totalItemsClaimed = await Item.countDocuments({ status: ItemStatus.CLAIMED });
        const totalItemsReturned = await Item.countDocuments({ status: ItemStatus.RETURNED });
        const totalItemsDisposed = await Item.countDocuments({ status: ItemStatus.DISPOSED });
        
        const totalClaims = await Claim.countDocuments();
        const verifiedClaims = await Claim.countDocuments({ status: ClaimStatus.VERIFIED });
        const pendingClaims = await Claim.countDocuments({ status: ClaimStatus.FILED });
        const pendingReviewClaims = await Claim.countDocuments({ 
            status: { $in: [ClaimStatus.FILED, ClaimStatus.IDENTITY_PROOF_REQUESTED] } 
        });
        const readyForHandoverClaims = await Claim.countDocuments({ status: ClaimStatus.PICKUP_BOOKED });
        
        const matchSuccessRate = totalClaims > 0 ? verifiedClaims / totalClaims : 0;
        
        // Expiring items (within next 7 days)
        const expiringItems = await Item.countDocuments({
            status: ItemStatus.AVAILABLE,
            retentionExpiryDate: { $lte: subDays(new Date(), -7) }
        });

        const rawBreakdown = await this.getCategoryBreakdown();
        const categoryBreakdown = rawBreakdown.reduce((acc: Record<string, number>, curr: CategoryCount) => {
            acc[curr.category] = curr.count;
            return acc;
        }, {} as Record<string, number>);

        const closedClaims = await Claim.find({ 
            status: ClaimStatus.RETURNED,
            verifiedAt: { $exists: true }
        }).limit(100);
        
        const avgRecoveryTime = closedClaims.length > 0
            ? closedClaims.reduce((acc, c) => acc + (c.verifiedAt!.getTime() - c.createdAt.getTime()), 0) / closedClaims.length / (1000 * 60 * 60 * 24)
            : 0;

        const highRiskClaims = await Claim.countDocuments({
            fraudRiskScore: { $gte: parseInt(process.env.FRAUD_HIGH_RISK_THRESHOLD || '70') }
        });

        return {
            totalItemsFound,
            totalItemsClaimed,
            totalItemsReturned,
            totalItemsDisposed,
            matchSuccessRate,
            averageRecoveryTime: Math.round(avgRecoveryTime * 10) / 10,
            pendingClaims,
            pendingReviewClaims,
            readyForHandoverClaims,
            expiringItems,
            highRiskClaims,
            categoryBreakdown
        };
    }

    async getCategoryBreakdown(): Promise<CategoryCount[]> {
        const breakdown = await Item.aggregate([
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    category: '$_id',
                    count: 1,
                    _id: 0
                }
            }
        ]) as CategoryCount[];
        return breakdown;
    }

    async getItemTrends(days: number) {
        const startDate = startOfDay(subDays(new Date(), days));
        
        const trends = await Item.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                    },
                    found: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            },
            {
                $project: {
                    date: '$_id',
                    found: 1,
                    claimed: { $literal: 0 },
                    returned: { $literal: 0 },
                    _id: 0
                }
            }
        ]);
        return trends;
    }

    async getDispositionStats() {
        const stats = await Item.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        return stats;
    }

    async getPaymentAnalytics() {
        const stats = await Claim.aggregate([
            {
                $facet: {
                    summary: [
                        { $match: { 'feeDetails.paidAt': { $exists: true } } },
                        {
                            $group: {
                                _id: null,
                                totalRevenue: { $sum: '$feeDetails.totalAmount' },
                                totalPaidClaims: { $sum: 1 }
                            }
                        }
                    ],
                    pendingCount: [
                        { $match: { paymentStatus: 'PENDING', status: 'VERIFIED' } },
                        { $count: 'count' }
                    ],
                    monthly: [
                        { $match: { 'feeDetails.paidAt': { $exists: true } } },
                        {
                            $group: {
                                _id: { $dateToString: { format: '%Y-%m', date: '$feeDetails.paidAt' } },
                                revenue: { $sum: '$feeDetails.totalAmount' },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { _id: 1 } },
                        { $project: { month: '$_id', revenue: 1, count: 1, _id: 0 } }
                    ],
                    topUsers: [
                        { $match: { 'feeDetails.paidAt': { $exists: true } } },
                        {
                            $group: {
                                _id: '$claimantId',
                                totalPaid: { $sum: '$feeDetails.totalAmount' },
                                claimCount: { $sum: 1 }
                            }
                        },
                        { $sort: { totalPaid: -1 } },
                        { $limit: 5 },
                        {
                            $lookup: {
                                from: 'users',
                                localField: '_id',
                                foreignField: '_id',
                                as: 'user'
                            }
                        },
                        { $unwind: '$user' },
                        {
                            $project: {
                                userId: '$_id',
                                name: '$user.name',
                                email: '$user.email',
                                totalPaid: 1,
                                claimCount: 1,
                                _id: 0
                            }
                        }
                    ],
                    recent: [
                        { $match: { 'feeDetails.paidAt': { $exists: true } } },
                        { $sort: { 'feeDetails.paidAt': -1 } },
                        { $limit: 5 },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'claimantId',
                                foreignField: '_id',
                                as: 'user'
                            }
                        },
                        { $unwind: '$user' },
                        {
                            $project: {
                                claimId: '$_id',
                                claimantName: '$user.name',
                                claimantEmail: '$user.email',
                                amount: '$feeDetails.totalAmount',
                                paidAt: '$feeDetails.paidAt',
                                itemDescription: '$description',
                                _id: 0
                            }
                        }
                    ]
                }
            }
        ]);

        const result = stats[0];
        const summary = result.summary[0] || { totalRevenue: 0, totalPaidClaims: 0 };
        const averageFee = summary.totalPaidClaims > 0 ? summary.totalRevenue / summary.totalPaidClaims : 0;

        return {
            totalRevenue: summary.totalRevenue,
            totalPaidClaims: summary.totalPaidClaims,
            totalPendingPaymentClaims: result.pendingCount[0]?.count || 0,
            averageFee,
            revenueByMonth: result.monthly,
            topPayingUsers: result.topUsers,
            recentPayments: result.recent
        };
    }
}

export default new AnalyticsService();
