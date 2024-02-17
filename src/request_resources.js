import fs from "fs";
import path from "path";
import zlib from "zlib";
import MBTiles from "@mapbox/mbtiles";
import { PMTiles, FetchSource } from "pmtiles";
import https from "https";

// Validations for source URLs
const MBTILES_REGEXP = RegExp("mbtiles://([^/]+)/(\\d+)/(\\d+)/(\\d+)");
const PMTILES_REGEXP = RegExp("pmtiles://([^/]+)(?:/)?.*/(\\d+)/(\\d+)/(\\d+)");
const HTTP_REGEX = RegExp("^http(s)?://");
const XYZ_REGEXP = /(\d+)\/(\d+)\/(\d+)\.(jpg|png|pbf|mvt)$/;
const isMBTilesURL = (url) => url.startsWith("mbtiles://");
const isPMTilesURL = (url) => url.startsWith("pmtiles://");
const isGeoJSONURL = (url) => url.endsWith(".geojson");
const isProtomapsTileJSONURL = (url) => url.endsWith("protomaps-tiles.json");
const isXYZDirURL = (url) => /\/?\d+\/\d+\/\d+(\.\w+)?$/.test(url);
const isOnlineURL = (url) => url.match(HTTP_REGEX);

// Split out mbtiles service name from the URL
const resolveNamefromURL = (url) => url.split("://")[1].split("/")[0];
const resolveNamefromPMtilesURL = (url) => url.split("pmtiles://")[1];

const PMtilesTypes = {
  0: "unknown",
  1: "pbf",
  2: "png",
  3: "jpeg",
  4: "webp",
  5: "avif",
};

// Resolve a URL of a local mbtiles file to a file path
// Expected to follow this format "mbtiles://<service_name>/*"
const resolvePMTilesURL = (sourceDir, url) => {
  /*
   * @param {String} sourceDir - path containing mbtiles files
   * @param {String} url - url of a data source in style.json file.
   */

  const pmtilesFile = resolveNamefromPMtilesURL(url);
  if (isOnlineURL(pmtilesFile)) {
    return pmtilesFile;
  } else {
    return path.format({
      dir: sourceDir,
      name: resolveNamefromURL(url),
      ext: ".pmtiles",
    });
  }
};

// Resolve a URL of a local mbtiles file to a file path
// Expected to follow this format "mbtiles://<service_name>/*"
const resolveMBTilesURL = (sourceDir, url) =>
  /*
   * @param {String} sourceDir - path containing mbtiles files
   * @param {String} url - url of a data source in style.json file.
   */
  path.format({
    dir: sourceDir,
    name: resolveNamefromURL(url),
    ext: ".mbtiles",
  });

// Given a URL to a local sprite image, get the image data.
const getLocalSpriteImage = (styleDir, url, callback) => {
  const spriteImagePath = path.join(styleDir, `${url}`);

  fs.readFile(spriteImagePath, (err, data) => {
    if (err) {
      callback(err);
      return null;
    }
    callback(null, data);
    return null;
  });
};

// Given a URL to a local sprite JSON, get the JSON data.
const getLocalSpriteJSON = (styleDir, url, callback) => {
  const spriteJsonPath = path.join(styleDir, `${url}`);

  // TODO: currently, any styles with sprites defined will
  // fail to render. The callback in this function does
  // correctly return a buffer of the sprite JSON, but
  // Maplibre just hangs when trying to render it.
  // No errors are thrown, and the process never exits.
  fs.readFile(spriteJsonPath, (err, data) => {
    if (err) {
      callback(err);
      return null;
    }
    callback(null, { data });
    return null;
  });
};

// Given a URL to an online data, get the data.
const getOnlineData = (url, callback) => {
  https
    .get(url, (res) => {
      let data = [];

      res.on("data", (chunk) => {
        data.push(chunk);
      });

      res.on("end", () => {
        callback(null, { data: Buffer.concat(data) });
      });
    })
    .on("error", (err) => {
      callback(err);
    });
};

// Given a URL to a local glyph, get the glyph data.
const getLocalGlyph = (styleDir, url, callback) => {
  const decodedUrl = decodeURIComponent(url);
  const glyphPath = path.join(styleDir, `${decodedUrl}`);

  fs.readFile(glyphPath, (err, data) => {
    if (err) {
      callback(err);
      return null;
    }
    callback(null, { data });
    return null;
  });
};

