import fs from "fs";
import path from "path";
import axios from "axios";
import sharp from "sharp";
import MBTiles from "@mapbox/mbtiles";

import {
  convertCoordinatesToTiles,
  calculateTileRangeForBounds,
} from "./tile_calculations.js";
import { renderTile } from "./render_map.js";

// Download XYZ tile
const downloadXyzTile = async (xyzUrl, filename, onlineSourceAPIKey) => {
  if (fs.existsSync(filename)) return false;

  const config = { responseType: "arraybuffer" };
  if (onlineSourceAPIKey) {
    config.headers = { Authorization: `Bearer ${onlineSourceAPIKey}` };
  }

  try {
    const response = await axios.get(xyzUrl, config);
    if (response.status === 200) {
      fs.writeFileSync(filename, response.data);
      return true; // Return true if download was successful
    } else {
      console.log(
        `Failed to download: ${xyzUrl} (Status code: ${response.status})`,
      );
      return false;
    }
  } catch (error) {
    console.error(`Error downloading tile: ${xyzUrl}`, error);
    return false;
  }
};

// Download satellite imagery tiles from Bing Maps
const downloadNaturalEarthTile = async (
  bounds,
  onlineSourceAPIKey,
  maxZoom,
  tempDir,
) => {
  if (!bounds || bounds.length < 4) {
    console.error("Invalid bounds provided");
    return;
  }

  const rasterImageryUrl =
    "http://ecn.t3.tiles.virtualearth.net/tiles/a{q}.jpeg?g=1";
  const rasterImageryAttribution = "© Microsoft (Bing Maps)";

  const xyzOutputDir = tempDir + "sources/";
  if (!fs.existsSync(xyzOutputDir)) {
    fs.mkdirSync(xyzOutputDir, { recursive: true });
  }

  console.log(
    "Downloading satellite imagery raster XYZ tiles from Bing VirtualEarth...",
  );

  // Iterate over zoom levels and tiles
  // Much of the below code is adapted from Microsoft's Bing Maps Tile System documentation:
  // https://learn.microsoft.com/en-us/bingmaps/articles/bing-maps-tile-system
  for (let zoom = 1; zoom <= maxZoom; zoom++) {
    let { x: minX, y: maxY } = convertCoordinatesToTiles(
      bounds[0],
      bounds[1],
      zoom,
    );
    let { x: maxX, y: minY } = convertCoordinatesToTiles(
      bounds[2],
      bounds[3],
      zoom,
    );

    let tileCount = 0;

    for (let col = minX; col <= maxX; col++) {
      for (let row = minY; row <= maxY; row++) {
        // Calculate quadkey
        let quadkey = "";
        for (let i = zoom; i > 0; i--) {
          let digit = 0;
          const mask = 1 << (i - 1);
          if ((col & mask) !== 0) digit += 1;
          if ((row & mask) !== 0) digit += 2;
          quadkey += digit.toString();
        }

        const xyzUrl = rasterImageryUrl.replace("{q}", quadkey);
        const filename = path.join(
          xyzOutputDir,
          `${zoom}`,
          `${col}`,
          `${row}.jpg`,
        );
        if (!fs.existsSync(path.dirname(filename))) {
          fs.mkdirSync(path.dirname(filename), { recursive: true });
        }
        // Ideally, this would be done using Promise.all() to download multiple tiles at once,
        // But then we run into rate limiting issues with the Bing Maps API
        // https://learn.microsoft.com/en-us/bingmaps/getting-started/bing-maps-api-best-practices
        const downloadSuccess = await downloadXyzTile(
          xyzUrl,
          filename,
          onlineSourceAPIKey,
        );
        if (downloadSuccess) tileCount++;
      }
    }
    console.log(`Zoom level ${zoom} downloaded with ${tileCount} tiles`);
  }

  // Save metadata.json file with proper attribution according to the Bing terms of use
  const metadata = {
    name: "Bing",
    description: "Satellite imagery from Bing maps",
    version: "1.0.0",
    attribution: rasterImageryAttribution,
    format: "jpg",
    type: "overlay",
  };

  const metadataFilePath = path.join(xyzOutputDir, "metadata.json");
  fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 4));
};

// Handler for downloading remote tiles from different sources
export const downloadRemoteTiles = (
  onlineSource,
  onlineSourceAPIKey,
  bounds,
  minZoom,
  maxZoom,
  tempDir,
) => {
  return new Promise(async (resolve, reject) => {
    try {
      switch (onlineSource) {
        case "bing":
          await downloadNaturalEarthTile(
            bounds,
            onlineSourceAPIKey,
            maxZoom,
            tempDir,
          );
          resolve();
          break;
        default:
          throw new Error("Invalid remote source");
      }
    } catch (error) {
      reject(error);
    }
  });
};

// Generate a Mapbox GL style JSON object from a remote source and an additional source.
export const generateStyle = (onlineSource, overlaySource) => {
  const style = {
    version: 8,
    sources: {
      [`${onlineSource}`]: {
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
        id: `${onlineSource}`,
        type: "raster",
        source: `${onlineSource}`,
        paint: {},
      },
    ],
  };
  // For now, we are styling an additional source with a
  // transparent red fill and red outline.
  if (overlaySource) {
    style.sources["overlay"] = {
      type: "geojson",
      data: `overlay.geojson`,
    };
    style.layers.push({
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
    style.layers.push({
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
  return style;
};

// Convert premultiplied image buffer from Mapbox GL to RGBA PNG format
export const generateJPG = async (buffer, width, height, ratio) => {
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

// Generate MBTiles file from a given style, bounds, and zoom range
export const generateMBTiles = async (
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
