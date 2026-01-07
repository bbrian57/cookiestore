// ====== 15 x 8 設定 ======
const COLS = 15;
const ROWS = 8;

// 地雷密度：可調
const MINE_RATE = 0.18;

// 數字說謊機率 20%
const LIE_RATE = 0.20;

// 終點 50% 死亡
const GOAL_DEATH_RATE = 0.50;

// 起點/終點：左側中間 -> 右側中間
const start = { x: 0, y: Math.floor(ROWS / 2) };
const goal  = { x: COLS - 1, y: Math.floor(ROWS / 2) };

let mines = [];        // boolean[ROWS][COLS]
let visited = [];      // boolean[ROWS][COLS]
let shown = [];        // number|null[ROWS][COLS]  (玩家走到格子時才記錄顯示值)
let player = { x: start.x, y: start.y };
let gameOver = false;

const statusEl = document.getElementById("status");
const boardEl = document.getElementById("board");
const gridEl = document.getElementById("grid");

const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlayTitle");
const overlayMsgEl = document.getElementById("overlayMsg");

// 直接把 cell DOM 存起來，避免重畫導致狀態消失
const cellEls = []; // cellEls[y][x]

// ====== 初始化 ======
init();

function init() {
  gameOver = false;
  boardEl.classList.remove("dead");
  overlayEl.classList.add("hidden");
  overlayEl.classList.remove("show");

  mines = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  shown = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  player = { x: start.x, y: start.y };

  buildGridDOM();
  placeMines();
  // 起點視為已踏入 -> 顯示數字
  stepOn(player.x, player.y, { forceSafe: true });
  renderAll();

  statusEl.textContent = "WASD 移動。走到右側終點。你踩的不是地板。";
}

function buildGridDOM() {
  gridEl.style.setProperty("--cols", COLS);
  gridEl.style.setProperty("--rows", ROWS);

  gridEl.innerHTML = "";
  cellEls.length = 0;

  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) {
      const d = document.createElement("div");
      d.className = "cell";
      if (x === start.x && y === start.y) d.classList.add("start");
      if (x === goal.x && y === goal.y) d.classList.add("goal");
      gridEl.appendChild(d);
      row.push(d);
    }
    cellEls.push(row);
  }
}

function placeMines() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (isStart(x, y) || isGoal(x, y)) continue;
      if (Math.random() < MINE_RATE) mines[y][x] = true;
    }
  }
}

// ====== 操作與移動 ======
document.addEventListener("keydown", (e) => {
  if (e.repeat) return;

  // R 重開
  if (e.key === "r" || e.key === "R") {
    init();
    return;
  }

  if (gameOver) return;

  const k = e.key.toLowerCase();
  let dx = 0, dy = 0;

  if (k === "w" || e.key === "ArrowUp") dy = -1;
  else if (k === "s" || e.key === "ArrowDown") dy = 1;
  else if (k === "a" || e.key === "ArrowLeft") dx = -1;
  else if (k === "d" || e.key === "ArrowRight") dx = 1;
  else return;

  e.preventDefault();
  tryMove(dx, dy);
}, { passive: false });

function tryMove(dx, dy) {
  const nx = player.x + dx;
  const ny = player.y + dy;

  if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;

  // 移動
  setPlayer(nx, ny);

  // 踏入格子
  stepOn(nx, ny);

  // 更新畫面
  renderAll();
}

function setPlayer(nx, ny) {
  // 清掉舊玩家邊框
  cellEls[player.y][player.x].classList.remove("player");
  player.x = nx;
  player.y = ny;
  cellEls[player.y][player.x].classList.add("player");
}

// ====== 踏入格子邏輯 ======
function stepOn(x, y, opts = {}) {
  visited[y][x] = true;

  // 終點：50% 死亡（先判終點，再判地雷也行；這裡照你需求做：到終點就賭 50%）
  if (isGoal(x, y) && !opts.forceSafe) {
    if (Math.random() < GOAL_DEATH_RATE) {
      die("你走到終點，但它不是出口。");
      return;
    } else {
      win("你活下來了……暫時。");
      const NEXT_LEVEL_URL = "index2.html";

      return;
    }
  }

  // 踩雷
  if (mines[y][x] && !opts.forceSafe) {
    die("你踩到了不該踩的地方。");
    return;
  }

  // 顯示周圍地雷數（玩家底下格子到達就顯示）
  const adj = countAdjacentMines(x, y);

  // 20% 說謊：第一次踏入該格時就決定顯示值，之後不變
  if (shown[y][x] === null) {
    shown[y][x] = makePossiblyLyingNumber(adj);
  }
}

function countAdjacentMines(x, y) {
  let c = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      if (mines[ny][nx]) c++;
    }
  }
  return c;
}

