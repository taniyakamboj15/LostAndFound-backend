import { ItemCategory } from '../../common/types';
import lostReportService from '../lost-report/lost-report.service';
import matchService from '../match/match.service';
import pickupService from '../pickup/pickup.service';
import Item from '../item/item.model';
import {
  ChatQueryResult,
  ChatFoundItem,
  ChatLostReport,
  ChatMatch,
  ChatPickup,
  IntentClassification,
} from './chat.types';





export async function handleSearchItems(params: IntentClassification): Promise<ChatQueryResult> {
  const query: Record<string, unknown> = { status: 'AVAILABLE' };

  if (params.category) {
    const normalized = params.category.toUpperCase().replace(/\s+/g, '_');
    if (Object.values(ItemCategory).includes(normalized as ItemCategory)) {
      query['category'] = normalized;
    }
  }

  if (params.keyword) {
    query['$or'] = [
      { description: { $regex: params.keyword, $options: 'i' } },
      { locationFound: { $regex: params.keyword, $options: 'i' } },
    ];
  }

  const rawItems = await Item.find(query).sort({ dateFound: -1 }).limit(5).lean();

  const items: ChatFoundItem[] = rawItems.map((item) => ({
    id: item._id.toString(),
    category: item.category,
    description: item.description,
    locationFound: item.locationFound,
    dateFound: new Date(item.dateFound).toLocaleDateString('en-IN'),
    status: item.status,
  }));

  const label = params.keyword || params.category || 'items';

  return items.length === 0
    ? { type: 'SEARCH_ITEMS', items: [], total: 0, message: `No available items matching "${label}". File a report so we can notify you when a match is found.` }
    : { type: 'SEARCH_ITEMS', items, total: items.length, message: `Found ${items.length} item(s) matching "${label}":` };
}



export async function handleMyReports(userId: string): Promise<ChatQueryResult> {
  const result = await lostReportService.getMyReports(
    userId,
    {},
    { page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }
  );

  const reports: ChatLostReport[] = result.data.map((r) => ({
    id: r._id.toString(),
    category: r.category,
    description: r.description,
    locationLost: r.locationLost,
    dateLost: new Date(r.dateLost).toLocaleDateString('en-IN'),
    createdAt: new Date(r.createdAt).toLocaleDateString('en-IN'),
  }));

  return reports.length === 0
    ? { type: 'MY_REPORTS', reports: [], total: 0, message: "You haven't filed any lost reports yet. Would you like to file one?" }
    : { type: 'MY_REPORTS', reports, total: result.pagination.total, message: `You have ${result.pagination.total} report(s). Showing the latest ${reports.length}:` };
}


export async function handleCheckMatches(reportId: string | undefined, userId: string): Promise<ChatQueryResult> {
  let resolvedId = reportId;

  if (!resolvedId) {
    const latest = await lostReportService.getMyReports(userId, {}, { page: 1, limit: 1, sortBy: 'createdAt', sortOrder: 'desc' });
    if (!latest.data.length) {
      return { type: 'CHECK_MATCHES', matches: [], total: 0, message: "You don't have any lost reports. File one first!" };
    }
    resolvedId = latest.data[0]._id.toString();
  }

  try {
    const report = await lostReportService.getLostReportById(resolvedId);
    const ownerId = String(report.reportedBy);
    if (ownerId !== userId) {
      return { type: 'CHECK_MATCHES', matches: [], total: 0, message: 'You can only check matches for your own reports.' };
    }
  } catch {
    return { type: 'CHECK_MATCHES', matches: [], total: 0, message: 'Report not found. Please provide a valid report ID.' };
  }

  const rawMatches = await matchService.getMatchesForReport(resolvedId);

  const matches: ChatMatch[] = rawMatches.slice(0, 5).map((m) => {
    const item = m.itemId as unknown as {
      _id: { toString(): string };
      category: string;
      description: string;
      locationFound: string;
      dateFound: Date;
      status: string;
    };
    return {
      matchId: m._id.toString(),
      confidenceScore: Math.round(m.confidenceScore * 100),
      item: {
        id: item._id.toString(),
        category: item.category,
        description: item.description,
        locationFound: item.locationFound,
        dateFound: new Date(item.dateFound).toLocaleDateString('en-IN'),
        status: item.status,
      },
    };
  });

  return matches.length === 0
    ? { type: 'CHECK_MATCHES', matches: [], total: 0, message: `No matches yet for report ${resolvedId.slice(-6).toUpperCase()}. We'll email you when one is found!` }
    : { type: 'CHECK_MATCHES', matches, total: rawMatches.length, message: `${rawMatches.length} potential match(es) found (showing top ${matches.length}):` };
}

export async function handleMyPickups(userId: string): Promise<ChatQueryResult> {
  const result = await pickupService.getMyPickups(userId, { page: 1, limit: 5 });

  const pickups: ChatPickup[] = result.data.map((p) => {
    const item = p.itemId as unknown as { description: string; category: string } | null;
    return {
      pickupId: p._id.toString(),
      referenceCode: p.referenceCode,
      pickupDate: new Date(p.pickupDate).toLocaleDateString('en-IN'),
      startTime: p.startTime,
      endTime: p.endTime,
      isCompleted: p.isCompleted,
      isVerified: p.isVerified,
      itemDescription: item?.description ?? 'Unknown item',
      itemCategory: item?.category ?? 'Unknown',
    };
  });

  return pickups.length === 0
    ? { type: 'MY_PICKUPS', pickups: [], total: 0, message: "No pickups scheduled yet. Pickups are booked after your claim is verified." }
    : { type: 'MY_PICKUPS', pickups, total: result.total, message: `You have ${result.total} pickup(s). Showing the latest ${pickups.length}:` };
}
