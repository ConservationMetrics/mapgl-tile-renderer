import os from "os";
import path from "path";
import fs from "fs";
import dotenv from "dotenv-flow";

import { initiateRendering } from "../src/initiate.js";
import { downloadOnlineXyzTile } from "../src/download_resources.js";
import { skipIf } from "./utils.js";

const emptyStyle = "./tests/fixtures/example-style-empty.json";
// TODO: add and implement more styles from mbgl-renderer

const fixtures = "./tests/fixtures";
const output = "output";

const tempDir = path.join(os.tmpdir());

// Load MAPBOX_API_TOKEN from .env.test
// Create this file if wanting to test Mapbox
dotenv.config();
const { MAPBOX_API_TOKEN } = process.env;

if (!MAPBOX_API_TOKEN) {
  console.warn(
    "MAPBOX_API_TOKEN environment variable is missing; tests that require this token will be skipped"
  );
}

const testMapbox = skipIf(!MAPBOX_API_TOKEN);

// Mock p-limit because it's an ESM module that doesn't work well with jest
jest.mock("p-limit", () => () => async (fn) => {
  return fn();
});

// Silence console logs during tests; can be useful to uncomment for debugging
beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
  console.log.mockRestore();
});

test("Generates MBTiles from empty self-provided style", async () => {
  await initiateRendering(
    "self",
    emptyStyle,
    fixtures,
    null,
    null,
    null,
    null,
    [-54, 3, -53, 4],
    0,
    5,
    tempDir,
    output
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Expect output.mbtiles to be 69632 bytes
  const stats = fs.statSync(`${tempDir}/${output}.mbtiles`);
  expect(stats.size).toBe(69632);

  fs.unlinkSync(`${tempDir}/${output}.mbtiles`);
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
      `https://api.mapbox.com/v4/mapbox.satellite/0/0/0.jpg?access_token=${MAPBOX_API_TOKEN}`,
      `${tempDir}/mapbox_satellite_0_0_0.jpg`,
      MAPBOX_API_TOKEN
    );
    fs.unlinkSync(`${tempDir}/mapbox_satellite_0_0_0.jpg`);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test("Fails on invalid Mapbox token", async () => {
    await downloadOnlineXyzTile(
      "mapbox",
      "https://api.mapbox.com/v4/mapbox.satellite/0/0/0.jpg?access_token=pk.ey",
      `${tempDir}/mapbox_satellite_notoken_0_0_0.jpg`,
      "pk.ey"
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error downloading tile")
    );
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
