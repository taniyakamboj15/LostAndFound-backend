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
  OTHER = 'OTHER',
}

export enum ClaimStatus {
  FILED = 'FILED',
  IDENTITY_PROOF_REQUESTED = 'IDENTITY_PROOF_REQUESTED',
  VERIFIED = 'VERIFIED',
  PICKUP_BOOKED = 'PICKUP_BOOKED',
  RETURNED = 'RETURNED',
  REJECTED = 'REJECTED',
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
  PROOF_UPLOADED = 'PROOF_UPLOADED',
  CLAIM_VERIFIED = 'CLAIM_VERIFIED',
  CLAIM_REJECTED = 'CLAIM_REJECTED',
  PICKUP_BOOKED = 'PICKUP_BOOKED',
  PICKUP_COMPLETED = 'PICKUP_COMPLETED',
  DISPOSITION_PROCESSED = 'DISPOSITION_PROCESSED',
  USER_REGISTERED = 'USER_REGISTERED',
  USER_VERIFIED = 'USER_VERIFIED',
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

export interface MatchScore {
  categoryScore: number;
  keywordScore: number;
  dateScore: number;
  locationScore: number;
  featureScore: number;
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
  categoryBreakdown: Record<ItemCategory, number>;
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
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
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
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface IClaimModel extends Document {
  itemId: Types.ObjectId;
  claimantId: Types.ObjectId;
  lostReportId?: Types.ObjectId;
  description: string;
  status: ClaimStatus;
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
  createdAt: Date;
  updatedAt: Date;
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
  capacity: number;
  currentCount: number;
  isActive: boolean;
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
  notified: boolean;
  createdAt: Date;
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
}
