import ROLES from "./roles.js";
import BOARDS from "./boards.js";

/* ======================
   全域遊戲狀態（讓 index.html 的紀錄可讀）
====================== */
export const Game = {
  boardId: null,
  board: null,
  players: [],
  phase: "setup", // setup | deal | night | day
  dealIndex: 0,

  nightStepIndex: 0,
  nightSteps: [],
  logs: [],

  settings: {
    playerCount: 9
  },

  night: {
    wolfTarget: null,
    guardTarget: null,
    seerTarget: null,
    seerResult: null,
    witchSave: false,
    witchPoisonTarget: null
  }
};
// 讓 index.html 的 showLogs() 能抓到
window.Game = Game;

/* ======================
   角色配置（9～12 + 各板子預設）
   你之後要調整，只改這裡就好
====================== */
const PRESETS = {
  basic: {
    9:  { werewolf: 2, villager: 5, seer: 1, witch: 1, hunter: 0, guard: 0 },
    10: { werewolf: 3, villager: 5, seer: 1, witch: 1, hunter: 0, guard: 0 },
    11: { werewolf: 3, villager: 5, seer: 1, witch: 1, hunter: 1, guard: 0 },
    12: { werewolf: 3, villager: 5, seer: 1, witch: 1, hunter: 1, guard: 1 }
  },

  wolfKings: {
    10: { werewolf: 2, whiteWolfKing: 1, blackWolfKing: 1, villager: 4, seer: 1, witch: 1 },
    11: { werewolf: 2, whiteWolfKing: 1, blackWolfKing: 1, villager: 5, seer: 1, witch: 1 },
    12: { werewolf: 2, whiteWolfKing: 1, blackWolfKing: 1, villager: 6, seer: 1, witch: 1 }
  },

  lovers: {
    9:  { werewolf: 2, villager: 4, seer: 1, witch: 1, cupid: 1, admirer: 0 },
    10: { werewolf: 3, villager: 4, seer: 1, witch: 1, cupid: 1, admirer: 0 },
    11: { werewolf: 3, villager: 5, seer: 1, witch: 1, cupid: 1, admirer: 0 },
    12: { werewolf: 3, villager: 5, seer: 1, witch: 1, cupid: 1, admirer: 1 }
  },

  control: {
    10: { werewolf: 3, villager: 3, seer: 1, witch: 1, elder: 1, dreamer: 1, magician: 0 },
    11: { werewolf: 3, villager: 4, seer: 1, witch: 1, elder: 1, dreamer: 1, magician: 0 },
    12: { werewolf: 3, villager: 4, seer: 1, witch: 1, elder: 1, dreamer: 1, magician: 1 }
  },

  chaos: {
    10: { werewolf: 3, villager: 2, seer: 1, witch: 1, marketDealer: 1, lucky: 1, idiot: 1, demonHunter: 0 },
    11: { werewolf: 3, villager: 3, seer: 1, witch: 1, marketDealer: 1, lucky: 1, idiot: 1, demonHunter: 0 },
    12: { werewolf: 3, villager: 3, seer: 1, witch: 1, marketDealer: 1, lucky: 1, idiot: 1, demonHunter: 1 }
  }
};

/* ======================
   啟動：一進頁面就顯示「選板子」
====================== */
document.addEventListener("DOMContentLoaded", () => {
  renderSetup();
});

