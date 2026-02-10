export interface EventSummary {
  id: string;
  slug: string;
  year: number;
  name: string;
  status: string;
}

export interface AIDisclosure {
  usesAi: boolean;
  aiCategories: string[];
  tools: string[];
  humanLeadDescription: string | null;
  techFreeZone: boolean;
  disclosureText: string | null;
}

export interface EntityFeatureProperties {
  id: string;
  name: string;
  sourceType: string;
  locationText: string | null;
  description: string | null;
  usesAi: boolean;
  aiCategories: string[];
  tools: string[];
  techFreeZone: boolean;
  humanLeadDescription: string | null;
  disclosureText: string | null;
  aiDisclosure: AIDisclosure;
}

export interface GeoJsonFeature {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: EntityFeatureProperties;
}

export interface FeatureCollectionResponse {
  type: "FeatureCollection";
  event: {
    id: string;
    year: number;
    name: string;
  };
  features: GeoJsonFeature[];
}

export interface EntityDetail {
  id: string;
  name: string;
  description: string | null;
  locationText: string | null;
  sourceType: string;
  sourceId: string;
  sourcePayload: unknown;
  event: {
    year: number;
    name: string;
  };
  geometry: GeoJSON.Geometry | null;
  aiDisclosure: AIDisclosure | null;
}
