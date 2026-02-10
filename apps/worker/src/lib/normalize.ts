interface UnknownRecord {
  [key: string]: unknown;
}

function pickString(record: UnknownRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return undefined;
}

function pickNumber(record: UnknownRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

export interface NormalizedArchiveEntity {
  sourceId: string;
  name: string;
  description: string;
  locationText: string;
  geometry?: { type: "Point"; coordinates: [number, number] };
  payload: UnknownRecord;
}

export function normalizeArchiveEntity(
  row: UnknownRecord,
  index: number,
): NormalizedArchiveEntity | null {
  const sourceId =
    pickString(row, ["uid", "id", "camp_id", "art_id", "event_id", "playa_id"]) ??
    `row-${index}`;
  const name = pickString(row, ["name", "camp_name", "title", "print_description"]) ?? `Unknown ${index}`;
  const description = pickString(row, ["description", "hometown", "url"]) ?? "";
  const locationText = pickString(row, ["location_string", "located_at", "location", "address"]) ?? "";

  const lat = pickNumber(row, ["latitude", "lat", "location_lat", "gps_lat"]);
  const lng = pickNumber(row, ["longitude", "lng", "lon", "location_lng", "gps_lng"]);

  let geometry: { type: "Point"; coordinates: [number, number] } | undefined;
  if (typeof lat === "number" && typeof lng === "number") {
    geometry = {
      type: "Point",
      coordinates: [lng, lat],
    };
  }

  return {
    sourceId,
    name,
    description,
    locationText,
    geometry,
    payload: row,
  };
}

export interface NormalizedCampOutline {
  sourceId: string;
  name: string;
  description: string;
  locationText: string;
  geometry: unknown;
  payload: UnknownRecord;
}

export function normalizeCampOutlineFeature(
  feature: UnknownRecord,
  campNameById: Map<string, Record<string, string>>,
  index: number,
): NormalizedCampOutline | null {
  const properties = (feature.properties ?? {}) as UnknownRecord;
  const geometry = feature.geometry;
  if (!geometry || typeof geometry !== "object") {
    return null;
  }

  const sourceId =
    pickString(properties, ["uid", "UID", "camp_uid", "camp_id", "id", "fid", "FID", "objectid", "OBJECTID"]) ??
    `camp-outline-${index}`;
  const nameRow = campNameById.get(sourceId);

  const name =
    nameRow?.name ??
    nameRow?.Name ??
    nameRow?.camp_name ??
    nameRow?.campName ??
    pickString(properties, ["name", "Name", "camp_name"]) ??
    `Unnamed Camp ${index}`;

  const description =
    nameRow?.description ??
    nameRow?.Description ??
    nameRow?.about ??
    nameRow?.details ??
    pickString(properties, ["description", "Description"]) ??
    "";

  const locationText =
    nameRow?.location ??
    nameRow?.Location ??
    nameRow?.location_string ??
    nameRow?.located_at ??
    nameRow?.address ??
    pickString(properties, ["location", "Location", "address"]) ??
    "";

  return {
    sourceId,
    name,
    description,
    locationText,
    geometry,
    payload: {
      ...properties,
      nameRow,
    },
  };
}

export function getCampNameMap(rows: Array<Record<string, string>>): Map<string, Record<string, string>> {
  const map = new Map<string, Record<string, string>>();

  for (const row of rows) {
    const keyCandidates = [
      row.uid,
      row.UID,
      row.camp_uid,
      row.camp_id,
      row.id,
      row.campid,
      row.campId,
      row.playa_id,
      row.playaId,
      row.fid,
      row.FID,
      row.objectid,
      row.OBJECTID,
    ];
    const key = keyCandidates.find((candidate) => typeof candidate === "string" && candidate.trim());
    if (key) {
      map.set(key.trim(), row);
    }
  }

  return map;
}

export function extractArrayPayload(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input;
  }
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    for (const key of ["data", "result", "results", "items"]) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[];
      }
    }
  }
  return [];
}
