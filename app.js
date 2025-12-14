// =========================
// MBTI熊 - app.js（JSON 分檔 + 配對 Dock 視窗 + 筆記本進階）
// =========================

const DEFAULT_TEST_URL = "https://www.16personalities.com/";
const MBTI_JSON_URL = "./data/mbti.json";

const BEAR_QUOTES = [
  "🐻 你現在最想被理解的是哪一件事？",
  "🐻 你今天做得最棒的一件小事是什麼？",
  "🐻 你最近最常卡住的情緒是：焦慮、委屈、生氣、空虛、疲憊，哪一個？",
  "🐻 你希望關係裡更常出現：被肯定、被理解、被尊重、被陪伴？",
  "🐻 不是要變成別人，是把自己用得更順、更舒服。",
  "🐻 今天先照顧自己 1% 就很棒了。",
  "🐻 你想要的答案，可能藏在你不敢說出口的那句話裡。"
];

let MBTI = {};
let TYPES = [];
let currentType = "INFP";
let pairMode = "work";

// ====== UI ======
const typeInput = document.getElementById("typeInput");
const goTypeBtn = document.getElementById("goTypeBtn");
const typeSelect = document.getElementById("typeSelect");
const randomBtn = document.getElementById("randomBtn");
const testUrl = document.getElementById("testUrl");
const openTestBtn = document.getElementById("openTestBtn");
const copyTypeBtn = document.getElementById("copyTypeBtn");

const bearBtn = document.getElementById("bearBtn");
const bubble = document.getElementById("bubble");

// Dock
const dockPair = document.getElementById("dockPair");
const dockNotebook = document.getElementById("dockNotebook");

// Modals
const modalType = document.getElementById("modalType");
const modalTypeTitle = document.getElementById("modalTypeTitle");
const modalTypeContent = document.getElementById("modalTypeContent");
const openDetailBtn = document.getElementById("openDetailBtn");

const modalPair = document.getElementById("modalPair");
const modalPairTitle = document.getElementById("modalPairTitle");
const modalPairContent = document.getElementById("modalPairContent");
const pairA = document.getElementById("pairA");
const pairB = document.getElementById("pairB");
const pairBtn = document.getElementById("pairBtn");
const pairSwapBtn = document.getElementById("pairSwapBtn");

const modalNotebook = document.getElementById("modalNotebook");
const noteName = document.getElementById("noteName");
const noteCategory = document.getElementById("noteCategory");
const noteType = document.getElementById("noteType");
const noteMemo = document.getElementById("noteMemo");
const noteSaveBtn = document.getElementById("noteSaveBtn");
const noteList = document.getElementById("noteList");
const noteClearBtn = document.getElementById("noteClearBtn");
const noteSearch = document.getElementById("noteSearch");

// ====== Modal helpers ======
function openModal(el){
  el.classList.add("show");
  el.setAttribute("aria-hidden","false");
}
function closeModal(el){
  el.classList.remove("show");
  el.setAttribute("aria-hidden","true");
}

document.querySelectorAll("[data-close='1']").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    closeModal(modalType);
    closeModal(modalPair);
    closeModal(modalNotebook);
  });
});

window.addEventListener("keydown",(e)=>{
  if(e.key==="Escape"){
    closeModal(modalType);
    closeModal(modalPair);
    closeModal(modalNotebook);
  }
});

// ====== Utils ======
function normalizeType(s){
  return (s||"").trim().toUpperCase().replace(/[^A-Z]/g,"").slice(0,4);
}
function randomBearLine(){
  return BEAR_QUOTES[Math.floor(Math.random()*BEAR_QUOTES.length)];
}
function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function categoryLabel(v){
  if(v==="family") return "家人";
  if(v==="friend") return "朋友";
  if(v==="coworker") return "同事";
  return "未分類";
}