/* ======================
   Setup UI（像手機 App 一樣）
====================== */
function renderSetup(selectedBoardId = Game.boardId || "basic") {
  Game.phase = "setup";
  Game.boardId = selectedBoardId;
  Game.board = BOARDS[selectedBoardId];

  // 可選人數：取板子支援的 players（我們 boards.js 有 players: [9..]）
  const counts = Game.board.players || [9, 10, 11, 12];

  // 若目前人數不在可選範圍，修正成第一個
  if (!counts.includes(Game.settings.playerCount)) {
    Game.settings.playerCount = counts[0];
  }

  const boardCards = Object.values(BOARDS)
    .map(b => {
      const active = b.id === selectedBoardId ? "active" : "";
      return `
        <button class="board-card ${active}" onclick="selectBoard('${b.id}')">
          <div class="board-title">${b.name}</div>
          <div class="board-intro">${b.intro || ""}</div>
          <div class="board-meta">
            適合人數：${(b.players || []).join("–")}
            ・女巫自救：${b.rules?.witchSelfSave === "forbidden" ? "不允許" : "允許"}
          </div>
        </button>
      `;
    })
    .join("");

  const countButtons = counts
    .map(n => {
      const active = n === Game.settings.playerCount ? "active" : "";
      return `<button class="pill ${active}" onclick="setPlayerCount(${n})">${n} 人</button>`;
    })
    .join("");

  const roleSummary = presetSummary(selectedBoardId, Game.settings.playerCount);

  document.getElementById("main").innerHTML = `
    <section class="panel">
      <h2 class="h2">請選擇板子開始遊戲</h2>
      <div class="grid">${boardCards}</div>
    </section>

    <section class="panel">
      <h3 class="h3">玩家人數</h3>
      <div class="row">${countButtons}</div>
      <div class="hint">（可先用預設配置開局，之後再做手動微調功能）</div>
    </section>

    <section class="panel">
      <h3 class="h3">本局角色配置（預設）</h3>
      <div class="card">${roleSummary}</div>
      <button class="primary" onclick="startDeal()">開始抽牌（輪流看身分）</button>
    </section>
  `;
}

// 讓 index.html 也能呼叫（你底部有角色圖鑑、紀錄）
window.selectBoard = (id) => renderSetup(id);
window.setPlayerCount = (n) => {
  Game.settings.playerCount = n;
  renderSetup(Game.boardId);
};

function presetSummary(boardId, count) {
  const preset = PRESETS[boardId]?.[count];
  if (!preset) return `⚠️ 這個板子目前沒有 ${count} 人的預設配置（請改選其他人數或先用基本板）。`;

  const parts = Object.entries(preset)
    .filter(([, v]) => v > 0)
    .map(([roleId, v]) => `${ROLES[roleId]?.name || roleId} × ${v}`)
    .join("、");

  return parts;
}

/* ======================
   產生 roleList（依預設配置）
====================== */
function buildRoleList(boardId, count) {
  const preset = PRESETS[boardId]?.[count];
  if (!preset) throw new Error("找不到此板子的人數預設配置");

  const list = [];
  for (const [roleId, qty] of Object.entries(preset)) {
    for (let i = 0; i < qty; i++) list.push(roleId);
  }
  // 安全檢查：總數要等於玩家數
  if (list.length !== count) {
    throw new Error(`角色數量(${list.length})不等於玩家數(${count})，請檢查 PRESETS。`);
  }
  return shuffle(list);
}

/* ======================
   抽牌（Pass & Play）
====================== */
window.startDeal = function () {
  Game.board = BOARDS[Game.boardId];
  Game.players = createPlayers(Game.settings.playerCount, buildRoleList(Game.boardId, Game.settings.playerCount));
  Game.phase = "deal";
  Game.dealIndex = 0;
  renderDeal();
};

function renderDeal() {
  const p = Game.players[Game.dealIndex];
  document.getElementById("main").innerHTML = `
    <section class="panel">
      <h2 class="h2">請 ${p.seat} 號拿手機</h2>
      <div class="hint">按下後會顯示你的身分，請看完交給下一位。</div>
      <button class="primary" onclick="showRole()">查看身分</button>
      <button class="ghost" onclick="backToSetup()">返回選板子</button>
    </section>
  `;
}

window.backToSetup = function () {
  renderSetup(Game.boardId);
};

window.showRole = function () {
  const p = Game.players[Game.dealIndex];
  const role = ROLES[p.roleId];
  alert(`你是【${role.name}】\n\n${role.skill}`);

  Game.dealIndex++;
  if (Game.dealIndex >= Game.players.length) {
    startNight();
  } else {
    renderDeal();
  }
};

/* ======================
   夜晚流程
====================== */
function startNight() {
  Game.phase = "night";
  Game.nightStepIndex = 0;
  Game.night = {
    wolfTarget: null,
    guardTarget: null,
    seerTarget: null,
    seerResult: null,
    witchSave: false,
    witchPoisonTarget: null
  };
  Game.nightSteps = (Game.board.nightOrder || []).slice();
  renderNightStep();
}

