// AnimationConstants.js - Centralized animation timing and visual constants

// Tile visual constants
export const TILE_CORNER_RADIUS = 8;
export const VIGNETTE_MAX_OPACITY = 0.6; // Maximum darkness at edges (60%)

// Destroy animation timings (ms)
export const DESTROY_FLASH_DURATION = 120;
export const DESTROY_POP_DURATION = 180;
export const DESTROY_TOTAL_DURATION =
  DESTROY_FLASH_DURATION + DESTROY_POP_DURATION;

// Tile drop/cascade animation timings (ms)
export const TILE_DROP_DURATION = 300;
export const CASCADE_DELAY = 350; // Wait for destroy animation to complete

// Other effect timings (ms)
export const LOCKED_SHAKE_DURATION = 200;
export const LOCKED_SHAKE_AMOUNT = 5;
export const LOCKED_SHAKE_PERIOD = 50;

export const BURNOUT_FLASH_DURATION = 100;

export const GREY_RESTORE_DELAY = 300;

// Visual scale constants
export const DESTROY_FLASH_SCALE = 0.2; // Grow by 20% during flash
export const DESTROY_POP_MAX_SCALE = 1.2; // Maximum scale before shrinking

// Stroke widths
export const TILE_STROKE_WIDTH_NORMAL = 2;
export const TILE_STROKE_WIDTH_CRACKED = 4;
export const TILE_STROKE_WIDTH_LOCKED = 4;
export const CRACK_LINE_WIDTH = 2;