// ====== Render MBTI detail HTML ======
function buildTypeHtml(t){
  const d = MBTI[t];
  if(!d) return "找不到此人格資料。";

  const pills = [
    `<span class="pill"><b>${t}</b>｜${escapeHtml(d.name)}</span>`,
    ...(d.tags || []).map(x => `<span class="pill">✨ ${escapeHtml(x)}</span>`)
  ].join("");

  const toList = (arr) => (arr && arr.length) ? `- ${arr.join("<br>- ")}` : "-（待補）";

  return `
<div class="kv">${pills}</div>

<b>人格特質：</b> ${escapeHtml(d.traits)}<br><br>

<b>優勢：</b><br>${toList((d.strengths||[]).map(escapeHtml))}<br><br>

<b>可能盲點：</b><br>${toList((d.blindspots||[]).map(escapeHtml))}<br><br>

<b>適合工作/領域：</b><br>${toList((d.work||[]).map(escapeHtml))}<br><br>

<b>職場提醒（更順、更不耗能）：</b><br>${toList((d.workTips||[]).map(escapeHtml))}<br><br>

<b>親密關係建議（更靠近、更安心）：</b><br>${toList((d.loveTips||[]).map(escapeHtml))}<br><br>

<b>熊熊提醒：</b><br>${escapeHtml(d.bear)}
`.trim();
}

function setCurrentType(t){
  if(!MBTI[t]) return;
  currentType = t;
  typeSelect.value = t;
  typeInput.value = t;
  modalTypeTitle.textContent = `📘 ${t}｜${MBTI[t].name}`;
  modalTypeContent.innerHTML = buildTypeHtml(t);
}

// ====== Select init ======
function fillSelect(sel){
  sel.innerHTML = TYPES.map(t => `<option value="${t}">${t}｜${escapeHtml(MBTI[t].name)}</option>`).join("");
}

// ====== Pairing logic ======
function diffLetters(a,b){
  const pairs = [
    ["E","I","能量來源（外向/內向）"],
    ["S","N","資訊偏好（細節/可能性）"],
    ["T","F","決策偏好（邏輯/感受）"],
    ["J","P","生活節奏（計畫/彈性）"],
  ];
  const diffs=[];
  for(const [x,y,label] of pairs){
    const ia = a.includes(x)?x:y;
    const ib = b.includes(x)?x:y;
    if(ia!==ib) diffs.push({label,a:ia,b:ib});
  }
  return diffs;
}

function pairingAdvice(a,b,mode){
  const diffs = diffLetters(a,b);
  const sameCount = 4 - diffs.length;

  const scoreWord =
    sameCount===4 ? "默契很高" :
    sameCount===3 ? "默契偏高" :
    sameCount===2 ? "互補型" :
    sameCount===1 ? "差異很大但可互補" :
    "完全互補（需要刻意練習）";

  let lines=[];
  lines.push(`A：${a}｜${MBTI[a].name}`);
  lines.push(`B：${b}｜${MBTI[b].name}`);
  lines.push(`\n整體感覺：${scoreWord}`);
  lines.push(`差異點：${diffs.length ? "" : "幾乎同頻"}`);
  if(diffs.length){
    for(const d of diffs){
      lines.push(`- ${d.label}：A(${d.a}) vs B(${d.b})`);
    }
  }

  if(mode==="work"){
    lines.push(`\n【職場相處怎麼更順】`);
    if(diffs.some(x=>x.label.includes("資訊偏好"))) lines.push(`- 先定義成果，再分工（框架/細節）。`);
    if(diffs.some(x=>x.label.includes("決策偏好"))) lines.push(`- 先講事實與選項，再談感受與影響。`);
    if(diffs.some(x=>x.label.includes("生活節奏"))) lines.push(`- 用最小必要規則（截止日/責任人），其他給彈性。`);
    if(diffs.some(x=>x.label.includes("能量來源"))) lines.push(`- 先給時間想，再約固定對齊點（避免即席逼迫）。`);
    lines.push(`- 熊熊小招：先問「你想先談方向還是先對細節？」`);
  }else{
    lines.push(`\n【親密關係怎麼更靠近】`);
    if(diffs.some(x=>x.label.includes("能量來源"))) lines.push(`- 建立可預期節奏：相處＋各自充電都要有。`);
    if(diffs.some(x=>x.label.includes("決策偏好"))) lines.push(`- 衝突順序：先安撫 → 再討論 → 再行動。`);
    if(diffs.some(x=>x.label.includes("生活節奏"))) lines.push(`- 用約定取代控制：回訊/重要日子/底線講清楚。`);
    if(diffs.some(x=>x.label.includes("資訊偏好"))) lines.push(`- 一個講需要、一個講願景：兩個都講才安全。`);
    lines.push(`- 熊熊小招：每天一句「我今天最需要陪伴/空間/肯定/理解？」`);
  }
  lines.push(`\n🐻 熊熊提醒：相容不是天生，是一起練出來的默契。`);
  return lines.join("\n");
}

