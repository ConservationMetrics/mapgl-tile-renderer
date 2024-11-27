#!/usr/bin/env node

import { program } from "commander";

import { parseListToFloat, validateInputOptions } from "./utils.js";
import { initiateRendering } from "./initiate.js";

program
  .name("mapgl-tile-renderer")
  .description("Render styled MapGL map tiles")
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
  .option("-r, --ratio <number>", "Map pixel ratio (default 1)", Math.floor, 1)
  .option(
    "-t, --tiletype <type>",
    "Tile type (jpg, png, or webp)",
    (type) => {
      if (!["jpg", "png", "webp"].includes(type)) {
        throw new Error("Invalid tile type");
      }
      return type;
    },
    "jpg",
  )
  .option(
    "-F, --format <type>",
    "Output format (mbtiles or smp, default 'mbtiles')",
    (format) => {
      if (!["mbtiles", "smp"].includes(format)) {
        throw new Error("Invalid format type");
      }
      return format;
    },
    "mbtiles",
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
  )
  .option(
    "-T, --thumbnail <boolean>",
    "Generate a thumbnail image with bounding box overlaid. Set to 'true' or 'false' (default 'false')",
    (value) => value.toLowerCase() === "true",
    false,
  );

program.parse(process.argv);
const options = program.opts();

const {
  style,
  stylelocation: styleLocation,
  stylesources: sourceDir,
  apikey: apiKey,
  mapboxstyle: mapboxStyle,
  monthyear: monthYear,
  openstreetmap: openStreetMap,
  overlay,
  bounds,
  minzoom: minZoom,
  maxzoom: maxZoom,
  ratio,
  tiletype,
  format,
  outputdir: outputDir,
  filename: outputFilename,
  thumbnail,
} = options;

validateInputOptions(
  style,
  styleLocation,
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

console.log("\n======== Rendering map tiles with MapLibre GL ========");

console.log("Map style: %j", style);
if (styleLocation)
  console.log("Location of self-hosted stylesheet: %j", styleLocation);
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
console.log("Ratio: %j", ratio);
console.log("Generate thumbnail: %j", thumbnail);
console.log("Format: %j", format);
console.log("Output tile type: %j", tiletype);
console.log("Output directory: %j", outputDir);
console.log("Output MBTiles filename: %j", outputFilename);
console.log("======================================================\n");

const renderResult = await initiateRendering(
  style,
  styleLocation,
  sourceDir,
  apiKey,
  mapboxStyle,
  monthYear,
  openStreetMap,
  overlay,
  bounds,
  minZoom,
  maxZoom,
  ratio,
  tiletype,
  format,
  outputDir,
  outputFilename,
  thumbnail,
);

console.log("\n======== Render Result ========");
console.log("Style: %j", renderResult.style);
console.log("Status: %j", renderResult.status);
if (renderResult.errorMessage) {
  console.log("Error message: %j", renderResult.errorMessage);
}
console.log("File location: %j", renderResult.fileLocation);
console.log("Filename: %j", renderResult.filename);
console.log("File size: %j", renderResult.fileSize);
console.log("Number of tiles: %j", renderResult.numberOfTiles);
if (renderResult.thumbnailFilename) {
  console.log("Thumbnail filename: %j", renderResult.thumbnailFilename);
}
console.log("Work begun: %j", renderResult.workBegun);
console.log("Work ended: %j", renderResult.workEnded);
console.log("================================");
