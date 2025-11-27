// Chroma - Main Game Loop

import { LEVEL_CONFIGS, setCurrentLevel, getCurrentConfig } from "./src/LevelConfig.js";
import { PulseSystem } from "./src/PulseSystem.js";
import { Grid } from "./src/Grid.js";
import { COLOR_NAMES } from "./src/ColorNames.js";

(async () => {
  // --- PIXI App Setup ---
  const app = new PIXI.Application();
  await app.init({
    resizeTo: window,
    backgroundColor: 0x111111,
    antialias: true,
  });
  document.body.appendChild(app.canvas);

  // --- Game State ---
  // Check URL for level parameter
  const urlParams = new URLSearchParams(window.location.search);
  const startLevel = parseInt(urlParams.get('level')) || 1;

  let config;
  let pulseSystem;
  let grid;
  let gameState = {
    score: 0,
    level: startLevel,
  };

  // --- UI Elements ---
  const levelInfo = document.getElementById("level-info");
  const paletteIndicator = document.getElementById("palette-indicator");
  const progressBar = document.getElementById("progress-bar");
  const statusText = document.getElementById("status-text");

  // --- Helper Functions ---
  function hexToRgb(hex) {
    const r = (hex >> 16) & 0xff;
    const g = (hex >> 8) & 0xff;
    const b = hex & 0xff;
    return { r, g, b };
  }

  function colorDistance(hex1, hex2) {
    const c1 = hexToRgb(hex1);
    const c2 = hexToRgb(hex2);
    return Math.sqrt(
      Math.pow(c1.r - c2.r, 2) +
      Math.pow(c1.g - c2.g, 2) +
      Math.pow(c1.b - c2.b, 2)
    );
  }

  function findClosestColorName(hexColor) {
    let closest = COLOR_NAMES[0];
    let minDistance = Infinity;

    for (const colorDef of COLOR_NAMES) {
      const colorHex = parseInt(colorDef.hex.replace('#', ''), 16);
      const distance = colorDistance(hexColor, colorHex);
      if (distance < minDistance) {
        minDistance = distance;
        closest = colorDef;
      }
    }

    return closest.name;
  }

  function rgbToHsl(hex) {
    const rgb = hexToRgb(hex);
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) {
      return { h: 0, s: 0, l };
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h;
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }

    return { h: h * 360, s, l };
  }

  function generateLevelName(palette) {
    // Check if this is a monochrome palette (low saturation)
    const avgSaturation = palette.reduce((sum, color) => {
      const hsl = rgbToHsl(color);
      return sum + hsl.s;
    }, 0) / palette.length;

    if (avgSaturation < 0.3) {
      return "Monochrome";
    }

    // Use the extreme colors (first and last) to generate name
    const color1Name = findClosestColorName(palette[0]);
    const color2Name = findClosestColorName(palette[palette.length - 1]);

    // If very similar colors, just use one name
    if (color1Name === color2Name) {
      return color1Name;
    }

    // Combine names for interesting level titles
    return `${color1Name} to ${color2Name}`;
  }

  // --- Initialize Game ---
  function initGame() {
    // Load config for current level
    setCurrentLevel(gameState.level);
    config = getCurrentConfig();

    // Create pulse system
    pulseSystem = new PulseSystem(config.palette, config.pulseMode);

    // Create grid
    grid = new Grid(app, config, pulseSystem);
    app.stage.addChild(grid.getPulseFrame());
    app.stage.addChild(grid.getContainer());

    // Update UI
    updateLevelInfo();
  }

  // --- Update UI ---
  function updateLevelInfo() {
    const levelName = generateLevelName(config.palette);
    levelInfo.textContent = `${levelName} - Level ${gameState.level}`;
    updatePaletteIndicator();
    updateProgressBarGradient();
  }

  function updatePaletteIndicator() {
    paletteIndicator.innerHTML = '';
    config.palette.forEach(color => {
      const colorHex = `#${color.toString(16).padStart(6, "0")}`;
      const square = document.createElement('div');
      square.className = 'palette-color';
      square.style.backgroundColor = colorHex;
      paletteIndicator.appendChild(square);
    });
  }

  function updateProgressBarGradient() {
    // Create gradient from level palette colors
    const colors = config.palette.map(c => `#${c.toString(16).padStart(6, "0")}`);
    const gradient = `linear-gradient(90deg, ${colors.join(", ")})`;
    progressBar.style.background = gradient;
  }

  function updatePulseIndicator() {
    const color = pulseSystem.getCurrentColor();
    grid.setPulseFrameColor(color);
  }

  function updateProgressBar() {
    const matchCount = grid.getMatchCount();
    const progress = Math.min((matchCount / config.targetScore) * 100, 100);
    progressBar.style.width = `${progress}%`;

    // Check for level completion
    if (progress >= 100) {
      onLevelComplete();
    }
  }

  function updateStatusText() {
    const greyCount = grid.getGreyCount();

    if (greyCount > 0) {
      statusText.textContent = `⚠ ${greyCount} grey tile${greyCount > 1 ? "s" : ""}`;
      statusText.classList.add("visible");
    } else {
      statusText.classList.remove("visible");
    }
  }

  function onLevelComplete() {
    statusText.textContent = "🎉 Level Complete!";
    statusText.style.color = "#00ff00";
    statusText.classList.add("visible");

    setTimeout(() => {
      gameState.level++;

      // Check if level exists, otherwise loop back
      if (!LEVEL_CONFIGS[gameState.level]) {
        gameState.level = 1;
      }

      gameState.score = 0;
      advanceToNextLevel();
    }, 2000);
  }

  function advanceToNextLevel() {
    // Clean up
    if (grid) {
      app.stage.removeChild(grid.getPulseFrame());
      app.stage.removeChild(grid.getContainer());
      grid.destroy();
    }

    // Reset
    progressBar.style.width = "0%";
    statusText.style.color = "#ff6666";
    statusText.classList.remove("visible");

    // Reinitialize with new level
    initGame();
  }

  // --- Animation Loop (Ticker) ---
  app.ticker.add((ticker) => {
    const delta = ticker.deltaTime;

    // Update game systems
    if (pulseSystem) {
      pulseSystem.update(delta);
      updatePulseIndicator();
    }

    if (grid) {
      grid.update(delta);
      updateProgressBar();
      updateStatusText();
    }
  });

  // --- Handle Window Resize ---
  window.addEventListener("resize", () => {
    if (grid) {
      grid.calculateTileSize();
      grid.centerGrid();
      grid.updatePulseFrame();
    }
  });

  // --- Start Game ---
  initGame();
})();