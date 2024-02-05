import os from "os";
import fs from "fs";
import path from "path";

import { generateStyle, generateMBTiles } from "./generate_resources.js";
import { requestOnlineTiles } from "./download_resources.js";
import { handleError } from "./utils.js";

const MBTILES_REGEXP = /mbtiles:\/\/(\S+?)(?=[/"]+)/gi;

export const initiateRendering = async (
  style,
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
) => {
  console.log("Initiating rendering...");

  const workBegun = new Date().toISOString();

  const tempDir = path.join(os.tmpdir(), "mapgl-tile-renderer-temp");
  if (!fs.existsSync(tempDir)) {
    try {
      fs.mkdirSync(tempDir, { recursive: true });
    } catch (error) {
      return handleError(error, "creating the temporary directory");
    }
  }
  let stylePath = null;
  let styleObject = null;

  // If the style is self-hosted, let's read the style from the file.
  if (style === "self") {
    stylePath = path.resolve(process.cwd(), styleDir);
    try {
      styleObject = JSON.parse(fs.readFileSync(stylePath, "utf-8"));
    } catch (error) {
      return handleError(error, "reading the style file");
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
        tempDir,
      );
    } catch (error) {
      return handleError(error, "downloading tiles from the online source");
    }

    // Save the overlay GeoJSON to a file, if provided
    if (overlay) {
      try {
        fs.writeFileSync(`${tempDir}/sources/overlay.geojson`, overlay);
      } catch (error) {
        return handleError(error, "saving the overlay GeoJSON to a file");
      }
      console.log(`Overlay GeoJSON saved to file!`);
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
        styleObject = generateStyle(style, overlay, tileSize);
        fs.writeFileSync(
          `${tempDir}/style.json`,
          JSON.stringify(styleObject, null, 2),
        );
        console.log("Stylesheet generated and saved!");
      } catch (error) {
        return handleError(error, "generating and saving the stylesheet");
      }
    }

    sourceDir = `${tempDir}/sources`;
    styleDir = tempDir;
  }

  const localMbtilesMatches = JSON.stringify(styleObject).match(MBTILES_REGEXP);
  if (localMbtilesMatches && !sourceDir) {
    const msg =
      "Stylesheet has local mbtiles file sources, but no sourceDir is set";
    return handleError(new Error(msg), "checking for local mbtiles sources");
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
        return handleError(
          new Error(msg),
          "checking for local mbtiles sources",
        );
      }
    });
  }

  try {
    let metadata = await generateMBTiles(
      styleObject,
      styleDir,
      sourceDir,
      bounds,
      minZoom,
      maxZoom,
      tempDir,
      outputDir,
      outputFilename,
    );

    console.log(
      `\x1b[32m${outputFilename}.mbtiles has been successfully generated!\x1b[0m`,
    );

    // if successful, return the metadata
    return {
      style: style,
      status: metadata.status,
      errorCode: metadata.errorCode,
      errorMessage: metadata.errorMessage,
      filename: metadata.filename,
      filesize: metadata.filesize,
      numberOfTiles: metadata.numberOfTiles,
      numberOfAttempts: 1,
      workBegun,
      workEnded: new Date().toISOString(),
      // if status = success, set expiration for one year
      expiration:
        metadata.status === "success"
          ? new Date(Date.now() + 31556952000).toISOString()
          : null,
    };
  } catch (error) {
    return handleError(error, "generating MBTiles file");
  }
};

export default initiateRendering;
