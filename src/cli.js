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
const validOnlineStyles = [
  "bing",
  "esri",
  "google",
  "mapbox",
  "mapbox-satellite",
  "planet",
];

program
  .version(packageJson.version)
  .name("mbgl-tile-render")
  .description("Render styled Maplibre GL map tiles")
  .requiredOption(
    "-s ,--style <type>",
    `Specify the style source. Use 'self' for a self-provided style or one of the following for an online source: ${validOnlineStyles}`,
    function (value) {
      value = value.toLowerCase();
      if (!validOnlineStyles.includes(value) && value !== "self") {
        throw new Error(
          `Invalid style. It can only be one of these: self,${validOnlineStyles}`,
        );
      }
      return value;
    },
  )
  .option(
    "-l, --stylelocation <type>",
    "If using a self-provided style: location of your map style",
  )
  .option(
    "-d, --stylesources <type>",
    "If using a self-provided style: directory where your local source files are located",
  )
  .option(
    "-k, --apikey <type>",
    "(Optional) If using an online source: API key that may be required",
  )
  .option(
    "-a, --overlay <type>",
    "(Optional) If using an online source: feature layer to overlay on top of the online source (must be a GeoJSON object)",
  )
  .option("-m, --mapboxstyle <type>", "Mapbox style URL")
  .option(
    "-p, --monthyear <type>",
    "The month and year (in YYYY-MM format) of the Planet Monthly Visual Basemap to use",
  )
  .requiredOption(
    "-b, --bounds <type>",
    "(Required) Bounding box in WSEN format, comma separated",
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
    "(Required) Maximum zoom level",
    parseInt,
  )
  .option(
    "-o, --outputdir <type>",
    "Output directory (default 'outputs/')",
    "outputs",
  )
  .option(
    "-f, --filename <type>",
    "Output filename (default 'output')",
    "output",
  );

program.parse(process.argv);

const options = program.opts();

const style = options.style;
const styleLocation = options.stylelocation;
const sourceDir = options.stylesources;
const apiKey = options.apikey;
const mapboxStyle = options.mapboxstyle;
const monthYear = options.monthyear;
const overlay = options.overlay;
const bounds = options.bounds;
const minZoom = options.minzoom;
const maxZoom = options.maxzoom;
const outputDir = options.outputdir;
const outputFilename = options.filename;

// Validations for CLI options

if (style === "self" && (!styleLocation || !sourceDir)) {
  raiseError(
    "You must provide a style location using the --stylelocation flag, and a source directory using the --stylesources flag, if you are providing your own style",
  );
}

if (
  (style === "mapbox" || style === "mapbox-satellite" || style === "planet") &&
  !apiKey
) {
  raiseError(`You must provide an API key for ${style}`);
}

if (style === "planet" && !monthYear) {
  raiseError(
    "You must provide a month and year (YYYY-MM) using the --monthyear flag for the Planet Monthly Visual Basemap",
  );
}

// Ensure monthYear is in the right format
if (monthYear) {
  const monthYearFormat = /^\d{4}-\d{2}$/;
  if (!monthYearFormat.test(monthYear)) {
    raiseError("Month and year must be in YYYY-MM format");
  }
}

if (style === "mapbox" && !mapboxStyle) {
  raiseError(
    "You must provide a Mapbox style URL using the --mapboxstyle flag if you are using Mapbox as your online source",
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

let styleDir = null;
let styleObject = null;

if (style === "self") {
  const stylePath = path.resolve(process.cwd(), styleLocation);
  styleDir = path.dirname(stylePath);
  styleObject = JSON.parse(fs.readFileSync(stylePath, "utf-8"));
}

console.log("\n\n-------- Creating Maplibre GL map tiles --------");

console.log("style to use: %j", style);
if (styleLocation) console.log("style location: %j", styleLocation);
if (sourceDir) console.log("local source path: %j", sourceDir);
if (apiKey) console.log("api key: %j", apiKey);
if (mapboxStyle) console.log("mapbox style: %j", mapboxStyle);
if (monthYear) console.log("month and year: %j", monthYear);
if (overlay) console.log("overlay source: %j", overlay);
console.log("bounds: %j", bounds);
console.log("minZoom: %j", minZoom);
console.log("maxZoom: %j", maxZoom);
console.log("output directory: %j", outputDir);
console.log("output filename: %j", outputFilename);
console.log("------------------------------------------------");

initiateRendering(
  style,
  styleObject,
  styleDir,
  sourceDir,
  apiKey,
  mapboxStyle,
  monthYear,
  overlay,
  bounds,
  minZoom,
  maxZoom,
  outputDir,
  outputFilename,
);