function renderNightStep() {
  const step = Game.nightSteps[Game.nightStepIndex];
  if (!step) {
    resolveNight();
    return;
  }

  const stepTitle = {
    guard: "守衛",
    werewolf: "狼人",
    seer: "預言家",
    witch: "女巫",
    cupid: "邱比特",
    admirer: "暗戀者",
    elder: "禁言長老",
    dreamer: "攝夢人",
    magician: "魔術師"
  }[step] || step;

  // 上帝帶流程提示（像主持稿）
  const scriptLine = {
    guard: "請說：守衛請睜眼，你要守誰？",
    werewolf: "請說：狼人請睜眼，你們要刀誰？",
    seer: "請說：預言家請睜眼，你要查驗誰？",
    witch: "請說：女巫請睜眼。",
    cupid: "請說：邱比特請睜眼，請指定兩位成為情侶。",
    admirer: "請說：暗戀者請睜眼，你要暗戀誰？",
    elder: "請說：禁言長老請睜眼，你要禁言誰？",
    dreamer: "請說：攝夢人請睜眼，你要讓誰進入夢境？",
    magician: "請說：魔術師請睜眼，你要交換哪兩位？"
  }[step] || "";

  document.getElementById("main").innerHTML = `
    <section class="panel">
      <div class="tag">🌙 夜晚步驟 ${Game.nightStepIndex + 1}/${Game.nightSteps.length}</div>
      <h2 class="h2">${stepTitle}行動</h2>
      ${scriptLine ? `<div class="script">${scriptLine}</div>` : ""}
      <div id="stepBody"></div>
      <button class="ghost" onclick="forceNextNight()">跳過這一步</button>
    </section>
  `;

  // 渲染各步驟操作
  switch (step) {
    case "guard":
      pickTarget("stepBody", "守衛守誰？", "guardTarget");
      break;
    case "werewolf":
      pickTarget("stepBody", "狼人刀誰？", "wolfTarget");
      break;
    case "seer":
      pickTarget("stepBody", "預言家驗誰？", "seerTarget", true);
      break;
    case "witch":
      renderWitch("stepBody");
      break;
    default:
      // 其他特殊角色先做「可選目標」的通用版本（不影響你後續擴充）
      pickTarget("stepBody", `${stepTitle}選擇目標`, `__${step}_target`);
      break;
  }
}

window.forceNextNight = function () {
  nextNightStep();
};

function nextNightStep() {
  Game.nightStepIndex++;
  renderNightStep();
}

function pickTarget(containerId, title, key, reveal = false) {
  const container = document.getElementById(containerId);
  const buttons = Game.players
    .filter(p => p.alive)
    .map(p => `<button class="seat" onclick="confirmTarget('${key}', ${p.seat}, ${reveal ? "true" : "false"})">${p.seat}</button>`)
    .join("");

  container.innerHTML = `
    <div class="hint">${title}</div>
    <div class="seats">${buttons}</div>
  `;
}

window.confirmTarget = function (key, seat, reveal) {
  Game.night[key] = seat;

  if (reveal) {
    const target = Game.players.find(p => p.seat === seat);
    const team = ROLES[target.roleId].team === "wolf" ? "狼人" : "好人";
    Game.night.seerResult = team;
    alert(`查驗結果：${seat} 號是【${team}】`);
  }
  nextNightStep();
};

function renderWitch(containerId) {
  const container = document.getElementById(containerId);
  const wolfTarget = Game.night.wolfTarget;
  const witchSeat = Game.players.find(p => p.alive && ROLES[p.roleId].id === "witch")?.seat;

  const cannotSelfSave =
    wolfTarget && witchSeat && wolfTarget === witchSeat && Game.board.rules?.witchSelfSave === "forbidden";

  container.innerHTML = `
    <div class="hint">今晚被刀：<b>${wolfTarget ? wolfTarget + " 號" : "無"}</b></div>
    ${cannotSelfSave ? `<div class="warn">本板子規則：女巫不可自救（解藥鎖定）</div>` : ""}

    <div class="row">
      <button class="primary" ${cannotSelfSave || !wolfTarget ? "disabled" : ""} onclick="witchSave()">用解藥</button>
      <button class="primary" onclick="witchPoisonPick()">用毒藥</button>
      <button class="ghost" onclick="nextNightStep()">不用</button>
    </div>
  `;
}

window.witchSave = function () {
  Game.night.witchSave = true;
  nextNightStep();
};

window.witchPoisonPick = function () {
  pickTarget("stepBody", "女巫毒誰？", "witchPoisonTarget");
};

