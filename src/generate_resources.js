import fs from "fs";
import path from "path";
import sharp from "sharp";
import MBTiles from "@mapbox/mbtiles";

import { calculateTileRangeForBounds } from "./tile_calculations.js";
import { renderTile } from "./render_map.js";

// Generate a Mapbox GL style JSON object from a remote source
// and an additional source.
export const generateStyle = (style, overlay) => {
  const styleObject = {
    version: 8,
    sources: {
      [`${style}`]: {
        type: "raster",
        scheme: "xyz",
        tilejson: "2.2.0",
        tiles: [`sources/{z}/{x}/{y}.jpg`],
        tileSize: 256,
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
        id: `${style}`,
        type: "raster",
        source: `${style}`,
        paint: {},
      },
    ],
  };
  // For now, we are styling an additional source with a
  // transparent red fill and red outline.
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
        console.log("MBTiles file generation completed!");
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