// ====== Notebook storage (v2) ======
const NOTE_KEY = "mbtiBearNotes_v2";
let noteFilter = "all";

function loadNotes(){
  try{ return JSON.parse(localStorage.getItem(NOTE_KEY) || "[]"); }
  catch{ return []; }
}
function saveNotes(arr){
  localStorage.setItem(NOTE_KEY, JSON.stringify(arr));
}

function renderNotes(){
  const kw = (noteSearch.value || "").trim().toLowerCase();
  let notes = loadNotes();

  if(noteFilter !== "all"){
    notes = notes.filter(n => n.category === noteFilter);
  }

  if(kw){
    notes = notes.filter(n => {
      const label = `${n.type} ${MBTI[n.type]?.name || ""} ${categoryLabel(n.category)}`;
      return (
        (n.name||"").toLowerCase().includes(kw) ||
        (n.type||"").toLowerCase().includes(kw) ||
        (n.memo||"").toLowerCase().includes(kw) ||
        label.toLowerCase().includes(kw)
      );
    });
  }

  if(!notes.length){
    noteList.textContent = "目前沒有符合條件的筆記。";
    return;
  }

  noteList.innerHTML = notes.map(n => {
    const label = `${n.type}｜${MBTI[n.type]?.name || ""}`;
    const cat = categoryLabel(n.category);
    const memo = (n.memo || "").trim();

    return `
      <div class="note-item">
        <div class="note-left">
          <div class="note-name">${escapeHtml(n.name)} <span style="color:#7a5a6a;font-weight:700;">（${cat}）</span></div>
          <div class="note-meta">${escapeHtml(label)} ・ ${escapeHtml(n.time)}</div>
          ${memo ? `<div class="note-memo">📝 ${escapeHtml(memo)}</div>` : ""}
        </div>
        <div class="note-actions">
          <button class="note-btn" data-note-open="${escapeHtml(n.type)}">查看</button>
          <button class="note-btn" data-note-del="${escapeHtml(n.id)}">刪除</button>
        </div>
      </div>
    `;
  }).join("");

  noteList.querySelectorAll("[data-note-open]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const t = btn.getAttribute("data-note-open");
      if(MBTI[t]){
        setCurrentType(t);
        openModal(modalType);
      }
    });
  });

  noteList.querySelectorAll("[data-note-del]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-note-del");
      const all = loadNotes().filter(n => String(n.id) !== String(id));
      saveNotes(all);
      renderNotes();
    });
  });
}

function bindNoteFilterChips(){
  document.querySelectorAll(".chip-filter").forEach(chip=>{
    chip.addEventListener("click", ()=>{
      document.querySelectorAll(".chip-filter").forEach(x=>x.classList.remove("active"));
      chip.classList.add("active");
      noteFilter = chip.dataset.filter;
      renderNotes();
    });
  });
}

// ====== Events ======

// bear bubble
bubble.textContent = randomBearLine();
bearBtn.addEventListener("click", ()=> bubble.textContent = randomBearLine());
bubble.addEventListener("pointerdown", ()=>{
  const timer = setTimeout(async ()=>{
    try{
      await navigator.clipboard.writeText(bubble.textContent);
      bubble.textContent = "✅ 已複製！";
      setTimeout(()=> bubble.textContent = randomBearLine(), 900);
    }catch{}
  }, 520);

  const up = ()=>{
    clearTimeout(timer);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
  };
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
});

// test url
testUrl.value = DEFAULT_TEST_URL;
openTestBtn.addEventListener("click", ()=>{
  const url = (testUrl.value || DEFAULT_TEST_URL).trim();
  if(!/^https?:\/\//i.test(url)){
    alert("請輸入以 http(s):// 開頭的網址");
    return;
  }
  window.open(url, "_blank", "noopener");
});