function makePossiblyLyingNumber(trueNum) {
  if (Math.random() >= LIE_RATE) return trueNum;

  // 說謊：±1（保底 0）
  const delta = Math.random() < 0.5 ? -1 : 1;
  let v = trueNum + delta;
  if (v < 0) v = 0;

  // 理論上上限最多 8，但這個盤面通常不會；保護一下
  if (v > 8) v = 8;
  return v;
}

// ====== 渲染 ======
function renderAll() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const el = cellEls[y][x];

      // 玩家邊框（只在活著時顯示）
      if (!gameOver && x === player.x && y === player.y) el.classList.add("player");
      else el.classList.remove("player");

      // 只有「走過的格子」才顯示數字（你要求到格子上就顯示）
      if (!gameOver && visited[y][x] && shown[y][x] !== null) {
        el.textContent = shown[y][x] === 0 ? "" : String(shown[y][x]);
      } else if (!gameOver) {
        // 未走過就空
        el.textContent = "";
      }

      // 死亡後會在 revealMines() 設置，這裡不覆蓋
      if (!gameOver) {
        el.classList.remove("mine");
        // 若曾經放過 mine dot，清掉
        const dot = el.querySelector(".mine-dot");
        if (dot) dot.remove();
      }
    }
  }
}

// ====== 死亡 / 通關 ======
function die(message) {
  gameOver = true;

  // 爆炸動畫：玩家格子
  const pEl = cellEls[player.y][player.x];
  pEl.classList.add("explode");
  pEl.textContent = ""; // 不要表情符號

  // 抖動 + 血紅覆蓋
  boardEl.classList.add("dead");

  // 顯示地雷位置
  revealMines();

  // 顯示 GAME OVER（血紅）
  showOverlay("GAME OVER", message);
}

function win(message) {
  gameOver = true;
  // 通關也可以顯示地雷（讓玩家知道其實很危險）
  revealMines();
  showOverlay("CLEAR", message);
}

function revealMines() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!mines[y][x]) continue;

      const el = cellEls[y][x];
      el.classList.add("mine");

      // 用小紅點表示地雷（比 emoji 更符合你的暗黑風格）
      const dot = document.createElement("div");
      dot.className = "mine-dot";
      el.textContent = "";
      el.appendChild(dot);
    }
  }
}
// 通用 ESC 返回主頁
(function () {
  window.addEventListener("keydown", function (e) {
    // 避免在輸入框中誤觸
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    if (e.key === "Escape") {
      // 可選：播放音效 / 顯示提示（之後可加）
      location.href = "index.html";
    }
  });
})();

function showOverlay(title, msg) {
  overlayTitleEl.textContent = title;
  overlayMsgEl.textContent = msg;

  overlayEl.classList.remove("hidden");
  // 讓 CSS transition 有時間生效
  requestAnimationFrame(() => overlayEl.classList.add("show"));
}

// ====== util ======
function isStart(x, y) { return x === start.x && y === start.y; }
function isGoal(x, y) { return x === goal.x && y === goal.y; }
// ====== 追加功能（新增，不要改原本程式）======

// 1) Esc 回主頁 index.html
//document.addEventListener("keydown", (e) => {
 // if (e.key === "Escape") {
  //  window.location.href = "index.html";
 // }
//});

// 2) 開場顯示玩法介紹（按「開始」關閉）
(function () {
  const overlay = document.getElementById("howtoOverlay");
  const btn = document.getElementById("howtoStartBtn");
  if (!overlay || !btn) return;

  // 你想每次都顯示就保留這行
  overlay.classList.remove("hidden");

  // 若你想「只顯示一次」，改成：
  // const seen = localStorage.getItem("game1_seen");
  // if (!seen) overlay.classList.remove("hidden");

  btn.addEventListener("click", () => {
    overlay.classList.add("hidden");
    // localStorage.setItem("game1_seen", "1"); // 若採「只顯示一次」可打開
  });

  // 也允許 Enter / Space 關閉
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      overlay.classList.add("hidden");
    }
  });
})();

// 3) 通關後進下一關 index2.html
// 不改你原本通關邏輯：用「偵測畫面上是否出現 CLEAR」來跳關
(function () {
  const nextUrl = "index2.html";

  // 嘗試抓你原本的 overlayTitle（如果你有這個元素）
  const overlayTitle = document.getElementById("overlayTitle");

  // 若沒有 overlayTitle，就用畫面文字掃描（保底）
  function isCleared() {
    if (overlayTitle && overlayTitle.textContent) {
      return overlayTitle.textContent.trim().toUpperCase() === "CLEAR";
    }
    return document.body.innerText.toUpperCase().includes("CLEAR");
  }

  let jumped = false;

  //function tick() {
   // if (jumped) return;
    //if (isCleared()) {
    // jumped = true;
     
   //   setTimeout(() => {
     //   window.location.href = nextUrl;
     // }, 800);
   // }
    requestAnimationFrame(tick);
 // }

  requestAnimationFrame(tick);
})();

// ====== /追加功能（新增）======
