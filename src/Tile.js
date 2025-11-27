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
  constructor(pixiApp, colorIndex, palette, gridX, gridY, tileSize, padding) {
    this.app = pixiApp;
    this.colorIndex = colorIndex; // -1 for grey
    this.palette = palette;
    this.gridX = gridX;
    this.gridY = gridY;
    this.tileSize = tileSize;
    this.padding = padding;

    // Grey tile mechanics
    this.isGrey = colorIndex === -1;
    this.greyHealth = this.isGrey ? 2 : 0;

    // Vignette urgency effect
    this.vignetteIntensity = 0.0; // 0.0 = no vignette, 1.0 = max darkness

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
  }

  updateVignette() {
    this.vignetteGraphics.clear();

    // Don't draw vignette on grey tiles or when intensity is 0
    if (this.isGrey || this.vignetteIntensity === 0) return;

    const halfSize = this.tileSize / 2;
    const darkness = this.vignetteIntensity * VIGNETTE_MAX_OPACITY;

    // Create vignette effect by drawing multiple layers of semi-transparent rectangles
    // Each layer is slightly smaller to create the feathering effect
    const layers = 5;
    for (let i = 0; i < layers; i++) {
      const t = i / layers;
      const inset = t * halfSize * 0.3; // Feather inwards by 30% of tile size
      const layerOpacity = darkness * (1 - t); // Fade from edges to center

      this.vignetteGraphics.roundRect(
        -halfSize + inset,
        -halfSize + inset,
        this.tileSize - inset * 2,
        this.tileSize - inset * 2,
        TILE_CORNER_RADIUS,
      );
      this.vignetteGraphics.fill({
        color: 0x000000,
        alpha: layerOpacity / layers,
      });
    }
  }

  /**
   * Updates the tile animation
   * @param {number} deltaMS
   */
  update(deltaMS) {
    // Don't update if destroy animation is running
    if (this.destroyAnimationId) return;

    // Vignette effect is static and updates only when urgency changes
    // No per-frame animation needed
  }

  /**
   * Sets the color of the tile
   * @param {number} colorIndex - New color index (-1 for grey)
   */
  setColor(colorIndex) {
    this.colorIndex = colorIndex;
    this.isGrey = colorIndex === -1;

    if (this.isGrey) {
      this.greyHealth = 2;
    } else {
      this.greyHealth = 0;
    }

    this.updateGraphics();
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
    const originalX = this.container.x;
    const shakeStart = Date.now();

    const shake = () => {
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
    };

    shake();
  }

  /**
   * Play burnout effect
   */
  playBurnoutEffect() {
    // Flash white briefly
    const originalColor = this.graphics.tint;
    this.graphics.tint = 0xffffff;

    setTimeout(() => {
      this.graphics.tint = originalColor;
    }, BURNOUT_FLASH_DURATION);
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
    const startTime = Date.now();
    const duration = GREY_RESTORE_DELAY;

    // Start invisible and scaled down
    this.container.alpha = 0;
    this.container.scale.set(0);
    this.container.visible = true;

    const animate = () => {
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