/* ======================
   夜晚結算
====================== */
function resolveNight() {
  const deaths = new Set();

  // 狼刀判定
  if (Game.night.wolfTarget) {
    const blocked =
      Game.night.wolfTarget === Game.night.guardTarget ||
      Game.night.witchSave;
    if (!blocked) deaths.add(Game.night.wolfTarget);
  }

  // 毒藥判定
  if (Game.night.witchPoisonTarget) deaths.add(Game.night.witchPoisonTarget);

  // 執行死亡
  deaths.forEach(seat => killPlayer(seat, Game.night.witchPoisonTarget === seat ? "poison" : "night"));

  const deathList = [...deaths].map(s => `${s} 號`).join("、") || "沒有人";
  const announce = `天亮了，昨晚死亡的是：${deathList}`;
  Game.logs.push(announce);

  startDay(announce);
}

/* ======================
   死亡處理（黑狼王/白狼王 先保留鉤子）
====================== */
function killPlayer(seat, reason) {
  const p = Game.players.find(x => x.seat === seat);
  if (!p || !p.alive) return;
  p.alive = false;

  const role = ROLES[p.roleId];

  // 黑狼王：非毒殺、非自爆（此版本未做自爆按鈕，reason=explode 預留）
  if (role.id === "blackWolfKing") {
    if (reason !== "poison" && reason !== "explode") {
      alert("黑狼王可發動【狼王之爪】（類似獵人）");
      // 先用簡化：立刻選帶走對象並死亡
      pickTarget("main", "黑狼王要帶走誰？", "__blackWolfClaw");
      // 注意：這裡先不 nextNightStep，因為可能在結算階段
      window.confirmTarget = function (key, targetSeat) {
        // 帶走
        const tp = Game.players.find(x => x.seat === targetSeat);
        if (tp && tp.alive) {
          tp.alive = false;
          Game.logs.push(`黑狼王臨死帶走：${targetSeat} 號`);
        }
        startDay(`天亮了（含狼王技能結算），請查看紀錄`);
      };
    }
  }

  // 白狼王：通常是白天被票出才觸發（reason=vote 預留）
  if (role.id === "whiteWolfKing" && reason === "vote") {
    alert("白狼王發動技能（被放逐時可帶走一人）");
  }
}

/* ======================
   白天（含發言倒數）
====================== */
function startDay(announceText) {
  Game.phase = "day";
  document.getElementById("main").innerHTML = `
    <section class="panel">
      <div class="tag">☀️ 白天</div>
      <div class="card">
        <div style="font-weight:800;margin-bottom:6px;">公告</div>
        <div>${escapeHtml(announceText)}</div>
        <div class="row" style="margin-top:10px;">
          <button class="ghost" onclick="copyText(${JSON.stringify(announceText)})">一鍵複製公告</button>
          <button class="ghost" onclick="startNight()">進入下一夜</button>
        </div>
      </div>

      <div class="card">
        <div style="font-weight:800;margin-bottom:6px;">🕒 白天發言倒數</div>
        <div class="row">
          <button class="pill" onclick="setSpeechMinutes(1)">1 分</button>
          <button class="pill" onclick="setSpeechMinutes(2)">2 分</button>
          <button class="pill" onclick="setSpeechMinutes(3)">3 分</button>
          <button class="pill" onclick="setSpeechMinutes(5)">5 分</button>
        </div>

        <div id="speechTimerDisplay" class="timer">02:00</div>

        <div class="row">
          <button class="primary" onclick="startSpeechTimer()">開始</button>
          <button class="ghost" onclick="pauseSpeechTimer()">暫停</button>
          <button class="ghost" onclick="resetSpeechTimer()">重置</button>
        </div>
      </div>

      <div class="card">
        <div style="font-weight:800;margin-bottom:6px;">👥 存活座位</div>
        <div class="seats">
          ${Game.players.map(p => `<span class="seat-chip ${p.alive ? "" : "dead"}">${p.seat}</span>`).join("")}
        </div>
        <div class="hint">（上帝模式之後我可以再幫你加：點座位看身分）</div>
      </div>
    </section>
  `;

  // 初始顯示更新
  updateSpeechTimerDisplay();
}

/* ======================
   白天發言倒數計時器
====================== */
const speechTimer = {
  duration: 120,
  remaining: 120,
  running: false,
  intervalId: null
};

