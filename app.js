// =========================
// MBTI熊 - app.js（vNext+）
// ✅ 人格 JSON: landmines 相處地雷
// ✅ 配對結果一鍵存筆記本
// ✅ 筆記 JSON 匯出/匯入
// ✅ 筆記增加星座欄位
// ✅ 人物筆記：一鍵生成溝通建議（landmines + loveTips/workTips）
// ✅ 配對：一鍵產生相處行動清單（3條）
// =========================

const DEFAULT_TEST_URL = "https://www.16personalities.com/";
const MBTI_JSON_URL = "./data/mbti.json";

const BEAR_QUOTES = [
  "🐻 你現在最想被理解的是哪一件事？",
  "🐻 你今天做得最棒的一件小事是什麼？",
  "🐻 如果今天只能照顧自己 1%，你想先照顧哪裡？",
  "🐻 你最希望別人怎麼跟你說話，才會覺得被尊重？",
  "🐻 衝突前先問：我想被理解的是什麼？",
  "🐻 不是要變成別人，是把自己用得更順、更舒服。",
  "🐻 先把心放回身體裡：喝水、深呼吸、再說話。"
];

let MBTI = {};
let TYPES = [];
let currentType = "INFP";
let pairMode = "work";
let lastPairText = "";
let lastPairMeta = null;
let lastPairActions = "";

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

const dockPair = document.getElementById("dockPair");
const dockNotebook = document.getElementById("dockNotebook");

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
const pairSaveBtn = document.getElementById("pairSaveBtn");
const pairActionBtn = document.getElementById("pairActionBtn");

const modalNotebook = document.getElementById("modalNotebook");
const noteName = document.getElementById("noteName");
const noteCategory = document.getElementById("noteCategory");
const noteType = document.getElementById("noteType");
const noteZodiac = document.getElementById("noteZodiac");
const noteMemo = document.getElementById("noteMemo");
const noteAdviceBtn = document.getElementById("noteAdviceBtn");
const noteSaveBtn = document.getElementById("noteSaveBtn");
const noteList = document.getElementById("noteList");
const noteClearBtn = document.getElementById("noteClearBtn");
const noteSearch = document.getElementById("noteSearch");

const noteExportBtn = document.getElementById("noteExportBtn");
const noteImportBtn = document.getElementById("noteImportBtn");
const noteImportFile = document.getElementById("noteImportFile");
const noteImportText = document.getElementById("noteImportText");
const noteImportTextBtn = document.getElementById("noteImportTextBtn");

