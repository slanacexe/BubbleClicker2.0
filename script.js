const playBtn = document.getElementById("playBtn");
const clearLbBtn = document.getElementById("clearLbBtn");
const nicknameInput = document.getElementById("nickname");

const mainContainer = document.getElementById("mainContainer");
const menu = document.getElementById("menu");
const difficultyMenu = document.getElementById("difficultyMenu");

const gameUI = document.getElementById("gameUI");
const bubble = document.getElementById("bubble");

const fxLayer = document.getElementById("fxLayer");

const playerNameDisplay = document.getElementById("playerName");
const timeDisplay = document.getElementById("time");
const scoreDisplay = document.getElementById("score");

const leaderboardList = document.getElementById("leaderboardList");

const STORAGE_KEY = "bubbleScores_v3";

const SCORE_BASE = 10000;
// IMPORTANT: This constant must be small enough so score doesn't hit 0 too fast.
// 20s = 20000ms → 10000 - 20000*0.35 = 3000
const SCORE_K = 0.35;

const TIME_LIMIT_MS = 20000;

let currentPlayer = "";
let requiredClicks = 0;
let clicks = 0;

let startTime = 0;
let rafId = 0;
let playing = false;

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function computeScore(elapsedMs){
  return Math.max(0, Math.floor(SCORE_BASE - elapsedMs * SCORE_K));
}

function getHudSafeTop(){
  const hud = document.getElementById("scoreBoard");
  const hudRect = hud.getBoundingClientRect();
  return hudRect.bottom + 16;
}

function setBubbleThemeAndSize(level){
  // Different size + color per difficulty
  const cfg = {
    easy:   { size: 92,  main: "#3dff9a", mid: "#1ddf7f", dark: "#0ea862" },
    medium: { size: 78,  main: "#fff06a", mid: "#ffd23f", dark: "#f2a900" },
    hard:   { size: 64,  main: "#ff5a5a", mid: "#ff2e2e", dark: "#c91010" }
  }[level];

  bubble.style.width = `${cfg.size}px`;
  bubble.style.height = `${cfg.size}px`;

  // Nice glossy radial gradient
  bubble.style.background = `radial-gradient(circle at 30% 30%,
    #ffffff,
    ${cfg.main} 35%,
    ${cfg.mid} 60%,
    ${cfg.dark} 85%
  )`;
}

function randomPosition(){
  const rect = bubble.getBoundingClientRect();
  const w = rect.width || 80;
  const h = rect.height || 80;

  const safeTop = getHudSafeTop();
  const padding = 12;

  const minX = padding;
  const maxX = window.innerWidth - w - padding;

  const minY = safeTop;
  const maxY = window.innerHeight - h - padding;

  const x = Math.random() * (maxX - minX) + minX;
  const y = Math.random() * (maxY - minY) + minY;

  bubble.style.left = `${clamp(x, minX, maxX)}px`;
  bubble.style.top  = `${clamp(y, minY, maxY)}px`;
}

function spawnParticlesAtBubble(level){
  // Color particles based on difficulty too
  const colorByLevel = {
    easy:   ["#b8ffd7", "#3dff9a", "#1ddf7f"],
    medium: ["#fff7b0", "#fff06a", "#ffd23f"],
    hard:   ["#ffb3b3", "#ff5a5a", "#ff2e2e"]
  }[level] || ["#ffffff", "#00ffcc", "#00bfa5"];

  const rect = bubble.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const count = 12; // feel free to tweak
  for (let i = 0; i < count; i++){
    const p = document.createElement("div");
    p.className = "particle";
    p.style.left = `${cx}px`;
    p.style.top  = `${cy}px`;
    p.style.background = colorByLevel[Math.floor(Math.random() * colorByLevel.length)];

    // random direction (dx/dy) for CSS animation
    const dx = (Math.random() * 140 - 70).toFixed(0) + "px";
    const dy = (Math.random() * 140 - 70).toFixed(0) + "px";
    p.style.setProperty("--dx", dx);
    p.style.setProperty("--dy", dy);

    // random size
    const s = 6 + Math.random() * 8;
    p.style.width = `${s}px`;
    p.style.height = `${s}px`;

    fxLayer.appendChild(p);
    p.addEventListener("animationend", () => p.remove());
  }
}

