(() => {
  "use strict";

  // ====== Config ======
  const FINGERS = ["拇指", "食指", "中指", "無名指", "小指"];
  const HANDS = ["left", "right"];
  const HAND_LABEL = { left: "左手", right: "右手" };

  // ✅ Updated punch conditions:
  // scissors: index + middle
  // paper: index + middle + ring
  // rock: any finger (hand has at least 1 unbroken finger)
  const PUNCH = {
    rock: { key: "rock", name: "石頭", icon: "✊" },
    scissor: { key: "scissor", name: "剪刀", icon: "✌" },
    paper: { key: "paper", name: "布", icon: "✋" },
  };

  const MAX_ROUNDS = 20;

  // ====== DOM ======
  const $ = (id) => document.getElementById(id);

  const dom = {
    roundLeft: $("roundLeft"),
    roundLeftBig: $("roundLeftBig"),
    scoreLine: $("scoreLine"),

    playerStatus: $("playerStatus"),
    enemyStatus: $("enemyStatus"),

    playerLastMove: $("playerLastMove"),
    enemyLastMove: $("enemyLastMove"),

    playerLeftFingers: $("playerLeftFingers"),
    playerRightFingers: $("playerRightFingers"),
    enemyLeftFingers: $("enemyLeftFingers"),
    enemyRightFingers: $("enemyRightFingers"),

    playerMovesLeft: $("playerMovesLeft"),
    playerMovesRight: $("playerMovesRight"),
    enemyMovesLeft: $("enemyMovesLeft"),
    enemyMovesRight: $("enemyMovesRight"),

    actionGrid: $("actionGrid"),
    logBody: $("logBody"),

    btnReset: $("btnReset"),
    btnHelp: $("btnHelp"),

    helpModal: $("helpModal"),
    helpClose: $("helpClose"),
    helpOk: $("helpOk"),
    ruleChip: $("ruleChip"),

    fingerModal: $("fingerModal"),
    fingerTitle: $("fingerTitle"),
    fingerDesc: $("fingerDesc"),
    fingerPick: $("fingerPick"),
    fingerClose: $("fingerClose"),
    fingerCancel: $("fingerCancel"),

    toast: $("toast"),
    flash: $("flash"),
  };

  // ====== Audio (WebAudio) ======
  let audio = {
    ctx: null,
    unlocked: false
  };

  function ensureAudio() {
    if (audio.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC();
  }

  async function unlockAudio() {
    ensureAudio();
    if (!audio.ctx || audio.unlocked) return;

    try {
      // iOS needs resume on user gesture
      await audio.ctx.resume();
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      g.gain.value = 0.0001;
      o.connect(g).connect(audio.ctx.destination);
      o.start();
      o.stop(audio.ctx.currentTime + 0.02);
      audio.unlocked = true;
    } catch {}
  }

  function beep(freq, dur = 0.08, type = "sine", gain = 0.05) {
    if (!audio.ctx || !audio.unlocked) return;
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.01);
  }

  function sfxWin()  { beep(880, 0.08, "triangle", 0.06); setTimeout(()=>beep(1175,0.10,"triangle",0.06), 70); }
  function sfxLose() { beep(220, 0.10, "sawtooth", 0.06); setTimeout(()=>beep(165,0.12,"sawtooth",0.06), 80); }
  function sfxDraw() { beep(520, 0.08, "sine", 0.05); setTimeout(()=>beep(520,0.08,"sine",0.05), 90); }
  function sfxBreak(){ beep(140, 0.06, "square", 0.06); setTimeout(()=>beep(95,0.10,"square",0.06), 60); }

  // ====== State ======
  const state = {
    roundsLeft: MAX_ROUNDS,
    phase: "INTRO", // INTRO | PLAYER_TURN | RESOLVING | PICK_FINGER | GAME_OVER
    pendingBreak: null, // { hand }
    last: { player: null, enemy: null },
    score: { player: 0, enemy: 0 },

    // store broken fingers as Set per hand
    hands: {
      player: { left: new Set(), right: new Set() },
      enemy: { left: new Set(), right: new Set() },
    }
  };

  // ====== UI helpers ======
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function toast(msg) {
    dom.toast.textContent = msg;
    dom.toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => dom.toast.classList.remove("show"), 1200);
  }

  function flash(kind) {
    dom.flash.className = "flash";
    // force reflow for re-trigger animation
    void dom.flash.offsetWidth;
    dom.flash.classList.add(kind);
  }

  function shake() {
    document.body.classList.remove("shake");
    void document.body.offsetWidth;
    document.body.classList.add("shake");
  }

  function addLog(html) {
    const line = document.createElement("div");
    line.className = "log-line";
    line.innerHTML = html;
    dom.logBody.appendChild(line);
    // keep scroll bottom
    dom.logBody.scrollTop = dom.logBody.scrollHeight;
  }

  function fmtMove(m) {
    if (!m) return "—";
    const p = PUNCH[m.punch];
    return `${HAND_LABEL[m.hand]} ${p.icon} ${p.name}`;
  }

  function isBroken(side, hand, finger) {
    return state.hands[side][hand].has(finger);
  }

  function unbrokenCount(side, hand) {
    let c = 0;
    for (const f of FINGERS) if (!isBroken(side, hand, f)) c++;
    return c;
  }

  // ====== Punch availability (updated rules) ======
  function canPunch(side, hand, punchKey) {
    const broken = state.hands[side][hand];

    if (punchKey === "rock") {
      // ✅ any finger available
      return broken.size < 5;
    }
    if (punchKey === "scissor") {
      return !broken.has("食指") && !broken.has("中指");
    }
    if (punchKey === "paper") {
      return !broken.has("食指") && !broken.has("中指") && !broken.has("無名指");
    }
    return false;
  }

  function availableMovesForHand(side, hand) {
    const out = [];
    for (const k of Object.keys(PUNCH)) {
      if (canPunch(side, hand, k)) out.push(k);
    }
    return out;
  }

  function allAvailableMoves(side) {
    const out = [];
    for (const hand of HANDS) {
      for (const k of Object.keys(PUNCH)) {
        if (canPunch(side, hand, k)) out.push({ hand, punch: k });
      }
    }
    return out;
  }

  function renderMiniMoves(container, side, hand) {
    const moves = availableMovesForHand(side, hand);
    container.innerHTML = "";
    if (moves.length === 0) {
      const s = document.createElement("span");
      s.className = "mini-pill";
      s.textContent = "無可用拳";
      container.appendChild(s);
      return;
    }
    for (const k of moves) {
      const s = document.createElement("span");
      s.className = "mini-pill";
      s.textContent = `${PUNCH[k].icon} ${PUNCH[k].name}`;
      container.appendChild(s);
    }
  }

  function renderFingers(container, side, hand) {
    container.innerHTML = "";
    for (const f of FINGERS) {
      const broken = isBroken(side, hand, f);
      const d = document.createElement("div");
      d.className = "finger" + (broken ? " broken" : "");
      d.dataset.side = side;
      d.dataset.hand = hand;
      d.dataset.finger = f;
      d.innerHTML = `<div>${f}</div><span class="k">${broken ? "折斷" : "可用"}</span>`;
      container.appendChild(d);
    }
  }

  function renderActionButtons() {
    dom.actionGrid.innerHTML = "";
    const combos = [];
    for (const hand of HANDS) {
      for (const pk of Object.keys(PUNCH)) combos.push({ hand, punch: pk });
    }

    for (const c of combos) {
      const allowed = canPunch("player", c.hand, c.punch);
      const p = PUNCH[c.punch];
      const btn = document.createElement("button");
      btn.className = "cardbtn";
      btn.type = "button";
      btn.dataset.hand = c.hand;
      btn.dataset.punch = c.punch;
      btn.disabled = !allowed || state.phase !== "PLAYER_TURN";
      btn.innerHTML = `
        <div class="left">
          <div class="tag">${HAND_LABEL[c.hand]}</div>
          <div class="main">${p.name}</div>
        </div>
        <div class="icon">${p.icon}</div>
      `;
      dom.actionGrid.appendChild(btn);
    }
  }

  function renderHUD() {
    dom.roundLeft.textContent = String(state.roundsLeft);
    dom.roundLeftBig.textContent = String(state.roundsLeft);
    dom.scoreLine.textContent = `你 ${state.score.player} : ${state.score.enemy} 對手`;
    dom.playerLastMove.textContent = fmtMove(state.last.player);
    dom.enemyLastMove.textContent = fmtMove(state.last.enemy);

    renderFingers(dom.playerLeftFingers, "player", "left");
    renderFingers(dom.playerRightFingers, "player", "right");
    renderFingers(dom.enemyLeftFingers, "enemy", "left");
    renderFingers(dom.enemyRightFingers, "enemy", "right");

    renderMiniMoves(dom.playerMovesLeft, "player", "left");
    renderMiniMoves(dom.playerMovesRight, "player", "right");
    renderMiniMoves(dom.enemyMovesLeft, "enemy", "left");
    renderMiniMoves(dom.enemyMovesRight, "enemy", "right");

    renderActionButtons();

    dom.playerStatus.textContent =
      state.phase === "PLAYER_TURN" ? "輪到你出拳" :
      state.phase === "PICK_FINGER" ? "你必須折斷一根手指" :
      state.phase === "RESOLVING" ? "結算中…" :
      state.phase === "GAME_OVER" ? "遊戲結束" : "—";

    dom.enemyStatus.textContent =
      state.phase === "RESOLVING" ? "出拳中…" :
      state.phase === "PLAYER_TURN" ? "等待你…" :
      state.phase === "GAME_OVER" ? "結束" : "—";
  }

  // ====== RPS judge ======
  function judge(a, b) {
    if (a === b) return 0;
    if (
      (a === "rock" && b === "scissor") ||
      (a === "scissor" && b === "paper") ||
      (a === "paper" && b === "rock")
    ) return 1;
    return -1;
  }

  function setResultUI(kind) {
    // kind: win | lose | draw | break
    flash(kind);
    shake();
    if (kind === "win") sfxWin();
    else if (kind === "lose") sfxLose();
    else if (kind === "draw") sfxDraw();
    else if (kind === "break") sfxBreak();
  }

  // ====== Enemy AI: random but not monotone ======
  function enemyPickMove() {
    const options = allAvailableMoves("enemy");
    if (options.length === 0) return null;

    // Truly random among available, but with a tiny bias to alternate hands sometimes
    // so it "feels" less repetitive.
    const last = state.last.enemy;
    let pool = options;

    if (last && Math.random() < 0.45) {
      const alt = options.filter(o => o.hand !== last.hand);
      if (alt.length > 0) pool = alt;
    }

    // Another small twist: sometimes prefer paper/scissor to avoid always rock
    if (Math.random() < 0.20) {
      const nonRock = pool.filter(o => o.punch !== "rock");
      if (nonRock.length > 0) pool = nonRock;
    }

    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ====== Break finger flow ======
  function openBreakModal(hand) {
    state.phase = "PICK_FINGER";
    state.pendingBreak = { hand };

    dom.fingerTitle.textContent = `你輸了：${HAND_LABEL[hand]}要折斷哪根手指？`;
    dom.fingerDesc.textContent = `只能折斷你剛剛出拳的「${HAND_LABEL[hand]}」上一根還能用的手指。`;

    dom.fingerPick.innerHTML = "";
    for (const f of FINGERS) {
      const broken = isBroken("player", hand, f);
      const btn = document.createElement("button");
      btn.className = "pickbtn break";
      btn.type = "button";
      btn.textContent = f;
      btn.dataset.finger = f;
      btn.disabled = broken;
      dom.fingerPick.appendChild(btn);
    }

    dom.fingerModal.showModal();
    renderHUD();
  }

  function forcePickWarning() {
    toast("你必須折斷一根手指");
    setResultUI("break");
  }

  function breakPlayerFinger(hand, finger) {
    if (isBroken("player", hand, finger)) return false;

    state.hands.player[hand].add(finger);

    // Visual: find that finger cell and add hit effect
    const all = document.querySelectorAll(`.finger[data-side="player"][data-hand="${hand}"][data-finger="${finger}"]`);
    all.forEach(el => {
      el.classList.add("hit");
      // red outline already from .broken; hit adds shake
      setTimeout(() => el.classList.remove("hit"), 320);
    });

    setResultUI("break");
    toast(`折斷：${HAND_LABEL[hand]} ${finger}`);
    return true;
  }

  function breakRandomEnemyFinger(hand) {
    // choose a random unbroken finger
    const candidates = FINGERS.filter(f => !isBroken("enemy", hand, f));
    if (candidates.length === 0) return;
    const f = candidates[Math.floor(Math.random() * candidates.length)];
    state.hands.enemy[hand].add(f);
  }

  // ====== Game ending ======
  function sideHasAnyMove(side) {
    return allAvailableMoves(side).length > 0;
  }

  function finalizeGameOver(reason) {
    state.phase = "GAME_OVER";
    renderHUD();

    // decide winner by score if rounds ended
    let msg = "";
    if (reason === "noMovesPlayer") {
      msg = "你已無法出任何拳：敗北。";
    } else if (reason === "noMovesEnemy") {
      msg = "對手已無法出任何拳：你獲勝！";
    } else {
      if (state.score.player > state.score.enemy) msg = "20 回合結束：你以比分獲勝！";
      else if (state.score.player < state.score.enemy) msg = "20 回合結束：你以比分落敗。";
      else msg = "20 回合結束：平局。";
    }

    addLog(`<b>【結束】</b> ${msg}`);
    toast("遊戲結束");
  }

  // ====== Turn flow ======
  async function playerMove(hand, punch) {
    if (state.phase !== "PLAYER_TURN") return;

    await unlockAudio();

    if (!canPunch("player", hand, punch)) {
      toast("這隻手無法出這個拳（手指不足）");
      return;
    }

    state.phase = "RESOLVING";
    state.last.player = { hand, punch };
    renderHUD();

    await sleep(180);

    const eMove = enemyPickMove();
    state.last.enemy = eMove;
    renderHUD();

    // If enemy can't move => player wins immediately
    if (!eMove) {
      state.score.player += 1;
      setResultUI("win");
      addLog(`第 <b>${MAX_ROUNDS - state.roundsLeft + 1}</b> 回合：你出 <b>${fmtMove(state.last.player)}</b>，對手 <b>無法出拳</b> → <span class="log-win">你贏</span>`);
      finalizeGameOver("noMovesEnemy");
      return;
    }

    const r = judge(punch, eMove.punch);

    const roundIndex = MAX_ROUNDS - state.roundsLeft + 1;
    const pText = fmtMove(state.last.player);
    const eText = fmtMove(state.last.enemy);

    if (r === 0) {
      setResultUI("draw");
      addLog(`第 <b>${roundIndex}</b> 回合：你出 <b>${pText}</b>，對手出 <b>${eText}</b> → <span class="log-draw">平手</span>`);
    } else if (r === 1) {
      state.score.player += 1;
      setResultUI("win");
      breakRandomEnemyFinger(eMove.hand);
      addLog(`第 <b>${roundIndex}</b> 回合：你出 <b>${pText}</b>，對手出 <b>${eText}</b> → <span class="log-win">你贏</span>（對手 ${HAND_LABEL[eMove.hand]} 折一指）`);
    } else {
      state.score.enemy += 1;
      setResultUI("lose");
      addLog(`第 <b>${roundIndex}</b> 回合：你出 <b>${pText}</b>，對手出 <b>${eText}</b> → <span class="log-lose">你輸</span>（你必須折斷 ${HAND_LABEL[hand]} 一指）`);
      openBreakModal(hand);
    }

    // decrement rounds (every resolved round counts)
    state.roundsLeft -= 1;

    // immediate no-move checks
    if (!sideHasAnyMove("player")) {
      renderHUD();
      finalizeGameOver("noMovesPlayer");
      return;
    }
    if (!sideHasAnyMove("enemy")) {
      renderHUD();
      finalizeGameOver("noMovesEnemy");
      return;
    }

    // if rounds ended, end by score (unless we are in PICK_FINGER)
    if (state.roundsLeft <= 0 && state.phase !== "PICK_FINGER") {
      renderHUD();
      finalizeGameOver("roundsEnd");
      return;
    }

    // if not losing (no finger pick needed), back to player turn
    if (state.phase === "RESOLVING") {
      state.phase = "PLAYER_TURN";
      renderHUD();
    } else {
      // losing -> waiting for finger pick modal
      renderHUD();
    }
  }

  // After player selects a finger to break
  function onPickFinger(finger) {
    const pb = state.pendingBreak;
    if (!pb) return;

    const hand = pb.hand;
    const ok = breakPlayerFinger(hand, finger);
    if (!ok) return;

    // close modal
    if (dom.fingerModal.open) dom.fingerModal.close();
    state.pendingBreak = null;

    // after breaking, check rounds end and game end
    if (!sideHasAnyMove("player")) {
      renderHUD();
      finalizeGameOver("noMovesPlayer");
      return;
    }
    if (state.roundsLeft <= 0) {
      renderHUD();
      finalizeGameOver("roundsEnd");
      return;
    }

    state.phase = "PLAYER_TURN";
    renderHUD();
  }

  // 通用 ESC 返回主頁
//(function () {
 // window.addEventListener("keydown", function (e) {
    // 避免在輸入框中誤觸
  //  const tag = document.activeElement?.tagName;
   // if (tag === "INPUT" || tag === "TEXTAREA") return;

  //  if (e.key === "Escape") {
      // 可選：播放音效 / 顯示提示（之後可加）
   //  location.href = "index.html";
 //   }
//  });
//})();

  // ====== Reset / Init ======
  function resetGame(showIntro = true) {
    state.roundsLeft = MAX_ROUNDS;
    state.phase = showIntro ? "INTRO" : "PLAYER_TURN";
    state.pendingBreak = null;
    state.last.player = null;
    state.last.enemy = null;
    state.score.player = 0;
    state.score.enemy = 0;

    state.hands.player.left = new Set();
    state.hands.player.right = new Set();
    state.hands.enemy.left = new Set();
    state.hands.enemy.right = new Set();

    dom.logBody.innerHTML = "";
    addLog(`<b>提示：</b>石頭只要該手還有任何手指就能出；剪刀/布需要特定手指。`);
    renderHUD();

    if (showIntro) dom.helpModal.showModal();
  }

  function bindEvents() {
    dom.actionGrid.addEventListener("click", (e) => {
      const btn = e.target.closest("button.cardbtn");
      if (!btn || btn.disabled) return;
      playerMove(btn.dataset.hand, btn.dataset.punch);
    });

    dom.btnReset.addEventListener("click", () => resetGame(true));
    dom.btnHelp.addEventListener("click", () => dom.helpModal.showModal());
    dom.ruleChip.addEventListener("click", () => dom.helpModal.showModal());

    dom.helpClose.addEventListener("click", () => dom.helpModal.close());
    dom.helpOk.addEventListener("click", async () => {
      await unlockAudio();
      dom.helpModal.close();
      state.phase = "PLAYER_TURN";
      renderHUD();
      toast("開始！");
    });

    dom.fingerPick.addEventListener("click", (e) => {
      const btn = e.target.closest("button.pickbtn");
      if (!btn || btn.disabled) return;
      onPickFinger(btn.dataset.finger);
    });

    // prevent escaping the punishment
    dom.fingerClose.addEventListener("click", forcePickWarning);
    dom.fingerCancel.addEventListener("click", forcePickWarning);
    dom.fingerModal.addEventListener("cancel", (e) => {
      if (state.phase === "PICK_FINGER") {
        e.preventDefault();
        forcePickWarning();
      }
    });
  }

  // ====== Start ======
  function init() {
    bindEvents();
    resetGame(true);
  }

  init();
})();
