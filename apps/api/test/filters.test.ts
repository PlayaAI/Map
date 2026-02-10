import { describe, expect, it } from "vitest";
import { parseBoundingBox, parseMapFilters } from "../src/lib/filters.js";

describe("parseMapFilters", () => {
  it("keeps only supported unique filters", () => {
    expect(parseMapFilters("ai_art,workshop,ai_art,unknown,tech_free")).toEqual([
      "ai_art",
      "workshop",
      "tech_free",
    ]);
  });

  it("returns empty for missing input", () => {
    expect(parseMapFilters(undefined)).toEqual([]);
  });
});

describe("parseBoundingBox", () => {
  it("parses valid box", () => {
    expect(parseBoundingBox("-120,30,-119,31")).toEqual({
      west: -120,
      south: 30,
      east: -119,
      north: 31,
    });
  });

  it("returns null for invalid bounds", () => {
    expect(parseBoundingBox("1,1,1,2")).toBeNull();
    expect(parseBoundingBox("bad,input")).toBeNull();
  });
});
