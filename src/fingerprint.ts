import { createHash } from "node:crypto";
import type { ReviewInput } from "./types.js";

function normalized(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

export function fingerprintReview(review: ReviewInput): string {
  const identity = [normalized(review.businessName), normalized(review.reviewerName),
    review.stars === null ? "null" : String(review.stars), normalized(review.reviewText)];
  return createHash("sha256").update(JSON.stringify(identity), "utf8").digest("hex");
}
