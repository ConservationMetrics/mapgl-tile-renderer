import fs from "fs";
import path from "path";
import zlib from "zlib";
import MBTiles from "@mapbox/mbtiles";

// Validations for source URLs
const TILE_REGEXP = RegExp("mbtiles://([^/]+)/(\\d+)/(\\d+)/(\\d+)");
const XYZ_REGEXP = /(\d+)\/(\d+)\/(\d+)\.(jpg|png|pbf)$/;
const isMBTilesURL = (url) => url.startsWith("mbtiles://");
const isGeoJSONURL = (url) => url.endsWith(".geojson");
const isXYZDirURL = (url) => /\/\d+\/\d+\/\d+/.test(url);

// Split out mbtiles service name from the URL
const resolveNamefromURL = (url) => url.split("://")[1].split("/")[0];

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
// TODO: currently, any styles with sprites defined will
// fail to render. The callback in this function does
// correctly return a buffer of the sprite JSON, but
// Maplibre just hangs when trying to render it.
// No errors are thrown, and the process never exits.
const getLocalSpriteJSON = (styleDir, url, callback) => {
  const spriteJsonPath = path.join(styleDir, `${url}`);
  
  fs.readFile(spriteJsonPath, (err, data) => {
    if (err) {
      callback(err);
      return null;
    }
    callback(null, { data });
    return null;
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

// Fetch a tile from a local mbtiles file.
const getLocalMBTile = (sourceDir, url, callback) => {
  /*
   * @param {String} sourceDir - path containing mbtiles files.
   * @param {String} url - url of a data source in style.json file.
   * @param {function} callback - function to call with (err, {data}).
   */
  const matches = url.match(TILE_REGEXP);
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
    callback(new Error('Invalid URL format'));
    return;
  }
  const [ , z, x, y, ext] = matches;
  const xyzDir = path.normalize(
    path.format({
      dir: sourceDir,
      name: url.split("://")[1],
    })
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
      name: url
    })
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

// requestHandler constructs a request handler for the map to load resources.
// More about request types (kinds): https://github.com/maplibre/maplibre-native/blob/main/platform/node/README.md
export const requestHandler = (sourceDir, styleDir) => ({ url, kind }, callback) => {
    try {
      switch (kind) {
        case 2: {
          // source
          if (isMBTilesURL(url)) {
              getLocalMBTileJSON(sourceDir, url, callback);
          } else if (isXYZDirURL(url)) {
              getLocalXYZTile(sourceDir, url, callback);
          } else if (isGeoJSONURL(url)) {
              getLocalGeoJSON(sourceDir, url, callback);
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
          getLocalGlyph(styleDir, url, callback);
          break;
        }
        case 5: {
          // sprite image
          getLocalSpriteImage(styleDir, url, callback);
          break;
        }
        case 6: {
          // sprite json
          getLocalSpriteJSON(styleDir, url, callback);
          break;
        }
        default: {
            const msg = `Request kind not handled: ${kind}`;
            throw new Error(msg);
        }
      }
    } catch (err) {
      const msg = `Error while making resource request to: ${url}\n${err}`;
      return callback(msg);
    }
  };
