import os from "os";
import path from "path";
import fs from "fs";
import dotenv from "dotenv-flow";

import { initiateRendering } from "../src/initiate.js";
import { generateStyle } from "../src/generate_resources.js";
import { downloadOnlineXyzTile } from "../src/download_resources.js";
import { validateMinMaxValues } from "../src/tile_calculations.js";
import { skipIf } from "./utils.js";

const tempDir = path.join(os.tmpdir());

// Load MAPBOX_API_TOKEN from .env.test
// Create this file if wanting to test Mapbox
dotenv.config();
const { MAPBOX_TOKEN, PLANET_TOKEN, PROTOMAPS_TOKEN } = process.env;

if (!MAPBOX_TOKEN) {
  console.warn(
    "MAPBOX_TOKEN environment variable is missing; tests that require this token will be skipped"
  );
}

if (!PLANET_TOKEN) {
  console.warn(
    "PLANET_TOKEN environment variable is missing; tests that require this token will be skipped"
  );
}

if (!PROTOMAPS_TOKEN) {
  console.warn(
    "PROTOMAPS_TOKEN environment variable is missing; tests that require this token will be skipped"
  );
}

const testMapbox = skipIf(!MAPBOX_TOKEN);
const testPlanet = skipIf(!PLANET_TOKEN);
const testProtomaps = skipIf(!PROTOMAPS_TOKEN);

// Mock p-limit because it's an ESM module that doesn't work well with jest
jest.mock("p-limit", () => () => async (fn) => {
  return fn();
});

test("Generates a MapGL style JSON object from Esri and overlay", async () => {
  let styleObject = generateStyle(
    "esri",
    '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"coordinates":[[[-78.52421524895288,37.84166911915864],[-78.52421524895288,37.42437630967217],[-78.05117693229629,37.42437630967217],[-78.05117693229629,37.84166911915864],[-78.52421524895288,37.84166911915864]]],"type":"Polygon"}}]}',
    256
  );

  const expectedStyleObject = {"version":8,"sources":{"esri":{"type":"raster","scheme":"xyz","tilejson":"2.2.0","tiles":["sources/{z}/{x}/{y}.jpg"],"tileSize":256},"overlay":{"type":"geojson","data":"overlay.geojson"}},"layers":[{"id":"background","type":"background","paint":{"background-color":"#f9f9f9"}},{"id":"esri","type":"raster","source":"esri","paint":{}},{"id":"polygon-layer","type":"fill","source":"overlay","source-layer":"output","filter":["==","$type","Polygon"],"paint":{"fill-color":"#FF0000","fill-opacity":0.5}},{"id":"line-layer","type":"line","source":"overlay","source-layer":"output","filter":["==","$type","LineString"],"paint":{"line-color":"#FF0000","line-width":2}}]};

  expect(styleObject).toEqual(expectedStyleObject);
});

