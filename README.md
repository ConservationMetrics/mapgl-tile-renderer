# mbgl-tile-renderer

This headless Node.js MapGL renderer generates styled raster tiles in an MBTiles format. It can work with a self-provided stylesheet and tile sources, or an online source with an optional overlay. 

It uses [Maplibre-GL Native](https://www.npmjs.com/package/@maplibre/maplibre-gl-native) to render tiles, [Sharp](https://www.npmjs.com/package/sharp) to save them as an image, and Mapbox's [mbtiles Node package](https://www.npmjs.com/package/@mapbox/mbtiles) to compile them into an mbtiles database.

The intention of this tool is to create offline background maps for use in mobile data collection applications such as [Mapeo](https://mapeo.app/), [ODK Collect](https://getodk.org/), and [KoboToolbox Collect](https://www.kobotoolbox.org/).

This tool started as an extension of [mbgl-renderer](https://github.com/consbio/mbgl-renderer), which was built to export single static map images. Our thanks go out to the contributors of that project.

## Requirements

Node version: 18.17.0 to 20.x.x. 

(Sharp requires 18.17.0 at minimum, and MapLibre Native is [currently only supported on stable releases of Node](https://github.com/maplibre/maplibre-native/issues/1058), 20 being the latest)

## Supported online sources

* Bing Imagery (Virtual Earth)
* ESRI World Imagery
* Google Hybrid
* Mapbox - your own style
* Mapbox Satellite
* Planet PlanetScope monthly visual basemap (via NICFI)

To use these services, you are responsible for providing an API token as needed. You may also consult the terms of service and API limitations for each service below.

Please note that depending on your bounding box and maximum zoom level, this tool has the capability to send a lot of requests. You should first use a tool like the [Mapbox offline tile count estimator](https://docs.mapbox.com/playground/offline-estimator/) to ensure that your request will be reasonable, and in the case of any sources with an API limit, won't end up costing you.

## CLI options

* `-s` or `--style`: Are you providing your own style? If not, one will be generated using your sources. ("yes" or "no" answers only)

Required options if `style` is "yes":

*  `-l` or `--stylelocation`: Location of your provided map style
*  `-i` or `--stylesources`: Directory where any local source files (GeoJSON, XYZ directory, MBTiles) specified in your provided style are located

Required options if `style` is "no":
*  `-O` or `--onlinesource`: Specify an online source to be used as a background map (currently supported: "bing", "esri", "google", "mapbox", "mapbox-satellite", "planet-monthly-visual")
*  `-a` or `--overlay`: Provide an GeoJSON object for a feature layer to overlay on top of the online source
*  `-k` or `--apikey`: API key that may be required for your online source
If you selected "mapbox" for `--onlinesource`:
*  `-m` or `--mapboxstyle`: The Mapbox style you want to use. Format: `<yourusername>/<styleid>`

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

From an online source (Bing):

```bash
$ node src/cli.js --style "no" --bounds "-54.28772,3.11460,-54.03630,3.35025" -Z 13 --remotesource "bing" --apikey YOUR_API_KEY_HERE
```

From an online source (Mapbox):

```bash
$ node src/cli.js --style "no" --bounds "-54.28772,3.11460,-54.03630,3.35025" -Z 13 --remotesource "mapbox" --mapboxstyle YOUR_USERNAME/YOUR_MAPBOX_STYLE_ID --apikey YOUR_API_KEY_HERE
```

From an online source (Planet):

```bash
$ node src/cli.js --style "no" --bounds "-54.28772,3.11460,-54.03630,3.35025" -Z 13 --remotesource "planet-monthly-visual" --monthyear 2023-12 --apikey YOUR_API_KEY_HERE
```

Online source (Esri) with GeoJSON overlay:

```bash
$ node src/cli.js --style "no" --bounds "-54.28772,3.11460,-54.03630,3.35025" -Z 13 --remotesource "esri" --apikey YOUR_API_KEY_HERE --overlay '{"type": "FeatureCollection", "name": "alert", "features": [{"geometry": {"coordinates": [[[-54.25348208981326, 3.140689896338671], [-54.25348208981326, 3.140600064810259], [-54.253841415926914, 3.140600064810259], [-54.25348208981326, 3.140689896338671]]], "geodesic": false, "type": "Polygon"}, "id": "-603946+34961", "properties": {"month_detec": "09", "year_detec": "2023"}, "type": "Feature"}]}'
```

### With Docker

To run with Docker simply run:
```bash
docker run -it --rm -v "$(pwd)":/app/outputs communityfirst/mbgl-tile-renderer --style "no" --bounds "-54.28772,3.11460,-54.03630,3.35025" -Z 13 --onlinesource "mapbox-style" --mapboxstyle YOUR_USERNAME/YOUR_MAPBOX_STYLE_ID --apikey YOUR_API_KEY_HERE

```
This automatically pulls the latest image from Docker hub. The `docker run` command is used to execute the mbgl-tile-renderer tool with a set of options that define how the map tiles will be rendered and saved. Here's a breakdown of the command and its variables:

- `-it`: This option ensures that the Docker container runs in interactive mode, allowing you to interact with the command-line interface.
- `--rm`: This option automatically removes the container when it exits, which helps to clean up and save disk space.
- `-v "$(pwd)":/app/outputs`: This mounts the current working directory (`$(pwd)`) to the `/app/outputs` directory inside the container, allowing the container to write the output files to your local file system.
- `communityfirst/mbgl-tile-renderer`: This is the name of the Docker image that contains the mbgl-tile-renderer tool.
Make sure to replace the placeholder values with your actual information before running the command.


To run locally first build the Docker image:

```bash
docker build -t mbgl-tile-renderer .
```

Then run:

```
docker run -it --rm -v "$(pwd)":/app/outputs mbgl-tile-renderer --style "no" --bounds "-54.28772,3.11460,-54.03630,3.35025" -Z 13 --onlinesource "mapbox-style" --mapboxstyle YOUR_USERNAME/YOUR_MAPBOX_STYLE_ID --apikey YOUR_API_KEY_HERE
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
4. Mapbox: Raster Tiles API [Pricing](https://www-mapbox.webflow.io/pricing#tile)
5. Planet Basemaps API [Overview](https://developers.planet.com/docs/basemaps/tile-services/)
