export interface AIDisclosurePayload {
  usesAi: boolean;
  aiCategories: string[];
  tools: string[];
  humanLeadDescription: string;
  techFreeZone: boolean;
  disclosureText: string;
}
