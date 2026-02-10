export type MapFilter = "ai_art" | "workshop" | "tech_free";

const FILTERS = new Set<MapFilter>(["ai_art", "workshop", "tech_free"]);

export function parseMapFilters(input: string | undefined): MapFilter[] {
  if (!input) {
    return [];
  }

  const values = input
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is MapFilter => FILTERS.has(item as MapFilter));

  return Array.from(new Set(values));
}

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function parseBoundingBox(input: string | undefined): BoundingBox | null {
  if (!input) {
    return null;
  }

  const [west, south, east, north] = input.split(",").map((part) => Number(part));
  if (
    [west, south, east, north].some((value) => Number.isNaN(value)) ||
    west < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90 ||
    west >= east ||
    south >= north
  ) {
    return null;
  }

  return { west, south, east, north };
}
