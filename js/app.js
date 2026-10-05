// ---- Elements ----
const els = {
  card: document.querySelector(".card"),
  stopwatchTab: document.getElementById("stopwatchTab"),
  timerTab: document.getElementById("timerTab"),
  stopwatchPanel: document.getElementById("stopwatchPanel"),
  timerPanel: document.getElementById("timerPanel"),

  swDisplay: document.getElementById("swDisplay"),
  swStartPause: document.getElementById("swStartPause"),
  swLap: document.getElementById("swLap"),
  swReset: document.getElementById("swReset"),
  lapList: document.getElementById("lapList"),

  ringWrap: document.querySelector(".ring-wrap"),
  timerRing: document.getElementById("timerRing"),
  timerDisplay: document.getElementById("timerDisplay"),
  minInput: document.getElementById("minInput"),
  secInput: document.getElementById("secInput"),
  presetRow: document.getElementById("presetRow"),
  timerStartPause: document.getElementById("timerStartPause"),
  timerReset: document.getElementById("timerReset"),
};

// ---- Tab switching ----
function setMode(mode) {
  const isTimer = mode === "timer";
  els.stopwatchPanel.hidden = isTimer;
  els.timerPanel.hidden = !isTimer;
  els.stopwatchTab.classList.toggle("is-active", !isTimer);
  els.stopwatchTab.setAttribute("aria-selected", String(!isTimer));
  els.timerTab.classList.toggle("is-active", isTimer);
  els.timerTab.setAttribute("aria-selected", String(isTimer));
}

els.stopwatchTab.addEventListener("click", () => setMode("stopwatch"));
els.timerTab.addEventListener("click", () => setMode("timer"));

// ---- Shared helpers ----
function pad(num, size = 2) {
  return String(num).padStart(size, "0");
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Web Audio unsupported — fail silently; the visual pulse still happens
  }
}

// =========================================================
// Stopwatch
// =========================================================
let swElapsedMs = 0;
let swStartTimestamp = null;
let swRunning = false;
let swRafId = null;
let lapCount = 0;
let lastLapMs = 0;

