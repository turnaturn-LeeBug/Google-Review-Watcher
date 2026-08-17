export interface ReviewInput {
  businessName: string;
  source?: "google";
  reviewerName: string;
  stars: number | null;
  relativeTime: string | null;
  reviewText: string;
  capturedAt?: string;
}

export interface ReviewRecord extends ReviewInput {
  source: "google";
  capturedAt: string;
  fingerprint: string;
}

export interface SeenState { version: 1; fingerprints: string[]; updatedAt: string | null }
export interface ProcessResult { inputCount: number; newCount: number; reportPath: string | null; records: ReviewRecord[] }
