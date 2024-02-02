import fs from "fs";
import path from "path";
import sharp from "sharp";
import MBTiles from "@mapbox/mbtiles";

import {
  calculateTileRangeForBounds,
  validateMinMaxValues,
} from "./tile_calculations.js";
import { renderTile } from "./render_map.js";

// Generate a MapGL style JSON object from a remote source
// and an additional source.
export const generateStyle = (style, overlay, tileSize, tempDir) => {
  let styleObject;
  if (style === "protomaps") {
    styleObject = {
      version: 8,
      sources: {
        protomaps: {
          type: "vector",
          attribution:
            '<a href="https://github.com/protomaps/basemaps">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
          url: `${tempDir}/sources/tiles.json`,
        },
      },
      layers: [
        {
          id: "background",
          type: "background",
          paint: {
            "background-color": "#cccccc",
          },
        },
        {
          id: "earth",
          type: "fill",
          source: "protomaps",
          "source-layer": "earth",
          paint: {
            "fill-color": "#e0e0e0",
          },
        },
        {
          id: "landuse_park",
          type: "fill",
          source: "protomaps",
          "source-layer": "landuse",
          filter: [
            "any",
            [
              "in",
              "pmap:kind",
              "national_park",
              "park",
              "cemetery",
              "protected_area",
              "nature_reserve",
              "forest",
              "golf_course",
            ],
          ],
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              "#cfddd5",
              12,
              "#9cd3b4",
            ],
          },
        },
        {
          id: "landuse_urban_green",
          type: "fill",
          source: "protomaps",
          "source-layer": "landuse",
          filter: [
            "any",
            ["in", "pmap:kind", "allotments", "village_green", "playground"],
          ],
          paint: {
            "fill-color": "#9cd3b4",
            "fill-opacity": 0.7,
          },
        },
        {
          id: "landuse_hospital",
          type: "fill",
          source: "protomaps",
          "source-layer": "landuse",
          filter: ["any", ["==", "pmap:kind", "hospital"]],
          paint: {
            "fill-color": "#e4dad9",
          },
        },
        {
          id: "landuse_industrial",
          type: "fill",
          source: "protomaps",
          "source-layer": "landuse",
          filter: ["any", ["==", "pmap:kind", "industrial"]],
          paint: {
            "fill-color": "#d1dde1",
          },
        },
        {
          id: "landuse_school",
          type: "fill",
          source: "protomaps",
          "source-layer": "landuse",
          filter: [
            "any",
            ["in", "pmap:kind", "school", "university", "college"],
          ],
          paint: {
            "fill-color": "#e4ded7",
          },
        },
        {
          id: "landuse_beach",
          type: "fill",
          source: "protomaps",
          "source-layer": "landuse",
          filter: ["any", ["in", "pmap:kind", "beach"]],
          paint: {
            "fill-color": "#e8e4d0",
          },
        },
        {
          id: "landuse_zoo",
          type: "fill",
          source: "protomaps",
          "source-layer": "landuse",
          filter: ["any", ["in", "pmap:kind", "zoo"]],
          paint: {
            "fill-color": "#c6dcdc",
          },
        },
        {
          id: "landuse_military",
          type: "fill",
          source: "protomaps",
          "source-layer": "landuse",
          filter: [
            "any",
            ["in", "pmap:kind", "military", "naval_base", "airfield"],
          ],
          paint: {
            "fill-color": "#c6dcdc",
          },
        },
        {
          id: "natural_wood",
          type: "fill",
          source: "protomaps",
          "source-layer": "natural",
          filter: [
            "any",
            ["in", "pmap:kind", "wood", "nature_reserve", "forest"],
          ],
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              "#d0ded0",
              12,
              "#a0d9a0",
            ],
          },
        },
        {
          id: "natural_scrub",
          type: "fill",
          source: "protomaps",
          "source-layer": "natural",
          filter: ["in", "pmap:kind", "scrub", "grassland", "grass"],
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              "#cedcd7",
              12,
              "#99d2bb",
            ],
          },
        },
        {
          id: "natural_glacier",
          type: "fill",
          source: "protomaps",
          "source-layer": "natural",
          filter: ["==", "pmap:kind", "glacier"],
          paint: {
            "fill-color": "#e7e7e7",
          },
        },
        {
          id: "natural_sand",
          type: "fill",
          source: "protomaps",
          "source-layer": "natural",
          filter: ["==", "pmap:kind", "sand"],
          paint: {
            "fill-color": "#e2e0d7",
          },
        },
        {
          id: "landuse_aerodrome",
          type: "fill",
          source: "protomaps",
          "source-layer": "landuse",
          filter: ["any", ["in", "pmap:kind", "aerodrome"]],
          paint: {
            "fill-color": "#dadbdf",
          },
        },
        {
          id: "transit_runway",
          type: "line",
          source: "protomaps",
          "source-layer": "transit",
          filter: ["any", ["in", "pmap:kind_detail", "runway"]],
          paint: {
            "line-color": "#e9e9ed",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              10,
              0,
              12,
              4,
              18,
              30,
            ],
          },
        },
        {
          id: "transit_taxiway",
          type: "line",
          source: "protomaps",
          "source-layer": "transit",
          minzoom: 13,
          filter: ["any", ["in", "pmap:kind_detail", "taxiway"]],
          paint: {
            "line-color": "#e9e9ed",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              13,
              0,
              13.5,
              1,
              15,
              6,
            ],
          },
        },
        {
          id: "water",
          type: "fill",
          source: "protomaps",
          "source-layer": "water",
          paint: {
            "fill-color": "#80deea",
          },
        },
        {
          id: "physical_line_stream",
          type: "line",
          source: "protomaps",
          "source-layer": "physical_line",
          minzoom: 14,
          filter: ["all", ["in", "pmap:kind", "stream"]],
          paint: {
            "line-color": "#80deea",
            "line-width": 0.5,
          },
        },
        {
          id: "physical_line_river",
          type: "line",
          source: "protomaps",
          "source-layer": "physical_line",
          minzoom: 9,
          filter: ["all", ["in", "pmap:kind", "river"]],
          paint: {
            "line-color": "#80deea",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              9,
              0,
              9.5,
              1,
              18,
              12,
            ],
          },
        },
        {
          id: "landuse_pedestrian",
          type: "fill",
          source: "protomaps",
          "source-layer": "landuse",
          filter: ["any", ["==", "pmap:kind", "pedestrian"]],
          paint: {
            "fill-color": "#e3e0d4",
          },
        },
        {
          id: "landuse_pier",
          type: "fill",
          source: "protomaps",
          "source-layer": "landuse",
          filter: ["any", ["==", "pmap:kind", "pier"]],
          paint: {
            "fill-color": "#e0e0e0",
          },
        },
        {
          id: "roads_tunnels_other_casing",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["<", "pmap:level", 0],
            ["in", "pmap:kind", "other", "path"],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              14,
              0,
              20,
              7,
            ],
          },
        },
        {
          id: "roads_tunnels_minor_casing",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["<", "pmap:level", 0],
            ["==", "pmap:kind", "minor_road"],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-dasharray": [3, 2],
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              11,
              0,
              12.5,
              0.5,
              15,
              2,
              18,
              11,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              12,
              0,
              12.5,
              1,
            ],
          },
        },
        {
          id: "roads_tunnels_link_casing",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: ["all", ["<", "pmap:level", 0], ["==", "pmap:link", 1]],
          paint: {
            "line-color": "#e0e0e0",
            "line-dasharray": [3, 2],
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              13,
              0,
              13.5,
              1,
              18,
              11,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              12,
              0,
              12.5,
              1,
            ],
          },
        },
        {
          id: "roads_tunnels_medium_casing",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["<", "pmap:level", 0],
            ["==", "pmap:kind", "medium_road"],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-dasharray": [3, 2],
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              7,
              0,
              7.5,
              0.5,
              18,
              13,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              10,
              0,
              10.5,
              1,
            ],
          },
        },
        {
          id: "roads_tunnels_major_casing",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["<", "pmap:level", 0],
            ["==", "pmap:kind", "major_road"],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-dasharray": [3, 2],
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              7,
              0,
              7.5,
              0.5,
              18,
              13,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              9,
              0,
              9.5,
              1,
            ],
          },
        },
        {
          id: "roads_tunnels_highway_casing",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["<", "pmap:level", 0],
            ["==", "pmap:kind", "highway"],
            ["!=", "pmap:link", 1],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-dasharray": [6, 0.5],
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              3,
              0,
              3.5,
              0.5,
              18,
              15,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              7,
              0,
              7.5,
              1,
              20,
              15,
            ],
          },
        },
        {
          id: "roads_tunnels_other",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["<", "pmap:level", 0],
            ["in", "pmap:kind", "other", "path"],
          ],
          paint: {
            "line-color": "#d5d5d5",
            "line-dasharray": [4.5, 0.5],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              14,
              0,
              20,
              7,
            ],
          },
        },
        {
          id: "roads_tunnels_minor",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["<", "pmap:level", 0],
            ["==", "pmap:kind", "minor_road"],
          ],
          paint: {
            "line-color": "#d5d5d5",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              11,
              0,
              12.5,
              0.5,
              15,
              2,
              18,
              11,
            ],
          },
        },
        {
          id: "roads_tunnels_link",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: ["all", ["<", "pmap:level", 0], ["==", "pmap:link", 1]],
          paint: {
            "line-color": "#d5d5d5",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              13,
              0,
              13.5,
              1,
              18,
              11,
            ],
          },
        },
        {
          id: "roads_tunnels_medium",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["<", "pmap:level", 0],
            ["==", "pmap:kind", "medium_road"],
          ],
          paint: {
            "line-color": "#d5d5d5",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              7,
              0,
              12,
              1.2,
              15,
              3,
              18,
              13,
            ],
          },
        },
        {
          id: "roads_tunnels_major",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["<", "pmap:level", 0],
            ["==", "pmap:kind", "major_road"],
          ],
          paint: {
            "line-color": "#d5d5d5",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              6,
              0,
              12,
              1.6,
              15,
              3,
              18,
              13,
            ],
          },
        },
        {
          id: "roads_tunnels_highway",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["<", "pmap:level", 0],
            ["==", "pmap:kind", "highway"],
            ["!=", "pmap:link", 1],
          ],
          paint: {
            "line-color": "#d5d5d5",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              3,
              0,
              6,
              1.1,
              12,
              1.6,
              15,
              5,
              18,
              15,
            ],
          },
        },
        {
          id: "buildings",
          type: "fill",
          source: "protomaps",
          "source-layer": "buildings",
          paint: {
            "fill-color": "#cccccc",
            "fill-opacity": 0.5,
          },
        },
        {
          id: "transit_pier",
          type: "line",
          source: "protomaps",
          "source-layer": "transit",
          filter: ["any", ["==", "pmap:kind", "pier"]],
          paint: {
            "line-color": "#e0e0e0",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              12,
              0,
              12.5,
              0.5,
              20,
              16,
            ],
          },
        },
        {
          id: "roads_minor_service_casing",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 13,
          filter: [
            "all",
            ["==", "pmap:level", 0],
            ["==", "pmap:kind", "minor_road"],
            ["==", "pmap:kind_detail", "service"],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              13,
              0,
              18,
              8,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              13,
              0,
              13.5,
              0.8,
            ],
          },
        },
        {
          id: "roads_minor_casing",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["==", "pmap:level", 0],
            ["==", "pmap:kind", "minor_road"],
            ["!=", "pmap:kind_detail", "service"],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              11,
              0,
              12.5,
              0.5,
              15,
              2,
              18,
              11,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              12,
              0,
              12.5,
              1,
            ],
          },
        },
        {
          id: "roads_link_casing",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 13,
          filter: ["all", ["==", "pmap:link", 1]],
          paint: {
            "line-color": "#e0e0e0",
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              13,
              0,
              13.5,
              1,
              18,
              11,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              13,
              0,
              13.5,
              1.5,
            ],
          },
        },
        {
          id: "roads_medium_casing",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["==", "pmap:level", 0],
            ["==", "pmap:kind", "medium_road"],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              7,
              0,
              12,
              1.2,
              15,
              3,
              18,
              13,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              10,
              0,
              10.5,
              1.5,
            ],
          },
        },
        {
          id: "roads_major_casing_late",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 12,
          filter: [
            "all",
            ["==", "pmap:level", 0],
            ["==", "pmap:kind", "major_road"],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              6,
              0,
              12,
              1.6,
              15,
              3,
              18,
              13,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              9,
              0,
              9.5,
              1,
            ],
          },
        },
        {
          id: "roads_highway_casing_late",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 12,
          filter: [
            "all",
            ["==", "pmap:level", 0],
            ["==", "pmap:kind", "highway"],
            ["!=", "pmap:link", 1],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              3,
              0,
              3.5,
              0.5,
              18,
              15,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              7,
              0,
              7.5,
              1,
              20,
              15,
            ],
          },
        },
        {
          id: "roads_other",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["==", "pmap:level", 0],
            ["in", "pmap:kind", "other", "path"],
          ],
          paint: {
            "line-color": "#ebebeb",
            "line-dasharray": [3, 1],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              14,
              0,
              20,
              7,
            ],
          },
        },
        {
          id: "roads_link",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: ["all", ["==", "pmap:link", 1]],
          paint: {
            "line-color": "#ffffff",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              13,
              0,
              13.5,
              1,
              18,
              11,
            ],
          },
        },
        {
          id: "roads_minor_service",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["==", "pmap:level", 0],
            ["==", "pmap:kind", "minor_road"],
            ["==", "pmap:kind_detail", "service"],
          ],
          paint: {
            "line-color": "#ebebeb",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              13,
              0,
              18,
              8,
            ],
          },
        },
        {
          id: "roads_minor",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["==", "pmap:level", 0],
            ["==", "pmap:kind", "minor_road"],
            ["!=", "pmap:kind_detail", "service"],
          ],
          paint: {
            "line-color": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              11,
              "#ebebeb",
              16,
              "#ffffff",
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              11,
              0,
              12.5,
              0.5,
              15,
              2,
              18,
              11,
            ],
          },
        },
        {
          id: "roads_medium",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["==", "pmap:level", 0],
            ["==", "pmap:kind", "medium_road"],
          ],
          paint: {
            "line-color": "#f5f5f5",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              7,
              0,
              12,
              1.2,
              15,
              3,
              18,
              13,
            ],
          },
        },
        {
          id: "roads_major_casing_early",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          maxzoom: 12,
          filter: [
            "all",
            ["==", "pmap:level", 0],
            ["==", "pmap:kind", "major_road"],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              7,
              0,
              7.5,
              0.5,
              18,
              13,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              9,
              0,
              9.5,
              1,
            ],
          },
        },
        {
          id: "roads_major",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["==", "pmap:level", 0],
            ["==", "pmap:kind", "major_road"],
          ],
          paint: {
            "line-color": "#ffffff",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              6,
              0,
              12,
              1.6,
              15,
              3,
              18,
              13,
            ],
          },
        },
        {
          id: "roads_highway_casing_early",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          maxzoom: 12,
          filter: [
            "all",
            ["==", "pmap:level", 0],
            ["==", "pmap:kind", "highway"],
            ["!=", "pmap:link", 1],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              3,
              0,
              3.5,
              0.5,
              18,
              15,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              7,
              0,
              7.5,
              1,
            ],
          },
        },
        {
          id: "roads_highway",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            ["==", "pmap:level", 0],
            ["==", "pmap:kind", "highway"],
            ["!=", "pmap:link", 1],
          ],
          paint: {
            "line-color": "#ffffff",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              3,
              0,
              6,
              1.1,
              12,
              1.6,
              15,
              5,
              18,
              15,
            ],
          },
        },
        {
          id: "transit_railway",
          type: "line",
          source: "protomaps",
          "source-layer": "transit",
          filter: ["all", ["==", "pmap:kind", "rail"]],
          paint: {
            "line-dasharray": [0.3, 0.75],
            "line-opacity": 0.5,
            "line-color": "#a7b1b3",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              3,
              0,
              6,
              0.15,
              18,
              9,
            ],
          },
        },
        {
          id: "boundaries_country",
          type: "line",
          source: "protomaps",
          "source-layer": "boundaries",
          filter: ["<=", "pmap:min_admin_level", 2],
          paint: {
            "line-color": "#adadad",
            "line-width": 1,
            "line-dasharray": [3, 2],
          },
        },
        {
          id: "boundaries",
          type: "line",
          source: "protomaps",
          "source-layer": "boundaries",
          filter: [">", "pmap:min_admin_level", 2],
          paint: {
            "line-color": "#adadad",
            "line-width": 0.5,
            "line-dasharray": [3, 2],
          },
        },
        {
          id: "roads_bridges_other_casing",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 12,
          filter: [
            "all",
            [">", "pmap:level", 0],
            ["in", "pmap:kind", "other", "path"],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              14,
              0,
              20,
              7,
            ],
          },
        },
        {
          id: "roads_bridges_link_casing",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 12,
          filter: ["all", [">", "pmap:level", 0], ["==", "pmap:link", 1]],
          paint: {
            "line-color": "#e0e0e0",
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              13,
              0,
              13.5,
              1,
              18,
              11,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              12,
              0,
              12.5,
              1.5,
            ],
          },
        },
        {
          id: "roads_bridges_minor_casing",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 12,
          filter: [
            "all",
            [">", "pmap:level", 0],
            ["==", "pmap:kind", "minor_road"],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              11,
              0,
              12.5,
              0.5,
              15,
              2,
              18,
              11,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              13,
              0,
              13.5,
              0.8,
            ],
          },
        },
        {
          id: "roads_bridges_medium_casing",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 12,
          filter: [
            "all",
            [">", "pmap:level", 0],
            ["==", "pmap:kind", "medium_road"],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              7,
              0,
              12,
              1.2,
              15,
              3,
              18,
              13,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              10,
              0,
              10.5,
              1.5,
            ],
          },
        },
        {
          id: "roads_bridges_major_casing",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 12,
          filter: [
            "all",
            [">", "pmap:level", 0],
            ["==", "pmap:kind", "major_road"],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              7,
              0,
              7.5,
              0.5,
              18,
              10,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              9,
              0,
              9.5,
              1.5,
            ],
          },
        },
        {
          id: "roads_bridges_other",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 12,
          filter: [
            "all",
            [">", "pmap:level", 0],
            ["in", "pmap:kind", "other", "path"],
          ],
          paint: {
            "line-color": "#ebebeb",
            "line-dasharray": [2, 1],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              14,
              0,
              20,
              7,
            ],
          },
        },
        {
          id: "roads_bridges_minor",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 12,
          filter: [
            "all",
            [">", "pmap:level", 0],
            ["==", "pmap:kind", "minor_road"],
          ],
          paint: {
            "line-color": "#ffffff",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              11,
              0,
              12.5,
              0.5,
              15,
              2,
              18,
              11,
            ],
          },
        },
        {
          id: "roads_bridges_link",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 12,
          filter: ["all", [">", "pmap:level", 0], ["==", "pmap:link", 1]],
          paint: {
            "line-color": "#ffffff",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              13,
              0,
              13.5,
              1,
              18,
              11,
            ],
          },
        },
        {
          id: "roads_bridges_medium",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 12,
          filter: [
            "all",
            [">", "pmap:level", 0],
            ["==", "pmap:kind", "medium_road"],
          ],
          paint: {
            "line-color": "#f0eded",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              7,
              0,
              12,
              1.2,
              15,
              3,
              18,
              13,
            ],
          },
        },
        {
          id: "roads_bridges_major",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 12,
          filter: [
            "all",
            [">", "pmap:level", 0],
            ["==", "pmap:kind", "major_road"],
          ],
          paint: {
            "line-color": "#f5f5f5",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              6,
              0,
              12,
              1.6,
              15,
              3,
              18,
              13,
            ],
          },
        },
        {
          id: "roads_bridges_highway_casing",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 12,
          filter: [
            "all",
            [">", "pmap:level", 0],
            ["==", "pmap:kind", "highway"],
            ["!=", "pmap:link", 1],
          ],
          paint: {
            "line-color": "#e0e0e0",
            "line-gap-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              3,
              0,
              3.5,
              0.5,
              18,
              15,
            ],
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              7,
              0,
              7.5,
              1,
              20,
              15,
            ],
          },
        },
        {
          id: "roads_bridges_highway",
          type: "line",
          source: "protomaps",
          "source-layer": "roads",
          filter: [
            "all",
            [">", "pmap:level", 0],
            ["==", "pmap:kind", "highway"],
            ["!=", "pmap:link", 1],
          ],
          paint: {
            "line-color": "#ffffff",
            "line-width": [
              "interpolate",
              ["exponential", 1.6],
              ["zoom"],
              3,
              0,
              6,
              1.1,
              12,
              1.6,
              15,
              5,
              18,
              15,
            ],
          },
        },
        {
          id: "physical_line_waterway_label",
          type: "symbol",
          source: "protomaps",
          "source-layer": "physical_line",
          minzoom: 13,
          filter: ["all", ["in", "pmap:kind", "river", "stream"]],
          layout: {
            "symbol-placement": "line",
            "text-font": ["Noto Sans Regular"],
            "text-field": ["get", "name"],
            "text-size": 12,
            "text-letter-spacing": 0.3,
          },
          paint: {
            "text-color": "#ffffff",
          },
        },
        {
          id: "physical_point_peak",
          type: "symbol",
          source: "protomaps",
          "source-layer": "physical_point",
          filter: ["any", ["==", "pmap:kind", "peak"]],
          layout: {
            "text-font": ["Noto Sans Italic"],
            "text-field": ["get", "name"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 10, 8, 16, 12],
            "text-letter-spacing": 0.1,
            "text-max-width": 9,
          },
          paint: {
            "text-color": "#7e9aa0",
            "text-halo-width": 1.5,
          },
        },
        {
          id: "roads_labels_minor",
          type: "symbol",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 15,
          filter: ["any", ["in", "pmap:kind", "minor_road", "other", "path"]],
          layout: {
            "symbol-sort-key": ["get", "pmap:min_zoom"],
            "symbol-placement": "line",
            "text-font": ["Noto Sans Regular"],
            "text-field": ["get", "name"],
            "text-size": 12,
          },
          paint: {
            "text-color": "#91888b",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2,
          },
        },
        {
          id: "physical_point_ocean",
          type: "symbol",
          source: "protomaps",
          "source-layer": "physical_point",
          filter: [
            "any",
            [
              "in",
              "pmap:kind",
              "sea",
              "ocean",
              "lake",
              "water",
              "bay",
              "strait",
              "fjord",
            ],
          ],
          layout: {
            "text-font": ["Noto Sans Medium"],
            "text-field": ["get", "name"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 10, 12],
            "text-letter-spacing": 0.1,
            "text-max-width": 9,
            "text-transform": "uppercase",
          },
          paint: {
            "text-color": "#ffffff",
          },
        },
        {
          id: "physical_point_lakes",
          type: "symbol",
          source: "protomaps",
          "source-layer": "physical_point",
          filter: ["any", ["in", "pmap:kind", "lake", "water"]],
          layout: {
            "text-font": ["Noto Sans Medium"],
            "text-field": ["get", "name"],
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3,
              0,
              6,
              12,
              10,
              12,
            ],
            "text-letter-spacing": 0.1,
            "text-max-width": 9,
          },
          paint: {
            "text-color": "#ffffff",
          },
        },
        {
          id: "roads_labels_major",
          type: "symbol",
          source: "protomaps",
          "source-layer": "roads",
          minzoom: 11,
          filter: [
            "any",
            ["in", "pmap:kind", "highway", "major_road", "medium_road"],
          ],
          layout: {
            "symbol-sort-key": ["get", "pmap:min_zoom"],
            "symbol-placement": "line",
            "text-font": ["Noto Sans Regular"],
            "text-field": ["get", "name"],
            "text-size": 12,
          },
          paint: {
            "text-color": "#938a8d",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2,
          },
        },
        {
          id: "places_subplace",
          type: "symbol",
          source: "protomaps",
          "source-layer": "places",
          filter: ["==", "pmap:kind", "neighbourhood"],
          layout: {
            "symbol-sort-key": ["get", "pmap:min_zoom"],
            "text-field": "{name}",
            "text-font": ["Noto Sans Regular"],
            "text-max-width": 7,
            "text-letter-spacing": 0.1,
            "text-padding": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5,
              2,
              8,
              4,
              12,
              18,
              15,
              20,
            ],
            "text-size": [
              "interpolate",
              ["exponential", 1.2],
              ["zoom"],
              11,
              8,
              14,
              14,
              18,
              24,
            ],
            "text-transform": "uppercase",
          },
          paint: {
            "text-color": "#8f8f8f",
            "text-halo-color": "#e0e0e0",
            "text-halo-width": 2,
          },
        },
        {
          id: "pois_important",
          type: "symbol",
          source: "protomaps",
          "source-layer": "pois",
          filter: ["any", ["<", ["get", "pmap:min_zoom"], 13]],
          layout: {
            "symbol-sort-key": ["get", "pmap:min_zoom"],
            "text-font": ["Noto Sans Regular"],
            "text-field": ["get", "name"],
            "text-size": 11,
            "text-max-width": 9,
            "icon-padding": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              2,
              14,
              2,
              16,
              20,
              17,
              2,
              22,
              2,
            ],
          },
          paint: {
            "text-color": "#8f8f8f",
            "text-halo-color": "#e0e0e0",
            "text-halo-width": 1.5,
          },
        },
        {
          id: "places_locality_circle",
          type: "circle",
          source: "protomaps",
          "source-layer": "places",
          filter: ["==", "pmap:kind", "locality"],
          paint: {
            "circle-radius": 2,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#a3a3a3",
            "circle-color": "#ffffff",
            "circle-translate": [-6, 0],
          },
          maxzoom: 8,
        },
        {
          id: "places_locality",
          type: "symbol",
          source: "protomaps",
          "source-layer": "places",
          filter: ["==", "pmap:kind", "locality"],
          layout: {
            "text-field": "{name}",
            "text-font": [
              "case",
              ["<=", ["get", "pmap:min_zoom"], 5],
              ["literal", ["Noto Sans Medium"]],
              ["literal", ["Noto Sans Regular"]],
            ],
            "text-padding": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5,
              3,
              8,
              7,
              12,
              11,
            ],
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              2,
              [
                "case",
                ["<", ["get", "pmap:population_rank"], 13],
                8,
                [">=", ["get", "pmap:population_rank"], 13],
                13,
                0,
              ],
              4,
              [
                "case",
                ["<", ["get", "pmap:population_rank"], 13],
                10,
                [">=", ["get", "pmap:population_rank"], 13],
                15,
                0,
              ],
              6,
              [
                "case",
                ["<", ["get", "pmap:population_rank"], 12],
                11,
                [">=", ["get", "pmap:population_rank"], 12],
                17,
                0,
              ],
              8,
              [
                "case",
                ["<", ["get", "pmap:population_rank"], 11],
                11,
                [">=", ["get", "pmap:population_rank"], 11],
                18,
                0,
              ],
              10,
              [
                "case",
                ["<", ["get", "pmap:population_rank"], 9],
                12,
                [">=", ["get", "pmap:population_rank"], 9],
                20,
                0,
              ],
              15,
              [
                "case",
                ["<", ["get", "pmap:population_rank"], 8],
                12,
                [">=", ["get", "pmap:population_rank"], 8],
                22,
                0,
              ],
            ],
            "icon-padding": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              2,
              8,
              4,
              10,
              8,
              12,
              6,
              22,
              2,
            ],
            "text-anchor": ["step", ["zoom"], "left", 8, "center"],
            "text-radial-offset": 0.2,
          },
          paint: {
            "text-color": "#5c5c5c",
            "text-halo-color": "#e0e0e0",
            "text-halo-width": 1,
          },
        },
        {
          id: "places_region",
          type: "symbol",
          source: "protomaps",
          "source-layer": "places",
          filter: ["==", "pmap:kind", "region"],
          layout: {
            "symbol-sort-key": ["get", "pmap:min_zoom"],
            "text-field": [
              "step",
              ["zoom"],
              ["get", "name:short"],
              6,
              ["get", "name"],
            ],
            "text-font": ["Noto Sans Regular"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 3, 11, 7, 16],
            "text-radial-offset": 0.2,
            "text-anchor": "center",
            "text-transform": "uppercase",
          },
          paint: {
            "text-color": "#b3b3b3",
            "text-halo-color": "#e0e0e0",
            "text-halo-width": 2,
          },
        },
        {
          id: "places_country",
          type: "symbol",
          source: "protomaps",
          "source-layer": "places",
          filter: ["==", "pmap:kind", "country"],
          layout: {
            "symbol-sort-key": ["get", "pmap:min_zoom"],
            "text-field": "{name}",
            "text-font": ["Noto Sans Medium"],
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              2,
              [
                "case",
                ["<", ["get", "pmap:population_rank"], 10],
                8,
                [">=", ["get", "pmap:population_rank"], 10],
                12,
                0,
              ],
              6,
              [
                "case",
                ["<", ["get", "pmap:population_rank"], 8],
                10,
                [">=", ["get", "pmap:population_rank"], 8],
                18,
                0,
              ],
              8,
              [
                "case",
                ["<", ["get", "pmap:population_rank"], 7],
                11,
                [">=", ["get", "pmap:population_rank"], 7],
                20,
                0,
              ],
            ],
            "icon-padding": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              2,
              14,
              2,
              16,
              20,
              17,
              2,
              22,
              2,
            ],
            "text-transform": "uppercase",
          },
          paint: {
            "text-color": "#a3a3a3",
          },
        },
      ],
      glyphs:
        "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    };
  } else {
    styleObject = {
      version: 8,
      sources: {
        [style]: {
          type: "raster",
          scheme: "xyz",
          tilejson: "2.2.0",
          tiles: ["sources/{z}/{x}/{y}.jpg"],
          tileSize: tileSize,
        },
      },
      layers: [
        {
          id: "background",
          type: "background",
          paint: {
            "background-color": "#f9f9f9",
          },
        },
        {
          id: style,
          type: "raster",
          source: style,
          paint: {},
        },
      ],
    };
  }
  // For now, we are styling an additional source with a
  // transparent red fill and red outline. In the future
  // we may want to allow for more customization.
  if (overlay) {
    styleObject.sources["overlay"] = {
      type: "geojson",
      data: `overlay.geojson`,
    };
    styleObject.layers.push({
      id: "polygon-layer",
      type: "fill",
      source: "overlay",
      "source-layer": "output",
      filter: ["==", "$type", "Polygon"],
      paint: {
        "fill-color": "#FF0000",
        "fill-opacity": 0.5,
      },
    });
    styleObject.layers.push({
      id: "line-layer",
      type: "line",
      source: "overlay",
      "source-layer": "output",
      filter: ["==", "$type", "LineString"],
      paint: {
        "line-color": "#FF0000",
        "line-width": 2,
      },
    });
  }
  return styleObject;
};

