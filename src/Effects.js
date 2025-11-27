// Effects.js - Visual effects for matches, burnouts, and explosions

export class ParticleEffect {
  constructor(pixiApp, x, y, color, count = 10) {
    this.app = pixiApp;
    this.particles = [];
    this.container = new PIXI.Container();
    this.container.x = x;
    this.container.y = y;

    // Create particles
    for (let i = 0; i < count; i++) {
      const particle = new PIXI.Graphics();
      const size = 3 + Math.random() * 4;
      particle.circle(0, 0, size);
      particle.fill(color);

      // Random velocity
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 3;

      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      particle.life = 1.0;
      particle.fadeSpeed = 0.02 + Math.random() * 0.02;

      this.particles.push(particle);
      this.container.addChild(particle);
    }
  }

  update() {
    let allDead = true;

    this.particles.forEach((particle) => {
      if (particle.life > 0) {
        allDead = false;

        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Apply gravity
        particle.vy += 0.2;

        // Fade out
        particle.life -= particle.fadeSpeed;
        particle.alpha = particle.life;
      }
    });

    return allDead;
  }

  getContainer() {
    return this.container;
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}

export class ScreenShake {
  constructor(container, intensity = 10, duration = 200) {
    this.container = container;
    this.intensity = intensity;
    this.duration = duration;
    this.startTime = Date.now();
    this.originalX = container.x;
    this.originalY = container.y;
    this.active = true;
  }

  update() {
    if (!this.active) return false;

    const elapsed = Date.now() - this.startTime;

    if (elapsed < this.duration) {
      const t = elapsed / this.duration;
      const currentIntensity = this.intensity * (1 - t);

      this.container.x =
        this.originalX + (Math.random() - 0.5) * currentIntensity;
      this.container.y =
        this.originalY + (Math.random() - 0.5) * currentIntensity;

      return true;
    } else {
      this.container.x = this.originalX;
      this.container.y = this.originalY;
      this.active = false;
      return false;
    }
  }
}
