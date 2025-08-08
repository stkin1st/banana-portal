const canvas = document.getElementById("bananaCanvas");
const ctx = canvas.getContext("2d");
const bananaHand = document.getElementById("bananaHand");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const bananaImg = new Image();
bananaImg.src = "banana.png";

class Banana {
  constructor() {
    this.baseX = Math.random() * canvas.width;
    this.baseY = Math.random() * canvas.height;
    this.size = Math.random() * 150 + 60;
    this.offsetX = Math.random() * 2 * Math.PI;
    this.offsetY = Math.random() * 2 * Math.PI;
    this.driftX = Math.random() * 40 + 10;
    this.driftY = Math.random() * 40 + 10;
    this.angle = Math.random() * 360;
    this.rotationSpeed = Math.random() * 0.03 + 0.005;
    this.rotationAmplitude = Math.random() * 45 + 5;
    this.phase = Math.random() * Math.PI * 2;
    this.spinStyle = Math.random() < 0.2 ? "constant" : "dynamic";
    this.spinRate = Math.random() * 10 + 5;

    this.x = Math.random() * canvas.width;
    this.y = canvas.height - this.size / 2;
    this.vy = 0;
    this.gravity = 0.5 + Math.random() * 0.05;
    this.bounceEnergy = 0;
    this.maxBounceEnergy = 15 + Math.random() * 10;
    this.popDelay = Math.random() * 5000;
    this.dropStartTime = Date.now();
    this.hasPopped = false;
    this.isTricking = false;
    this.trickTimer = 0;
    this.vx = 0;
    this.heroJump = Math.random() < 0.08;
    this.maxVX = this.heroJump ? 12 + Math.random() * 4 : 6 + Math.random() * 3;
    this.heroSpinBoost = this.heroJump ? 2 : 0;
    this.heroCooldown = 2000 + Math.random() * 3000; // time between possible re-jumps
    this.lastHeroJump = Date.now();
  }