// ====== Modal helpers ======
function openModal(el){ el.classList.add("show"); el.setAttribute("aria-hidden","false"); }
function closeModal(el){ el.classList.remove("show"); el.setAttribute("aria-hidden","true"); }

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
function normalizeType(s){ return (s||"").trim().toUpperCase().replace(/[^A-Z]/g,"").slice(0,4); }
function randomBearLine(){ return BEAR_QUOTES[Math.floor(Math.random()*BEAR_QUOTES.length)]; }
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
function nowStamp(){
  const now = new Date();
  return `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
}
function uid(){ return `${Date.now()}_${Math.random().toString(16).slice(2)}`; }

// ====== Render MBTI detail ======
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

<b>⭐ 相處地雷（請溫柔避開）：</b><br>${toList((d.landmines||[]).map(escapeHtml))}<br><br>

<b>適合工作/領域：</b><br>${toList((d.work||[]).map(escapeHtml))}<br><br>

<b>職場提醒：</b><br>${toList((d.workTips||[]).map(escapeHtml))}<br><br>

<b>親密關係建議：</b><br>${toList((d.loveTips||[]).map(escapeHtml))}<br><br>

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
    ["J","P","生活節奏（計畫/彈性）"]
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

// ✅ 生成相處行動清單（3條）
function buildPairActions(a,b,mode){
  const A = MBTI[a] || {};
  const B = MBTI[b] || {};
  const diffs = diffLetters(a,b);

  const pick = (arr, i) => (arr && arr.length) ? arr[i % arr.length] : "";
  const pickLandmine = (d, i) => pick(d.landmines || [], i);
  const pickTip = (d, i, mode) => {
    const source = mode === "work" ? (d.workTips || []) : (d.loveTips || []);
    return pick(source, i);
  };

  // 1) 避地雷（從雙方 landmines 各挑 1 句，拼成可執行）
  const lmA = pickLandmine(A, 0);
  const lmB = pickLandmine(B, 0);
  const act1 = `1) 先避雷：跟 ${a} 相處先避開「${lmA || "過度逼迫/否定"}」；跟 ${b} 相處先避開「${lmB || "過度逼迫/否定"}」。`;

  // 2) 用一句話的溝通方式（從 tips 各挑 1 句，合併成共識）
  const tipA = pickTip(A, 0, mode);
  const tipB = pickTip(B, 0, mode);
  const act2 = `2) 溝通方式：先用 ${mode==="work" ? "成果/結論" : "安撫/確認"} 開場，再補細節。A 記得：${tipA || "先講結論再補充"}；B 記得：${tipB || "先回應感受再討論"}。`;

  // 3) 建立一個「小規則」（依差異自動給）
  let act3 = "";
  if(mode==="work"){
    if(diffs.some(x=>x.label.includes("生活節奏"))){
      act3 = "3) 合作小規則：所有任務先定『截止日＋責任人』，其餘讓各自用舒服的方式完成。";
    }else if(diffs.some(x=>x.label.includes("資訊偏好"))){
      act3 = "3) 合作小規則：每次討論固定三段：目標(1句)→選項(最多3個)→下一步(誰做/何時交)。";
    }else{
      act3 = "3) 合作小規則：每週 10 分鐘對齊：本週最重要 1 件事＋卡住點 1 件事。";
    }
  }else{
    if(diffs.some(x=>x.label.includes("能量來源"))){
      act3 = "3) 關係小規則：固定『相處日』＋『各自充電日』，避免用猜的造成誤會。";
    }else if(diffs.some(x=>x.label.includes("決策偏好"))){
      act3 = "3) 關係小規則：衝突三步驟：先抱抱/安撫 → 再講需求 → 再定一個小改變。";
    }else{
      act3 = "3) 關係小規則：每天一句確認：『你今天最需要我做什麼？』";
    }
  }

  return [act1, act2, act3].join("\n");
}

// ====== Notebook storage ======
const NOTE_KEY = "mbtiBearNotes_v3";
let noteFilter = "all";

function loadNotes(){
  try{
    const arr = JSON.parse(localStorage.getItem(NOTE_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  }catch{
    return [];
  }
}
function saveNotes(arr){ localStorage.setItem(NOTE_KEY, JSON.stringify(arr)); }

function renderNotes(){
  const kw = (noteSearch.value || "").trim().toLowerCase();
  let notes = loadNotes();

  if(noteFilter !== "all") notes = notes.filter(n => n.category === noteFilter);
  if(kw) notes = notes.filter(n => JSON.stringify(n).toLowerCase().includes(kw));

  if(!notes.length){
    noteList.textContent = "目前沒有符合條件的筆記。";
    return;
  }

  noteList.innerHTML = notes.map(n => {
    if(n.kind === "pair"){
      const title = n.title || `配對：${n.a}×${n.b}`;
      const cat = categoryLabel(n.category);
      const meta = `${cat} ・ ${n.mode==="work" ? "職場" : "親密"} ・ ${n.time || ""}`;
      return `
        <div class="note-item">
          <div class="note-left">
            <div class="note-name">🤝 ${escapeHtml(title)} <span style="color:#7a5a6a;font-weight:700;">（${cat}）</span></div>
            <div class="note-meta">${escapeHtml(meta)}</div>
            <div class="note-memo">📌 ${escapeHtml(n.memo || "")}</div>
          </div>
          <div class="note-actions">
            <button class="note-btn" data-note-del="${escapeHtml(n.id)}">刪除</button>
          </div>
        </div>
      `;
    }

    const label = `${n.type}｜${MBTI[n.type]?.name || ""}`;
    const cat = categoryLabel(n.category);
    const zodiac = (n.zodiac || "").trim();
    const memo = (n.memo || "").trim();
    const meta = `${label}${zodiac ? " ・ " + zodiac : ""} ・ ${n.time || ""}`;

    return `
      <div class="note-item">
        <div class="note-left">
          <div class="note-name">${escapeHtml(n.name)} <span style="color:#7a5a6a;font-weight:700;">（${cat}）</span></div>
          <div class="note-meta">${escapeHtml(meta)}</div>
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
      saveNotes(loadNotes().filter(n => String(n.id) !== String(id)));
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

