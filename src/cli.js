#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { program } from"commander";
import packageJson from '../package.json' assert { type: 'json' };

import { renderMBTiles } from './render.js';

const parseListToFloat = (text) => text.split(',').map(Number)

program
  .version(packageJson.version)
  .name("mbgl-tile-render")
  .requiredOption("-s, --style <type>", "Location of your map style (required)")
  .requiredOption("-b, --bounds <type>", "Bounding box in WSEN format, comma separated (required)", parseListToFloat)
  .option("-z, --minzoom <number>", "Minimum zoom level (default 0)", parseInt, 0)
  .requiredOption("-Z, --maxzoom <number>", "Maximum zoom level (required)", parseInt)
  .requiredOption("-i, --input <type>", "Input directory where any source files are located")
  .option("-o, --output <type>", "Output name (default 'output')", "output")

program.parse(process.argv);

const options = program.opts();

const styleFilename = options.style;
const bounds = options.bounds;
const minZoom = options.minzoom;
const maxZoom = options.maxzoom;
const sourceDir = options.input;
const outputName = options.output;

if (minZoom !== null && (minZoom < 0 || minZoom > 22)) {
    raiseError(`minZoom level is outside supported range (0-22): ${minZoom}`)
}

if (maxZoom !== null && (maxZoom < 0 || maxZoom > 22)) {
    raiseError(`maxZoom level is outside supported range (0-22): ${maxZoom}`)
}

if (bounds !== null) {
    if (bounds.length !== 4) {
        raiseError(
            `Bounds must be west,south,east,north.  Invalid value found: ${[
                ...bounds,
            ]}`
        )
    }

    bounds.forEach((b) => {
        if (!Number.isFinite(b)) {
            raiseError(
                `Bounds must be valid floating point values.  Invalid value found: ${[
                    ...bounds,
                ]}`
            )
        }
        return null
    })

    const [west, south, east, north] = bounds
    if (west === east) {
        raiseError('Bounds west and east coordinate are the same value')
    }
    if (south === north) {
        raiseError('Bounds south and north coordinate are the same value')
    }
}

console.log('\n\n-------- Creating Maplibre GL map tiles --------')
console.log('style: %j', styleFilename)
console.log('bounds: %j', bounds)
console.log('minZoom: %j', minZoom)
console.log('maxZoom: %j', maxZoom)
console.log('source path: %j', sourceDir)
console.log('output: %j', outputName)
console.log('------------------------------------------------')

const stylePath = path.resolve(process.cwd(), styleFilename)
const styleDir = path.dirname(stylePath)
const style = JSON.parse(fs.readFileSync(stylePath, 'utf-8'))

renderMBTiles(style, bounds, minZoom, maxZoom, sourceDir, styleDir, outputName)