function swFormat(totalMs) {
  const centis = Math.floor((totalMs % 1000) / 10);
  const totalSeconds = Math.floor(totalMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return { main: `${pad(minutes)}:${pad(seconds)}`, ms: `.${pad(centis)}` };
}

function swRender(totalMs) {
  const { main, ms } = swFormat(totalMs);
  els.swDisplay.innerHTML = `${main}<span class="display__ms">${ms}</span>`;
}

function swTick() {
  const now = performance.now();
  swRender(swElapsedMs + (now - swStartTimestamp));
  swRafId = requestAnimationFrame(swTick);
}

function swStart() {
  swRunning = true;
  swStartTimestamp = performance.now();
  swRafId = requestAnimationFrame(swTick);
  els.swStartPause.textContent = "Pause";
  els.swStartPause.classList.add("is-running");
  els.swLap.disabled = false;
}

function swPause() {
  swRunning = false;
  swElapsedMs += performance.now() - swStartTimestamp;
  cancelAnimationFrame(swRafId);
  els.swStartPause.textContent = "Resume";
  els.swStartPause.classList.remove("is-running");
}

function swReset() {
  swRunning = false;
  cancelAnimationFrame(swRafId);
  swElapsedMs = 0;
  lapCount = 0;
  lastLapMs = 0;
  swRender(0);
  els.swStartPause.textContent = "Start";
  els.swStartPause.classList.remove("is-running");
  els.swLap.disabled = true;
  els.lapList.innerHTML = "";
}

function swLap() {
  if (!swRunning) return;
  const total = swElapsedMs + (performance.now() - swStartTimestamp);
  const split = total - lastLapMs;
  lastLapMs = total;
  lapCount += 1;

  const li = document.createElement("li");
  li.className = "lap";
  const splitFmt = swFormat(split);
  li.innerHTML = `
    <span class="lap__index">Lap ${lapCount}</span>
    <span class="lap__diff">+${splitFmt.main}${splitFmt.ms}</span>
  `;
  els.lapList.insertBefore(li, els.lapList.firstChild);
}

els.swStartPause.addEventListener("click", () => (swRunning ? swPause() : swStart()));
els.swLap.addEventListener("click", swLap);
els.swReset.addEventListener("click", swReset);

// =========================================================
// Timer (countdown)
// =========================================================
const RING_RADIUS = 90;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
els.timerRing.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
els.timerRing.style.strokeDashoffset = "0";

let timerDurationMs = 0;  // full duration of the current configuration
let timerRemainingMs = 0; // remaining time while paused (0 means "not started/paused mid-run")
let timerEndTimestamp = null;
let timerRunning = false;
let timerRafId = null;

function getInputDurationMs() {
  const minutes = Math.max(0, Number(els.minInput.value) || 0);
  const seconds = Math.max(0, Math.min(59, Number(els.secInput.value) || 0));
  return (minutes * 60 + seconds) * 1000;
}

function timerFormat(totalMs) {
  const totalSeconds = Math.ceil(totalMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad(minutes)}:${pad(seconds)}`;
}

function timerRenderRing(remainingMs, durationMs) {
  const ratio = durationMs > 0 ? Math.max(0, remainingMs / durationMs) : 0;
  els.timerRing.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - ratio)}`;
  els.timerRing.classList.toggle("is-urgent", ratio <= 0.15 && ratio > 0);
}

function timerRender(remainingMs) {
  els.timerDisplay.textContent = timerFormat(Math.max(0, remainingMs));
  timerRenderRing(remainingMs, timerDurationMs);
}

function timerTick() {
  const remaining = timerEndTimestamp - performance.now();
  if (remaining <= 0) {
    timerRender(0);
    timerFinish();
    return;
  }
  timerRender(remaining);
  timerRafId = requestAnimationFrame(timerTick);
}

function setInputsEnabled(enabled) {
  els.minInput.disabled = !enabled;
  els.secInput.disabled = !enabled;
  els.presetRow.querySelectorAll(".preset").forEach((btn) => (btn.disabled = !enabled));
}

function timerStart() {
  if (timerRemainingMs <= 0) {
    timerDurationMs = getInputDurationMs();
    if (timerDurationMs <= 0) return;
    timerRemainingMs = timerDurationMs;
  }

  timerRunning = true;
  timerEndTimestamp = performance.now() + timerRemainingMs;
  timerRafId = requestAnimationFrame(timerTick);
  els.timerStartPause.textContent = "Pause";
  els.timerStartPause.classList.add("is-running");
  setInputsEnabled(false);
}

function timerPause() {
  timerRunning = false;
  timerRemainingMs = timerEndTimestamp - performance.now();
  cancelAnimationFrame(timerRafId);
  els.timerStartPause.textContent = "Resume";
  els.timerStartPause.classList.remove("is-running");
}

function timerReset() {
  timerRunning = false;
  cancelAnimationFrame(timerRafId);
  timerDurationMs = getInputDurationMs();
  timerRemainingMs = 0;
  timerRender(timerDurationMs);
  els.timerStartPause.textContent = "Start";
  els.timerStartPause.classList.remove("is-running");
  els.timerRing.classList.remove("is-urgent");
  els.ringWrap.classList.remove("is-complete");
  setInputsEnabled(true);
}

function timerFinish() {
  timerRunning = false;
  timerRemainingMs = 0;
  els.timerStartPause.textContent = "Start";
  els.timerStartPause.classList.remove("is-running");
  setInputsEnabled(true);
  playBeep();
  els.ringWrap.classList.add("is-complete");
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  setTimeout(() => els.ringWrap.classList.remove("is-complete"), 1800);
}

els.timerStartPause.addEventListener("click", () => (timerRunning ? timerPause() : timerStart()));
els.timerReset.addEventListener("click", timerReset);

els.presetRow.querySelectorAll(".preset").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (timerRunning) return;
    els.presetRow.querySelectorAll(".preset").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    const mins = Number(btn.dataset.mins);
    els.minInput.value = mins;
    els.secInput.value = 0;
    timerRemainingMs = 0;
    timerDurationMs = getInputDurationMs();
    timerRender(timerDurationMs);
  });
});

[els.minInput, els.secInput].forEach((input) => {
  input.addEventListener("input", () => {
    if (timerRunning) return;
    els.presetRow.querySelectorAll(".preset").forEach((b) => b.classList.remove("is-active"));
    timerRemainingMs = 0;
    timerDurationMs = getInputDurationMs();
    timerRender(timerDurationMs);
  });
});

// ---- Keyboard shortcuts ----
document.addEventListener("keydown", (e) => {
  const tag = document.activeElement.tagName;
  if (tag === "INPUT") return; // don't hijack typing in the duration fields

  if (e.code === "Space") {
    e.preventDefault();
    const stopwatchActive = !els.stopwatchPanel.hidden;
    if (stopwatchActive) {
      swRunning ? swPause() : swStart();
    } else {
      timerRunning ? timerPause() : timerStart();
    }
  } else if (e.key.toLowerCase() === "l") {
    if (!els.stopwatchPanel.hidden) swLap();
  } else if (e.key.toLowerCase() === "r") {
    const stopwatchActive = !els.stopwatchPanel.hidden;
    stopwatchActive ? swReset() : timerReset();
  }
});

// ---- Init ----
swRender(0);
timerDurationMs = getInputDurationMs();
timerRender(timerDurationMs);