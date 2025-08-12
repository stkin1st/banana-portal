const canvas = document.getElementById("bananaCanvas");
const ctx = canvas.getContext("2d");
const bananaHand = document.getElementById("bananaHand");


// --- Passing breeze wave (like wind through tall grass) ---
let waveTime = 0;               // seconds
const WAVE_SPEED  = 1.15;       // how fast the wave moves horizontally
const WAVE_CYCLES = 1.1;        // how many “hills” span the canvas width
let   WAVE_K = 0;               // computed from width (radians per px)

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  WAVE_K = (WAVE_CYCLES * Math.PI * 2) / canvas.width; // safe now
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const bananaImg = new Image();
bananaImg.src = "banana.png";

let bananaBitmap = null;
bananaImg.decode()
  .then(() => createImageBitmap(bananaImg))
  .then(b => { bananaBitmap = b; })
  .catch(() => { /* fallback to bananaImg if decode/createImageBitmap not supported */ });

// --- Breeze globals ---
let windStrength = 0;   // signed: -1..+1-ish
let windGust = 0;       // occasional spikes that decay
// throttle orbit sorting to avoid z-order churn
let orbitSortFrame = 0;
let orbitAnimFrame = 0; // throttle orbit updates (update every Nth frame)
const ORBIT_SPEED = 15.0; // raise to 1.5, 2, etc. to go faster; 0.5 to go slower
let nowSec = 0; // frame timestamp in seconds (set once per frame in animate())

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

    // Popcorn effect setup defaults
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

    // --- breeze personality ---
    this.restAngle = (Math.random() - 0.5) * 6;    // degrees; personal bias
    this.restDrift = 0;                             // slowly changing bias
    this.wavePhase = Math.random() * Math.PI * 2;   // phase offset
    this.waveAmp   = 5 + Math.random() * 9;         // per-banana wave size (deg)
    this.waveSpeed = 0.85 + Math.random() * 0.5;    // wave travel speed
    this.kJitterPhase = Math.random() * Math.PI * 2; // stiffness wobble phase
    // --- breeze response shaping ---
    this.kBase     = 0.02 + Math.random() * 0.03;  // stiffness (smaller = looser)
    this.dBase     = 0.05 + Math.random() * 0.06;  // damping   (varied)
    this.response  = 0.02 + Math.random() * 0.06;  // how fast they “follow” target
    this.targetFiltered = 0;                        // low-pass of the angle target

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
            this.bounceEnergy = superArc ? 18 + Math.random() * 4 : 12 + Math.random() * 3;
            this.vx = (Math.random() - 0.5) * (superArc ? 24 : 14);
            this.vy = -this.bounceEnergy * (0.85 + Math.random() * 0.15);
            this.maxBounceEnergy = Math.max(this.maxBounceEnergy, this.bounceEnergy + 3);
            this.lastHeroJump = now;
            this.heroCooldown = 2500 + Math.random() * 4000;
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

      } else if (currentEffect === "breeze") {
        // Gentle baseline lean from global wind
        const sensitivity = (this.sensitivity ?? 1);
        const baseLean = (windStrength * 8) * sensitivity;

        // Very low-freq personal drift so they never settle perfectly
        this.restDrift = (this.restDrift ?? 0) * 0.985 + (Math.random() - 0.5) * 0.012;
        this.restAngle = Math.max(-18, Math.min(18, (this.restAngle ?? 0) + this.restDrift));

        // Air turbulence: two smoothed noise lanes per banana (no spatial wavefront)
        // Use waveTime (seconds) as our clock.
        const tt = waveTime;
        // target un-smoothed noise samples (sin for cheap periodic pseudo-noise)
        const s1 = Math.sin((this.nPhase1 ?? 0) + tt * (this.nRate1 ?? 0.5) * 2*Math.PI);
        const s2 = Math.sin((this.nPhase2 ?? 0) + tt * (this.nRate2 ?? 0.9) * 2*Math.PI);
        // smooth them (EMA) so changes are gusty, not jittery
        this.noise1 = (this.noise1 ?? 0) * 0.92 + s1 * 0.08;
        this.noise2 = (this.noise2 ?? 0) * 0.92 + s2 * 0.08;
        const turbulence = (this.noise1 + 0.7 * this.noise2) * (this.airinessDeg ?? 6);

        // Tiny high-frequency flutter (kept small)
        const flutter = Math.sin(tt * 6.0 + (this.stemX ?? 0) * 0.01) * (this.flutterAmt ?? 1.0) * 0.3;

        // Compose raw target (no coherent wave)
        const rawTarget = baseLean + this.restAngle + turbulence + flutter;

        // Low-pass the target → airy lag
        this.targetFiltered = (this.targetFiltered ?? rawTarget);
        const resp = (this.response ?? 0.03);
        this.targetFiltered += resp * (rawTarget - this.targetFiltered);

        // Spring–damper toward filtered target
        const k   = (this.kBase ?? 0.018);
        const dmp = (this.dBase ?? 0.09);
        const diff = (this.targetFiltered - this.angle);
        this.angularVel = (this.angularVel ?? 0) + (k * diff - dmp * (this.angularVel ?? 0));

        // Occasional micro-impulse gusts (prevents “metronome” lock-in)
        if (Math.random() < 0.002) {
          this.angularVel += (Math.random() - 0.5) * 0.12 * (1 + Math.abs(windStrength));
        }

        // Tiny random energy so it never dies out
        this.angularVel += (Math.random() - 0.5) * 0.0012;

        this.angle += this.angularVel;

        // Wide-ish limits with soft edge damping
        const lim = (this.maxAngle ?? 40);
        if (this.angle >  lim) { this.angle =  lim; this.angularVel *= 0.7; }
        if (this.angle < -lim) { this.angle = -lim; this.angularVel *= 0.7; }

        // Hang from stem like a pendulum
        const L = this.length || (this.size * 0.6);
        const a = this.angle * Math.PI / 180;
        // slight positional shimmer so pivots feel alive
        const shimX = Math.sin(tt*2.3 + (this.stemX ?? 0)*0.01) * 0.4;
        const shimY = Math.cos(tt*2.7 + (this.stemX ?? 0)*0.013) * 0.3;
        this.x = this.stemX + Math.sin(a) * L + shimX;
        this.y = this.stemY + Math.cos(a) * L + shimY;

        // Hair of random flutter on angle
        this.angle += (Math.random() - 0.5) * 0.04;

    } else if (currentEffect === "orbit") {
      // center every frame so it adapts to resize
      const cx = canvas.width * 0.5;
      const cy = canvas.height * 0.5;

      // speed wobble (uses global nowSec set once per frame)
      const speedWobble = 0.7 + 0.3 * Math.sin(nowSec * 0.7 + this.wobbleSeed);
      this.orbitAngle += this.orbitBaseSpeed * speedWobble * ORBIT_SPEED;

      // slow breathing of radius — oscillate around a fixed base using per-banana speed
      this.breathPhase += this.breathSpeed;
      const baseR = this.orbitBaseRadius || this.orbitRadius;
      const wobble = 1 + 0.03 * Math.sin(this.breathPhase);
      this.orbitRadiusTarget = baseR * wobble;
      // ease radius toward target
      this.orbitRadius += (this.orbitRadiusTarget - this.orbitRadius) * 0.06;
      this.depth = this.orbitRadius; // keep depth in sync

      // gentle vertical bob
      this.bobPhase = (this.bobPhase || Math.random() * Math.PI * 2) + this.bobSpeed;
      const bob = Math.sin(this.bobPhase) * this.bobAmp;

      // cache trig values
      const cosA = Math.cos(this.orbitAngle);
      const sinA = Math.sin(this.orbitAngle);

      // position on circle + bob
      this.x = cx + cosA * this.orbitRadius;
      this.y = cy + sinA * this.orbitRadius + bob;

      // face along the tangent for a nice “flying” look
      const tx = -sinA;
      const ty =  cosA;

      // use a calmer depth signal (no bob) and stronger smoothing
      const depthRaw = this.orbitBaseRadius || this.orbitRadius;
      if (this.depthSmooth == null) this.depthSmooth = depthRaw;
      this.depthSmooth += 0.06 * (depthRaw - this.depthSmooth);
      this.depth = depthRaw;


    } else {
      // Default gentle drift (for currentEffect === null)
      const time = performance.now() * 0.003 + this.phase; // independent steady clock
      this.x = this.baseX
        + Math.sin(time + this.offsetX) * this.driftX
        + Math.cos(time / 3) * 5;
      this.y = this.baseY
        + Math.sin(time + this.offsetY) * this.driftY
        + Math.sin(time / 3) * 5;
      this.angle = Math.sin(time * this.rotationSpeed) * (this.rotationAmplitude * 0.2);
    }
  }

  draw(ctx) {
    const drawSize = this.size;

    // quick cull for non-breeze modes
    if (currentEffect !== "breeze") {
      const half = drawSize * 0.5;
      if (this.x + half < 0 || this.x - half > canvas.width ||
          this.y + half < 0 || this.y - half > canvas.height) {
        return;
      }
    }

    // Special draw path for breeze: pivot from the stem (top center)
    if (currentEffect === "breeze") {
      ctx.save();
      ctx.translate(this.stemX, this.stemY);
      ctx.rotate(this.angle * Math.PI / 180);
      // Draw from the pivot downward (top-center at 0,0)
      ctx.drawImage(bananaBitmap || bananaImg, -drawSize / 2, 0, drawSize, drawSize);
      ctx.restore();
      return;
    }

    // Default draw path (center pivot + optional scaling)
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle * Math.PI / 180);

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
    ctx.drawImage(bananaBitmap || bananaImg, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    ctx.restore();
  }
}

