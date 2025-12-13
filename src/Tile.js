// Tile.js - Visual representation with vignette urgency effect

import { GREY_COLOR } from "./LevelConfig.js";
import {
  TILE_CORNER_RADIUS,
  DESTROY_FLASH_DURATION,
  DESTROY_POP_DURATION,
  DESTROY_TOTAL_DURATION,
  DESTROY_FLASH_SCALE,
  DESTROY_POP_MAX_SCALE,
  LOCKED_SHAKE_DURATION,
  LOCKED_SHAKE_AMOUNT,
  LOCKED_SHAKE_PERIOD,
  BURNOUT_FLASH_DURATION,
  GREY_RESTORE_DELAY,
  TILE_STROKE_WIDTH_NORMAL,
  TILE_STROKE_WIDTH_CRACKED,
  TILE_STROKE_WIDTH_LOCKED,
  CRACK_LINE_WIDTH,
  VIGNETTE_MAX_OPACITY,
} from "./AnimationConstants.js";

export class Tile {
  constructor(
    pixiApp,
    colorIndex,
    palette,
    gridX,
    gridY,
    tileSize,
    padding,
    row,
    col,
  ) {
    this.app = pixiApp;
    this.colorIndex = colorIndex; // -1 for grey
    this.palette = palette;
    this.gridX = gridX;
    this.gridY = gridY;
    this.tileSize = tileSize;
    this.padding = padding;

    // Grid position (for stagnation calculations)
    this.row = row;
    this.col = col;

    // Grey tile mechanics
    this.isGrey = colorIndex === -1;
    this.greyHealth = this.isGrey ? 2 : 0;

    // Stagnation visuals (controlled by Grid)
    this.urgency = 0.0; // 0.0 = safe, 1.0 = maximum danger (set by Grid based on grey neighbors)

    // Visual elements
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.vignetteGraphics = new PIXI.Graphics();

    this.setupVisuals();
  }

  setupVisuals() {
    // Main tile graphics
    this.updateGraphics();

    this.container.addChild(this.graphics);
    this.container.addChild(this.vignetteGraphics);

    // Set position - centered on the tile position
    const totalSize = this.tileSize + this.padding;
    this.container.x =
      this.gridX * totalSize + this.tileSize / 2 + this.padding / 2;
    this.container.y =
      this.gridY * totalSize + this.tileSize / 2 + this.padding / 2;

    // Enable interaction
    this.container.eventMode = "static";
    this.container.cursor = "pointer";
  }

  updateGraphics() {
    if (!this.graphics || this.graphics.destroyed) return;

    try {
      this.graphics.clear();

      const halfSize = this.tileSize / 2;

      if (this.isGrey) {
        // Grey tiles with much lighter color when damaged
        const greyShade = this.greyHealth === 1 ? 0xcccccc : GREY_COLOR;
        this.graphics.roundRect(
          -halfSize,
          -halfSize,
          this.tileSize,
          this.tileSize,
          TILE_CORNER_RADIUS,
        );
        this.graphics.fill(greyShade);
        // Thin white stroke to make grey tiles clearly distinct
        this.graphics.stroke({
          width: TILE_STROKE_WIDTH_LOCKED,
          color: 0xffffff,
          alpha: 0.6,
        });
      } else {
        // Normal colored tiles
        const color = this.palette[this.colorIndex];
        this.graphics.roundRect(
          -halfSize,
          -halfSize,
          this.tileSize,
          this.tileSize,
          TILE_CORNER_RADIUS,
        );
        this.graphics.fill(color);
        this.graphics.stroke({
          width: TILE_STROKE_WIDTH_NORMAL,
          color: 0xffffff,
          alpha: 0.3,
        });
      }

      this.updateVignette();
    } catch (e) {
      // Graphics destroyed mid-update
      return;
    }
  }

