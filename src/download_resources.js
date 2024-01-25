import fs from "fs";
import path from "path";
import axios from "axios";

import { convertCoordinatesToTiles } from "./tile_calculations.js";

// Download XYZ tile
const downloadOnlineXyzTile = async (xyzUrl, filename, apiKey) => {
  if (fs.existsSync(filename)) return false;

  const config = { responseType: "arraybuffer" };
  if (apiKey) {
    config.headers = { Authorization: `Bearer ${apiKey}` };
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

// Download XYZ tiles from a given source
const downloadOnlineTiles = async (
  source,
  apiKey,
  bounds,
  minZoom,
  maxZoom,
  tempDir,
) => {
  if (!bounds || bounds.length < 4) {
    console.error("Invalid bounds provided");
    return;
  }

  let imageryUrl, imageryAttribution;
  switch (source) {
    case "google":
      imageryUrl = `https://mt0.google.com/vt?lyrs=s&x={x}&y={y}&z={z}`;
      imageryAttribution = "© Google";
      break;
    case "esri":
      imageryUrl =
        "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      imageryAttribution = "© ESRI";
      break;
    case "bing":
      imageryUrl = "http://ecn.t3.tiles.virtualearth.net/tiles/a{q}.jpeg?g=1";
      imageryAttribution = "© Microsoft (Bing Maps)";
      break;
    default:
      console.error("Invalid source provided");
      return;
  }

  const xyzOutputDir = tempDir + "sources/";
  if (!fs.existsSync(xyzOutputDir)) {
    fs.mkdirSync(xyzOutputDir, { recursive: true });
  }

  console.log(
    `Downloading satellite imagery raster XYZ tiles from ${source.charAt(0).toUpperCase() + source.slice(1)}...`,
  );

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

    let tileCount = 0;

    for (let col = minX; col <= maxX; col++) {
      for (let row = minY; row <= maxY; row++) {
        let xyzUrl;
        if (source === "bing") {
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
          xyzUrl = imageryUrl.replace("{q}", quadkey);
        } else {
          xyzUrl = imageryUrl
            .replace("{z}", zoom)
            .replace("{x}", col)
            .replace("{y}", row);
        }

        const filename = path.join(
          xyzOutputDir,
          `${zoom}`,
          `${col}`,
          `${row}.jpg`,
        );
        if (!fs.existsSync(path.dirname(filename))) {
          fs.mkdirSync(path.dirname(filename), { recursive: true });
        }

        // Ideally, this could be done using Promise.all() to download
        // multiple tiles at once, but then we run into rate limiting
        // issues with the Bing Maps API (and likely others)
        const downloadSuccess = await downloadOnlineXyzTile(
          xyzUrl,
          filename,
          apiKey,
        );
        if (downloadSuccess) tileCount++;
      }
    }
    console.log(`Zoom level ${zoom} downloaded with ${tileCount} tiles`);
  }

  // Save metadata.json file with proper attribution according to
  // each source's terms of use
  const metadata = {
    name: `${source.charAt(0).toUpperCase() + source.slice(1)} Maps`,
    description: `Satellite imagery from ${source.charAt(0).toUpperCase() + source.slice(1)} Maps`,
    version: "1.0.0",
    attribution: imageryAttribution,
    format: "jpg",
    type: "overlay",
  };

  const metadataFilePath = path.join(xyzOutputDir, "metadata.json");
  fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 4));

  console.log(
    `Tiles successfully downloaded from ${source.charAt(0).toUpperCase() + source.slice(1)}!`,
  );
};

// Handler for requesting tiles from different online sources
export const requestOnlineTiles = (
  onlineSource,
  onlineSourceAPIKey,
  bounds,
  minZoom,
  maxZoom,
  tempDir,
) => {
  return new Promise(async (resolve, reject) => {
    try {
      await downloadOnlineTiles(
        onlineSource,
        onlineSourceAPIKey,
        bounds,
        minZoom,
        maxZoom,
        tempDir,
      );
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};