// ====== Export/Import ======
function downloadJson(filename, obj){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizeImportedNotes(arr){
  if(!Array.isArray(arr)) return [];
  return arr
    .filter(x => x && typeof x === "object")
    .map(x => {
      const kind = x.kind === "pair" ? "pair" : "person";
      if(kind === "pair"){
        return {
          kind: "pair",
          id: String(x.id || uid()),
          category: x.category || (x.mode==="work" ? "coworker" : "friend"),
          a: String(x.a || "").toUpperCase(),
          b: String(x.b || "").toUpperCase(),
          mode: x.mode === "love" ? "love" : "work",
          title: x.title || "",
          memo: String(x.memo || ""),
          time: x.time || nowStamp()
        };
      }
      return {
        kind: "person",
        id: String(x.id || uid()),
        name: String(x.name || "未命名"),
        category: x.category || "friend",
        type: String(x.type || "").toUpperCase(),
        zodiac: String(x.zodiac || ""),
        memo: String(x.memo || ""),
        time: x.time || nowStamp()
      };
    });
}

function importNotes(arr, mode){
  const incoming = normalizeImportedNotes(arr);
  if(!incoming.length){
    alert("匯入內容不是有效的筆記陣列（JSON Array）。");
    return;
  }
  const current = loadNotes();

  if(mode === "replace"){
    saveNotes(incoming);
    renderNotes();
    alert("✅ 已用匯入內容覆蓋現有筆記");
    return;
  }

  const map = new Map(current.map(n => [String(n.id), n]));
  for(const n of incoming) map.set(String(n.id), n);

  const merged = Array.from(map.values())
    .sort((a,b)=> (b.time||"").localeCompare(a.time||""));
  saveNotes(merged);
  renderNotes();
  alert("✅ 已合併匯入筆記");
}

// ====== Events ======

// 熊熊氣泡
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

// 測驗入口
testUrl.value = DEFAULT_TEST_URL;
openTestBtn.addEventListener("click", ()=>{
  const url = (testUrl.value || DEFAULT_TEST_URL).trim();
  if(!/^https?:\/\//i.test(url)) return alert("請輸入以 http(s):// 開頭的網址");
  window.open(url, "_blank", "noopener");
});

// 複製目前人格
copyTypeBtn.addEventListener("click", async ()=>{
  try{
    await navigator.clipboard.writeText(currentType);
    bubble.textContent = `✅ 已複製：${currentType}`;
  }catch{}
});

// 查人格
goTypeBtn.addEventListener("click", ()=>{
  const t = normalizeType(typeInput.value) || typeSelect.value;
  if(MBTI[t]){
    setCurrentType(t);
    openModal(modalType);
  }else alert("找不到這個 MBTI，請輸入 4 碼英文，例如 INFP。");
});
typeInput.addEventListener("keydown",(e)=>{ if(e.key==="Enter") goTypeBtn.click(); });
typeSelect.addEventListener("change", ()=> setCurrentType(typeSelect.value));
randomBtn.addEventListener("click", ()=>{
  const t = TYPES[Math.floor(Math.random()*TYPES.length)];
  setCurrentType(t);
  openModal(modalType);
});
openDetailBtn.addEventListener("click", ()=> openModal(modalType));

// Dock：配對
dockPair.addEventListener("click", ()=>{
  if(MBTI[currentType]) pairA.value = currentType;
  modalPairTitle.textContent = "🤝 配對相處指南";
  modalPairContent.textContent = "請先選擇兩種人格，按「分析」。";
  lastPairText = "";
  lastPairMeta = null;
  lastPairActions = "";
  openModal(modalPair);
});

// 情境切換
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
  modalPairContent.textContent = full;

  lastPairText = full;
  lastPairMeta = { a, b, mode: pairMode };
  lastPairActions = ""; // 重新分析後清空行動清單
});

// ✅ 生成 3 條相處行動清單
pairActionBtn.addEventListener("click", ()=>{
  if(!lastPairMeta){
    alert("請先按「分析」產生配對結果，再生成行動清單。");
    return;
  }
  const { a, b, mode } = lastPairMeta;
  const actions = buildPairActions(a,b,mode);
  lastPairActions = actions;

  // 直接追加在結果下面，讓你一眼看到
  const merged = `${lastPairText}\n\n✅【相處行動清單（3條）】\n${actions}`;
  modalPairContent.textContent = merged;
  lastPairText = merged;

  bubble.textContent = "✅ 已生成相處行動清單（3條）";
});