  updateVignette() {
    if (!this.vignetteGraphics || this.vignetteGraphics.destroyed) return;

    try {
      this.vignetteGraphics.clear();

      // Don't draw vignette on grey tiles or when urgency is low
      if (this.isGrey || this.urgency < 0.4) return;

      const halfSize = this.tileSize / 2;

      // Determine stage and color based on urgency
      let stageColor, baseOpacity, insetFactor, pulseSpeed;

      if (this.urgency >= 0.9) {
        // CRITICAL: Intense red, large coverage, fast pulse
        stageColor = 0xff0000;
        baseOpacity = 0.85;
        insetFactor = 0.7;
        pulseSpeed = 5;
      } else if (this.urgency >= 0.7) {
        // DANGER: Red-orange, medium coverage, medium pulse
        stageColor = 0xff4400;
        baseOpacity = 0.6;
        insetFactor = 0.6;
        pulseSpeed = 3;
      } else {
        // WARNING: Orange glow, small coverage, slow pulse
        stageColor = 0xffaa00;
        baseOpacity = 0.4;
        insetFactor = 0.5;
        pulseSpeed = 2;
      }

      // Add pulsing effect that speeds up with urgency
      const pulsePhase = (Date.now() / (300 / pulseSpeed)) % (Math.PI * 2);
      const pulseFactor = Math.sin(pulsePhase) * 0.2 + 0.8; // Oscillate between 0.6 and 1.0

      const finalOpacity = baseOpacity * pulseFactor;

      // Create vignette effect by drawing multiple layers
      const layers = 5;
      for (let i = 0; i < layers; i++) {
        const t = i / layers;
        const inset = t * halfSize * insetFactor;
        const layerOpacity = finalOpacity * (1 - t);

        this.vignetteGraphics.roundRect(
          -halfSize + inset,
          -halfSize + inset,
          this.tileSize - inset * 2,
          this.tileSize - inset * 2,
          TILE_CORNER_RADIUS,
        );
        this.vignetteGraphics.fill({
          color: stageColor,
          alpha: layerOpacity / layers,
        });
      }
    } catch (e) {
      // Graphics destroyed mid-update
      return;
    }
  }

  /**
   * Updates the tile animation
   * @param {number} deltaMS
   */
  update(deltaMS) {
    // Don't update if destroy animation is running
    if (this.destroyAnimationId) return;

    // Update vignette for pulsing effect
    if (!this.isGrey && this.urgency >= 0.4) {
      this.updateVignette();
    }
  }

  /**
   * Resets the urgency of this tile (called when part of a match)
   */
  resetAge() {
    this.urgency = 0;
  }

  /**
   * Placeholder for compatibility (not used in move-based system)
   */
  reduceAge(amount) {
    // Not used in move-based stagnation system
  }

  /**
   * Sets the color of the tile
   * @param {number} colorIndex - New color index (-1 for grey)
   * @param {boolean} animate - Whether to animate the transition
   */
  setColor(colorIndex, animate = false) {
    const wasGrey = this.isGrey;
    const oldColorIndex = this.colorIndex;

    this.colorIndex = colorIndex;
    this.isGrey = colorIndex === -1;

    if (this.isGrey) {
      // Only reset health if tile is becoming grey for the first time
      // Don't reset if it was already grey (preserves damage during cascade)
      if (!wasGrey) {
        this.greyHealth = 2;
      }
    } else {
      this.greyHealth = 0;
      // Reset urgency when tile becomes normal (restored from grey or new tile)
      this.urgency = 0;
    }

    // Animate color shift if requested and both colors are valid
    if (
      animate &&
      oldColorIndex >= 0 &&
      colorIndex >= 0 &&
      oldColorIndex !== colorIndex
    ) {
      this.playColorShiftEffect(oldColorIndex, colorIndex);
    } else {
      this.updateGraphics();
    }
  }

