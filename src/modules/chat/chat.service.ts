import Groq from 'groq-sdk';
import logger from '../../common/utils/logger';
import { ItemCategory } from '../../common/types';
import lostReportService from '../lost-report/lost-report.service';
import {
  ConversationSession,
  GrokMessage,
  ExtractedData,
  SendMessageResponse,
  IntentClassification,
  ChatQueryResult,
  ChatIntent,
} from './chat.types';
import {
  createSession,
  getSession,
  updateSession,
  deleteSession as removeSession,
  addMessage,
  getNextStep,
  mergeExtractedData,
} from './chat.session';
import { INTENT_SYSTEM_PROMPT, buildReportSystemPrompt, getStepPrompt } from './chat.prompts';
import { handleSearchItems, handleMyReports, handleCheckMatches, handleMyPickups } from './chat.handlers';

// ─── Groq AI Client ────────────────────────────────────────────────────────────

const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not set');
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

async function callGroq(messages: GrokMessage[]): Promise<string> {
  const response = await getGroqClient().chat.completions.create({
    model: GROQ_MODEL,
    messages: messages as Groq.Chat.ChatCompletionMessageParam[],
    temperature: 0.3,
    max_completion_tokens: 600,
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from Groq');
  return content.trim();
}

function serializeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ─── Intent Classification ─────────────────────────────────────────────────────

async function classifyIntent(message: string): Promise<IntentClassification> {
  try {
    const raw = await callGroq([
      { role: 'system', content: INTENT_SYSTEM_PROMPT },
      { role: 'user', content: message },
    ]);
    const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim()) as IntentClassification;
    return {
      intent: parsed.intent ?? 'UNKNOWN',
      keyword: parsed.keyword ?? undefined,
      category: parsed.category ?? undefined,
      reportId: parsed.reportId ?? undefined,
    };
  } catch (err) {
    logger.warn(`Intent classification failed: ${serializeError(err)}`);
    return { intent: 'UNKNOWN' };
  }
}

// ─── Intent Dispatch ───────────────────────────────────────────────────────────

const INTENT_HANDLERS: Partial<Record<ChatIntent, (params: IntentClassification, userId: string) => Promise<ChatQueryResult>>> = {
  SEARCH_ITEMS: (p) => handleSearchItems(p),
  MY_REPORTS: (_, uid) => handleMyReports(uid),
  CHECK_MATCHES: (p, uid) => handleCheckMatches(p.reportId, uid),
  MY_PICKUPS: (_, uid) => handleMyPickups(uid),
};

// ─── Report Filing ─────────────────────────────────────────────────────────────

async function parseGroqResponse(raw: string): Promise<{ reply: string; extracted: ExtractedData }> {
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned) as { reply: string; extracted: ExtractedData };
  } catch {
    return { reply: raw, extracted: {} };
  }
}

async function fileReport(session: ConversationSession, userId: string, userEmail: string): Promise<{ reportId: string; reply: string }> {
  const report = await lostReportService.createLostReport({
    category: session.collectedData.category!,
    description: session.collectedData.description!,
    locationLost: session.collectedData.locationLost!,
    dateLost: session.collectedData.dateLost!,
    reportedBy: userId,
    contactEmail: userEmail,
    contactPhone: session.collectedData.contactPhone,
    identifyingFeatures: session.collectedData.identifyingFeatures || [],
  });
  const reportId = report._id.toString();
  const reply = `✅ Report filed!\n\n**Report ID:** \`${reportId}\`\n\nWe'll notify you by email if a matching item is found. Anything else I can help with?`;
  return { reportId, reply };
}

// ─── Main Chat Service ─────────────────────────────────────────────────────────

class ChatService {
  async startSession(userId: string, userEmail: string): Promise<SendMessageResponse> {
    const session = createSession(userId, userEmail);
    const greeting = getStepPrompt('GREETING', {});
    addMessage(session, 'assistant', greeting);
    updateSession(session);

    return {
      sessionId: session.sessionId,
      reply: greeting,
      step: session.step,
      intent: session.intent,
      collectedData: session.collectedData,
    };
  }

