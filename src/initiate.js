import fs from "fs";
import path from "path";

import { generateStyle, generateMBTiles } from "./generate_resources.js";
import { requestOnlineTiles } from "./download_resources.js";

const MBTILES_REGEXP = /mbtiles:\/\/(\S+?)(?=[/"]+)/gi;

export const initiateRendering = async (
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
  output,
) => {
  console.log("Initiating rendering...");

  let tempDir = null;

  // If the style is not self-hosted, let's generate everything that we need to render tiles.
  if (style !== "self") {
    tempDir = "outputs/temp/";
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    // Download tiles from the online source
    await requestOnlineTiles(
      style,
      apiKey,
      mapboxStyle,
      monthYear,
      bounds,
      minZoom,
      maxZoom,
      tempDir,
    );

    // Save the overlay GeoJSON to a file, if provided
    if (overlay) {
      fs.writeFileSync(tempDir + "sources/overlay.geojson", overlay);
      console.log(`Overlay GeoJSON saved to file!`);
    }

    // Set the tileSize of the online source. Mapbox Raster API provides 512px tiles.
    let tileSize;
    if (style === "mapbox-style") {
      tileSize = 512;
    } else {
      tileSize = 256;
    }

    // Generate and save a stylesheet from the online source and overlay source.
    if (styleObject === null) {
      styleObject = generateStyle(style, overlay, tileSize);
      fs.writeFileSync(tempDir + "style.json", JSON.stringify(style, null, 2));
      console.log("Style file generated and saved!");
    }

    sourceDir = tempDir + "sources/";
    styleDir = path.resolve(process.cwd(), tempDir);
  }

  const localMbtilesMatches = JSON.stringify(styleObject).match(MBTILES_REGEXP);
  if (localMbtilesMatches && !sourceDir) {
    const msg = "Style has local mbtiles file sources, but no sourceDir is set";
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
        })} in style file is not found in: ${path.resolve(sourceDir)}`;
        throw new Error(msg);
      }
    });
  }

  try {
    await generateMBTiles(
      styleObject,
      styleDir,
      sourceDir,
      bounds,
      minZoom,
      maxZoom,
      tempDir,
      output,
    );
  } catch (error) {
    console.error("Error generating MBTiles:", error);
  }
};

export default initiateRendering;
