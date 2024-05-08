import fs from "fs";
import path from "path";
import axios from "axios";
import pLimit from "p-limit";
import osmtogeojson from "osmtogeojson";

import {
  convertCoordinatesToTiles,
  validateMinMaxValues,
} from "./tile_calculations.js";

// Download XYZ tile
export const downloadOnlineXyzTile = async (
  style,
  xyzUrl,
  filename,
  apiKey,
) => {
  const config = { responseType: "arraybuffer" };

  if (style === "planet") {
    // Use HTTP Basic Authentication for Planet API
    config.auth = {
      username: apiKey,
      password: "", // Password should be empty, per documentation https://developers.planet.com/docs/basemaps/tile-services/
    };
  } else if (apiKey) {
    // For other sources, use Bearer token if apiKey is provided
    config.headers = { Authorization: `Bearer ${apiKey}` };
  }

  try {
    const response = await axios.get(xyzUrl, config);
    if (response.status === 200) {
      fs.writeFileSync(filename, response.data);
      return true;
    }
    throw new Error(
      `Failed to download: ${xyzUrl} (Status code: ${response.status})`,
    );
  } catch (error) {
    console.error(`Error downloading tile: ${xyzUrl}\x1b[0m`);
    console.error(error);
    return false;
  }
};

// Download XYZ tiles from a given source
const downloadOnlineTiles = async (
  style,
  apiKey,
  mapboxStyle,
  monthYear,
  bounds,
  minZoom,
  maxZoom,
  outputFilename,
  tempDir,
) => {
  if (!bounds || bounds.length < 4) {
    throw new Error("Invalid bounds provided");
  }

  let sourceUrl, sourceAttribution, sourceName, sourceFormat;

  switch (style) {
    case "google":
      sourceUrl = `https://mt0.google.com/vt?lyrs=s&x={x}&y={y}&z={z}`;
      sourceAttribution = "© Google";
      sourceName = "Google Hybrid";
      sourceFormat = "jpg";
      break;
    case "esri":
      sourceUrl =
        "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      sourceAttribution = "© ESRI";
      sourceName = "ESRI World Imagery";
      sourceFormat = "jpg";
      break;
    case "bing":
      sourceUrl = "http://ecn.t3.tiles.virtualearth.net/tiles/a{q}.jpeg?g=1";
      sourceAttribution = "© Microsoft (Bing Maps)";
      sourceName = "Bing Maps Satellite";
      sourceFormat = "jpg";
      break;
    case "mapbox":
      sourceUrl = `https://api.mapbox.com/styles/v1/${mapboxStyle}/tiles/{z}/{x}/{y}?access_token=${apiKey}`;
      sourceAttribution = "© Mapbox";
      sourceName = "Mapbox Custom Style";
      sourceFormat = "jpg";
      break;
    case "mapbox-satellite":
      sourceUrl = `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg?access_token=${apiKey}`;
      sourceAttribution = "© Mapbox";
      sourceName = "Mapbox Satellite";
      sourceFormat = "jpg";
      break;
    case "planet":
      sourceUrl = `https://tiles.planet.com/basemaps/v1/planet-tiles/planet_medres_visual_${monthYear}_mosaic/gmap/{z}/{x}/{y}?api_key=${apiKey}`;
      sourceAttribution = "© Planet Labs";
      sourceName = `Planet Planetscope Monthly Visual Basemap, ${monthYear} (made available through NICFI)`;
      sourceFormat = "jpg";
      break;
    case "protomaps":
      sourceUrl = `https://api.protomaps.com/tiles/v3/{z}/{x}/{y}.mvt?key=${apiKey}`;
      sourceAttribution = "Protomaps";
      sourceName = "Protomaps © OpenStreetMap";
      sourceFormat = "mvt";
      break;
    default:
      throw new Error("Invalid source provided");
  }

  const xyzOutputDir = `${tempDir}/sources`;
  if (!fs.existsSync(xyzOutputDir)) {
    fs.mkdirSync(xyzOutputDir, { recursive: true });
  }

  console.log(`Downloading XYZ tiles from ${sourceName}...`);

  const limit = pLimit(5);

  let totalTileCount = 0;

  // Iterate over zoom levels and tiles
  for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
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

    validateMinMaxValues(minX, minY, maxX, maxY);

    let tileCount = 0;

    let promises = [];

    for (let col = minX; col <= maxX; col++) {
      for (let row = minY; row <= maxY; row++) {
        let xyzUrl;
        if (style === "bing") {
          // Adapted from Microsoft's Bing Maps Tile System documentation:
          // https://learn.microsoft.com/en-us/bingmaps/articles/bing-maps-tile-system
          // Calculate quadkey for Bing
          let quadkey = "";
          // Treat zoom 0 as 1, since Bing doesn't support zoom 0
          if (zoom === 0) zoom = 1;
          for (let i = zoom; i > 0; i--) {
            let digit = 0;
            const mask = 1 << (i - 1);
            if ((col & mask) !== 0) digit += 1;
            if ((row & mask) !== 0) digit += 2;
            quadkey += digit.toString();
          }
          xyzUrl = sourceUrl.replace("{q}", quadkey);
        } else {
          xyzUrl = sourceUrl
            .replace("{z}", zoom)
            .replace("{x}", col)
            .replace("{y}", row);
        }

        const filename = path.join(
          xyzOutputDir,
          `${zoom}`,
          `${col}`,
          `${row}.${sourceFormat}`,
        );

        if (!fs.existsSync(filename)) {
          if (!fs.existsSync(path.dirname(filename))) {
            fs.mkdirSync(path.dirname(filename), { recursive: true });
          }
        } else {
          totalTileCount++;
          console.log(`File already exists: ${filename}`);
          continue;
        }

        promises.push(
          limit(() => downloadOnlineXyzTile(style, xyzUrl, filename, apiKey)),
        );
      }
    }
    const results = await Promise.all(promises);

    tileCount = results.filter((result) => result).length;
    totalTileCount += tileCount;

    // There may be edge cases in which no tiles are downloaded for a specific zoom level
    // For example, if the tile already exists in the temp dir from a previous download
    // attempt, or if we encounter rate limiting, or if one of the APIs does not return tiles
    // for a specific zoom level for some unforeseen reason. We might still want to continue
    // generating an MBTiles in that case, so we log a warning instead of throwing an exception.
    if (tileCount === 0) {
      console.warn(`\x1b[33mNo tiles downloaded for zoom level ${zoom}\x1b[0m`);
    } else {
      console.log(`Zoom level ${zoom} downloaded with ${tileCount} tiles`);
    }
  }

  // We definitely do *not* want to proceed if no tiles were downloaded at all.
  if (totalTileCount === 0) {
    throw new Error("No tiles downloaded");
  } else {
    console.log(`Total tiles downloaded: ${totalTileCount}`);
  }

  // Save metadata.json file with proper attribution according to
  // each source's terms of use
  const metadata = {
    name: `${outputFilename} - ${sourceName}`,
    description: `XYZ tiles from ${sourceName}`,
    version: "1.0.0",
    attribution: sourceAttribution,
    format: sourceFormat,
    type: "overlay",
  };

  // Save Protomaps tiles.json
  if (style === "protomaps") {
    const tileJsonUrl = "https://api.protomaps.com/tiles/v3.json?key=" + apiKey;

    let tilesJson;
    try {
      const response = await axios.get(tileJsonUrl);
      if (response.status === 200) {
        tilesJson = response.data;
        tilesJson.tiles = [`{z}/{x}/{y}.mvt`];
      } else {
        throw new Error(
          `Failed to download tiles.json: ${tileJsonUrl} (Status code: ${response.status})`,
        );
      }
    } catch (error) {
      throw new Error(`Error downloading tiles.json: ${tileJsonUrl}`);
    }

    const tilesJsonFilePath = path.join(xyzOutputDir, "protomaps-tiles.json");

    try {
      fs.writeFileSync(tilesJsonFilePath, JSON.stringify(tilesJson, null, 4));
      console.log("protomaps-tiles.json file generated!");
    } catch (error) {
      throw new Error(`Error writing tiles.json file: ${tilesJsonFilePath}`);
    }
  }

  const metadataFilePath = path.join(xyzOutputDir, "metadata.json");

  try {
    fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 4));
    console.log("Metadata file generated!");
  } catch (error) {
    throw new Error(`Error writing metadata file: ${metadataFilePath}`);
  }

  console.log(
    `\x1b[32mXYZ tiles successfully downloaded from ${sourceName}!\x1b[0m`,
  );
};

