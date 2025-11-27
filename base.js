// Chroma - Main Game Loop

import { LEVEL_CONFIGS, setCurrentLevel, getCurrentConfig } from "./src/LevelConfig.js";
import { PulseSystem } from "./src/PulseSystem.js";
import { Grid } from "./src/Grid.js";

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
  const progressBar = document.getElementById("progress-bar");
  const statusText = document.getElementById("status-text");

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
    levelInfo.textContent = `${config.name} - Level ${gameState.level}`;
    updateProgressBarGradient();
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