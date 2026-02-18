import { ItemCategory } from '../../common/types';

// ─── Conversation State ────────────────────────────────────────────────────────

export type ConversationStep =
  | 'GREETING'
  | 'COLLECTING_CATEGORY'
  | 'COLLECTING_DESCRIPTION'
  | 'COLLECTING_LOCATION'
  | 'COLLECTING_DATE'
  | 'COLLECTING_FEATURES'
  | 'COLLECTING_PHONE'
  | 'CONFIRMING'
  | 'COMPLETED'
  | 'CANCELLED';

// ─── Intent Classification ─────────────────────────────────────────────────────

export type ChatIntent =
  | 'FILE_REPORT'    // User wants to file a lost item report
  | 'SEARCH_ITEMS'   // User wants to search found items
  | 'MY_REPORTS'     // User wants to see their own lost reports
  | 'CHECK_MATCHES'  // User wants to check matches for a specific report
  | 'MY_PICKUPS'     // User wants to see their pickup status
  | 'UNKNOWN';       // Cannot determine intent

export interface IntentClassification {
  intent: ChatIntent;
  /** Extracted search keyword (for SEARCH_ITEMS) */
  keyword?: string;
  /** Extracted category (for SEARCH_ITEMS) */
  category?: string;
  /** Report ID (for CHECK_MATCHES) */
  reportId?: string;
}

// ─── Query Result Types ────────────────────────────────────────────────────────

export interface ChatFoundItem {
  id: string;
  category: string;
  description: string;
  locationFound: string;
  dateFound: string;
  status: string;
}

export interface ChatLostReport {
  id: string;
  category: string;
  description: string;
  locationLost: string;
  dateLost: string;
  createdAt: string;
}

export interface ChatMatch {
  matchId: string;
  confidenceScore: number;
  item: ChatFoundItem;
}

export interface ChatPickup {
  pickupId: string;
  referenceCode: string;
  pickupDate: string;
  startTime: string;
  endTime: string;
  isCompleted: boolean;
  isVerified: boolean;
  itemDescription: string;
  itemCategory: string;
}

export type ChatQueryResultType = 'SEARCH_ITEMS' | 'MY_REPORTS' | 'CHECK_MATCHES' | 'MY_PICKUPS';

export interface ChatQueryResult {
  type: ChatQueryResultType;
  items?: ChatFoundItem[];
  reports?: ChatLostReport[];
  matches?: ChatMatch[];
  pickups?: ChatPickup[];
  total: number;
  message: string;
}

// ─── Collected Report Data ─────────────────────────────────────────────────────

export interface CollectedReportData {
  category?: ItemCategory;
  description?: string;
  locationLost?: string;
  dateLost?: Date;
  identifyingFeatures?: string[];
  contactPhone?: string;
}

// ─── Session ───────────────────────────────────────────────────────────────────

export interface ConversationSession {
  sessionId: string;
  userId: string;
  userEmail: string;
  step: ConversationStep;
  /** Active intent — set after first classification */
  intent: ChatIntent;
  collectedData: CollectedReportData;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

// ─── Message Types ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ─── API Request/Response ──────────────────────────────────────────────────────

export interface SendMessageResponse {
  sessionId: string;
  reply: string;
  step: ConversationStep;
  intent: ChatIntent;
  collectedData: CollectedReportData;
  reportId?: string;
  queryResult?: ChatQueryResult;
}

// ─── Groq AI Types ─────────────────────────────────────────────────────────────

export interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GrokChoice {
  message: GrokMessage;
  finish_reason: string;
}

export interface GrokResponse {
  choices: GrokChoice[];
}

export interface ExtractedData {
  category?: string;
  description?: string;
  locationLost?: string;
  dateLost?: string;
  identifyingFeatures?: string[];
  contactPhone?: string;
  intent?: 'provide_info' | 'confirm' | 'cancel' | 'skip';
}
