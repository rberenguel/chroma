// Grid.js - Manages board state, matching, and grey lock logic

import { Tile } from "./Tile.js";
import { getRandomColorIndex } from "./ColorLogic.js";
import { resolveInteraction, InteractionResult } from "./ColorLogic.js";
import {
  TILE_DROP_DURATION,
  CASCADE_DELAY,
  GREY_RESTORE_DELAY,
} from "./AnimationConstants.js";

export class Grid {
  constructor(pixiApp, config, pulseSystem) {
    this.app = pixiApp;
    this.config = config;
    this.pulseSystem = pulseSystem;

    this.rows = config.gridSize.rows;
    this.cols = config.gridSize.cols;
    this.palette = config.palette;
    this.safeThreshold = config.safeThreshold;

    // Tile spacing constant
    this.TILE_PADDING = 8;
    this.FRAME_PADDING = 20;

    // Calculate tile size based on screen
    this.calculateTileSize();

    // Grid state
    this.tiles = [];
    this.greyCount = 0;

    // Progress tracking
    this.matchCount = 0;

    // Stagnation timer
    this.timeSinceLastMatch = 0;
    this.stagnationThreshold = config.stagnationTime;

    // Container for all tiles
    this.container = new PIXI.Container();

    // Pulse frame graphics
    this.pulseFrame = new PIXI.Graphics();
    this.pulseFrameColor = 0xffffff; // Default to white

    this.initializeGrid();
    this.centerGrid();
    this.updatePulseFrame();
  }

  calculateTileSize() {
    const margin = 40;

    const availableWidth = this.app.screen.width - margin * 2;
    const availableHeight = this.app.screen.height - margin * 2 - 100; // Leave room for UI

    const tileWidth =
      (availableWidth - this.TILE_PADDING * (this.cols + 1)) / this.cols;
    const tileHeight =
      (availableHeight - this.TILE_PADDING * (this.rows + 1)) / this.rows;

    this.tileSize = Math.min(tileWidth, tileHeight, 70); // Reduced max size to 70px
  }

  centerGrid() {
    const totalWidth = this.cols * (this.tileSize + this.TILE_PADDING);
    const totalHeight = this.rows * (this.tileSize + this.TILE_PADDING);

    this.container.x = (this.app.screen.width - totalWidth) / 2;
    this.container.y = (this.app.screen.height - totalHeight) / 2;
  }

  initializeGrid() {
    for (let row = 0; row < this.rows; row++) {
      this.tiles[row] = [];
      for (let col = 0; col < this.cols; col++) {
        const colorIndex = getRandomColorIndex(this.palette.length);
        const tile = new Tile(
          this.app,
          colorIndex,
          this.palette,
          col,
          row,
          this.tileSize,
          this.TILE_PADDING,
        );

        // Add interaction handler
        tile.getContainer().on("pointerdown", () => {
          this.onTileClick(row, col);
        });

        this.tiles[row][col] = tile;
        this.container.addChild(tile.getContainer());
      }
    }

    // Ensure no initial matches
    this.clearInitialMatches();
  }

  clearInitialMatches() {
    let hadMatches = true;
    let attempts = 0;

    while (hadMatches && attempts < 10) {
      hadMatches = false;
      attempts++;

      for (let row = 0; row < this.rows; row++) {
        for (let col = 0; col < this.cols; col++) {
          if (this.wouldCreateMatch(row, col)) {
            const newColorIndex = getRandomColorIndex(this.palette.length);
            this.tiles[row][col].setColor(newColorIndex);
            hadMatches = true;
          }
        }
      }
    }
  }

  wouldCreateMatch(row, col) {
    const tile = this.tiles[row][col];
    if (tile.isGrey) return false;

    const color = tile.colorIndex;

    // Check horizontal
    let hCount = 1;
    if (col > 0 && this.tiles[row][col - 1].colorIndex === color) hCount++;
    if (col > 1 && this.tiles[row][col - 2].colorIndex === color) hCount++;
    if (hCount >= 3) return true;

    // Check vertical
    let vCount = 1;
    if (row > 0 && this.tiles[row - 1][col].colorIndex === color) vCount++;
    if (row > 1 && this.tiles[row - 2][col].colorIndex === color) vCount++;
    if (vCount >= 3) return true;

    return false;
  }

