const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const hudStatus = document.getElementById("hudStatus");
const hudTime = document.getElementById("hudTime");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");

const btnStart = document.getElementById("btnStart");
const btnNext = document.getElementById("btnNext");
const btnRestart = document.getElementById("btnRestart");

// ✅ 把「原始玩法說明」在一開始就備份起來，避免之後被死亡/通關文字覆蓋
const HELP_HTML = overlayText.innerHTML;

// ======= 你可改這兩個 =======
//const HOME_URL = "index.html";      // ✅ Esc 回到主頁（你的主頁檔名若不同改這裡）
//const NEXT_LEVEL_URL = "index3.html"; // ✅ 通關後去下一關
// ==========================

const AUTO_NEXT_DELAY = 1200;

const COLS = 12;      // ✅ 加寬
const ROWS = 22;
const CELL = 28;

canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

const TIME_LIMIT = 60;

// 出口：右側牆
const exitDoor = { x: COLS - 1, y: 7, h: 2 };

// 俄羅斯方塊形狀
const SHAPES = [
  [{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:3,y:0}],                 // I
  [{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}],                 // O
  [{x:1,y:0},{x:0,y:1},{x:1,y:1},{x:2,y:1}],                 // T
  [{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:1,y:2}],                 // L
  [{x:1,y:0},{x:1,y:1},{x:1,y:2},{x:0,y:2}],                 // J
  [{x:1,y:0},{x:2,y:0},{x:0,y:1},{x:1,y:1}],                 // S
  [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:2,y:1}],                 // Z
];

const COLORS = [
  "#93c5fd", "#fde68a", "#a7f3d0", "#fca5a5", "#c4b5fd", "#7cf7c6", "#f9a8d4"
];

// ========= 遊戲狀態 =========
let grid;
let player;
let activePiece = null;

let elapsed = 0;
let timeLeft = TIME_LIMIT;

let spawnTimer = 0;
let fallTimer = 0;

let state = "waiting";   // waiting | playing | win | dead | collapse
let gameStarted = false;

let collapseRow = 0;
let collapseTimer = 0;
let collapsePause = 0.5;

let shake = 0;

const keys = new Set();

// ========= 輸入 =========
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);

  if (k === "r") restart();

  // ✅ Esc 返回主頁
  if (k === "escape") {
    e.preventDefault();
    goHome();
  }

  // 防止空白捲動
  if (e.key === " ") e.preventDefault();
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

btnStart.addEventListener("click", startGame);
btnNext.addEventListener("click", goNextLevel);
btnRestart.addEventListener("click", restart);

// ========= 工具 =========
function createGrid(){
  return Array.from({length: ROWS}, () => Array(COLS).fill(null));
}
function inBounds(x,y){ return x >= 0 && x < COLS && y >= 0 && y < ROWS; }

function cellSolid(x,y){
  if (x < 0 || x >= COLS || y >= ROWS) return true;
  if (y < 0) return false;
  return grid[y][x] !== null;
}

function rectOverlapsSolid(rx, ry, rw, rh){
  const x0 = Math.floor(rx);
  const y0 = Math.floor(ry);
  const x1 = Math.ceil(rx + rw);
  const y1 = Math.ceil(ry + rh);

  for (let y = y0; y < y1; y++){
    for (let x = x0; x < x1; x++){
      if (cellSolid(x,y)) return true;
    }
  }
  return false;
}

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function showOverlay(title, html, mode){
  overlayTitle.textContent = title;
  overlayText.innerHTML = html;

  // mode: help | dead | win
  if (mode === "help"){
    btnStart.classList.remove("hidden");
    btnRestart.classList.add("hidden");
    btnNext.classList.add("hidden");
  } else if (mode === "dead"){
    btnStart.classList.add("hidden");
    btnRestart.classList.remove("hidden");
    btnNext.classList.add("hidden");
  } else if (mode === "win"){
    btnStart.classList.add("hidden");
    btnRestart.classList.remove("hidden");
    btnNext.classList.remove("hidden");
  }

  overlay.classList.remove("hidden");
}