  /**
   * Animate smooth color transition
   */
  playColorShiftEffect(fromColorIndex, toColorIndex) {
    if (!this.graphics || this.graphics.destroyed) {
      this.updateGraphics();
      return;
    }

    const startTime = Date.now();
    const duration = 200; // Quick 200ms transition
    const fromColor = this.palette[fromColorIndex];
    const toColor = this.palette[toColorIndex];

    // Extract RGB components
    const fromR = (fromColor >> 16) & 0xff;
    const fromG = (fromColor >> 8) & 0xff;
    const fromB = fromColor & 0xff;
    const toR = (toColor >> 16) & 0xff;
    const toG = (toColor >> 8) & 0xff;
    const toB = toColor & 0xff;

    const animate = () => {
      if (!this.graphics || this.graphics.destroyed) return;

      try {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);

        // Ease out for smooth deceleration
        const eased = 1 - Math.pow(1 - t, 2);

        // Lerp between colors
        const r = Math.floor(fromR + (toR - fromR) * eased);
        const g = Math.floor(fromG + (toG - fromG) * eased);
        const b = Math.floor(fromB + (toB - fromB) * eased);
        const lerpedColor = (r << 16) | (g << 8) | b;

        // Temporarily set the color for rendering
        const currentColorIndex = this.colorIndex;
        this.colorIndex = fromColorIndex; // Use old index for structure
        this.updateGraphics();

        // Tint to the lerped color
        this.graphics.tint = lerpedColor;

        // Restore the actual color index
        this.colorIndex = currentColorIndex;

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          // Final state
          this.graphics.tint = 0xffffff;
          this.updateGraphics();
        }
      } catch (e) {
        // Graphics destroyed mid-animation
        this.updateGraphics();
        return;
      }
    };

    animate();
  }

  /**
   * Converts tile to grey (burnout)
   */
  burnout() {
    this.setColor(-1);
    this.playBurnoutEffect();
  }

  /**
   * Damages the grey tile
   * @returns {boolean} True if tile was destroyed
   */
  damageGrey() {
    if (!this.isGrey) return false;

    this.greyHealth--;

    if (this.greyHealth <= 0) {
      return true; // Destroyed
    } else {
      // Update visual to show crack
      this.updateGraphics();
      return false;
    }
  }

  /**
   * Play locked shake animation
   */
  playLockedEffect() {
    if (!this.container || this.container.destroyed) return; // Safety check

    const originalX = this.container.x;
    const shakeStart = Date.now();

    const shake = () => {
      if (!this.container || this.container.destroyed) return; // Safety check

      try {
        const elapsed = Date.now() - shakeStart;
        if (elapsed < LOCKED_SHAKE_DURATION) {
          this.container.x =
            originalX +
            Math.sin((elapsed / LOCKED_SHAKE_PERIOD) * Math.PI) *
              LOCKED_SHAKE_AMOUNT;
          requestAnimationFrame(shake);
        } else {
          this.container.x = originalX;
        }
      } catch (e) {
        // Container destroyed mid-animation
        return;
      }
    };

    shake();
  }

  /**
   * Play burnout effect - dramatic transition to grey
   */
  playBurnoutEffect() {
    if (
      !this.graphics ||
      this.graphics.destroyed ||
      !this.container ||
      this.container.destroyed
    )
      return;

    const startTime = Date.now();
    const duration = 400; // Total animation duration
    const originalScale = 1;

    const animate = () => {
      if (
        !this.graphics ||
        this.graphics.destroyed ||
        !this.container ||
        this.container.destroyed
      )
        return;

      try {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);

        if (t < 0.3) {
          // Phase 1: Flash white and pulse outward
          const phase1 = t / 0.3;
          this.graphics.tint = 0xffffff;
          const scale = originalScale + phase1 * 0.3; // Grow to 130%
          this.container.scale.set(scale);
        } else if (t < 0.7) {
          // Phase 2: Fade to grey and shrink
          const phase2 = (t - 0.3) / 0.4;
          // Lerp from white to grey
          const grey = Math.floor(255 * (1 - phase2 * 0.6)); // 255 -> 102 (0x66)
          const greyColor = (grey << 16) | (grey << 8) | grey;
          this.graphics.tint = greyColor;
          const scale = originalScale + 0.3 - phase2 * 0.2; // Shrink from 130% to 110%
          this.container.scale.set(scale);
        } else {
          // Phase 3: Settle to final state
          const phase3 = (t - 0.7) / 0.3;
          this.graphics.tint = 0xffffff; // Reset tint
          const scale = originalScale + 0.1 - phase3 * 0.1; // Return to 100%
          this.container.scale.set(scale);
        }

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          // Ensure final state
          this.graphics.tint = 0xffffff;
          this.container.scale.set(originalScale);
        }
      } catch (e) {
        // Graphics destroyed mid-animation
        return;
      }
    };

    animate();
  }

  /**
   * Play match destruction effect
   * Quick flash white, slight grow, then pop out
   */
  playDestroyEffect() {
    // Cancel any existing animation
    if (this.destroyAnimationId) {
      cancelAnimationFrame(this.destroyAnimationId);
    }

    // Store original color
    const originalColor = this.isGrey
      ? GREY_COLOR
      : this.palette[this.colorIndex];

    const startTime = Date.now();

    const animate = () => {
      // Safety check - graphics might be destroyed
      if (
        !this.graphics ||
        !this.container ||
        this.graphics.destroyed ||
        this.container.destroyed
      ) {
        this.destroyAnimationId = null;
        return;
      }

      try {
        const elapsed = Date.now() - startTime;

        if (elapsed < DESTROY_FLASH_DURATION) {
          // Flash white and grow quickly
          const t = elapsed / DESTROY_FLASH_DURATION;

          // Redraw with white color
          this.graphics.clear();
          const halfSize = this.tileSize / 2;
          this.graphics.roundRect(
            -halfSize,
            -halfSize,
            this.tileSize,
            this.tileSize,
            TILE_CORNER_RADIUS,
          );
          this.graphics.fill(0xffffff);

          const scale = 1 + t * DESTROY_FLASH_SCALE;
          this.container.scale.set(scale);
        } else if (elapsed < DESTROY_TOTAL_DURATION) {
          // Pop out - shrink and fade
          const t = (elapsed - DESTROY_FLASH_DURATION) / DESTROY_POP_DURATION;
          const easedT = t * t; // Ease in

          // Keep white
          this.graphics.clear();
          const halfSize = this.tileSize / 2;
          this.graphics.roundRect(
            -halfSize,
            -halfSize,
            this.tileSize,
            this.tileSize,
            TILE_CORNER_RADIUS,
          );
          this.graphics.fill(0xffffff);

          const scale = DESTROY_POP_MAX_SCALE * (1 - easedT);
          this.container.scale.set(scale);
          this.container.alpha = 1 - easedT;
        } else {
          // Done
          this.container.visible = false;
          this.container.alpha = 1;
          this.container.scale.set(1);
          this.destroyAnimationId = null;
          return;
        }

        this.destroyAnimationId = requestAnimationFrame(animate);
      } catch (e) {
        // Graphics/container was destroyed mid-animation
        this.destroyAnimationId = null;
        return;
      }
    };

    animate();
  }

  /**
   * Stop any running destroy animation
   */
  stopDestroyEffect() {
    if (this.destroyAnimationId) {
      cancelAnimationFrame(this.destroyAnimationId);
      this.destroyAnimationId = null;
    }
  }

  /**
   * Play restoration effect for grey tiles being freed
   * Grows from center with a flash to show rebirth
   */
  playRestoreEffect() {
    if (!this.container || this.container.destroyed) return; // Safety check

    const startTime = Date.now();
    const duration = GREY_RESTORE_DELAY;

    // Start invisible and scaled down
    this.container.alpha = 0;
    this.container.scale.set(0);
    this.container.visible = true;

    const animate = () => {
      if (!this.container || this.container.destroyed) return; // Safety check

      try {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);

        // Ease out cubic for smooth appearance
        const eased = 1 - Math.pow(1 - t, 3);

        this.container.scale.set(eased);
        this.container.alpha = eased;

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          // Ensure final state
          this.container.scale.set(1);
          this.container.alpha = 1;
        }
      } catch (e) {
        // Container destroyed mid-animation
        return;
      }
    };

    animate();
  }

  /**
   * Sets vignette darkness based on urgency level
   * @param {number} urgencyLevel - 1.0 = safe, 3.0 = critical
   */
  setUrgency(urgencyLevel) {
    // Map urgency 1.0-3.0 to vignette intensity 0.0-1.0
    this.vignetteIntensity = Math.max(
      0,
      Math.min(1, (urgencyLevel - 1.0) / 2.0),
    );
    this.updateGraphics();
  }

  /**
   * Gets the PIXI container
   */
  getContainer() {
    return this.container;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.container.destroy({ children: true });
  }
}
