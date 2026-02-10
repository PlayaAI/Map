import type { EntityDetail, EventSummary, FeatureCollectionResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function fetchEvents(): Promise<EventSummary[]> {
  const response = await fetch(`${API_BASE}/api/events`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load events: ${response.status}`);
  }

  const data = (await response.json()) as { events: EventSummary[] };
  return data.events;
}

export async function fetchMapFeatures(params: {
  eventYear?: number;
  filters?: string[];
  bbox?: string;
}): Promise<FeatureCollectionResponse> {
  const query = new URLSearchParams();
  if (params.eventYear) {
    query.set("eventYear", String(params.eventYear));
  }
  if (params.filters && params.filters.length > 0) {
    query.set("filters", params.filters.join(","));
  }
  if (params.bbox) {
    query.set("bbox", params.bbox);
  }

  const response = await fetch(`${API_BASE}/api/map/features?${query.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load features: ${response.status}`);
  }

  return (await response.json()) as FeatureCollectionResponse;
}

export async function fetchEntity(entityId: string): Promise<EntityDetail> {
  const response = await fetch(`${API_BASE}/api/entities/${entityId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load entity: ${response.status}`);
  }

  const data = (await response.json()) as { entity: EntityDetail };
  return data.entity;
}

export function apiBase(): string {
  return API_BASE;
}
