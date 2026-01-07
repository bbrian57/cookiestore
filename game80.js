// game.js - 2025 視覺優化、PvE 整合與地圖適配修正版

const menuDiv = document.getElementById('menu');
const mapMenuDiv = document.getElementById('mapMenu');
const mapListDiv = document.getElementById('mapList');
const selectedMapLabel = document.getElementById('selectedMapLabel');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlayMsg');

let selectedMap = 'flat';
let selectedMode = null; // 'local' 或 'pve'
let gameLoopId = null;
let gameLoopRunning = false;
let running = true;
let paused = false;
let aiLevel = 'easy'; // 預設為簡單
let itemModeEnabled = true; // 預設開啟



let p1 = null, p2 = null, platforms = [], projectiles = [];
let loots = [];
let lastLootSpawnTime = Date.now();
let nextSpawnDelay = 5000 + Math.random() * 5000; // 隨機 5-10 秒
const keys = {};
// 物理參數優化
const PLAYER_W = 40;
const PLAYER_H = 56;
const GRAVITY = 0.45;     // 輕盈重力
const MAX_SPEED = 4.5;    // 標準跑速
const JUMP_FORCE = -12;   // 跳躍力道
// 道具屬性定義
const LOOT_TYPES = {
  GREEN: { color: '#2ecc71', label: '+HP', effect: (p) => {
    p.hp = Math.min(p.hp + 1, 6);
    spawnPickupFX(p, '#2ecc71'); // 觸發綠色特效
  }},
  RED:   { color: '#e74c3c', label: '+ATK', effect: (p) => { 
    p.extraDamage = 1; 
    spawnPickupFX(p, '#e74c3c'); // 觸發紅色特效
    setTimeout(() => p.extraDamage = 0, 2000); 
  }},
  BLUE:  { color: '#3498db', label: '+SPD', effect: (p) => { 
    p.speedBuff = 1.6; 
    spawnPickupFX(p, '#3498db'); // 觸發藍色特效
    setTimeout(() => p.speedBuff = 1, 3000); 
  }}
};

// 吃到道具的專屬特效函式
function spawnPickupFX(p, color) {
  // 1. 讓果凍身體瞬間膨脹一下
  p.targetScaleX = 1.5;
  p.targetScaleY = 1.5;
  
  // 2. 噴出大量對應顏色的粒子 (利用你原本的粒子系統)
  for (let i = 0; i < 15; i++) {
    p.particles.push({
      x: p.x + p.w / 2,
      y: p.y + p.h / 2,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      life: 1.0,
      size: Math.random() * 5 + 3,
      color: color // 這裡要確保你的 updateParticles 會讀取這個顏色
    });
  }
}

/* ------------------------- 主選單背景動畫 (2025 動態微粒) ------------------------- */
const bgCanvas = document.getElementById('menuBg');
const bgCtx = bgCanvas ? bgCanvas.getContext('2d') : null;
let menuParticles = [];

function initMenuBg() {
  if (!bgCanvas) return;
  // 核心修正：強制使用視窗寬高，確保畫布撐滿
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
  menuParticles = [];
  for (let i = 0; i < 60; i++) {
    menuParticles.push({
      x: Math.random() * bgCanvas.width,
      y: Math.random() * bgCanvas.height,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      size: Math.random() * 3 + 1,
      color: Math.random() > 0.5 ? '#00fff2' : '#ff4757'
    });
  }
}
function drawMenuBg() {
  // 檢查選單是否顯示：檢查 menu 或 mapMenu 是否其中之一不是 none
  const isVisible = (menuDiv && menuDiv.style.display !== 'none') || 
                    (mapMenuDiv && mapMenuDiv.style.display !== 'none');

  if (isVisible && bgCtx) {
    bgCtx.fillStyle = '#0a0a12';
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    
    menuParticles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = bgCanvas.width;
      if (p.x > bgCanvas.width) p.x = 0;
      if (p.y < 0) p.y = bgCanvas.height;
      if (p.y > bgCanvas.height) p.y = 0;
      
      bgCtx.beginPath();
      bgCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      bgCtx.fillStyle = p.color;
      bgCtx.globalAlpha = 0.3;
      bgCtx.fill();
    });

    // 呼叫展示果凍 (確保這個函式也存在)
    if (typeof drawMenuPreview === 'function') drawMenuPreview();
  }
  requestAnimationFrame(drawMenuBg);
}
// 初始化並啟動
window.addEventListener('resize', initMenuBg);
initMenuBg();
drawMenuBg();
/* ------------------------- 展示用果凍函式 ------------------------- */
function drawMenuPreview() {
  const time = Date.now() / 1000;
  const bounce1 = Math.abs(Math.sin(time * 2.5)) * 40;
  const bounce2 = Math.abs(Math.cos(time * 2.5)) * 40;
  
  // 將座標從 +/- 250 改為 +/- 400，躲在選單兩側
  drawJellyPreview(bgCanvas.width / 2 - 400, bgCanvas.height / 2 + 150 - bounce1, '#ff4757');
  drawJellyPreview(bgCanvas.width / 2 + 400, bgCanvas.height / 2 + 150 - bounce2, '#2e86de');
}

function drawJellyPreview(x, y, color) {
  bgCtx.save();
  bgCtx.translate(x, y);
  // 呼吸感縮放 (2025 動態風格)
  const sY = 1 + Math.sin(Date.now()/150) * 0.1;
  bgCtx.scale(2 - sY, sY); 
  bgCtx.fillStyle = color;
  bgCtx.shadowBlur = 30; 
  bgCtx.shadowColor = color;
  bgCtx.beginPath();
  // 畫出大隻的展示果凍
  bgCtx.roundRect(-30, -60, 60, 60, [15, 15, 5, 5]);
  bgCtx.fill();
  bgCtx.restore();
}

