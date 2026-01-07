(() => {
  'use strict';

  // =========================================================
  //  Level 4 Pinball (re-designed)
  //  - No buggy shooter-lane collision walls.
  //  - Launch zone + exit gate: ball is "released" into playfield
  //    at a fixed height so it can NEVER be trapped on right side.
  // =========================================================

  // ---------- DOM ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const moneyText  = document.getElementById('moneyText');
  const goalText   = document.getElementById('goalText');
  const timeText   = document.getElementById('timeText');
  const statusText = document.getElementById('statusText');

  const launchBtn = document.getElementById('launchBtn');
  const resetBtn  = document.getElementById('resetBtn');

  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayDesc  = document.getElementById('overlayDesc');
  const overlayPrimary = document.getElementById('overlayPrimary');
  const overlaySecondary = document.getElementById('overlaySecondary');

  // ---------- Canvas size ----------
  const W = canvas.width;
  const H = canvas.height;

  // ---------- Rules ----------
  const GOAL = 500;
  const START_MONEY = 50;
  const LAUNCH_COST = 10;
  const TOTAL_TIME = 300;

  // ---------- Physics ----------
  const BALL_R = 9;

  const GRAVITY = 1500;
  const AIR_DAMP = 0.995;       // per frame-ish
  const REST = 0.86;            // restitution
  const MAX_DT = 0.033;

  // More stable collision (substeps)
  const SUBSTEPS = 2;

  // ---------- Table geometry (simple & stable) ----------
  const PAD = 24;

  // Launch zone (right side visual + spawn)
  const LAUNCH_X = W - 58;
  const LAUNCH_Y = H - 90;

  // "Exit gate": at this height, the ball is injected into playfield
  const EXIT_Y = 120;
  const EXIT_TO_X = W - 120;

  // Ball state
  const ball = {
    x: LAUNCH_X,
    y: LAUNCH_Y,
    vx: 0,
    vy: 0,
    active: false,
    inLaunchMode: true
  };

  // Game state
  let money = START_MONEY;
  let timeLeft = TOTAL_TIME;
  let running = false;
  let gameOver = false;

  // Input
  let leftDown = false;
  let rightDown = false;

  // FX
  let shake = 0;

  // ---------- Helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx*dx + dy*dy;
  };
  const deg = (d) => d * Math.PI / 180;
  const rand = (a, b) => a + Math.random() * (b - a);

  function setStatus(s){ statusText.textContent = s; }
  function updateHUD(){
    moneyText.textContent = String(Math.max(0, Math.floor(money)));
    goalText.textContent = String(GOAL);
    timeText.textContent = String(Math.max(0, Math.ceil(timeLeft)));
  }

  function showOverlay(title, html, primaryText='開始', secondaryText='關閉'){
    overlayTitle.textContent = title;
    overlayDesc.innerHTML = html;
    overlayPrimary.textContent = primaryText;
    overlaySecondary.textContent = secondaryText;
    overlay.classList.remove('hidden');
  }
  function hideOverlay(){ overlay.classList.add('hidden'); }

  function intro(){
    setStatus('READY');
    showOverlay(
      '玩法說明',
      `【目標】在 <b>${TOTAL_TIME}</b> 秒內把金錢累積到 <b>${GOAL}</b> 元。<br><br>
       【規則】<br>
       • 初始金額：<b>${START_MONEY}</b> 元<br>
       • 每次發射：<b>-${LAUNCH_COST}</b> 元（空白鍵/按鈕）<br>
       • <span style="color:#ff3a3a"><b>沒錢（<${LAUNCH_COST}）發射＝直接死亡</b></span><br>
       • <span style="color:#ff3a3a"><b>必死洞：掉入直接死亡</b></span><br>
       • +錢洞：加錢；-錢洞：扣錢<br><br>
       【操作】<br>
       • 左翻板：A 或 ←　右翻板：D 或 →<br>
       • 發射：空白鍵 或「發射」<br><br>
       【出球口】採用「出口閘門」：球到達指定高度會直接放入主場，<b>不可能卡在右側</b>。`,
      '開始遊戲',
      '關閉'
    );
  }

  function die(reason){
    if (gameOver) return;
    gameOver = true;
    running = false;
    setStatus('DEAD');
    showOverlay('GAME OVER', reason, '再來一次', '關閉');
  }

  function clear(){
    if (gameOver) return;
    gameOver = true;
    running = false;
    setStatus('CLEAR');
    showOverlay('CLEAR!', `你成功累積到 <b>${Math.floor(money)}</b> 元通關！`, '再玩一次', '關閉');
  }

  // ---------- Table objects ----------
  // Collidable line segments
  const segments = [];
  function addSeg(x1,y1,x2,y2, bounce=REST){
    segments.push({x1,y1,x2,y2,b:bounce});
  }

  // Table border (playfield border only)
  addSeg(PAD, PAD, W-PAD, PAD, 0.92);
  addSeg(W-PAD, PAD, W-PAD, H-PAD, 0.92);
  addSeg(W-PAD, H-PAD, PAD, H-PAD, 0.92);
  addSeg(PAD, H-PAD, PAD, PAD, 0.92);

  // Slanted guides (keep them away from right launch zone)
  addSeg(PAD, 130, 170, 80, 0.94);
  addSeg(W-260, 90, W-PAD, 140, 0.94);

  // Bottom side rails (avoid corner traps)
  addSeg(PAD, H-140, 210, H-90, 0.94);
  addSeg(W-210, H-90, W-PAD, H-140, 0.94);

  // Bumpers (fixed)
  const bumpers = [
    { x: 290, y: 160, r: 24, power: 640, delta: +2 },
    { x: 450, y: 120, r: 28, power: 720, delta: +2 },
    { x: 620, y: 170, r: 24, power: 640, delta: +2 },
    { x: 350, y: 280, r: 22, power: 560, delta: -2 },
    { x: 540, y: 280, r: 22, power: 560, delta: -2 },
  ];

  // ✅ 洞口：改成「隨機生成」，且必死洞只 1 個、不能在最下面
  //    （其他邏輯不改：進洞回到發射區、扣到<=0死亡、>=500通關）
  const holeTemplates = [
    { type:'BONUS',   r: 22, amount: 35 },
    { type:'BONUS',   r: 22, amount: 40 },
    { type:'BONUS',   r: 18, amount: 60 },
    { type:'PENALTY', r: 18, amount: 20 },
    { type:'PENALTY', r: 18, amount: 25 },
    { type:'DEATH',   r: 20, amount: 0 }, // 只保留 1 個
  ];

  let holes = []; // will be generated on reset

  // Forbidden zones: keep holes away from launch zone column and flipper zone
  const forbiddenRects = [
    // right launch zone column (visual area)
    { x1: W-110, y1: PAD, x2: W-PAD, y2: H-PAD },
    // flipper / bottom zone (avoid "most bottom" placements)
    { x1: PAD, y1: H-140, x2: W-PAD, y2: H-PAD },
  ];

  function inRect(x,y,rc){
    return x >= rc.x1 && x <= rc.x2 && y >= rc.y1 && y <= rc.y2;
  }

  function generateHoles(){
    const placed = [];

    // placement bounds (exclude bottom-most by default)
    const minX = PAD + 60;
    const maxX = W - PAD - 140; // avoid right lane visually
    const minY = PAD + 70;
    const maxY = H - PAD - 160; // avoid being "最下面"

    const minGap = 52; // minimum distance between hole centers (tune for look)

    // helper to test candidate
    function okCandidate(x,y,r, isDeath){
      // keep away from forbidden rects
      for (const rc of forbiddenRects){
        if (inRect(x,y,rc)) return false;
      }

      // death hole must not be near bottom at all (extra safe)
      if (isDeath && y > H - 220) return false;

      // avoid bumpers
      for (const b of bumpers){
        const rr = r + b.r + 24;
        if (dist2(x,y,b.x,b.y) < rr*rr) return false;
      }

      // avoid holes overlap
      for (const p of placed){
        const rr = r + p.r + minGap;
        if (dist2(x,y,p.x,p.y) < rr*rr) return false;
      }

      // avoid exit injection area (so it doesn't immediately fall into a hole)
      const ex = EXIT_TO_X, ey = EXIT_Y + 18;
      if (dist2(x,y,ex,ey) < (r + 40)*(r + 40)) return false;

      return true;
    }

    for (const tpl of holeTemplates){
      let found = false;
      const isDeath = tpl.type === 'DEATH';

      // death hole: bias to upper/mid area (not bottom)
      const yLow  = isDeath ? (PAD + 90) : minY;
      const yHigh = isDeath ? (H - PAD - 240) : maxY;

      for (let attempt=0; attempt<900; attempt++){
        const x = rand(minX, maxX);
        const y = rand(yLow, yHigh);
        if (okCandidate(x,y,tpl.r,isDeath)){
          placed.push({ ...tpl, x, y });
          found = true;
          break;
        }
      }

      // fallback (should be rare): place it deterministically
      if (!found){
        const fx = isDeath ? (W*0.55) : rand(minX, maxX);
        const fy = isDeath ? (H*0.35) : rand(minY, maxY);
        placed.push({ ...tpl, x: fx, y: fy });
      }
    }

    return placed;
  }

  // Flippers
  class Flipper{
    constructor(side){
      this.side = side;
      this.px = side==='L' ? 350 : 550;
      this.py = H - 78;
      this.len = 96;

      // ✅ 右翻板軌跡修正：改回對稱且合理的角度範圍
      // 左翻板維持原本手感；右翻板改為常見：rest = -155°, up = -70°
      if (side === 'L'){
        this.rest = Math.PI * 1.18;  // ~212°
        this.up   = Math.PI * 1.40;  // ~252°
      } else {
        this.rest = deg(-25);   // 右翻板休息角：朝左上
this.up   = deg(-110);  // 右翻板抬起角：往左更用力撥球（反向）

      }

      this.a = this.rest;

      this.speedUp = 18;
      this.speedDown = 14;
    }
    reset(){ this.a = this.rest; }
    update(dt, pressed){
      const target = pressed ? this.up : this.rest;
      const sp = pressed ? this.speedUp : this.speedDown;
      const diff = target - this.a;
      this.a += clamp(diff, -sp*dt, sp*dt);
    }
    endpoints(){
      const ax=this.px, ay=this.py;
      const bx=ax + Math.cos(this.a)*this.len;
      const by=ay + Math.sin(this.a)*this.len;
      return {ax,ay,bx,by};
    }
  }

  const leftFlipper  = new Flipper('L');
  const rightFlipper = new Flipper('R');

  // ---------- Physics core ----------
  function closestPointOnSegment(x1,y1,x2,y2,px,py){
    const vx=x2-x1, vy=y2-y1;
    const wx=px-x1, wy=py-y1;
    const c1 = wx*vx + wy*vy;
    if (c1 <= 0) return {x:x1,y:y1};
    const c2 = vx*vx + vy*vy;
    if (c2 <= c1) return {x:x2,y:y2};
    const t = c1 / c2;
    return {x:x1 + t*vx, y:y1 + t*vy};
  }

  function reflect(vx, vy, nx, ny, bounce){
    const vdot = vx*nx + vy*ny;
    const rx = vx - (1 + bounce) * vdot * nx;
    const ry = vy - (1 + bounce) * vdot * ny;
    return {vx:rx, vy:ry};
  }

  function collideWithSegment(seg){
    const cp = closestPointOnSegment(seg.x1,seg.y1,seg.x2,seg.y2, ball.x, ball.y);
    const d2 = dist2(ball.x, ball.y, cp.x, cp.y);
    if (d2 >= BALL_R*BALL_R) return;

    const d = Math.sqrt(d2) || 0.0001;
    let nx = (ball.x - cp.x) / d;
    let ny = (ball.y - cp.y) / d;

    const push = (BALL_R - d) + 0.8;
    ball.x += nx * push;
    ball.y += ny * push;

    const r = reflect(ball.vx, ball.vy, nx, ny, seg.b);
    ball.vx = r.vx;
    ball.vy = r.vy;

    shake = Math.min(18, shake + 2.2);
  }

  function collideWithBumper(b){
    const rr = BALL_R + b.r;
    const d2 = dist2(ball.x, ball.y, b.x, b.y);
    if (d2 >= rr*rr) return;

    const d = Math.sqrt(d2) || 0.0001;
    const nx = (ball.x - b.x) / d;
    const ny = (ball.y - b.y) / d;

    const push = (rr - d) + 0.9;
    ball.x += nx*push;
    ball.y += ny*push;

    const r = reflect(ball.vx, ball.vy, nx, ny, 0.95);
    ball.vx = r.vx + nx * b.power;
    ball.vy = r.vy + ny * b.power * 0.60;

    money += b.delta;
    if (money <= 0) { die('你已經沒錢了（<= 0）。'); }

    shake = Math.min(22, shake + 4.5);
  }

  function collideWithFlipper(f, pressed){
    const {ax,ay,bx,by} = f.endpoints();
    const cp = closestPointOnSegment(ax,ay,bx,by, ball.x, ball.y);
    const d2 = dist2(ball.x, ball.y, cp.x, cp.y);
    if (d2 >= BALL_R*BALL_R) return;

    const d = Math.sqrt(d2) || 0.0001;
    const nx = (ball.x - cp.x) / d;
    const ny = (ball.y - cp.y) / d;

    const push = (BALL_R - d) + 1.0;
    ball.x += nx*push;
    ball.y += ny*push;

    const r = reflect(ball.vx, ball.vy, nx, ny, 0.92);
    ball.vx = r.vx;
    ball.vy = r.vy;

    if (pressed){
      const towardCenter = (f.side==='L') ? 1 : -1;
      ball.vx += towardCenter * 240;
      ball.vy -= 920;
    }

    shake = Math.min(26, shake + 6.0);
  }

  // ---------- Holes ----------
  function checkHoles(){
    for (const h of holes){
      const d2 = dist2(ball.x, ball.y, h.x, h.y);
      if (d2 <= (h.r - 2)*(h.r - 2)){
        ball.active = false;
        ball.vx = 0; ball.vy = 0;

        if (h.type === 'DEATH'){
          die('你掉進必死洞。');
          return true;
        }

        if (h.type === 'BONUS') money += h.amount;
        if (h.type === 'PENALTY') money -= h.amount;

        if (money <= 0){
          die('你已經沒錢了（<= 0）。');
          return true;
        }
        if (money >= GOAL){
          clear();
          return true;
        }

        ball.x = LAUNCH_X;
        ball.y = LAUNCH_Y;
        ball.inLaunchMode = true;
        setStatus('READY');
        updateHUD();
        return true;
      }
    }
    return false;
  }

  // ---------- Launch / Exit Gate ----------
  function launch(){
    if (gameOver) return;

    if (!running){
      hideOverlay();
      running = true;
    }

    if (money < LAUNCH_COST){
      die(`你沒有足夠金錢發射（需要 ${LAUNCH_COST} 元）。沒錢直接死亡。`);
      return;
    }

    money -= LAUNCH_COST;
    if (money <= 0){
      die('你已經沒錢了（<= 0）。');
      return;
    }

    ball.x = LAUNCH_X;
    ball.y = LAUNCH_Y;
    ball.vx = (Math.random()-0.5) * 80;
    ball.vy = -1350 - Math.random()*220;
    ball.active = true;
    ball.inLaunchMode = true;

    setStatus('PLAY');
    updateHUD();
  }

  function applyExitGate(){
    if (!ball.active) return;
    if (!ball.inLaunchMode) return;

    if (ball.y <= EXIT_Y){
      ball.inLaunchMode = false;

      ball.x = EXIT_TO_X;
      ball.y = EXIT_Y + 18;

      ball.vx = -220 - Math.random()*140;
      ball.vy = 120 + Math.random()*80;

      shake = Math.min(18, shake + 3.0);
    }
  }

  function recycleIfOut(){
    if (!ball.active) return;
    if (ball.y > H - PAD - BALL_R){
      ball.active = false;
      ball.x = LAUNCH_X;
      ball.y = LAUNCH_Y;
      ball.vx = 0;
      ball.vy = 0;
      ball.inLaunchMode = true;
      setStatus('READY');
    }
  }

  // ---------- Update ----------
  let acc = 0;
  let last = 0;

  function step(dt){
    leftFlipper.update(dt, leftDown);
    rightFlipper.update(dt, rightDown);

    if (!ball.active){
      updateHUD();
      return;
    }

    ball.vy += GRAVITY * dt;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    ball.vx *= Math.pow(AIR_DAMP, dt * 60);
    ball.vy *= Math.pow(AIR_DAMP, dt * 60);

    applyExitGate();

    if (!ball.inLaunchMode){
      for (const s of segments) collideWithSegment(s);
      for (const b of bumpers) collideWithBumper(b);
      collideWithFlipper(leftFlipper, leftDown);
      collideWithFlipper(rightFlipper, rightDown);
      checkHoles();
      if (!gameOver && money >= GOAL) clear();
    } else {
      ball.x = clamp(ball.x, W - 82, W - 34);
      if (ball.x < W - 82) ball.x = W - 82;
    }

    recycleIfOut();
    updateHUD();
  }

  function update(dt){
    acc += dt;
    while (acc >= 1){
      acc -= 1;
      timeLeft -= 1;
      if (timeLeft <= 0){
        timeLeft = 0;
        die(`時間到。你最終只有 ${Math.floor(money)} 元，未達 ${GOAL} 元。`);
        return;
      }
    }

    const sub = SUBSTEPS;
    const sdt = dt / sub;
    for (let i=0;i<sub;i++) step(sdt);
  }

  // ---------- Draw ----------
  function rrStroke(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
    ctx.stroke();
  }

  function drawTable(){
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(137,163,255,.55)';
    ctx.shadowColor = 'rgba(137,163,255,.45)';
    ctx.shadowBlur = 16;
    rrStroke(PAD, PAD, W-2*PAD, H-2*PAD, 18);
    ctx.restore();

    // launch lane (visual only)
    ctx.save();
    ctx.strokeStyle = 'rgba(137,163,255,.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W-86, PAD);
    ctx.lineTo(W-86, H-PAD);
    ctx.stroke();

    ctx.setLineDash([6,6]);
    ctx.strokeStyle = 'rgba(137,163,255,.18)';
    ctx.beginPath();
    ctx.moveTo(W-58, PAD);
    ctx.lineTo(W-58, H-PAD);
    ctx.stroke();
    ctx.setLineDash([]);

    // exit marker
    ctx.strokeStyle = 'rgba(61,255,158,.25)';
    ctx.beginPath();
    ctx.moveTo(W-86, EXIT_Y);
    ctx.lineTo(W-PAD, EXIT_Y);
    ctx.stroke();

    ctx.font = '900 12px ui-sans-serif, system-ui';
    ctx.fillStyle = 'rgba(137,163,255,.55)';
    ctx.save();
    ctx.translate(W-44, 120);
    ctx.rotate(-Math.PI/2);
    ctx.fillText('LAUNCH ZONE', 0, 0);
    ctx.restore();

    ctx.restore();

    // subtle segments
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    for (const s of segments){
      ctx.beginPath();
      ctx.moveTo(s.x1,s.y1);
      ctx.lineTo(s.x2,s.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHole(h){
    ctx.save();
    let color, glow, label;
    if (h.type==='BONUS'){ color='#3dff9e'; glow='rgba(61,255,158,.55)'; label=`+${h.amount}`; }
    if (h.type==='PENALTY'){ color='#ff4bd6'; glow='rgba(255,75,214,.55)'; label=`-${h.amount}`; }
    if (h.type==='DEATH'){ color='#ff3a3a'; glow='rgba(255,58,58,.55)'; label='DEAD'; }

    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 2;
    ctx.strokeStyle = glow;
    ctx.beginPath();
    ctx.arc(h.x,h.y,h.r+4,0,Math.PI*2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    const grd = ctx.createRadialGradient(h.x-3,h.y-3,3,h.x,h.y,h.r);
    grd.addColorStop(0,'rgba(0,0,0,0)');
    grd.addColorStop(1,'rgba(0,0,0,.85)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(h.x,h.y,h.r,0,Math.PI*2);
    ctx.fill();

    ctx.font = '900 12px ui-sans-serif, system-ui';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, h.x, h.y);
    ctx.restore();
  }

  function drawBumper(b){
    ctx.save();
    const isBonus = b.delta > 0;
    const glow = isBonus ? 'rgba(61,255,158,.45)' : 'rgba(255,75,214,.45)';
    const color = isBonus ? '#3dff9e' : '#ff4bd6';

    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 2;
    ctx.strokeStyle = glow;
    ctx.beginPath();
    ctx.arc(b.x,b.y,b.r+5,0,Math.PI*2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    const grd = ctx.createRadialGradient(b.x-6,b.y-8,6,b.x,b.y,b.r);
    grd.addColorStop(0,'rgba(255,255,255,.10)');
    grd.addColorStop(1,'rgba(0,0,0,.75)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    ctx.fill();

    ctx.font = '900 11px ui-sans-serif, system-ui';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isBonus ? '+2' : '-2', b.x, b.y);
    ctx.restore();
  }

  function drawFlipper(f){
    const {ax,ay,bx,by} = f.endpoints();
    ctx.save();
    ctx.lineCap = 'round';

    ctx.shadowColor = 'rgba(137,163,255,.35)';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 16;
    ctx.strokeStyle = 'rgba(137,163,255,.18)';
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(233,236,255,.85)';
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();

    ctx.fillStyle = 'rgba(233,236,255,.9)';
    ctx.beginPath(); ctx.arc(ax,ay,6,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawBall(){
    ctx.save();
    ctx.shadowColor = 'rgba(233,236,255,.35)';
    ctx.shadowBlur = 14;
    const grd = ctx.createRadialGradient(ball.x-4, ball.y-6, 2, ball.x, ball.y, BALL_R+6);
    grd.addColorStop(0,'rgba(255,255,255,.95)');
    grd.addColorStop(1,'rgba(120,140,255,.12)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
// 通用 ESC 返回主頁
//(function () {
 // window.addEventListener("keydown", function (e) {
    // 避免在輸入框中誤觸
   // const tag = document.activeElement?.tagName;
  // if (tag === "INPUT" || tag === "TEXTAREA") return;

   //if (e.key === "Escape") {
      // 可選：播放音效 / 顯示提示（之後可加）
    //  location.href = "index.html";
  //});
//})();

  function draw(){
    const sx = (shake>0) ? (Math.random()-0.5)*shake : 0;
    const sy = (shake>0) ? (Math.random()-0.5)*shake : 0;
    shake = Math.max(0, shake - 0.8);

    ctx.save();
    ctx.clearRect(0,0,W,H);
    ctx.translate(sx,sy);

    drawTable();
    for (const h of holes) drawHole(h);
    for (const b of bumpers) drawBumper(b);
    drawFlipper(leftFlipper);
    drawFlipper(rightFlipper);
    drawBall();

    ctx.restore();
  }

  // ---------- Main loop ----------
  function loop(ts){
    if (!last) last = ts;
    let dt = (ts - last) / 1000;
    last = ts;
    dt = Math.min(MAX_DT, Math.max(0, dt));

    if (running && !gameOver) update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  // ---------- UI events ----------
  function onPrimary(){
    if (gameOver){
      reset(false);
      hideOverlay();
      running = true;
      setStatus('READY');
      return;
    }
    hideOverlay();
    running = true;
    setStatus('READY');
  }
  function onSecondary(){
    hideOverlay();
  }

  overlayPrimary.addEventListener('click', onPrimary);
  overlaySecondary.addEventListener('click', onSecondary);

  launchBtn.addEventListener('click', launch);
  resetBtn.addEventListener('click', () => reset(true));

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') leftDown = true;
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') rightDown = true;

    if (e.code === 'Space'){
      e.preventDefault();
      launch();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') leftDown = false;
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') rightDown = false;
  });

  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  }, { passive:false });

  // ---------- Reset ----------
  function reset(all=true){
    money = START_MONEY;
    timeLeft = TOTAL_TIME;
    running = false;
    gameOver = false;
    shake = 0;

    // ✅ 每次重來都重新隨機洞口
    holes = generateHoles();

    ball.x = LAUNCH_X;
    ball.y = LAUNCH_Y;
    ball.vx = 0;
    ball.vy = 0;
    ball.active = false;
    ball.inLaunchMode = true;

    leftFlipper.reset();
    rightFlipper.reset();

    updateHUD();
    if (all) intro(); else hideOverlay();
  }

  // ---------- Start ----------
  updateHUD();
  setStatus('READY');
  requestAnimationFrame(loop);
  reset(true);
})();
