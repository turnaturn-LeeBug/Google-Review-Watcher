export interface ReviewInput {
  businessId?: string;
  businessName: string;
  source?: "google";
  reviewerName: string;
  stars: number | null;
  relativeTime: string | null;
  googleDisplayedTime?: string | null;
  googleReviewId?: string | null;
  reviewerProfileUrl?: string | null;
  reviewText: string;
  capturedAt?: string;
}

export interface ReviewRecord extends ReviewInput {
  source: "google";
  capturedAt: string;
  fingerprint: string;
  reviewIdentity: string;
  googleDisplayedTime: string | null;
  derivedReviewDate: string | null;
  dateConfidence: DateConfidence;
}

export interface SeenState { version: 1; fingerprints: string[]; updatedAt: string | null }
export interface ProcessResult { inputCount: number; newCount: number; reportPath: string | null; records: ReviewRecord[] }

export type DateConfidence = "exact" | "derived-day" | "derived-week" | "unknown";

export interface EmailConfig {
  enabled: boolean;
  provider?: "smtp";
  recipients?: string[];
  sendWhenNoNewReviews?: boolean;
}

export interface BusinessConfig {
  id: string;
  businessName: string;
  googleUrl: string;
  startDate?: string;
  minimumIntervalDays: number;
  enabled: boolean;
  email?: EmailConfig;
}

export interface ReviewWatcherConfig {
  businesses: BusinessConfig[];
  email: EmailConfig;
}

export interface BusinessState {
  version: 2;
  businessId: string;
  fingerprints: string[];
  identities: string[];
  lastSuccessfulRun: string | null;
  updatedAt: string | null;
}

export type EligibilityStatus = "ELIGIBLE" | "SKIPPED_NOT_ELIGIBLE" | "DISABLED";
export interface EligibilityResult {
  businessId: string;
  status: EligibilityStatus;
  lastSuccessfulRun: string | null;
  nextEligibleAt: string | null;
  minimumIntervalDays: number;
}

export type BusinessRunStatus = "SUCCESS" | "SKIPPED_NOT_ELIGIBLE" | "DISABLED" | "FAILED";
export interface BusinessRunResult {
  businessId: string;
  status: BusinessRunStatus;
  newCount: number;
  reportPath: string | null;
  lastSuccessfulRun: string | null;
  error?: string;
}
