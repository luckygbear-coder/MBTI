/* =========================================================
   MBTI熊｜app.js（對應你提供的 index.html）
   - 讀取 ./data/mbti.json
   - 人格查詢 / 隨機 / 詳細解說（Modal）
   - 配對分析（職場/親密）+ 行動清單（3條）+ 一鍵存筆記本
   - 筆記本：新增人物 / 生成溝通建議 / 搜尋&分類 / 匯出匯入 / 清空
   - 熊熊小語：點頭像換句、長按複製
   ========================================================= */

(() => {
  "use strict";

  /* ----------------------------
   * DOM helpers
   * ---------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const nowISO = () => new Date().toISOString();

  /* ----------------------------
   * LocalStorage
   * ---------------------------- */
  const LS = {
    lastType: "mbtiBear:lastType",
    testUrl: "mbtiBear:testUrl",
    notebook: "mbtiBear:notebook", // { people:[], pairs:[] }
  };

  const safeParse = (s, fallback) => {
    try {
      const v = JSON.parse(s);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  };

  const loadLS = (k, fallback) => safeParse(localStorage.getItem(k), fallback);
  const saveLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  /* ----------------------------
   * Clipboard
   * ---------------------------- */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("✅ 已複製到剪貼簿");
      return true;
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        toast("✅ 已複製到剪貼簿");
        return true;
      } catch {
        toast("⚠️ 複製失敗，請手動複製");
        return false;
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  /* ----------------------------
   * Toast（如果你 style.css 沒有 #toast，會自動建立）
   * ---------------------------- */
  let toastTimer = null;
  function ensureToast() {
    let el = $("#toast");
    if (el) return el;
    el = document.createElement("div");
    el.id = "toast";
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.bottom = "84px";
    el.style.transform = "translateX(-50%)";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "999px";
    el.style.background = "rgba(0,0,0,0.75)";
    el.style.color = "#fff";
    el.style.fontSize = "13px";
    el.style.zIndex = "9999";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    el.style.transition = "opacity .18s ease";
    document.body.appendChild(el);
    return el;
  }
  function toast(msg) {
    const el = ensureToast();
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.style.opacity = "0"), 1500);
  }

  /* ----------------------------
   * Data
   * ---------------------------- */
  const MBTI_CODES = [
    "ISTJ","ISFJ","INFJ","INTJ",
    "ISTP","ISFP","INFP","INTP",
    "ESTP","ESFP","ENFP","ENTP",
    "ESTJ","ESFJ","ENFJ","ENTJ",
  ];

  let MBTI = {}; // from ./data/mbti.json

  function isValidType(code) {
    return MBTI_CODES.includes(code);
  }

  function normalizeType(input) {
    return String(input || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 4);
  }

  function getTypeObj(code) {
    return MBTI[code] || null;
  }

  function typeLabel(code) {
    const o = getTypeObj(code);
    return o ? `${code}｜${o.name}` : code;
  }

  /* ----------------------------
   * 熊熊小語
   * ---------------------------- */
  const BEAR_QUOTES = [
    "🐻 你願意理解自己，就是一種勇敢。",
    "🐻 不用急著變成誰，你先好好做你。",
    "🐻 先把今天過好，明天就會比較溫柔。",
    "🐻 你不是太敏感，你只是感受很準。",
    "🐻 如果累了，先休息一下也沒關係。",
    "🐻 不是每次都要贏，有時候要被抱抱。",
    "🐻 先說需求，不用先道歉。",
    "🐻 你很努力了，真的。",
    "🐻 把關係當隊友，不是對手。",
    "🐻 你可以慢慢來，我在。",
  ];

  function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function setBubble(text) {
    const bubble = $("#bubble");
    if (!bubble) return;
    bubble.textContent = text;
  }

  function initBearChat() {
    const bearBtn = $("#bearBtn");
    const bubble = $("#bubble");
    if (!bearBtn || !bubble) return;

    // 點一下換句
    bearBtn.addEventListener("click", () => {
      setBubble(randomPick(BEAR_QUOTES));
    });

    // 長按複製 bubble 文字
    let pressTimer = null;
    const pressMs = 350;

    const startPress = () => {
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        copyText(bubble.textContent || "");
      }, pressMs);
    };
    const endPress = () => clearTimeout(pressTimer);

    bubble.addEventListener("touchstart", startPress, { passive: true });
    bubble.addEventListener("touchend", endPress);
    bubble.addEventListener("touchcancel", endPress);
    bubble.addEventListener("mousedown", startPress);
    bubble.addEventListener("mouseup", endPress);
    bubble.addEventListener("mouseleave", endPress);
  }

  /* ----------------------------
   * Modal helpers（對應你的結構：data-close="1"）
   * ---------------------------- */
  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add("open");
    modalEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }
  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove("open");
    modalEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }
  function bindModalClose(modalEl) {
    if (!modalEl) return;
    modalEl.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-close") === "1") {
        closeModal(modalEl);
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalEl.classList.contains("open")) closeModal(modalEl);
    });
  }

  /* ----------------------------
   * Populate selects
   * ---------------------------- */
  function fillSelect(selectEl, { includeEmpty = false } = {}) {
    if (!selectEl) return;
    selectEl.innerHTML = "";

    if (includeEmpty) {
      const op = document.createElement("option");
      op.value = "";
      op.textContent = "請選擇…";
      selectEl.appendChild(op);
    }

    MBTI_CODES.forEach((code) => {
      const op = document.createElement("option");
      op.value = code;
      op.textContent = typeLabel(code);
      selectEl.appendChild(op);
    });
  }

  /* ----------------------------
   * Render: Type detail
   * ---------------------------- */
  function renderTypeDetail(code) {
    const o = getTypeObj(code);
    const titleEl = $("#modalTypeTitle");
    const contentEl = $("#modalTypeContent");
    if (!titleEl || !contentEl) return;

    if (!o) {
      titleEl.textContent = "人格詳細解說";
      contentEl.innerHTML = `<div class="hint">找不到 <b>${code}</b> 的資料，請確認 data/mbti.json 是否包含此型。</div>`;
      return;
    }

    const tags = (o.tags || []).map((t) => `<span class="chip">${t}</span>`).join(" ");

    const list = (arr) =>
      (arr || []).length
        ? `<ul>${arr.map((x) => `<li>${escapeHTML(String(x))}</li>`).join("")}</ul>`
        : `<div class="hint small">（尚未填寫）</div>`;

    const section = (ttl, html) => `
      <div class="section-title" style="margin-top:10px;">${ttl}</div>
      <div class="card-soft" style="padding:10px;">${html}</div>
    `;

    titleEl.textContent = `${code}｜${o.name}`;

    contentEl.innerHTML = `
      <div class="card-soft" style="padding:10px;">
        <div style="font-weight:800; font-size:14px;">${escapeHTML(o.traits || "")}</div>
        <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">${tags}</div>
      </div>

      ${section("🌟 優勢", list(o.strengths))}
      ${section("⚠️ 盲點", list(o.blindspots))}
      ${section("💼 適合工作", list(o.work))}
      ${section("🧰 職場提醒", list(o.workTips))}
      ${section("💞 親密關係提醒", list(o.loveTips))}
      ${section("🐻 熊熊一句話", `<div style="line-height:1.6;">${escapeHTML(o.bear || "")}</div>`)}
    `;
  }

  function escapeHTML(s) {
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* ----------------------------
   * Pairing logic（簡單可用的相處指南）
   * - 不是「命定配對」，是「溝通策略」
   * ---------------------------- */
  function dims(code) {
    // E/I, S/N, T/F, J/P
    return {
      EI: code[0], // E/I
      SN: code[1], // S/N
      TF: code[2], // T/F
      JP: code[3], // J/P
    };
  }

  function pairAnalysis(a, b, mode /* work|love */) {
    const A = getTypeObj(a);
    const B = getTypeObj(b);
    const da = dims(a);
    const db = dims(b);

    const same = (k) => da[k] === db[k];
    const diff = (k) => da[k] !== db[k];

    const bullets = [];
    const risks = [];
    const tips = [];

    // 核心差異解釋
    if (diff("EI")) {
      bullets.push(`能量節奏不同：${a} 偏 ${da.EI === "E" ? "外向" : "內向"}，${b} 偏 ${db.EI === "E" ? "外向" : "內向"}。`);
      tips.push("約定『社交/獨處』的節奏：先說好頻率與充電方式。");
    } else {
      bullets.push("能量節奏相近：比較容易在相同頻率上相處。");
      tips.push("一起建立固定儀式（例：每週一次深聊或一起玩）。");
    }

    if (diff("SN")) {
      bullets.push(`資訊偏好不同：${da.SN === "S" ? `${a} 偏具體` : `${a} 偏抽象`}；${db.SN === "S" ? `${b} 偏具體` : `${b} 偏抽象`}。`);
      risks.push("一方覺得對方太跳躍/太死板。");
      tips.push("討論時先對齊：『我們在談事實還是談可能性？』");
    } else {
      bullets.push("理解世界方式相近：溝通摩擦相對少。");
    }

    if (diff("TF")) {
      bullets.push(`決策重點不同：${da.TF === "T" ? `${a} 偏理性` : `${a} 偏感受`}；${db.TF === "T" ? `${b} 偏理性` : `${b} 偏感受`}。`);
      risks.push("一方想解決問題、一方想被理解，容易錯頻。");
      tips.push("先共感一句，再談解法（或先談解法，再補一個關心）。");
    } else {
      bullets.push("價值判斷語言相近：比較容易『講到同一種重點』。");
    }

    if (diff("JP")) {
      bullets.push(`節奏控管不同：${da.JP === "J" ? `${a} 偏計畫` : `${a} 偏彈性`}；${db.JP === "J" ? `${b} 偏計畫` : `${b} 偏彈性`}。`);
      risks.push("一方覺得對方太隨便/太控制。");
      tips.push("用『底線 + 彈性區』：先定不可動的，再留可調整的。");
    } else {
      bullets.push("做事節奏相近：容易配合與同步。");
    }

    // 模式加權
    if (mode === "work") {
      tips.push("職場建議：用『結論→原因→下一步』，讓溝通可落地。");
      tips.push("職場建議：把責任與交付寫清楚（避免腦補）。");
    } else {
      tips.push("親密建議：衝突先安撫，再討論對錯與方案。");
      tips.push("親密建議：多做『確認』，少做『猜測測試』。");
    }

    // 帶入熊熊句
    const bearLine = randomPick([
      "🐻 熊熊提醒：配對不是分數，是『怎麼溝通會比較順』。",
      "🐻 熊熊提醒：你們不是要變一樣，是要學會對方的語言。",
      "🐻 熊熊提醒：看見差異，就是相處變好的開始。",
    ]);

    const headline = `${typeLabel(a)} × ${typeLabel(b)}（${mode === "work" ? "職場" : "親密"}）`;

    return {
      headline,
      bullets,
      risks,
      tips,
      bearLine,
      summaryText:
        `${headline}\n\n` +
        `相處特性：\n- ${bullets.join("\n- ")}\n\n` +
        (risks.length ? `可能卡點：\n- ${risks.join("\n- ")}\n\n` : "") +
        `熊熊建議：\n- ${tips.join("\n- ")}\n\n` +
        `${bearLine}`,
    };
  }

  function actionList3(a, b, mode) {
    // 3條「可做」的行動
    const da = dims(a);
    const db = dims(b);

    const actions = [];

    // 1) 對齊溝通格式
    actions.push(mode === "work"
      ? "✅ 每次討論先用一句話說結論，再補原因與下一步（避免講一圈沒共識）。"
      : "✅ 衝突時先用一句話安撫（我懂你/我在），再談怎麼做（避免越吵越遠）。"
    );

    // 2) 對齊差異最大的維度
    if (da.TF !== db.TF) {
      actions.push("✅ 約定『先共感/先解法』的順序：一方先被理解，另一方再給方案。");
    } else if (da.SN !== db.SN) {
      actions.push("✅ 討論前先說清楚：現在談『事實細節』還是『方向可能性』，避免錯頻。");
    } else if (da.JP !== db.JP) {
      actions.push("✅ 用『底線＋彈性區』：把不可動的先定好，其餘留彈性（計畫派/隨性派都舒服）。");
    } else {
      actions.push("✅ 做一個共同小儀式（每週一次）：固定時間對齊近況與下一步，關係更穩。");
    }

    // 3) 節奏/能量照顧
    if (da.EI !== db.EI) {
      actions.push("✅ 約定充電方式：外向派要互動、內向派要空間，先說好就少誤會。");
    } else {
      actions.push("✅ 用同頻活動補能量：一起散步/一起做事/一起玩，讓關係自然變好。");
    }

    return actions.slice(0, 3);
  }

  /* ----------------------------
   * Notebook storage model
   * ---------------------------- */
  function getNotebook() {
    const nb = loadLS(LS.notebook, null);
    if (nb && typeof nb === "object") {
      return {
        people: Array.isArray(nb.people) ? nb.people : [],
        pairs: Array.isArray(nb.pairs) ? nb.pairs : [],
      };
    }
    return { people: [], pairs: [] };
  }

  function saveNotebook(nb) {
    saveLS(LS.notebook, nb);
  }

  /* ----------------------------
   * Notebook render & filter
   * ---------------------------- */
  const noteState = {
    filter: "all", // all|family|friend|coworker
    q: "",
  };

  function matchesText(item, q) {
    if (!q) return true;
    const s = q.trim().toLowerCase();
    const hay = JSON.stringify(item).toLowerCase();
    return hay.includes(s);
  }

  function renderNotebookList() {
    const listEl = $("#noteList");
    if (!listEl) return;

    const nb = getNotebook();
    const q = noteState.q;
    const filter = noteState.filter;

    const people = nb.people
      .filter((x) => filter === "all" || x.category === filter)
      .filter((x) => matchesText(x, q))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    const pairs = nb.pairs
      .filter((x) => matchesText(x, q))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    if (!people.length && !pairs.length) {
      listEl.innerHTML = `<div class="hint">尚未新增任何筆記。</div>`;
      return;
    }

    const personCard = (p) => `
      <div class="card-soft" style="padding:10px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; gap:10px;">
          <div>
            <div style="font-weight:900;">👤 ${escapeHTML(p.name || "（未命名）")}</div>
            <div class="small" style="opacity:.85; margin-top:2px;">
              ${escapeHTML(labelCategory(p.category))}｜<b>${escapeHTML(p.type || "")}</b>${p.zodiac ? `｜${escapeHTML(p.zodiac)}` : ""}
            </div>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
            <button class="chip" data-act="copy" data-kind="person" data-id="${p.id}">複製</button>
            <button class="chip" data-act="delete" data-kind="person" data-id="${p.id}">刪除</button>
          </div>
        </div>

        ${p.memo ? `<div style="margin-top:8px; white-space:pre-wrap; line-height:1.6;">${escapeHTML(p.memo)}</div>` : `<div class="hint small" style="margin-top:8px;">（沒有備註）</div>`}

        ${p.advice ? `<div style="margin-top:8px; padding-top:8px; border-top:1px dashed rgba(0,0,0,.15); white-space:pre-wrap; line-height:1.6;">${escapeHTML(p.advice)}</div>` : ""}
      </div>
    `;

    const pairCard = (x) => `
      <div class="card-soft" style="padding:10px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; gap:10px;">
          <div>
            <div style="font-weight:900;">🤝 ${escapeHTML(x.title || "")}</div>
            <div class="small" style="opacity:.85; margin-top:2px;">
              ${escapeHTML(x.mode === "work" ? "職場" : "親密")}｜${escapeHTML(x.a)} × ${escapeHTML(x.b)}
            </div>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
            <button class="chip" data-act="copy" data-kind="pair" data-id="${x.id}">複製</button>
            <button class="chip" data-act="delete" data-kind="pair" data-id="${x.id}">刪除</button>
          </div>
        </div>

        <div style="margin-top:8px; white-space:pre-wrap; line-height:1.6;">${escapeHTML(x.content || "")}</div>
      </div>
    `;

    listEl.innerHTML = `
      ${people.length ? `<div class="section-title">👤 人物筆記</div>${people.map(personCard).join("")}` : ""}
      ${pairs.length ? `<div class="section-title" style="margin-top:10px;">🤝 配對紀錄</div>${pairs.map(pairCard).join("")}` : ""}
    `;

    // 綁定複製/刪除
    listEl.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const act = btn.getAttribute("data-act");
        const kind = btn.getAttribute("data-kind");
        const id = btn.getAttribute("data-id");
        if (!id) return;

        const nb2 = getNotebook();

        if (act === "delete") {
          if (kind === "person") nb2.people = nb2.people.filter((p) => p.id !== id);
          if (kind === "pair") nb2.pairs = nb2.pairs.filter((p) => p.id !== id);
          saveNotebook(nb2);
          toast("🗑️ 已刪除");
          renderNotebookList();
          return;
        }

        if (act === "copy") {
          if (kind === "person") {
            const p = nb2.people.find((x) => x.id === id);
            if (!p) return;
            const text =
              `👤 ${p.name}\n分類：${labelCategory(p.category)}\nMBTI：${p.type}\n星座：${p.zodiac || "（無）"}\n備註：\n${p.memo || "（無）"}\n` +
              (p.advice ? `\n溝通建議：\n${p.advice}\n` : "");
            copyText(text);
          }
          if (kind === "pair") {
            const x = nb2.pairs.find((y) => y.id === id);
            if (!x) return;
            copyText(x.content || "");
          }
        }
      });
    });
  }

  function labelCategory(cat) {
    if (cat === "family") return "家人";
    if (cat === "friend") return "朋友";
    if (cat === "coworker") return "同事";
    return "其他";
  }

  /* ----------------------------
   * 人物溝通建議（noteAdviceBtn）
   * ---------------------------- */
  function genAdviceForPerson(name, type, memo) {
    const o = getTypeObj(type);
    const base = o
      ? [
          `對象：${name || "（未命名）"}｜${type}（${o.name}）`,
          "",
          `先抓重點：${o.traits || ""}`,
          "",
          "🗣️ 溝通建議（你可以直接照做）：",
          `1) 先用一句話確認對方狀態：例如「我懂你現在可能有點${o.tags?.[0] || "在意"}，我在。」`,
          `2) 再用對方偏好的語言說重點：${type[2] === "T" ? "給結論/理由/選項" : "給感受/關心/安全感"}`,
          `3) 最後給一個可選擇的下一步：例如「我們要不要先…？」`,
          "",
          "⚠️ 可能地雷：",
          `- ${o.blindspots?.[0] || "不要用貼標籤方式否定"}`,
          "",
          "🐻 熊熊提醒：不要追求一次講完，追求『一次更靠近一點點』。",
        ]
      : [
          `對象：${name || "（未命名）"}｜${type || "（未填 MBTI）"}`,
          "",
          "🗣️ 溝通建議：",
          "1) 先問對方需要：要『安慰』還是『解法』？",
          "2) 把期待說清楚（時間、方式、底線）。",
          "3) 用一句話收尾確認：『所以我們就先這樣做，可以嗎？』",
        ];

    if (memo && memo.trim()) {
      base.push("");
      base.push("📌 你備註的重點（我幫你放進策略裡）：");
      base.push(memo.trim());
    }
    return base.join("\n");
  }

  /* ----------------------------
   * Main interactions
   * ---------------------------- */
  function initTypeSearch() {
    const typeInput = $("#typeInput");
    const goTypeBtn = $("#goTypeBtn");
    const typeSelect = $("#typeSelect");
    const randomBtn = $("#randomBtn");
    const openDetailBtn = $("#openDetailBtn");

    const modalType = $("#modalType");
    bindModalClose(modalType);

    // populate select
    fillSelect(typeSelect, { includeEmpty: false });

    // restore last type
    const lastType = loadLS(LS.lastType, "INFP");
    if (typeInput) typeInput.value = lastType;
    if (typeSelect) typeSelect.value = isValidType(lastType) ? lastType : MBTI_CODES[0];

    const applyType = (code) => {
      const t = normalizeType(code);
      if (!isValidType(t)) {
        toast("⚠️ 請輸入正確 MBTI（例如 INFP）");
        return null;
      }
      if (typeInput) typeInput.value = t;
      if (typeSelect) typeSelect.value = t;
      saveLS(LS.lastType, t);
      return t;
    };

    goTypeBtn?.addEventListener("click", () => {
      const t = applyType(typeInput?.value);
      if (!t) return;
      toast(`✅ 已選擇 ${t}`);
    });

    typeInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") goTypeBtn?.click();
    });

    typeSelect?.addEventListener("change", () => {
      const t = applyType(typeSelect.value);
      if (!t) return;
      toast(`✅ 已選擇 ${t}`);
    });

    randomBtn?.addEventListener("click", () => {
      const t = randomPick(MBTI_CODES);
      applyType(t);
      toast(`🎲 隨機：${t}`);
    });

    openDetailBtn?.addEventListener("click", () => {
      const t = applyType(typeInput?.value || typeSelect?.value);
      if (!t) return;
      renderTypeDetail(t);
      openModal(modalType);
    });
  }

  function initTestLink() {
    const testUrl = $("#testUrl");
    const openTestBtn = $("#openTestBtn");
    const copyTypeBtn = $("#copyTypeBtn");

    if (testUrl) {
      const saved = loadLS(LS.testUrl, "");
      if (saved) testUrl.value = saved;
      testUrl.addEventListener("change", () => {
        saveLS(LS.testUrl, testUrl.value.trim());
      });
      testUrl.addEventListener("blur", () => {
        saveLS(LS.testUrl, testUrl.value.trim());
      });
    }

    openTestBtn?.addEventListener("click", () => {
      const url = (testUrl?.value || "").trim();
      if (!url) {
        toast("⚠️ 先貼上測驗網址");
        return;
      }
      saveLS(LS.testUrl, url);
      window.open(url, "_blank", "noopener");
    });

    copyTypeBtn?.addEventListener("click", () => {
      const t = normalizeType($("#typeInput")?.value || $("#typeSelect")?.value);
      if (!isValidType(t)) {
        toast("⚠️ 請先選一個 MBTI");
        return;
      }
      copyText(t);
    });
  }

  /* ----------------------------
   * Dock buttons -> open modals
   * ---------------------------- */
  function initDock() {
    const dockPair = $("#dockPair");
    const dockNotebook = $("#dockNotebook");
    const modalPair = $("#modalPair");
    const modalNotebook = $("#modalNotebook");

    bindModalClose(modalPair);
    bindModalClose(modalNotebook);

    dockPair?.addEventListener("click", () => {
      openModal(modalPair);
    });
    dockNotebook?.addEventListener("click", () => {
      openModal(modalNotebook);
      renderNotebookList();
    });
  }

  /* ----------------------------
   * Pair modal
   * ---------------------------- */
  let pairMode = "work"; // default

  function initPair() {
    const modalPair = $("#modalPair");
    const pairA = $("#pairA");
    const pairB = $("#pairB");
    const pairBtn = $("#pairBtn");
    const pairSwapBtn = $("#pairSwapBtn");
    const pairContent = $("#modalPairContent");
    const pairActionBtn = $("#pairActionBtn");
    const pairSaveBtn = $("#pairSaveBtn");

    // seg buttons
    const segBtns = $$(".seg-btn", modalPair);

    fillSelect(pairA);
    fillSelect(pairB);

    // default values from lastType
    const lastType = loadLS(LS.lastType, "INFP");
    if (pairA) pairA.value = isValidType(lastType) ? lastType : "INFP";
    if (pairB) pairB.value = "ENFJ";

    segBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        segBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        pairMode = btn.getAttribute("data-mode") || "work";
        // 如果已經有結果，切模式就重算
        if (pairA?.value && pairB?.value && pairContent && pairContent.dataset.hasResult === "1") {
          pairBtn?.click();
        }
      });
    });

    pairSwapBtn?.addEventListener("click", () => {
      const a = pairA?.value;
      const b = pairB?.value;
      if (!a || !b) return;
      pairA.value = b;
      pairB.value = a;
      toast("🔁 已交換");
    });

    const renderPair = () => {
      const a = pairA?.value;
      const b = pairB?.value;
      if (!isValidType(a) || !isValidType(b)) {
        toast("⚠️ 請先選擇兩種人格");
        return null;
      }
      const res = pairAnalysis(a, b, pairMode);
      if (pairContent) {
        pairContent.dataset.hasResult = "1";
        pairContent.innerHTML = `
          <div class="card-soft" style="padding:10px;">
            <div style="font-weight:900; margin-bottom:6px;">${escapeHTML(res.headline)}</div>

            <div class="section-title" style="margin-top:8px;">✨ 相處特性</div>
            <ul>${res.bullets.map((x) => `<li>${escapeHTML(x)}</li>`).join("")}</ul>

            ${res.risks.length ? `
              <div class="section-title" style="margin-top:8px;">⚠️ 可能卡點</div>
              <ul>${res.risks.map((x) => `<li>${escapeHTML(x)}</li>`).join("")}</ul>
            ` : ""}

            <div class="section-title" style="margin-top:8px;">🧭 熊熊建議</div>
            <ul>${res.tips.map((x) => `<li>${escapeHTML(x)}</li>`).join("")}</ul>

            <div style="margin-top:10px; white-space:pre-wrap; line-height:1.6; font-weight:700;">
              ${escapeHTML(res.bearLine)}
            </div>

            <div class="mini-actions" style="margin-top:10px;">
              <button class="chip" id="pairCopyBtn">📌 複製這段分析</button>
            </div>
          </div>
        `;

        $("#pairCopyBtn")?.addEventListener("click", () => copyText(res.summaryText));
      }
      return res;
    };

    pairBtn?.addEventListener("click", renderPair);

    pairActionBtn?.addEventListener("click", () => {
      const a = pairA?.value;
      const b = pairB?.value;
      if (!isValidType(a) || !isValidType(b)) {
        toast("⚠️ 請先選擇兩種人格");
        return;
      }
      const actions = actionList3(a, b, pairMode);
      const text =
        `✅ 相處行動清單（${pairMode === "work" ? "職場" : "親密"}）\n` +
        `${typeLabel(a)} × ${typeLabel(b)}\n\n` +
        actions.map((x, i) => `${i + 1}. ${x.replace(/^✅\s*/, "")}`).join("\n");

      if (pairContent) {
        pairContent.innerHTML = `
          <div class="card-soft" style="padding:10px;">
            <div style="font-weight:900;">✅ 相處行動清單（3條）</div>
            <div class="small" style="opacity:.85; margin-top:2px;">${escapeHTML(typeLabel(a))} × ${escapeHTML(typeLabel(b))}｜${escapeHTML(pairMode === "work" ? "職場" : "親密")}</div>
            <ol style="margin-top:8px;">${actions.map((x) => `<li>${escapeHTML(x.replace(/^✅\s*/, ""))}</li>`).join("")}</ol>
            <div class="mini-actions" style="margin-top:10px;">
              <button class="chip" id="pairCopyActionsBtn">📌 複製行動清單</button>
            </div>
          </div>
        `;
        $("#pairCopyActionsBtn")?.addEventListener("click", () => copyText(text));
      }
      toast("✅ 已生成行動清單");
    });

    pairSaveBtn?.addEventListener("click", () => {
      const a = pairA?.value;
      const b = pairB?.value;
      if (!isValidType(a) || !isValidType(b)) {
        toast("⚠️ 請先選擇兩種人格");
        return;
      }

      // 存「目前畫面」：若未按分析，就先分析一次
      const res = renderPair() || pairAnalysis(a, b, pairMode);

      const nb = getNotebook();
      const id = cryptoId();

      nb.pairs.unshift({
        id,
        createdAt: nowISO(),
        mode: pairMode,
        a,
        b,
        title: res.headline,
        content: res.summaryText,
      });

      saveNotebook(nb);
      toast("💾 已存進筆記本");
    });
  }

  function cryptoId() {
    // 兼容沒有 crypto.randomUUID 的環境
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now();
  }

  /* ----------------------------
   * Notebook modal: bind actions
   * ---------------------------- */
  function initNotebook() {
    const modalNotebook = $("#modalNotebook");
    if (!modalNotebook) return;

    const noteName = $("#noteName");
    const noteCategory = $("#noteCategory");
    const noteType = $("#noteType");
    const noteZodiac = $("#noteZodiac");
    const noteMemo = $("#noteMemo");

    const noteAdviceBtn = $("#noteAdviceBtn");
    const noteSaveBtn = $("#noteSaveBtn");
    const noteExportBtn = $("#noteExportBtn");
    const noteImportBtn = $("#noteImportBtn");
    const noteImportFile = $("#noteImportFile");
    const noteImportText = $("#noteImportText");
    const noteImportTextBtn = $("#noteImportTextBtn");
    const noteSearch = $("#noteSearch");
    const noteClearBtn = $("#noteClearBtn");

    // selects
    fillSelect(noteType, { includeEmpty: false });

    // filters chips
    const chips = $$(".chip-filter", modalNotebook);
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        noteState.filter = chip.getAttribute("data-filter") || "all";
        renderNotebookList();
      });
    });

    noteSearch?.addEventListener("input", () => {
      noteState.q = noteSearch.value || "";
      renderNotebookList();
    });

    noteAdviceBtn?.addEventListener("click", () => {
      const name = (noteName?.value || "").trim();
      const type = normalizeType(noteType?.value || "");
      const memo = (noteMemo?.value || "").trim();

      if (!isValidType(type)) {
        toast("⚠️ 先選擇對方 MBTI");
        return;
      }

      const advice = genAdviceForPerson(name, type, memo);
      // 直接把建議塞進 memo 下方（不破壞你既有欄位）
      // 我們把它加到 memo 末尾（如果你想分欄位，我也可以改成獨立區塊）
      const combined = (memo ? memo + "\n\n" : "") + "—— 溝通建議 ——\n" + advice;
      noteMemo.value = combined;
      toast("🗣️ 已生成建議（已寫入備註）");
    });

    noteSaveBtn?.addEventListener("click", () => {
      const name = (noteName?.value || "").trim();
      const category = noteCategory?.value || "friend";
      const type = normalizeType(noteType?.value || "");
      const zodiac = (noteZodiac?.value || "").trim();
      const memo = (noteMemo?.value || "").trim();

      if (!name) {
        toast("⚠️ 請輸入暱稱/名字");
        return;
      }
      if (!isValidType(type)) {
        toast("⚠️ 請選擇 MBTI");
        return;
      }

      const nb = getNotebook();
      nb.people.unshift({
        id: cryptoId(),
        createdAt: nowISO(),
        name,
        category,
        type,
        zodiac,
        memo,
        advice: "", // 先保留欄位（若你未來想分開顯示）
      });

      saveNotebook(nb);

      // 清空表單
      noteName.value = "";
      noteZodiac.value = "";
      noteMemo.value = "";

      toast("➕ 已新增人物筆記");
      renderNotebookList();
    });

    // Export JSON
    noteExportBtn?.addEventListener("click", () => {
      const nb = getNotebook();
      const json = JSON.stringify(nb, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `mbti-bear-notebook_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast("📦 已匯出");
    });

    // Import JSON file
    noteImportBtn?.addEventListener("click", () => {
      noteImportFile?.click();
    });

    noteImportFile?.addEventListener("change", async () => {
      const file = noteImportFile.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        importNotebookFromText(text);
        noteImportFile.value = "";
      } catch {
        toast("⚠️ 匯入失敗（檔案讀取錯誤）");
      }
    });

    // Import from pasted text
    noteImportTextBtn?.addEventListener("click", () => {
      const text = (noteImportText?.value || "").trim();
      if (!text) {
        toast("⚠️ 先貼上 JSON 內容");
        return;
      }
      importNotebookFromText(text);
    });

    function importNotebookFromText(text) {
      const obj = safeParse(text, null);
      if (!obj || typeof obj !== "object") {
        toast("⚠️ JSON 格式不正確");
        return;
      }

      const incoming = {
        people: Array.isArray(obj.people) ? obj.people : [],
        pairs: Array.isArray(obj.pairs) ? obj.pairs : [],
      };

      // 合併（避免覆蓋）
      const nb = getNotebook();
      const merged = {
        people: [...incoming.people, ...nb.people],
        pairs: [...incoming.pairs, ...nb.pairs],
      };

      // 去重（以 id）
      merged.people = dedupeById(merged.people);
      merged.pairs = dedupeById(merged.pairs);

      saveNotebook(merged);
      toast("✅ 匯入完成");
      renderNotebookList();
    }

    function dedupeById(arr) {
      const seen = new Set();
      const out = [];
      for (const it of arr) {
        const id = it && it.id ? String(it.id) : null;
        if (!id) {
          // 沒 id 的給新 id
          const copy = { ...it, id: cryptoId(), createdAt: it.createdAt || nowISO() };
          out.push(copy);
          continue;
        }
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(it);
      }
      return out;
    }

    // Clear all
    noteClearBtn?.addEventListener("click", () => {
      const ok = confirm("確定要清空全部筆記嗎？（此動作無法復原）");
      if (!ok) return;
      saveNotebook({ people: [], pairs: [] });
      toast("🧹 已清空");
      renderNotebookList();
    });

    // 每次打開 modal 就刷新列表
    modalNotebook.addEventListener("transitionend", () => {
      if (modalNotebook.classList.contains("open")) renderNotebookList();
    });
  }

  /* ----------------------------
   * Init: fetch mbti.json and bind everything
   * ---------------------------- */
  async function loadMBTI() {
    try {
      const res = await fetch("./data/mbti.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      MBTI = json || {};
    } catch (e) {
      console.error(e);
      toast("⚠️ 讀取 data/mbti.json 失敗（路徑或 JSON 格式）");
      MBTI = {};
    }
  }

  function guardData() {
    // 確保至少有 16 型中的一部分可用
    const hasAny = MBTI_CODES.some((c) => !!MBTI[c]);
    if (!hasAny) {
      // 如果你 json 目前只有部分型別，至少不讓功能爆炸
      // 但會提醒
      console.warn("mbti.json does not contain standard 16 types (or fetch failed).");
    }
  }

  function initGlobals() {
    // 讓輸入自動大寫
    const typeInput = $("#typeInput");
    typeInput?.addEventListener("input", () => {
      const v = normalizeType(typeInput.value);
      typeInput.value = v;
    });

    // 點 dockPair 時，active 樣式維持（你 CSS 若有）
    $("#dockPair")?.addEventListener("click", () => {
      $$(".dock-btn").forEach((b) => b.classList.remove("active"));
      $("#dockPair")?.classList.add("active");
    });
    $("#dockNotebook")?.addEventListener("click", () => {
      $$(".dock-btn").forEach((b) => b.classList.remove("active"));
      $("#dockNotebook")?.classList.add("active");
    });
  }

  async function init() {
    ensureToast();
    initBearChat();

    // load data first
    await loadMBTI();
    guardData();

    initGlobals();
    initDock();
    initTypeSearch();
    initTestLink();
    initPair();
    initNotebook();

    // 初始泡泡
    setBubble("點一下熊熊，我會跟你聊天 🫶");
  }

  // start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();