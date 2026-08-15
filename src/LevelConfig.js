// LevelConfig.js - Defines palettes, grid sizes, and thresholds

/**
 * Convert HSB to RGB
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-1)
 * @param {number} b - Brightness (0-1)
 * @returns {number} RGB color as hex
 */
function hsbToRgb(h, s, b) {
  h = h / 360;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = b * (1 - s);
  const q = b * (1 - f * s);
  const t = b * (1 - (1 - f) * s);

  let r, g, bl;
  switch (i % 6) {
    case 0:
      r = b;
      g = t;
      bl = p;
      break;
    case 1:
      r = q;
      g = b;
      bl = p;
      break;
    case 2:
      r = p;
      g = b;
      bl = t;
      break;
    case 3:
      r = p;
      g = q;
      bl = b;
      break;
    case 4:
      r = t;
      g = p;
      bl = b;
      break;
    case 5:
      r = b;
      g = p;
      bl = q;
      break;
  }

  const red = Math.round(r * 255);
  const green = Math.round(g * 255);
  const blue = Math.round(bl * 255);

  return (red << 16) | (green << 8) | blue;
}

/**
 * Generate a palette by interpolating between two colors
 * @param {number} color1 - Start color (hex)
 * @param {number} color2 - End color (hex)
 * @param {number} steps - Number of colors in palette
 */
function generatePalette(color1, color2, steps) {
  const palette = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r1 = (color1 >> 16) & 0xff;
    const g1 = (color1 >> 8) & 0xff;
    const b1 = color1 & 0xff;
    const r2 = (color2 >> 16) & 0xff;
    const g2 = (color2 >> 8) & 0xff;
    const b2 = color2 & 0xff;

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    palette.push((r << 16) | (g << 8) | b);
  }
  return palette;
}

/**
 * Seeded random number generator
 */
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Generate a neon/synthwave palette (two extreme saturated colors)
 * @param {number} seed - Seed for variation
 * @param {number} steps - Number of colors
 */
function generateNeonPalette(seed, steps) {
  // Pick two random hues with high saturation and brightness (synthwave style)
  // Ensure they're at least 90 degrees apart for clear distinction
  const hue1 = Math.floor(seededRandom(seed * 7) * 360);
  const separation = 90 + Math.floor(seededRandom(seed * 13 + 5) * 180); // 90-270 degrees apart
  const hue2 = (hue1 + separation) % 360;

  const color1 = hsbToRgb(hue1, 1.0, 1.0); // Full saturation and brightness
  const color2 = hsbToRgb(hue2, 1.0, 1.0);

  return generatePalette(color1, color2, steps);
}

/**
 * Generate a monochrome palette (single hue, varying brightness)
 * @param {number} seed - Seed for variation
 * @param {number} steps - Number of colors
 */
function generateMonochromePalette(seed, steps) {
  const hue = Math.floor(seededRandom(seed * 11) * 360);
  const palette = [];

  for (let i = 0; i < steps; i++) {
    const brightness = 0.9 - (i / (steps - 1)) * 0.6; // From 0.9 (light) to 0.3 (dark)
    palette.push(hsbToRgb(hue, 0.15, brightness)); // Low saturation for monochrome
  }

  return palette;
}

/**
 * Generate a random extreme color pair palette
 * @param {number} seed - Seed for variation
 * @param {number} steps - Number of colors
 */
function generateExtremePalette(seed, steps) {
  // Pick complementary or widely spaced hues
  const hue1 = Math.floor(seededRandom(seed * 17) * 360);
  const hue2 =
    (hue1 + 120 + Math.floor(seededRandom(seed * 23 + 7) * 120)) % 360;

  const color1 = hsbToRgb(hue1, 0.95, 1.0);
  const color2 = hsbToRgb(hue2, 0.95, 1.0);

  return generatePalette(color1, color2, steps);
}

// Solarized Dark accent colors — placed around the hue wheel
const SOLARIZED_ACCENT_COLORS = [
  0x859900, // Green
  0x2aa198, // Cyan
  0x268bd2, // Blue
  0x6c71c4, // Violet
  0xd33682, // Magenta
  0xdc322f, // Red
  0xcb4b16, // Orange
  0xb58900, // Yellow
];

/**
 * Generate a Solarized Dark palette (contiguous slice of accent colors)
 * @param {number} seed - Seed for rotation
 * @param {number} steps - Number of colors (up to 8)
 */
