import { describe, expect, it } from "vitest";
import { candidateYears, selectLatestAvailableDataset } from "../src/lib/dataset.js";

describe("candidateYears", () => {
  it("creates descending year list", () => {
    expect(candidateYears(2026, 2024)).toEqual([2026, 2025, 2024]);
  });
});

describe("selectLatestAvailableDataset", () => {
  it("selects first available candidate", async () => {
    const candidates = [
      { year: 2026, campOutlinesUrl: "https://example.com/2026.geojson" },
      { year: 2025, campOutlinesUrl: "https://example.com/2025.geojson" },
    ];

    const selected = await selectLatestAvailableDataset(candidates, async (url) =>
      url.includes("2025"),
    );

    expect(selected?.year).toBe(2025);
  });

  it("returns null when nothing is reachable", async () => {
    const candidates = [{ year: 2026, campOutlinesUrl: "https://example.com/2026.geojson" }];
    const selected = await selectLatestAvailableDataset(candidates, async () => false);
    expect(selected).toBeNull();
  });
});
