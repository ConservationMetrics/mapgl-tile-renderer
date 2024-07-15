import os from "os";
import path from "path";
import fs from "fs";
import dotenv from "dotenv-flow";
import axios from "axios";

import { initiateRendering } from "../src/initiate.js";
import { generateStyle } from "../src/generate_resources.js";
import {
  downloadOnlineXyzTile,
  requestOpenStreetMapData,
} from "../src/download_resources.js";
import { validateMinMaxValues } from "../src/tile_calculations.js";
import { skipIf } from "./utils.js";

const tempDir = path.join(os.tmpdir());

// Load MAPBOX_API_TOKEN from .env.test
// Create this file if wanting to test Mapbox
dotenv.config();
const { MAPBOX_TOKEN, PLANET_TOKEN, PROTOMAPS_TOKEN, STADIA_TOKEN, THUNDERFOREST_TOKEN } = process.env;

const tokens = {
  MAPBOX_TOKEN,
  PLANET_TOKEN,
  PROTOMAPS_TOKEN,
  STADIA_TOKEN,
  THUNDERFOREST_TOKEN
};

Object.entries(tokens).forEach(([key, value]) => {
  if (!value) {
    console.warn(`${key} environment variable is missing; tests that require this token will be skipped`);
  }
});

const testMapbox = skipIf(!MAPBOX_TOKEN);
const testPlanet = skipIf(!PLANET_TOKEN);
const testProtomaps = skipIf(!PROTOMAPS_TOKEN);
const testStadia = skipIf(!STADIA_TOKEN);
const testThunderforest = skipIf(!THUNDERFOREST_TOKEN);

// Mock p-limit because it's an ESM module that doesn't work well with jest
jest.mock("p-limit", () => () => async (fn) => {
  return fn();
});

test("Generates a MapGL style JSON object from Esri and overlay", async () => {
  let styleObject = generateStyle(
    "esri",
    '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"coordinates":[[[-78.52421524895288,37.84166911915864],[-78.52421524895288,37.42437630967217],[-78.05117693229629,37.42437630967217],[-78.05117693229629,37.84166911915864],[-78.52421524895288,37.84166911915864]]],"type":"Polygon"}}]}',
    null,
    256,
    null
  );

  const expectedStyleObject = {
    version: 8,
    sources: {
      esri: {
        type: "raster",
        scheme: "xyz",
        tilejson: "2.2.0",
        tiles: ["sources/{z}/{x}/{y}.jpg"],
        tileSize: 256,
      },
      overlay: { type: "geojson", data: "overlay.geojson" },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#f9f9f9" },
      },
      { id: "esri", type: "raster", source: "esri", paint: {} },
      {
        id: "polygon-layer",
        type: "fill",
        source: "overlay",
        "source-layer": "output",
        filter: ["==", "$type", "Polygon"],
        paint: { "fill-color": "#FF0000", "fill-opacity": 0.5 },
      },
      {
        id: "line-layer",
        type: "line",
        source: "overlay",
        "source-layer": "output",
        filter: ["==", "$type", "LineString"],
        paint: { "line-color": "#FF0000", "line-width": 2 },
      },
    ],
  };

  expect(styleObject).toEqual(expectedStyleObject);
});