  async processMessage(
    sessionId: string,
    userMessage: string,
    userId: string,
    userEmail: string
  ): Promise<SendMessageResponse> {
    let session = getSession(sessionId) ?? createSession(userId, userEmail);

    // Guard: completed / cancelled
    if (session.step === 'COMPLETED' || session.step === 'CANCELLED') {
      return {
        sessionId: session.sessionId,
        reply: session.step === 'COMPLETED'
          ? 'Your report is already filed. Start a new chat to file another or ask me anything!'
          : "Session cancelled. Start a new chat whenever you're ready!",
        step: session.step,
        intent: session.intent,
        collectedData: session.collectedData,
      };
    }

    addMessage(session, 'user', userMessage);

    // ── Intent routing at GREETING ──────────────────────────────────────────
    if (session.step === 'GREETING' && session.intent === 'UNKNOWN') {
      const classification = await classifyIntent(userMessage);
      session.intent = classification.intent;

      const handler = INTENT_HANDLERS[classification.intent];
      if (handler) {
        let queryResult: ChatQueryResult;
        try {
          queryResult = await handler(classification, userId);
        } catch (err) {
          logger.error(`Intent handler error: ${serializeError(err)}`);
          queryResult = { type: classification.intent as ChatQueryResult['type'], total: 0, message: 'Something went wrong. Please try again.' };
        }

        const reply = `${queryResult.message}\n\nAnything else? Say **"file a report"** to report a lost item.`;
        addMessage(session, 'assistant', reply);
        session.intent = 'UNKNOWN'; // reset for next message
        updateSession(session);

        return {
          sessionId: session.sessionId,
          reply,
          step: session.step,
          intent: classification.intent,
          collectedData: session.collectedData,
          queryResult,
        };
      }

      // FILE_REPORT or UNKNOWN → enter filing flow
      if (classification.intent === 'FILE_REPORT') {
        session.step = 'COLLECTING_CATEGORY';
      }
    }

    // ── Multi-step report filing ────────────────────────────────────────────
    const grokMessages: GrokMessage[] = [
      { role: 'system', content: buildReportSystemPrompt() },
      ...session.messages.slice(-10).map((m) => ({ role: m.role as GrokMessage['role'], content: m.content })),
    ];

    let aiReply: string;
    let extracted: ExtractedData;

    try {
      const raw = await callGroq(grokMessages);
      ({ reply: aiReply, extracted } = await parseGroqResponse(raw));
    } catch (err) {
      logger.error(`Groq call failed: ${serializeError(err)}`);
      throw new Error('AI service temporarily unavailable. Please try again.');
    }

    mergeExtractedData(session.collectedData, extracted, Object.values(ItemCategory));

    const flowIntent = extracted.intent ?? 'provide_info';
    const nextStep = getNextStep(session.step, session.collectedData, flowIntent);
    session.step = nextStep;

    let reportId: string | undefined;

    if (nextStep === 'COMPLETED') {
      try {
        ({ reportId, reply: aiReply } = await fileReport(session, userId, userEmail));
        logger.info(`Chat session ${sessionId} filed report ${reportId}`);
      } catch (err) {
        logger.error(`Report creation failed: ${serializeError(err)}`);
        session.step = 'CONFIRMING';
        aiReply = 'Sorry, there was an error filing your report. Please try confirming again.';
      }
    } else if (nextStep === 'CANCELLED') {
      aiReply = "No problem! Report cancelled. Start a new chat whenever you're ready.";
    } else {
      const stepPrompt = getStepPrompt(nextStep, session.collectedData);
      if (stepPrompt && aiReply && !aiReply.includes(stepPrompt)) {
        aiReply = `${aiReply}\n\n${stepPrompt}`;
      } else if (!aiReply) {
        aiReply = stepPrompt;
      }
    }

    addMessage(session, 'assistant', aiReply);
    updateSession(session);

    return {
      sessionId: session.sessionId,
      reply: aiReply,
      step: session.step,
      intent: session.intent,
      collectedData: session.collectedData,
      reportId,
    };
  }

  getSession(sessionId: string): ConversationSession | undefined {
    return getSession(sessionId);
  }

  deleteSession(sessionId: string): void {
    removeSession(sessionId);
  }
}

export default new ChatService();
