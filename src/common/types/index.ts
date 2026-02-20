import { Request } from 'express';
import { Document, Types } from 'mongoose';

// --- Enums ---

export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  CLAIMANT = 'CLAIMANT',
}

export enum ItemStatus {
  AVAILABLE = 'AVAILABLE',
  CLAIMED = 'CLAIMED',
  RETURNED = 'RETURNED',
  DISPOSED = 'DISPOSED',
}

export enum ItemCategory {
  ELECTRONICS = 'ELECTRONICS',
  DOCUMENTS = 'DOCUMENTS',
  CLOTHING = 'CLOTHING',
  ACCESSORIES = 'ACCESSORIES',
  BAGS = 'BAGS',
  KEYS = 'KEYS',
  JEWELRY = 'JEWELRY',
  BOOKS = 'BOOKS',
  SPORTS_EQUIPMENT = 'SPORTS_EQUIPMENT',
  PERISHABLES = 'PERISHABLES',
  OTHER = 'OTHER',
}

export enum ItemColor {
  BLACK = 'BLACK',
  WHITE = 'WHITE',
  GRAY = 'GRAY',
  BROWN = 'BROWN',
  RED = 'RED',
  ORANGE = 'ORANGE',
  YELLOW = 'YELLOW',
  GREEN = 'GREEN',
  BLUE = 'BLUE',
  PURPLE = 'PURPLE',
  PINK = 'PINK',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  MULTICOLOR = 'MULTICOLOR',
}

export enum ItemSize {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
}

