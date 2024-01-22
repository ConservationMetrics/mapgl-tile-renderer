import fs from "fs";
import path from "path";
import sharp from "sharp";
import zlib from "zlib";
import maplibre from "@maplibre/maplibre-gl-native";
import MBTiles from "@mapbox/mbtiles";

import {
  calculateTileRangeForBounds,
  convertTilesToCoordinates,
} from "./tile_calculations.js";

const TILE_REGEXP = RegExp("mbtiles://([^/]+)/(\\d+)/(\\d+)/(\\d+)");
const MBTILES_REGEXP = /mbtiles:\/\/(\S+?)(?=[/"]+)/gi;

const isMBTilesURL = (url) => url.startsWith("mbtiles://");

// Split out mbtiles service name from the URL
const resolveNamefromURL = (url) => url.split("://")[1].split("/")[0];

// Resolve a URL of a local mbtiles file to a file path
// Expected to follow this format "mbtiles://<service_name>/*"
const resolveMBTilesURL = (tilePath, url) =>
  /*
   * @param {String} tilePath - path containing mbtiles files
   * @param {String} url - url of a data source in style.json file.
   */
  path.format({
    dir: tilePath,
    name: resolveNamefromURL(url),
    ext: ".mbtiles",
  });

// Given a URL to a local mbtiles file, get the TileJSON for that to load correct tiles.
const getLocalTileJSON = (tilePath, url, callback) => {
  /*
   * @param {String} tilePath - path containing mbtiles files.
   * @param {String} url - url of a data source in style.json file.
   * @param {function} callback - function to call with (err, {data}).
   */
  const mbtilesFilename = resolveMBTilesURL(tilePath, url);
  const service = resolveNamefromURL(url);

  new MBTiles(mbtilesFilename, (err, mbtiles) => {
    if (err) {
      callback(err);
      return null;
    }

    mbtiles.getInfo((infoErr, info) => {
      if (infoErr) {
        callback(infoErr);
        return null;
      }

      const { minzoom, maxzoom, center, bounds, format } = info;

      const ext = format === "pbf" ? ".pbf" : "";

      const tileJSON = {
        tilejson: "1.0.0",
        tiles: [`mbtiles://${service}/{z}/{x}/{y}${ext}`],
        minzoom,
        maxzoom,
        center,
        bounds,
      };

      callback(null, { data: Buffer.from(JSON.stringify(tileJSON)) });
      return null;
    });

    return null;
  });
};

// Fetch a tile from a local mbtiles file.
const getLocalTile = (tilePath, url, callback) => {
  /*
   * @param {String} tilePath - path containing mbtiles files.
   * @param {String} url - url of a data source in style.json file.
   * @param {function} callback - function to call with (err, {data}).
   */
  const matches = url.match(TILE_REGEXP);
  const [z, x, y] = matches.slice(matches.length - 3, matches.length);
  const isVector = path.extname(url) === ".pbf";
  const mbtilesFile = resolveMBTilesURL(tilePath, url);

  new MBTiles(mbtilesFile, (err, mbtiles) => {
    if (err) {
      callback(err);
      return null;
    }

    mbtiles.getTile(z, x, y, (tileErr, data) => {
      if (tileErr) {
        callback(null, {});
        return null;
      }

      if (isVector) {
        // if the tile is compressed, unzip it (for vector tiles only!)
        zlib.unzip(data, (unzipErr, unzippedData) => {
          callback(unzipErr, { data: unzippedData });
        });
      } else {
        callback(null, { data });
      }

      return null;
    });

    return null;
  });
};

// requestHandler constructs a request handler for the map to load resources.
const requestHandler =
  (tilePath) =>
  ({ url, kind }, callback) => {
    try {
      if (kind === 2 || kind === 3) {
        // source or tile
        if (isMBTilesURL(url)) {
          kind === 2
            ? getLocalTileJSON(tilePath, url, callback)
            : getLocalTile(tilePath, url, callback);
        } else {
          const msg = `Error: Only local mbtiles URLs are supported. Received: ${url}`;
          throw new Error(msg);
        }
      } else {
        const msg = `Error: Request kind not handled: ${kind}`;
        throw new Error(msg);
      }
    } catch (err) {
      const msg = `Error while making resource request to: ${url}\n${err}`;
      return callback(msg);
    }
  };

// Render the map, returning a Promise.
const renderMap = (map, options) => {
  return new Promise((resolve, reject) => {
    map.render(options, (err, buffer) => {
      if (err) {
        return reject(err);
      }
      return resolve(buffer);
    });
  });
};

// Render map tile for a given style, zoom level, and tile coordinates
const renderTile = async (style, tilePath, zoom, x, y) => {
  const tileSize = 512;

  // Calculate longitude and latitude from tile x, y, and zoom
  const nw = convertTilesToCoordinates(x, y, zoom);
  const se = convertTilesToCoordinates(x + 1, y + 1, zoom);

  // Normalize latitude to the Mercator projection
  // More about mercator tile normalization: https://maplibre.org/maplibre-native/docs/book/design/coordinate-system.html
  const mercatorNwY = Math.log(
    Math.tan(Math.PI / 4 + (nw.lat * Math.PI) / 360)
  );
  const mercatorSeY = Math.log(
    Math.tan(Math.PI / 4 + (se.lat * Math.PI) / 360)
  );
  const avgMercatorY = (mercatorNwY + mercatorSeY) / 2;
  const centerLat = (Math.atan(Math.exp(avgMercatorY)) * 360) / Math.PI - 90;

  // Longitude remains a simple average
  const centerLon = (nw.lon + se.lon) / 2;

  const center = [centerLon, centerLat];

  // Create a new MapLibre instance with specified size and other parameters
  // In MapLibre server-side rendering, methods like resize, setZoom, and setCenter are not available
  // Hence, we need to create a new map instance for each tile, load the style, set the zoom/center,
  // and release the map instance after rendering.
  // MapLibre native documentation: https://github.com/maplibre/maplibre-native/blob/main/platform/node/README.md
  const map = new maplibre.Map({
    request: requestHandler(tilePath),
    ratio: 1, // Pixel ratio
  });

  // Load the provided style
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
const generateMBTiles = async (
  style,
  tilePath,
  bounds,
  minZoom,
  maxZoom,
  output
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

  // Start writing to the MBTiles file
  mbtiles.startWriting((err) => {
    if (err) {
      throw err;
    } else {
      mbtiles.putInfo(
        {
          name: output,
          format: "jpg",
          minzoom: minZoom,
          maxzoom: maxZoom,
          type: "overlay",
        },
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
    const { minX, minY, maxX, maxY } = calculateTileRangeForBounds(
      bounds,
      zoom
    );

    // Iterate over tiles within the range
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        try {
          // Render the tile
          const tileBuffer = await renderTile(style, tilePath, zoom, x, y);

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

export const renderMBTiles = async (
  style,
  bounds,
  minZoom,
  maxZoom,
  tilePath,
  output
) => {
  console.log("Starting rendering...");

  const localMbtilesMatches = JSON.stringify(style).match(MBTILES_REGEXP);
  if (localMbtilesMatches && !tilePath) {
    const msg = "Style has local mbtiles file sources, but no tilePath is set";
    throw new Error(msg);
  }

  if (localMbtilesMatches) {
    localMbtilesMatches.forEach((name) => {
      const mbtileFilename = path.normalize(
        path.format({
          dir: tilePath,
          name: name.split("://")[1],
          ext: ".mbtiles",
        })
      );
      if (!fs.existsSync(mbtileFilename)) {
        const msg = `Mbtiles file ${path.format({
          name,
          ext: ".mbtiles",
        })} in style file is not found in: ${path.resolve(tilePath)}`;
        throw new Error(msg);
      }
    });
  }

  // Call generateMBTiles to create and fill the MBTiles file
  try {
    await generateMBTiles(style, tilePath, bounds, minZoom, maxZoom, output);
  } catch (error) {
    console.error("Error generating MBTiles:", error);
  }
};

export default renderMBTiles;