const bananas = [];
const maxBananas = 247;
let modeIndex = 0;
let currentEffect = null;

// Added "breeze"
const effects = [null, "spin", "wobble", "stretch", "popcorn", "breeze", "orbit"];

let lastEffect = effects[effects.length - 1];

bananaImg.onload = () => {
  for (let i = 0; i < maxBananas; i++) {
  const b = new Banana();
  b.id = i;               // stable tiebreaker
  bananas.push(b);
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

    // 2️⃣ SPECIAL ENTRANCE EFFECTS — custom spawn logic
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
        // give each banana its own response + spring feel + noise
        b.response = 0.02 + Math.random() * 0.03;   // how quickly target changes are followed
      });

    } else if (currentEffect === "breeze") {
      bananas.forEach(b => {
        // Pick a stem point across the top 20% of the canvas
        b.stemX = Math.random() * canvas.width;
        b.stemY = 10 + Math.random() * (canvas.height * 0.30);

        // Pendulum-ish parameters
        b.length = b.size * (0.55 + Math.random() * 0.15);
        b.angle = (Math.random() - 0.5) * 10;
        b.angularVel = 0;

        b.stiffness   = 0.02 + Math.random() * 0.03; // was ~0.035..0.07
        b.damping     = 0.05 + Math.random() * 0.05; // was ~0.06..0.12
        b.sensitivity = 0.7 + Math.random() * 0.9;
        b.maxAngle    = 28 + Math.random() * 12;

        // NEW: wave phase & amplitude (varies per leaf)
        b.wavePhase = Math.random() * Math.PI * 2;
        b.waveAmp   = 6 + Math.random() * 10; // degrees added by the passing wave

        // Clear unrelated states
        b.vx = 0; b.vy = 0;
        b.hasPopped = false;
        b.isTricking = false;
        b.trickTimer = 0;

        // Position will be recomputed in update()
        b.x = b.stemX;
        b.y = b.stemY + b.length;

        b.kBase    = 0.012 + Math.random() * 0.020; // springiness
          b.dBase    = 0.20  + Math.random() * 0.15;  // damping
          b.noise    = 0;                              // filtered noise state

        // give each banana its own airy personality (no big sine wave)
        b.response = 0.02 + Math.random() * 0.03;   // how quickly it follows changes
        b.kBase    = 0.016 + Math.random() * 0.02;  // softer spring (looser)
        b.dBase    = 0.08  + Math.random() * 0.10;  // heavier damping (less pendulum)

        b.noise1 = 0; b.noise2 = 0;                 // smoothed noise states
        b.nRate1 = 0.25 + Math.random() * 0.45;     // Hz-ish (slow)
        b.nRate2 = 0.60 + Math.random() * 0.90;     // a bit faster
        b.nPhase1 = Math.random() * Math.PI * 2;
        b.nPhase2 = Math.random() * Math.PI * 2;

        b.airinessDeg = 6 + Math.random() * 10;     // how much turbulence can bend it (°)
        b.flutterAmt  = 0.12 + Math.random() * 1.2;  // tiny high-freq jitter amount

      });

      // reset wind noise if you like (optional)
      // windGust = 0;  // etc.

    } else if (currentEffect === "orbit") {
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.5;

    bananas.forEach((b, i) => {
      const TAU = Math.PI * 2;

      // Spread radii across the screen (inner ring to near-corners) with a little jitter
      const diag = Math.hypot(canvas.width, canvas.height);
      const minR = Math.min(canvas.width, canvas.height) * 0.18;  // inner ring
      const maxR = diag * 0.40;                                   // outer reach

      const t = (i + Math.random() * 0.3) / bananas.length;       // 0..1 spread
      b.orbitRadius = minR + t * (maxR - minR);
      b.orbitBaseRadius = b.orbitRadius; // fixed baseline for breathing

      // Random starting angle
      b.orbitAngle = Math.random() * TAU;

      // Unique speed per banana: random base, slower when farther out, random direction
      const dir  = Math.random() < 0.5 ? -1 : 1;
      const base = 0.0012 + Math.random() * 0.0040;               // rad/frame
      b.orbitBaseSpeed = dir * base * Math.pow(minR / b.orbitRadius, 0.6);
      b.orbitSpeed     = b.orbitBaseSpeed;                         // initial speed

      b.wobbleSeed = Math.random() * Math.PI * 2;
      b.orbitRadiusTarget = b.orbitRadius;

      // Vertical bob parameters
      b.bobAmp   = 8 + Math.random() * 10;
      b.bobSpeed = 0.01 + Math.random() * 0.02;
      b.bobPhase = Math.random() * TAU;

      // Per-banana breathing parameters
      b.breathPhase = Math.random() * Math.PI * 2;
      b.breathSpeed = 0.004 + Math.random() * 0.001;

      // Depth proxy for painter's order
      b.depth = b.orbitRadius;

      // Reset unrelated state
      b.scaleX = 1; b.scaleY = 1;
      b.vx = 0; b.vy = 0; b.isPopping = false;

      // Set first position
      b.x = cx + Math.cos(b.orbitAngle) * b.orbitRadius;
      b.y = cy + Math.sin(b.orbitAngle) * b.orbitRadius;
      b.depth = b.orbitRadius;
      b.depthSmooth = b.depth;           // start smoothed depth here
    });


    // 3️⃣ DEFAULT ENTRANCE EFFECTS — generic spawn
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

  // advance passing-wave time (seconds)
  waveTime = performance.now() * 0.001;
  nowSec = performance.now() * 0.001;

  // --- Wind update each frame (only really matters in breeze) ---
  const tt   = waveTime; // same timestamp
  const base = 0.18 * Math.sin(tt * 0.18) + 0.07 * Math.sin(tt * 0.47 + 1.3);
  const slowNoise  = 0.03 * Math.sin(tt * 0.05 + 2.1);  // super low freq

  if (currentEffect === "breeze" && Math.random() < 0.002) {
    windGust = 0.6 + Math.random() * 0.7; // spike
  }
  windGust *= 0.96; // decay

  // SINGLE definition — keep this one
  const targetWind = base + slowNoise + windGust;
  windStrength = windStrength * 0.96 + targetWind * 0.04;
  windStrength = Math.max(-1.2, Math.min(1.2, windStrength));

  // clear frame
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentEffect === "orbit") {
    // ---- Global orbit animation throttle: update every 2nd frame (~30fps) ----
    orbitAnimFrame = (orbitAnimFrame + 1) | 0;
const skipUpdate = (orbitAnimFrame & 1) === 1; // update every other frame (~30fps)

    if (!skipUpdate) {
      bananas.forEach(b => b.update(t));
    }

    // Occasionally sort by smoothed depth to reduce z-order churn
    orbitSortFrame = (orbitSortFrame + 1) | 0;
    if ((orbitSortFrame & 30) === 0) {
      bananas.sort((a, b) => (a.depthSmooth - b.depthSmooth) || (a.id - b.id));
    }

    // Draw every frame
    bananas.forEach(b => b.draw(ctx));

  } else {
    // Other effects (no throttle): update then draw
    bananas.forEach(b => {
      b.update(t);
      b.draw(ctx);
    });
  }
}