// Given a URL to a pmtiles file, get the TileJSON for that to load correct tiles.
const getPMTilesTileJSON = async (sourceDir, url, callback) => {
  /*
   * @param {String} sourceDir - path containing mbtiles files.
   * @param {String} url - url of a data source in style.json file.
   * @param {function} callback - function to call with (err, {data}).
   */
  const pmtilesFile = resolvePMTilesURL(sourceDir, url);
  const service = resolveNamefromPMtilesURL(url);

  let pmtiles = undefined;
  if (isOnlineURL(pmtilesFile)) {
    const source = new FetchSource(pmtilesFile);
    pmtiles = new PMTiles(source);
  } else {
    const fd = fs.openSync(pmtilesFile, "r");
    const source = new PMTilesFileSource(fd);
    pmtiles = new PMTiles(source);
  }

  const header = await pmtiles.getHeader();
  const metadata = await pmtiles.getMetadata();

  //Add missing metadata from header
  metadata["format"] = PMtilesTypes[header.tileType];
  metadata["minzoom"] = header.minZoom;
  metadata["maxzoom"] = header.maxZoom;

  if (header.minLon && header.minLat && header.maxLon && header.maxLat) {
    metadata["bounds"] = [
      header.minLon,
      header.minLat,
      header.maxLon,
      header.maxLat,
    ];
  } else {
    metadata["bounds"] = [-180, -85.05112877980659, 180, 85.0511287798066];
  }

  if (header.centerZoom) {
    metadata["center"] = [
      header.centerLon,
      header.centerLat,
      header.centerZoom,
    ];
  } else {
    metadata["center"] = [
      header.centerLon,
      header.centerLat,
      parseInt(metadata["maxzoom"]) / 2,
    ];
  }

  const { minzoom, maxzoom, center, bounds, format } = metadata;

  const ext = format === "pbf" ? ".pbf" : "";

  const tileJSON = {
    tilejson: "1.0.0",
    tiles: [`pmtiles://${service}/{z}/{x}/{y}${ext}`],
    minzoom,
    maxzoom,
    center,
    bounds,
  };

  callback(null, { data: Buffer.from(JSON.stringify(tileJSON)) });
  return null;
};

