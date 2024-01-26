import fs from "fs";
import path from "path";

import { generateStyle, generateMBTiles } from "./generate_resources.js";
import { requestOnlineTiles } from "./download_resources.js";

const MBTILES_REGEXP = /mbtiles:\/\/(\S+?)(?=[/"]+)/gi;

export const initiateRendering = async (
  styleProvided,
  styleObject,
  styleDir,
  sourceDir,
  onlineSource,
  onlineSourceAPIKey,
  mapboxStyle,
  overlaySource,
  bounds,
  minZoom,
  maxZoom,
  output,
) => {
  console.log("Initiating rendering...");

  let style = styleObject;
  let tempDir = null;

  // If no style is provided, let's generate everything that we need to render tiles.
  if (!styleProvided) {
    tempDir = "outputs/temp/";
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    // Download tiles from the online source
    await requestOnlineTiles(
      onlineSource,
      onlineSourceAPIKey,
      mapboxStyle,
      bounds,
      minZoom,
      maxZoom,
      tempDir,
    );

    // Save the overlay GeoJSON to a file, if provided
    if (overlaySource) {
      fs.writeFileSync(tempDir + "sources/overlay.geojson", overlaySource);
      console.log(`Overlay GeoJSON saved to file!`);
    }

    // Generate and save a stylesheet from the online source and overlay source.
    if (style === null) {
      if (!onlineSource) {
        const msg =
          "You must provide a online source if you are not providing your own style";
        throw new Error(msg);
      } else {
        style = generateStyle(onlineSource, overlaySource);
        fs.writeFileSync(
          tempDir + "style.json",
          JSON.stringify(style, null, 2),
        );
        console.log("Style file generated and saved!");
      }
    }

    sourceDir = tempDir + "sources/";
    styleDir = path.resolve(process.cwd(), tempDir);
  }

  const localMbtilesMatches = JSON.stringify(style).match(MBTILES_REGEXP);
  if (localMbtilesMatches && !sourceDir) {
    const msg = "Style has local mbtiles file sources, but no sourceDir is set";
    throw new Error(msg);
  }

  if (localMbtilesMatches) {
    localMbtilesMatches.forEach((name) => {
      const mbtileFilename = path.normalize(
        path.format({
          dir: sourceDir,
          name: name.split("://")[1],
          ext: ".mbtiles",
        }),
      );
      if (!fs.existsSync(mbtileFilename)) {
        const msg = `Mbtiles file ${path.format({
          name,
          ext: ".mbtiles",
        })} in style file is not found in: ${path.resolve(sourceDir)}`;
        throw new Error(msg);
      }
    });
  }

  try {
    await generateMBTiles(
      style,
      styleDir,
      sourceDir,
      bounds,
      minZoom,
      maxZoom,
      tempDir,
      output,
    );
  } catch (error) {
    console.error("Error generating MBTiles:", error);
  }
};

export default initiateRendering;
