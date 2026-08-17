import type { BusinessConfig, EmailConfig, ReviewRecord } from "./types.js";

export interface EmailDeliveryContext {
  business: BusinessConfig;
  config: EmailConfig;
  reportPath: string | null;
  records: ReviewRecord[];
}

export interface EmailDelivery {
  deliver(context: EmailDeliveryContext): Promise<void>;
}

export class DisabledEmailDelivery implements EmailDelivery {
  async deliver(context: EmailDeliveryContext): Promise<void> {
    if (context.config.enabled) throw new Error("Email is enabled but no delivery provider is configured.");
  }
}