// Given a URL to a local mbtiles file, get the TileJSON for that to load correct tiles.
const getLocalMBTileJSON = (sourceDir, url, callback) => {
  /*
   * @param {String} sourceDir - path containing mbtiles files.
   * @param {String} url - url of a data source in style.json file.
   * @param {function} callback - function to call with (err, {data}).
   */
  const mbtilesFilename = resolveMBTilesURL(sourceDir, url);
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

// Fetch a tile from a pmtiles file.
const getPMTiles = async (sourceDir, url, callback) => {
  /*
   * @param {String} sourceDir - path containing pmtiles files.
   * @param {String} url - url of a data source in style.json file.
   * @param {function} callback - function to call with (err, {data}).
   */
  const matches = url.match(PMTILES_REGEXP);
  const [z, x, y] = matches.slice(matches.length - 3, matches.length);
  const parts = url.split("/");
  parts.splice(-3);
  const pmtilesFile = resolvePMTilesURL(sourceDir, parts.join("/"));

  let pmtiles = undefined;
  if (isOnlineURL(pmtilesFile)) {
    const source = new FetchSource(pmtilesFile);
    pmtiles = new PMTiles(source);
  } else {
    const fd = fs.openSync(pmtilesFile, "r");
    const source = new PMTilesFileSource(fd);
    pmtiles = new PMTiles(source);
  }

  let zxyTile = await pmtiles.getZxy(z, x, y);
  if (zxyTile && zxyTile.data) {
    const data = Buffer.from(zxyTile.data);
    callback(null, { data });
  } else {
    callback(null, {});
    return null;
  }
};

// Fetch a tile from a local mbtiles file.
const getLocalMBTile = (sourceDir, url, callback) => {
  /*
   * @param {String} sourceDir - path containing mbtiles files.
   * @param {String} url - url of a data source in style.json file.
   * @param {function} callback - function to call with (err, {data}).
   */
  const matches = url.match(MBTILES_REGEXP);
  const [z, x, y] = matches.slice(matches.length - 3, matches.length);
  const isVector = path.extname(url) === ".pbf";
  const mbtilesFile = resolveMBTilesURL(sourceDir, url);

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

// Fetch a tile from a local XYZ directory.
const getLocalXYZTile = (sourceDir, url, callback) => {
  /*
   * @param {String} sourceDir - path containing XYZ tiles.
   * @param {String} url - url of a data source in style.json file.
   * @param {function} callback - function to call with (err, {data}).
   */
  const matches = url.match(XYZ_REGEXP);
  if (!matches) {
    callback(new Error("Invalid URL format"));
    return;
  }
  const [, z, x, y, ext] = matches;
  const xyzDir = path.normalize(
    path.format({
      dir: sourceDir,
      name: url.split("://")[1],
    }),
  );

  const tilePath = path.join(xyzDir, z, x, `${y}.${ext}`);

  fs.readFile(tilePath, (err, data) => {
    if (err) {
      callback(null, {});
      return;
    }
    callback(null, { data });
  });
};

// Given a URL to a local GeoJSON file, get the GeoJSON for that to load correct tiles.
const getLocalGeoJSON = (sourceDir, url, callback) => {
  /*
   * @param {String} geojsonPath - path containing GeoJSON files.
   * @param {String} url - url of a data source in style.json file.
   * @param {function} callback - function to call with (err, {data}).
   */
  const geojsonFilename = path.normalize(
    path.format({
      dir: sourceDir,
      name: url,
    }),
  );

  fs.readFile(geojsonFilename, (err, data) => {
    if (err) {
      callback(err);
      return null;
    }
    callback(null, { data });
    return null;
  });
};

// Given a URL to a local Protomaps TileJSON file, get the TileJSON for that to load correct tiles.
const getLocalProtomapsTileJSON = (url, callback) => {
  /*
   * @param {String} url - url of a data source in style.json file.
   * @param {function} callback - function to call with (err, {data}).
   */
  fs.readFile(url, (err, data) => {
    if (err) {
      callback(err);
      return null;
    }
    callback(null, { data });
    return null;
  });
};

// requestHandler constructs a request handler for the map to load resources.
// More about request types (kinds) in MapLibre: https://github.com/maplibre/maplibre-native/blob/main/platform/node/README.md
export const requestHandler =
  (styleDir, sourceDir) =>
  ({ url, kind }, callback) => {
    try {
      switch (kind) {
        case 2: {
          // source
          if (isMBTilesURL(url)) {
            getLocalMBTileJSON(sourceDir, url, callback);
          } else if (isPMTilesURL(url)) {
            getPMTilesTileJSON(sourceDir, url, callback);
          } else if (isXYZDirURL(url)) {
            getLocalXYZTile(sourceDir, url, callback);
          } else if (isGeoJSONURL(url)) {
            getLocalGeoJSON(sourceDir, url, callback);
          } else if (isProtomapsTileJSONURL(url)) {
            getLocalProtomapsTileJSON(url, callback);
          } else {
            const msg = `Only local sources are currently supported. Received: ${url}`;
            throw new Error(msg);
          }
          break;
        }
        case 3: {
          // tile
          if (isMBTilesURL(url)) {
            getLocalMBTile(sourceDir, url, callback);
          } else if (isPMTilesURL(url)) {
            getPMTiles(sourceDir, url, callback);
          } else if (isXYZDirURL(url)) {
            getLocalXYZTile(sourceDir, url, callback);
          } else if (isGeoJSONURL(url)) {
            getLocalGeoJSON(sourceDir, url, callback);
          } else {
            const msg = `Only local tiles are currently supported. Received: ${url}`;
            throw new Error(msg);
          }
          break;
        }
        case 4: {
          // glyph
          if (isOnlineURL(url)) {
            getOnlineData(url, callback);
          } else {
            getLocalGlyph(styleDir, url, callback);
          }
          break;
        }
        case 5: {
          // sprite image
          if (isOnlineURL(url)) {
            getOnlineData(url, callback);
          } else {
            getLocalSpriteImage(styleDir, url, callback);
          }
          break;
        }
        case 6: {
          // sprite json
          if (isOnlineURL(url)) {
            getOnlineData(url, callback);
          } else {
            getLocalSpriteJSON(styleDir, url, callback);
          }
          break;
        }
        default: {
          const msg = `Request kind not handled: ${kind}`;
          throw new Error(msg);
        }
      }
    } catch (err) {
      const msg = `Error while making resource request to: ${url}\n${err}`;
      callback(msg);
    }
  };

// pmtiles class to allow reading from a local file
class PMTilesFileSource {
  constructor(fd) {
    this.fd = fd;
  }
  getKey() {
    return this.fd;
  }
  async getBytes(offset, length) {
    const buffer = Buffer.alloc(length);
    await readFileBytes(this.fd, buffer, offset);
    const ab = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );
    return { data: ab };
  }
}

// reads specified bytes from a file
async function readFileBytes(fd, buffer, offset) {
  return new Promise((resolve, reject) => {
    fs.read(fd, buffer, 0, buffer.length, offset, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}