window.setSpeechMinutes = function (min) {
  if (speechTimer.running) return;
  speechTimer.duration = min * 60;
  speechTimer.remaining = min * 60;
  updateSpeechTimerDisplay();
};

window.startSpeechTimer = function () {
  if (speechTimer.running) return;
  speechTimer.running = true;

  speechTimer.intervalId = setInterval(() => {
    speechTimer.remaining--;
    if (speechTimer.remaining <= 0) {
      speechTimer.remaining = 0;
      pauseSpeechTimer();
      updateSpeechTimerDisplay();
      alert("⏰ 發言時間到！");
      return;
    }
    updateSpeechTimerDisplay();
  }, 1000);
};

window.pauseSpeechTimer = function () {
  speechTimer.running = false;
  clearInterval(speechTimer.intervalId);
  speechTimer.intervalId = null;
};

window.resetSpeechTimer = function () {
  pauseSpeechTimer();
  speechTimer.remaining = speechTimer.duration;
  updateSpeechTimerDisplay();
};

function updateSpeechTimerDisplay() {
  const el = document.getElementById("speechTimerDisplay");
  if (!el) return;

  const m = Math.floor(speechTimer.remaining / 60);
  const s = speechTimer.remaining % 60;
  el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  el.classList.toggle("danger", speechTimer.remaining <= 10 && speechTimer.remaining > 0);
}

/* ======================
   玩家建立 + 工具
====================== */
function createPlayers(count, roleList) {
  return Array.from({ length: count }, (_, i) => ({
    seat: i + 1,
    roleId: roleList[i],
    alive: true,
    isChief: false,
    status: {}
  }));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

window.copyText = async function (txt) {
  try {
    await navigator.clipboard.writeText(txt);
    alert("已複製 ✅");
  } catch {
    alert("複製失敗（iOS 有時會限制，請長按自行複製）");
  }
};

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ======================
   補一點 UI class（讓它更像 App）
   你不用改 style.css 也能先跑，
   但建議我下一步幫你把 style.css 也加這些 class
====================== */
(function injectMiniStyles() {
  const css = `
  .panel{padding:14px}
  .h2{margin:0 0 10px;font-size:22px}
  .h3{margin:0 0 8px;font-size:16px;opacity:.85}
  .hint{font-size:13px;opacity:.7;margin:6px 0}
  .warn{background:#fff1f1;border:1px solid #f2b4b4;padding:10px;border-radius:10px;color:#7a1a1a;margin:8px 0;font-size:13px}
  .tag{display:inline-block;padding:6px 10px;border-radius:999px;background:#fff;opacity:.85;font-size:12px;margin-bottom:10px}
  .grid{display:grid;grid-template-columns:1fr;gap:10px}
  .board-card{width:100%;text-align:left;border:0;border-radius:14px;padding:12px;background:#fff;box-shadow:0 3px 10px rgba(0,0,0,.08)}
  .board-card.active{outline:2px solid #5a0000}
  .board-title{font-weight:900;font-size:16px;margin-bottom:6px}
  .board-intro{font-size:13px;opacity:.8;margin-bottom:6px}
  .board-meta{font-size:12px;opacity:.65}
  .row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
  .pill{border:0;border-radius:999px;padding:10px 12px;background:#eee}
  .pill.active{background:#5a0000;color:#fff}
  .primary{width:100%;border:0;border-radius:14px;padding:14px 12px;background:#5a0000;color:#fff;font-weight:800}
  .ghost{width:100%;border:1px solid #ddd;border-radius:14px;padding:12px;background:#fff}
  .card{background:#fff;border-radius:14px;padding:12px;box-shadow:0 3px 10px rgba(0,0,0,.06)}
  .seats{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  .seat{border:0;border-radius:12px;padding:12px 0;width:64px;background:#f0f0f0;font-weight:800}
  .seat-chip{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:12px;background:#f0f0f0;font-weight:800}
  .seat-chip.dead{opacity:.35;text-decoration:line-through}
  .script{background:#fff7e6;border:1px solid #e7d2a6;border-radius:14px;padding:10px;font-size:13px;line-height:1.5}
  .timer{font-size:42px;font-weight:900;text-align:center;padding:10px 0}
  .timer.danger{color:#c62828;animation:blink 1s infinite}
  @keyframes blink{50%{opacity:.25}}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();