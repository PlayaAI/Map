# Playa AI Map

Burning Man-first transparency and discovery platform that overlays official placement/event data with pre-moderated AI disclosures.

## What is implemented

- Monorepo structure:
  - `apps/web`: Next.js map + directory UI (MapLibre)
  - `apps/api`: Fastify API (public data, auth, submissions, claims, moderation)
  - `apps/worker`: ingestion worker with dataset year fallback
  - `packages/db`: PostGIS migrations and migration runner
- Core workflow:
  - Official baseline data ingestion into PostgreSQL/PostGIS
  - Public map and detail endpoints
  - Email OTP auth for submitters/admins
  - Submission + claim intake
  - Pre-moderation queue and approve/reject actions
- Dataset fallback:
  - Attempts target year first (default `2026`), then falls back year-by-year (default down to `2024`)
  - Defaults include confirmed 2025 and 2024 public sources in `.env.example`

## Quick start

### 1) Start PostGIS

```bash
docker compose up -d db
```

### 2) Install dependencies

```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
corepack pnpm install
```

### 3) Configure environment

```bash
cp .env.example .env
```

Set at minimum:

- `DATABASE_URL`
- `AUTH_TOKEN_SECRET`
- `OTP_SALT`
- `ADMIN_EMAILS`

### 4) Run migrations

```bash
corepack pnpm db:migrate
```

### 5) Ingest official/fallback data

```bash
corepack pnpm --filter @playa/worker ingest
```

If external datasets are unreachable in your environment, you can ingest from local fixture files:

```bash
set -a; source .env; set +a
export DATASET_TARGET_YEAR=2025
export DATASET_MIN_FALLBACK_YEAR=2025
export DATASET_2025_CAMP_OUTLINES_URL=fixtures/2025-camp-outlines.geojson
export DATASET_2025_CAMP_NAMES_URL=fixtures/2025-camp-names.csv
export DATASET_2025_CAMP_ARCHIVE_URL=fixtures/2025-camp-archive.json
export DATASET_2025_ART_ARCHIVE_URL=fixtures/2025-art-archive.json
export DATASET_2025_EVENT_ARCHIVE_URL=fixtures/2025-event-archive.json
corepack pnpm --filter @playa/worker ingest
```

### 6) Run API + web

In separate terminals:

```bash
corepack pnpm dev:api
corepack pnpm dev:web
```

Open `http://localhost:3000`.

## API routes implemented

### Public

- `GET /api/health`
- `GET /api/events`
- `GET /api/map/features?eventYear=2025&filters=ai_art,workshop,tech_free&bbox=west,south,east,north&limit=2000`
- `GET /api/entities/:id`

### Auth (OTP)

- `POST /api/auth/request-otp`
- `POST /api/auth/verify-otp`

### Participation

- `POST /api/submissions` (auth required)
- `POST /api/claims` (auth required)

### Moderation (admin)

- `GET /api/moderation/queue`
- `POST /api/moderation/:id/approve`
- `POST /api/moderation/:id/reject`

## Data model highlights

- `events`
- `entities`
- `geometry_features` (PostGIS geometry + GeoJSON)
- `ai_disclosures`
- `users`
- `otp_codes`
- `submissions`
- `claims`
- `moderation_decisions`

Migrations are in `packages/db/migrations`.

## Notes

- Submissions/claims are **never public until approved**.
- AI metadata is community/owner supplied and admin moderated.
- `ALLOW_DEBUG_OTP=true` exposes OTP in API response for local development only.
- Map UI supports list parity, filtering, and detail views.

## Suggested next steps

- Add integration tests using test containers for PostGIS.
- Add outgoing email/SMS provider for OTP delivery.
- Add rate limiting and abuse controls to auth/submission routes.
- Add scheduled ingestion (cron/job runner) and observability dashboards.