function hideOverlay(){
  overlay.classList.add("hidden");
}

function goHome(){
  window.location.href = HOME_URL;
}

// ========= 玩家 =========
function createPlayer(){
  return {
    x: Math.floor(COLS/2),
    y: ROWS - 2,
    w: 1,
    h: 2,
    vx: 0,
    vy: 0,
    onGround: false,
    jumpBuffer: 0,
    coyote: 0
  };
}

function updatePlayer(dt){
  const left  = keys.has("a") || keys.has("arrowleft");
  const right = keys.has("d") || keys.has("arrowright");
  const jump  = keys.has("w") || keys.has(" ") || keys.has("arrowup");

  if (jump) player.jumpBuffer = 0.12;
  else player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);

  const speed = 8.5;
  const gravity = 30;
  const jumpV = 12.2;

  let targetVx = 0;
  if (left) targetVx -= speed;
  if (right) targetVx += speed;

  const accel = player.onGround ? 60 : 40;
  player.vx += (targetVx - player.vx) * Math.min(1, accel * dt);

  // 水平
  let nx = player.x + player.vx * dt;
  if (!rectOverlapsSolid(nx, player.y, player.w, player.h)){
    player.x = nx;
  } else {
    const step = Math.sign(player.vx) * 0.05;
    for (let i=0; i<60; i++){
      const tx = player.x + step;
      if (rectOverlapsSolid(tx, player.y, player.w, player.h)) break;
      player.x = tx;
    }
    player.vx = 0;
  }
  player.x = clamp(player.x, 0, COLS - player.w);

  // 地面/土狼時間
  const groundNow = rectOverlapsSolid(player.x, player.y + 0.02, player.w, player.h);
  if (groundNow){
    player.onGround = true;
    player.coyote = 0.12;
  } else {
    player.onGround = false;
    player.coyote = Math.max(0, player.coyote - dt);
  }

  // 跳躍
  if (player.jumpBuffer > 0 && (player.onGround || player.coyote > 0)){
    player.vy = -jumpV;
    player.jumpBuffer = 0;
    player.onGround = false;
    player.coyote = 0;
  }

  // 重力
  player.vy += gravity * dt;

  // 垂直
  let ny = player.y + player.vy * dt;
  if (!rectOverlapsSolid(player.x, ny, player.w, player.h)){
    player.y = ny;
  } else {
    const step = Math.sign(player.vy) * 0.05;
    for (let i=0; i<80; i++){
      const ty = player.y + step;
      if (rectOverlapsSolid(player.x, ty, player.w, player.h)) break;
      player.y = ty;
    }
    if (player.vy > 0) player.onGround = true;
    player.vy = 0;
  }

  // 被擠入方塊
  if (rectOverlapsSolid(player.x, player.y, player.w, player.h)){
    die("你被擠入方塊縫隙。");
    return;
  }

  if (state === "playing" && playerInsideExit()){
    win();
  }
}

function playerInsideExit(){
  const cx = player.x + player.w * 0.5;
  const cy = player.y + player.h * 0.5;
  return (
    Math.floor(cx) === exitDoor.x &&
    cy >= exitDoor.y && cy < exitDoor.y + exitDoor.h
  );
}

// ========= 俄羅斯方塊 =========
function spawnPiece(){
  const idx = Math.floor(Math.random() * SHAPES.length);
  const blocks = SHAPES[idx].map(b => ({...b}));
  const color = COLORS[idx % COLORS.length];

  const maxX = COLS - 4;
  const bias = Math.random() < 0.58 ? 1 : 0;
  const px = clamp(Math.floor(Math.random() * (maxX + 1)) + bias, 0, maxX);

  activePiece = { blocks, color, x: px, y: -3 };
  fallTimer = 0;
}

function pieceCollides(px, py){
  for (const b of activePiece.blocks){
    const x = px + b.x;
    const y = py + b.y;
    if (cellSolid(x,y)) return true;
  }
  return false;
}

