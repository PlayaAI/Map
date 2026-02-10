"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl, { type GeoJSONSource, type Map } from "maplibre-gl";
import type { GeoJsonFeature } from "../lib/types";

type PointFeature = GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>;

interface MapCanvasProps {
  features: GeoJsonFeature[];
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string | null) => void;
}

function flattenCoordinates(coords: unknown): [number, number][] {
  if (!Array.isArray(coords)) {
    return [];
  }

  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    return [[coords[0], coords[1]] as [number, number]];
  }

  const flattened: [number, number][] = [];
  for (const item of coords) {
    flattened.push(...flattenCoordinates(item));
  }
  return flattened;
}

function toPointFeature(feature: GeoJsonFeature): PointFeature | null {
  const geometry = feature.geometry;
  if (geometry.type === "Point") {
    return feature as unknown as PointFeature;
  }

  if (!(geometry as { coordinates?: unknown }).coordinates) {
    return null;
  }

  const points = flattenCoordinates((geometry as { coordinates: unknown }).coordinates);
  if (points.length === 0) {
    return null;
  }

  const [sumLng, sumLat] = points.reduce(
    (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
    [0, 0],
  );

  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [sumLng / points.length, sumLat / points.length],
    },
    properties: feature.properties,
  };
}

export function MapCanvas({ features, selectedEntityId, onSelectEntity }: MapCanvasProps) {
  const mapRef = useRef<Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointDataRef = useRef<GeoJSON.FeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });
  const polygonDataRef = useRef<GeoJSON.FeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });

  const mapStyle = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://demotiles.maplibre.org/style.json";

  const polygonFeatureCollection = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: "FeatureCollection",
      features: features.filter((feature) => feature.geometry.type !== "Point") as GeoJSON.Feature[],
    };
  }, [features]);

  const pointFeatureCollection = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: "FeatureCollection",
      features: features.map(toPointFeature).filter((item): item is PointFeature => item !== null),
    };
  }, [features]);

  useEffect(() => {
    pointDataRef.current = pointFeatureCollection;
    polygonDataRef.current = polygonFeatureCollection;
  }, [pointFeatureCollection, polygonFeatureCollection]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: [-119.2065, 40.7864],
      zoom: 11.5,
      maxZoom: 18,
      minZoom: 8,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("polygons", {
        type: "geojson",
        data: polygonDataRef.current,
      });

      map.addSource("points", {
        type: "geojson",
        data: pointDataRef.current,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 48,
      });

      map.addLayer({
        id: "polygon-fill",
        type: "fill",
        source: "polygons",
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["get", "techFreeZone"], false],
            "#7b8f1f",
            ["boolean", ["get", "usesAi"], false],
            "#ff7549",
            "#d5d2c6",
          ],
          "fill-opacity": 0.35,
        },
      });

      map.addLayer({
        id: "polygon-line",
        type: "line",
        source: "polygons",
        paint: {
          "line-color": "#4b3f2f",
          "line-width": 1.2,
        },
      });

      map.addLayer({
        id: "cluster-circles",
        type: "circle",
        source: "points",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1d4f6f",
          "circle-radius": ["step", ["get", "point_count"], 18, 20, 24, 100, 30],
          "circle-opacity": 0.85,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fdfaf3",
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "points",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count"],
          "text-size": 12,
          "text-font": ["Open Sans Bold"],
        },
        paint: {
          "text-color": "#fdfaf3",
        },
      });

      map.addLayer({
        id: "unclustered-points",
        type: "circle",
        source: "points",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "case",
            ["boolean", ["get", "techFreeZone"], false],
            "#7b8f1f",
            ["boolean", ["get", "usesAi"], false],
            "#ff7549",
            "#2a9d8f",
          ],
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff8e7",
        },
      });

      map.on("click", "cluster-circles", (event) => {
        const featuresAtPoint = map.queryRenderedFeatures(event.point, { layers: ["cluster-circles"] });
        const clusterFeature = featuresAtPoint[0];
        if (!clusterFeature) {
          return;
        }

        const clusterId = clusterFeature.properties?.cluster_id;
        const source = map.getSource("points") as GeoJSONSource | undefined;
        if (!source || typeof clusterId !== "number") {
          return;
        }

        source.getClusterExpansionZoom(clusterId, (error, zoom) => {
          if (error || zoom === undefined) {
            return;
          }

          const coordinates = (clusterFeature.geometry as GeoJSON.Point).coordinates;
          map.easeTo({ center: [coordinates[0], coordinates[1]], zoom });
        });
      });

      map.on("click", "unclustered-points", (event) => {
        const hit = event.features?.[0];
        const id = hit?.properties?.id as string | undefined;
        onSelectEntity(id ?? null);
      });

      map.on("click", "polygon-fill", (event) => {
        const hit = event.features?.[0];
        const id = hit?.properties?.id as string | undefined;
        onSelectEntity(id ?? null);
      });

      map.on("mouseenter", "cluster-circles", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "cluster-circles", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", "unclustered-points", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "unclustered-points", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", "polygon-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "polygon-fill", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapStyle, onSelectEntity]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const polygonSource = map.getSource("polygons") as GeoJSONSource | undefined;
    if (polygonSource) {
      polygonSource.setData(polygonFeatureCollection);
    }

    const pointsSource = map.getSource("points") as GeoJSONSource | undefined;
    if (pointsSource) {
      pointsSource.setData(pointFeatureCollection);
    }
  }, [pointFeatureCollection, polygonFeatureCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !selectedEntityId) {
      return;
    }

    const selectedFeature = pointFeatureCollection.features.find(
      (feature) => feature.properties?.id === selectedEntityId,
    );

    if (selectedFeature?.geometry.type === "Point") {
      map.easeTo({
        center: [selectedFeature.geometry.coordinates[0], selectedFeature.geometry.coordinates[1]],
        zoom: Math.max(map.getZoom(), 14),
        duration: 700,
      });
    }
  }, [selectedEntityId, pointFeatureCollection]);

  return <div ref={containerRef} className="map-canvas" />;
}
