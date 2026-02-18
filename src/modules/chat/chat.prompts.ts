import { ItemCategory } from '../../common/types';
import { CollectedReportData, ConversationStep } from './chat.types';

const TODAY = () => new Date().toISOString().split('T')[0];
const CATEGORIES = Object.values(ItemCategory).join(', ');

export const INTENT_SYSTEM_PROMPT = `You are a Lost & Found assistant intent classifier.
Classify the user's message into exactly one intent:
- FILE_REPORT: User wants to file/report a lost item
- SEARCH_ITEMS: User wants to search for found items
- MY_REPORTS: User wants to see their own lost reports
- CHECK_MATCHES: User wants to check if found items match their report
- MY_PICKUPS: User wants to see their pickup schedule/status
- UNKNOWN: Cannot determine

Respond ONLY with valid JSON:
{
  "intent": "FILE_REPORT|SEARCH_ITEMS|MY_REPORTS|CHECK_MATCHES|MY_PICKUPS|UNKNOWN",
  "keyword": "search keyword if SEARCH_ITEMS, else null",
  "category": "item category if mentioned, else null",
  "reportId": "report ID if CHECK_MATCHES and user provided one, else null"
}`;

export function buildReportSystemPrompt(): string {
  return `You are a helpful Lost & Found assistant collecting information to file a lost item report.
Respond ONLY in valid JSON. No markdown, no extra text.

Format:
{
  "reply": "Your friendly message",
  "extracted": {
    "category": "one of: ${CATEGORIES} or null",
    "description": "item description or null",
    "locationLost": "location or null",
    "dateLost": "YYYY-MM-DD or null",
    "identifyingFeatures": ["feature1"] or null,
    "contactPhone": "phone or null",
    "intent": "provide_info|confirm|cancel|skip"
  }
}

Rules:
- Be empathetic and concise
- Today is ${TODAY()}. Interpret "yesterday", "today", "last Monday" accordingly
- Map common words to categories: phone/mobile/iphone→ELECTRONICS, wallet/purse→ACCESSORIES, bag/backpack→BAGS, keys→KEYS, laptop/tablet→ELECTRONICS, book→BOOKS, jacket/shirt→CLOTHING, ring/necklace→JEWELRY, passport/id→DOCUMENTS
- "no"/"skip"/"none"/"don't have" → intent: "skip"
- Confirmation → intent: "confirm"
- Cancellation → intent: "cancel"`;
}

export function getStepPrompt(step: ConversationStep, data: CollectedReportData): string {
  switch (step) {
    case 'GREETING':
      return "Hello! I'm your Lost & Found assistant 🤖\n\nI can help you:\n• 📋 **File a lost item report**\n• 🔍 **Search found items**\n• 📄 **View your reports**\n• 🔗 **Check matches for your report**\n• 📦 **View your pickups**\n\nWhat would you like to do?";
    case 'COLLECTING_CATEGORY':
      return 'What type of item did you lose? (Electronics, Bags, Documents, Keys, Clothing, Accessories, Jewelry, Books, Sports Equipment, or Other)';
    case 'COLLECTING_DESCRIPTION':
      return 'Can you describe the item? (color, brand, model, size, etc.)';
    case 'COLLECTING_LOCATION':
      return 'Where did you lose it? Be as specific as possible (building, floor, area, etc.)';
    case 'COLLECTING_DATE':
      return 'When did you lose it? (today, yesterday, or a specific date)';
    case 'COLLECTING_FEATURES':
      return "Any unique identifying features? (serial number, stickers, engravings) Say 'none' to skip.";
    case 'COLLECTING_PHONE':
      return "Your contact phone number? (optional — say 'skip' to skip)";
    case 'CONFIRMING':
      return [
        'Please confirm your report:',
        `• **Category:** ${data.category}`,
        `• **Description:** ${data.description}`,
        `• **Location:** ${data.locationLost}`,
        `• **Date:** ${data.dateLost?.toLocaleDateString()}`,
        `• **Features:** ${data.identifyingFeatures?.join(', ') || 'None'}`,
        `• **Phone:** ${data.contactPhone || 'Not provided'}`,
        '',
        'Type **"confirm"** to file or **"cancel"** to start over.',
      ].join('\n');
    default:
      return '';
  }
}
