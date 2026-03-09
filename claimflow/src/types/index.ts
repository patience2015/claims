// Shared TypeScript types for ClaimFlow AI

export type UserRole = "HANDLER" | "MANAGER" | "ADMIN" | "POLICYHOLDER";

export type ClaimStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "INFO_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "CLOSED";

export type ClaimType =
  | "COLLISION"
  | "THEFT"
  | "VANDALISM"
  | "GLASS"
  | "FIRE"
  | "NATURAL_DISASTER"
  | "BODILY_INJURY"
  | "OTHER";

export type CoverageType = "THIRD_PARTY" | "COMPREHENSIVE" | "ALL_RISKS";

export type AIAnalysisType =
  | "EXTRACTION"
  | "FRAUD_SCORING"
  | "ESTIMATION"
  | "LETTER_GENERATION";

export type AuditAction =
  | "CLAIM_CREATED"
  | "CLAIM_UPDATED"
  | "STATUS_CHANGED"
  | "AI_ANALYSIS_RUN"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_DELETED"
  | "COMMENT_ADDED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "CLAIM_ASSIGNED"
  | "CLAIM_DELETED"
  | "CLAIM_ACCEPTED"
  | "CLAIM_REJECTED_BY_POLICYHOLDER"
  | "DOCUMENT_UPLOADED_BY_POLICYHOLDER"
  | "NOTIFICATION_READ"
  | "NOTIFICATION_PREFERENCES_UPDATED"
  | "FRAUD_ALERT_SENT"
  | "SLA_BREACH_DETECTED"
  | "NETWORK_CREATED"
  | "NETWORK_DISMISSED"
  | "NETWORK_ESCALATED"
  | "NETWORK_RECOMPUTED"
  | "NETWORK_ARCHIVED";

// Notification types
export type NotificationType =
  | "CLAIM_ASSIGNED"
  | "STATUS_CHANGED"
  | "FRAUD_ALERT"
  | "SLA_BREACH"
  | "DOCUMENT_UPLOADED_BY_POLICYHOLDER"
  | "NETWORK_FRAUD_ALERT"
  | "NETWORK_ESCALATED";