function generateSolarizedPalette(seed, steps) {
  const maxLen = SOLARIZED_ACCENT_COLORS.length;
  const offset = Math.floor(seededRandom(seed * 41) * maxLen);
  const palette = [];
  for (let i = 0; i < steps; i++) {
    const idx = (offset + i) % maxLen;
    palette.push(SOLARIZED_ACCENT_COLORS[idx]);
  }
  return palette;
}

const gameSeed = Math.random();

/**
 * Generate level config dynamically
 */
function generateLevelConfig(level) {
  // Level 1 is always the fixed tutorial level: Fire (Red to Yellow)
  if (level === 1) {
    return {
      name: "Fire",
      gridSize: { rows: 5, cols: 5 },
      palette: generatePalette(0xff0000, 0xffff00, 3), // Red to yellow, 3 steps
      safeThreshold: 3,
      pulseMode: "binary",
      stagnationTime: 30000,
      targetScore: 8,
    };
  }

  // Cycle through difficulty patterns
  const pattern = ((level - 1) % 30) + 1;

  // Levels 2-10: Easy (3 or 4 colors)
  if (pattern <= 10) {
    const type = pattern % 4;
    const isNeon = type === 0;
    const isMono = type === 1;
    const isSolarized = type === 2;
    const numColors = level < 4 ? 3 : 4;

    return {
      name: isNeon ? "Neon" : isMono ? "Mono" : isSolarized ? "Solarized" : "Shift",
      gridSize: { rows: 5, cols: 5 },
      palette: isNeon
        ? generateNeonPalette(level + gameSeed, numColors)
        : isMono
          ? generateMonochromePalette(level + gameSeed, numColors)
          : isSolarized
            ? generateSolarizedPalette(level + gameSeed, numColors)
            : generateExtremePalette(level + gameSeed, numColors),
      safeThreshold: 3,
      pulseMode: "binary",
      stagnationTime: 30000,
      targetScore: level < 4 ? 8 : 15,
    };
  }

  // Levels 11-20: Medium (4 colors)
  if (pattern <= 20) {
    const type = pattern % 4;
    const isNeon = type === 0;
    const isMono = type === 1;
    const isSolarized = type === 2;

    return {
      name: isNeon ? "Neon" : isMono ? "Mono" : isSolarized ? "Solarized" : "Shift",
      gridSize: { rows: 5, cols: pattern % 2 === 0 ? 6 : 5 },
      palette: isNeon
        ? generateNeonPalette(level + gameSeed, 4)
        : isMono
          ? generateMonochromePalette(level + gameSeed, 4)
          : isSolarized
            ? generateSolarizedPalette(level + gameSeed, 4)
            : generateExtremePalette(level + gameSeed, 4),
      safeThreshold: pattern <= 15 ? 3 : 2,
      pulseMode: "binary",
      stagnationTime: 28000,
      targetScore: 18,
    };
  }

  // Levels 21-30: Hard (5-6 colors)
  const type = pattern % 4;
  const isNeon = type === 0;
  const isMono = type === 1;
  const isSolarized = type === 2;
  const steps = pattern <= 25 ? 5 : 6;

  return {
    name: isNeon ? "Neon" : isMono ? "Mono" : isSolarized ? "Solarized" : "Shift",
    gridSize: { rows: pattern <= 25 ? 5 : 6, cols: 6 },
    palette: isNeon
      ? generateNeonPalette(level + gameSeed, steps)
      : isMono
        ? generateMonochromePalette(level + gameSeed, steps)
        : isSolarized
          ? generateSolarizedPalette(level + gameSeed, steps)
          : generateExtremePalette(level + gameSeed, steps),
    safeThreshold: 2,
    pulseMode: "binary",
    stagnationTime: 25000 - (pattern - 20) * 300,
    targetScore: 20 + (pattern - 20),
  };
}

export const LEVEL_CONFIGS = new Proxy(
  {},
  {
    get(target, prop) {
      const level = parseInt(prop);
      if (isNaN(level)) return undefined;
      return generateLevelConfig(level);
    },
  },
);

// Color names for accessibility symbols
export const COLOR_SYMBOLS = ["●", "◆", "▲", "■", "★", "◉", "◈", "▼", "⬟"];

// Grey tile constant
export const GREY_COLOR = 0x666666;

// Current level (can be changed dynamically)
export let currentLevel = 1;

export function setCurrentLevel(level) {
  currentLevel = level;
}

export function getCurrentConfig() {
  return LEVEL_CONFIGS[currentLevel];
}
