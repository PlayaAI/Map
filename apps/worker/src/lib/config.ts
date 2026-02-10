function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function readInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
}

export interface YearSourceConfig {
  year: number;
  campOutlinesUrl?: string;
  campNamesCsvUrl?: string;
  campArchiveUrl?: string;
  artArchiveUrl?: string;
  eventArchiveUrl?: string;
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getYearSourceConfig(year: number): YearSourceConfig {
  if (year === 2025) {
    return {
      year,
      campOutlinesUrl:
        env("DATASET_2025_CAMP_OUTLINES_URL") ??
        "https://bm-innovate.s3.amazonaws.com/2025/camp_outlines_2025.geojson",
      campNamesCsvUrl:
        env("DATASET_2025_CAMP_NAMES_URL") ??
        "https://bm-innovate.s3.amazonaws.com/2025/camp_names_2025.geojson",
      campArchiveUrl: env("DATASET_2025_CAMP_ARCHIVE_URL"),
      artArchiveUrl: env("DATASET_2025_ART_ARCHIVE_URL"),
      eventArchiveUrl: env("DATASET_2025_EVENT_ARCHIVE_URL"),
    };
  }

  if (year === 2024) {
    return {
      year,
      campArchiveUrl:
        env("DATASET_2024_CAMP_ARCHIVE_URL") ??
        "https://bm-innovate.s3.amazonaws.com/2024/JSON/archive_camp_listings_2024-09-11.json",
      artArchiveUrl:
        env("DATASET_2024_ART_ARCHIVE_URL") ??
        "https://bm-innovate.s3.amazonaws.com/2024/JSON/archive_art_2024-09-11.json",
      eventArchiveUrl:
        env("DATASET_2024_EVENT_ARCHIVE_URL") ??
        "https://bm-innovate.s3.amazonaws.com/2024/JSON/archive_events_2024-09-11.json",
      campOutlinesUrl: env("DATASET_2024_CAMP_OUTLINES_URL"),
      campNamesCsvUrl: env("DATASET_2024_CAMP_NAMES_URL"),
    };
  }

  const base = `DATASET_${year}`;
  return {
    year,
    campOutlinesUrl: env(`${base}_CAMP_OUTLINES_URL`),
    campNamesCsvUrl: env(`${base}_CAMP_NAMES_URL`),
    campArchiveUrl: env(`${base}_CAMP_ARCHIVE_URL`),
    artArchiveUrl: env(`${base}_ART_ARCHIVE_URL`),
    eventArchiveUrl: env(`${base}_EVENT_ARCHIVE_URL`),
  };
}

export const config = {
  databaseUrl: requireEnv("DATABASE_URL"),
  targetYear: readInt("DATASET_TARGET_YEAR", 2026),
  minFallbackYear: readInt("DATASET_MIN_FALLBACK_YEAR", 2024),
  burningManApiKey: env("BURNING_MAN_API_KEY"),
  burningManApiBaseUrl: env("BURNING_MAN_API_BASE_URL") ?? "https://api.burningman.org",
};
