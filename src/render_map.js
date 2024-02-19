import maplibre from "@maplibre/maplibre-gl-native";

import { calculateNormalizedCenterCoords } from "./tile_calculations.js";
import { requestHandler } from "./request_resources.js";
import { generateImage } from "./generate_resources.js";

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
export const renderTile = async (
  styleObject,
  styleDir,
  sourceDir,
  ratio,
  tiletype,
  zoom,
  x,
  y,
) => {
  const tileSize = 512;

  const center = calculateNormalizedCenterCoords(x, y, zoom);

  // Create a new MapLibre instance with specified size and other parameters
  // In MapLibre server-side rendering, methods like resize, setZoom, and setCenter are not available
  // Hence, we need to create a new map instance for each tile, load the style, set the zoom/center,
  // and release the map instance after rendering.
  // MapLibre native documentation: https://github.com/maplibre/maplibre-native/blob/main/platform/node/README.md
  const map = new maplibre.Map({
    request: requestHandler(styleDir, sourceDir),
    ratio: ratio,
    mode: "tile",
  });

  map.load(styleObject);

  // Render the map to a buffer
  const buffer = await renderMap(map, {
    zoom: zoom,
    center: center,
    height: tileSize,
    width: tileSize,
  });

  // Clean up the map instance to free resources
  map.release();

  const image = await generateImage(
    buffer,
    tileSize,
    tileSize,
    ratio,
    tiletype,
  );

  return image;
};
