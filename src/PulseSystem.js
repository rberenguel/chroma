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
    this.isAdvancing = false;
    this.transitionSpeed = 0.002; // Speed of visual transition
  }

  /**
   * Advance to the next color (called when user makes a move)
   */
  advance() {
    if (this.mode === "binary") {
      // Binary mode: randomly pick one of the two extreme colors
      // but ensure it's different from current
      const currentIsPrimaryZero =
        this.currentColorIndex === this.primaryIndices[0];

      // 50/50 chance to pick either extreme
      const pickFirst = Math.random() < 0.5;

      // If we randomly picked the same one we're on, use the other one
      let chosenPrimaryIndex;
      if (pickFirst) {
        chosenPrimaryIndex = 0;
      } else {
        chosenPrimaryIndex = 1;
      }

      // If by chance we picked the same color we're on, flip to the other
      if (this.primaryIndices[chosenPrimaryIndex] === this.currentColorIndex) {
        chosenPrimaryIndex = 1 - chosenPrimaryIndex;
      }

      this.currentPrimaryIndex = chosenPrimaryIndex;
      this.targetColorIndex = this.primaryIndices[this.currentPrimaryIndex];
    } else {
      // Cycle mode: move to next primary color
      this.currentPrimaryIndex =
        (this.currentPrimaryIndex + 1) % this.primaryIndices.length;
      this.targetColorIndex = this.primaryIndices[this.currentPrimaryIndex];
    }

    this.isAdvancing = true;
    this.transitionProgress = 0;
  }

  /**
   * Updates the pulse system (only for visual interpolation)
   * @param {number} deltaMS - Time delta from ticker in milliseconds
   */
  update(deltaMS) {
    if (this.isAdvancing) {
      this.transitionProgress += this.transitionSpeed * deltaMS;

      if (this.transitionProgress >= 1) {
        this.transitionProgress = 1;
        this.currentColorIndex = this.targetColorIndex;
        this.isAdvancing = false;
      }

      // Interpolate color for smooth visual transition
      this.currentColor = interpolateColor(
        this.palette[this.currentColorIndex],
        this.palette[this.targetColorIndex],
        this.transitionProgress,
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
