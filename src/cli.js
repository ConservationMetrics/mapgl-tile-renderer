#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { program } from "commander";
import packageJson from "../package.json" assert { type: "json" };

import { initiateRendering } from "./initiate.js";

const raiseError = (msg) => {
  console.error("ERROR:", msg);
  process.exit(1);
};

const parseListToFloat = (text) => text.split(",").map(Number);
const onlineSources = [
  "bing",
  "esri",
  "google",
  "mapbox-satellite",
  "mapbox-style",
  "planet-monthly-visual",
];

program
  .version(packageJson.version)
  .name("mbgl-tile-render")
  .description("Render styled Maplibre GL map tiles")
  .requiredOption(
    "-s ,--style <type>",
    "Are you providing your own map style? If not, one will be generated using your sources. (required, 'yes' or 'no')",
    function (value) {
      const validSources = ["yes", "no"];
      value = value.toLowerCase();
      if (!validSources.includes(value)) {
        throw new Error("Invalid answer. It can only be yes or no.");
      }
      return value;
    },
  )
  .option("-l, --stylelocation <type>", "Location of your provided map style")
  .option(
    "-i, --stylesources <type>",
    "Directory where any local source files specified in your provided style are located",
  )
  .option(
    "-O, --onlinesource <type>",
    `Online source type. Options: ${onlineSources}`,
    function (value) {
      value = value.toLowerCase();
      if (!onlineSources.includes(value)) {
        throw new Error(
          `Invalid online source. It can only be one of these: ${onlineSources}`,
        );
      }
      return value;
    },
  )
  .option("-k, --apikey <type>", "API key for your online source (optional)")
  .option(
    "-m, --mapboxstyle <type>",
    "Mapbox style URL (required if using mapbox for onlinesource)",
  )
  .option(
    "-p, --monthyear <type>",
    "The month and year (in YYYY-MM format) of the Planet Monthly Visual Basemap to use (required if using planet-monthly-visual for onlinesource)",
  )

  .option(
    "-a, --overlay <type>",
    "Feature layer to overlay on top of the online source (must be a GeoJSON object)",
  )
  .requiredOption(
    "-b, --bounds <type>",
    "Bounding box in WSEN format, comma separated (required)",
    parseListToFloat,
  )
  .option(
    "-z, --minzoom <number>",
    "Minimum zoom level (default 0)",
    parseInt,
    0,
  )
  .requiredOption(
    "-Z, --maxzoom <number>",
    "Maximum zoom level (required)",
    parseInt,
  )
  .option("-o, --output <type>", "Output name (default 'output')", "output");

program.parse(process.argv);

const options = program.opts();

const styleProvided = options.style;
const styleLocation = options.stylelocation;
const sourceDir = options.stylesources;
const onlineSource = options.onlinesource;
const onlineSourceAPIKey = options.apikey;
const mapboxStyle = options.mapboxstyle;
const monthYear = options.monthyear;
const overlaySource = options.overlay;
const bounds = options.bounds;
const minZoom = options.minzoom;
const maxZoom = options.maxzoom;
const output = options.output;

// Validations for CLI options

if (styleProvided === "yes" && (!styleLocation || !sourceDir)) {
  raiseError(
    "You must provide a style location and a source directory if you are providing your own style",
  );
}

if (styleProvided === "no" && !onlineSource) {
  raiseError(
    "You must provide an online source if you are not providing your own style",
  );
}

if (
  (onlineSource === "mapbox" ||
    onlineSource === "mapbox-satellite" ||
    onlineSource === "planet-monthly-visual") &&
  !onlineSourceAPIKey
) {
  raiseError(`You must provide an API key for ${onlineSource}`);
}

if (onlineSource === "planet-monthly-visual" && !monthYear) {
  raiseError(
    "You must provide a month and year (YYYY-MM) for the Planet Monthly Visual Basemap",
  );
}

// Ensure monthYear is in the right format
if (monthYear) {
  const monthYearFormat = /^\d{4}-\d{2}$/;
  if (!monthYearFormat.test(monthYear)) {
    raiseError("Month and year must be in YYYY-MM format");
  }
}

if (onlineSource === "mapbox" && !mapboxStyle) {
  raiseError(
    "You must provide a Mapbox style URL if you are using Mapbox as your online source",
  );
}

if (mapboxStyle) {
  const mapboxStyleFormat = /^[\w-]+\/[\w-]+$/;
  if (!mapboxStyleFormat.test(mapboxStyle)) {
    raiseError(
      "Mapbox style URL must be in a valid format: <yourusername>/<styleid>",
    );
  }
}

if (minZoom !== null && (minZoom < 0 || minZoom > 22)) {
  raiseError(`minZoom level is outside supported range (0-22): ${minZoom}`);
}

if (maxZoom !== null && (maxZoom < 0 || maxZoom > 22)) {
  raiseError(`maxZoom level is outside supported range (0-22): ${maxZoom}`);
}

if (bounds !== null) {
  if (bounds.length !== 4) {
    raiseError(
      `Bounds must be west,south,east,north.  Invalid value found: ${[
        ...bounds,
      ]}`,
    );
  }

  bounds.forEach((b) => {
    if (!Number.isFinite(b)) {
      raiseError(
        `Bounds must be valid floating point values.  Invalid value found: ${[
          ...bounds,
        ]}`,
      );
    }
    return null;
  });

  const [west, south, east, north] = bounds;
  if (west === east) {
    raiseError("Bounds west and east coordinate are the same value");
  }
  if (south === north) {
    raiseError("Bounds south and north coordinate are the same value");
  }
}

let style = null;
let styleDir = null;

if (styleProvided === "yes") {
  const stylePath = path.resolve(process.cwd(), styleLocation);
  styleDir = path.dirname(stylePath);
  style = JSON.parse(fs.readFileSync(stylePath, "utf-8"));
}

console.log("\n\n-------- Creating Maplibre GL map tiles --------");

console.log("style provided: %j", styleProvided);
if (styleLocation) console.log("style location: %j", styleLocation);
if (sourceDir) console.log("local source path: %j", sourceDir);
if (onlineSource) console.log("online source: %j", onlineSource);
if (onlineSourceAPIKey) console.log("api key: %j", onlineSourceAPIKey);
if (mapboxStyle) console.log("mapbox style: %j", mapboxStyle);
if (monthYear) console.log("month and year: %j", monthYear);
if (overlaySource) console.log("overlay source: %j", overlaySource);
console.log("bounds: %j", bounds);
console.log("minZoom: %j", minZoom);
console.log("maxZoom: %j", maxZoom);
console.log("output: %j", output);
console.log("------------------------------------------------");

initiateRendering(
  styleProvided === "yes",
  style,
  styleDir,
  sourceDir,
  onlineSource,
  onlineSourceAPIKey,
  mapboxStyle,
  monthYear,
  overlaySource,
  bounds,
  minZoom,
  maxZoom,
  output,
);
