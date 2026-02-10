import type { YearSourceConfig } from "./config.js";

export type AvailabilityProbe = (url: string) => Promise<boolean>;

export function candidateYears(targetYear: number, minFallbackYear: number): number[] {
  const years: number[] = [];
  for (let year = targetYear; year >= minFallbackYear; year -= 1) {
    years.push(year);
  }
  return years;
}

export async function selectLatestAvailableDataset(
  candidates: YearSourceConfig[],
  exists: AvailabilityProbe,
): Promise<YearSourceConfig | null> {
  for (const candidate of candidates) {
    const requiredUrls = [candidate.campOutlinesUrl, candidate.campArchiveUrl].filter(
      (item): item is string => Boolean(item),
    );
    if (requiredUrls.length === 0) {
      continue;
    }

    for (const url of requiredUrls) {
      const ok = await exists(url);
      if (ok) {
        return candidate;
      }
    }
  }
  return null;
}
