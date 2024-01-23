import fs from "fs";
import path from "path";
import sharp from "sharp";
import maplibre from "@maplibre/maplibre-gl-native";
import MBTiles from "@mapbox/mbtiles";

import { calculateTileRangeForBounds, calculateNormalizedCenterCoords } from "./tile_calculations.js";
import { requestHandler } from "./request_resources.js";

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
const renderTile = async (style, sourceDir, styleDir, zoom, x, y) => {
  const tileSize = 512;

  const center = calculateNormalizedCenterCoords(x, y, zoom);

  // Create a new MapLibre instance with specified size and other parameters
  // In MapLibre server-side rendering, methods like resize, setZoom, and setCenter are not available
  // Hence, we need to create a new map instance for each tile, load the style, set the zoom/center,
  // and release the map instance after rendering.
  // MapLibre native documentation: https://github.com/maplibre/maplibre-native/blob/main/platform/node/README.md
  const map = new maplibre.Map({
    request: requestHandler(sourceDir, styleDir),
    ratio: 1,
  });

  map.load(style);

  // Render the map to a buffer
  const buffer = await renderMap(map, { zoom: zoom, center: center, height: tileSize, width: tileSize });

  // Clean up the map instance to free resources
  map.release();

  const jpeg = await generateJPG(buffer, tileSize, tileSize, 1);

  return jpeg;
};

// Construct MBTiles file from a given style, bounds, and zoom range
const generateMBTiles = async (style, sourceDir, styleDir, bounds, minZoom, maxZoom, output) => {
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

  // Start writing to the MBTiles file
  mbtiles.startWriting((err) => {
    if (err) {
      throw err;
    } else {
      mbtiles.putInfo(
        { name: output, format: "jpg", minzoom: minZoom, maxzoom: maxZoom, type: "overlay" },
        (err) => {
          if (err) throw err;
        }
      );
    }
  });

  // Iterate over zoom levels
  for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
    console.log(`Rendering zoom level ${zoom}...`);
    // Calculate tile range for this zoom level based on bounds
    const { minX, minY, maxX, maxY } = calculateTileRangeForBounds(bounds, zoom);

    // Iterate over tiles within the range
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        try {
          // Render the tile
          const tileBuffer = await renderTile(style, sourceDir, styleDir, zoom, x, y);

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
  mbtiles.stopWriting((err) => {
    if (err) throw err;
    console.log("MBTiles file generation completed.");
  });
};

// Convert premultiplied image buffer from Mapbox GL to RGBA PNG format
const generateJPG = async (buffer, width, height, ratio) => {
  // Un-premultiply pixel values
  // Mapbox GL buffer contains premultiplied values, which are not handled correctly by sharp
  // https://github.com/mapbox/mapbox-gl-native/issues/9124
  // since we are dealing with 8-bit RGBA values, normalize alpha onto 0-255 scale and divide
  // it out of RGB values

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

export const renderMBTiles = async (style, bounds, minZoom, maxZoom, sourceDir, styleDir, output) => {
  console.log("Starting rendering...");

  const localMbtilesMatches = JSON.stringify(style).match(MBTILES_REGEXP);
  if (localMbtilesMatches && !sourceDir) {
    const msg = "Style has local mbtiles file sources, but no tilePath is set";
    throw new Error(msg);
  }

  if (localMbtilesMatches) {
    localMbtilesMatches.forEach((name) => {
      const mbtileFilename = path.normalize(
        path.format({
          dir: sourceDir,
          name: name.split("://")[1],
          ext: ".mbtiles",
        })
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
    await generateMBTiles(style, sourceDir, styleDir, bounds, minZoom, maxZoom, output);
  } catch (error) {
    console.error("Error generating MBTiles:", error);
  }
};

export default renderMBTiles;
