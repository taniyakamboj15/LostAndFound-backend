import { v4 as uuidv4 } from 'uuid';
import { ConversationSession, ConversationStep, CollectedReportData, ChatMessage } from './chat.types';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const sessions = new Map<string, ConversationSession>();

// Cleanup expired sessions
setInterval(() => {
  const now = new Date();
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt < now) sessions.delete(id);
  }
}, CLEANUP_INTERVAL_MS);

export function createSession(userId: string, userEmail: string): ConversationSession {
  const now = new Date();
  const session: ConversationSession = {
    sessionId: uuidv4(),
    userId,
    userEmail,
    step: 'GREETING',
    intent: 'UNKNOWN',
    collectedData: {},
    messages: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  };
  sessions.set(session.sessionId, session);
  return session;
}

export function getSession(sessionId: string): ConversationSession | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  if (session.expiresAt < new Date()) {
    sessions.delete(sessionId);
    return undefined;
  }
  return session;
}

export function updateSession(session: ConversationSession): void {
  session.updatedAt = new Date();
  session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  sessions.set(session.sessionId, session);
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function addMessage(session: ConversationSession, role: ChatMessage['role'], content: string): void {
  session.messages.push({ role, content, timestamp: new Date() });
}

export function getNextStep(
  currentStep: ConversationStep,
  data: CollectedReportData,
  intent: string
): ConversationStep {
  if (intent === 'cancel') return 'CANCELLED';

  switch (currentStep) {
    case 'GREETING':
      if (data.category && data.description && data.locationLost && data.dateLost) {
        return data.identifyingFeatures ? 'COLLECTING_PHONE' : 'COLLECTING_FEATURES';
      }
      if (data.category) return data.description ? 'COLLECTING_LOCATION' : 'COLLECTING_DESCRIPTION';
      return 'COLLECTING_CATEGORY';

    case 'COLLECTING_CATEGORY':
      return data.category ? (data.description ? 'COLLECTING_LOCATION' : 'COLLECTING_DESCRIPTION') : 'COLLECTING_CATEGORY';

    case 'COLLECTING_DESCRIPTION':
      return data.description ? (data.locationLost ? 'COLLECTING_DATE' : 'COLLECTING_LOCATION') : 'COLLECTING_DESCRIPTION';

    case 'COLLECTING_LOCATION':
      return data.locationLost ? (data.dateLost ? 'COLLECTING_FEATURES' : 'COLLECTING_DATE') : 'COLLECTING_LOCATION';

    case 'COLLECTING_DATE':
      return data.dateLost ? 'COLLECTING_FEATURES' : 'COLLECTING_DATE';

    case 'COLLECTING_FEATURES':
      return 'COLLECTING_PHONE';

    case 'COLLECTING_PHONE':
      return 'CONFIRMING';

    case 'CONFIRMING':
      return intent === 'confirm' ? 'COMPLETED' : 'CONFIRMING';

    default:
      return currentStep;
  }
}

export function mergeExtractedData(
  data: CollectedReportData,
  extracted: Partial<{
    category: string;
    description: string;
    locationLost: string;
    dateLost: string;
    identifyingFeatures: string[];
    contactPhone: string;
  }>,
  validCategories: string[]
): void {
  if (extracted.category) {
    const normalized = extracted.category.toUpperCase().replace(/\s+/g, '_');
    if (validCategories.includes(normalized)) {
      data.category = normalized as CollectedReportData['category'];
    }
  }
  if (extracted.description) data.description = extracted.description;
  if (extracted.locationLost) data.locationLost = extracted.locationLost;
  if (extracted.dateLost) {
    const parsed = new Date(extracted.dateLost);
    if (!isNaN(parsed.getTime())) data.dateLost = parsed;
  }
  if (extracted.identifyingFeatures?.length) data.identifyingFeatures = extracted.identifyingFeatures;
  if (extracted.contactPhone) data.contactPhone = extracted.contactPhone;
}
