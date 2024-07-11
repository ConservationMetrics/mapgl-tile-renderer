# mapgl-tile-renderer

[![Publish to DockerHub](https://github.com/ConservationMetrics/mapgl-tile-renderer/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/ConservationMetrics/mapgl-tile-renderer/actions/workflows/docker-publish.yml)

This headless Node.js MapGL renderer can be used to generate styled raster tiles in an MBTiles format. It can work with self-provided tilesets and a stylesheet, or an online API source with optional GeoJSON and OpenStreetMap data overlays. 

The motivation to build this utility is to create offline background maps for use in mobile data collection applications, such as [Mapeo](https://mapeo.app/), [ODK Collect](https://getodk.org/), [Kobo Collect](https://www.kobotoolbox.org/), [Locus Map](https://www.locusmap.app/) or other offline-compatible tools that can work with self-hosted tiles like [Terrastories](https://terrastories.app/). However, it can be helpful for any use case where having self-hosted raster MBTiles is a requirement.

This tool started as an extension of [mbgl-renderer](https://github.com/consbio/mbgl-renderer), which was built to export single static map images. Our thanks go out to the contributors of that project.

# Usage

This tool can be used in the following ways:

1. Via CLI (npm, Node.js or Docker)
2. Using a [Github template](https://github.com/digidem/map-template) to generate tiles using a `manifest.json`.
3. As a task worker service to poll a queue for new requests, and update a database table with the render results. 
    * Currently supported: Azure Storage Queue and PostgreSQL. 
    * The tool may be extended with RabbitMQ for self-hosting in the future.

## Supported online API sources

> ❗️ To use these services, you are responsible for providing your own API token, and abiding by the service's terms of use. In doing so, please carefully consult the terms of service and API limitations for each service.

* Bing Imagery (Virtual Earth) - [Terms of Use](https://www.microsoft.com/en-us/maps/bing-maps/product)
* ESRI World Imagery - [Terms of use](https://www.arcgis.com/home/item.html?id=226d23f076da478bba4589e7eae95952)
* Google Hybrid - [Terms of Use](https://developers.google.com/maps/documentation/tile/policies)
* Mapbox - [Terms of Use](https://www-mapbox.webflow.io/pricing#tile)
* Overpass (to overlay OpenStreetMap data on top of imagery sources) - [Terms of Use](https://wiki.openstreetmap.org/wiki/Overpass_API)
* Planet PlanetScope monthly visual basemap (via NICFI) - [Terms of Use](https://developers.planet.com/docs/basemaps/tile-services/)
* Protomaps - [Terms of Use](https://protomaps.com/faq)
* Stadia Maps - [Terms of Use](https://docs.stadiamaps.com/limits/)
* Thunderforest - [Terms of use](https://www.thunderforest.com/terms/)

Please see the CLI options below for information on how to leverage these API sources. 

If you would like to request the addition of an online API source that is not currently supported, please [file an issue](https://github.com/ConservationMetrics/mapgl-tile-renderer/issues) or submit a PR.

Note that depending on your bounding box and maximum zoom level, this tool has the capability to send a lot of requests. You can use a utility like the [Mapbox offline tile count estimator](https://docs.mapbox.com/playground/offline-estimator/) to ensure that your request will be reasonable, and in the case of any API sources with a freemium API limit, won't end up costing you.

## Install via npm

To install the tool using npm, run:

```bash
$ npm install -g mapgl-tile-renderer
```


## CLI options

* `-s` or `--style`: Specify the style source. Use "self" for a self-provided style or one of the following for an online source: "bing", "esri", "google", "mapbox", "mapbox-satellite", "planet", "protomaps", "stadia-alidade-satellite", "stadia-stamen-terrain", "thunderforest-landscape"

If using a self-provided style (`--style self`):
* `--stylelocation`: Location of your provided map style
* `--stylesources`: Directory where any local source files (GeoJSON, XYZ directory, MBTiles) specified in your provided style are located

If using an online style (`--style` with any online style name):
* `-a` or `--overlay`: (Optional) Provide a GeoJSON object for a feature layer to overlay on top of the online source
* `-k` or `--apikey`: (Optional) API key that may be required for your online source

If using any of the imagery online styles without labels ("bing", "esri", "google", "mapbox-satellite", or "planet"):
* `-O` or `--openstreetmap`: (Optional) Overlay OSM vector data on top of your imagery. Currently mapped: hydrology, roads, and points of interest (with labels). This is a boolean variable; set to "true" if you want to use this.

If your style is `mapbox`:
* `-m` or `--mapboxstyle` in the format `<yourusername>/<styleid>`

If your style is `planet`:
* `-p` or `--monthyear`: The month and year (in YYYY-MM format) of the Planet Monthly Visual Basemap to use

Common options:
* `-b` or `--bounds`: Bounding box in WSEN format, comma separated (required)
* `-Z` or `--maxzoom`: Maximum zoom level (required)
* `-z` or `--minzoom`: Minimum zoom level (optional, 0 if not provided)
* `-r` or `--ratio`: Output pixel ratio (optional, 1 if not provided)
* `-t` or `--tiletype`: Output tile type (jpg, png, or webp) (optional, jpg if not provided)
* `-o` or `--outputdir`: Output directory (optional, "outputs/" if not provided)
* `-f` or `--filename`: Name of the output MBTiles file (optional, "output" if not provided)

## CLI example usage

Using a self-provided style:

```bash
mapgl-tile-renderer --style self --stylelocation tests/fixtures/alert/style-with-geojson.json --stylesources tests/fixtures/alert/sources --bounds "-79,37,-77,38" -Z 8
```

From an online source (Bing), with OpenStreetMap data overlaid:

```bash
mapgl-tile-renderer --style bing --bounds "-79,37,-77,38" --openstreetmap true -Z 8 --apikey YOUR_API_KEY_HERE
```

From an online source (Mapbox):

```bash
mapgl-tile-renderer --style mapbox --mapboxstyle YOUR_USERNAME/YOUR_MAPBOX_STYLE_ID --apikey YOUR_API_KEY_HERE --bounds "-79,37,-77,38" -Z 8
```

From an online source (Planet):

```bash
mapgl-tile-renderer --style planet --monthyear 2013-12 --apikey YOUR_API_KEY_HERE --bounds "-54,3,-53,4" -Z 8

```

Online source (Esri) with GeoJSON overlay:

```bash
mapgl-tile-renderer --style esri --apikey YOUR_API_KEY_HERE --bounds "-54,3,-53,4" -Z 8 --overlay '{"type": "FeatureCollection", "features": [{"geometry": {"coordinates": [[[-54.25348208981326, 3.140689896338671], [-54.25348208981326, 3.140600064810259], [-54.253841415926914, 3.140600064810259], [-54.25348208981326, 3.140689896338671]]], "geodesic": false, "type": "Polygon"}, "id": "-603946+34961", "properties": {"month": "09", "year": "2023"}, "type": "Feature"}]}'
```

## Docker

To run the tool with Docker,  run:

```bash
docker run -it --rm -v "$(pwd)":/app/outputs communityfirst/mapgl-tile-renderer --style "mapbox" --bounds "-79,37,-77,38" -Z 8 --mapboxstyle YOUR_USERNAME/YOUR_MAPBOX_STYLE_ID --apikey YOUR_API_KEY_HERE
```

This automatically pulls the latest image from Docker hub. The `docker run` command is used to execute the mapgl-tile-renderer tool with a set of options that define how the map tiles will be rendered and saved. Here's a breakdown of the command and its variables:

- `-it`: This option ensures that the Docker container runs in interactive mode, allowing you to interact with the command-line interface.
- `--rm`: This option automatically removes the container when it exits, which helps to clean up and save disk space.
- `-v "$(pwd)":/app/outputs`: This mounts the current working directory (`$(pwd)`) to the `/app/outputs` directory inside the container, allowing the container to write the output files to your local file system.
- `communityfirst/mapgl-tile-renderer`: This is the name of the Docker image that contains the mapgl-tile-renderer tool.
Make sure to replace the placeholder values with your actual information before running the command.


To run locally first build the Docker image:

```bash
docker build -t mapgl-tile-renderer .
```

Then run:

```bash
docker run -it --rm -v "$(pwd)":/app/outputs/ mapgl-tile-renderer --style "mapbox" --bounds "-79,37,-77,38" -Z 8 --mapboxstyle YOUR_USERNAME/YOUR_MAPBOX_STYLE_ID --apikey YOUR_API_KEY_HERE
```

## Task worker listening to message queue

mapgl-tile-renderer can be configured as a task worker that listens for messages from a queue service, as submitted via a tool like [map-packer](https://github.com/conservationMetrics/map-packer/). Upon retrieval of a message, the tool will initiate rendering, store the file on the container (ideally a volume mount location), and update a PostgreSQL table with the render results.

To set up mapgl-tile-renderer as a task worker, deploy the Docker image and provide the following environmental variables:

* `QUEUE_NAME`: the name of your message queue where map-packer will submit messages.
* `QUEUE_CONNECTION_STRING`: (for Azure usage) the storage account connection string.
* `DB_CONNECTION_STRING`: connection string of your Postgres DB.
* `DB_TABLE`: the name of your Postgres DB table.

For Azure Storage Queue (and other queue services in the future), mapgl-tile-renderer expects a message with a JSON body, composed of the various input options. Example:

```json
{
  "style": "bing",
  "apiKey": "bing-api-key",
  "bounds": "-79,37,-77,38",
  "minZoom": 0,
  "maxZoom": 8,
  "outputFilename": "bing"
  "outputDir": "/maps"
}
```

Note that `outputDir` likely needs to be a volume mount directory on your mapgl-tile-renderer container, so that it can be accessed by map-packer or other tools for sharing and downloading. 

For more information on the complete flow where mapgl-tile-renderer is deployed as a task worker, see the [map-packer](https://github.com/conservationMetrics/map-packer/) documentation.

## Running with Github Actions

To use the Github Actions workflow defined in `.github/workflows/gen-tiles-input.yml` for generating tiles, follow these steps:

1. Fork the repository containing the workflow file.
2. Navigate to your forked repository on Github.
3. Click on the "Actions" tab.
4. You will see a list of available workflows. Click on the "Generate Tiles from Input" workflow.
5. Click on the "Run workflow" dropdown button.
6. Fill in the required and optional input fields. See [CLI options](#cli-options) above for the list of fields.
7. After providing the necessary information in the input fields, click on the "Run workflow" button to initiate the tile generation process.
8. The workflow will execute the steps defined in `gen-tiles-input.yml` and upon completion, the generated tiles will be available as artifacts in the workflow run.

Make sure to review the `gen-tiles-input.yml` file to understand the inputs and outputs of the workflow.

## Inspect the outputs

Three easy ways to examine and inspect the MBTiles:

1. Upload them to a [Felt](https://felt.com) map.
2. Use the [mbview](https://github.com/mapbox/mbview) tool to view them in the browser.
3. Load them in [QGIS](https://qgis.org).

## Formats other than MBTiles

In the future, we may decide to extend this tool to support creating raster tiles in a different format, such as XYZ or [PMTiles](https://github.com/protomaps/PMTiles). However, for the time being, you can use tools like [tippecanoe](https://github.com/felt/tippecanoe) or [go-pmtiles](https://github.com/protomaps/go-pmtiles) to convert the MBTiles outputs generated by this tool.

# For developers

Mapgl-tile-renderer uses [Maplibre-GL Native](https://www.npmjs.com/package/@maplibre/maplibre-gl-native) to render tiles, [Sharp](https://www.npmjs.com/package/sharp) to save them as an image, and Mapbox's [mbtiles Node package](https://www.npmjs.com/package/@mapbox/mbtiles) to compile them into an MBTiles database (which is a SQLite file).

## Node installation requirements

Node version: 18.17.0 to 20.x.x. 

(Sharp requires 18.17.0 at minimum, and MapLibre Native is [currently only supported on stable releases of Node](https://github.com/maplibre/maplibre-native/issues/1058), 20 being the latest)


## Tests

To run tests and view coverage, run:

```bash
npm run test
```

To run tests that require an access token, create a `.env.test` file and add the respective token vars (e.g. MAPBOX_TOKEN, PLANET_TOKEN, PROTOMAPS_TOKEN, STADIA_TOKEN). If not provided, tests requiring these will be skipped.