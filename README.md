# mbgl-tile-renderer

This headless Node.js MapGL renderer can generate composite, styled raster tiles from a stylesheet and multiple tile sources. The map tiles are stored in mbtiles format.

It uses [Maplibre-GL Native](https://www.npmjs.com/package/@maplibre/maplibre-gl-native) to render tiles, [Sharp](https://www.npmjs.com/package/sharp) to save them as an image, and Mapbox's [mbtiles Node package](https://www.npmjs.com/package/@mapbox/mbtiles) to compile them into an mbtiles database.

This tool started as an extension of [mbgl-renderer](https://github.com/consbio/mbgl-renderer), which was built to export single static map images. Our thanks go out to the contributors of that project.

## Requirements

Node version: 18.17.0 or higher (Sharp requires this at minimum).

## CLI options

*  `-s` or `--style`: Map style (required)
*  `-b` or `--bounds`: Bounding box in WSEN format, comma separated (required)
*  `-z` or `--minzoom`: Minimum zoom level (0 if not provided)
*  `-Z` or `--maxzoom`: Maximum zoom level (required)
*  `-t` or `--tilepath`: Path where the input tiles are located (required)
*  `-o` or `--output`: Name of the output mbtiles file

## Example usage

```bash
$ node src/cli.js --style tests/fixtures/alert/style.json --bounds "-54.28772,3.11460,-54.03630,3.35025" -Z 14 --tilepath tests/fixtures/alert/tiles --output alert

$ node src/cli.js --style tests/fixtures/lofoten/style.json --bounds "12.46810,67.61450,15.43150,68.49630" -Z 12 --tilepath tests/fixtures/lofoten --output lofoten
```

These commands will use one of the styles and tilesets from the fixtures to generate an mbtiles file in the outputs directory. The alert output will show a vector polygon overlaid in transparent red over satellite imagery, as can be seen in the stylesheet.

## Inspect the mbtile outputs

Three easy ways to examine and inspect the mbtiles:

1. Upload them to a [Felt](https://felt.com) map.
2. Use the [mbview](https://github.com/mapbox/mbview) tool to view them in the browser.
3. Load them in [QGIS](https://qgis.org).
