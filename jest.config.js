export default {
  transform: {
    "^.+\\.js$": ["babel-jest", { presets: ["@babel/preset-env"] }],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^styled-map-package/from-mbtiles$":
      "<rootDir>/node_modules/styled-map-package/lib/from-mbtiles.js",
    "^styled-map-package/writer$":
      "<rootDir>/node_modules/styled-map-package/lib/writer.js",
  },
  transformIgnorePatterns: [], // Remove the ignore pattern to transform all modules
};
