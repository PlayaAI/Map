export type SourceType = "camp" | "art" | "event" | "zone";

export type ModerationStatus = "pending" | "approved" | "rejected";

export type ModerationTargetType = "submission" | "claim";

export interface AIDisclosureInput {
  usesAi: boolean;
  aiCategories: string[];
  tools: string[];
  humanLeadDescription: string;
  techFreeZone: boolean;
  disclosureText: string;
}