test("Generates MBTiles from self-provided style with MBTiles and GeoJSON source", async () => {
  await initiateRendering(
    "self",
    "./tests/fixtures/alert/style-with-geojson.json",
    "./tests/fixtures/alert/sources",
    null,
    null,
    null,
    null,
    [-54.28772,3.11460,-54.03630,3.35025],
    0,
    5,
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Expect output.mbtiles to be 200704 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBe(200704);

  fs.unlinkSync(`${tempDir}/output.mbtiles`);
});

test("Generates MBTiles from self-provided style with XYZ dir source", async () => {
  await initiateRendering(
    "self",
    "./tests/fixtures/xyz/style.json",
    "./tests/fixtures/xyz/tiles",
    null,
    null,
    null,
    null,
    [12.7814,67.8263,14.5282,68.3551],
    0,
    5,
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Expect output.mbtiles to be 155648 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBe(155648);

  fs.unlinkSync(`${tempDir}/output.mbtiles`);
});

test("Generates MBTiles from Bing with overlay GeoJSON", async () => {
  await initiateRendering(
    "bing",
    null,
    null,
    null,
    null,
    null,
    '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"coordinates":[[[-78.52421524895288,37.84166911915864],[-78.52421524895288,37.42437630967217],[-78.05117693229629,37.42437630967217],[-78.05117693229629,37.84166911915864],[-78.52421524895288,37.84166911915864]]],"type":"Polygon"}}]}',
    [-79, 37, -77, 38],
    0,
    5,
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Expect output.mbtiles to be 233472 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBe(233472);

  fs.unlinkSync(`${tempDir}/output.mbtiles`);
});

testMapbox("Generates MBTiles from Mapbox Satellite", async () => {
  await initiateRendering(
    "mapbox-satellite",
    null,
    null,
    MAPBOX_TOKEN,
    null,
    null,
    null,
    [-79, 37, -77, 38],
    0,
    5,
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Expect output.mbtiles to be 221184 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBe(221184);

  fs.unlinkSync(`${tempDir}/output.mbtiles`);
});

test("Generates MBTiles from Esri", async () => {
  await initiateRendering(
    "esri",
    null,
    null,
    null,
    null,
    null,
    null,
    [-79, 37, -77, 38],
    0,
    5,
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Expect output.mbtiles to be 278528 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBe(278528);

  fs.unlinkSync(`${tempDir}/output.mbtiles`);
});

test("Generates MBTiles from Google", async () => {
  await initiateRendering(
    "google",
    null,
    null,
    null,
    null,
    null,
    null,
    [-79, 37, -77, 38],
    0,
    5,
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Expect output.mbtiles to be 241664 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBe(241664);

  fs.unlinkSync(`${tempDir}/output.mbtiles`);
});

testProtomaps("Generates MBTiles from Protomaps", async () => {
  await initiateRendering(
    "protomaps",
    null,
    null,
    PROTOMAPS_TOKEN,
    null,
    null,
    null,
    [-79, 37, -77, 38],
    0,
    5,
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Expect output.mbtiles to be 237568 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBe(237568);

  fs.unlinkSync(`${tempDir}/output.mbtiles`);
});

describe("downloadOnlineXyzTile tests", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // Set up a spy on console.error before each test
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore the original implementation of console.error after each test
    consoleErrorSpy.mockRestore();
  });

  testMapbox("Succeeds on valid Mapbox token", async () => {
    await downloadOnlineXyzTile(
      "mapbox",
      `https://api.mapbox.com/v4/mapbox.satellite/0/0/0.jpg?access_token=${MAPBOX_TOKEN}`,
      `${tempDir}/mapbox_satellite_0_0_0.jpg`,
      MAPBOX_TOKEN
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    fs.unlinkSync(`${tempDir}/mapbox_satellite_0_0_0.jpg`);
  });

  test("Fails on invalid Mapbox token", async () => {
    await downloadOnlineXyzTile(
      "mapbox",
      "https://api.mapbox.com/v4/mapbox.satellite/0/0/0.jpg?access_token=pk.ey",
      `${tempDir}/mapbox_satellite_0_0_0.jpg`,
      "pk.ey"
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error downloading tile")
    );
  });

  testPlanet("Succeeds on valid Planet token", async () => {
    await downloadOnlineXyzTile(
      "planet",
      `https://tiles.planet.com/basemaps/v1/planet-tiles/planet_medres_visual_2023-12_mosaic/gmap/0/0/0.jpg?api_key=${PLANET_TOKEN}`,
      `${tempDir}/planet_medres_visual_2023-12_mosaic_0_0_0.jpg`,
      PLANET_TOKEN
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    fs.unlinkSync(`${tempDir}/planet_medres_visual_2023-12_mosaic_0_0_0.jpg`);
  });

  test("Fails on invalid Planet token", async () => {
    await downloadOnlineXyzTile(
      "planet",
      "https://tiles.planet.com/basemaps/v1/planet-tiles/planet_medres_visual_2023-12_mosaic/gmap/0/0/0.jpg?api_key=pk.ey",
      `${tempDir}/planet_medres_visual_2023-12_mosaic_0_0_0.jpg`,
      "pk.ey"
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error downloading tile")
    );
  });
});

describe("validateMinMaxValues tests", () => {
  test("Throws error when one or more tile coordinates are NaN", () => {
    expect(() => validateMinMaxValues(NaN, 0, 0, 0)).toThrow("One or more tile coordinates are NaN");
    expect(() => validateMinMaxValues(0, NaN, 0, 0)).toThrow("One or more tile coordinates are NaN");
    expect(() => validateMinMaxValues(0, 0, NaN, 0)).toThrow("One or more tile coordinates are NaN");
    expect(() => validateMinMaxValues(0, 0, 0, NaN)).toThrow("One or more tile coordinates are NaN");
  });

  test("Throws error when minX is greater than maxX", () => {
    expect(() => validateMinMaxValues(5, 0, 4, 0)).toThrow("minX cannot be greater than maxX");
  });

  test("Throws error when minY is greater than maxY", () => {
    expect(() => validateMinMaxValues(0, 5, 0, 4)).toThrow("minY cannot be greater than maxY");
  });
});