test("Generates MBTiles and thumbnail from self-provided style with MBTiles and GeoJSON source", async () => {
  await initiateRendering(
    "self",
    "./tests/fixtures/alert/style-with-geojson.json",
    "./tests/fixtures/alert/sources",
    null,
    null,
    null,
    null,
    null,
    [-54.28772, 3.1146, -54.0363, 3.35025],
    0,
    5,
    1,
    "jpg",
    tempDir,
    "output",
    true
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Expect output.mbtiles to be greater than 69632 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBeGreaterThan(69632)

  // Expect output-thumbnail.jpg to exist
  expect(fs.existsSync(`${tempDir}/output-thumbnail.jpg`)).toBe(true);

  fs.unlinkSync(`${tempDir}/output.mbtiles`);
  fs.unlinkSync(`${tempDir}/output-thumbnail.jpg`);
});

test("Generates MBTiles from self-provided style with MBTiles source that uses font glyphs", async () => {
  await initiateRendering(
    "self",
    "./tests/fixtures/alert/style-with-tiles-fonts.json",
    "./tests/fixtures/alert/sources",
    null,
    null,
    null,
    null,
    null,
    [-54.28772, 3.1146, -54.0363, 3.35025],
    0,
    5,
    1,
    "jpg",
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Expect output.mbtiles to be greater than 69632 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBeGreaterThan(69632)

  fs.unlinkSync(`${tempDir}/output.mbtiles`);
});

test("Generates MBTiles from self-provided style with PMTiles source that uses font glyphs", async () => {
  await initiateRendering(
    "self",
    "./tests/fixtures/alert/style-with-pmtiles-fonts.json",
    "./tests/fixtures/alert/sources",
    null,
    null,
    null,
    null,
    null,
    [-54.28772, 3.1146, -54.0363, 3.35025],
    0,
    5,
    1,
    "jpg",
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Expect output.mbtiles to be greater than 69632 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBeGreaterThan(69632)

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
    null,
    [12.7814, 67.8263, 14.5282, 68.3551],
    0,
    5,
    1,
    "jpg",
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Expect output.mbtiles to be greater than 69632 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBeGreaterThan(69632)

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
    null,
    '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"coordinates":[[[-78.52421524895288,37.84166911915864],[-78.52421524895288,37.42437630967217],[-78.05117693229629,37.42437630967217],[-78.05117693229629,37.84166911915864],[-78.52421524895288,37.84166911915864]]],"type":"Polygon"}}]}',
    [-79, 37, -77, 38],
    0,
    5,
    1,
    "jpg",
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Expect output.mbtiles to be greater than 69632 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBeGreaterThan(69632)

  fs.unlinkSync(`${tempDir}/output.mbtiles`);
});

test("Generates MBTiles from Bing with OpenStreetMap overlay", async () => {
  await initiateRendering(
    "bing",
    null,
    null,
    null,
    null,
    null,
    true,
    null,
    [-54.9528992176,4.651819884,-54.9391663074,4.6655074239],
    0,
    5,
    1,
    "jpg",
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Expect output.mbtiles to be greater than 69632 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBeGreaterThan(69632);

  fs.unlinkSync(`${tempDir}/output.mbtiles`);
}, 10000);

testMapbox("Generates MBTiles from Mapbox Satellite", async () => {
  await initiateRendering(
    "mapbox-satellite",
    null,
    null,
    MAPBOX_TOKEN,
    null,
    null,
    null,
    null,
    [-79, 37, -77, 38],
    0,
    5,
    1,
    "jpg",
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Expect output.mbtiles to be greater than 69632 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBeGreaterThan(69632)

  fs.unlinkSync(`${tempDir}/output.mbtiles`);
});

testStadia("Generates MBTiles from Stadia (Stamen Terrain style)", async () => {
  await initiateRendering(
    "stadia-stamen-terrain",
    null,
    null,
    STADIA_TOKEN,
    null,
    null,
    null,
    null,
    [-79, 37, -77, 38],
    0,
    5,
    1,
    "jpg",
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Expect output.mbtiles to be greater than 69632 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBeGreaterThan(69632)

  fs.unlinkSync(`${tempDir}/output.mbtiles`);
});

testThunderforest("Generates MBTiles from Thunderforest (Landscape style)", async () => {
  await initiateRendering(
    "thunderforest-landscape",
    null,
    null,
    THUNDERFOREST_TOKEN,
    null,
    null,
    null,
    null,
    [-79, 37, -77, 38],
    0,
    5,
    1,
    "jpg",
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Expect output.mbtiles to be greater than 69632 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBeGreaterThan(69632)

  fs.unlinkSync(`${tempDir}/output.mbtiles`);
}, 10000); // Thunderforest API is slow

test("Generates MBTiles from Esri", async () => {
  await initiateRendering(
    "esri",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    [-79, 37, -77, 38],
    0,
    5,
    1,
    "jpg",
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Expect output.mbtiles to be greater than 69632 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBeGreaterThan(69632)

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
    null,
    [-79, 37, -77, 38],
    0,
    5,
    1,
    "jpg",
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Expect output.mbtiles to be greater than 69632 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBeGreaterThan(69632)

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
    null,
    [-79, 37, -77, 38],
    0,
    5,
    1,
    "jpg",
    tempDir,
    "output"
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Expect output.mbtiles to be greater than 69632 bytes
  const stats = fs.statSync(`${tempDir}/output.mbtiles`);
  expect(stats.size).toBeGreaterThan(69632)

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

describe("requestOpenStreetMapData tests", () => {
  const tempDir = path.join(os.tmpdir(), "test");
  const bounds = [-79, 37, -77, 38];
  const overpassUrl = `https://overpass-api.de/api/map?bbox=${bounds.join(",")}`;

  beforeEach(() => {
    // Setup: Create temporary directory for testing
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Mock successful response from axios with fake OSM data
    const fakeOsmData = `
      <osm>
        <node id='1' lat='37.84166911915864' lon='-78.52421524895288' />
        <node id='2' lat='37.42437630967217' lon='-78.52421524895288' />
        <node id='3' lat='37.42437630967217' lon='-78.05117693229629' />
        <node id='4' lat='37.84166911915864' lon='-78.05117693229629' />
        <way id='5'>
          <nd ref='1' />
          <nd ref='2' />
          <nd ref='3' />
          <nd ref='4' />
          <tag k='name' v='Test' />
        </way>
      </osm>
    `;
    jest.spyOn(axios, 'get').mockResolvedValue({ status: 200, data: fakeOsmData });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });

    jest.clearAllMocks();
  });

  test("Successfully downloads and converts OpenStreetMap data to GeoJSON", async () => {
    await requestOpenStreetMapData(bounds, tempDir);

    // Check if axios.get was called with the correct URL
    expect(axios.get).toHaveBeenCalledWith(overpassUrl);

    // Check if the OSM data file was created
    const osmFile = path.join(tempDir, "sources", "data.osm");
    expect(fs.existsSync(osmFile)).toBe(true);

    // Check if the GeoJSON file was created
    const geojsonFile = path.join(tempDir, "sources", "openstreetmap.geojson");
    expect(fs.existsSync(geojsonFile)).toBe(true);
  });
});

describe("validateMinMaxValues tests", () => {
  test("Throws error when one or more tile coordinates are NaN", () => {
    expect(() => validateMinMaxValues(NaN, 0, 0, 0)).toThrow(
      "One or more tile coordinates are NaN"
    );
    expect(() => validateMinMaxValues(0, NaN, 0, 0)).toThrow(
      "One or more tile coordinates are NaN"
    );
    expect(() => validateMinMaxValues(0, 0, NaN, 0)).toThrow(
      "One or more tile coordinates are NaN"
    );
    expect(() => validateMinMaxValues(0, 0, 0, NaN)).toThrow(
      "One or more tile coordinates are NaN"
    );
  });

  test("Throws error when minX is greater than maxX", () => {
    expect(() => validateMinMaxValues(5, 0, 4, 0)).toThrow(
      "minX cannot be greater than maxX"
    );
  });

  test("Throws error when minY is greater than maxY", () => {
    expect(() => validateMinMaxValues(0, 5, 0, 4)).toThrow(
      "minY cannot be greater than maxY"
    );
  });
});
