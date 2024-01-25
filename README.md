# mbgl-tile-renderer

This headless Node.js MapGL renderer can generate either composite, styled raster tiles from a self-provided stylesheet and multiple tile sources, or raster tiles from an online source with an optional overlay. The map tiles are stored in mbtiles format.

It uses [Maplibre-GL Native](https://www.npmjs.com/package/@maplibre/maplibre-gl-native) to render tiles, [Sharp](https://www.npmjs.com/package/sharp) to save them as an image, and Mapbox's [mbtiles Node package](https://www.npmjs.com/package/@mapbox/mbtiles) to compile them into an mbtiles database.

This tool started as an extension of [mbgl-renderer](https://github.com/consbio/mbgl-renderer), which was built to export single static map images. Our thanks go out to the contributors of that project.

## Requirements

Node version: 18.17.0. 

(Sharp requires 18.17.0 at minimum, and MapLibre Native is [currently only supported on stable releases of Node](https://github.com/maplibre/maplibre-native/issues/1058), 18 being the latest)

## CLI options

* `-s` or `--style`: Are you providing your own style? If not, one will be generated using your sources. ("yes" or "no" answers only)

Options if `style` is "yes":

*  `-l` or `--stylelocation`: Location of your provided map style (required) 
*  `-i` or `--stylesources`: Directory where any local source files (GeoJSON, XYZ directory, MBTiles) specified in your provided style are located (required)

Required options if `style` is "no":
*  `-O` or `--onlinesource`: Specify an online source to be used as a background map (currently supported: "bing", "esri", "google") (required)
*  `-a` or `--overlay`: Provide an GeoJSON object for a feature layer to overlay on top of the online source (required)
*  `-k` or `--apikey`: API key that may be required for your online source
  
Additional options:
*  `-b` or `--bounds`: Bounding box in WSEN format, comma separated (required)
*  `-z` or `--minzoom`: Minimum zoom level (0 if not provided)
*  `-Z` or `--maxzoom`: Maximum zoom level (required)
*  `-o` or `--output`: Name of the output mbtiles file

## Example usage

Using a self-provided style:

```bash
$ node src/cli.js --style "yes" --stylelocation tests/fixtures/alert/style-with-geojson.json --bounds "-54.28772,3.11460,-54.03630,3.35025" -Z 13 --stylesources tests/fixtures/alert/sources
```

From an online source:

```bash
$ node src/cli.js --style "no" --bounds "-54.28772,3.11460,-54.03630,3.35025" -Z 13 --remotesource "bing" --apikey YOUR_API_KEY_HERE
```

Online source with GeoJSON overlay:

```bash
$ node src/cli.js --style "no" --bounds "-54.28772,3.11460,-54.03630,3.35025" -Z 13 --remotesource "bing" --apikey YOUR_API_KEY_HERE --overlay '{"type": "FeatureCollection", "name": "alert", "features": [{"geometry": {"coordinates": [[[-54.25348208981326, 3.140689896338671], [-54.25348208981326, 3.140600064810259], [-54.253841415926914, 3.140600064810259], [-54.25348208981326, 3.140689896338671]]], "geodesic": false, "type": "Polygon"}, "id": "-603946+34961", "properties": {"month_detec": "09", "year_detec": "2023"}, "type": "Feature"}]}'
```

## Inspect the mbtile outputs

Three easy ways to examine and inspect the mbtiles:

1. Upload them to a [Felt](https://felt.com) map.
2. Use the [mbview](https://github.com/mapbox/mbview) tool to view them in the browser.
3. Load them in [QGIS](https://qgis.org).

## Licensing for online API sources

This tool makes it possible to download tiles from various API sources for offline usage. Here are links to the licensing and API limitations for each source:

1. Bing Satellite: API [Terms of Use](https://www.microsoft.com/en-us/maps/bing-maps/product) and information on [accessing Bing Maps tiles](https://learn.microsoft.com/en-us/bingmaps/rest-services/directly-accessing-the-bing-maps-tiles)
2. Esri World Imagery (for Export): [Terms of use](https://www.arcgis.com/home/item.html?id=226d23f076da478bba4589e7eae95952)
3. Google Hybrid: API [Terms of Use](https://developers.google.com/maps/documentation/tile/policies)