// --- 初始化並啟動 (確保這三行在最後) ---
window.addEventListener('resize', initMenuBg);
initMenuBg();
drawMenuBg(); // 這個函式內部現在會呼叫 drawMenuPreview()
/* ------------------------- 工具函式 ------------------------- */
function rectOverlap(a, b){
  return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
}
/* ------------------------- UI 與地圖縮圖 (修正結構讀取) ------------------------- */
function generateMapPreviews(){
  if(typeof mapData === 'undefined') return;
  mapListDiv.innerHTML = '';
  for(const key in mapData){
    const item = document.createElement('div');
    item.className = 'mapItem';
    const mini = document.createElement('canvas');
    mini.width = 180; mini.height = 100;
    const mctx = mini.getContext('2d');
    
    mctx.fillStyle = '#111'; mctx.fillRect(0,0,mini.width,mini.height);
    
    // 修正點：從 mapData[key].platforms 讀取
    const mapObj = mapData[key];
    const plats = mapObj.platforms || [];
    
    mctx.fillStyle = plats[0]?.color || '#666';
    for(const plat of plats){
      const sx = mini.width / canvas.width, sy = mini.height / canvas.height;
      mctx.fillRect(plat.x * sx, plat.y * sy, plat.w * sx, plat.h * sy);
    }
    
    const lbl = document.createElement('div');
    lbl.textContent = mapNames[key] || key;
    item.appendChild(mini); item.appendChild(lbl);
    item.addEventListener('click', ()=>{
      selectedMap = key;
      selectedMapLabel.textContent = '已選地圖：' + (mapNames[key] || key);
      mapMenuDiv.style.display = 'none'; menuDiv.style.display = 'block';
    });
    mapListDiv.appendChild(item);
  }
}
generateMapPreviews();

/* ------------------------- 事件綁定 ------------------------- */
document.getElementById('mapSelectBtn').onclick = () => { menuDiv.style.display = 'none'; mapMenuDiv.style.display = 'block'; };
document.getElementById('backToMenuBtn').onclick = () => { mapMenuDiv.style.display = 'none'; menuDiv.style.display = 'block'; };
document.getElementById('randomMapBtn').onclick = () => {
  const keysArr = Object.keys(mapData);
  selectedMap = keysArr[Math.floor(Math.random()*keysArr.length)];
  selectedMapLabel.textContent = '已選地圖：' + (mapNames[selectedMap] || selectedMap);
  mapMenuDiv.style.display = 'none'; menuDiv.style.display = 'block';
};
document.getElementById('localBtn').onclick = () => { selectedMode = 'local'; startGame(); };
document.getElementById('pveBtn').onclick = () => { 
  selectedMode = 'pve'; 
  aiLevel = confirm("點擊『確定』挑戰高手，『取消』挑戰菜鳥") ? 'hard' : 'easy';
  startGame(); 
};

window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true; 
  
  // 原有的 Esc 暫停邏輯
  if(e.key === 'Escape'){ paused = !paused; }

  // 修改：在「暫停中」或「遊戲結束(!running)」時，按 Q 都能回到選單
  if((paused || !running) && (e.key === 'q' || e.key === 'Q')){
    // 1. 重置所有狀態
    paused = false; 
    running = true; // 設回 true 確保下次進入選單邏輯正確
    
    // 2. 切換 UI 顯示
    canvas.style.display = 'none'; 
    menuDiv.style.display = 'block';
    
    // 3. 顯示我們剛才優化的道具模式開關
    const itemToggle = document.getElementById('itemModeContainer');
    if(itemToggle) itemToggle.style.display = 'flex';
    
    // 4. 停止遊戲循環
    gameLoopRunning = false; 
    cancelAnimationFrame(gameLoopId);
  }

  if(e.key === 'r' || e.key === 'R'){ startGame(); }
});

window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
/* ------------------------- 核心邏輯 (修正出生點) ------------------------- */
function createPlayer(x, color, controls){
  return {
    x, y: 0, vx:0, vy:0, w:PLAYER_W, h:PLAYER_H,
    color, facing:1, onGround:true, hp:6, invulnerableTime:0,
    attackCooldown:0, attacking:false, attackTimer:0, isDefending:false, controls,

    // --- 新增增益屬性 ---
    speedBuff: 1,      // 速度倍率，預設 1
    extraDamage: 0,    // 額外傷害，預設 0
    // --- 2025 新增：果凍動畫與特效屬性 ---
    currentScaleX: 1,  // 當前水平縮放
    currentScaleY: 1,  // 當前垂直縮放
    targetScaleX: 1,   // 目標水平縮放
    targetScaleY: 1,   // 目標垂直縮放
    animTimer: 0,      // 呼吸動畫計時器
    particles: [],     // 存放該角色的煙霧粒子
    isLanding: false   // 落地狀態標記
  };
}

function initGame(map, p1Color, p2Color){
  // 修正點：適配物件格式
  const mapObj = mapData[map] || mapData['flat'];
  
  platforms = mapObj.platforms.map(p => ({
    ...p, startX: p.x, startY: p.y, dx: p.dx || 0, dy: p.dy || 0, range: p.range || 100
  }));
  // 確保道具開關同步
  itemModeEnabled = document.getElementById('itemModeToggle').checked;
  loots = [];
  lastLootSpawnTime = Date.now();
  
  projectiles = [];
  
  // 修正點：使用地圖設定的出生座標，解決一出生就死掉的問題
  const sP1 = mapObj.spawn.p1;
  const sP2 = mapObj.spawn.p2;

  p1 = createPlayer(sP1.x, p1Color, { left:'a', right:'d', jump:'w', attack:'f', defend:'s', shoot:'g' });
  p1.y = sP1.y; 
  
  p2 = createPlayer(sP2.x, p2Color, { left:'arrowleft', right:'arrowright', jump:'arrowup', attack:'1', defend:'arrowdown', shoot:'2' });
  p2.y = sP2.y;

  running = true; paused = false; lastTime = 0;
  if(!gameLoopRunning) { gameLoopRunning = true; loop(); }
  // 讀取 UI 狀態
  itemModeEnabled = document.getElementById('itemModeToggle').checked;
  loots = []; 
  lastLootSpawnTime = Date.now();
}