// ✅ 一鍵存配對到筆記本
pairSaveBtn.addEventListener("click", ()=>{
  if(!lastPairText || !lastPairMeta){
    alert("請先按「分析」產生配對結果，再存入筆記本。");
    return;
  }
  const { a, b, mode } = lastPairMeta;
  const category = (mode === "work") ? "coworker" : "friend";
  const title = `${a}×${b}（${mode==="work" ? "職場" : "親密"}）`;

  const notes = loadNotes();
  notes.unshift({
    kind: "pair",
    id: uid(),
    category,
    a,
    b,
    mode,
    title,
    memo: lastPairText,
    time: nowStamp()
  });
  saveNotes(notes);

  bubble.textContent = "✅ 已存入筆記本（配對紀錄）";
  renderNotes();
  openModal(modalNotebook);
});

// Dock：筆記本
dockNotebook.addEventListener("click", ()=>{
  renderNotes();
  openModal(modalNotebook);
});

// ✅ 人物筆記：一鍵生成溝通建議（塞入備註欄）
noteAdviceBtn.addEventListener("click", ()=>{
  const t = noteType.value;
  if(!MBTI[t]) return alert("請先選擇 MBTI");

  const d = MBTI[t];
  const cat = noteCategory.value;

  const tips = (cat === "coworker") ? (d.workTips || []) : (d.loveTips || []);
  const lms = (d.landmines || []);

  const pick = (arr, i) => (arr && arr.length) ? arr[i % arr.length] : "";
  const a1 = pick(lms, 0) || "否定/逼迫";
  const a2 = pick(lms, 1) || "冷處理/敷衍";
  const t1 = pick(tips, 0) || "先講重點再補細節";
  const t2 = pick(tips, 1) || "先確認再討論";

  const suggestion =
`🗣️【對 ${t} 的溝通建議】 
1) 先避雷：盡量避免「${a1}」與「${a2}」的情境。
2) 建議說法：先用一句話講目的/重點，再補原因與選項。
3) 熊熊小招：${t1}；另外也可以：${t2}`;

  // 追加到備註欄
  const current = (noteMemo.value || "").trim();
  noteMemo.value = current ? `${current}\n\n${suggestion}` : suggestion;

  bubble.textContent = "✅ 已把溝通建議放進備註欄";
});

// 新增人物筆記
noteSaveBtn.addEventListener("click", ()=>{
  const name = (noteName.value||"").trim();
  const category = noteCategory.value;
  const type = noteType.value;
  const zodiac = (noteZodiac.value||"").trim();
  const memo = (noteMemo.value||"").trim();

  if(!name) return alert("請先輸入暱稱或名字");
  if(!MBTI[type]) return alert("請選擇有效的 MBTI");

  const notes = loadNotes();
  notes.unshift({
    kind: "person",
    id: uid(),
    name,
    category,
    type,
    zodiac,
    memo,
    time: nowStamp()
  });
  saveNotes(notes);

  noteName.value = "";
  noteZodiac.value = "";
  noteMemo.value = "";
  renderNotes();
});

// 清空
noteClearBtn.addEventListener("click", ()=>{
  if(!confirm("確定要清空全部筆記嗎？")) return;
  saveNotes([]);
  renderNotes();
});

// 搜尋
noteSearch.addEventListener("input", ()=> renderNotes());
bindNoteFilterChips();

// 匯出
noteExportBtn.addEventListener("click", ()=> downloadJson("mbtiBearNotes.json", loadNotes()));

// 匯入（檔案）
noteImportBtn.addEventListener("click", ()=>{
  noteImportFile.value = "";
  noteImportFile.click();
});
noteImportFile.addEventListener("change", async ()=>{
  const file = noteImportFile.files && noteImportFile.files[0];
  if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    const replace = confirm("要覆蓋現有筆記嗎？\n按【確定】= 覆蓋\n按【取消】= 合併");
    importNotes(data, replace ? "replace" : "merge");
  }catch{
    alert("匯入失敗：請確認檔案是有效 JSON。");
  }
});

// 匯入（貼上）
noteImportTextBtn.addEventListener("click", ()=>{
  const text = (noteImportText.value || "").trim();
  if(!text) return alert("請先貼上 JSON 內容");
  try{
    const data = JSON.parse(text);
    const replace = confirm("要覆蓋現有筆記嗎？\n按【確定】= 覆蓋\n按【取消】= 合併");
    importNotes(data, replace ? "replace" : "merge");
  }catch{
    alert("貼上內容不是有效 JSON。");
  }
});

// ====== Init ======
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

// Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  });
}