// Convert premultiplied image buffer from Mapbox GL to RGBA PNG format
export const generateJPG = async (buffer, width, height, ratio) => {
  // Un-premultiply pixel values
  // Mapbox GL buffer contains premultiplied values, which are not handled
  // correctly by sharp https://github.com/mapbox/mapbox-gl-native/issues/9124
  // since we are dealing with 8-bit RGBA values, normalize alpha onto 0-255
  // scale and divide it out of RGB values

  for (let i = 0; i < buffer.length; i += 4) {
    const alpha = buffer[i + 3];
    const norm = alpha / 255;
    if (alpha === 0) {
      buffer[i] = 0;
      buffer[i + 1] = 0;
      buffer[i + 2] = 0;
    } else {
      buffer[i] /= norm;
      buffer[i + 1] = buffer[i + 1] / norm;
      buffer[i + 2] = buffer[i + 2] / norm;
    }
  }

  return sharp(buffer, {
    raw: {
      width: width * ratio,
      height: height * ratio,
      channels: 4,
    },
  })
    .jpeg()
    .toBuffer();
};

// Generate MBTiles file from a given style, bounds, and zoom range
export const generateMBTiles = async (
  styleObject,
  styleDir,
  sourceDir,
  bounds,
  minZoom,
  maxZoom,
  tempDir,
  outputDir,
  outputFilename,
) => {
  const tempPath = `${tempDir}/${outputFilename}.mbtiles`;
  console.log(`Generating MBTiles file: ${tempPath}`);

  // Create a new MBTiles file
  const mbtiles = await new Promise((resolve, reject) => {
    new MBTiles(`${tempPath}?mode=rwc`, (err, mbtiles) => {
      if (err) {
        console.error("Error opening MBTiles file:", err);
        reject(err);
      } else {
        resolve(mbtiles);
      }
    });
  });

  try {
    // Start writing to the MBTiles file
    mbtiles.startWriting((err) => {
      if (err) {
        throw err;
      } else {
        let metadata = {
          name: outputFilename,
          format: "jpg",
          minzoom: minZoom,
          maxzoom: maxZoom,
          type: "overlay",
        };

        // Check if metadata.json exists in the sourceDir
        const metadataFile = path.join(sourceDir, "metadata.json");
        if (fs.existsSync(metadataFile)) {
          try {
            // Read and parse the metadata.json file
            const metadataJson = fs.readFileSync(metadataFile, "utf8");
            const metadataFromFile = JSON.parse(metadataJson);

            // Merge the file metadata with the default metadata
            metadata = { ...metadata, ...metadataFromFile };
          } catch (err) {
            console.error(`Error reading metadata.json file: ${err}`);
          }
        }

        mbtiles.putInfo(metadata, (err) => {
          if (err) throw err;
        });
      }
    });

    // Iterate over zoom levels
    for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
      console.log(`Rendering zoom level ${zoom}...`);
      // Calculate tile range for this zoom level based on bounds
      const { minX, minY, maxX, maxY } = calculateTileRangeForBounds(
        bounds,
        zoom,
      );

      validateMinMaxValues(minX, minY, maxX, maxY);

      // Iterate over tiles within the range
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          try {
            // Render the tile
            const tileBuffer = await renderTile(
              styleObject,
              styleDir,
              sourceDir,
              zoom,
              x,
              y,
            );

            // Write the tile to the MBTiles file
            mbtiles.putTile(zoom, x, y, tileBuffer, (err) => {
              if (err) throw err;
            });
          } catch (error) {
            console.error(`Error rendering tile ${zoom}/${x}/${y}: ${error}`);
          }
        }
      }
    }

    // Finish writing and close the MBTiles file
    await new Promise((resolve, reject) => {
      mbtiles.stopWriting((err) => {
        if (err) reject(err);
        console.log(
          `\x1b[32m${outputFilename}.mbtiles has been successfully generated!\x1b[0m`,
        );
        resolve();
      });
    });
  } finally {
    // Move the generated MBTiles file to the output directory
    const outputPath = `${outputDir}/${outputFilename}.mbtiles`;

    try {
      const readStream = fs.createReadStream(tempPath);
      const writeStream = fs.createWriteStream(outputPath);

      readStream.on("error", (err) => {
        console.error(`Error reading MBTiles file: ${err}`);
      });

      writeStream.on("error", (err) => {
        console.error(`Error writing MBTiles file: ${err}`);
      });

      writeStream.on("close", () => {
        // Delete the temporary tiles directory and style
        if (tempDir !== null) {
          fs.promises.rm(tempDir, { recursive: true });
        }
      });

      readStream.pipe(writeStream);
    } catch (err) {
      throw new Error(`Error moving MBTiles file: ${err}`);
    }
  }
};
