// ColorLogic.js - Handles gradient math, shifting, and complementary detection

export const InteractionResult = {
  SHIFT_UP: "SHIFT_UP",
  SHIFT_DOWN: "SHIFT_DOWN",
  LOCKED: "LOCKED",
  BURNOUT: "BURNOUT",
};

/**
 * Check if two colors are complementary (opposite on color wheel)
 * @param {number} color1 - First color (hex)
 * @param {number} color2 - Second color (hex)
 * @returns {boolean} True if colors are complementary
 */
function areColorsComplementary(color1, color2) {
  // Extract RGB components
  const r1 = (color1 >> 16) & 0xff;
  const g1 = (color1 >> 8) & 0xff;
  const b1 = color1 & 0xff;

  const r2 = (color2 >> 16) & 0xff;
  const g2 = (color2 >> 8) & 0xff;
  const b2 = color2 & 0xff;

  // Convert to HSL to check hue difference
  const h1 = rgbToHue(r1, g1, b1);
  const h2 = rgbToHue(r2, g2, b2);

  // Complementary colors are ~180 degrees apart on the color wheel
  const hueDiff = Math.abs(h1 - h2);
  const complementaryDiff = Math.min(hueDiff, 360 - hueDiff);

  // Allow some tolerance (150-210 degrees = complementary)
  return complementaryDiff >= 150 && complementaryDiff <= 210;
}

/**
 * Convert RGB to Hue (0-360)
 */
function rgbToHue(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) return 0;

  let hue;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }

  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  return hue;
}

/**
 * Resolves the interaction between a tile and the current pulse color
 * @param {number} tileColorIndex - Current color index of the tile
 * @param {number} pulseColorIndex - Current pulse color index
 * @param {Array} palette - The color palette
 * @returns {Object} { result: InteractionResult, newColorIndex: number }
 */
export function resolveInteraction(
  tileColorIndex,
  pulseColorIndex,
  palette
) {
  // Calculate the distance
  const diff = pulseColorIndex - tileColorIndex;

  // 1. Safety Check (The Lock) - Same color = no action
  if (diff === 0) {
    return {
      result: InteractionResult.LOCKED,
      newColorIndex: tileColorIndex,
    };
  }

  // 2. Complementary Check (The Burnout) - True complementary colors = instant grey
  // Skip this check for small palettes (≤3 colors) where binary mode uses only 2 extremes
  const tileColor = palette[tileColorIndex];
  const pulseColor = palette[pulseColorIndex];

  if (palette.length > 3 && areColorsComplementary(tileColor, pulseColor)) {
    return {
      result: InteractionResult.BURNOUT,
      newColorIndex: -1, // -1 indicates grey
    };
  }

  // 3. Shift (The Move) - Move one step towards pulse
  if (pulseColorIndex > tileColorIndex) {
    return {
      result: InteractionResult.SHIFT_UP,
      newColorIndex: tileColorIndex + 1,
    };
  } else {
    return {
      result: InteractionResult.SHIFT_DOWN,
      newColorIndex: tileColorIndex - 1,
    };
  }
}

/**
 * Interpolates between two colors for smooth pulse animation
 * @param {number} color1 - First color (hex)
 * @param {number} color2 - Second color (hex)
 * @param {number} t - Interpolation factor (0 to 1)
 * @returns {number} Interpolated color
 */
export function interpolateColor(color1, color2, t) {
  const r1 = (color1 >> 16) & 0xff;
  const g1 = (color1 >> 8) & 0xff;
  const b1 = color1 & 0xff;

  const r2 = (color2 >> 16) & 0xff;
  const g2 = (color2 >> 8) & 0xff;
  const b2 = color2 & 0xff;

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return (r << 16) | (g << 8) | b;
}

/**
 * Gets a random color index from the palette (for initial tile generation)
 * @param {number} paletteSize - Number of colors in the palette
 * @returns {number} Random color index
 */
export function getRandomColorIndex(paletteSize) {
  return Math.floor(Math.random() * paletteSize);
}