export enum ClaimStatus {
  FILED = 'FILED',
  IDENTITY_PROOF_REQUESTED = 'IDENTITY_PROOF_REQUESTED',
  VERIFIED = 'VERIFIED',
  AWAITING_TRANSFER = 'AWAITING_TRANSFER',
  AWAITING_RECOVERY = 'AWAITING_RECOVERY',
  IN_TRANSIT = 'IN_TRANSIT',
  ARRIVED = 'ARRIVED',
  PICKUP_BOOKED = 'PICKUP_BOOKED',
  RETURNED = 'RETURNED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum TransferStatus {
  PENDING = 'PENDING',
  RECOVERY_REQUIRED = 'RECOVERY_REQUIRED',
  IN_TRANSIT = 'IN_TRANSIT',
  ARRIVED = 'ARRIVED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

export interface FeeBreakdown {
  handlingFee: number;
  storageFee: number;
  daysStored: number;
  totalAmount: number;
}

export enum DispositionType {
  DONATE = 'DONATE',
  AUCTION = 'AUCTION',
  DISPOSE = 'DISPOSE',
}

export enum ActivityAction {
  ITEM_REGISTERED = 'ITEM_REGISTERED',
  ITEM_UPDATED = 'ITEM_UPDATED',
  LOST_REPORT_SUBMITTED = 'LOST_REPORT_SUBMITTED',
  MATCH_GENERATED = 'MATCH_GENERATED',
  CLAIM_FILED = 'CLAIM_FILED',
  PROOF_REQUESTED = 'PROOF_REQUESTED',
  PROOF_UPLOADED = 'PROOF_UPLOADED',
  CLAIM_VERIFIED = 'CLAIM_VERIFIED',
  CLAIM_REJECTED = 'CLAIM_REJECTED',
  CHALLENGE_ISSUED = 'CHALLENGE_ISSUED',
  CHALLENGE_ANSWERED = 'CHALLENGE_ANSWERED',
  PICKUP_BOOKED = 'PICKUP_BOOKED',
  PICKUP_COMPLETED = 'PICKUP_COMPLETED',
  DISPOSITION_PROCESSED = 'DISPOSITION_PROCESSED',
  USER_REGISTERED = 'USER_REGISTERED',
  USER_VERIFIED = 'USER_VERIFIED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  TRANSFER_STARTED = 'TRANSFER_STARTED',
  TRANSFER_IN_TRANSIT = 'TRANSFER_IN_TRANSIT',
  TRANSFER_ARRIVED = 'TRANSFER_ARRIVED',
}

export enum NotificationEvent {
  MATCH_FOUND = 'MATCH_FOUND',
  CLAIM_STATUS_UPDATE = 'CLAIM_STATUS_UPDATE',
  RETENTION_EXPIRY_WARNING = 'RETENTION_EXPIRY_WARNING',
  PICKUP_REMINDER = 'PICKUP_REMINDER',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PROOF_REQUESTED = 'PROOF_REQUESTED',
  PICKUP_BOOKED = 'PICKUP_BOOKED',
  PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  ANONYMOUS_CLAIM_CREATED = 'ANONYMOUS_CLAIM_CREATED',
  NEW_CLAIM_PENDING = 'NEW_CLAIM_PENDING',
  PICKUP_COMPLETED = 'PICKUP_COMPLETED',
  TRANSFER_SENT = 'TRANSFER_SENT',
  TRANSFER_ARRIVED = 'TRANSFER_ARRIVED',
}

// --- Common Base Types ---

export interface UploadedFile {
  filename: string;
  originalName: string;
  path: string;
  mimetype: string;
  size: number;
  uploadedAt: Date;
}

// Multer file type for file uploads
export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

// Request type with multer files
export interface MulterRequest extends Omit<Request, 'files'> {
  files?: MulterFile[];
  user?: {
    id: string;
    _id: string;
    email: string;
    role: UserRole;
    isEmailVerified: boolean;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ISettingsModel extends Document {
  autoMatchThreshold: number;
  rejectThreshold: number;
  matchWeights: {
    category: number;
    keyword: number;
    date: number;
    location: number;
    feature: number;
    color: number;
  };
  updatedAt: Date;
}

// --- Domain Specific Types ---

export interface ItemSearchFilters {
  category?: ItemCategory;
  status?: ItemStatus;
  location?: string;
  dateFoundFrom?: Date;
  dateFoundTo?: Date;
  keyword?: string;
}

export interface LostReportSearchFilters {
  category?: ItemCategory;
  location?: string;
  dateLostFrom?: Date;
  dateLostTo?: Date;
  keyword?: string;
  reportedBy?: string;
}

export interface TransferSearchFilters {
  status?: TransferStatus;
  fromStorageId?: string;
  toStorageId?: string;
  claimId?: string;
  keyword?: string;
}

export interface MatchScore {
  categoryScore: number;
  keywordScore: number;
  dateScore: number;
  locationScore: number;
  featureScore: number;
  colorScore: number;
  totalScore: number;
}

export interface PickupSlot {
  date: Date;
  startTime: string;
  endTime: string;
  available: boolean;
}

export interface AnalyticsMetrics {
  totalItemsFound: number;
  totalItemsClaimed: number;
  totalItemsReturned: number;
  totalItemsDisposed: number;
  matchSuccessRate: number;
  averageRecoveryTime: number;
  pendingClaims: number;
  pendingReviewClaims: number;
  readyForHandoverClaims: number;
  expiringItems: number;
  highRiskClaims: number;
  categoryBreakdown: Record<string, number>;
}

export interface PredictionResult {
  minDays: number;
  maxDays: number;
  confidence: number;
  likelihood: number;
}

export interface CategoryCount {
  category: ItemCategory;
  count: number;
}

export interface StaffWorkload {
  intake: { hour: number; intakeCount: number }[];
  claims: { hour: number; claimCount: number }[];
}

export interface IUserModel extends Document {
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  googleId?: string;
  avatar?: string;
  phone?: string;
  notificationPreferences?: {
    emailOptOut?: boolean;
    smsOptOut?: boolean;
    channels?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface PopulatedItem extends Omit<IItemModel, 'registeredBy'> {
  registeredBy: {
    _id: string;
    name: string;
    email: string;
  };
}

export interface IItemModel extends Document {
  category: ItemCategory;
  description: string;
  photos: UploadedFile[];
  locationFound: string;
  dateFound: Date;
  status: ItemStatus;
  storageLocation?: Types.ObjectId;
  retentionPeriodDays: number;
  retentionExpiryDate: Date;
  registeredBy: Types.ObjectId;
  claimedBy?: Types.ObjectId;
  keywords: string[];
  identifyingFeatures: string[];
  isHighValue: boolean;
  estimatedValue?: number;
  // Structured markers
  brand?: string;
  color?: ItemColor;
  itemSize?: ItemSize;
  bagContents?: string[];
  secretIdentifiers?: string[]; // Staff-only, not in public listing
  // Predictive analytics data
  prediction?: {
    likelihood: number;
    estimatedDaysToClaim: number;
    confidence: number;
    actualClaimDays?: number;
    isAccuracyTracked: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface ILostReportModel extends Document {
  category: ItemCategory;
  description: string;
  keywords: string[];
  locationLost: string;
  dateLost: Date;
  reportedBy: Types.ObjectId;
  contactEmail: string;
  contactPhone?: string;
  identifyingFeatures: string[];
  starredBy: Types.ObjectId[];
  // Structured markers
  brand?: string;
  color?: ItemColor;
  itemSize?: ItemSize;
  bagContents?: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface IClaimModel extends Document {
  itemId: Types.ObjectId | IItemModel;
  claimantId?: Types.ObjectId;
  isAnonymous?: boolean;
  email?: string;
  claimToken?: string;
  lostReportId?: Types.ObjectId;
  description: string;
  status: ClaimStatus;
  preferredPickupLocation?: Types.ObjectId;
  proofDocuments: Array<{
    type: string;
    filename: string;
    path: string;
    uploadedAt: Date;
  }>;
  verificationNotes?: string;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  rejectionReason?: string;
  paymentStatus: PaymentStatus;
  feeDetails?: {
    handlingFee: number;
    storageFee: number;
    daysStored: number;
    totalAmount: number;
    paidAt?: Date;
    transactionId?: string;
  };
  // Fraud detection
  fraudRiskScore?: number;
  fraudFlags?: string[];
  // Challenge-response verification
  challengeHistory?: Array<{
    _id?: Types.ObjectId;
    question: string;
    answer?: string;
    matchScore?: number;
    passed?: boolean;
    conductedAt: Date;
    conductedBy: Types.ObjectId;
  }>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface ISessionModel extends Document {
  userId: Types.ObjectId;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface IStorageModel extends Document {
  name: string;
  location: string;
  shelfNumber?: string;
  binNumber?: string;
  capacity: {
    small: number;
    medium: number;
    large: number;
  };
  currentCount: {
    small: number;
    medium: number;
    large: number;
  };
  isActive: boolean;
  isPickupPoint: boolean;
  city?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPickupModel extends Document {
  claimId: Types.ObjectId;
  claimantId: Types.ObjectId;
  itemId: Types.ObjectId;
  pickupDate: Date;
  startTime: string;
  endTime: string;
  qrCode: string;
  referenceCode: string;
  isCompleted: boolean;
  completedAt?: Date;
  completedBy?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDispositionModel extends Document {
  itemId: Types.ObjectId;
  type: DispositionType;
  processedBy: Types.ObjectId;
  processedAt: Date;
  recipient?: string;
  notes?: string;
  auditTrail: Array<{
    action: string;
    timestamp: Date;
    userId: Types.ObjectId;
    details: string;
  }>;
}

export interface IMatchModel extends Document {
  itemId: Types.ObjectId;
  lostReportId: Types.ObjectId;
  confidenceScore: number;
  categoryScore: number;
  keywordScore: number;
  dateScore: number;
  locationScore: number;
  featureScore: number;
  colorScore: number;
  notified: boolean;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'AUTO_CONFIRMED';
  createdAt: Date;
  deletedAt?: Date;
}

export interface IActivityModel extends Document {
  action: ActivityAction;
  userId: Types.ObjectId;
  entityType: 'Item' | 'Claim' | 'LostReport' | 'Pickup' | 'Disposition' | 'Match' | 'User';
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}


export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    _id: string;
    email: string;
    role: UserRole;
    isEmailVerified: boolean;
  };
}

// Session Service Types
export interface TokenPayload {
  id: string;
  email: string;
  role: UserRole;
  isEmailVerified: boolean;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}


export interface LogActivityParams {
  action: ActivityAction;
  userId: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}
export interface CreateItemData {
  category: ItemCategory;
  description: string;
  photos: UploadedFile[];
  locationFound: string;
  dateFound: Date;
  registeredBy: string;
  isHighValue?: boolean;
  estimatedValue?: number;
  finderContact?: {
    email?: string;
    phone?: string;
  };
  identifyingFeatures?: string[];
  storageLocation?: string;
  // Structured markers
  brand?: string;
  color?: ItemColor;
  itemSize?: ItemSize;
  bagContents?: string[];
  secretIdentifiers?: string[];
}
