export default {
  transform: {
    "^.+\\.js$": ["babel-jest", { presets: ["@babel/preset-env"] }],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transformIgnorePatterns: [], // Remove the ignore pattern to transform all modules
};
