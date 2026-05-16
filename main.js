import DiceBox from "https://unpkg.com/@3d-dice/dice-box@1.1.4/dist/dice-box.es.min.js";

const state = {
  sides: 6,
  count: 1,
  rolling: false,
  ready: false,
};

const els = {
  pills: document.querySelectorAll(".pill"),
  steps: document.querySelectorAll(".step"),
  count: document.getElementById("count"),
  rollBtn: document.getElementById("rollBtn"),
  arena: document.getElementById("arena"),
  result: document.getElementById("result"),
  motionOverlay: document.getElementById("motionOverlay"),
  motionAllow: document.getElementById("motionAllow"),
  motionDeny: document.getElementById("motionDeny"),
};

const isTouch =
  window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
if (isTouch) document.body.classList.add("is-touch");

const dice = new DiceBox({
  container: "#arena",
  id: "dice-canvas",
  assetPath: "assets/",
  origin: "https://unpkg.com/@3d-dice/dice-box@1.1.4/dist/",
  theme: "default",
  themeColor: "#ede0c4",
  scale: 8,
  gravity: 1.4,
  mass: 1,
  friction: 0.8,
  enableShadows: true,
});

dice
  .init()
  .then(() => {
    state.ready = true;
    dice.roll(`${state.count}d${state.sides}`);
  })
  .catch((err) => {
    console.error("DiceBox init failed", err);
  });

/* ---------- Controls ---------- */
els.pills.forEach((pill) => {
  pill.addEventListener("click", () => {
    if (state.rolling) return;
    state.sides = Number(pill.dataset.sides);
    els.pills.forEach((p) => {
      const active = p === pill;
      p.classList.toggle("is-active", active);
      p.setAttribute("aria-checked", active ? "true" : "false");
    });
  });
});

els.steps.forEach((step) => {
  step.addEventListener("click", () => {
    if (state.rolling) return;
    const delta = Number(step.dataset.step);
    state.count = Math.min(4, Math.max(1, state.count + delta));
    els.count.textContent = state.count;
  });
});

els.rollBtn.addEventListener("click", () => triggerRoll());

/* ---------- Sound ---------- */
function playDiceSound(count) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const audio = new Audio("dice-roll.mp3");
      audio.volume = 0.7;
      audio.play().catch(() => {});
    }, i * 70);
  }
}

/* ---------- Roll ---------- */
function setControlsDisabled(disabled) {
  els.pills.forEach((p) => {
    p.disabled = disabled;
  });
  els.steps.forEach((s) => {
    s.disabled = disabled;
  });
  els.rollBtn.disabled = disabled;
}

function showResult(results) {
  const values = results.map((r) => r.value);
  const total = values.reduce((a, b) => a + b, 0);
  els.result.innerHTML = `
    <div class="total">${total}</div>
    ${values.length > 1 ? `<div class="breakdown">${values.join(" · ")}</div>` : ""}
  `;
  // Force reflow then add visible class so transition runs
  void els.result.offsetWidth;
  els.result.classList.add("is-visible");
}

function clearResult() {
  els.result.classList.remove("is-visible");
}

async function triggerRoll() {
  if (state.rolling || !state.ready) return;
  state.rolling = true;
  setControlsDisabled(true);
  clearResult();

  playDiceSound(state.count);

  try {
    const notation = `${state.count}d${state.sides}`;
    await dice.roll(notation, { newStartPoint: false });
  } catch (err) {
    console.error("Roll failed", err);
  } finally {
    state.rolling = false;
    setControlsDisabled(false);
  }
}

/* ---------- Shake detection ---------- */
const SHAKE_THRESHOLD = 25;
const SHAKE_COOLDOWN_MS = 900;
let lastShakeAt = 0;

function onMotion(e) {
  const a = e.accelerationIncludingGravity || e.acceleration;
  if (!a) return;
  const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
  // accelerationIncludingGravity baseline is ~9.8; subtract it for spike detection
  const spike = Math.abs(mag - 9.8);
  if (spike < SHAKE_THRESHOLD) return;
  const now = Date.now();
  if (now - lastShakeAt < SHAKE_COOLDOWN_MS) return;
  lastShakeAt = now;
  triggerRoll();
}

function attachMotionListener() {
  window.addEventListener("devicemotion", onMotion);
}

const MOTION_KEY = "dice.motionPermission"; // "granted" | "denied"

async function initMotion() {
  if (!isTouch) return;
  if (!("DeviceMotionEvent" in window)) return;

  const stored = localStorage.getItem(MOTION_KEY);
  const needsPermission =
    typeof DeviceMotionEvent.requestPermission === "function";

  if (!needsPermission) {
    // Android / non-iOS-13+ — just attach
    attachMotionListener();
    return;
  }

  if (stored === "granted") {
    // Re-requesting still requires a user gesture on iOS, so wait for first interaction
    const onFirstTap = async () => {
      try {
        const res = await DeviceMotionEvent.requestPermission();
        if (res === "granted") attachMotionListener();
      } catch {}
      window.removeEventListener("touchend", onFirstTap);
      window.removeEventListener("click", onFirstTap);
    };
    window.addEventListener("touchend", onFirstTap, { once: true });
    window.addEventListener("click", onFirstTap, { once: true });
    return;
  }

  if (stored === "denied") return;

  // First visit — show overlay
  els.motionOverlay.hidden = false;

  els.motionAllow.addEventListener("click", async () => {
    els.motionOverlay.hidden = true;
    try {
      const res = await DeviceMotionEvent.requestPermission();
      if (res === "granted") {
        localStorage.setItem(MOTION_KEY, "granted");
        attachMotionListener();
      } else {
        localStorage.setItem(MOTION_KEY, "denied");
      }
    } catch {
      localStorage.setItem(MOTION_KEY, "denied");
    }
  });

  els.motionDeny.addEventListener("click", () => {
    els.motionOverlay.hidden = true;
    localStorage.setItem(MOTION_KEY, "denied");
  });
}

initMotion();