  update(t) {
    const now = Date.now();

    if (currentEffect === "popcorn") {
      if (!this.hasPopped && now - this.dropStartTime > this.popDelay) {
        this.hasPopped = true;
        if (this.heroJump) {
          this.bounceEnergy = 18 + Math.random() * 10;
          this.vx = (Math.random() - 0.5) * 18;
          this.maxVX = 12 + Math.random() * 4;
        } else {
          this.bounceEnergy = 5 + Math.random() * 10;
          this.vx = (Math.random() - 0.5) * 8;
          this.maxVX = 6 + Math.random() * 3;
        }
        this.vy = -this.bounceEnergy * (0.9 + Math.random() * 0.2);
      }

      if (this.hasPopped) {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;

        if (this.x - this.size / 2 < 0 || this.x + this.size / 2 > canvas.width) {
          this.vx *= this.heroJump ? -0.9 : -0.5;
        }

        const floorY = canvas.height - 10;
        if (this.y + this.size / 2 >= floorY) {
          this.y = floorY - this.size / 2;
          this.vy = -this.bounceEnergy;
          this.vx += (Math.random() - 0.5) * (this.heroJump ? 1.2 : 2.0);

          if (Math.abs(this.vx) > this.maxVX) {
            this.vx = this.maxVX * Math.sign(this.vx);
          }

          this.bounceEnergy += this.heroJump ? 1.2 + Math.random() * 0.5 : 0.3 + Math.random() * 0.3;
          if (this.bounceEnergy > this.maxBounceEnergy) {
            this.bounceEnergy = this.maxBounceEnergy;
          }

          if (this.heroJump && Math.random() < 0.7) {
            this.isTricking = true;
            this.trickTimer = 30 + Math.random() * 30;
          } else if (Math.random() < 0.3) {
            this.isTricking = true;
            this.trickTimer = 20 + Math.random() * 20;
          }

          // ✅ HERO JUMP: only recharge here when touching the floor
          if (this.heroJump && now - this.lastHeroJump > this.heroCooldown && Math.random() < 0.03) {
            const superArc = Math.random() < 0.2;

            // Limit vertical strength to keep them on screen
            this.bounceEnergy = superArc ? 18 + Math.random() * 4 : 12 + Math.random() * 3;

            // Horizontal spread: wide for super arcs, medium otherwise
            this.vx = (Math.random() - 0.5) * (superArc ? 24 : 14);

            // Apply jump
            this.vy = -this.bounceEnergy * (0.85 + Math.random() * 0.15);

            // Increase energy cap slightly if needed
            this.maxBounceEnergy = Math.max(this.maxBounceEnergy, this.bounceEnergy + 3);

            // Update timers
            this.lastHeroJump = now;
            this.heroCooldown = 2500 + Math.random() * 4000;

            // Trick visuals
            this.isTricking = true;
            this.trickTimer = 40 + Math.random() * 30;
          }
        }

        if (this.isTricking) {
          this.angle += this.heroJump ? 6 : 4;
          this.trickTimer--;
          if (this.trickTimer <= 0) this.isTricking = false;
        } else {
          this.angle += this.heroJump ? 1.2 : 0.5;
        }
      }

    } else if (currentEffect === "spin") {
      if (this.spinStyle === "constant") {
        this.angle += this.spinRate;
      } else {
        // Smooth boost over time
        if (!this.spinBoost) this.spinBoost = 0;
        if (Math.random() < 0.005 && this.spinBoost < 1000) {
          this.spinBoost = 1000 + Math.random() * 1000;
        }
        if (this.spinBoost > 0) {
          this.spinBoost *= 0.96; // decay
        }

        const baseSpin = 360 * (1 + 0.5 * Math.sin(now / 300 + this.phase));
        this.angle += this.rotationSpeed * (baseSpin + this.spinBoost);
      }

    } else if (currentEffect === "wobble") {
      const noise = (Math.random() - 0.5) * 10;
      this.angle = Math.sin(t * this.rotationSpeed * 10 + this.phase) * (this.rotationAmplitude * 0.5) + noise;

    } else if (currentEffect === "stretch") {
      this.scaleX = 1 + 0.8 * Math.sin(now / 600 + this.phase);
      this.scaleY = 1 + 0.8 * Math.cos(now / 600 + this.phase);

    } else {
      const time = t;
      this.x = this.baseX + Math.sin(time + this.offsetX) * this.driftX + Math.cos(time / 3 + this.phase) * 5;
      this.y = this.baseY + Math.sin(time + this.offsetY) * this.driftY + Math.sin(time / 3 + this.phase) * 5;
      this.angle = Math.sin(time * this.rotationSpeed + this.phase) * (this.rotationAmplitude * 0.2);
      this.x += (Math.random() - 0.5) * 0.5;
      this.y += (Math.random() - 0.5) * 0.5;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle * Math.PI / 180);

    const drawSize = this.size;
    let scaleX = 1;
    let scaleY = 1;

    if (currentEffect === "stretch") {
      scaleX = this.scaleX || 1;
      scaleY = this.scaleY || 1;
    } else if (currentEffect === "popcorn") {
      const velocityThreshold = 5;
      if (Math.abs(this.vy) > velocityThreshold) {
        if (this.vy > 0) {
          scaleX = 1.2;
          scaleY = 0.8;
        } else {
          scaleX = 0.8;
          scaleY = 1.2;
        }
      }
    }

    ctx.scale(scaleX, scaleY);
    ctx.drawImage(bananaImg, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    ctx.restore();
  }
}

const bananas = [];
const maxBananas = 247;
let modeIndex = 0;
let currentEffect = null;
const effects = [null, "spin", "wobble", "stretch", "popcorn"];
let lastEffect = effects[effects.length - 1];

bananaImg.onload = () => {
  for (let i = 0; i < maxBananas; i++) {
    bananas.push(new Banana());
  }
  bananaHand.addEventListener("click", () => {
    modeIndex++;
    toggleView();
  });
  canvas.addEventListener("click", () => {
    modeIndex++;
    toggleView();
  });
  animate(0);
};

function toggleView() {
  const showCanvas = modeIndex % 2 === 1;
  canvas.style.display = showCanvas ? "block" : "none";
  bananaHand.style.display = showCanvas ? "none" : "block";

  if (showCanvas) {
    const nextIndex = (effects.indexOf(lastEffect) + 1) % effects.length;
    currentEffect = effects[nextIndex];
    lastEffect = currentEffect;

    if (currentEffect === "popcorn") {
      bananas.forEach(b => {
        b.x = Math.random() * canvas.width;
        b.y = canvas.height - b.size / 2;
        b.vy = 0;
        b.gravity = 0.5 + Math.random() * 0.05;
        b.bounceEnergy = 0;
        b.maxBounceEnergy = 15 + Math.random() * 10;
        b.popDelay = Math.random() * 5000;
        b.dropStartTime = Date.now();
        b.hasPopped = false;
        b.isTricking = false;
        b.trickTimer = 0;
      });
    } else {
      bananas.forEach(b => {
        b.x = b.baseX;
        b.y = b.baseY;
        b.angle = Math.random() * 360;
        b.vy = 0;
        b.scaleX = 1;
        b.scaleY = 1;
        b.settled = false;
        b.hasDropped = false;
        b.hasPopped = false;
      });
    }
  } else {
    currentEffect = null;
  }
}

function animate(t) {
  requestAnimationFrame(animate);
  t = t / 300;
  if (canvas.style.display === "none") return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  bananas.forEach(banana => {
    banana.update(t);
    banana.draw(ctx);
  });
}