function startGame(level){
  clicks = 0;

  if (level === "easy")   requiredClicks = 12;
  if (level === "medium") requiredClicks = 16;
  if (level === "hard")   requiredClicks = 20;

  setBubbleThemeAndSize(level);

  // Hide main window during gameplay
  mainContainer.classList.add("hidden");

  // Show HUD & bubble
  playerNameDisplay.textContent = currentPlayer;
  timeDisplay.textContent = "0.000";
  scoreDisplay.textContent = String(SCORE_BASE);

  gameUI.classList.remove("hidden");
  bubble.classList.remove("hidden");

  startTime = performance.now();
  playing = true;

  // Place bubble after HUD is visible so safeTop is correct
  requestAnimationFrame(() => {
    randomPosition();
    tick();
  });

  // store level for particles/colors
  bubble.dataset.level = level;
}

function stopLoop(){
  playing = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

function finishGame(didWin){
  stopLoop();

  bubble.classList.add("hidden");
  gameUI.classList.add("hidden");
  mainContainer.classList.remove("hidden");

  const elapsedMs = performance.now() - startTime;
  const points = computeScore(elapsedMs);

  if (didWin){
    saveResult({ name: currentPlayer, points, timeMs: elapsedMs });
    alert(`Win! Points: ${points}`);
  } else {
    alert("Time is out!");
  }

  loadLeaderboard();

  // back to difficulty selection state
  menu.classList.add("hidden");
  difficultyMenu.classList.remove("hidden");
}

function tick(){
  if (!playing) return;

  const now = performance.now();
  const elapsedMs = now - startTime;

  timeDisplay.textContent = (elapsedMs / 1000).toFixed(3);
  scoreDisplay.textContent = String(computeScore(elapsedMs));

  if (elapsedMs >= TIME_LIMIT_MS){
    finishGame(false);
    return;
  }

  rafId = requestAnimationFrame(tick);
}

bubble.addEventListener("click", () => {
  if (!playing) return;

  const level = bubble.dataset.level || "easy";

  spawnParticlesAtBubble(level);

  clicks += 1;
  randomPosition();

  if (clicks >= requiredClicks){
    finishGame(true);
  }
});

playBtn.addEventListener("click", () => {
  const nick = nicknameInput.value.trim();
  if (!nick){
    alert("Please enter nickname!");
    return;
  }

  currentPlayer = nick;
  menu.classList.add("hidden");
  difficultyMenu.classList.remove("hidden");
});

document.querySelectorAll("#difficultyMenu button[data-level]").forEach(btn => {
  btn.addEventListener("click", () => startGame(btn.dataset.level));
});

window.addEventListener("resize", () => {
  if (playing) randomPosition();
});

/* ---------- Leaderboard (points, persisted) ---------- */

function readScores(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveScores(list){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function saveResult(entry){
  let scores = readScores();

  scores.push({
    name: entry.name,
    points: entry.points,
    timeMs: entry.timeMs,
    at: Date.now()
  });

  // Sort by points desc (higher is better). Tie-breaker: faster time
  scores.sort((a, b) => (b.points - a.points) || (a.timeMs - b.timeMs));

  scores = scores.slice(0, 10);
  saveScores(scores);
}

function loadLeaderboard(){
  const scores = readScores();
  leaderboardList.innerHTML = "";

  if (scores.length === 0){
    const li = document.createElement("li");
    li.innerHTML = `<span class="name">No scores yet</span><span class="points">—</span>`;
    leaderboardList.appendChild(li);
    return;
  }

  scores.forEach((s, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="name">${idx + 1}. ${escapeHtml(s.name)}</span>
      <span class="points">${s.points} pts</span>
    `;
    leaderboardList.appendChild(li);
  });
}

clearLbBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  loadLeaderboard();
});

function escapeHtml(str){
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadLeaderboard();