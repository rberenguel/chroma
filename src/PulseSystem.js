// PulseSystem.js - Manages the global color oscillation (cursor replacement)

import { interpolateColor } from "./ColorLogic.js";

export class PulseSystem {
  constructor(palette, mode = "binary") {
    this.palette = palette;
    this.mode = mode; // "binary" or "cycle"

    // Define the primary colors (extremes) based on palette size
    if (mode === "binary") {
      // Binary: first and last only
      this.primaryIndices = [0, palette.length - 1];
    } else {
      // Triad: evenly spaced primaries
      // For N colors, primaries are at 0, N/3, 2N/3, etc.
      this.primaryIndices = [];
      const step = Math.floor(palette.length / 3);
      for (let i = 0; i < 3; i++) {
        this.primaryIndices.push(Math.min(i * step, palette.length - 1));
      }
    }

    this.currentPrimaryIndex = 0; // Index into primaryIndices array
    this.currentColorIndex = this.primaryIndices[0];
    this.currentColor = palette[this.currentColorIndex];
    this.targetColorIndex = this.primaryIndices[1];

    // Animation for smooth color transition
    this.transitionProgress = 0;
    this.isTransitioning = false;
    this.transitionSpeed = 0.03; // Speed of visual transition
  }

  /**
   * Advance to the next color (called when user makes a move)
   */
  advance() {
    // Move to next primary color
    this.currentPrimaryIndex = (this.currentPrimaryIndex + 1) % this.primaryIndices.length;
    this.targetColorIndex = this.primaryIndices[this.currentPrimaryIndex];

    this.isTransitioning = true;
    this.transitionProgress = 0;
  }

  /**
   * Updates the pulse system (only for visual interpolation)
   * @param {number} deltaTime - Time delta from ticker
   */
  update(deltaTime) {
    if (this.isTransitioning) {
      this.transitionProgress += this.transitionSpeed * deltaTime;

      if (this.transitionProgress >= 1) {
        this.transitionProgress = 1;
        this.currentColorIndex = this.targetColorIndex;
        this.isTransitioning = false;
      }

      // Interpolate color for smooth visual transition
      this.currentColor = interpolateColor(
        this.palette[this.currentColorIndex],
        this.palette[this.targetColorIndex],
        this.transitionProgress
      );
    } else {
      // Not transitioning, just show current color
      this.currentColor = this.palette[this.currentColorIndex];
    }
  }

  /**
   * Gets the current pulse color index (for game logic)
   * @returns {number}
   */
  getCurrentColorIndex() {
    return this.currentColorIndex;
  }

  /**
   * Gets the current interpolated color (for visuals)
   * @returns {number}
   */
  getCurrentColor() {
    return this.currentColor;
  }

  getTargetColor() {
    return this.palette[this.targetColorIndex];
  }
}