function lockPiece(){
  for (const b of activePiece.blocks){
    const x = activePiece.x + b.x;
    const y = activePiece.y + b.y;
    if (y >= 0 && inBounds(x,y)) grid[y][x] = activePiece.color;
  }
  activePiece = null;

  if (rectOverlapsSolid(player.x, player.y, player.w, player.h)){
    die("你被新落下的方塊壓住。");
  }
}

function updatePieces(dt){
  // 更快（生成+掉落），且隨時間略微增強
  const diff = 1 + Math.min(1.3, elapsed * 0.03);

  const spawnInterval = 0.42 / diff;
  const fallInterval  = 0.20 / diff;

  spawnTimer += dt;
  if (!activePiece && spawnTimer >= spawnInterval){
    spawnTimer = 0;
    spawnPiece();
  }
  if (!activePiece) return;

  fallTimer += dt;
  while (fallTimer >= fallInterval){
    fallTimer -= fallInterval;

    const ny = activePiece.y + 1;
    if (!pieceCollides(activePiece.x, ny)){
      activePiece.y = ny;

      if (rectOverlapsSolid(player.x, player.y, player.w, player.h)){
        die("你被下墜的方塊砸中。");
        return;
      }
    } else {
      lockPiece();
      return;
    }
  }
}

// ========= 倒數 + 終局 =========
function updateCountdown(dt){
  elapsed += dt;
  timeLeft = Math.max(0, Math.ceil(TIME_LIMIT - elapsed));
  hudTime.textContent = String(timeLeft);

  if (state === "playing" && timeLeft <= 0){
    beginCollapse();
  }
}

function beginCollapse(){
  state = "collapse";
  hudStatus.textContent = "期限";
  hudStatus.style.color = "#ffd166";

  // 清場
  grid = createGrid();
  activePiece = null;
  spawnTimer = 0;
  fallTimer = 0;

  collapseRow = 0;
  collapseTimer = 0;
  collapsePause = 0.5;
}

function updateCollapse(dt){
  if (collapsePause > 0){
    collapsePause -= dt;
    return;
  }

  collapseTimer += dt;
  const interval = 0.32;
  if (collapseTimer < interval) return;
  collapseTimer = 0;

  if (collapseRow < ROWS){
    for (let x=0; x<COLS; x++){
      grid[collapseRow][x] = "#ffffff";
    }
    collapseRow++;
    shake = 0.35;

    if (rectOverlapsSolid(player.x, player.y, player.w, player.h)){
      die("時間到了，世界一層一層壓了下來。");
    }
  } else {
    die("世界封死了所有空間。");
  }
}

// ========= 結果 =========
function die(reason){
  if (state === "dead" || state === "win") return;
  state = "dead";
  hudStatus.textContent = "結局";
  hudStatus.style.color = "#ff4d6d";
  showOverlay("你死了", reason || "你被壓死了。", "dead");
}

function win(){
  if (state === "dead" || state === "win") return;
  state = "win";
  hudStatus.textContent = "逃出";
  hudStatus.style.color = "#7cf7c6";
  showOverlay("你逃出去了", "不是勝利，只是暫時離開壓迫。", "win");

  setTimeout(() => {
    if (state === "win") goNextLevel();
  }, AUTO_NEXT_DELAY);
}

function goNextLevel(){
  window.location.href = NEXT_LEVEL_URL;
}

// ========= 繪圖 =========
function draw(){
  const sx = shake > 0 ? Math.sin(performance.now() * 0.06) * 8 * shake : 0;
  const sy = shake > 0 ? Math.cos(performance.now() * 0.05) * 6 * shake : 0;
  if (shake > 0) shake = Math.max(0, shake - 0.03);

  ctx.save();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.translate(sx, sy);

  drawGridLines();
  drawLockedBlocks();
  drawActivePiece();
  drawExit();
  drawPlayer();

  ctx.restore();
}

