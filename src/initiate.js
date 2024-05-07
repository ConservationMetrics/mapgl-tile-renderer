import os from "os";
import fs from "fs";
import path from "path";

import { generateStyle, generateMBTiles } from "./generate_resources.js";
import {
  requestOnlineTiles,
  requestOpenStreetMapData,
} from "./download_resources.js";

const MBTILES_REGEXP = /mbtiles:\/\/(\S+?)(?=[/"]+)/gi;

export const initiateRendering = async (
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
  outputDir,
  outputFilename,
) => {
  console.log("Initiating rendering...");

  const workBegun = new Date().toISOString();

  const tempDir = path.join(os.tmpdir(), "mapgl-tile-renderer-temp");
  if (!fs.existsSync(tempDir)) {
    try {
      fs.mkdirSync(tempDir, { recursive: true });
    } catch (error) {
      throw new Error(`Error creating temp directory: ${error.message}`);
    }
  }

  let styleObject = null;
  let styleDir = null;

  // If the style is self-hosted, let's read the style from the file.
  if (style === "self") {
    const stylePath = path.resolve(process.cwd(), styleLocation);
    styleDir = path.dirname(stylePath);
    try {
      styleObject = JSON.parse(fs.readFileSync(stylePath, "utf-8"));
    } catch (error) {
      throw new Error(`Error reading the style file: ${error.message}`);
    }
  }

  // If the style is not self-hosted, let's generate everything that we need to render tiles.
  if (style !== "self") {
    // Download tiles from the online source
    try {
      await requestOnlineTiles(
        style,
        apiKey,
        mapboxStyle,
        monthYear,
        bounds,
        minZoom,
        maxZoom,
        outputFilename,
        tempDir,
      );
    } catch (error) {
      throw new Error(
        `Error downloading tiles from the online source: ${error.message}`,
      );
    }

    // Save the overlay GeoJSON to a file, if provided
    if (overlay) {
      try {
        fs.writeFileSync(`${tempDir}/sources/overlay.geojson`, overlay);
      } catch (error) {
        throw new Error(
          `Error saving overlay GeoJSON to file: ${error.message}`,
        );
      }
      console.log(`Overlay GeoJSON saved to file!`);
    }

    // Download OpenStreetMap data for the bounds from the Overpass API, and convert it to GeoJSON
    if (openStreetMap) {
      try {
        await requestOpenStreetMapData(bounds, tempDir);
      } catch (error) {
        throw new Error(
          `Error downloading OpenStreetMap data: ${error.message}`,
        );
      }
    }

    // Set the tileSize of the online source. Mapbox Raster API provides 512px tiles.
    let tileSize;
    if (style === "mapbox" || style === "mapbox-satellite") {
      tileSize = 512;
    } else {
      tileSize = 256;
    }

    // Generate and save a stylesheet from the online source and overlay source.
    if (styleObject === null) {
      try {
        styleObject = generateStyle(
          style,
          overlay,
          openStreetMap,
          tileSize,
          tempDir,
        );
        fs.writeFileSync(
          `${tempDir}/style.json`,
          JSON.stringify(styleObject, null, 2),
        );
        console.log("Stylesheet generated and saved!");
      } catch (error) {
        throw new Error(
          `Error generating and saving the stylesheet: ${error.message}`,
        );
      }
    }

    sourceDir = `${tempDir}/sources`;
    styleDir = tempDir;
  }

  const localMbtilesMatches = JSON.stringify(styleObject).match(MBTILES_REGEXP);
  if (localMbtilesMatches && !sourceDir) {
    const msg =
      "Stylesheet has local mbtiles file sources, but no sourceDir is set";
    throw new Error(msg);
  }

  if (localMbtilesMatches) {
    localMbtilesMatches.forEach((name) => {
      const mbtileFilename = path.normalize(
        path.format({
          dir: sourceDir,
          name: name.split("://")[1],
          ext: ".mbtiles",
        }),
      );
      if (!fs.existsSync(mbtileFilename)) {
        const msg = `Mbtiles file ${path.format({
          name,
          ext: ".mbtiles",
        })} in stylesheet is not found in: ${path.resolve(sourceDir)}`;
        throw new Error(msg);
      }
    });
  }

  let generateResult = await generateMBTiles(
    styleObject,
    styleDir,
    sourceDir,
    bounds,
    minZoom,
    maxZoom,
    ratio,
    tiletype,
    tempDir,
    outputDir,
    outputFilename,
  );

  console.log(
    `\x1b[32m${outputFilename}.mbtiles has been successfully generated!\x1b[0m`,
  );

  // if successful, return the render result
  return {
    style: style,
    status: "SUCCEEDED",
    errorMessage: generateResult.errorMessage,
    fileLocation: generateResult.fileLocation,
    filename: generateResult.filename,
    fileSize: generateResult.fileSize,
    numberOfTiles: generateResult.numberOfTiles,
    workBegun,
    workEnded: new Date().toISOString(),
  };
};

export default initiateRendering;