export type NotificationStatus = "UNREAD" | "READ";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  status: NotificationStatus;
  priority: NotificationPriority;
  title: string;
  message: string;
  metadata: string | null;
  readAt: string | null;
  archivedAt: string | null;
  userId: string;
  claimId: string | null;
  claim: { id: string; claimNumber: string; status: string } | null;
  emailSent: boolean;
  emailSentAt: string | null;
  emailError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferenceItem {
  id: string;
  userId: string;
  type: NotificationType;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FraudRisk = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type LetterType =
  | "ACKNOWLEDGMENT"
  | "DOCUMENT_REQUEST"
  | "APPROVAL"
  | "REJECTION"
  | "INFO_REQUEST";

// API Response types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Claim types
export interface ClaimWithRelations {
  id: string;
  claimNumber: string;
  status: ClaimStatus;
  type: ClaimType;
  description: string;
  incidentDate: string;
  incidentLocation: string;
  thirdPartyInvolved: boolean;
  thirdPartyInfo?: string | null;
  estimatedAmount?: number | null;
  approvedAmount?: number | null;
  fraudScore?: number | null;
  fraudRisk?: FraudRisk | null;
  policyholderID: string;
  policyholder: PolicyholderSummary;
  assignedToID?: string | null;
  assignedTo?: UserSummary | null;
  createdByID: string;
  createdBy: UserSummary;
  createdAt: string;
  updatedAt: string;
  documents?: DocumentSummary[];
  analyses?: AIAnalysisSummary[];
  comments?: CommentWithAuthor[];
}

export interface PolicyholderSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehiclePlate: string;
  policyNumber: string;
  coverageType: CoverageType;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface DocumentSummary {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

export interface AIAnalysisSummary {
  id: string;
  type: AIAnalysisType;
  outputData: string;
  tokensUsed: number;
  durationMs: number;
  model: string;
  createdAt: string;
}

export interface CommentWithAuthor {
  id: string;
  content: string;
  isInternal: boolean;
  author: UserSummary;
  createdAt: string;
}

// AI Analysis result types
export interface ExtractionResult {
  date?: string;
  time?: string;
  location?: string;
  vehicles: VehicleInfo[];
  injuries: string[];
  thirdParties: ThirdPartyInfo[];
  policeReport?: boolean;
  weather?: string;
  missingFields: string[];
}

export interface VehicleInfo {
  role: "insured" | "third_party";
  make?: string;
  model?: string;
  plate?: string;
  damages: string[];
}

export interface ThirdPartyInfo {
  name?: string;
  plate?: string;
  insurance?: string;
  contact?: string;
}

export interface FraudAnalysisResult {
  score: number;
  risk: FraudRisk;
  factors: FraudFactor[];
  summary: string;
  recommendation: string;
}

export interface FraudFactor {
  name: string;
  description: string;
  weight: number;
  detected: boolean;
}

export interface EstimationResult {
  estimatedTotal: number;
  min: number;
  max: number;
  breakdown: {
    parts: number;
    labor: number;
    other: number;
  };
  franchise: number;
  netEstimate: number;
  confidence: "low" | "medium" | "high";
}

export interface LetterResult {
  subject: string;
  body: string;
  closing: string;
  type: LetterType;
}

// Dashboard types
export interface TeamMemberStats {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  stats: {
    total: number;
    pending: number;
    slaBreached: number;
    avgProcessingDays: number;
    approvalRate: number;
  };
}

export interface SlaOverdueClaim {
  id: string;
  claimNumber: string;
  assignedTo: UserSummary | null;
  updatedAt: string;
  daysSinceUpdate: number;
  policyholder: Pick<PolicyholderSummary, "id" | "firstName" | "lastName" | "email">;
}

export interface SlaReport {
  overdue: SlaOverdueClaim[];
  atRisk: SlaOverdueClaim[];
  healthyCount: number;
}

export interface DashboardStats {
  totalClaims: number;
  claimsByStatus: Record<ClaimStatus, number>;
  totalEstimatedAmount: number;
  averageProcessingDays: number;
  fraudRate: number;
  pendingClaims: number;
}

export interface ChartDataPoint {
  date: string;
  count: number;
  amount: number;
}

export interface ClaimTypeDistribution {
  type: ClaimType;
  count: number;
  percentage: number;
}

// Status transition validation
export const VALID_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["INFO_REQUESTED", "APPROVED", "REJECTED"],
  INFO_REQUESTED: ["UNDER_REVIEW"],
  APPROVED: ["CLOSED"],
  REJECTED: ["CLOSED"],
  CLOSED: [],
};

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  SUBMITTED: "Soumis",
  UNDER_REVIEW: "En instruction",
  INFO_REQUESTED: "Infos demandées",
  APPROVED: "Approuvé",
  REJECTED: "Refusé",
  CLOSED: "Clôturé",
};

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  COLLISION: "Collision",
  THEFT: "Vol",
  VANDALISM: "Vandalisme",
  GLASS: "Bris de glace",
  FIRE: "Incendie",
  NATURAL_DISASTER: "Catastrophe naturelle",
  BODILY_INJURY: "Dommages corporels",
  OTHER: "Autre",
};

export const FRAUD_RISK_LABELS: Record<FraudRisk, string> = {
  LOW: "Faible",
  MODERATE: "Modéré",
  HIGH: "Élevé",
  CRITICAL: "Critique",
};

// ─── Fraude Réseau ────────────────────────────────────────────────────────────

export type FraudNetworkStatus =
  | "ACTIVE"
  | "SUSPECT"
  | "CRITICAL"
  | "DISMISSED"
  | "UNDER_INVESTIGATION"
  | "INACTIVE";

export type FraudNodeType = "POLICYHOLDER" | "GARAGE" | "EXPERT" | "LOCATION";

export interface FraudNodeItem {
  type: FraudNodeType;
  key: string;
  label: string;
  claimIds: string[];
  claimCount: number;
}

export interface FraudLinkItem {
  id: string;
  sourceType: FraudNodeType;
  sourceKey: string;
  sourceLabel: string;
  targetType: FraudNodeType;
  targetKey: string;
  targetLabel: string;
  weight: number;
  occurrences: number;
  claimIds: string[];
}

export interface FraudNetworkItem {
  id: string;
  networkNumber: string;
  status: FraudNetworkStatus;
  networkScore: number;
  nodeCount: number;
  claimCount: number;
  avgFraudScore: number;
  density: number;
  createdAt: string;
  updatedAt: string;
}

export interface FraudNetworkDetail extends FraudNetworkItem {
  nodes: FraudNodeItem[];
  links: FraudLinkItem[];
  notes: string | null;
  claims: {
    id: string;
    claimNumber: string;
    status: string;
    fraudScore: number | null;
    networkScore: number | null;
  }[];
  auditTrail?: {
    id: string;
    action: string;
    userId: string;
    userName: string;
    createdAt: string;
    metadata?: string | null;
  }[];
}