function drawGridLines(){
  ctx.lineWidth = 1;
  for (let y = 0; y <= ROWS; y++){
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.moveTo(0, y*CELL);
    ctx.lineTo(COLS*CELL, y*CELL);
    ctx.stroke();
  }
  for (let x = 0; x <= COLS; x++){
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.moveTo(x*CELL, 0);
    ctx.lineTo(x*CELL, ROWS*CELL);
    ctx.stroke();
  }
}

function drawCell(x,y,color){
  const px = x*CELL, py = y*CELL;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(px+3, py+4, CELL-2, CELL-2);

  ctx.fillStyle = color;
  ctx.fillRect(px+1, py+1, CELL-2, CELL-2);

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(px+3, py+3, CELL-8, CELL-10);

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.strokeRect(px+1, py+1, CELL-2, CELL-2);
}

function drawLockedBlocks(){
  for (let y=0; y<ROWS; y++){
    for (let x=0; x<COLS; x++){
      const c = grid[y][x];
      if (c) drawCell(x,y,c);
    }
  }
}

function drawActivePiece(){
  if (!activePiece) return;
  for (const b of activePiece.blocks){
    const x = activePiece.x + b.x;
    const y = activePiece.y + b.y;
    if (y < 0) continue;
    drawCell(x,y,activePiece.color);
  }
}

function drawExit(){
  const x = exitDoor.x * CELL;
  const y = exitDoor.y * CELL;
  const w = CELL;
  const h = exitDoor.h * CELL;

  ctx.save();
  ctx.shadowColor = "rgba(124,247,198,0.95)";
  ctx.shadowBlur = 18;

  ctx.fillStyle = "rgba(124,247,198,0.10)";
  ctx.fillRect(x+1, y+1, w-2, h-2);

  ctx.strokeStyle = "rgba(124,247,198,0.95)";
  ctx.lineWidth = 3;
  ctx.strokeRect(x+2, y+2, w-4, h-4);

  ctx.restore();
}

function drawPlayer(){
  const px = player.x * CELL;
  const py = player.y * CELL;
  const pw = player.w * CELL;
  const ph = player.h * CELL;

  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.35)";
  ctx.shadowBlur = 10;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 3;
  ctx.strokeRect(px+2, py+2, pw-4, ph-4);
  ctx.restore();
}

// ========= 流程 =========
function startGame(){
  if (gameStarted) return;
  gameStarted = true;
  state = "playing";
  hudStatus.textContent = "生存";
  hudStatus.style.color = "";
  hideOverlay();
}

let last = 0;
function loop(ts){
  if (!last) last = ts;
  let dt = (ts - last) / 1000;
  last = ts;
  dt = Math.min(0.033, dt);

  if (state === "playing" && gameStarted){
    updateCountdown(dt);
    updatePieces(dt);
    updatePlayer(dt);
  } else if (state === "collapse" && gameStarted){
    updatePlayer(dt);
    updateCollapse(dt);
  }

  draw();
  requestAnimationFrame(loop);
}

// ========= 重新開始 =========
function restart(){
  grid = createGrid();
  player = createPlayer();
  activePiece = null;

  elapsed = 0;
  timeLeft = TIME_LIMIT;

  spawnTimer = 0;
  fallTimer = 0;

  collapseRow = 0;
  collapseTimer = 0;
  collapsePause = 0.5;

  shake = 0;

  state = "waiting";
  gameStarted = false;

  hudStatus.textContent = "等待";
  hudStatus.style.color = "";
  hudTime.textContent = String(TIME_LIMIT);

  keys.clear();

  // ✅ 永遠用備份的 HELP_HTML 顯示玩法說明，不會被死亡/通關文字污染
  showOverlay("玩法說明", HELP_HTML, "help");
}

// 初始
grid = createGrid();
player = createPlayer();
hudTime.textContent = String(TIME_LIMIT);

// 進入遊戲先顯示玩法說明
hudStatus.textContent = "等待";
showOverlay("玩法說明", HELP_HTML, "help");

requestAnimationFrame(loop);