function updateLoots() {
  if (!itemModeEnabled) {
    if (loots.length > 0) loots = []; // 如果關閉模式，清空場上道具
    return; // 直接結束函式，不執行生成與掉落
  }
  const now = Date.now();
  // 邏輯：若場上沒道具，且時間到了就生成
  if (loots.length === 0 && now - lastLootSpawnTime > nextSpawnDelay) {
    const keys = Object.keys(LOOT_TYPES);
    const type = LOOT_TYPES[keys[Math.floor(Math.random() * keys.length)]];
    loots.push({
      x: Math.random() * (canvas.width - 30),
      y: -50, 
      vy: 0, 
      w: 24, h: 24, 
      type: type,
      angle: 0,          // 新增：用於控制左右晃動
      isGrounded: false  // 新增：記錄是否已經落地
    });
    lastLootSpawnTime = now;
    nextSpawnDelay = 5000 + Math.random() * 5000;
  }

  for (let i = loots.length - 1; i >= 0; i--) {
    let l = loots[i];

    if (!l.isGrounded) {
      // --- 飄落邏輯修正 ---
      // 1. 給予極小的重力加速度，並限制最大下墜速度 (終端速度)
      l.vy += 0.05; 
      if (l.vy > 1.2) l.vy = 1.2; // 限制下墜速度，讓它「慢慢飄」
      l.y += l.vy;

      // 2. 增加左右晃動感 (正弦波位移)
      l.angle += 0.04; 
      l.x += Math.sin(l.angle) * 1.5; 
    }

    // 平台碰撞 (留在地板上)
    platforms.forEach(plat => {
      if (l.x + l.w > plat.x && l.x < plat.x + plat.w) {
        if (l.vy >= 0 && l.y + l.h <= plat.y + 10 && l.y + l.h + l.vy >= plat.y) {
          l.y = plat.y - l.h;
          l.vy = 0;
          l.isGrounded = true; // 落地後鎖定，不再晃動
        }
      }
    });

    // 玩家拾取
    [p1, p2].forEach(p => {
      if (rectOverlap(p, l)) {
        l.type.effect(p);
        loots.splice(i, 1);
      }
    });

    // 掉入虛空刪除
    if (l.y > canvas.height) loots.splice(i, 1);
  }
}


function drawLoots() {
  loots.forEach(l => {
    ctx.save();
    ctx.translate(l.x + l.w/2, l.y + l.h/2);
    // 霓虹球體效果
    ctx.shadowBlur = 15; ctx.shadowColor = l.type.color;
    ctx.fillStyle = l.type.color;
    ctx.beginPath();
    ctx.arc(0, 0, l.w/2, 0, Math.PI * 2);
    ctx.fill();
    // 繪製加號
    ctx.fillStyle = "#fff";
    ctx.fillRect(-2, -7, 4, 14); // 垂直
    ctx.fillRect(-7, -2, 14, 4); // 水平
    ctx.restore();
  });
}
/* ------------------------- AI 邏輯 (高手格擋加強版) ------------------------- */
let aiJumpTimer = 0; 

function updateAI(ai, player) {
  const dist = ai.x - player.x;
  const isHard = (aiLevel === 'hard');
  if (aiJumpTimer > 0) aiJumpTimer--;

  // 1. 初始化指令
  keys[ai.controls.jump] = false;
  keys[ai.controls.defend] = false; // 預設不防禦
  let moveDirection = 0; 
  const chaseDist = isHard ? 40 : 100;
  if (dist > chaseDist) moveDirection = -1;
  else if (dist < -chaseDist) moveDirection = 1;

  // 2. 落地預測與懸崖防護 (維持原有機制)
  if (ai.onGround) {
    const estimatedJumpDist = MAX_SPEED * 22; 
    let predictedLandX = ai.x + (ai.w / 2) + (estimatedJumpDist * moveDirection);
    let landingSpotSafe = false;
    const checkY = ai.y + ai.h + 20; 
    for (const plat of platforms) {
      if (predictedLandX > plat.x && predictedLandX < plat.x + plat.w &&
          checkY > plat.y && checkY < plat.y + 150) {
        landingSpotSafe = true;
        break;
      }
    }
    if (!landingSpotSafe && moveDirection !== 0) {
      moveDirection = 0; 
      ai.vx *= 0.1; 
    }
  }

  // 3. 【新增】高手級子彈防禦偵測
  if (isHard) {
    // 檢查畫面上所有子彈
    projectiles.forEach(prj => {
      // 條件：子彈是對手發射的
      if (prj.owner === player) {
        const bulletDist = Math.abs(prj.x - ai.x);
        const bulletVerticalDist = Math.abs(prj.y - (ai.y + ai.h / 2));
        
        // 條件：子彈在一定距離內 (200px) 且高度重疊，並且是朝向 AI 飛來
        const isBulletComing = (prj.vx > 0 && prj.x < ai.x) || (prj.vx < 0 && prj.x > ai.x);
        
        if (bulletDist < 200 && bulletVerticalDist < 40 && isBulletComing) {
          // 距離夠近時張開防禦
          if (bulletDist < 120) {
            keys[ai.controls.defend] = true;
          }
        }
      }
    });
  }

  // 4. 套用移動 (防禦時無法移動，這是遊戲平衡)
  if (keys[ai.controls.defend]) {
    moveDirection = 0;
    ai.vx *= 0.8;
  }
  keys[ai.controls.left] = (moveDirection === -1);
  keys[ai.controls.right] = (moveDirection === 1);

  // 5. 跳躍判斷 (包含頭頂偵測)
  const verticalGap = ai.y - player.y;
  if (ai.onGround && aiJumpTimer <= 0 && !keys[ai.controls.defend]) {
    const isPlayerAboveHead = verticalGap > 60 && verticalGap < 250 && Math.abs(dist) < 50;
    
    let canReachViaPlatform = false;
    if (verticalGap > 100 && Math.abs(dist) < 300) {
      const jumpHeightMax = -JUMP_FORCE * 1.5;
      const halfDistX = Math.abs(dist) / 2;
      for (const plat of platforms) {
        if (player.x >= plat.x && player.x + player.w <= plat.x + plat.w && 
            plat.y < ai.y && plat.y > ai.y - jumpHeightMax &&
            Math.abs(plat.x - ai.x) < halfDistX + 100) {
          canReachViaPlatform = true;
          break;
        }
      }
    }
    if (isPlayerAboveHead || canReachViaPlatform) {
      keys[ai.controls.jump] = true;
      aiJumpTimer = 55;
    }
  }

  // 6. 基礎戰鬥行為 (高手模式格擋機率也提高)
  const vGapAbs = Math.abs(ai.y - player.y);
  keys[ai.controls.attack] = !keys[ai.controls.defend] && Math.abs(dist) < 70 && vGapAbs < 50 && Math.random() < (isHard ? 0.25 : 0.05);
  keys[ai.controls.shoot] = !keys[ai.controls.defend] && Math.abs(dist) > 220 && vGapAbs < 80 && Math.random() < (isHard ? 0.05 : 0.01);
  
  // 原有的近戰防禦反應
  if (!keys[ai.controls.defend] && player.attacking && Math.abs(dist) < 90) {
    if (Math.random() < (isHard ? 0.7 : 0.1)) keys[ai.controls.defend] = true;
  }
}


