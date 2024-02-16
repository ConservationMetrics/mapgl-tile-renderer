#!/usr/bin/env node

import { program } from "commander";

import { parseListToFloat, validateInputOptions } from "./utils.js";
import { initiateRendering } from "./initiate.js";

program
  .name("mbgl-tile-render")
  .description("Render styled Maplibre GL map tiles")
  .requiredOption("-s ,--style <type>", `Specify the style source`)
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
    "-O, --openstreetmap <boolean>",
    "If using an online satellite imagery source: include OpenStreetMap data as an overlay. Set to 'true' or 'false' (default 'false')",
    (value) => value.toLowerCase() === "true",
    false,
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

const {
  style,
  stylelocation: styleDir,
  stylesources: sourceDir,
  apikey: apiKey,
  mapboxstyle: mapboxStyle,
  monthyear: monthYear,
  openstreetmap: openStreetMap,
  overlay,
  bounds,
  minzoom: minZoom,
  maxzoom: maxZoom,
  outputdir: outputDir,
  filename: outputFilename,
} = options;

validateInputOptions(
  style,
  styleDir,
  sourceDir,
  apiKey,
  mapboxStyle,
  monthYear,
  openStreetMap,
  overlay,
  bounds,
  minZoom,
  maxZoom,
);

console.log("\n\n-------- Rendering map tiles with Maplibre GL --------");

console.log("Map style: %j", style);
if (styleDir) console.log("Location of self-hosted stylesheet: %j", styleDir);
if (sourceDir) console.log("Location of self-hosted sources: %j", sourceDir);
if (apiKey) console.log("API key: %j", apiKey);
if (mapboxStyle) console.log("Mapbox style: %j", mapboxStyle);
if (monthYear)
  console.log("Month and year (for Planet monthly basemaps): %j", monthYear);
if (openStreetMap) console.log("OpenStreetMap overlay: %j", openStreetMap);
if (overlay) console.log("Overlay: %j", overlay);
console.log("Bounding box: %j", bounds);
console.log("Min zoom: %j", minZoom);
console.log("Max zoom: %j", maxZoom);
console.log("Output directory: %j", outputDir);
console.log("Output MBTiles filename: %j", outputFilename);
console.log("------------------------------------------------------");

const renderResult = await initiateRendering(
  style,
  styleDir,
  sourceDir,
  apiKey,
  mapboxStyle,
  monthYear,
  openStreetMap,
  overlay,
  bounds,
  minZoom,
  maxZoom,
  outputDir,
  outputFilename,
);

// output the render result to console
console.log("Render result:", renderResult);
