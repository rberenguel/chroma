# Vignette and Grey Tile Mechanics

## How the Vignette Works

The vignette effect is tied to a "stagnation" timer.

1.  A timer (`timeSinceLastMatch`) tracks the milliseconds since the player last made a successful match.
2.  This timer is compared against a `stagnationThreshold` defined for each level (e.g., 30 seconds).
3.  The ratio between the timer and the threshold is used to calculate an "urgency level" from 1.0 (no urgency) to 3.0 (maximum urgency).
4.  This urgency level is passed to each individual tile.
5.  Inside the tile, the urgency level is mapped to a vignette intensity, which controls how dark the edges of the tile appear. The vignette is only visible when urgency is greater than 1.0.
6.  When a match is made, the timer resets to zero, and all vignettes disappear.

## How the Next Grey Tile is Chosen

1.  If the stagnation timer exceeds the `stagnationThreshold`, the `triggerStagnation` function is called.
2.  This function randomly selects one non-grey tile on the grid.
3.  The chosen tile is converted into a "grey" (locked) tile.
4.  The stagnation timer is then reset to zero.

---

# TODO

-   [ ] **Vignette is hard to see and grey tile resetting all vignettes is jarring**: The current implementation makes the vignette effect very subtle. Furthermore, the sudden reset of all vignettes to zero after a single grey tile appears feels abrupt and visually jarring. The effect should be more pronounced and the reset less sudden.