/* ------------------------- 玩家更新 (2025 果凍變形與戰鬥整合版) ------------------------- */
/* ------------------------- 玩家更新 (道具增益整合版) ------------------------- */
function updatePlayer(player, opponent, isAI){
  if(isAI) updateAI(player, opponent);

  const ctrl = player.controls;
  player.isDefending = !!(keys[ctrl.defend] && player.attackCooldown <= 0);

  // --- 道具效果套用：計算目前最大速度 ---
  // 如果有藍色道具增益，速度會變快
  const currentMaxSpeed = MAX_SPEED * (player.speedBuff || 1);

  if(!player.isDefending){
    if(keys[ctrl.left]) { 
      player.vx = Math.max(player.vx - 0.7, -currentMaxSpeed); 
      player.facing = -1; 
    }
    else if(keys[ctrl.right]) { 
      player.vx = Math.min(player.vx + 0.7, currentMaxSpeed); 
      player.facing = 1; 
    }
    else player.vx *= 0.85;
  }

  // --- 跳躍、物理、邊界檢查 (維持原樣) ---
  if(keys[ctrl.jump] && player.onGround){ 
    player.vy = JUMP_FORCE; player.onGround = false; 
    player.targetScaleX = 0.75; player.targetScaleY = 1.25;
  }
  let curGrav = GRAVITY;
  if(Math.abs(player.vy) < 2) curGrav *= 0.5;
  player.vy += curGrav;
  player.x += player.vx; player.y += player.vy;

  player.onGround = false;
  for(const plat of platforms){
    if(player.x + player.w > plat.x && player.x < plat.x + plat.w){
      if(player.vy >= 0 && (player.y + player.h) <= plat.y + 10 && (player.y + player.h + player.vy) >= plat.y){
        if (!player.onGround && player.vy > 2) { 
          player.targetScaleX = 1.4; player.targetScaleY = 0.6; 
          if(typeof createDust === 'function') createDust(player, 5, 1);
        }
        player.y = plat.y - player.h; player.vy = 0; player.onGround = true;
        player.x += plat.dx; player.y += plat.dy;
      }
    }
  }
  if(player.x < 0) player.x = 0;
  if(player.x + player.w > canvas.width) player.x = canvas.width - player.w;
  if(player.y > canvas.height){ player.hp = 0; running = false; }

  // --- 果凍回彈物理 (維持原樣) ---
  player.currentScaleX += (player.targetScaleX - player.currentScaleX) * 0.15;
  player.currentScaleY += (player.targetScaleY - player.currentScaleY) * 0.15;
  player.targetScaleX += (1 - player.targetScaleX) * 0.1;
  player.targetScaleY += (1 - player.targetScaleY) * 0.1;

  // --- 戰鬥邏輯：近戰攻擊 ---
  if(keys[ctrl.attack] && player.attackCooldown <= 0 && !player.attacking){
    player.attacking = true; player.attackTimer = 12; player.attackCooldown = 30;
    player.targetScaleX = 1.35; player.targetScaleY = 0.85;
  }

  if(player.attacking){
    player.attackTimer--;
    if(player.attackTimer === 6 && checkAttackHit(player, opponent) && opponent.invulnerableTime <= 0){
      if(opponent.isDefending) { 
        opponent.attackCooldown = 60; opponent.targetScaleX = 0.8;
      } 
      else { 
        // --- 道具效果套用：紅色道具傷害加成 ---
        const damage = 1 + (player.extraDamage || 0);
        opponent.hp -= damage; 
        
        opponent.invulnerableTime = 20; 
        opponent.vx = player.facing * 8; opponent.vy = -5; 
        opponent.targetScaleX = 0.5; opponent.targetScaleY = 1.5;
      }
    }
    if(player.attackTimer <= 0) player.attacking = false;
  }

  // --- 遠程與 CD (維持原樣) ---
  if(keys[ctrl.shoot] && player.attackCooldown <= 0 && !player.attacking && !player.isDefending){
    projectiles.push({ 
      x: player.x + (player.facing === 1 ? player.w : -15), y: player.y + 22, 
      vx: player.facing * 12, vy: 0, w: 18, h: 8, owner: player, color: player.color
    });
    player.attackCooldown = 40;
    player.targetScaleX = 0.75; player.targetScaleY = 1.25; 
  }
  if(player.attackCooldown > 0) player.attackCooldown--;
  if(player.invulnerableTime > 0) player.invulnerableTime--;
  if(player.hp <= 0) running = false;
}


function checkAttackHit(attacker, target){
  const hitbox = { x: attacker.facing === 1 ? attacker.x + attacker.w : attacker.x - 40, y: attacker.y, w: 40, h: attacker.h };
  return rectOverlap(hitbox, target);
}

