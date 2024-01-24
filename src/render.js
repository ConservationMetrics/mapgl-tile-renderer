import fs from "fs";
import path from "path";
import maplibre from "@maplibre/maplibre-gl-native";
import MBTiles from "@mapbox/mbtiles";

import {
  calculateTileRangeForBounds,
  calculateNormalizedCenterCoords,
} from "./tile_calculations.js";
import { requestHandler } from "./request_resources.js";
import {
  generateStyle,
  generateJPG,
  downloadRemoteTiles,
} from "./generate_resources.js";

const MBTILES_REGEXP = /mbtiles:\/\/(\S+?)(?=[/"]+)/gi;

// Render the map, returning a Promise.
const renderMap = (map, options) => {
  return new Promise((resolve, reject) => {
    map.render(options, (err, buffer) => {
      if (err) {
        console.error("Error during map rendering:", err);
        map.release();
        return reject(err);
      }
      return resolve(buffer);
    });
  });
};

// Render map tile for a given style, zoom level, and tile coordinates
const renderTile = async (style, styleDir, sourceDir, zoom, x, y) => {
  const tileSize = 512;

  const center = calculateNormalizedCenterCoords(x, y, zoom);

  // Create a new MapLibre instance with specified size and other parameters
  // In MapLibre server-side rendering, methods like resize, setZoom, and setCenter are not available
  // Hence, we need to create a new map instance for each tile, load the style, set the zoom/center,
  // and release the map instance after rendering.
  // MapLibre native documentation: https://github.com/maplibre/maplibre-native/blob/main/platform/node/README.md
  const map = new maplibre.Map({
    request: requestHandler(styleDir, sourceDir),
    ratio: 1,
  });

  map.load(style);

  // Render the map to a buffer
  const buffer = await renderMap(map, {
    zoom: zoom,
    center: center,
    height: tileSize,
    width: tileSize,
  });

  // Clean up the map instance to free resources
  map.release();

  const jpeg = await generateJPG(buffer, tileSize, tileSize, 1);

  return jpeg;
};

// Construct MBTiles file from a given style, bounds, and zoom range
const constructMBTiles = async (
  style,
  styleDir,
  sourceDir,
  bounds,
  minZoom,
  maxZoom,
  tempDir,
  output,
) => {
  const outputPath = `outputs/${output}.mbtiles`;

  // Create a new MBTiles file
  const mbtiles = await new Promise((resolve, reject) => {
    new MBTiles(`${outputPath}?mode=rwc`, (err, mbtiles) => {
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
          name: output,
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

      // Iterate over tiles within the range
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          try {
            // Render the tile
            const tileBuffer = await renderTile(
              style,
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
        console.log("MBTiles file generation completed.");
        resolve();
      });
    });
  } finally {
    // Delete the temporary tiles directory and style
    if (tempDir !== null) {
      await fs.promises.rm(tempDir, { recursive: true });
    }
  }
};

export const initiateRendering = async (
  styleProvided,
  styleObject,
  styleDir,
  sourceDir,
  onlineSource,
  onlineSourceAPIKey,
  overlaySource,
  bounds,
  minZoom,
  maxZoom,
  output,
) => {
  console.log("Initiating rendering...");

  let style = styleObject;
  let tempDir = null;

  // If no style is provided, let's generate everything that we need to render tiles.
  if (!styleProvided) {
    tempDir = "outputs/temp/";
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    // Download the remote source tiles
    await downloadRemoteTiles(
      onlineSource,
      onlineSourceAPIKey,
      bounds,
      minZoom,
      maxZoom,
      tempDir,
    );

    // Save the overlay GeoJSON to a file, if provided
    if (overlaySource) {
      fs.writeFileSync(tempDir + "overlay.geojson", overlaySource);
    }

    // Generate and save a stylesheet from the online source and overlay source.
    if (style === null) {
      if (!onlineSource) {
        const msg =
          "You must provide a online source if you are not providing your own style";
        throw new Error(msg);
      } else {
        style = generateStyle(onlineSource, overlaySource);
        fs.writeFileSync(
          tempDir + "style.json",
          JSON.stringify(style, null, 2),
        );
        console.log("Style file generated and saved.");
      }
    }

    sourceDir = tempDir + "tiles/";
    styleDir = path.resolve(process.cwd(), tempDir);
  }

  const localMbtilesMatches = JSON.stringify(style).match(MBTILES_REGEXP);
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
    await constructMBTiles(
      style,
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
