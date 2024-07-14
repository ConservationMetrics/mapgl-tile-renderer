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

// Render a thumbnail image for the style and bounds
export const renderThumbnail = async (
  styleObject,
  styleDir,
  sourceDir,
  bounds,
  ratio,
) => {
  // Here, we use a 1:2 aspect ratio for the thumbnail
  const width = 512;
  const height = width / 2;

  const center = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];

  // Add bounding box as a source to the styleObject
  styleObject.sources["bounding-box"] = {
    type: "geojson",
    data: {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [bounds[0], bounds[1]],
            [bounds[0], bounds[3]],
            [bounds[2], bounds[3]],
            [bounds[2], bounds[1]],
            [bounds[0], bounds[1]],
          ],
        ],
      },
    },
  };

  // Add bounding box style to the styleObject
  styleObject.layers.push({
    id: "bounding-box",
    type: "fill",
    source: "bounding-box",
    paint: {
      "fill-color": "#3BB2D0",
      "fill-opacity": 0.4,
    },
  });

  styleObject.layers.push({
    id: "bounding-box-border",
    type: "line",
    source: "bounding-box",
    paint: {
      "line-color": "#3BB2D0",
      "line-width": 2,
      "line-dasharray": [2, 2], // This creates a dotted line
    },
  });

  const map = new maplibre.Map({
    request: requestHandler(styleDir, sourceDir),
    ratio: ratio,
  });

  map.load(styleObject);

  const buffer = await renderMap(map, {
    zoom: 4, // Adjust zoom level as needed
    center: center,
    width: width,
    height: height,
  });

  map.release();

  const image = await generateImage(buffer, "jpg", width, height, ratio);

  return image;
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
    tiletype,
    tileSize,
    tileSize,
    ratio,
  );

  return image;
};
