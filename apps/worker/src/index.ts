import { config, getYearSourceConfig } from "./lib/config.js";
import { createDbPool } from "./lib/db.js";
import { candidateYears, selectLatestAvailableDataset } from "./lib/dataset.js";
import { resourceExists } from "./lib/http.js";
import { ingestYear } from "./lib/ingest.js";

async function main(): Promise<void> {
  const pool = createDbPool(config.databaseUrl);

  try {
    const years = candidateYears(config.targetYear, config.minFallbackYear);
    const candidates = years.map((year) => getYearSourceConfig(year));

    const selected = await selectLatestAvailableDataset(candidates, resourceExists);
    if (!selected) {
      throw new Error(
        `No dataset available between ${config.targetYear} and ${config.minFallbackYear}`,
      );
    }

    const stats = await ingestYear(pool, selected);
    console.log(JSON.stringify({ ok: true, datasetYear: selected.year, stats }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
