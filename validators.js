// validators.js - Settings validation utilities

/**
 * Validates and sanitizes settings against defaults
 * Returns a sanitized object with defaults for invalid values
 */
window.validateSettings = function (raw, defaults) {
  if (!raw || typeof raw !== "object") {
    return { ...defaults };
  }

  const result = {};

  // Theme: must be "dark" or "light"
  if (raw.theme === "dark" || raw.theme === "light") {
    result.theme = raw.theme;
  } else {
    result.theme = defaults.theme;
  }

  // Font size: must be a number within minFont/maxFont bounds
  if (typeof raw.fontSize === "number" &&
      raw.fontSize >= defaults.minFont &&
      raw.fontSize <= defaults.maxFont) {
    result.fontSize = raw.fontSize;
  } else {
    result.fontSize = defaults.fontSize;
  }

  // Width: must be a positive number >= MIN_WIDTH
  const minWidth = window.MIN_WIDTH || 200;
  if (typeof raw.width === "number" && raw.width >= minWidth) {
    result.width = raw.width;
  } else {
    result.width = defaults.width;
  }

  // Height: must be a positive number >= MIN_HEIGHT
  const minHeight = window.MIN_HEIGHT || 120;
  if (typeof raw.height === "number" && raw.height >= minHeight) {
    result.height = raw.height;
  } else {
    result.height = defaults.height;
  }

  // Left position: must be a number >= 0
  if (typeof raw.left === "number" && raw.left >= 0) {
    result.left = raw.left;
  } else {
    result.left = defaults.left;
  }

  // Top position: must be a number >= 0
  if (typeof raw.top === "number" && raw.top >= 0) {
    result.top = raw.top;
  } else {
    result.top = defaults.top;
  }

  // Target language: must be a non-empty string
  if (typeof raw.targetLang === "string" && raw.targetLang.length > 0) {
    result.targetLang = raw.targetLang;
  }
  // Note: targetLang has no default, it's optional

  return result;
};

/**
 * Validates a single setting value
 * Returns the value if valid, or the default if invalid
 */
window.validateSetting = function (key, value, defaults) {
  const temp = { [key]: value };
  const validated = window.validateSettings(temp, defaults);
  return validated[key] !== undefined ? validated[key] : defaults[key];
};
