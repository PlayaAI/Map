"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchEvents, fetchMapFeatures } from "../lib/api";
import type { EventSummary, GeoJsonFeature } from "../lib/types";
import { MapCanvas } from "./MapCanvas";

const FILTERS: Array<{ id: "ai_art" | "workshop" | "tech_free"; label: string }> = [
  { id: "ai_art", label: "AI Art" },
  { id: "workshop", label: "Workshops" },
  { id: "tech_free", label: "Tech-Free Zones" },
];

export function MapExplorer() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [features, setFeatures] = useState<GeoJsonFeature[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      try {
        const loadedEvents = await fetchEvents();
        if (cancelled) {
          return;
        }
        setEvents(loadedEvents);
        if (loadedEvents.length > 0) {
          setSelectedYear((current) => current ?? loadedEvents[0].year);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load events");
        }
      }
    }

    void loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedYear) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadFeatures() {
      try {
        const collection = await fetchMapFeatures({
          eventYear: selectedYear,
          filters: activeFilters,
        });

        if (cancelled) {
          return;
        }

        setFeatures(collection.features);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load map data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFeatures();
    return () => {
      cancelled = true;
    };
  }, [selectedYear, activeFilters]);

  const selectedFeature = useMemo(
    () => features.find((feature) => feature.properties.id === selectedEntityId) ?? null,
    [features, selectedEntityId],
  );

  const onToggleFilter = useCallback((filterId: string) => {
    setActiveFilters((current) =>
      current.includes(filterId)
        ? current.filter((item) => item !== filterId)
        : [...current, filterId],
    );
  }, []);

  return (
    <main className="page-shell">
      <section className="hero panel">
        <p className="eyebrow">Transparency + Discovery</p>
        <h1>Playa AI Map</h1>
        <p>
          Geo-located directory for AI activity on the Playa with pre-moderated disclosures,
          official baseline data, and participant contributions.
        </p>
      </section>

      <section className="controls panel stack-sm">
        <div className="inline-wrap">
          <label className="field-inline">
            <span>Data Year</span>
            <select
              value={selectedYear ?? ""}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
            >
              {events.map((event) => (
                <option key={event.id} value={event.year}>
                  {event.year} ({event.status})
                </option>
              ))}
            </select>
          </label>
          <span className="badge">Official baseline + moderated AI metadata</span>
          <div className="inline-actions">
            <Link href="/submit" className="btn-primary">
              Submit Disclosure
            </Link>
            <Link href="/claim" className="btn-secondary">
              Claim Listing
            </Link>
            <Link href="/admin/moderation" className="btn-secondary">
              Admin Queue
            </Link>
          </div>
        </div>

        <div className="inline-wrap">
          {FILTERS.map((filter) => {
            const active = activeFilters.includes(filter.id);
            return (
              <button
                key={filter.id}
                type="button"
                className={active ? "chip chip-active" : "chip"}
                onClick={() => onToggleFilter(filter.id)}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </section>

      {error ? <p className="error panel">{error}</p> : null}

      <section className="map-grid">
        <article className="panel map-panel">
          <header className="panel-head">
            <h2>Map View</h2>
            <span>{loading ? "Loading..." : `${features.length} matches`}</span>
          </header>
          <MapCanvas
            features={features}
            selectedEntityId={selectedEntityId}
            onSelectEntity={setSelectedEntityId}
          />
        </article>

        <article className="panel list-panel">
          <header className="panel-head">
            <h2>Directory</h2>
            {selectedFeature ? <span>Selected: {selectedFeature.properties.name}</span> : null}
          </header>

          <ul className="entity-list">
            {features.map((feature) => {
              const disclosure = feature.properties.aiDisclosure;
              const isSelected = feature.properties.id === selectedEntityId;
              return (
                <li
                  key={feature.properties.id}
                  className={isSelected ? "entity-card entity-card-selected" : "entity-card"}
                  onMouseEnter={() => setSelectedEntityId(feature.properties.id)}
                >
                  <div>
                    <h3>{feature.properties.name}</h3>
                    <p className="meta">
                      {feature.properties.sourceType} {feature.properties.locationText ? `• ${feature.properties.locationText}` : ""}
                    </p>
                  </div>
                  <div className="tags">
                    {disclosure.usesAi ? <span className="tag tag-ai">AI</span> : null}
                    {disclosure.aiCategories.includes("workshop") ? (
                      <span className="tag tag-workshop">Workshop</span>
                    ) : null}
                    {disclosure.techFreeZone ? <span className="tag tag-techfree">Tech-Free</span> : null}
                  </div>
                  <p>{feature.properties.description ?? "No description available."}</p>
                  <Link href={`/entities/${feature.properties.id}`} className="link-inline">
                    Open details
                  </Link>
                </li>
              );
            })}
          </ul>
        </article>
      </section>
    </main>
  );
}