  onTileClick(row, col) {
    const tile = this.tiles[row][col];

    // Can't interact with grey tiles directly
    if (tile.isGrey) {
      tile.playLockedEffect();
      return;
    }

    const pulseColorIndex = this.pulseSystem.getCurrentColorIndex();
    const result = resolveInteraction(
      tile.colorIndex,
      pulseColorIndex,
      this.palette,
    );

    switch (result.result) {
      case InteractionResult.LOCKED:
        tile.playLockedEffect();
        break;

      case InteractionResult.BURNOUT:
        tile.burnout();
        this.greyCount++;
        // Advance pulse after interaction
        this.pulseSystem.advance();
        break;

      case InteractionResult.SHIFT_UP:
      case InteractionResult.SHIFT_DOWN:
        tile.setColor(result.newColorIndex);
        this.checkForMatches();
        // Advance pulse after interaction
        this.pulseSystem.advance();
        break;
    }
  }

  checkForMatches() {
    const matchedTiles = [];

    // Find all matches
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const tile = this.tiles[row][col];
        if (tile.isGrey) continue;

        const matches = this.findMatches(row, col);
        if (matches.length >= 3) {
          matchedTiles.push(...matches);
        }
      }
    }

    // Remove duplicates
    const uniqueMatches = new Set(matchedTiles.map((t) => `${t.row},${t.col}`));

    if (uniqueMatches.size > 0) {
      this.processMatches(
        Array.from(uniqueMatches).map((key) => {
          const [row, col] = key.split(",").map(Number);
          return { row, col };
        }),
      );

      this.timeSinceLastMatch = 0; // Reset stagnation timer
      this.matchCount++;
    }
  }

  findMatches(row, col) {
    const tile = this.tiles[row][col];
    const color = tile.colorIndex;
    const matches = [];

    // Check horizontal
    const hMatches = [{ row, col }];
    for (let c = col - 1; c >= 0; c--) {
      if (
        this.tiles[row][c].colorIndex === color &&
        !this.tiles[row][c].isGrey
      ) {
        hMatches.push({ row, col: c });
      } else {
        break;
      }
    }
    for (let c = col + 1; c < this.cols; c++) {
      if (
        this.tiles[row][c].colorIndex === color &&
        !this.tiles[row][c].isGrey
      ) {
        hMatches.push({ row, col: c });
      } else {
        break;
      }
    }
    if (hMatches.length >= 3) matches.push(...hMatches);

    // Check vertical
    const vMatches = [{ row, col }];
    for (let r = row - 1; r >= 0; r--) {
      if (
        this.tiles[r][col].colorIndex === color &&
        !this.tiles[r][col].isGrey
      ) {
        vMatches.push({ row: r, col });
      } else {
        break;
      }
    }
    for (let r = row + 1; r < this.rows; r++) {
      if (
        this.tiles[r][col].colorIndex === color &&
        !this.tiles[r][col].isGrey
      ) {
        vMatches.push({ row: r, col });
      } else {
        break;
      }
    }
    if (vMatches.length >= 3) matches.push(...vMatches);

    return matches;
  }

  processMatches(matches) {
    // Check adjacent grey tiles for damage
    const damagedGreyTiles = new Set();

    matches.forEach(({ row, col }) => {
      // Check neighbors
      const neighbors = [
        { r: row - 1, c: col },
        { r: row + 1, c: col },
        { r: row, c: col - 1 },
        { r: row, c: col + 1 },
      ];

      neighbors.forEach(({ r, c }) => {
        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
          const neighbor = this.tiles[r][c];
          if (neighbor.isGrey) {
            damagedGreyTiles.add(`${r},${c}`);
          }
        }
      });
    });

    // Damage grey tiles
    damagedGreyTiles.forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      const destroyed = this.tiles[r][c].damageGrey();

      if (destroyed) {
        this.tiles[r][c].playDestroyEffect();
        setTimeout(() => {
          // Set new color and play restoration effect
          this.tiles[r][c].setColor(getRandomColorIndex(this.palette.length));
          this.tiles[r][c].playRestoreEffect();
          this.greyCount--;
        }, GREY_RESTORE_DELAY);
      }
    });

    // Animate matched tiles destruction and trigger cascade
    matches.forEach(({ row, col }) => {
      this.tiles[row][col].playDestroyEffect();
    });

    // After animation, drop tiles and fill from top
    setTimeout(() => {
      this.dropTilesAndFill(matches);
    }, CASCADE_DELAY);
  }

  dropTilesAndFill(removedMatches) {
    // Create a set for fast lookup
    const removedSet = new Set(removedMatches.map((m) => `${m.row},${m.col}`));

    // Process each column independently
    for (let col = 0; col < this.cols; col++) {
      // Build map of what moves where
      const moves = []; // {fromRow, toRow, colorIndex}

      // Step 1: Collect surviving tiles and where they need to move
      let writeRow = this.rows - 1; // Start from bottom
      for (let readRow = this.rows - 1; readRow >= 0; readRow--) {
        const key = `${readRow},${col}`;
        if (!removedSet.has(key)) {
          // This tile survives
          moves.push({
            fromRow: readRow,
            toRow: writeRow,
            colorIndex: this.tiles[readRow][col].colorIndex,
          });
          writeRow--;
        }
      }

      const numRemoved = this.rows - moves.length;
      if (numRemoved === 0) continue;

      // Step 2: Add new tiles from top
      for (let row = writeRow; row >= 0; row--) {
        moves.push({
          fromRow: -1, // New tile (from off-screen)
          toRow: row,
          colorIndex: getRandomColorIndex(this.palette.length),
        });
      }

      // Step 3: Apply moves with animation
      moves.forEach((move) => {
        const tile = this.tiles[move.toRow][col];
        tile.stopDestroyEffect();

        const totalSize = this.tileSize + this.TILE_PADDING;
        const targetY =
          move.toRow * totalSize + this.tileSize / 2 + this.TILE_PADDING / 2;

        let startY;
        if (move.fromRow === -1) {
          // New tile from off-screen
          startY = -totalSize;
        } else {
          // Existing tile from its current position
          startY =
            move.fromRow * totalSize +
            this.tileSize / 2 +
            this.TILE_PADDING / 2;
        }

        // Set color and start animation
        tile.setColor(move.colorIndex);
        tile.getContainer().visible = true;
        tile.getContainer().alpha = 1;
        tile.getContainer().scale.set(1);

        this.animateTileDrop(tile, startY, targetY);
      });
    }

    // Check for new matches after cascade
    setTimeout(() => {
      this.checkForMatches();
    }, CASCADE_DELAY);
  }

  animateTileDrop(tile, startY, targetY) {
    const container = tile.getContainer();
    container.y = startY;

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / TILE_DROP_DURATION, 1);

      // Ease out quad for snappy feel
      const eased = 1 - Math.pow(1 - t, 2);
      container.y = startY + (targetY - startY) * eased;

      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  animateTileFall(tile, targetRow) {
    const container = tile.getContainer();
    // ...
    // ...
    animate();
  }

  update(deltaMS) {
    // Update all tiles
    this.tiles.forEach((row) => {
      row.forEach((tile) => {
        tile.update(deltaMS);
      });
    });

    // TODO: Re-enable stagnation and vignette effects
    // // Update stagnation timer
    // this.timeSinceLastMatch += deltaMS;

    // if (this.timeSinceLastMatch > this.stagnationThreshold) {
    //   this.triggerStagnation();
    //   this.timeSinceLastMatch = 0;
    // }

    // // Update urgency based on stagnation
    // const urgencyLevel =
    //   1 + (this.timeSinceLastMatch / this.stagnationThreshold) * 2;
    // this.tiles.forEach((row) => {
    //   row.forEach((tile) => {
    //     if (!tile.isGrey) {
    //       tile.setUrgency(urgencyLevel);
    //     }
    //   });
    // });
  }

  triggerStagnation() {
    // Convert random tiles to grey - reduced spawn rate
    const numToConvert = 1; // Only 1 tile at a time

    for (let i = 0; i < numToConvert; i++) {
      const row = Math.floor(Math.random() * this.rows);
      const col = Math.floor(Math.random() * this.cols);

      if (!this.tiles[row][col].isGrey) {
        this.tiles[row][col].burnout();
        this.greyCount++;
      }
    }
  }

  getContainer() {
    return this.container;
  }

  getMatchCount() {
    return this.matchCount;
  }

  getGreyCount() {
    return this.greyCount;
  }

  updatePulseFrame() {
    this.pulseFrame.clear();

    const totalWidth = this.cols * (this.tileSize + this.TILE_PADDING);
    const totalHeight = this.rows * (this.tileSize + this.TILE_PADDING);

    const frameWidth = totalWidth + this.FRAME_PADDING * 2;
    const frameHeight = totalHeight + this.FRAME_PADDING * 2;

    // Center the frame on screen
    const frameX = (this.app.screen.width - frameWidth) / 2;
    const frameY = (this.app.screen.height - frameHeight) / 2;

    // Draw rounded rectangle frame
    this.pulseFrame.roundRect(frameX, frameY, frameWidth, frameHeight, 20);
    this.pulseFrame.stroke({ width: 8, color: this.pulseFrameColor, alpha: 1 });
  }

  setPulseFrameColor(color) {
    this.pulseFrameColor = color;
    this.updatePulseFrame();
  }

  getPulseFrame() {
    return this.pulseFrame;
  }

  destroy() {
    this.tiles.forEach((row) => {
      row.forEach((tile) => tile.destroy());
    });
    this.container.destroy({ children: true });
    this.pulseFrame.destroy();
  }
}
