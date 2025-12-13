// Grid.js - Manages board state, matching, and grey lock logic

import { Tile } from "./Tile.js";
import { getRandomColorIndex } from "./ColorLogic.js";
import { resolveInteraction, InteractionResult } from "./ColorLogic.js";
import {
  TILE_DROP_DURATION,
  CASCADE_DELAY,
  GREY_RESTORE_DELAY,
} from "./AnimationConstants.js";
import { triggerHaptic } from "./haptic.js";

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
    this.interactionsDisabled = false;

    // Progress tracking
    this.matchCount = 0;

    // Stagnation tracking (based on moves, not time)
    // Scale by grid size - smaller grids stagnate faster
    this.movesSinceLastMatch = 0;
    const gridArea = this.rows * this.cols;
    if (gridArea <= 25) {
      this.movesUntilStagnation = 7; // 5x5 grid
    } else if (gridArea <= 30) {
      this.movesUntilStagnation = 10; // 5x6 grid
    } else {
      this.movesUntilStagnation = 12; // 6x6 grid
    }

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
          row,
          col,
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
            // Use safe random color to avoid creating new matches
            const newColorIndex = this.getSafeRandomColor(row, col);
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
    // Check if interactions are disabled
    if (this.interactionsDisabled) {
      return;
    }

    // Trigger haptic feedback
    triggerHaptic();

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
        // Increment move counter even for locked tiles
        this.movesSinceLastMatch++;
        this.checkStagnation();
        break;

      case InteractionResult.BURNOUT:
        tile.burnout();
        this.greyCount++;
        // Advance pulse after interaction
        this.pulseSystem.advance();
        // Increment move counter
        this.movesSinceLastMatch++;
        this.checkStagnation();
        break;

      case InteractionResult.SHIFT_UP:
      case InteractionResult.SHIFT_DOWN:
        tile.setColor(result.newColorIndex, true); // Animate the color shift
        this.checkForMatches();
        // Advance pulse after interaction
        this.pulseSystem.advance();
        // Increment move counter
        this.movesSinceLastMatch++;
        this.checkStagnation();
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

      this.movesSinceLastMatch = 0; // Reset move counter when match occurs
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
    // Reset age for matched tiles and reduce age for nearby tiles
    const nearbyTiles = new Set();

    matches.forEach(({ row, col }) => {
      // Reset age for the matched tile itself
      this.tiles[row][col].resetAge();

      // Track neighbors for age reduction
      const neighbors = [
        { r: row - 1, c: col },
        { r: row + 1, c: col },
        { r: row, c: col - 1 },
        { r: row, c: col + 1 },
      ];

      neighbors.forEach(({ r, c }) => {
        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
          nearbyTiles.add(`${r},${c}`);
        }
      });
    });

    // Check adjacent grey tiles for damage
    const damagedGreyTiles = new Set();

    // Reduce age for tiles near matches and damage grey tiles
    nearbyTiles.forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      const tile = this.tiles[r][c];

      if (tile.isGrey) {
        damagedGreyTiles.add(key);
      } else {
        // Reduce age by 5 seconds for tiles near matches
        tile.reduceAge(5000);
      }
    });

    // Damage grey tiles
    damagedGreyTiles.forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      const tile = this.tiles[r][c];

      const destroyed = tile.damageGrey();

      if (destroyed) {
        tile.playDestroyEffect();
        setTimeout(() => {
          // Set new color and play restoration effect
          tile.setColor(getRandomColorIndex(this.palette.length));
          tile.playRestoreEffect();
          this.greyCount--;

          // Update urgency visuals after grey is cleared
          this.updateUrgencyVisuals();
        }, GREY_RESTORE_DELAY);
      }
    });

    // Update urgency visuals immediately after damaging greys
    this.updateUrgencyVisuals();

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
      // We need to apply the moves in order to update the grid state
      // so getSafeRandomColor can check against newly placed tiles
      const newTileMoves = [];
      for (let row = writeRow; row >= 0; row--) {
        newTileMoves.push({
          fromRow: -1, // New tile (from off-screen)
          toRow: row,
          colorIndex: null, // Will be determined below
        });
      }

      // First apply existing tile moves to update grid state
      moves.forEach((move) => {
        if (move.fromRow !== -1) {
          this.tiles[move.toRow][col].colorIndex = move.colorIndex;
        }
      });

      // Now generate safe colors for new tiles
      newTileMoves.forEach((move) => {
        move.colorIndex = this.getSafeRandomColor(move.toRow, col);
        // Update grid state for next iteration
        this.tiles[move.toRow][col].colorIndex = move.colorIndex;
      });

      // Combine all moves
      moves.push(...newTileMoves);

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
    if (!container) return; // Safety check

    container.y = startY;

    const startTime = Date.now();

    const animate = () => {
      // Safety check - container might be destroyed
      if (!container || container.destroyed) return;

      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / TILE_DROP_DURATION, 1);

      // Ease out quad for snappy feel
      const eased = 1 - Math.pow(1 - t, 2);

      try {
        container.y = startY + (targetY - startY) * eased;
      } catch (e) {
        // Container was destroyed mid-animation, stop animating
        return;
      }

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

  /**
   * Get a safe random color that won't create immediate matches
   * @param {number} row - Row position
   * @param {number} col - Column position
   * @returns {number} Safe color index
   */
  getSafeRandomColor(row, col) {
    const forbiddenColors = new Set();

    // Check if placing any color would create a vertical match
    // Look at the 2 tiles below this position
    if (row < this.rows - 2) {
      const tile1 = this.tiles[row + 1][col];
      const tile2 = this.tiles[row + 2][col];

      if (tile1 && tile2 && !tile1.isGrey && !tile2.isGrey) {
        if (tile1.colorIndex === tile2.colorIndex) {
          // Don't use this color - it would make a vertical match
          forbiddenColors.add(tile1.colorIndex);
        }
      }
    }

    // Check if placing any color would create a horizontal match
    // Look at 2 tiles to the left
    if (col >= 2) {
      const tile1 = this.tiles[row][col - 1];
      const tile2 = this.tiles[row][col - 2];

      if (tile1 && tile2 && !tile1.isGrey && !tile2.isGrey) {
        if (tile1.colorIndex === tile2.colorIndex) {
          forbiddenColors.add(tile1.colorIndex);
        }
      }
    }

    // Check 2 tiles to the right
    if (col < this.cols - 2) {
      const tile1 = this.tiles[row][col + 1];
      const tile2 = this.tiles[row][col + 2];

      if (tile1 && tile2 && !tile1.isGrey && !tile2.isGrey) {
        if (tile1.colorIndex === tile2.colorIndex) {
          forbiddenColors.add(tile1.colorIndex);
        }
      }
    }

    // Check pattern: tile - THIS - tile (sandwiched)
    if (col >= 1 && col < this.cols - 1) {
      const tileLeft = this.tiles[row][col - 1];
      const tileRight = this.tiles[row][col + 1];

      if (tileLeft && tileRight && !tileLeft.isGrey && !tileRight.isGrey) {
        if (tileLeft.colorIndex === tileRight.colorIndex) {
          forbiddenColors.add(tileLeft.colorIndex);
        }
      }
    }

    // Get available colors
    const availableColors = [];
    for (let i = 0; i < this.palette.length; i++) {
      if (!forbiddenColors.has(i)) {
        availableColors.push(i);
      }
    }

    // If all colors are forbidden (rare), just pick random
    if (availableColors.length === 0) {
      return getRandomColorIndex(this.palette.length);
    }

    // Pick random from available colors
    return availableColors[Math.floor(Math.random() * availableColors.length)];
  }

  /**
   * Calculate edge distance with top protection
   * Bottom and sides stagnate first, top is protected initially
   */
  calculateEdgeDistance(row, col) {
    const distFromBottom = this.rows - 1 - row;
    const distFromLeft = col;
    const distFromRight = this.cols - 1 - col;
    const distFromTop = row;

    // Bottom + sides are primary threat sources
    const primaryThreat = Math.min(distFromBottom, distFromLeft, distFromRight);

    // Top only becomes a threat in the top 2 rows
    // Add protection bonus that scales with board size
    const topProtectionBonus =
      distFromTop < 2 ? Math.floor(this.rows * 0.6) : 0;

    return Math.min(primaryThreat, distFromTop + topProtectionBonus);
  }

  /**
   * Count grey neighbors for clustering effect
   */
  countGreyNeighbors(row, col) {
    const neighbors = [
      { r: row - 1, c: col },
      { r: row + 1, c: col },
      { r: row, c: col - 1 },
      { r: row, c: col + 1 },
    ];

    let greyCount = 0;
    neighbors.forEach(({ r, c }) => {
      if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
        if (this.tiles[r][c].isGrey) greyCount++;
      }
    });

    return greyCount;
  }

  update(deltaMS) {
    // Only update tile visuals (for pulsing vignette effect)
    this.tiles.forEach((row) => {
      row.forEach((tile) => {
        tile.update(deltaMS);
      });
    });
  }

  /**
   * Check if stagnation should trigger and spawn grey tiles
   */
  checkStagnation() {
    // Trigger every 15 moves without a match, spawn only 1 grey at a time
    if (this.movesSinceLastMatch >= this.movesUntilStagnation) {
      this.triggerStagnation();
      // Don't reset counter to 0, just reduce by threshold
      // This allows for continued pressure
      this.movesSinceLastMatch -= this.movesUntilStagnation;
    }

    // Update urgency visuals for tiles near grey tiles
    this.updateUrgencyVisuals();
  }

  /**
   * Update urgency visuals for tiles adjacent to grey tiles
   */
  updateUrgencyVisuals() {
    this.tiles.forEach((row, r) => {
      row.forEach((tile, c) => {
        if (!tile.isGrey) {
          const greyNeighbors = this.countGreyNeighbors(r, c);

          // Only show urgency for tiles directly adjacent to greys
          if (greyNeighbors > 0) {
            // Urgency increases with number of grey neighbors
            tile.urgency = 0.5 + greyNeighbors * 0.15;
          } else {
            tile.urgency = 0;
          }
        }
      });
    });
  }

  /**
   * Spawn one grey tile using weighted selection
   */
  triggerStagnation() {
    // Build weighted list of tiles based on edge distance and clustering
    // Grey tiles can ONLY appear on edges OR adjacent to existing greys
    const candidates = [];
    const hasExistingGreys = this.greyCount > 0;

    this.tiles.forEach((row, r) => {
      row.forEach((tile, c) => {
        if (!tile.isGrey) {
          // If no greys exist yet, exclude top 2 rows entirely
          if (!hasExistingGreys && r < 2) {
            return; // Skip top rows for first grey tiles
          }

          const edgeDistance = this.calculateEdgeDistance(r, c);
          const greyNeighbors = this.countGreyNeighbors(r, c);

          // STRICT RULE: Only allow edge tiles (distance 0) OR tiles adjacent to greys
          // This ensures greys always propagate from exterior inward
          const isActualEdge = edgeDistance === 0;
          const isAdjacentToGrey = greyNeighbors > 0;

          if (!isActualEdge && !isAdjacentToGrey) {
            return; // Skip tiles that are not on edge and not adjacent to greys
          }

          // Priority: edges first, then tiles near existing greys
          const weight = 10 - edgeDistance + greyNeighbors * 5;

          candidates.push({ tile, weight, row: r, col: c });
        }
      });
    });

    if (candidates.length === 0) return;

    // Weighted random selection (edges much more likely)
    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let random = Math.random() * totalWeight;

    for (const { tile, weight } of candidates) {
      random -= weight;
      if (random <= 0) {
        tile.burnout();
        this.greyCount++;

        // Update visuals after spawning grey
        this.updateUrgencyVisuals();
        break;
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

  disableInteractions() {
    this.interactionsDisabled = true;
  }

  enableInteractions() {
    this.interactionsDisabled = false;
  }

  showLevelCompleteOverlay() {
    // Create a semi-transparent overlay
    const overlay = new PIXI.Graphics();

    const totalWidth = this.cols * (this.tileSize + this.TILE_PADDING);
    const totalHeight = this.rows * (this.tileSize + this.TILE_PADDING);

    // Green tinted overlay with pulsing effect
    overlay.rect(0, 0, totalWidth, totalHeight);
    overlay.fill({ color: 0x00ff00, alpha: 0 });

    this.container.addChild(overlay);

    // Animate the overlay
    const startTime = Date.now();
    const duration = 800;

    const animate = () => {
      if (!overlay || overlay.destroyed) return;

      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);

      // Pulse the alpha
      const pulse = Math.sin(t * Math.PI * 3) * 0.3 + 0.3; // 0.0 to 0.6

      try {
        overlay.clear();
        overlay.rect(0, 0, totalWidth, totalHeight);
        overlay.fill({ color: 0x00ff00, alpha: pulse });
      } catch (e) {
        return;
      }

      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();

    // Store reference for cleanup
    this.levelCompleteOverlay = overlay;
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