// Handler for requesting tiles from different online sources
export const requestOnlineTiles = (
  style,
  apiKey,
  mapboxStyle,
  monthYear,
  bounds,
  minZoom,
  maxZoom,
  outputFilename,
  tempDir,
) => {
  return new Promise(async (resolve, reject) => {
    try {
      await downloadOnlineTiles(
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
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

// Handler for requesting OSM data from Overpass API and converting it to GeoJSON
export const requestOpenStreetMapData = async (bounds, tempDir) => {
  const overpassUrl = `https://overpass-api.de/api/map?bbox=${bounds.join(
    ",",
  )}`;

  const outputDir = `${tempDir}/sources`;
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Downloading OpenStreetMap data from Overpass API...`);

  const osmFile = `${outputDir}/data.osm`;

  if (!fs.existsSync(osmFile)) {
    try {
      const response = await axios.get(overpassUrl);
      if (response.status === 200) {
        fs.writeFileSync(osmFile, response.data);
      } else {
        throw new Error(
          `Failed to download OpenStreetMap data: ${overpassUrl} (Status code: ${response.status})`,
        );
      }
    } catch (error) {
      throw new Error(`Error downloading OpenStreetMap data: ${overpassUrl}`);
    }
  } else {
    console.log(`OpenStreetMap data already exists: ${osmFile}`);
  }

  console.log(`OpenStreetMap data downloaded!`);

  // Convert OSM XML data to OSM JSON using parse_osmxml
  const parse_osmxml = (await import("osmtogeojson/parse_osmxml.js")).default;
  const osmData = fs.readFileSync(`${outputDir}/data.osm`, "utf-8");

  // Use the parser's method to parse the XML string
  parse_osmxml.parseFromString(osmData);
  const osmJson = parse_osmxml.getJSON();

  // Convert OSM JSON to GeoJSON
  const geojson = osmtogeojson(osmJson);

  // Filter out lines and points only
  geojson.features = geojson.features.filter(
    (feature) =>
      feature.geometry.type === "LineString" ||
      feature.geometry.type === "Point",
  );

  fs.writeFileSync(
    `${outputDir}/openstreetmap.geojson`,
    JSON.stringify(geojson, null, 4),
  );
  console.log(
    `\x1b[32mOpenStreetMap data successfully downloaded and converted to GeoJSON!\x1b[0m`,
  );
};