/* ------------------------- 繪圖優化 ------------------------- */
function drawBackground() {
  ctx.fillStyle = '#0f0f13';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for(let i=0; i<canvas.width; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
  for(let i=0; i<canvas.height; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke(); }
}
/* ------------------------- 繪圖優化 (2025 果凍渲染版) ------------------------- */
function drawPlayer(p, label){
  if(p.invulnerableTime % 4 > 2) return; // 受擊閃爍
  
  // 更新動畫計時器與粒子系統
  p.animTimer += 0.08; 
  updateParticles(p);// <--- 確保這行在這裡，負責計算粒子位置
   // 繪製粒子 (這段要放在 ctx.save 之前，才不會被縮放影響)
  p.particles.forEach(pt => {
    // 如果粒子有顏色就用顏色，否則用預設灰色
    ctx.fillStyle = pt.color ? pt.color : `rgba(200, 200, 200, ${pt.life * 0.5})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  });
  if(typeof updateParticles === 'function') updateParticles(p); 

  // 1. 繪製腳下噴出的煙霧粒子
  // drawPlayer 內的粒子繪圖段落
p.particles.forEach(pt => {
  ctx.fillStyle = pt.color ? pt.color : `rgba(200, 200, 200, ${pt.life * 0.5})`;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
  ctx.fill();
});
  ctx.save();
  if (p.extraDamage > 0 || p.speedBuff > 1) {
  ctx.shadowBlur = 25;
  // 如果是紅色強化就發紅光，藍色就發藍光
  ctx.shadowColor = p.extraDamage > 0 ? '#e74c3c' : '#3498db';
  
  // (選擇性) 增加一個緩慢旋轉的能量圈
  ctx.beginPath();
  ctx.arc(0, -p.h/2, p.w * 1.2, 0, Math.PI * 2);
  ctx.strokeStyle = p.extraDamage > 0 ? 'rgba(231, 76, 60, 0.3)' : 'rgba(52, 152, 219, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
}
  // 2. 核心位移：將繪圖原點移至腳底中心，果凍縮放才會正確
  ctx.translate(p.x + p.w / 2, p.y + p.h);
  ctx.scale(p.currentScaleX, p.currentScaleY);

  // 待機呼吸效果 (微弱起伏)
  if (p.onGround && Math.abs(p.vx) < 0.1) {
    p.targetScaleY = 1 + Math.sin(p.animTimer) * 0.03;
    p.targetScaleX = 1 - Math.sin(p.animTimer) * 0.03;
  }

  // 3. 繪製果凍身體 (具備圓角矩形與漸層)
  ctx.shadowBlur = 15; 
  ctx.shadowColor = p.color;
  
  let grad = ctx.createLinearGradient(0, -p.h, 0, 0);
  grad.addColorStop(0, p.color);
  grad.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = grad;

  ctx.beginPath();
  // 圓角半徑：頂部圓潤，底部貼地
  const r = 12; 
  ctx.roundRect(-p.w / 2, -p.h, p.w, p.h, [r, r, 2, 2]);
  ctx.fill();
  // 4. 加入果凍高光 (亮晶晶質感)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(-p.w / 2 + 6, -p.h + 6, p.w / 3, 5);

  // 5. 繪製眼睛 (黑色小圓點)
  ctx.fillStyle = '#000';
  const eyeX = p.facing === 1 ? p.w / 6 : -p.w / 6 - 4;
  ctx.beginPath();
  ctx.arc(eyeX, -p.h + 18, 4, 0, Math.PI * 2);
  ctx.fill();
  // 6. 防禦視覺 (2025 能量力場版)
  if(p.isDefending) { 
    ctx.save();
    // 讓護盾隨時間有輕微的擴張收縮 (呼吸感)
    const shieldPulse = Math.sin(p.animTimer * 2) * 5;
    const shieldRadius = p.w + 10 + shieldPulse;
    // 建立放射狀漸層 (內透外亮)
    let shieldGrad = ctx.createRadialGradient(0, -p.h/2, 10, 0, -p.h/2, shieldRadius);
    shieldGrad.addColorStop(0, 'rgba(0, 255, 242, 0)');     // 中心完全透明
    shieldGrad.addColorStop(0.7, 'rgba(0, 255, 242, 0.1)'); // 中間淡淡的顏色
    shieldGrad.addColorStop(1, 'rgba(0, 255, 242, 0.6)');   // 邊緣亮色
    ctx.fillStyle = shieldGrad;
    ctx.strokeStyle = '#00fff2';
    ctx.lineWidth = 2;
    
    // 繪製圓形護盾
    ctx.beginPath();
    ctx.arc(0, -p.h/2, shieldRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // 繪製發光的邊緣外圈
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00fff2';
    ctx.stroke();

    // 增加一點「能量流動」的裝飾線 (小弧線)
    ctx.beginPath();
    ctx.arc(0, -p.h/2, shieldRadius - 4, p.animTimer, p.animTimer + 1.5);
    ctx.stroke();

    ctx.restore();
  }
  
  // 7. 攻擊視覺 (強力身體連結斬擊 - 2025 強化版)
  if(p.attacking) { 
    ctx.save();
    const slashDir = p.facing === 1 ? 1 : -1;
    // 增加進度曲線，讓揮砍「先快後慢」更有層次感
    const progress = Math.pow((12 - p.attackTimer) / 12, 0.8); 
    
    const opacity = 1 - (progress * 0.9);
    // 【加大半徑】從 30 延伸到 85，讓揮砍範圍更明顯
    const radius = 30 + (progress * 55); 

    // 起始點：身體中心微偏前方
    const startX = slashDir * 5;
    const startY = -p.h / 2;

    // 角度：從上方 (-1.5 弧度) 猛力劈向下方 (1.5 弧度)
    const angle = -1.5 + (progress * 3.0);
    const tipX = startX + Math.cos(angle) * radius * slashDir;
    const tipY = startY + Math.sin(angle) * radius;

    // 1. 繪製「實心揮砍面」 (增加濃度，讓它更明顯)
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    if (p.facing === 1) {
      ctx.arc(startX, startY, radius, -1.5, angle, false);
    } else {
      ctx.arc(startX, startY, radius, Math.PI + 1.5, Math.PI + 1.5 - (progress * 3.0), true);
    }
    ctx.lineTo(startX, startY);
    
    // 使用漸層色填充面，避免中心過亮
    let fillGrad = ctx.createRadialGradient(startX, startY, 10, startX, startY, radius);
    fillGrad.addColorStop(0, `rgba(255, 255, 255, 0)`); // 中心透明
    fillGrad.addColorStop(1, `rgba(255, 255, 255, ${opacity * 0.5})`); // 邊緣亮
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // 2. 繪製「連接身體的核心亮線」 (加粗到 5，非常明顯)
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.lineWidth = 5; 
    ctx.lineCap = 'round';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#fff'; // 加入發光效果
    ctx.moveTo(startX, startY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // 3. 繪製「最外緣的外徑線」 (強化刀鋒感)
    ctx.beginPath();
    ctx.lineWidth = 2;
    if (p.facing === 1) {
      ctx.arc(startX, startY, radius, -1.5, angle, false);
    } else {
      ctx.arc(startX, startY, radius, Math.PI + 1.5, Math.PI + 1.5 - (progress * 3.0), true);
    }
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();

  // 8. 果凍風格血條 UI (Jelly Style)
const isP1 = label === 'P1';
const bx = isP1 ? 30 : canvas.width - 190;
const bw = 160;
const bh = 18; // 稍微加厚增加肉感
const radius = 9; // 更圓潤的弧度像果凍

ctx.save();

const hpRatio = Math.max(0, p.hp) / 6;
const isLowHP = hpRatio < 0.4;
// 呼吸頻率（果凍般的震動）
const breath = (Math.sin(Date.now() / 400) + 1) / 2;

// A. 果凍槽底座 (深色半透明磨砂)
ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
if (ctx.roundRect) {
  ctx.beginPath();
  ctx.roundRect(bx - 3, 30 - 3, bw + 6, bh + 6, radius + 2);
  ctx.fill();
}

// B. 繪製果凍血條
if (hpRatio > 0) {
  const barWidth = hpRatio * bw;
  
  // 1. 核心顏色漸層 (由內向外發散的感覺)
  const gradient = ctx.createLinearGradient(bx, 30, bx, 30 + bh);
  
  // 殘血時顏色變暗淡且變透明
  const jellyAlpha = isLowHP ? (0.3 + breath * 0.4) : 0.85;
  ctx.globalAlpha = jellyAlpha;

  gradient.addColorStop(0, p.color); // 頂部主色
  gradient.addColorStop(0.5, p.color); 
  gradient.addColorStop(1, 'rgba(0,0,0,0.3)'); // 底部深色營造沉積感
  
  ctx.fillStyle = gradient;
  if (ctx.roundRect) {
    ctx.beginPath();
    // 這裡寬度做微小的震動縮放，模擬果凍彈性
    const wiggle = isLowHP ? (Math.sin(Date.now() / 100) * 2) : 0;
    ctx.roundRect(bx, 30, Math.max(0, barWidth + wiggle), bh, radius);
    ctx.fill();
  }

  // 2. 果凍亮面 (High Light) - 這是果凍質感的關鍵
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#FFFFFF';
  if (ctx.roundRect) {
    ctx.beginPath();
    // 在上方畫一個橢圓形長條亮光
    ctx.roundRect(bx + 4, 30 + 3, barWidth - 8, bh / 3, radius / 2);
    ctx.fill();
  }

  // 3. 內發光 (能量感)
  if (!isLowHP) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = p.color;
    ctx.fillRect(bx, 30, barWidth, bh);
    ctx.globalCompositeOperation = 'source-over';
  }
}

// C. 文字優化 (配合果凍主題)
ctx.globalAlpha = 1.0;
ctx.shadowBlur = 4;
ctx.shadowColor = 'rgba(0,0,0,0.8)';
ctx.fillStyle = '#FFFFFF';
ctx.font = 'bold 15px "Verdana", sans-serif';
ctx.textAlign = isP1 ? 'left' : 'right';

// 根據模式顯示名字
const displayName = label === 'CPU' ? 'JELLY AI' : `JELLY ${label}`;
const textX = isP1 ? bx : bx + bw;
ctx.fillText(displayName, textX, 22);

// D. 角色小圖示 (裝飾用的小果凍球)
ctx.fillStyle = p.color;
ctx.beginPath();
ctx.arc(isP1 ? bx - 12 : bx + bw + 12, 16, 5 + (breath * 2), 0, Math.PI * 2);
ctx.fill();

ctx.restore();

}
function loop() {
  // --- 暫停邏輯優化 ---
  if (paused) { 
    drawBackground();
    platforms.forEach(plat => {
      ctx.save();
      ctx.shadowBlur = plat.glow || 10; ctx.shadowColor = plat.color || '#444';
      let grad = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h);
      grad.addColorStop(0, plat.color || '#666'); grad.addColorStop(1, '#000');
      ctx.fillStyle = grad; ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      ctx.restore();
    });
    
    drawLoots(); // 暫停時依然繪製道具，確保視覺連續
    drawPlayer(p1, 'P1');
    drawPlayer(p2, selectedMode === 'pve' ? 'CPU' : 'P2');
    
    drawPauseScreen(); 
    gameLoopId = requestAnimationFrame(loop); 
    return; 
  }

  // --- 遊戲運行中邏輯 ---
  if (running) {
    // 1. 移動平台更新
    platforms.forEach(plat => {
      if (plat.dx || plat.dy) {
        plat.x += plat.dx; plat.y += plat.dy;
        if (Math.abs(plat.x - plat.startX) > plat.range) plat.dx *= -1;
        if (Math.abs(plat.y - plat.startY) > plat.range) plat.dy *= -1;
      }
    });

    // 2. 玩家與 AI 更新
    updatePlayer(p1, p2, false);
    updatePlayer(p2, p1, selectedMode === 'pve');

    // 3. 道具掉落與拾取更新 (包含 5-10秒 隨機生成邏輯)
    if (typeof updateLoots === 'function') updateLoots();

    // 4. 子彈邏輯與碰撞
    projectiles = projectiles.filter(prj => {
      prj.x += prj.vx;
      const target = prj.owner === p1 ? p2 : p1;
      if (rectOverlap(prj, target) && target.invulnerableTime <= 0) {
        if (target.isDefending) {
          target.targetScaleX = 0.8; target.targetScaleY = 1.2;
          for (let i = 0; i < 6; i++) {
            target.particles.push({
              x: prj.x, y: prj.y, vx: -prj.vx * 0.4, vy: (Math.random() - 0.5) * 6,
              life: 1.0, size: 2.5, color: '#00fff2'
            });
          }
          if (typeof applyShake === 'function') applyShake(3);
        } else {
          // 計算傷害 (包含紅色道具加成)
          const damage = 1 + (prj.owner.extraDamage || 0);
          target.hp -= damage;
          target.invulnerableTime = 20;
          if (typeof createDust === 'function') createDust(target, 10, 2);
          if (typeof applyShake === 'function') applyShake(10);
        }
        return false;
      }
      return prj.x > 0 && prj.x < canvas.width;
    });
    // 5. 繪圖流程
    drawBackground();
  
    // 繪製平台
    platforms.forEach(plat => {
      ctx.save();
      ctx.shadowBlur = plat.glow || 10; ctx.shadowColor = plat.color || '#444';
      let grad = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h);
      grad.addColorStop(0, plat.color || '#666'); grad.addColorStop(1, '#000');
      ctx.fillStyle = grad; ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      ctx.restore();
    });

    // 6. 繪製道具 (球形加號)
    if (typeof drawLoots === 'function') drawLoots();

    // 7. 繪製角色
    drawPlayer(p1, 'P1'); 
    drawPlayer(p2, selectedMode === 'pve' ? 'CPU' : 'P2');
    
    // 8. 子彈繪製
    projectiles.forEach(prj => {
      ctx.save();
      const trailLen = 40;
      let grad = prj.vx > 0 ? 
        ctx.createLinearGradient(prj.x + prj.w, 0, prj.x - trailLen, 0) : 
        ctx.createLinearGradient(prj.x, 0, prj.x + prj.w + trailLen, 0);
      grad.addColorStop(0, prj.color || '#fff');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      const tx = prj.vx > 0 ? prj.x - trailLen : prj.x + prj.w;
      ctx.fillRect(tx, prj.y, prj.w + trailLen, prj.h);
      ctx.shadowBlur = 15; ctx.shadowColor = prj.color || '#fff';
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(prj.x, prj.y, prj.w, prj.h, 4);
      else ctx.fillRect(prj.x, prj.y, prj.w, prj.h);
      ctx.fill();
      ctx.restore();
    });
  } 
  // --- 遊戲結束慶祝邏輯 ---
  else {
    drawBackground();
    const winner = p1.hp > 0 ? p1 : p2;
    if (winner.onGround && Math.random() < 0.05) {
      winner.vy = -10; winner.onGround = false;
      winner.targetScaleX = 0.8; winner.targetScaleY = 1.2;
    }
    winner.vy += 0.5; winner.y += winner.vy;
    if (winner.y > canvas.height - 100) { winner.y = canvas.height - 100; winner.vy = 0; winner.onGround = true; }
    
    // 回彈動畫計算
    winner.currentScaleX += (winner.targetScaleX - winner.currentScaleX) * 0.15;
    winner.currentScaleY += (winner.targetScaleY - winner.currentScaleY) * 0.15;
    winner.targetScaleX += (1 - winner.targetScaleX) * 0.1;
    winner.targetScaleY += (1 - winner.targetScaleY) * 0.1;
    
    drawPlayer(winner, p1.hp > 0 ? 'P1' : (selectedMode === 'pve' ? 'CPU' : 'P2'));
    drawUI(); 
  }

  gameLoopId = requestAnimationFrame(loop);
}
updateParticles
/* ------------------------- 粒子更新邏輯 ------------------------- */
function updateParticles(player) {
  if (!player.particles) return;
  for (let i = player.particles.length - 1; i >= 0; i--) {
    let pt = player.particles[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.life -= 0.03; // 特效消失速度

    if (pt.life <= 0) {
      player.particles.splice(i, 1);
    }
  }
}
function drawUI() {
  // 1. 動態磨砂背景 (深色半透明)
  ctx.fillStyle = 'rgba(15, 15, 20, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. 獲勝者判定
  const isP1Win = p1.hp > 0;
  const winnerColor = isP1Win ? p1.color : p2.color;
  const winnerName = isP1Win ? "PLAYER 1" : (selectedMode === 'pve' ? "CPU" : "PLAYER 2");

  // 3. 繪製中央裝飾線
  ctx.strokeStyle = winnerColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 150, canvas.height / 2 + 10);
  ctx.lineTo(canvas.width / 2 + 150, canvas.height / 2 + 10);
  ctx.stroke();

  // 4. 繪製勝利文字 (發光效果)
  ctx.save();
  ctx.shadowBlur = 20;
  ctx.shadowColor = winnerColor;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 54px Arial';
  ctx.textAlign = 'center';
  ctx.fillText("VICTORY", canvas.width / 2, canvas.height / 2 - 40);
  
  // 5. 繪製獲勝者名稱
  ctx.font = 'bold 32px Arial';
  ctx.fillStyle = winnerColor;
  ctx.fillText(winnerName, canvas.width / 2, canvas.height / 2 + 60);
  ctx.restore();

  // 6. 底部提示文字 (呼吸閃爍效果)
  const pulse = Math.abs(Math.sin(Date.now() / 500));
  ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + pulse * 0.5})`;
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Press [ R ] to Rematch  |  [ Q ] to Menu', canvas.width / 2, canvas.height / 2 + 130);
}

/* ------------------------- 暫停畫面優化 (2025 磨砂風格) ------------------------- */
function drawPauseScreen(){
  // 1. 背景磨砂遮罩
  ctx.fillStyle = 'rgba(10, 10, 20, 0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. 繪製裝飾掃描線 (隨時間移動)
  const scanLineY = (Date.now() / 20) % canvas.height;
  ctx.strokeStyle = 'rgba(0, 255, 242, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, scanLineY);
  ctx.lineTo(canvas.width, scanLineY);
  ctx.stroke();

  // 3. 暫停標題 (發光青色)
  ctx.save();
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#00fff2';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 40);

  // 4. 裝飾方括號
  ctx.strokeStyle = '#00fff2';
  ctx.lineWidth = 2;
  ctx.strokeRect(canvas.width / 2 - 120, canvas.height / 2 - 90, 240, 70);
  ctx.restore();

  // 5. 操作提示 (呼吸效果)
  const pulse = 0.6 + Math.sin(Date.now() / 300) * 0.4;
  ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('[ ESC ] Resume  |  [ Q ] Quit to Menu', canvas.width / 2, canvas.height / 2 + 50);
  
  // 6. 加上目前的戰況小字
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '14px Arial';
  ctx.fillText(`P1 HP: ${p1.hp}  |  ${selectedMode === 'pve' ? 'CPU' : 'P2'} HP: ${p2.hp}`, canvas.width / 2, canvas.height / 2 + 100);
}


function startGame(){
  const p1c = document.getElementById('p1Color').value;
  const p2c = document.getElementById('p2Color').value;
  // 隱藏選單與道具開關容器
  canvas.style.display = 'block'; 
  menuDiv.style.display = 'none';
  document.getElementById('itemModeContainer').style.display = 'none';

  canvas.style.display = 'block'; menuDiv.style.display = 'none';
  initGame(selectedMap, p1c, p2c);
}
function createDust(player, count, speed) {
  for (let i = 0; i < count; i++) {
    player.particles.push({
      x: player.x + player.w / 2,
      y: player.y + player.h,
      vx: (Math.random() - 0.5) * speed * 2,
      vy: -Math.random() * speed,
      life: 1.0,
      size: Math.random() * 4 + 2
    });
  }
}
/* ------------------------- 粒子更新邏輯 ------------------------- */
function updateParticles(player) {
  // 如果玩家身上沒有粒子陣列，直接跳過
  if (!player.particles) return;

  // 使用倒序迴圈，確保刪除粒子時不會出錯
  for (let i = player.particles.length - 1; i >= 0; i--) {
    let pt = player.particles[i];
    
    // 讓粒子產生位移
    pt.x += pt.vx;
    pt.y += pt.vy;
    
    // 關鍵：每幀減少壽命
    pt.life -= 0.025; // 大約 40 幀 (0.6 秒) 後消失

    // 如果壽命耗盡，從陣列中移除
    if (pt.life <= 0) {
      player.particles.splice(i, 1);
    }
  }
}

// 在 game.js 的最後一行加入
window.addEventListener('load', () => {
  initMenuBg();
  drawMenuBg();
  console.log("2025 Christmas Edition UI Active");
});
// 視窗大小改變時重算寬高
window.addEventListener('resize', initMenuBg);
/* ------------------------- 選色實時預覽邏輯 ------------------------- */
/* ------------------------- 2025 顏色互斥檢查邏輯 ------------------------- */
function handleColorCollision(changedPlayer) {
  const p1Select = document.getElementById('p1Color');
  const p2Select = document.getElementById('p2Color');

  if (p1Select.value === p2Select.value) {
    // 如果顏色相同，讓「非主動更換」的那位玩家自動跳到下一個選項
    const targetSelect = (changedPlayer === 'p1') ? p2Select : p1Select;
    
    // 取得下一個選項的索引 (如果到最後一個就跳回第一個)
    let nextIndex = (targetSelect.selectedIndex + 1) % targetSelect.options.length;
    targetSelect.selectedIndex = nextIndex;
    
    // 2025 震動提示：讓選單晃動一下提醒玩家
    const box = targetSelect.parentElement;
    box.style.animation = 'none';
    box.offsetHeight; // 觸發重繪
    box.style.animation = 'shake 0.4s';
    
    console.log("偵測到顏色衝突，已自動調整。");
  }
}

// 綁定監聽事件
document.getElementById('p1Color').addEventListener('change', () => {
  handleColorCollision('p1');
  if(typeof renderMenuPreviews === 'function') renderMenuPreviews();
});

document.getElementById('p2Color').addEventListener('change', () => {
  handleColorCollision('p2');
  if(typeof renderMenuPreviews === 'function') renderMenuPreviews();
});


/* 請將此段貼在 game.js 最後面 */
function renderMenuPreviews() {
    const p1Col = document.getElementById('p1Color').value;
    const p2Col = document.getElementById('p2Color').value;
    
    drawPreviewJelly('p1Preview', p1Col);
    drawPreviewJelly('p2Preview', p2Col);
    
    if (document.getElementById('menu').style.display !== 'none') {
        requestAnimationFrame(renderMenuPreviews);
    }
}

function drawPreviewJelly(id, color) {
    const cvs = document.getElementById(id);
    if (!cvs) return;
    const pctx = cvs.getContext('2d');
    pctx.clearRect(0, 0, cvs.width, cvs.height);
    const time = Date.now() / 200;
    const sY = 1 + Math.sin(time) * 0.05;
    pctx.save();
    pctx.translate(50, 85);
    pctx.scale(2 - sY, sY);
    pctx.fillStyle = color;
    pctx.shadowBlur = 15; pctx.shadowColor = color;
    pctx.beginPath();
    pctx.roundRect(-25, -50, 50, 50, [15, 15, 5, 5]);
    pctx.fill();
    pctx.restore();
}
// 在頁面載入後綁定監聽
document.getElementById('itemModeToggle').addEventListener('change', (e) => {
  itemModeEnabled = e.target.checked;
  console.log("道具模式：" + (itemModeEnabled ? "開啟" : "關閉"));
});
// 啟動預覽
renderMenuPreviews();