// copy type
copyTypeBtn.addEventListener("click", async ()=>{
  try{
    await navigator.clipboard.writeText(currentType);
    bubble.textContent = `✅ 已複製：${currentType}`;
  }catch{}
});

// 查詢人格：查看 -> 開人格詳解視窗
goTypeBtn.addEventListener("click", ()=>{
  const t = normalizeType(typeInput.value) || typeSelect.value;
  if(MBTI[t]){
    setCurrentType(t);
    openModal(modalType);
  }else{
    alert("找不到這個 MBTI，請輸入 4 碼英文，例如 INFP。");
  }
});

typeInput.addEventListener("keydown",(e)=>{
  if(e.key==="Enter") goTypeBtn.click();
});
typeSelect.addEventListener("change", ()=> setCurrentType(typeSelect.value));

randomBtn.addEventListener("click", ()=>{
  const t = TYPES[Math.floor(Math.random()*TYPES.length)];
  setCurrentType(t);
  openModal(modalType);
});

openDetailBtn.addEventListener("click", ()=> openModal(modalType));

// Dock：配對（✅ 你要求：左下角人格按鈕變配對按鈕）
dockPair.addEventListener("click", ()=>{
  if(MBTI[currentType]) pairA.value = currentType;
  modalPairTitle.textContent = "🤝 配對相處指南";
  modalPairContent.textContent = "請先選擇兩種人格，按「分析」。";
  openModal(modalPair);
});

// Pair mode buttons
document.querySelectorAll(".seg-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".seg-btn").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    pairMode = btn.dataset.mode;
  });
});

pairSwapBtn.addEventListener("click", ()=>{
  const a = pairA.value;
  pairA.value = pairB.value;
  pairB.value = a;
});

pairBtn.addEventListener("click", ()=>{
  const a = pairA.value;
  const b = pairB.value;
  if(!MBTI[a] || !MBTI[b]) return;
  const full = pairingAdvice(a,b,pairMode);
  modalPairTitle.textContent = `🤝 ${a} × ${b}（${pairMode==="work" ? "職場" : "親密"}）`;
  modalPairContent.textContent = full; // ✅ 按分析後「跳出結果」= 同視窗顯示完整結果
});

// Dock：筆記本
dockNotebook.addEventListener("click", ()=>{
  renderNotes();
  openModal(modalNotebook);
});

noteSaveBtn.addEventListener("click", ()=>{
  const name = (noteName.value||"").trim();
  const category = noteCategory.value;
  const type = noteType.value;
  const memo = (noteMemo.value||"").trim();

  if(!name){
    alert("請先輸入暱稱或名字");
    return;
  }
  if(!MBTI[type]){
    alert("請選擇有效的 MBTI");
    return;
  }

  const now = new Date();
  const time = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

  const notes = loadNotes();
  notes.unshift({
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name,
    category,
    type,
    memo,
    time
  });
  saveNotes(notes);

  noteName.value = "";
  noteMemo.value = "";
  renderNotes();
});

noteClearBtn.addEventListener("click", ()=>{
  if(!confirm("確定要清空全部筆記嗎？")) return;
  saveNotes([]);
  renderNotes();
});

noteSearch.addEventListener("input", ()=> renderNotes());
bindNoteFilterChips();

// ====== Load MBTI JSON then init ======
async function init(){
  try{
    const res = await fetch(MBTI_JSON_URL, { cache: "no-store" });
    if(!res.ok) throw new Error("fetch failed");
    MBTI = await res.json();
    TYPES = Object.keys(MBTI).sort();

    fillSelect(typeSelect);
    fillSelect(pairA);
    fillSelect(pairB);
    fillSelect(noteType);

    const initType = MBTI[currentType] ? currentType : TYPES[0];
    setCurrentType(initType);

    pairA.value = initType;
    pairB.value = initType;

  }catch(e){
    alert("⚠️ MBTI 資料載入失敗：請確認 data/mbti.json 路徑是否正確，且已上傳到 GitHub。");
    console.error(e);
  }
}
init();

// Service Worker（保留）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  });
}