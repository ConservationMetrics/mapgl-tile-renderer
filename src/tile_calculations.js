// Converts lat/long value to a tile coordinate at a given zoom level, so as to
// determine X and Y position (column) of a tile in a grid based on geographic longitude 
// in the Web Mercator projection. 
// See: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Lon./lat._to_tile_numbers
const convertCoordinatesToTiles = (lon, lat, zoom) => {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lon + 180) / 360) * n);
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
    return { x, y };
}

// Calculates the range of tile coordinates that cover a given geographic bounding box 
// at a specific zoom level.
export const calculateTileRangeForBounds = (bounds, zoom) => {
    const [minLon, minLat, maxLon, maxLat] = bounds;

    const { x: minX, y: maxY } = convertCoordinatesToTiles(minLon, minLat, zoom);
    const { x: maxX, y: minY } = convertCoordinatesToTiles(maxLon, maxLat, zoom);

    return { minX, minY, maxX, maxY };
}

// Converts tile X and Y coordinates at a given zoom level back to geographic coordinates 
// (longitude and latitude). 
// See: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Tile_numbers_to_lon..2Flat._2
export const convertTilesToCoordinates = (x, y, zoom) => {
    const lon = (x / Math.pow(2, zoom)) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / Math.pow(2, zoom))));
    const lat = latRad * 180.0 / Math.PI;
    return { lon, lat };
}
