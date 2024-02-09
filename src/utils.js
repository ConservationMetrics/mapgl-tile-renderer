export const parseListToFloat = (text) => text.split(",").map(Number);

export const raiseError = (msg) => {
  console.error("ERROR:", msg);
  process.exit(1);
};

export const handleError = (error, type) => {
  if (type === "badRequest") {
    // Something was caller's fault. They need to fix something then retry.
    return {
      status: "BadRequest",
      errorMessage: `${error.message}`,
    };
  } else if (type === "internalServerError") {
    return {
      // Something was our fault. It's out of the caller's control.
      status: "InternalServerError",
      errorMessage: `${error.message}`,
    };
  } else {
    return {
      status: "UnknownError",
      errorMessage: `${error.message}`,
    };
  }
};

// Currently supported list of online styles
// When adding a new style, make sure to update this list
const validOnlineStyles = [
  "bing",
  "esri",
  "google",
  "mapbox",
  "mapbox-satellite",
  "planet",
  "protomaps",
];

export const validateInputOptions = (
  style,
  styleDir,
  sourceDir,
  apiKey,
  mapboxStyle,
  monthYear,
  overlay,
  bounds,
  minZoom,
  maxZoom,
) => {
  if (!style) {
    raiseError("You must provide a style");
  }

  if (!validOnlineStyles.includes(style) && style !== "self") {
    raiseError(
      `Invalid style. Supported styles: ${validOnlineStyles.join(", ")}, self`,
    );
  }

  if (style === "self" && (!styleDir || !sourceDir)) {
    raiseError(
      "If you are providing your own style, you must provide a style location and a source directory",
    );
  }

  if (
    (style === "mapbox" ||
      style === "mapbox-satellite" ||
      style === "planet" ||
      style === "protomaps") &&
    !apiKey
  ) {
    raiseError(`You must provide an API key for ${style}`);
  }

  if (style === "planet" && !monthYear) {
    raiseError(
      "If you are using Planet as your online source, you must provide a month and year (YYYY-MM)",
    );
  }

  // Ensure monthYear is in the right format
  if (monthYear) {
    const monthYearFormat = /^\d{4}-\d{2}$/;
    if (!monthYearFormat.test(monthYear)) {
      raiseError("Month and year must be in YYYY-MM format");
    }
  }

  if (style === "mapbox" && !mapboxStyle) {
    raiseError(
      "If you are using Mapbox as your online source, you must provide a Mapbox style URL",
    );
  }

  if (mapboxStyle) {
    const mapboxStyleFormat = /^[\w-]+\/[\w-]+$/;
    if (!mapboxStyleFormat.test(mapboxStyle)) {
      raiseError(
        "Mapbox style URL must be in a valid format: <yourusername>/<styleid>",
      );
    }
  }

  // Ensure overlay is a JSON object
  if (overlay) {
    try {
      JSON.parse(overlay);
    } catch (e) {
      raiseError("Overlay must be a valid JSON object");
    }
  }

  if (minZoom !== null && (minZoom < 0 || minZoom > 22)) {
    raiseError(`minZoom level is outside supported range (0-22): ${minZoom}`);
  }

  if (maxZoom !== null && (maxZoom < 0 || maxZoom > 22)) {
    raiseError(`maxZoom level is outside supported range (0-22): ${maxZoom}`);
  }

  if (bounds !== null) {
    if (bounds.length !== 4) {
      raiseError(
        `Bounds must be west,south,east,north.  Invalid value found: ${[
          ...bounds,
        ]}`,
      );
    }

    bounds.forEach((b) => {
      if (!Number.isFinite(b)) {
        raiseError(
          `Bounds must be valid floating point values.  Invalid value found: ${[
            ...bounds,
          ]}`,
        );
      }
      return null;
    });

    const [west, south, east, north] = bounds;
    if (west === east) {
      raiseError("Bounds west and east coordinate are the same value");
    }
    if (south === north) {
      raiseError("Bounds south and north coordinate are the same value");
    }
  }
};
