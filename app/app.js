/* ═══════════ 主应用：界面状态与交互 ═══════════ */
(function () {
  "use strict";
  const D = window.POE2_DATA;
  const E = window.POE2_ENGINE;
  const I18N = window.POE2_I18N;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtC = (x) => (x >= 100 ? Math.round(x).toString() : (Math.round(x * 100) / 100).toString());

  /* ───────── 中文名/描述映射 ───────── */
  const CUR_META = {
    transmutation: { zh: "蜕变石", desc: "普通 → 魔法，获得 1 条词缀", color1: "#a8dcff", color2: "#3a7ac0", glyph: "◆", priceKey: (t) => "transmute" + tSuf(t) },
    augmentation: { zh: "增幅石", desc: "为魔法物品增加 1 条词缀", color1: "#bccaff", color2: "#5262c8", glyph: "✦", priceKey: (t) => "augment" + tSuf(t) },
    regal: { zh: "富豪石", desc: "魔法 → 稀有，并增加 1 条词缀", color1: "#a2f5e4", color2: "#2a9e88", glyph: "❖", priceKey: (t) => "regal" + tSuf(t) },
    exalted: { zh: "崇高石", desc: "为稀有物品增加 1 条词缀", color1: "#fff3c8", color2: "#c89232", glyph: "★", priceKey: (t) => "exalt" + tSuf(t) },
    annulment: { zh: "剥离石", desc: "随机移除 1 条词缀", color1: "#c8ffbe", color2: "#56a448", glyph: "⨯", priceKey: () => "annul" },
    alchemy: { zh: "点金石", desc: "普通 → 稀有，获得 4 条词缀", color1: "#ffd8ab", color2: "#c07c38", glyph: "◉", priceKey: () => "alchemy" },
    chaos: { zh: "混沌石", desc: "随机移除 1 条，再新增 1 条词缀", color1: "#e6d0f8", color2: "#8460b4", glyph: "∞", priceKey: (t) => "chaos" + tSuf(t) },
    essence: { zh: "精华", desc: "指定词缀：普通→魔法 / 魔法→稀有 / 完美替换", color1: "#a8f0e0", color2: "#3aa88e", glyph: "◈", priceKey: () => "essence" },
    desecrated: { zh: "渎灵骨", desc: "稀有物品 +1 隐藏渎灵词缀，再使用时三选一揭示", color1: "#f8bca9", color2: "#c05234", glyph: "☠", priceKey: () => "desecrate" },
    divine: { zh: "神圣石", desc: "重掷全部词缀的数值（词缀与档位不变）", color1: "#fff8d8", color2: "#c8b060", glyph: "✷", priceKey: () => "divine" },
    fracturing: { zh: "破溃宝珠", desc: "分裂并锁定一个随机词缀（≥4 词缀稀有）", color1: "#d8f0ff", color2: "#4a86a8", glyph: "⊘", priceKey: () => "fracturing" },
    hinekora: { zh: "辛格拉的发辫", desc: "预示下一个通货的效果，可自由应用或放弃", color1: "#e8d8b8", color2: "#8a6e40", glyph: "👁", priceKey: () => "hinekora" },
  };
  function tSuf(t) { return t && t !== "base" ? "_" + t : ""; }

  const OMEN_ZH = {
    OmenofSinistralExaltation: ["升华·左", "崇高石只会添加前缀"],
    OmenofDextralExaltation: ["升华·右", "崇高石只会添加后缀"],
    OmenofGreaterExaltation: ["升华·强效", "崇高石额外再 +1 词缀（实验性）"],
    OmenofSinistralAnnulment: ["剥离·左", "剥离石只会移除前缀"],
    OmenofDextralAnnulment: ["剥离·右", "剥离石只会移除后缀"],
    OmenofGreaterAnnulment: ["剥离·强效", "剥离石会移除 2 条词缀"],
    OmenofLight: ["光之预兆", "剥离石必定移除一条渎灵词缀"],
    OmenofWhittling: ["消减预兆", "混沌石移除等级需求最低的词缀"],
    OmenofSinistralErasure: ["消抹·左", "混沌石只会移除前缀"],
    OmenofDextralErasure: ["消抹·右", "混沌石只会移除后缀"],
    OmenofSinistralCoronation: ["加冕·左", "富豪石只会添加前缀"],
    OmenofDextralCoronation: ["加冕·右", "富豪石只会添加后缀"],
    OmenofSinistralAlchemy: ["炼金·左", "点金石前缀拉满（3 前 1 后）"],
    OmenofDextralAlchemy: ["炼金·右", "点金石后缀拉满（1 前 3 后）"],
    OmenofSinistralCrystallisation: ["晶化·左", "完美精华只会替换前缀"],
    OmenofDextralCrystallisation: ["晶化·右", "完美精华只会替换后缀"],
    OmenofSinistralNecromancy: ["左旋死灵预兆", "下一次渎灵只会添加前缀词缀（官方名）"],
    OmenofDextralNecromancy: ["右旋死灵预兆", "下一次渎灵只会添加后缀词缀（官方名）"],
    OmenofAbyssalEchoes: ["深渊回响", "渎灵揭示时显示 6 个候选（二次掷选）"],
    OmenofPutrefaction: ["腐化揭示", "渎灵揭示：清空全部词缀并附加 6 条渎灵词缀"],
    OmenofSanctification: ["圣化预兆", "神圣石将物品圣化：数值 ×80-120%"],
    OmenoftheBlessed: ["祝圣预兆", "神圣石只重掷隐匿（模拟器中基底隐匿固定，等同普通神圣）"],
    OmenofHomogenisingCoronation: ["同质化加冕", "富豪石追加与现有词缀同侧（有前缀则加前缀）"],
    OmenoftheBlackblooded: ["黑血预兆", "下一次渎灵保证获得一条古加尔词缀（武器或珠宝）"],
    OmenoftheLiege: ["领主预兆", "下一次渎灵保证获得一条阿曼娜姆词缀（武器或珠宝）"],
    OmenoftheSovereign: ["至高预兆", "下一次渎灵保证获得一条乌拉曼词缀（武器或珠宝）"],
    OmenofCatalysingExaltation: ["催化升华", "崇高石消耗全部催化剂品质，提高对应类别词缀概率（权重 ×(1+品质/100)，近似模型）"],
  };
  const ESSENCE_ZH = {
    Abrasion: "磨损", Alacrity: "敏捷", Battle: "战斗", Command: "统御", Electricity: "电流",
    Enhancement: "强化", Flames: "烈焰", Grounding: "接地", Haste: "急速", Horror: "恐怖",
    Hysteria: "癔症", Ice: "寒冰", Insulation: "绝缘", Opulence: "丰裕", Ruin: "毁灭",
    Seeking: "精准", Sorcery: "巫术", Thawing: "消融", "the Body": "体魄", "the Infinite": "无穷", "the Mind": "心智",
  };
  const ESSENCE_TIER_ZH = { LESSER: "低级", NORMAL: "中级", GREATER: "高级", PERFECT: "完美" };
  const ESSENCE_TIER_COLOR = { LESSER: "#8fd8c8", NORMAL: "#5ec8a8", GREATER: "#e8b45a", PERFECT: "#e88a5a" };

  /* ───────── 应用状态 ───────── */
  const S = {
    classId: null, baseId: null, ilvl: 75,
    item: null, undoStack: [], log: [], usage: {}, steps: 0,
    tier: "base",
    boneTier: "preserved", // 渎灵骨档位：gnawed 啃噬 / preserved 遗存 / ancient 远古
    omens: {},        // currencyId -> omenId[]（多种通货可叠加挂多个预兆，同组互斥）
    focusCur: null,   // 概率面板聚焦的通货
    selCur: null,     // 已选中的通货（点击「使用通货」按钮才生效）
    curTab: "currency", // 左侧通货分类标签（currency/essence/alloy/anoint/rune/omen/abyss/breach）
    category: null,   // 当前大类（weapons/armour/jewels/amulets/rings）
    attrFilter: null, // 防具基底属性筛选（poolClass 后缀）
  mode: "targets",      // wishlist: modId list
    targets: [],
    targetDirty: false,
  };
  const SAVE_KEY = "poe2-craft-sim-v1";

  /* ───────── 工具 ───────── */
  function baseDps(b, cls) {
    if (!(cls.attack || ["Foci", "Quivers", "Talismans"].includes(cls.id))) return null;
    let pdps = 0, edps = 0;
    if (b.phys) pdps = ((b.phys[0] + b.phys[1]) / 2) * (b.aps || 1);
    if (b.ele) for (const v of Object.values(b.ele)) edps += ((v[0] + v[1]) / 2) * (b.aps || 1);
    return { pdps: Math.round(pdps), edps: Math.round(edps), dps: Math.round(pdps + edps) };
  }
  function toast(msg, cls) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast " + (cls || "");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.add("hidden"), 2600);
  }
  /* 游戏原图（assets.js 清单），缺失时回退到 SVG 球体 */
  function asset(kind, key) {
    return (window.POE2_ASSETS && window.POE2_ASSETS[kind] && window.POE2_ASSETS[kind][key]) || null;
  }
  function curIcon(cur, size) {
    const p = asset("currency", cur);
    if (p) return `<img class="game-icon cur-icon" src="${p}" alt="" draggable="false" style="width:${size}px;height:${size}px">`;
    return orbSvg(cur, size);
  }
  function omenIcon(oid, size) {
    const p = asset("omens", oid);
    if (!p) return "";
    return `<img class="game-icon omen-icon" src="${p}" alt="" draggable="false" style="width:${size}px;height:${size}px">`;
  }
  function essenceIcon(name, size) {
    const p = asset("essences", name.replace(" ", "_"));
    if (p) return `<img class="game-icon" src="${p}" alt="" draggable="false" style="width:${size}px;height:${size}px">`;
    return `<svg class="e-icon" width="${size}" height="${size}" viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="none" stroke="#7adfca" stroke-width="2"/><path d="M20 8l6 12-6 12-6-12z" fill="rgba(122,223,202,.25)"/></svg>`;
  }
  function weaponArt(classId, baseId, size) {
    const p = asset("weapons", classId + "/" + baseId);
    if (!p) return "";
    /* 原画宽高比差异极大（腰带 0.51 ~ 长杖 3.89），只限宽会让高图撑爆卡片，按盒内适配 */
    return `<img class="game-icon weapon-art" src="${p}" alt="" draggable="false" style="max-width:${size}px;max-height:${Math.round(size * 1.3)}px;width:auto;height:auto">`;
  }

  function orbSvg(cur, size) {
    const m = CUR_META[cur];
    const id = "g" + cur + Math.random().toString(36).slice(2, 7);
    return `<svg class="orb" width="${size}" height="${size}" viewBox="0 0 40 40">
      <defs><radialGradient id="${id}" cx=".35" cy=".3" r="1">
        <stop offset="0" stop-color="${m.color1}"/><stop offset=".55" stop-color="${m.color2}"/><stop offset="1" stop-color="#241c12"/>
      </radialGradient></defs>
      <circle cx="20" cy="20" r="15" fill="url(#${id})" stroke="rgba(240,200,120,.75)" stroke-width="1.6"/>
      <ellipse cx="15" cy="13.5" rx="4.6" ry="2.6" fill="#fff" opacity=".45" transform="rotate(-25 15 13.5)"/>
      <text x="20" y="24.6" text-anchor="middle" font-size="12.5" fill="rgba(10,8,6,.8)" font-weight="700">${m.glyph}</text>
    </svg>`;
  }

  /* ───────── 屏幕切换 ───────── */
  function nav(screenId) {
    $$(".screen").forEach((s) => s.classList.remove("active"));
    $("#" + screenId).classList.add("active");
    window.scrollTo({ top: 0 });
  }
  $$("[data-nav]").forEach((b) => b.addEventListener("click", () => nav(b.dataset.nav)));

  /* ───────── 第零步：物品大类 ───────── */
  const WEAPON_CLASSES = ["Bows", "Spears", "Crossbows", "Quarterstaves", "OneHand_Maces", "TwoHand_Maces", "Staves", "Wands", "Sceptres", "Foci", "Quivers", "Talismans", "Shields", "Bucklers"];
  const CATEGORIES = [
    { id: "weapons", zh: "武器", en: "WEAPONS", icon: "weapon", desc: "弓 / 战矛 / 战弩 / 锤 / 杖 / 法器 / 箭袋 / 魔符 / 盾牌等 14 类", classes: WEAPON_CLASSES },
    { id: "armour", zh: "护甲", en: "ARMOUR", icon: "chest", desc: "头盔 / 胸甲 / 鞋子 / 手套 / 腰带 · 按属性分池", classes: ["Helmets", "Body_Armours", "Boots", "Gloves", "Belts"] },
    { id: "jewels", zh: "珠宝", en: "JEWELS", icon: "jewel", desc: "红玉 / 翡翠 / 蓝玉 / 宝钻 · 独立词缀池", classes: ["JewelsRuby", "JewelsEmerald", "JewelsSapphire", "JewelsDiamond"] },
    { id: "amulets", zh: "项链", en: "AMULETS", icon: "amulet", desc: "项链 · 支持精华与亵渎", classes: ["Amulets"] },
    { id: "rings", zh: "戒指", en: "RINGS", icon: "ring", desc: "手指饰品 · 支持精华与亵渎", classes: ["Rings"] },
  ];
  const ATTR_ZH = { str: "纯力量", dex: "纯敏捷", int: "纯智慧", str_dex: "力敏", str_int: "力智", dex_int: "敏智" };

  function categoryOf(classId) {
    for (const c of CATEGORIES) if (c.classes.includes(classId)) return c;
    return null;
  }

  function renderCategories() {
    const grid = $("#category-grid");
    grid.innerHTML = CATEGORIES.map((c) => {
      const nBases = c.classes.reduce((n, id) => {
        const cls = E.classById.get(id);
        return n + (cls ? cls.bases.length : 0);
      }, 0);
      return `
      <button class="class-card" data-cat="${c.id}">
        <svg class="cc-icon" viewBox="0 0 48 48"><use href="#ic-${c.icon}"/></svg>
        <h3>${esc(c.zh)}</h3>
        <div class="en">${esc(c.en)}</div>
        <div class="desc">${esc(c.desc)}</div>
        <span class="count">${nBases} 个基底</span>
      </button>`;
    }).join("");
    $$(".class-card", grid).forEach((b) => b.addEventListener("click", () => {
      const cat = CATEGORIES.find((c) => c.id === b.dataset.cat);
      S.category = cat.id;
      S.attrFilter = null;
      if (cat.classes.length === 1) {
        S.classId = cat.classes[0];
        renderBases();
        nav("screen-base");
      } else {
        renderClasses();
        nav("screen-class");
      }
    }));
  }

  /* ───────── 第一步：类型（武器 / 防具部位 / 珠宝类型） ───────── */
  function renderClasses() {
    const cat = CATEGORIES.find((c) => c.id === S.category) || CATEGORIES[0];
    const classes = cat.classes.map((id) => E.classById.get(id)).filter(Boolean);
    const titles = { weapons: "选择武器类型", armour: "选择防具部位", jewels: "选择珠宝类型" };
    $("#class-title").textContent = titles[cat.id] || "选择类型";
    const grid = $("#class-grid");
    grid.innerHTML = classes.map((c) => `
      <button class="class-card" data-class="${c.id}">
        <svg class="cc-icon" viewBox="0 0 48 48"><use href="#ic-${c.icon}"/></svg>
        <h3>${esc(c.zh)}</h3>
        <div class="en">${esc(c.en.toUpperCase())}</div>
        <div class="desc">${esc(c.desc)}</div>
        <span class="count">${c.bases.length} 个基底</span>
      </button>`).join("");
    $$(".class-card", grid).forEach((b) => b.addEventListener("click", () => {
      S.classId = b.dataset.class;
      S.focusCur = null;
      renderBases();
      nav("screen-base");
    }));
  }

  /* ───────── 第二步：基底 ───────── */
  function defZh(k) { return { ar: "护甲", ev: "闪避", es: "能量护盾", ward: "庇护", blk: "格挡" }[k] || k; }
  function defHtml(b) {
    if (!b.def) return "";
    return Object.entries(b.def).map(([k, v]) => `<span>${defZh(k)} <b>${v}</b></span>`).join("");
  }
  function attrOf(base) {
    if (!base.poolClass) return null;
    // Helmets_str_dex -> str_dex（去掉部位前缀，保留属性后缀）
    const m = base.poolClass.match(/_(str_dex|str_int|dex_int|str|dex|int)$/);
    return m ? m[1] : null;
  }
  function renderAttrFilter(allBases) {
    const box = $("#attr-filter");
    const attrs = [...new Set(allBases.map((b) => attrOf(b)).filter(Boolean))];
    if (!attrs.length) { box.innerHTML = ""; box.style.display = "none"; return; }
    box.style.display = "";
    const order = ["str", "dex", "int", "str_dex", "str_int", "dex_int"];
    attrs.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    box.innerHTML = [null, ...attrs].map((a) => {
      const on = (S.attrFilter || null) === a ? "on" : "";
      const label = a === null ? "全部基底" : (ATTR_ZH[a] || a);
      return `<button class="attr-chip ${on}" data-attr="${a || ""}">${esc(label)}</button>`;
    }).join("");
    $$(".attr-chip", box).forEach((b) => b.addEventListener("click", () => {
      S.attrFilter = b.dataset.attr || null;
      renderBases();
    }));
  }

  function baseDefTotal(b) {
    if (!b.def) return 0;
    return Object.entries(b.def).reduce((s, [k, v]) => (k === "blk" ? s : s + v), 0);
  }
  function renderBases() {
    const cls = E.classById.get(S.classId);
    $("#base-title").textContent = `选择${cls.zh}基底`;
    const grid = $("#base-grid");
    const q = ($("#base-search").value || "").trim().toLowerCase();
    const sort = $("#base-sort").value;
    let list = cls.bases.slice();
    if (q) list = list.filter((b) => b.zh.toLowerCase().includes(q) || b.en.toLowerCase().includes(q) || (b.implicit || "").toLowerCase().includes(q));
    // 防具按基底属性筛选（纯力/纯敏/纯智/力敏/力智/敏智）
    const poolAttrs = new Set(cls.bases.map((b) => attrOf(b)).filter(Boolean));
    if (S.attrFilter && !poolAttrs.has(S.attrFilter)) S.attrFilter = null;
    if (S.attrFilter) list = list.filter((b) => attrOf(b) === S.attrFilter);
    renderAttrFilter(cls.bases);
    list.sort((a, b) => {
      if (sort === "dps") return (baseDps(b, cls)?.dps || 0) - (baseDps(a, cls)?.dps || 0);
      if (sort === "aps") return (b.aps || 0) - (a.aps || 0);
      if (sort === "crit") return (b.crit || 0) - (a.crit || 0);
      if (sort === "def") return baseDefTotal(b) - baseDefTotal(a);
      return a.level - b.level;
    });
    grid.innerHTML = list.map((b) => {
      const dps = baseDps(b, cls);
      const isRune = b.zh.startsWith("符文");
      const tagGenesis = b.genesis ? '<span class="rune gen-tag">创世树</span>' : "";
      const tagTL = b.timeLost ? '<span class="rune tl-tag">失落</span>' : "";
      return `
      <button class="base-card" data-base="${b.id}">
        ${weaponArt(S.classId, b.id, 74)}
        ${isRune ? '<span class="rune">RUNE</span>' : ""}${tagGenesis}${tagTL}
        <div class="b-row1">
          <span><span class="b-zh ${isRune ? "tag-rune" : ""}">${esc(b.zh)}</span><div class="b-en">${esc(b.en)}</div></span>
          <span class="b-lv">等级 ${b.level}</span>
        </div>
        <div class="b-stats">
          ${b.phys ? `<span>物理 <b>${b.phys[0]}–${b.phys[1]}</b></span>` : ""}
          ${b.aps ? `<span>攻速 <b>${b.aps}</b></span>` : ""}
          ${b.crit ? `<span>暴击 <b>${b.crit}%</b></span>` : ""}
          ${b.reload ? `<span>装填 <b>${b.reload}s</b></span>` : ""}
          ${defHtml(b)}
          ${dps ? `<span class="b-dps">DPS ${dps.dps}</span>` : ""}
        </div>
        ${b.ele ? `<div class="b-implicit">${Object.entries(b.ele).map(([k, v]) => eleZh(k) + " " + v[0] + "–" + v[1]).join(" · ")}</div>` : ""}
        ${b.implicit ? `<div class="b-implicit">${esc(b.implicit)}</div>` : ""}
      </button>`;
    }).join("") || `<div class="log-empty">没有匹配的基底</div>`;
    $$(".base-card", grid).forEach((el) => el.addEventListener("click", () => {
      S.baseId = el.dataset.base;
      S.item = E.newItem(S.classId, S.baseId, S.ilvl, E.defaultRng);
      S.undoStack = []; S.log = []; S.steps = 0;
      S.omens = {}; S.focusCur = null; S.selCur = null;
      const cls2 = E.classById.get(S.classId);
      const b = E.baseIndex.get(S.classId + "/" + S.baseId);
      $("#ilvl-input").value = Math.max(S.ilvl, b.level);
      S.ilvl = +$("#ilvl-input").value;
      S.item.ilvl = S.ilvl;
      $("#craft-title").textContent = `${cls2.zh} · ${b.zh}`;
      renderCraft();
      nav("screen-craft");
      save();
    }));
  }
  $("#base-search").addEventListener("input", renderBases);
  $("#base-sort").addEventListener("change", renderBases);
  function eleZh(k) { return { fire: "火焰", cold: "冰霜", lightning: "闪电", chaos: "混沌" }[k] || k; }

  /* ───────── 第三步：做装台 ───────── */
  // 通货 id（currencies.json）→ 引擎动作名（engine.js ACT）
  const ACTION = {
    transmutation: "transmute", augmentation: "augment", regal: "regal", alchemy: "alchemy",
    exalted: "exalt", chaos: "chaos", annulment: "annul", essence: "essence", desecrated: "desecrated",
    divine: "divine", fracturing: "fracture", hinekora: "hinekora",
  };
  const TIERABLE = new Set(["transmutation", "augmentation", "regal", "exalted", "chaos"]);

  function currencyApplicable(cur, item) {
    const r = rFor(cur);
    const probe = E.act(item, ACTION[cur], r.opts, E.makeRng(1));
    return probe.ok ? null : probe.reason;
  }
  /* 预兆互斥分组：同组只能选一个，跨组可叠加（如 右旋死灵 + 至高预兆 + 深渊回响 同时生效） */
  const OMEN_MUTEX = {
    constrain: ["OmenofSinistralNecromancy", "OmenofDextralNecromancy", "OmenofSinistralExaltation", "OmenofDextralExaltation", "OmenofSinistralErasure", "OmenofDextralErasure", "OmenofSinistralCoronation", "OmenofDextralCoronation", "OmenofSinistralAlchemy", "OmenofDextralAlchemy", "OmenofSinistralCrystallisation", "OmenofDextralCrystallisation"],
    boss: ["OmenoftheBlackblooded", "OmenoftheLiege", "OmenoftheSovereign"],
    reveal: ["OmenofAbyssalEchoes", "OmenofPutrefaction"],
  };
  function omenMutexGroup(oid) {
    for (const [g, ids] of Object.entries(OMEN_MUTEX)) if (ids.includes(oid)) return g;
    return null;
  }
  function toggleOmen(cur, oid) {
    const list = S.omens[cur] || [];
    const i = list.indexOf(oid);
    if (i >= 0) { list.splice(i, 1); S.omens[cur] = list; return; }
    const g = omenMutexGroup(oid);
    const next = g ? list.filter((x) => omenMutexGroup(x) !== g) : list.slice();
    next.push(oid);
    S.omens[cur] = next;
  }
  function omenListOf(cur) {
    const v = S.omens[cur];
    return Array.isArray(v) ? v : v ? [v] : [];
  }

  function rFor(cur) {
    // 返回当前 UI 上下文（档位/预兆/骨头档位）下的 act 参数与成本
    const omens = omenListOf(cur);
    const opts = { tier: TIERABLE.has(cur) ? S.tier : "base", omen: omens[0] || null, omens };
    if (cur === "desecrated") opts.boneTier = S.boneTier || "preserved";
    let cost = 0;
    const m = CUR_META[cur];
    if (cur === "essence") cost = (D.prices.essence || 0);
    else if (cur === "desecrated") cost = (D.prices.desecrate || 0) * (E.BONE_TIER[opts.boneTier].priceMult);
    else cost = D.prices[m.priceKey(TIERABLE.has(cur) ? S.tier : "base")] || 0;
    for (const oid of omens) cost += D.omenPrices[oid] || 0;
    return { opts, cost, omens };
  }

  /* 通货按 8 分类标签分组（通货 / 精华 / 深渊），其余分类（合金/涂油/符文/预兆/裂隙）单独渲染 */
  const CUR_TABS = {
    currency: ["transmutation", "augmentation", "regal", "alchemy", "exalted", "divine", "chaos", "fracturing", "hinekora", "annulment"],
    essence: ["essence"],
    abyss: ["desecrated"],
  };
  const CUR_TAB_BOX = { currency: "#currency-list", essence: "#essence-list", abyss: "#abyss-list" };

  function currencyButtonHtml(cur) {
    const m = CUR_META[cur];
    const { opts, cost, omens } = rFor(cur);
    const probe = E.act(S.item, ACTION[cur], opts, E.makeRng(1));
    // 精华入口始终可点（弹窗内按等级细分可用性；稀有物品可用完美精华）
    const essenceOk = ["normal", "magic", "rare"].includes(S.item.rarity) && availEssences().length > 0;
    // 渎灵两步流程：已加骨时保持可用（下一步是弹揭示窗）
    const boneReveal = cur === "desecrated" && S.item.bonePhantom;
    const ok2 = cur === "essence" ? essenceOk : boneReveal ? true : probe.ok;
    const reason = ok2 ? "" : (cur === "essence" ? "该部位没有可用精华" : probe.reason);
    const sel = S.selCur === cur ? "sel" : "";
    const tierBadge = TIERABLE.has(cur) && S.tier !== "base"
      ? `<span class="exp">${{ greater: "高级", perfect: "完美" }[S.tier]}</span>` : "";
    const curName = cur === "desecrated" ? E.boneNameFor(S.item.classId, S.boneTier || "preserved") : m.zh;
    const omenBadge = omens.map((oid) => `<span class="exp" style="color:#d4c4f4;border-color:rgba(157,127,212,.5)">${OMEN_ZH[oid][0]}</span>`).join("");
    const usedBadge = usageCountOf(cur) ? `<span class="used-n">×${usageCountOf(cur)}</span>` : "";
    const descTxt = reason || (cur === "desecrated" ? `渎灵稀有物品 +1 隐藏词缀（${{ gnawed: "仅 ilvl≤64 低档池", preserved: "无限制", ancient: "词缀等级 ≥40" }[S.boneTier || "preserved"]}）` : m.desc);
    return `
    <button class="cur-btn ${sel}" data-cur="${cur}" ${ok2 ? "" : "disabled"} title="${esc(reason || (S.selCur === cur ? "已选中 —— 点「使用通货」生效（再点一下取消选中）" : "点选后按「使用通货」生效"))}">
      ${curIcon(cur, 40)}
      <span class="cur-info">
        <span class="cur-name">${curName}${tierBadge}${omenBadge}</span>
        <span class="cur-desc">${esc(descTxt)}</span>
      </span>
      ${usedBadge}
    </button>`;
  }

  function renderCurrency() {
    for (const [tab, ids] of Object.entries(CUR_TABS)) {
      const wrap = $(CUR_TAB_BOX[tab]);
      wrap.innerHTML = ids.map(currencyButtonHtml).join("");
      $$(".cur-btn", wrap).forEach((btn) => {
        const cur = btn.dataset.cur;
        btn.addEventListener("click", () => {
          // 两步式：点击只选中/高亮（再点取消），真正使用走「使用通货」按钮
          S.selCur = S.selCur === cur ? null : cur;
          if (S.selCur) S.focusCur = cur;
          renderCurrency();
          renderProb();
        });
        btn.addEventListener("mouseenter", () => { S.focusCur = cur; renderProb(); });
      });
    }
    renderOmenTab();
    updateApplyButton();
  }

  function updateApplyButton() {
    const btn = $("#btn-apply");
    if (!S.selCur) {
      btn.disabled = true;
      btn.innerHTML = "✓ 使用通货";
      btn.title = "先在左侧点选通货，再点这里使用";
      return;
    }
    const m = CUR_META[S.selCur];
    const { opts } = rFor(S.selCur);
    const probe = S.selCur === "essence"
      ? { ok: availEssences().length > 0 }
      : E.act(S.item, ACTION[S.selCur], opts, E.makeRng(1));
    // 渎灵两步流程：已加骨时保持可用（下一步弹揭示窗）
    const boneReveal = S.selCur === "desecrated" && S.item.bonePhantom;
    btn.disabled = !(boneReveal || probe.ok);
    btn.innerHTML = `✓ 使用 · ${S.selCur === "desecrated" ? E.boneNameFor(S.item.classId, S.boneTier || "preserved") : m.zh}`;
    btn.title = boneReveal ? "进行渎灵揭示（三选一）" : probe.ok ? `对当前物品使用${m.zh}` : probe.reason || "当前无法使用";
  }

  function availEssences() {
    const set = new Set();
    const pk = E.poolKeyOf ? E.poolKeyOf(S.item) : S.classId;
    for (const [k] of E.essenceIndex) {
      if (k.startsWith(pk + "|")) set.add(k.split("|")[1]);
    }
    return [...set];
  }
  function defaultCurrency() {
    const r = S.item.rarity;
    if (r === "normal") return "transmutation";
    if (r === "magic") return "regal";
    return "exalted";
  }

  function renderBoneBox() {
    const box = $("#bone-box");
    if (!S.item) { box.style.display = "none"; return; }
    box.style.display = "";
    $("#bone-list").innerHTML = ["gnawed", "preserved", "ancient"].map((t) => {
      const meta = E.BONE_TIER[t];
      const on = (S.boneTier || "preserved") === t ? "on" : "";
      const tip = { gnawed: "便宜；只能渎灵物品等级 ≤64 的低档词缀池", preserved: "标准版，无限制", ancient: "昂贵；只出词缀等级 ≥40 的高档渎灵词缀" }[t];
      return `<button class="omen-chip ${on}" data-bone="${t}" title="${tip}（价格 ≈${(D.prices.desecrate * meta.priceMult).toFixed(2)} 崇）">${E.boneNameFor(S.item.classId, t)}</button>`;
    }).join("");
    $$("#bone-list .omen-chip").forEach((b2) => b2.addEventListener("click", () => {
      S.boneTier = b2.dataset.bone;
      renderCurrency(); renderProb();
    }));
  }

  /* 预兆标签页：按所用通货分组展示全部预兆（点选挂到对应通货上，同组互斥、跨组叠加） */
  function renderOmenTab() {
    const wrap = $("#omen-group-list");
    if (!wrap) return;
    const groups = D.currencies.filter((c) => (c.omens || []).length);
    wrap.innerHTML = groups.map((c) => {
      const m = CUR_META[c.id];
      const selected = omenListOf(c.id);
      return `<div class="omen-group" data-cgroup="${c.id}">
        <div class="omen-ghead">${curIcon(c.id, 24)}<span>${m ? m.zh : c.id}<em>（${selected.length ? "已挂 " + selected.length + " 个" : "未挂预兆"}）</em></span></div>
        <div class="omen-list omen-glist">${c.omens.map((oid) => {
          const on = selected.includes(oid) ? "on" : "";
          return `<button class="omen-chip ${on}" data-oid="${oid}" data-cur="${c.id}" title="${esc(OMEN_ZH[oid][1])} (+${D.omenPrices[oid]} 崇)">${omenIcon(oid, 20)}<span>${OMEN_ZH[oid][0]}</span></button>`;
        }).join("")}</div>
      </div>`;
    }).join("");
    $$(".omen-chip", wrap).forEach((b) => b.addEventListener("click", () => {
      toggleOmen(b.dataset.cur, b.dataset.oid); // 多选：同组互斥替换，跨组叠加
      renderCurrency(); renderProb(); renderOmenTab();
    }));
  }

  function useCurrency(cur) {
    if (cur === "essence") { openEssenceModal(); return; }
    if (cur === "desecrated") {
      // 两步流程：未加骨 -> 先加骨（等待揭示）；已加骨 -> 弹揭示窗
      if (!S.item.bonePhantom) {
        const { opts } = rFor(cur);
        const r = E.act(S.item, "desecrated", opts, E.defaultRng);
        if (!r.ok) { toast(r.reason); return; }
        S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps });
        S.item = r.item;
        S.steps++;
        const boneName = E.boneNameFor(S.item.classId, opts.boneTier);
        countUsage("desecrated", boneName);
        for (const oid of omenListOf("desecrated")) countUsage("omen", OMEN_ZH[oid][0], { oid });
        const omenTxt = omenListOf("desecrated").map((oid) => OMEN_ZH[oid][0]).join(" + ");
        S.log.push({
          html: `<span class="l-cost">≈${fmtC(r.cost)} 崇</span><span class="l-t">${boneName}${omenTxt ? " · " + omenTxt : ""}</span><br><span class="l-affix">☠ 已加骨：再次使用进行渎灵揭示（三选一）</span>`,
        });
        renderCraft(true);
        save();
        return;
      }
      openDesecrateModal();
      return;
    }
    const { opts } = rFor(cur);
    // 辛格拉的发辫：进入预示状态
    if (cur === "hinekora") {
      if (S.item.foresee) { toast("物品已处于预示状态", "info"); return; }
      const r = E.act(S.item, "hinekora", opts);
      if (!r.ok) { toast(r.reason); return; }
      S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps });
      S.item = r.item;
      S.steps++;
      countUsage("hinekora", "辛格拉的发辫");
      addLog(cur, r);
      renderCraft(true); save();
      return;
    }
    // 预示状态：先预览，再由用户决定
    if (S.item.foresee) {
      const r = E.act(S.item, ACTION[cur], opts);
      if (!r.ok) { toast(r.reason + "（预示保留）", "info"); return; }
      openForeseeModal(cur, opts, r);
      return;
    }
    const r = E.act(S.item, ACTION[cur], opts);
    if (!r.ok) { toast(r.reason); return; }
    S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps });
    S.item = r.item;
    S.item.foresee = false; // 任何修改都会移除预示能力
    S.steps++;
    countUsage(cur, usageLabel(cur));
    const om1 = omenListOf(cur)[0] || null;
    if (om1) countUsage("omen", OMEN_ZH[om1][0], { oid: om1 });
    addLog(cur, r);
    targetHitToast(r.events);
    renderCraft(true);
    save();
  }

  function usageLabel(cur, tier) {
    const m = CUR_META[cur];
    const t = tier || S.tier;
    if (TIERABLE.has(cur) && t !== "base") return { greater: "高级", perfect: "完美" }[t] + m.zh;
    return m.zh;
  }
  function countUsage(kind, label, extra) {
    if (!S.usage[label]) S.usage[label] = Object.assign({ kind, count: 0 }, extra || {});
    S.usage[label].count++;
  }
  function usageCountOf(cur) {
    let n = 0;
    for (const [label, u] of Object.entries(S.usage)) if (u.kind === cur) n += u.count;
    return n;
  }

  function addLog(cur, r, labelOverride) {
    const m = CUR_META[cur];
    const parts = [];
    for (const ev of r.events) {
      if (ev.type === "add") parts.push(`<span class="l-affix">+ ${renderAffixText(ev.affix, true)}</span>`);
      if (ev.type === "remove") parts.push(`<span class="l-rm">− ${renderAffixText(ev.affix, true)}</span>`);
      if (ev.type === "reroll-all") parts.push(`<span class="l-rm">↻ 点金石重掷：清空 ${ev.affixes.length} 条旧词缀</span>`);
      if (ev.type === "sanctify") parts.push(`<span class="l-affix">✦ 圣化：数值整体 ×${(ev.factor * 100).toFixed(0)}%</span>`);
      if (ev.type === "reroll") parts.push(`<span class="l-affix">↻ 重掷了 ${ev.affixes.length} 条词缀的数值</span>`);
      if (ev.type === "fracture") parts.push(`<span class="l-fract">⊘ 分裂锁定 ${renderAffixText(ev.affix, true)}</span>`);
      if (ev.type === "foresee") parts.push(`<span class="l-t">物品获得预示：下一个通货可预览结果</span>`);
      if (ev.type === "no-affix") parts.push(`<span class="l-affix">变为魔法品质 —— 该基底前后缀 -1，没有可用词缀位（0 词缀蓝装）</span>`);
      if (ev.type === "consume-quality") parts.push(`<span class="l-affix">◆ 催化品质 ${S.item ? "已消耗" : "已消耗"}（对应类别词缀概率提高）</span>`);
    }
    const omenId = omenListOf(cur)[0] || null;
    const omenTxt = omenId ? ` · ${OMEN_ZH[omenId][0]}` : "";
    const label = labelOverride || m.zh;
    S.log.push({
      html: `<span class="l-t">${label}${omenTxt}</span><br>${parts.join("<br>")}`,
    });
  }

  /* ───────── 物品卡片 ───────── */
  // T 级编号：T1 = 最高档（与游戏/CoE 一致，档位序为从低到高）
  function tRankOf(mod, tierIdx) { return mod.tiers.length - tierIdx; }
  function renderAffixText(a, plain) {
    const mod = E.modsById.get(a.modId);
    // 催化剂品质：匹配类别的词缀按 ×(1+品质/100) 展示增强后数值
    const mult = S.item && S.item.quality ? E.qualityMultFor(S.item, mod) : 1;
    const vals = mult > 1 ? a.values.map((v) => Math.round(v * mult * 10) / 10) : a.values;
    const zh = I18N.modTextZh(mod, vals);
    const t = "T" + tRankOf(mod, a.tierIdx);
    return zh.split("\n").map((l, i) => (i === 0 || plain ? l : `<span class="hybrid-line">${l}</span>`)).join(plain ? "\n" : "") + (plain ? ` (${t})` : ` <span class="t-rank">${t}</span>`);
  }

  function renderCard(animate) {
    const card = $("#item-card");
    const cls = E.classById.get(S.classId);
    const base = E.baseIndex.get(S.classId + "/" + S.baseId);
    const item = S.item;
    const st = E.weaponStats(item);
    const boneBanner = item.bonePhantom
      ? `<div class="ic-bone-pending">☠ 渎灵骨已加 —— 再使用一次进行揭示（三选一）</div>` : "";
    const runesLine = (item.runes && item.runes.length) || (item.augments && item.augments.length)
      ? `<div class="ic-runes">ᚣ ${[
          ...(item.runes || []).map((id) => (E.runeById.get(id) || {}).zh || id),
          ...(item.augments || []).map((id) => (E.augmentById.get(id) || {}).zh || id),
        ].join(" · ")}${item.socketsBonus ? " <span class=\"hint\">+1 插槽</span>" : ""}</div>` : "";
    /* 镶嵌的增幅物按当前部位生效的效果行（魂核/基础符文） */
    const augEffectHtml = (item.augments || []).map((id) => {
      const a = E.augmentById.get(id);
      const fx = a && E.augmentEffectFor(item, a);
      return fx ? `<div class="ic-aug">${esc(fx.textZh)}<span class="aug-src"> · ${esc(a.zh)}</span></div>` : "";
    }).join("");
    const liquidCount = item.affixes.filter((a) => a.source === "liquid").length;
    const liquidLine = liquidCount
      ? `<div class="ic-liquid">◈ 工艺词缀 ${liquidCount}/${E.liquidCapOf(item)}</div>` : "";
    const anoin = item.anoint ? E.anointBySlug.get(item.anoint.slug) : null;
    const anointLine = anoin
      ? `<div class="ic-anoint">✦ 涂油：${esc(anoin.nameZh || anoin.name)} —— ${esc((anoin.statsZh || anoin.stats).split("\n").join(" · "))}</div>` : "";
    const qLine = item.quality && item.quality.value
      ? `<div class="ic-quality">◆ 品质：+${item.quality.value}%［${item.quality.type ? (QCATS[item.quality.type] ? QCATS[item.quality.type].zh : "") + "催化剂" : "类型未选——在品质面板选择催化剂后生效"}］· 匹配词缀数值 ×${item.quality.type ? (1 + item.quality.value / 100).toFixed(2) : "1.00"}</div>` : "";
    const corruptBadge = item.corrupted ? `<div class="ic-corrupted">⛔ 已腐化 —— 无法再使用通货</div>` : "";

    const affixHtml = item.affixes.map((a, i) => {
      const mod = E.modsById.get(a.modId);
      const tagCls = mod.type === "prefix" ? "p" : "s";
      const srcCls = a.fractured ? "fractured" : a.source === "essence" ? "essence-src" : a.source === "desecrated" ? "desec-src"
        : a.source === "rune" ? "rune-src" : a.source === "genesis" ? "genesis-src" : a.source === "liquid" ? "liquid-src"
        : a.source === "alloy" ? "alloy-src" : "";
      const srcTag = a.source === "liquid" ? '<span class="affix-tag liq">工艺</span>'
        : a.source === "rune" ? '<span class="affix-tag run">符文</span>'
        : a.source === "genesis" ? '<span class="affix-tag gen">创世树</span>'
        : a.source === "alloy" ? '<span class="affix-tag al">合金</span>' : "";
      const tierName = mod.tiers[a.tierIdx] && mod.tiers[a.tierIdx].name;
      const isNew = animate && i === item.affixes.length - 1 && animate !== "remove";
      const isTarget = S.targets.includes(a.modId);
      return `<div class="ic-affix ${isNew ? "new" : ""} ${srcCls}${isTarget ? " target-hit" : ""}">
        <span class="affix-tag ${tagCls}">${mod.type === "prefix" ? "前缀" : "后缀"}</span>${srcTag}${a.fractured ? '<span class="affix-tag frac">分裂</span>' : ""}${isTarget ? '<span class="t-hit-badge">✓ 目标</span>' : ""}${renderAffixText(a)}
        <span class="tier-name">${esc(tierName || "")}</span>
      </div>`;
    }).join("");

    const c = E.affixCounts(item);
    const cap = E.capsFor ? E.capsFor(item) : E.CAPS[item.rarity];
    const pips = (n, total, cls2) => Array.from({ length: total }, (_, i) => `<span class="pip ${i < n ? "filled " + cls2 : ""}"></span>`).join("");

    const nameLine = item.name ? `${item.name}` : "";
    const sanctifyBadge = item.sanctified ? `<div class="ic-sanctified">✦ 圣化物品</div>` : "";
    const dpsHtml = st ? `
      <div class="dps-block">
        <div class="dps-row total"><span>每秒伤害总和</span><b>${st.dps.toLocaleString()}</b></div>
        <div class="dps-row"><span>物理 ${st.physRange[0]}–${st.physRange[1]}</span><b>${st.pdps.toLocaleString()} / 秒</b></div>
        ${Object.entries(st.eleRanges).map(([k, v]) => `<div class="dps-row"><span>${eleZh(k)} ${v[0]}–${v[1]}</span><b>${Math.round(((v[0] + v[1]) / 2) * st.aps * (k === "chaos" ? 1 : 1 + st.incEle / 100)).toLocaleString()} / 秒</b></div>`).join("")}
        <div class="dps-row"><span>攻击速度</span><b>${st.aps.toFixed(2)}</b></div>
        <div class="dps-row"><span>暴击几率 / 加成</span><b>${st.crit}% / +${st.critDmg}%</b></div>
      </div>` : "";
    const ast = E.armourStats ? E.armourStats(item) : null;
    const armourHtml = ast ? `
      <div class="dps-block">
        <div class="dps-row total"><span>总防御</span><b>${ast.total}</b></div>
        ${ast.rows.map((r) => {
          const extra = r.flat || r.pct ? `（白值 ${r.base}${r.flat ? " +" + r.flat : ""}${r.pct ? " +" + r.pct + "%" : ""}）` : "";
          return `<div class="dps-row"><span>${defZh(r.key)}${extra}</span><b>${r.total}</b></div>`;
        }).join("")}
      </div>` : "";
    const jst = E.jewelryStats ? E.jewelryStats(item) : null;
    // 属性汇总：压成单独一行的内联摘要，放在前缀/后缀槽位下方
    const jewelryHtml = jst ? `
      <div class="sum-line">
        <span class="sum-lbl">属性汇总</span>
        ${jst.map((r) => `<span class="sum-item">${esc(r.zh)} <b>+${r.v}${r.unit}</b></span>`).join("")}
      </div>` : "";

    card.className = `item-card rarity-${item.rarity}` + (animate ? " shake" : "");
    if (animate) { card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake"); }
    const art = asset("weapons", S.classId + "/" + S.baseId);
    card.innerHTML = `
      ${item.foresee ? `<div class="ic-foresee">⟡ 辛格拉的预示已就绪 —— 下一个通货可预览结果</div>` : ""}
      ${boneBanner}
      ${runesLine}
      ${augEffectHtml}
      ${liquidLine}
      ${anointLine}
      ${qLine}
      ${corruptBadge}
      ${sanctifyBadge}
      ${art ? `<div class="ic-art"><img src="${art}" alt="" draggable="false"></div>` : ""}
      ${nameLine ? `<div class="ic-name">${esc(nameLine)}</div>` : ""}
      <div class="ic-base">${esc(base.zh)}${st ? "" : " · " + esc(cls.zh)}</div>
      <div class="ic-sep"></div>
      ${base.implicit ? `<div class="ic-implicit">${esc(base.implicit)}</div>` : ""}
      ${st ? `<div class="ic-stats">
        ${base.phys ? `<span>物理 <b>${base.phys[0]}–${base.phys[1]}</b></span>` : ""}
        ${base.ele ? Object.entries(base.ele).map(([k, v]) => `<span>${eleZh(k)} <b>${v[0]}–${v[1]}</b></span>`).join("") : ""}
        ${base.aps ? `<span>攻速 <b>${base.aps}</b></span>` : ""}
        ${base.crit ? `<span>暴击 <b>${base.crit}%</b></span>` : ""}
      </div>` : (defHtml(base) ? `<div class="ic-stats">${defHtml(base)}</div>` : "")}
      ${affixHtml ? `<div class="ic-sep"></div>${affixHtml}` : ""}
      <div class="slots-row">
        <span class="slots"><span class="lbl">前缀</span>${pips(c.prefix, cap.prefix, "p")}</span>
        <span class="slots"><span class="lbl">后缀</span>${pips(c.suffix, cap.suffix, "s")}</span>
      </div>
      ${dpsHtml}
      ${armourHtml}
      ${jewelryHtml}
      <div class="ic-stats" style="margin-top:12px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08)"><span>物品等级 <b>${item.ilvl}</b></span><span>词缀 <b>${item.affixes.length}</b></span></div>
    `;
    $("#btn-undo").disabled = !S.undoStack.length;
  }

  function renderLog() {
    const el = $("#craft-log");
    el.innerHTML = S.log.length
      ? S.log.map((l) => `<div class="log-entry">${l.html}</div>`).join("")
      : `<div class="log-empty">还没有使用任何通货 —— 从左侧开始做装吧</div>`;
    el.scrollTop = 0;
  }

  /* ───────── 概率面板 ───────── */
  function renderProb() {
    const cur = S.focusCur || defaultCurrency();
    const sub = $("#prob-sub");
    const list = $("#prob-list");
    const m = CUR_META[cur];
    const { opts } = rFor(cur);
    const omenId = omenListOf(cur)[0] || null;

    // 剥离：显示删除概率
    if (cur === "annulment") {
      const c = E.affixCounts(S.item);
      const rows = [];
      if (omenId === "OmenofSinistralAnnulment") rows.push(["随机一条前缀", c.prefix ? 1 : 0]);
      else if (omenId === "OmenofDextralAnnulment") rows.push(["随机一条后缀", c.suffix ? 1 : 0]);
      else if (omenId === "OmenofLight") {
        const n = S.item.affixes.filter((a) => a.source === "desecrated").length;
        rows.push(["一条亵渎词缀", n ? 1 : 0]);
      } else if (omenId === "OmenofGreaterAnnulment") {
        const n = S.item.affixes.filter((a) => !a.fractured).length;
        rows.push([`移除 2 条（共 ${n} 条可移除）`, n >= 2 ? 1 : 0]);
      } else {
        const n = S.item.affixes.length;
        S.item.affixes.forEach((a) => rows.push([renderAffixText(a, true).replace(/\n/g, " / "), n ? 1 / n : 0]));
      }
      sub.textContent = `· ${m.zh} 会删掉什么`;
      const omenNote = omenId === "OmenofGreaterAnnulment"
        ? `强效剥离：连续随机移除 <b>2</b> 条非分裂词缀（不足 2 条时移除全部）。`
        : `剥离以 <b>1/当前词缀数</b> 的等概率随机移除；预兆可锁定前缀 / 后缀 / 亵渎词缀 / 一次删 2 条。`;
      list.innerHTML = rows.length
        ? rows.map(([t, p]) => probRow(t, p)).join("") + `<div class="prob-note">${omenNote}</div>`
        : `<div class="prob-note">物品上没有词缀。</div>`;
      return;
    }

    // 混沌 + 消减/消抹预兆：先展示移除目标，再展示新增分布
    let chaosRemoveNote = "";
    if (cur === "chaos" && omenId) {
      const removables = S.item.affixes.filter((a) => !a.fractured);
      if (omenId === "OmenofWhittling" && removables.length) {
        let lowest = Infinity;
        for (const a of removables) lowest = Math.min(lowest, E.modsById.get(a.modId).tiers[a.tierIdx].ilvl);
        const t = removables.find((a) => E.modsById.get(a.modId).tiers[a.tierIdx].ilvl === lowest);
        chaosRemoveNote = `消减预兆：将确定移除等级需求最低的 <b>${renderAffixText(t, true).replace(/\n/g, " / ")}</b>。`;
      } else if (omenId === "OmenofSinistralErasure") {
        chaosRemoveNote = `左旋消抹预兆：混沌石只会移除一条<b>前缀</b>。`;
      } else if (omenId === "OmenofDextralErasure") {
        chaosRemoveNote = `右旋消抹预兆：混沌石只会移除一条<b>后缀</b>。`;
      }
    }

    // 精华：显示将获得/替换的固定词缀
    if (cur === "essence") {
      sub.textContent = "· 精华结果";
      list.innerHTML = `<div class="prob-note">点击左侧<b>精华</b>按钮选择精华类型与等级。<br>
        · 普通 → 魔法（1 条指定词缀）<br>· 魔法 → 稀有（追加指定词缀）<br>· 完美精华可用于稀有物品：替换一条同位词缀</div>`;
      return;
    }

    // 加词缀类：解析概率表
    let source = "normal", asRarity = null, type = null, floor = 0;
    if (cur === "transmutation") asRarity = "magic";
    if (cur === "regal") asRarity = "rare";
    if (cur === "alchemy") asRarity = "rare";
    if (cur === "desecrated") source = "desecrated";
    if (cur === "exalted" || cur === "chaos") { /* rare 本身 */ }
    if (TIERABLE.has(cur)) floor = E.TIER_FLOOR[S.tier];
    if (cur !== "chaos") {
      // 多预兆聚合（死灵限侧等；同组互斥由 UI 保证）
      const eff = E.omenEffects ? E.omenEffects(omenListOf(cur)) : null;
      if (eff && eff.constrainTo) type = eff.constrainTo;
    }
    // 催化升华预兆：概率面板同样按品质加成权重展示
    let qMult = null;
    if (cur === "exalted" && omenId === "OmenofCatalysingExaltation" && S.item.quality && S.item.quality.type && S.item.quality.value > 0) {
      qMult = (mod) => E.qualityMultFor(S.item, mod);
    }
    const tbl = E.probabilityTable(S.item, { source, asRarity, type, floor, weightMult: qMult });
    sub.textContent = `· 下一次${m.zh}的结果分布${qMult ? `（催化升华：${QCATS[S.item.quality.type] ? QCATS[S.item.quality.type].zh : ""}类别权重 ×${(1 + S.item.quality.value / 100).toFixed(2)}）` : ""}`;

    if (!tbl.rows.length) {
      const flipNote = cur === "transmutation"
        ? "蜕变石仍可使用：物品会变为魔法品质，只是不获得词缀（失神类基底前后缀 -1）。"
        : "";
      list.innerHTML = `<div class="prob-note">当前状态下${m.zh}掷不出任何词缀。${flipNote}</div>`;
      return;
    }
    const top = tbl.rows.slice(0, 60);
    const extraPools = E.extraPoolsOf ? E.extraPoolsOf(S.item) : [];
    const extraNames = [];
    for (const rid of (S.item.runes || [])) {
      const rune = E.runeById && E.runeById.get(rid);
      if (rune && rune.effect.kind === "canRoll") extraNames.push(rune.zh);
    }
    const base = S.item && E.baseIndex.get(S.item.classId + "/" + S.item.baseId);
    if (base && base.genesis) extraNames.push("创世树独占池");
    const extraNote = extraPools.length ? `已并入 <b>${extraPools.length}</b> 个附加词缀池${extraNames.length ? "（" + extraNames.join(" + ") + "）" : ""}。` : "";
    list.innerHTML = top.map((r) => {
      const best = r.tiers.reduce((a, b) => (a.prob >= b.prob ? a : b));
      const tierTxt = r.tiers.length === 1
        ? `档位「T${tRankOf(r.mod, r.tiers[0].tierIdx)} · ${best.tier.name}」 ${fmtP(best.prob)}${rangeTxt(r.tiers[0].tier.ranges)}`
        : `${r.tiers.length} 个可达档位 · 概率最高「T${tRankOf(r.mod, best.tierIdx)} · ${best.tier.name}」${fmtP(best.prob)}${rangeTxt(best.tier.ranges)}`;
      return `<div class="prob-row">
        <div class="p-head"><span class="p-text">${renderAffixText({ modId: r.mod.id, values: r.tiers[0].tier.ranges.map((x) => x[0]), tierIdx: r.tiers[0].tierIdx })}</span>
        <span class="p-pct">${fmtP(r.prob)}</span></div>
        <div class="p-bar"><i style="width:${(r.prob * 100).toFixed(1)}%"></i></div>
        <div class="p-tier">${esc(tierTxt)}</div>
      </div>`;
    }).join("") +
    (tbl.rows.length > 60 ? `<div class="prob-note">… 其余 ${tbl.rows.length - 60} 条词缀概率均低于 ${(fmtP(top[top.length - 1].prob))}</div>` : "") +
    (chaosRemoveNote ? `<div class="prob-note">${chaosRemoveNote}</div>` : "") +
    `<div class="prob-note">共 <b>${tbl.pairs.length}</b> 个（词缀×档位）组合参与 roll。${extraNote}${floor ? `当前为<b>${{ 35: "高级", 50: "完美" }[floor]}</b>通货，只 roll 档位需求 ≥ ${floor} 的词缀档。` : ""}${type ? `预兆限定只出<b>${type === "prefix" ? "前缀" : "后缀"}</b>。` : ""}</div>`;
  }
  function fmtP(p) { return (p * 100).toFixed(p >= 0.1 ? 1 : 2) + "%"; }
  function rangeTxt(ranges) {
    if (!ranges || !ranges.length) return "";
    return " · 数值 " + ranges.map((r) => r[0] === r[1] ? r[0] : `${r[0]}–${r[1]}`).join(" / ");
  }
  function probRow(text, p) {
    return `<div class="prob-row">
      <div class="p-head"><span class="p-text">${esc(text)}</span><span class="p-pct">${fmtP(p)}</span></div>
      <div class="p-bar"><i style="width:${(p * 100).toFixed(1)}%"></i></div>
    </div>`;
  }

  /* ───────── 精华弹窗 ───────── */
  function openEssenceModal() {
    const grid = $("#essence-grid");
    // 该基底可用池（防具按属性分池）对应的精华
    const pk = E.poolKeyOf ? E.poolKeyOf(S.item) : S.classId;
    const avail = new Map();
    for (const e of D.essenceModMap) {
      if (e.classId !== pk) continue;
      if (!avail.has(e.essence)) avail.set(e.essence, new Set());
      avail.get(e.essence).add(e.tier);
    }
    const essenceTierZh = { LESSER: "低", NORMAL: "中", GREATER: "高", PERFECT: "完美" };
    grid.innerHTML = [...avail.entries()].map(([name, tiers]) => {
      const preview = E.essenceIndex.get(pk + "|" + name + "|" + (tiers.has("GREATER") ? "GREATER" : [...tiers][0]));
      const mod = preview && E.modsById.get(preview.modId);
      return `
      <div class="essence-item">
        ${essenceIcon(name, 34)}
        <div class="e-info">
          <div class="e-name">${ESSENCE_ZH[name] || name}精华 <span style="font-size:11px;color:var(--text-faint)">${esc(name)}</span></div>
          ${mod ? `<div class="e-mod">${renderAffixText({ modId: mod.id, values: mod.tiers[preview.tierIndex].ranges.map((x) => x[0]), tierIdx: preview.tierIndex }, true).split("\n").map(esc).join("<br>")}</div>` : ""}
        </div>
        <div class="e-tiers">
          ${["LESSER", "NORMAL", "GREATER", "PERFECT"].map((t) => {
            const usable = tiers.has(t) && E.act(S.item, "essence", { essence: name, tier: t }, E.makeRng(1)).ok;
            return `<button data-essence="${esc(name)}" data-tier="${t}" ${usable ? "" : "disabled"} title="${D.prices[{ LESSER: "essence_lesser", NORMAL: "essence", GREATER: "essence_greater", PERFECT: "perfect_essence" }[t]]} 崇">${essenceTierZh[t]}</button>`;
          }).join("")}
        </div>
      </div>`;
    }).join("");
    $("#essence-modal").classList.remove("hidden");
    $$(".e-tiers button", grid).forEach((b) => b.addEventListener("click", () => useEssence(b.dataset.essence, b.dataset.tier)));
  }
  /* ───────── 深渊揭示弹窗（渎灵通货：骨头 → 三选一/六选一） ───────── */
  function openDesecrateModal() {
    // 加骨时快照的预兆组合与骨头档位（可叠加：死灵限侧 + 首领锁池 + 回响/腐化揭示）
    const phantom = S.item.bonePhantom || {};
    const omens = Array.isArray(phantom.omens) ? phantom.omens : omenListOf("desecrated");
    const eff = E.omenEffects(omens);
    const boneTier = phantom.tier || S.boneTier || "preserved";
    const boneName = E.boneNameFor(S.item.classId, boneTier);
    const tierMeta = E.BONE_TIER[boneTier] || E.BONE_TIER.preserved;
    const omenTxt = () => omens.map((oid) => OMEN_ZH[oid][0]).join(" + ");
    // 腐化揭示预兆：直接清空现有词缀并附加 6 条渎灵词缀
    if (eff.putrefaction) {
      const cands6 = E.desecrateCandidates(S.item, { omens, boneTier, echoes: true, boss: null }, E.defaultRng);
      if (!cands6.length) { toast("渎灵池不可用", "warn"); return; }
      const it = E.clone(S.item);
      const removed = it.affixes.slice();
      it.affixes = [];
      const added = [];
      for (const p of cands6) {
        const a = { modId: p.mod.id, values: p.mod.tiers[p.tierIdx].ranges.map((x) => x[0]), tierIdx: p.tierIdx, source: "desecrated" };
        it.affixes.push(a);
        added.push(a);
      }
      delete it.bonePhantom;
      const cost = (D.prices.desecrate || 0) * tierMeta.priceMult + omens.reduce((s2, oid) => s2 + (D.omenPrices[oid] || 0), 0);
      S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps });
      S.item = it;
      S.steps++;
      countUsage("desecrated", boneName);
      for (const oid of omens) countUsage("omen", OMEN_ZH[oid][0], { oid });
      S.log.push({
        html: `<span class="l-cost">≈${fmtC(cost)} 崇</span><span class="l-t">腐化揭示 · ${omenTxt()}</span><br><span class="l-rm">− 清空 ${removed.length} 条词缀</span><br>${added.map((a) => `<span class="l-affix">+ ${renderAffixText(a, true)}</span>`).join("<br>")}`,
      });
      renderCraft(true);
      save();
      return;
    }
    const echoes = eff.echoes;
    const boss = eff.boss;
    if (boss && !E.bossOmenAllowed(S.item.classId)) {
      toast("首领预兆仅适用于武器或珠宝（护甲的肋骨渎灵不可用）", "warn");
      return;
    }
    const cands = E.desecrateCandidates(S.item, { omens, boneTier, echoes }, E.defaultRng);
    if (!cands.length) {
      toast("当前状态下没有可揭示的渎灵词缀（检查稀有度/词缀上限/骨头档位限制）", "warn");
      return;
    }
    const tierNote = tierMeta.maxIlvl ? ` · ${E.BONE_TIER[boneTier].zh}骨：仅 ilvl≤${tierMeta.maxIlvl}` : tierMeta.floor ? ` · ${E.BONE_TIER[boneTier].zh}骨：词缀等级≥${tierMeta.floor}` : "";
    $("#desecrate-title").innerHTML = `${curIcon("desecrated", 26)} 渎灵揭示 · ${boneName}${echoes ? "（深渊回响 · 六选一）" : ""}`;
    $("#desecrate-hint").textContent = `从 ${cands.length} 个候选渎灵词缀中选择一条（普通 ∪ 渎灵词缀池${eff.constrainTo ? "，限" + (eff.constrainTo === "prefix" ? "前缀" : "后缀") : ""}）。${boss ? "已锁定首领秘藏池。" : ""}${tierNote}`;
    const grid = $("#desecrate-grid");
    grid.innerHTML = cands.map((p, i) => {
      const t = p.mod.tiers[p.tierIdx];
      return `
      <button class="essence-item" data-i="${i}">
        <div class="e-info">
          <div class="e-mod">${renderAffixText({ modId: p.mod.id, values: t.ranges.map((x) => x[0]), tierIdx: p.tierIdx }, true).split("\n").map(esc).join("<br>")}</div>
          <div class="e-name"><span style="font-size:11px;color:var(--text-faint)">T${p.mod.tiers.length - p.tierIdx} · ${esc(t.name)} · ${esc(p.mod.type === "prefix" ? "前缀" : "后缀")} · 权重 ${p.weight}</span></div>
        </div>
      </button>`;
    }).join("");
    $("#desecrate-modal").classList.remove("hidden");
    $$(".essence-item", grid).forEach((b) => b.addEventListener("click", () => useDesecrate(cands[+b.dataset.i], omens, boneTier)));
  }
  function useDesecrate(pair, omens, boneTier) {
    const rItem = E.applyDesecrate(S.item, pair, E.defaultRng);
    const tierMeta = E.BONE_TIER[boneTier] || E.BONE_TIER.preserved;
    const boneName = E.boneNameFor(S.item.classId, boneTier);
    const cost = (D.prices.desecrate || 0) * tierMeta.priceMult + omens.reduce((s, oid) => s + (D.omenPrices[oid] || 0), 0);
    const affix = { modId: pair.mod.id, values: pair.mod.tiers[pair.tierIdx].ranges.map((x) => x[0]), tierIdx: pair.tierIdx };
    S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps });
    S.item = rItem;
    S.steps++;
    countUsage("desecrated", boneName);
    for (const oid of omens) countUsage("omen", OMEN_ZH[oid][0], { oid });
    const omenTxt = omens.map((oid) => OMEN_ZH[oid][0]).join(" + ");
    S.log.push({
      html: `<span class="l-cost">≈${fmtC(cost)} 崇</span><span class="l-t">渎灵揭示 · ${boneName}${omenTxt ? " · " + omenTxt : ""}</span><br><span class="l-affix">+ ${renderAffixText(affix, true)}</span>`,
    });
    targetHitToast([{ type: "add", affix }]);
    $("#desecrate-modal").classList.add("hidden");
    renderCraft(true);
    save();
  }
  $("#desecrate-close").addEventListener("click", () => $("#desecrate-modal").classList.add("hidden"));
  $("#desecrate-modal").addEventListener("click", (e) => { if (e.target.id === "desecrate-modal") $("#desecrate-modal").classList.add("hidden"); });

  /* ───────── 手动编辑词缀（导入买来的物品） ───────── */
  const SRC_ZH = { normal: "普通", essence: "精华", desecrated: "亵渎" };
  let EDIT = null; // { rarity, affixes, q, pick, quality }

  /* ── 游戏物品文本解析（Ctrl+C 粘贴导入，中/英文客户端均可） ── */
  const normTpl = (s) => s.replace(/\d+(?:\.\d+)?/g, "#").replace(/\s+/g, " ").trim();
  function buildMatchIndex() {
    // 归一化模板（数字→#）-> mod：中英两套模板都收录
    const map = new Map();
    for (const mod of editPool().values()) {
      const zhT = normTpl(I18N.modTextZh(mod));
      const enT = normTpl(mod.text);
      if (!map.has(zhT)) map.set(zhT, mod);
      if (!map.has(enT)) map.set(enT, mod);
    }
    return map;
  }
  function parseItemText(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const out = { rarity: null, quality: null, baseHit: null, affixes: [], skipped: [] };
    const idx = buildMatchIndex();
    const RARITY = { "普通": "normal", Normal: "normal", "魔法": "magic", Magic: "magic", "稀有": "rare", Rare: "rare" };
    // 全库基底中文名索引（用于识别基底行）
    const baseByName = new Map();
    for (const c of E.classList) for (const b of c.bases) baseByName.set(b.zh, { classId: c.id, baseId: b.id });
    for (const raw of lines) {
      if (/^-{3,}$/.test(raw)) continue;
      let line = raw.replace(/（已强化）|\(augmented\)/gi, "").trim();
      const fractured = /（已分裂）|\(fractured\)/i.test(raw);
      line = line.replace(/（已分裂）|\(fractured\)/gi, "").trim();
      let m;
      if ((m = line.match(/^(?:稀有度|Rarity)[:：]\s*(\S+)/))) { out.rarity = RARITY[m[1]] || null; continue; }
      if ((m = line.match(/^(?:品质|Quality)[:：]\s*\+?(\d+(?:\.\d+)?)%/))) { out.quality = +m[1]; continue; }
      // 头部/杂项行跳过
      if (/^(物品类别|Item Class|物品等级|Item Level|需求|Requires|等级|Level|获得技能|Grants Skill|允许的|插槽|Sockets?|已腐化|Corrupted)/.test(line)) continue;
      // 裂隙精化保底词缀（+20% to Maximum Quality / 品质上限 +20% 两种语序）
      if (/品质上限|Maximum Quality/i.test(line) && /20/.test(line)) { out.affixes.push({ modId: E.BREACH_QUALITY_MOD.id, tierIdx: 0, values: [20], source: "breach" }); continue; }
      // 基底行：整行等于某基底名（或以基底名结尾，兼容魔法物品「名字 基底」同行）
      let baseHit = baseByName.get(line);
      if (!baseHit) for (const [zh, hit] of baseByName) { if (zh.length >= 3 && line.endsWith(zh)) { baseHit = hit; break; } }
      if (baseHit) { out.baseHit = baseHit; continue; }
      // 词缀行：数字归一化后查模板
      const mod = idx.get(normTpl(line));
      if (!mod) { out.skipped.push(raw); continue; }
      const nums = (line.match(/\d+(?:\.\d+)?/g) || []).map(Number);
      let tierIdx = -1, bestW = Infinity;
      mod.tiers.forEach((t, i) => {
        if (nums.length && t.ranges.length !== nums.length) return;
        let ok = true, w = 0;
        for (let k = 0; k < (nums.length || t.ranges.length); k++) {
          const [lo, hi] = t.ranges[k];
          if (nums.length && (nums[k] < lo - 1e-9 || nums[k] > hi + 1e-9)) { ok = false; break; }
          w += hi - lo;
        }
        if (ok && w < bestW) { bestW = w; tierIdx = i; }
      });
      if (tierIdx < 0) tierIdx = mod.tiers.length - 1;
      const affix = { modId: mod.id, tierIdx, values: nums.length ? nums : mod.tiers[tierIdx].ranges.map((r) => r[1]), source: defaultSourceOf(mod) };
      if (fractured) affix.fractured = true;
      out.affixes.push(affix);
    }
    // 同族去重（保留第一条）
    const fam = new Set();
    out.affixes = out.affixes.filter((a) => {
      const f = E.modsById.get(a.modId).family;
      if (fam.has(f)) return false;
      fam.add(f);
      return true;
    });
    return out;
  }

  function editPool() {
    // 词缀候选 = 该基底普通池 ∪ 亵渎池 ∪ 可用精华词缀 ∪（珠宝）可用的蒸馏情感工艺词缀
    const map = targetPool();
    const pk = E.poolKeyOf ? E.poolKeyOf(S.item) : S.classId;
    for (const e of D.essenceModMap) {
      if (e.classId === pk && !map.has(e.modId)) {
        const m = E.modsById.get(e.modId);
        if (m) map.set(e.modId, m);
      }
    }
    if ((S.item.classId || "").indexOf("Jewels") === 0 && E.jewelColorOf) {
      const tl = E.isTimeLostJewel(S.item);
      const color = E.jewelColorOf(S.item);
      for (const e of E.ALDUR.liquid) {
        if ((e.target === "timelost") !== tl) continue;
        for (const slot of [color, color + "S"]) {
          if (!e.affixes[slot]) continue;
          const m = E.modsById.get("Liquid/" + e.id + "_" + slot);
          if (m && !map.has(m.id)) map.set(m.id, m);
        }
      }
    }
    return map;
  }
  function defaultSourceOf(mod) {
    if (mod.source === "desecrated" || /ESSENCE_/.test(mod.id) || /^ESSENCE_/.test(mod.field)) return mod.source === "desecrated" ? "desecrated" : "essence";
    return "normal";
  }
  function defaultTierIdx(mod) {
    for (let i = mod.tiers.length - 1; i >= 0; i--) if (mod.tiers[i].ilvl <= S.item.ilvl) return i;
    return 0;
  }

  function openEditModal() {
    EDIT = { rarity: S.item.rarity, affixes: JSON.parse(JSON.stringify(S.item.affixes)), q: "", pick: null };
    renderEditModal();
    $("#edit-modal").classList.remove("hidden");
  }

  function editCounts() {
    const c = { prefix: 0, suffix: 0 };
    for (const a of EDIT.affixes) c[E.modsById.get(a.modId).type === "prefix" ? "prefix" : "suffix"]++;
    return c;
  }
  function editCapFor(rarity) {
    return E.capsFor ? E.capsFor({ ...S.item, rarity }, rarity) : E.CAPS[rarity];
  }

  function renderEditModal() {
    const box = $("#edit-body");
    const cnt = editCounts();
    const rarities = ["normal", "magic", "rare"].map((r) => {
      const cap = editCapFor(r);
      const illegal = r !== "normal" && (cnt.prefix > cap.prefix || cnt.suffix > cap.suffix);
      return `<button data-r="${r}" class="${EDIT.rarity === r ? "on" : ""}" ${illegal ? 'disabled title="当前词缀数超出该稀有度上限"' : ""}>${{ normal: "普通", magic: "魔法", rare: "稀有" }[r]}</button>`;
    }).join("");
    box.innerHTML = `
      <details class="ed-import">
        <summary>📥 粘贴游戏物品文本导入（推荐：游戏内 Ctrl+C 复制物品）</summary>
        <textarea id="ed-paste" placeholder="在游戏里对着物品按 Ctrl+C，把整段物品文本粘贴到这里，点「解析导入」自动识别稀有度 / 词缀 / T 级 / 数值 / 品质…"></textarea>
        <div class="ed-import-row">
          <button class="btn" id="ed-parse">解析导入</button>
          <span id="ed-parse-msg" class="hint"></span>
        </div>
      </details>
      <div class="ed-row">
        <span class="ed-lbl">稀有度</span>
        <div class="ed-seg" id="ed-rarity">${rarities}</div>
        <span class="ed-cap" id="ed-cap"></span>
      </div>
      <div class="ed-lbl2">当前词缀 <span class="hint">（点 ✕ 移除）</span></div>
      <div id="ed-affixes" class="ed-affixes"></div>
      <div class="ed-row" style="margin-top:12px">
        <span class="ed-lbl">添加词缀</span>
        <input id="ed-search" type="text" placeholder="搜索词缀（中/英文，如：精魂 / 抗性 / spirit）…" value="${esc(EDIT.q)}">
      </div>
      <div id="ed-suggest" class="target-suggest"></div>
      <div id="ed-pick"></div>
      <div class="ed-actions">
        <button class="btn primary" id="ed-apply">✓ 应用到物品</button>
        <button class="btn" id="ed-cancel">取消</button>
      </div>`;
    $$("#ed-rarity button", box).forEach((b) => b.addEventListener("click", () => {
      EDIT.rarity = b.dataset.r;
      $$("#ed-rarity button").forEach((x) => x.classList.toggle("on", x === b));
      renderEditCap();
    }));
    $("#ed-search").addEventListener("input", (e) => { EDIT.q = e.target.value.trim().toLowerCase(); renderEditSuggest(); });
    $("#ed-apply").addEventListener("click", applyEdit);
    $("#ed-cancel").addEventListener("click", () => { $("#edit-modal").classList.add("hidden"); EDIT = null; });
    $("#ed-parse").addEventListener("click", () => {
      const txt = $("#ed-paste").value;
      const msg = $("#ed-parse-msg");
      if (!txt.trim()) { msg.textContent = "请先粘贴物品文本"; return; }
      const r = parseItemText(txt);
      if (r.baseHit && r.baseHit.classId !== S.classId) {
        const b = E.baseIndex.get(r.baseHit.classId + "/" + r.baseHit.baseId);
        msg.innerHTML = `检测到基底为 <b>「${esc(b.zh)}」</b>，与当前基底不符 —— 请先返回选择该基底再导入`;
        return;
      }
      if (!r.affixes.length && r.rarity == null && r.quality == null) { msg.textContent = "没有识别到任何内容，请确认粘贴的是游戏内复制的物品文本"; return; }
      EDIT.affixes = r.affixes;
      EDIT.rarity = r.rarity || (r.affixes.length > 2 ? "rare" : r.affixes.length ? "magic" : EDIT.rarity);
      if (r.quality != null) EDIT.quality = r.quality;
      const skipped = r.skipped.length ? `；未识别 ${r.skipped.length} 行（${esc(r.skipped.slice(0, 3).join(" / "))}${r.skipped.length > 3 ? "…" : ""}）` : "";
      msg.innerHTML = `已识别 ${r.affixes.length} 条词缀${r.rarity ? " · 稀有度 " + { normal: "普通", magic: "魔法", rare: "稀有" }[r.rarity] : ""}${r.quality != null ? " · 品质 " + r.quality + "%（催化剂类型需手动选择）" : ""}${skipped}`;
      renderEditAffixes();
      refreshEditRarity();
    });
    renderEditAffixes();
    renderEditSuggest();
    renderEditPick();
  }

  function renderEditCap() {
    const c = editCounts();
    const cap = editCapFor(EDIT.rarity);
    $("#ed-cap").innerHTML = `前缀 ${c.prefix}/${cap.prefix} · 后缀 ${c.suffix}/${cap.suffix}`;
  }

  function refreshEditRarity() {
    const cnt = editCounts();
    $$("#ed-rarity button").forEach((b) => {
      const cap = editCapFor(b.dataset.r);
      const illegal = b.dataset.r !== "normal" && (cnt.prefix > cap.prefix || cnt.suffix > cap.suffix);
      b.disabled = illegal;
      b.title = illegal ? "当前词缀数超出该稀有度上限" : "";
    });
    $$("#ed-rarity button").forEach((x) => x.classList.toggle("on", x.dataset.r === EDIT.rarity && !x.disabled));
    if (EDIT.rarity === "normal" && EDIT.affixes.length) {
      // 普通物品带词缀不合法：自动切换并提示
      EDIT.rarity = "magic";
      $$("#ed-rarity button").forEach((x) => x.classList.toggle("on", x.dataset.r === "magic"));
    }
  }

  function renderEditAffixes() {
    const box = $("#ed-affixes");
    box.innerHTML = EDIT.affixes.map((a, i) => {
      const mod = E.modsById.get(a.modId);
      const tag = mod.type === "prefix" ? "p" : "s";
      const flags = [a.fractured ? "分裂" : "", SRC_ZH[a.source] && a.source !== "normal" ? SRC_ZH[a.source] : ""].filter(Boolean).join("·");
      return `<div class="ed-affix">
        <span class="affix-tag ${tag}">${mod.type === "prefix" ? "前缀" : "后缀"}</span>
        ${renderAffixText(a)}
        ${flags ? `<span class="ed-flags">${esc(flags)}</span>` : ""}
        <button class="ed-rm" data-i="${i}" title="移除">✕</button>
      </div>`;
    }).join("") || `<div class="log-empty">还没有词缀 —— 搜索并添加，或直接应用修改稀有度</div>`;
    $$(".ed-rm", box).forEach((b) => b.addEventListener("click", () => {
      EDIT.affixes.splice(+b.dataset.i, 1);
      renderEditAffixes();
    }));
    refreshEditRarity();
    renderEditCap();
  }

  function renderEditSuggest() {
    const box = $("#ed-suggest");
    if (!EDIT.q) { box.innerHTML = ""; return; }
    const pool = editPool();
    const taken = new Set(EDIT.affixes.map((a) => a.modId));
    const takenFam = new Set(EDIT.affixes.map((a) => E.modsById.get(a.modId).family));
    const hits = [...pool.values()]
      .filter((m) => !taken.has(m.id) && !takenFam.has(m.family) && modSearchText(m).includes(EDIT.q))
      .slice(0, 8);
    box.innerHTML = hits.map((m) =>
      `<button data-mid="${m.id}"><span class="ed-tag ${m.type === "prefix" ? "p" : "s"}">${m.type === "prefix" ? "前" : "后"}</span>${esc(I18N.modTextZh(m, m.tiers[m.tiers.length - 1].ranges.map((x) => x[1])).split("\n")[0])}</button>`
    ).join("") || `<div class="log-empty">没有匹配的词缀</div>`;
    $$("button", box).forEach((b) => b.addEventListener("click", () => {
      const m = pool.get(b.dataset.mid);
      const tierIdx = defaultTierIdx(m);
      EDIT.pick = {
        modId: m.id, tierIdx,
        values: m.tiers[tierIdx].ranges.map((r) => r[1]),
        source: defaultSourceOf(m), fractured: false,
      };
      EDIT.q = ""; $("#ed-search").value = "";
      renderEditSuggest();
      renderEditPick();
    }));
  }

  function renderEditPick() {
    const box = $("#ed-pick");
    if (!EDIT || !EDIT.pick) { box.innerHTML = ""; return; }
    const mod = E.modsById.get(EDIT.pick.modId);
    const p = EDIT.pick;
    const tiers = mod.tiers.map((t, i) => ({ t, i, ok: t.ilvl <= S.item.ilvl, label: "T" + (mod.tiers.length - i) }));
    // 档位范围文本：单段 10–15，多段 10–15 到 18–26（贴近游戏伤害词缀的双段表达）
    const rangeTxt = (t) => t.ranges.map((r) => r[0] === r[1] ? String(r[0]) : `${r[0]}–${r[1]}`).join(" 到 ");
    const curTier = mod.tiers[p.tierIdx];
    box.innerHTML = `
      <div class="ed-pick">
        <div class="ed-pick-head">
          <span class="affix-tag ${mod.type === "prefix" ? "p" : "s"}">${mod.type === "prefix" ? "前缀" : "后缀"}</span>
          <span class="ed-pick-text">${renderAffixText({ modId: p.modId, values: p.values, tierIdx: p.tierIdx })}</span>
          <button class="ed-rm" id="ed-pick-x" title="取消">✕</button>
        </div>
        <div class="ed-pick-row"><span class="ed-lbl">档位</span>
          <div class="ed-tiers">${tiers.map((x) => `<button data-ti="${x.i}" ${x.ok ? "" : "disabled"} class="${p.tierIdx === x.i ? "on" : ""}" title="${esc(x.t.name)} · 范围 ${rangeTxt(x.t)} · 需求 ilvl ${x.t.ilvl}${x.ok ? "" : "（超过当前物品等级）"}">${x.label}</button>`).join("")}</div>
          <span class="ed-range-cur">T${mod.tiers.length - p.tierIdx} 范围：<b>${rangeTxt(curTier)}</b> · 需求 ilvl ${curTier.ilvl}</span>
        </div>
        <div class="ed-pick-row"><span class="ed-lbl">数值</span>
          ${p.values.map((v, vi) => {
            const r = mod.tiers[p.tierIdx].ranges[vi];
            return `<span class="ed-val-seg"><input type="number" class="ed-val" data-vi="${vi}" value="${v}" min="${r[0]}" max="${r[1]}" step="any">${p.values.length > 1 ? `<i class="ed-seg-range">${r[0]}–${r[1]}</i>` : `<i class="ed-seg-range">${r[0]}–${r[1]}</i>`}</span>${vi < p.values.length - 1 ? '<span class="ed-seg-sep">到</span>' : ""}`;
          }).join("")}
          <button class="mini ed-min" id="ed-min" title="各段取最小值">最小</button>
          <button class="mini ed-max" id="ed-max" title="各段取最大值">最大</button>
        </div>
        <div class="ed-pick-row"><span class="ed-lbl">来源</span>
          <div class="ed-seg" id="ed-src">
            ${["normal", "essence", "desecrated"].map((s) => `<button data-s="${s}" class="${p.source === s ? "on" : ""}">${SRC_ZH[s]}</button>`).join("")}
          </div>
          <label class="ed-frac"><input type="checkbox" id="ed-frac" ${p.fractured ? "checked" : ""}> 分裂锁定（不可被剥离/混沌移除）</label>
        </div>
        <button class="btn primary" id="ed-add">＋ 加入词缀</button>
      </div>`;
    $$(".ed-tiers button", box).forEach((b) => b.addEventListener("click", () => {
      const ti = +b.dataset.ti;
      EDIT.pick.tierIdx = ti;
      EDIT.pick.values = mod.tiers[ti].ranges.map((r) => r[1]);
      renderEditPick();
    }));
    $$(".ed-val", box).forEach((inp) => inp.addEventListener("change", () => {
      const vi = +inp.dataset.vi;
      const r = mod.tiers[EDIT.pick.tierIdx].ranges[vi];
      const raw = +inp.value;
      let v = Math.round(Math.max(r[0], Math.min(r[1], raw || r[0])) * 10) / 10;
      // 合法性：超出档位范围的输入会被钳制并提示
      if (raw < r[0] - 1e-9 || raw > r[1] + 1e-9) {
        inp.classList.add("ed-val-clamped");
        toast(`数值 ${raw} 超出 T${mod.tiers.length - EDIT.pick.tierIdx} 范围 ${r[0]}–${r[1]}，已钳制为 ${v}`, "warn");
        setTimeout(() => inp.classList.remove("ed-val-clamped"), 1200);
      }
      inp.value = v;
      EDIT.pick.values[vi] = v;
      $("#ed-pick .ed-pick-text").innerHTML = renderAffixText({ modId: EDIT.pick.modId, values: EDIT.pick.values, tierIdx: EDIT.pick.tierIdx });
    }));
    const setAll = (pickEnd) => {
      EDIT.pick.values = mod.tiers[EDIT.pick.tierIdx].ranges.map((r) => pickEnd(r));
      renderEditPick();
    };
    $("#ed-min").addEventListener("click", () => setAll((r) => r[0]));
    $("#ed-max").addEventListener("click", () => setAll((r) => r[1]));
    $$("#ed-src button", box).forEach((b) => b.addEventListener("click", () => {
      EDIT.pick.source = b.dataset.s;
      $$("#ed-src button").forEach((x) => x.classList.toggle("on", x === b));
    }));
    $("#ed-frac").addEventListener("change", (e) => { EDIT.pick.fractured = e.target.checked; });
    $("#ed-pick-x").addEventListener("click", () => { EDIT.pick = null; renderEditPick(); });
    $("#ed-add").addEventListener("click", () => {
      const mod2 = E.modsById.get(EDIT.pick.modId);
      // 合法性：数值必须在所选档位范围内
      const tier2 = mod2.tiers[EDIT.pick.tierIdx];
      for (let k = 0; k < tier2.ranges.length; k++) {
        const [lo, hi] = tier2.ranges[k];
        const v = EDIT.pick.values[k];
        if (v == null || v < lo - 1e-9 || v > hi + 1e-9) {
          toast(`数值不合法：第 ${k + 1} 段需在 ${lo}–${hi} 内`, "warn");
          return;
        }
      }
      // 合法性：前/后缀位（普通→魔法→稀有，自动提升到能放下的最低稀有度）、精华来源上限 1 条
      const c = editCounts();
      const fits = (r) => c[mod2.type] < editCapFor(r)[mod2.type];
      if (!fits(EDIT.rarity)) {
        const order = ["normal", "magic", "rare"];
        let promoted = null;
        for (let j = order.indexOf(EDIT.rarity) + 1; j < order.length && !promoted; j++) {
          if (fits(order[j])) promoted = order[j];
        }
        if (promoted) {
          EDIT.rarity = promoted;
          $$("#ed-rarity button").forEach((x) => x.classList.toggle("on", x.dataset.r === promoted));
        } else {
          const cap = editCapFor("rare");
          toast(`后缀位已满（稀有上限 ${cap[mod2.type]}），无法加入`, "warn");
          return;
        }
      }
      if (EDIT.pick.source === "essence" && EDIT.affixes.some((a) => a.source === "essence")) {
        toast("一件物品最多携带 1 条精华来源的词缀", "warn");
        return;
      }
      const a = { modId: EDIT.pick.modId, tierIdx: EDIT.pick.tierIdx, values: EDIT.pick.values.slice(), source: EDIT.pick.source };
      if (EDIT.pick.fractured) a.fractured = true;
      EDIT.affixes.push(a);
      EDIT.pick = null;
      renderEditPick();
      renderEditAffixes();
    });
  }

  function applyEdit() {
    if (!EDIT) return;
    S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps, log: S.log.slice() });
    const it = E.clone(S.item);
    it.rarity = EDIT.affixes.length && EDIT.rarity === "normal" ? "magic" : EDIT.rarity;
    it.affixes = EDIT.affixes;
    it.foresee = false; // 修改物品即打断预示
    if (EDIT.quality != null && EDIT.quality > 0) it.quality = { type: (it.quality && it.quality.type) || null, value: EDIT.quality }; // 粘贴导入的品质：类型未知，保留数值待选类型
    const added = it.affixes.length - S.item.affixes.length;
    S.item = it;
    S.steps++;
    S.log.push({ html: `<span class="l-t">手动编辑</span><br><span class="l-affix">词缀数 ${S.item.affixes.length}（${added >= 0 ? "+" + added : added}） · 稀有度 ${E.rarityName(it.rarity)}${EDIT.quality != null && EDIT.quality > 0 ? " · 品质 " + EDIT.quality + "%" : ""}</span>` });
    EDIT.quality = null;
    $("#edit-modal").classList.add("hidden");
    EDIT = null;
    renderCraft(false);
    save();
  }
  $("#btn-edit").addEventListener("click", openEditModal);
  $("#edit-close").addEventListener("click", () => { $("#edit-modal").classList.add("hidden"); EDIT = null; });
  $("#edit-modal").addEventListener("click", (e) => { if (e.target.id === "edit-modal") { $("#edit-modal").classList.add("hidden"); EDIT = null; } });

  /* ───────── 品质（催化剂，0.5）：仅戒指/项链 ───────── */
  // 12 种珠宝催化剂（poe2db 0.5）：上品质后匹配类别的词缀数值 ×(1+品质/100)，换类型替换
  const QCATS = {
    attribute: { zh: "属性", en: "Adaptive" },
    defences: { zh: "护甲/闪避/护盾", en: "Carapace" },
    life: { zh: "生命", en: "Flesh" },
    mana: { zh: "魔力", en: "Neural" },
    speed: { zh: "速度", en: "Skittering" },
    attack: { zh: "攻击", en: "Reaver" },
    caster: { zh: "施法", en: "Sibilant" },
    minion: { zh: "召唤", en: "Necrotic" },
    chaos: { zh: "混沌", en: "Chayula's" },
    lightning: { zh: "闪电", en: "Esh's" },
    cold: { zh: "冰霜", en: "Tul's" },
    fire: { zh: "火焰", en: "Xoph's" },
  };

  function setQuality(type, value, opts) {
    const o = opts || {};
    const max = o.vaal ? E.maxQualityOf(S.item) + 10 : E.maxQualityOf(S.item);
    const v = Math.max(0, Math.min(max, Math.round(value)));
    const prev = S.item.quality ? S.item.quality.value : 0;
    S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps, log: S.log.slice() });
    S.item = E.clone(S.item);
    S.item.quality = { type, value: v };
    S.steps++;
    if (v > prev) countUsage("catalyst", "催化剂 · " + (QCATS[type] ? QCATS[type].zh : type)); // 每次提升品质计 1 次催化剂用量
    S.log.push({ html: `<span class="l-t">催化剂 · ${QCATS[type] ? QCATS[type].zh : type}</span><br><span class="l-affix">品质 ${v}%（${o.vaal ? "超上限注入" : "上限 " + max + "%"}）—— 匹配词缀数值 ×${(1 + v / 100).toFixed(2)}</span>` });
    renderCraft(false);
    save();
  }

  function qualityAppliesTo(item) {
    return !!item && (item.classId === "Rings" || item.classId === "Amulets" || (item.classId || "").indexOf("Jewels") === 0);
  }

  function renderQuality() {
    const box = $("#q-box");
    if (!qualityAppliesTo(S.item)) { box.style.display = "none"; return; }
    box.style.display = "";
    const isJewel = (S.item.classId || "").indexOf("Jewels") === 0;
    const q = S.item.quality || { type: null, value: 0 };
    const max = E.maxQualityOf(S.item);
    const overMax = q.value > max;
    $("#q-cur").textContent = q.type
      ? `${QCATS[q.type] ? QCATS[q.type].zh : q.type} ${q.value}% / 上限 ${max}%${overMax ? "（超上限，保留已打品质）" : ""}`
      : (q.value > 0 ? `品质 ${q.value}% · 类型未知——选择催化剂类型后生效` : `未上催化剂 · 上限 ${max}%`);
    $("#q-body").innerHTML = `
      <select id="q-type">
        ${q.type ? "" : '<option value="">选择催化剂类型…</option>'}
        ${Object.entries(QCATS).map(([k, v]) => `<option value="${k}" ${q.type === k ? "selected" : ""}>${v.zh}${isJewel ? "（Refined）" : ""}（${v.en}${isJewel ? " Refined" : ""}）</option>`).join("")}
      </select>
      <div class="q-btns">
        <button data-d="-5">−5</button><button data-d="-1">−1</button>
        <button data-d="1">+1</button><button data-d="5">+5</button>
        <button data-d="max">拉满</button>
      </div>
      ${!isJewel ? `<button class="q-vaal" id="q-vaal" title="品质超上限 +1~10（总上限 ${max + 10}%），每次约 30% 概率腐化（官方未公布，近似值）；只能用于已达品质上限的物品">⚡ 瓦尔催化注入器（超上限，有腐化风险）</button>` : ""}`;
    $("#q-type").addEventListener("change", (e) => {
      if (!e.target.value) return;
      // 催化剂替换其他品质类型（数值保留）
      setQuality(e.target.value, q.value || 20);
    });
    $$(".q-btns button", $("#q-body")).forEach((b) => b.addEventListener("click", () => {
      if (!q.type) { toast("先选择催化剂类型", "warn"); return; }
      const v = b.dataset.d === "max" ? E.maxQualityOf(S.item) : (S.item.quality ? S.item.quality.value : 0) + +b.dataset.d;
      setQuality(q.type, v);
    }));
    const vaalBtn = $("#q-vaal");
    if (vaalBtn) vaalBtn.addEventListener("click", () => {
      const r = E.act(S.item, "vaalQuality", {}, E.defaultRng);
      if (!r.ok) { toast(r.reason, "warn"); return; }
      S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps, log: S.log.slice() });
      S.item = r.item;
      S.steps++;
      countUsage("vaal", "瓦尔催化注入器");
      const gain = r.events.find((e) => e.type === "quality").gain;
      const corrupted = r.events.some((e) => e.type === "corrupt");
      S.log.push({ html: `<span class="l-t">瓦尔催化注入器</span><br><span class="l-affix">品质 +${gain}% → ${r.item.quality.value}%${corrupted ? '</span><br><span class="l-rm">⛔ 物品被腐化！无法再使用通货</span>' : ""}</span>` });
      if (corrupted) toast("物品被腐化！无法再使用通货", "warn");
      renderCraft(true);
      save();
    });
  }

  /* ───────── 符文镶嵌（0.5 Augment 系统）─────────
   * 三类增幅物共用装备的增幅器插槽：
   * ① 基础符文（元素/属性/守望等家族，低阶/中阶/高阶/完美品级）——按部位给固定加成；
   * ② 魂核（限定部位，每件限 1）；
   * ③ 特殊符文（Runes of Aldur，每件限 1）：瑟尔的凯旋 +1 允许后缀；阿斯特丽德的创造 +1 工艺词缀上限；
   *    六颗部位符文解锁专属词缀池（塑时术师/神射手/盛怒/毁灭/灵魂/腐蚀）。
   * 巧匠石可为武器/护甲 +1 插槽（每件 1 次）。 */
  const TIER_ZH = { lesser: "次级", normal: "标准", greater: "高级", perfect: "完美" };
  const TIER_ORDER = ["lesser", "normal", "greater", "perfect"];
  const augIcon = (id) => {
    const p = asset("augments", id);
    return p ? `<img class="game-icon" src="${p}" alt="" draggable="false" style="width:20px;height:20px">` : "";
  };
  function runeFamilies() {
    /* 基础符文按家族分组（id 去掉品级前缀），只保留当前物品可镶嵌的家族 */
    const fams = new Map();
    for (const r of E.AUGM.runes) {
      const fam = r.id.replace(/^(Lesser|Greater|Perfect)_/, "");
      if (!fams.has(fam)) fams.set(fam, {});
      fams.get(fam)[r.tier] = r;
    }
    return [...fams.entries()]
      .map(([fam, tiers]) => ({ fam, tiers, ok: Object.values(tiers).some((r) => !E.augmentApplicable(S.item, r)) }))
      .filter((f) => f.ok);
  }
  function familyEffectTooltip(tiers) {
    const lines = [];
    for (const t of TIER_ORDER) {
      const r = tiers[t];
      if (!r) continue;
      const fx = E.augmentEffectFor(S.item, r);
      if (!fx) continue;
      lines.push(`【${TIER_ZH[t]}】${fx.textZh}（≈${r.price} 崇）`);
      if (r.bonded) for (const b of r.bonded) if (b.targets.includes(S.item.classId)) lines.push(`　羁绊：${b.textZh}`);
    }
    return lines.join("\n");
  }
  function renderRunes() {
    const box = $("#rune-box");
    if (!S.item || E.runeSlotsOf(S.item) === 0) { box.style.display = "none"; return; }
    box.style.display = "";
    const slots = E.runeSlotsOf(S.item);
    const socketedRunes = S.item.runes || [];
    const socketedAugs = S.item.augments || [];
    const artificerOk = !S.item.socketsBonus && !(["Rings", "Amulets", "Belts"].includes(S.item.classId));
    $("#rune-cur").innerHTML = `· 插槽 ${socketedRunes.length + socketedAugs.length}/${slots}` +
      (S.item.socketsBonus ? ' <span class="hint">（含巧匠石 +1）</span>' : "") +
      (artificerOk ? ` <button class="mini-btn" id="artificer-btn" title="为武器/护甲增加 1 个增幅器插槽（每件限一次，≈3 崇）">⚒ 巧匠石 +1 插槽</button>` : "");
    const artBtn = $("#artificer-btn");
    if (artBtn) artBtn.addEventListener("click", applyArtificer);

    const html = [];
    /* 基础符文（家族分组 + 品级选择） */
    const fams = runeFamilies();
    if (fams.length) {
      const selTier = S.runeTier || "normal";
      const tierBtns = TIER_ORDER.map((t) => `<button class="tier-chip ${selTier === t ? "on" : ""}" data-tier="${t}">${TIER_ZH[t]}</button>`).join("");
      html.push(`<div class="aug-head"><span>基础符文</span><span class="tier-row">${tierBtns}</span></div><div class="aug-grid">`);
      for (const f of fams) {
        const want = f.tiers[selTier] ? selTier : TIER_ORDER.slice().reverse().find((t) => f.tiers[t]);
        const r = f.tiers[want];
        const on = socketedAugs.some((id) => id.replace(/^(Lesser|Greater|Perfect)_/, "") === f.fam) ? "on" : "";
        const famZh = (f.tiers.normal || Object.values(f.tiers)[0]).zh.replace(/^(低阶|高阶|完美)/, "");
        html.push(`<button class="omen-chip ${on}" data-fam="${f.fam}" data-tier="${want}" title="${esc(familyEffectTooltip(f.tiers))}">${on ? "✓ " : ""}${augIcon(r.id)}${famZh}<span class="tier-mark">${TIER_ZH[want]}</span></button>`);
      }
      html.push("</div>");
    }
    /* 魂核 */
    const cores = E.AUGM.soulCores.filter((c) => !E.augmentApplicable(S.item, c));
    if (cores.length) {
      html.push(`<div class="aug-head"><span>魂核${["Helmets", "Body_Armours", "Boots", "Gloves"].includes(S.item.classId) ? "（限定部位，每件限 1）" : ""}</span></div><div class="aug-grid">`);
      for (const c of cores) {
        const on = socketedAugs.includes(c.id) ? "on" : "";
        const fx = E.augmentEffectFor(S.item, c);
        html.push(`<button class="omen-chip ${on}" data-aug="${c.id}" title="${esc(fx ? fx.textZh + `（≈${c.price} 崇）` : c.zh)}${c.limited ? "；每件限 1" : ""}">${on ? "✓ " : ""}${augIcon(c.id)}${c.zh}</button>`);
      }
      html.push("</div>");
    }
    /* 特殊符文（Runes of Aldur） */
    const specials = E.ALDUR.runes.filter((r) => !E.runeApplicable(S.item, r));
    if (specials.length) {
      html.push(`<div class="aug-head"><span>特殊符文（Runes of Aldur）</span></div><div class="aug-grid">`);
      for (const r of specials) {
        const on = socketedRunes.includes(r.id) ? "on" : "";
        const rIco = asset("runes", r.id) ? `<img class="game-icon" src="${asset("runes", r.id)}" alt="" draggable="false" style="width:20px;height:20px">` : "";
        html.push(`<button class="omen-chip ${on}" data-rune="${r.id}" title="${esc(r.desc)}${r.bonded ? "；羁绊（需对应升华）：" + r.bonded : ""}（≈${r.price} 崇）">${on ? "✓ " : ""}${rIco}${r.zh}</button>`);
      }
      html.push("</div>");
    }
    $("#rune-list").innerHTML = html.join("");
    $$("#rune-list .omen-chip[data-rune]").forEach((b) => b.addEventListener("click", () => toggleRune(b.dataset.rune)));
    $$("#rune-list .omen-chip[data-aug]").forEach((b) => b.addEventListener("click", () => toggleAugment(b.dataset.aug)));
    $$("#rune-list .omen-chip[data-fam]").forEach((b) => b.addEventListener("click", () => toggleAugmentFamily(b.dataset.fam, b.dataset.tier)));
    $$(".tier-chip").forEach((b) => b.addEventListener("click", () => { S.runeTier = b.dataset.tier; renderRunes(); }));
  }
  function applyAugmentResult(r, zhName, actionZh, kind) {
    S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps, log: S.log.slice() });
    S.item = r.item;
    S.steps++;
    countUsage(kind || "augment", zhName);
    S.log.push({ html: `<span class="l-cost">≈${fmtC(r.cost)} 崇</span><span class="l-t">增幅器 · ${zhName}${actionZh}</span>` });
    renderCraft(true);
    save();
  }
  function toggleAugment(augId) {
    const aug = E.augmentById.get(augId);
    if (!aug) return;
    const socketed = (S.item.augments || []).includes(augId);
    const r = socketed ? E.unsocketAugment(S.item, augId) : E.socketAugment(S.item, augId);
    if (!r.ok) { toast(r.reason, "warn"); return; }
    applyAugmentResult(r, aug.zh, socketed ? "（取下）" : "（镶嵌）");
  }
  function toggleAugmentFamily(fam, tier) {
    const socketedIds = (S.item.augments || []).filter((id) => id.replace(/^(Lesser|Greater|Perfect)_/, "") === fam);
    if (socketedIds.length) {
      let item = S.item;
      for (const id of socketedIds) { const r = E.unsocketAugment(item, id); if (r.ok) { item = r.item; } }
      S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps, log: S.log.slice() });
      S.item = item;
      countUsage("augment", "取下 · " + fam);
      S.log.push({ html: `<span class="l-t">增幅器 · 取下 ${esc(fam)} 家族符文</span>` });
      renderCraft(true);
      save();
      return;
    }
    /* data-tier 由 renderRunes 兜底为该家族实际存在的品级 */
    const pfx = { lesser: "Lesser_", normal: "", greater: "Greater_", perfect: "Perfect_" }[tier] || "";
    const id = pfx + fam;
    const aug = E.augmentById.get(id);
    if (!aug) { toast("该品级不存在", "warn"); return; }
    const r = E.socketAugment(S.item, id);
    if (!r.ok) { toast(r.reason, "warn"); return; }
    applyAugmentResult(r, aug.zh, "（镶嵌）");
  }
  function applyArtificer() {
    const r = E.addSocket(S.item);
    if (!r.ok) { toast(r.reason, "warn"); return; }
    applyAugmentResult(r, "巧匠石", "（+1 插槽）", "artificer");
  }
  function toggleRune(runeId) {
    const rune = E.runeById.get(runeId);
    if (!rune) return;
    const socketed = (S.item.runes || []).includes(runeId);
    const r = socketed ? E.unsocketRune(S.item, runeId) : E.socketRune(S.item, runeId);
    if (!r.ok) { toast(r.reason, "warn"); return; }
    S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps, log: S.log.slice() });
    S.item = r.item;
    S.steps++;
    countUsage("rune", (socketed ? "取下 · " : "") + rune.zh);
    S.log.push({ html: `<span class="l-cost">≈${fmtC(r.cost)} 崇</span><span class="l-t">符文 · ${rune.zh}${socketed ? "（取下）" : "（镶嵌）"}</span><br><span class="l-affix">${rune.desc}${rune.bonded && !socketed ? " · 羁绊：" + rune.bonded : ""}</span>` });
    renderCraft(true);
    save();
  }

  /* ───────── 蒸馏情感（谵妄，0.5）─────────
   * 对稀有基础/时逝珠宝：移除一条随机词缀，附加一条保证的工艺词缀（按情感 × 珠宝颜色）。 */
  function renderLiquid() {
    const box = $("#liquid-box");
    const isJewel = S.item && (S.item.classId || "").indexOf("Jewels") === 0;
    if (!isJewel) { box.style.display = "none"; return; }
    box.style.display = "";
    const n = S.item.affixes.filter((a) => a.source === "liquid").length;
    const cap = E.liquidCapOf(S.item);
    const tl = E.isTimeLostJewel(S.item);
    $("#liquid-body").innerHTML = `
      <button class="q-breach" id="liq-open" title="移除一条随机词缀并附加保证的工艺词缀（工艺词缀上限 ${cap} 条）">◈ 使用蒸馏情感${tl ? "（时逝）" : ""}（工艺词缀 ${n}/${cap}）</button>`;
    $("#liq-open").addEventListener("click", openLiquidModal);
  }
function openLiquidModal() {
    const tl = E.isTimeLostJewel(S.item);
    const color = E.jewelColorOf(S.item);
    const colorZh = { ruby: "红玉", sapphire: "蓝玉", emerald: "翡翠", diamond: "宝钻" }[color] || "";
    const list = E.ALDUR.liquid.filter((e) => (e.target === "timelost") === tl);
    $("#liquid-title").textContent = `蒸馏情感 · ${tl ? "远古（时逝珠宝）" : "普通（基础珠宝）"}`;
    $("#liquid-hint").textContent = `当前珠宝颜色：${colorZh} —— 使用后移除一条随机词缀，并附加该情感的保证词缀（≈价格见按钮）`;
    const grid = $("#liquid-grid");
    grid.innerHTML = list.map((e) => {
      const aff = e.affixes[color];
      const affS = e.affixes[color + "S"];
      const affTxt = (a) => a ? `${a.type === "prefix" ? "前缀" : "后缀"} · ${I18N.fmt(a.textZh || a.text, a.ranges.map((r) => r[1]))}` : "";
      // 凶暴/轻蔑提供前后缀两个变体；其余情感每颜色只有单一词缀（按其类型附加）
      const btn = (a, variant) => a
        ? `<button data-emotion="${e.id}" data-variant="${variant}" title="作为${a.type === "prefix" ? "前缀" : "后缀"}附加">${a.type === "prefix" ? "前缀" : "后缀"}</button>`
        : "";
      return `
      <div class="essence-item">
        ${liquidIconOf(e.id)}
        <div class="e-info">
          <div class="e-name">${esc(e.zh)} <span style="font-size:11px;color:var(--text-faint)">${esc(e.en)}${e.area ? " · " + esc(e.area) : ""}</span></div>
          <div class="e-mod">${esc(affTxt(aff))}</div>
          ${affS ? `<div class="e-mod">${esc(affTxt(affS))}</div>` : ""}
        </div>
        <div class="e-tiers">
          ${btn(aff, "prefix")}${btn(affS, "suffix")}
        </div>
      </div>`;
    }).join("");
    $("#liquid-modal").classList.remove("hidden");
    $$(".e-tiers button", grid).forEach((b) => b.addEventListener("click", () => useLiquid(b.dataset.emotion, b.dataset.variant)));
  }
  /* 珠宝情感旧 id → 0.5 图标清单 id（稀释低档改名 Diluted Liquid；远古 Timelost 变体图标在 anointEmotions/Ancient_*） */
  function liquidIconOf(id) {
    const aliased = { Liquid_Greed: "Diluted_Liquid_Greed", Liquid_Ire: "Diluted_Liquid_Ire", Liquid_Guilt: "Diluted_Liquid_Guilt" }[id] || id;
    const p = asset("anointEmotions", aliased);
    if (p) return `<img class="game-icon" src="${p}" alt="" draggable="false" style="width:26px;height:26px">`;
    return `<span class="usage-ico liq-ico">◈</span>`;
  }
  function useLiquid(emotionId, variant) {
    const e = E.liquidById.get(emotionId);
    const r = E.act(S.item, "liquidEmotion", { emotion: emotionId, variant }, E.defaultRng);
    if (!r.ok) { toast(r.reason, "warn"); return; }
    $("#liquid-modal").classList.add("hidden");
    S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps, log: S.log.slice() });
    S.item = r.item;
    S.steps++;
    countUsage("liquid", e.zh);
    const parts = [];
    for (const ev of r.events) {
      if (ev.type === "add") parts.push(`<span class="l-affix">+ ${renderAffixText(ev.affix, true)}</span>`);
      if (ev.type === "remove") parts.push(`<span class="l-rm">− ${renderAffixText(ev.affix, true)}</span>`);
    }
    S.log.push({ html: `<span class="l-cost">≈${fmtC(r.cost)} 崇</span><span class="l-t">蒸馏情感 · ${e.zh}</span><br>${parts.join("<br>")}` });
    targetHitToast(r.events);
    renderCraft(true);
    save();
  }
  $("#liquid-close").addEventListener("click", () => $("#liquid-modal").classList.add("hidden"));
  $("#liquid-modal").addEventListener("click", (e) => { if (e.target.id === "liquid-modal") $("#liquid-modal").classList.add("hidden"); });

  /* ───────── 分类标签切换（通货/精华/合金/涂油/符文/预兆/深渊/裂隙） ───────── */
  $("#cat-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-cat]");
    if (!b) return;
    S.curTab = b.dataset.cat;
    $$("#cat-tabs button").forEach((x) => x.classList.toggle("on", x === b));
    $$(".cat-pane").forEach((p) => p.classList.toggle("hidden", p.id !== "cat-" + S.curTab));
  });

  /* ───────── 合金（0.5 Verisium 残迹）─────────
   * 稀有物品：移除一条随机词缀，附加该合金对当前部位的保证词缀（前缀/后缀按表固定）。 */
  // 模板 + 数值区间 → 预览文本："攻速提高 #%" + [[7,9]] → "攻速提高 7–9%"
  function fmtRangeText(tpl, ranges) {
    let i = 0;
    return String(tpl).replace(/#/g, () => { const r = ranges[i++] || [1, 1]; return r[0] === r[1] ? String(r[0]) : r[0] + "–" + r[1]; });
  }
  function renderAlloys() {
    const wrap = $("#alloy-list");
    if (!S.item) { wrap.innerHTML = `<p class="cat-hint">先在上方选择基底</p>`; return; }
    const clsZh = (E.classById.get(S.item.classId) || {}).zh || S.item.classId;
    wrap.innerHTML = [...E.alloyById.values()].map((a) => {
      const ico = asset("alloys", a.id)
        ? `<img class="game-icon alloy-ico-img" src="${asset("alloys", a.id)}" alt="" draggable="false" style="width:34px;height:34px">`
        : `<span class="usage-ico alloy-ico" style="font-size:22px">⬢</span>`;
      const idx = E.alloyModFor(S.item, a);
      const usable = E.alloyClassZh(a) || "—";
      if (idx < 0) {
        return `<div class="alloy-card na" title="可用于：${esc(usable)}">
          ${ico}
          <span class="al-body">
            <div class="al-name">${esc(a.zh)}</div>
            <div class="al-mod">不适用于${esc(clsZh)}（可用于：${esc(usable)}）</div>
          </span>
        </div>`;
      }
      const mod = a.mods[idx];
      const probe = E.act(S.item, "alloy", { alloy: a.id }, E.makeRng(1));
      return `<button class="alloy-card" data-alloy="${a.id}" ${probe.ok ? "" : "disabled"}
        title="${probe.ok ? "移除一条随机词缀，附加：" + esc(fmtRangeText(mod.textZh || mod.text, mod.ranges)) + "（≈" + a.price + " 崇）" : esc(probe.reason)}">
        ${ico}
        <span class="al-body">
          <div class="al-name">${esc(a.zh)}<span class="al-price">≈${a.price} 崇</span></div>
          <div class="al-mod"><span class="affix-tag ${mod.type === "prefix" ? "p" : "s"}">${mod.type === "prefix" ? "前缀" : "后缀"}</span>${esc(fmtRangeText(mod.textZh || mod.text, mod.ranges))}</div>
          ${probe.ok ? "" : `<div class="al-reason">${esc(probe.reason)}</div>`}
        </span>
      </button>`;
    }).join("");
    $$("button.alloy-card", wrap).forEach((b) => b.addEventListener("click", () => useAlloy(b.dataset.alloy)));
  }
  function useAlloy(alloyId) {
    const a = E.alloyById.get(alloyId);
    if (!a) return;
    const r = E.act(S.item, "alloy", { alloy: alloyId }, E.defaultRng);
    if (!r.ok) { toast(r.reason, "warn"); return; }
    S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps, log: S.log.slice() });
    S.item = r.item;
    S.steps++;
    countUsage("alloy", a.zh);
    const parts = [];
    for (const ev of r.events) {
      if (ev.type === "add") parts.push(`<span class="l-affix">+ ${renderAffixText(ev.affix, true)}</span>`);
      if (ev.type === "remove") parts.push(`<span class="l-rm">− ${renderAffixText(ev.affix, true)}</span>`);
    }
    S.log.push({ html: `<span class="l-cost">≈${fmtC(r.cost)} 崇</span><span class="l-t">合金 · ${a.zh}</span><br>${parts.join("<br>")}` });
    targetHitToast(r.events);
    renderCraft(true);
    save();
  }

  /* ───────── 涂油注入（0.5 枯萎之树）─────────
   * 游戏式界面：情感托盘 + 3 个油槽（顺序即配方顺序）。填满 3 格后查找对应专精，
   * 组合存在则显示结果与效果（可注入），组合不存在则不显示任何内容。
   * 附魔不占词缀位、可覆盖；下方保留 874 条配方搜索浏览。 */
  let anointLimit = 40; // 搜索列表渲染条数上限（全量 874 条 DOM 过重，分页加载）
  let anointSlots = [null, null, null]; // 3 个油槽中的情感 id（有序）
  function emotionShort(id) {
    const e = E.anointEmotionById.get(id);
    if (!e) return id;
    const base = (e.zh || e.en || id).replace(/^(浓缩的|强效的|稀释的)液化/, "").replace(/^液化/, "");
    const mark = e.tier === "diluted" ? "稀" : e.tier === "potent" ? "浓" : "";
    return (mark ? mark + "·" : "") + base;
  }
  function emotionIco(id, size) {
    const p = asset("anointEmotions", id);
    if (p) return `<img class="game-icon" src="${p}" alt="" draggable="false" style="width:${size}px;height:${size}px">`;
    return `<span class="emo-fallback" style="width:${size}px;height:${size}px">${esc(emotionShort(id))}</span>`;
  }
  function emotionChip(id) {
    return `<span class="emo-chip">${emotionIco(id, 16)}<span>${esc(emotionShort(id))}</span></span>`;
  }
  function anointCostOf(n) {
    return n.emotions.reduce((s, id) => s + ((E.anointEmotionById.get(id) || {}).price || 0), 0);
  }
  function renderAnointTab() {
    const wrapCur = $("#anoint-current");
    // 珠宝上下文：隐藏项链专属的油槽/配方浏览，蒸馏情感面板已提到最前
    const isJewel = S.item && (S.item.classId || "").indexOf("Jewels") === 0;
    const togglable = [$("#an-game"), $("#an-browse-head"), $("#anoint-search"), $("#anoint-list"), $("#anoint-more")];
    for (const el of togglable) el.classList.toggle("hidden", !!isJewel);
    if (!S.item) { wrapCur.innerHTML = `<p class="cat-hint">先在上方选择基底</p>`; }
    else if (isJewel) {
      wrapCur.innerHTML = `<p class="cat-hint">稀有珠宝用<b>单种</b>液体情感直接附加保证词缀 —— 点下方「使用蒸馏情感」选择（普通情感 → 基础珠宝 / 远古情感 → 时逝珠宝；<b>强效轻蔑</b>即 +1 允许前缀/后缀）</p>`;
    } else if (S.item.classId !== "Amulets") {
      const clsZh = (E.classById.get(S.item.classId) || {}).zh || "";
      wrapCur.innerHTML = `<p class="cat-hint">涂油注入只能作用于项链 —— 当前是${esc(clsZh)}（油槽仍可组合预览）</p>`;
    } else {
      const cur = S.item.anoint ? E.anointBySlug.get(S.item.anoint.slug) : null;
      wrapCur.innerHTML = cur
        ? `<div class="anoint-cur">✦ 当前涂油：<b>${esc(cur.nameZh || cur.name)}</b><br><span class="an-stats">${esc((cur.statsZh || cur.stats).split("\n").join(" · "))}</span><br><span class="an-emo">${cur.emotions.map(emotionChip).join(" → ")}</span><small>（重新涂油将覆盖）</small></div>`
        : `<p class="cat-hint">尚未涂油 —— 在下方油槽中放入 3 种情感，或搜索浏览配方</p>`;
    }
    renderAnointGame();
    renderAnointList();
  }
  /* 油槽 + 情感托盘 + 结果区（组合不存在时结果区保持空白） */
  function renderAnointGame() {
    const slotsBox = $("#an-slots");
    slotsBox.innerHTML = anointSlots.map((id, i) => {
      if (!id) return `<button class="an-slot" data-i="${i}" title="第 ${i + 1} 格 —— 点击情感填入，点此清空">${i + 1}</button>`;
      const e = E.anointEmotionById.get(id);
      return `<button class="an-slot filled" data-i="${i}" title="第 ${i + 1} 格：${esc((e && e.zh) || id)} —— 点击清空">${emotionIco(id, 30)}<span>${esc(emotionShort(id))}</span></button>`;
    }).join("");
    $$("#an-slots .an-slot").forEach((b) => b.addEventListener("click", () => {
      anointSlots[+b.dataset.i] = null;
      renderAnointGame();
    }));
    const tray = $("#an-tray");
    tray.innerHTML = [...E.anointEmotionById.values()].map((e) => `
      <button class="an-emo-btn" data-eid="${e.id}" title="${esc(e.zh || e.en)} ≈${e.price} 崇">
        ${emotionIco(e.id, 26)}<span>${esc(emotionShort(e.id))}</span>
      </button>`).join("");
    $$("#an-tray .an-emo-btn").forEach((b) => b.addEventListener("click", () => {
      const slot = anointSlots.indexOf(null);
      if (slot < 0) { toast("3 个油槽已满 —— 点击油槽清空后重新组合", "info"); return; }
      anointSlots[slot] = b.dataset.eid;
      renderAnointGame();
    }));
    // 结果区：3 格填满且组合存在才显示
    const res = $("#an-result");
    if (anointSlots[0] && anointSlots[1] && anointSlots[2]) {
      const n = E.anointByCombo.get(anointSlots.join("|"));
      if (n) {
        const ok = S.item && S.item.classId === "Amulets";
        res.innerHTML = `<div class="anoint-result">
          <div class="an-name">${esc(n.nameZh || n.name)} <span class="an-en">${esc(n.name)}</span></div>
          <div class="an-stats">${esc((n.statsZh || n.stats).split("\n").join(" · "))}</div>
          <div class="an-emo">${n.emotions.map(emotionChip).join(" → ")}</div>
          <div class="an-rbtns">
            <button class="an-go" data-slug="${n.slug}" ${ok ? "" : "disabled"} title="${ok ? "消耗 3 种液体情感 ≈" + anointCostOf(n) + " 崇（覆盖现有涂油）" : "涂油只能用于项链"}">涂油注入<small>≈${anointCostOf(n)}崇</small></button>
            <button class="an-clear">清空</button>
          </div>
        </div>`;
        const go = res.querySelector(".an-go[data-slug]");
        if (go && ok) go.addEventListener("click", () => useAnoint(n.slug));
        res.querySelector(".an-clear").addEventListener("click", () => { anointSlots = [null, null, null]; renderAnointGame(); });
        return;
      }
    }
    res.innerHTML = "";
  }
  function anointMatches(n, q) {
    if (!q) return true;
    return (n.nameZh || "").includes(q) || (n.name || "").toLowerCase().includes(q)
      || (n.statsZh || "").includes(q) || (n.stats || "").toLowerCase().includes(q);
  }
  function renderAnointList() {
    const q = ($("#anoint-search").value || "").trim().toLowerCase();
    const filtered = [...E.anointBySlug.values()].filter((n) => anointMatches(n, q));
    const shown = filtered.slice(0, anointLimit);
    const ok = S.item && S.item.classId === "Amulets";
    $("#anoint-list").innerHTML = shown.map((n) => `
      <div class="anoint-item ${ok ? "" : "na"}">
        <div class="an-info">
          <div class="an-name">${esc(n.nameZh || n.name)} <span class="an-en">${esc(n.name)}</span></div>
          <div class="an-stats">${esc((n.statsZh || n.stats).split("\n")[0])}</div>
          <div class="an-emo">${n.emotions.map(emotionChip).join(" → ")}</div>
        </div>
        <button class="an-go" data-slug="${n.slug}" ${ok ? "" : "disabled"}
          title="${ok ? "消耗 3 种液体情感 ≈" + anointCostOf(n) + " 崇（覆盖现有涂油）" : "涂油只能用于项链"}">涂油<small>≈${anointCostOf(n)}崇</small></button>
      </div>`).join("") || `<p class="cat-hint">没有匹配的专精天赋</p>`;
    $("#anoint-more").innerHTML = filtered.length > anointLimit
      ? `<button id="anoint-more-btn" class="mini">显示更多（${shown.length}/${filtered.length}）</button>` : "";
    const more = $("#anoint-more-btn");
    if (more) more.addEventListener("click", () => { anointLimit += 60; renderAnointList(); });
    $$(".an-go[data-slug]", $("#anoint-list")).forEach((b) => b.addEventListener("click", () => useAnoint(b.dataset.slug)));
  }
  function useAnoint(slug) {
    const n = E.anointBySlug.get(slug);
    if (!n) return;
    const r = E.act(S.item, "instill", { slug }, E.defaultRng);
    if (!r.ok) { toast(r.reason, "warn"); return; }
    S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps, log: S.log.slice() });
    S.item = r.item;
    S.steps++;
    anointSlots = [null, null, null]; // 注入成功清空油槽（贴游戏操作习惯）
    countUsage("anoint", "涂油 · " + (n.nameZh || n.name));
    S.log.push({ html: `<span class="l-cost">≈${fmtC(r.cost)} 崇</span><span class="l-t">涂油注入 · ${esc(n.nameZh || n.name)}${r.events[0].replaced ? "（覆盖旧涂油）" : ""}</span><br><span class="l-affix">✦ ${(n.statsZh || n.stats).split("\n").join(" · ")}</span>` });
    renderCraft(true);
    save();
  }
  $("#anoint-search").addEventListener("input", () => { anointLimit = 40; renderAnointList(); });

  /* ───────── 裂隙标签页 ─────────
   * 裂隙精华（稀有戒指/项链品质上限 +20）+ 创世树独占基底入口提示。 */
  function renderBreachTab() {
    const wrap = $("#breach-list");
    if (!S.item) { wrap.innerHTML = `<p class="cat-hint">先在上方选择基底</p>`; return; }
    const probe = E.act(S.item, "breachEssence", {}, E.makeRng(1));
    wrap.innerHTML = `
      <button class="cur-btn" id="breach-btn" ${probe.ok ? "" : "disabled"}
        title="${esc(probe.ok ? "移除一条随机词缀，并添加保底前缀「品质上限 +20%」" : probe.reason)}">
        <span class="usage-ico" style="font-size:24px">☠</span>
        <span class="cur-info">
          <span class="cur-name">裂隙精华</span>
          <span class="cur-desc">${esc(probe.ok ? "移除一条随机词缀，添加保底前缀「品质上限 +20%」（稀有戒指/项链）" : probe.reason)}</span>
        </span>
      </button>
      <div class="breach-hint">⟡ 创世树（裂隙）：Hiveblood 浇灌的独占戒指/护身符基底在「选择基底」步骤中以 <span class="gen-tag">创世</span> 标签出现，自带裂隙独占词缀池。</div>`;
    const btn = $("#breach-btn");
    if (btn && probe.ok) btn.addEventListener("click", () => {
      const r = E.act(S.item, "breachEssence", {}, E.defaultRng);
      if (!r.ok) { toast(r.reason, "warn"); return; }
      S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps, log: S.log.slice() });
      S.item = r.item;
      S.steps++;
      countUsage("breach", "裂隙精华");
      S.log.push({ html: `<span class="l-t">裂隙精华</span><br><span class="l-rm">− ${renderAffixText(r.events[0].affix, true)}</span><br><span class="l-affix">+ 品质上限 +20%（现上限 ${E.maxQualityOf(r.item)}%）</span>` });
      renderCraft(true);
      save();
    });
  }

  function useEssence(name, tier) {
    const omenId = S.omens.essence || null;
    const r = E.act(S.item, "essence", { essence: name, tier, omen: omenId });
    if (!r.ok) { toast(r.reason); return; }
    $("#essence-modal").classList.add("hidden");
    S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps, log: S.log.slice() });
    S.item = r.item;

    S.steps++;
    countUsage("essence", (ESSENCE_ZH[name] || name) + ESSENCE_TIER_ZH[tier] + "精华", { name: name.replace(" ", "_") });
    if (omenId) countUsage("omen", OMEN_ZH[omenId][0], { oid: omenId });
    const zhName = (ESSENCE_ZH[name] || name) + ESSENCE_TIER_ZH[tier] + "精华";
    const parts = [];
    for (const ev of r.events) {
      if (ev.type === "add") parts.push(`<span class="l-affix">+ ${renderAffixText(ev.affix, true)}</span>`);
      if (ev.type === "remove") parts.push(`<span class="l-rm">− ${renderAffixText(ev.affix, true)}</span>`);
    }
    S.log.push({ html: `<span class="l-cost">≈${fmtC(r.cost)} 崇</span><span class="l-t">${zhName}${omenId ? " · " + OMEN_ZH[omenId][0] : ""}</span><br>${parts.join("<br>")}` });
    renderCraft(true);
    save();
  }
  $("#fv-x").addEventListener("click", () => { $("#foresee-modal").classList.add("hidden"); toast("已放弃预示结果（不消耗通货）", "info"); });
  $("#essence-close").addEventListener("click", () => $("#essence-modal").classList.add("hidden"));
  $("#essence-modal").addEventListener("click", (e) => { if (e.target.id === "essence-modal") $("#essence-modal").classList.add("hidden"); });

  /* ───────── 预示弹窗（辛格拉的发辫） ───────── */
  function openForeseeModal(cur, opts, result) {
    const m = CUR_META[cur];
    const parts = [];
    for (const ev of result.events) {
      if (ev.type === "add") parts.push(`<div class="fv-line add">+ ${renderAffixText(ev.affix)}</div>`);
      if (ev.type === "remove") parts.push(`<div class="fv-line rm">− ${renderAffixText(ev.affix)}</div>`);
      if (ev.type === "reroll") parts.push(`<div class="fv-line add">↻ 重掷 ${ev.affixes.length} 条词缀数值</div>`);
    }
    const el = $("#foresee-modal");
    $("#foresee-title").innerHTML = `${curIcon(cur, 34)} 预示：${m.zh}`;
    $("#foresee-body").innerHTML = parts.join("") ||
      `<div class="fv-line">（本次使用不会改变词缀）</div>`;
    el.classList.remove("hidden");
    const applyBtn = $("#fv-apply"), cancelBtn = $("#fv-cancel");
    const cleanup = () => { el.classList.add("hidden"); applyBtn.onclick = cancelBtn.onclick = null; };
    applyBtn.onclick = () => {
      cleanup();
      S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps });
      S.item = result.item;
      S.item.foresee = false;
      S.steps++;
      countUsage(cur, usageLabel(cur));
      const om2 = omenListOf(cur)[0] || null;
      if (om2) countUsage("omen", OMEN_ZH[om2][0], { oid: om2 });
      addLog(cur, result, m.zh + "（预示·应用）");
      renderCraft(true); save();
      toast("已按预示结果应用", "info");
    };
    cancelBtn.onclick = () => {
      cleanup();
      toast("已放弃预示结果（不消耗" + m.zh + "）", "info");
    };
  }

  /* ───────── 做装目标（wishlist） ───────── */
  function targetPool() {
    const pk = E.poolKeyOf ? E.poolKeyOf(S.item) : S.classId;
    const pool = E.poolsByClass[pk];
    const map = new Map();
    if (!pool) return map;
    for (const src of ["normal", "desecrated"]) {
      const p = pool[src];
      if (!p) continue;
      for (const t of ["prefixes", "suffixes"]) for (const mod of p[t]) map.set(mod.id, mod);
    }
    // 符文解锁池与创世树独占池（当前物品可 roll 的附加来源）
    if (E.extraPoolsOf) {
      for (const ep of E.extraPoolsOf(S.item)) {
        for (const t of ["prefixes", "suffixes"]) for (const mod of ep[t]) map.set(mod.id, mod);
      }
    }
    return map;
  }
  function modSearchText(mod) {
    const zh = I18N.modTextZh(mod, mod.tiers.map((x) => x.ranges[0][0]));
    return (zh + " " + mod.text).toLowerCase();
  }
  function renderTargetSuggest(q) {
    const box = $("#target-suggest");
    if (!q) { box.innerHTML = ""; return; }
    const pool = targetPool();
    const hits = [...pool.values()]
      .filter((m) => modSearchText(m).includes(q))
      .slice(0, 6);
    box.innerHTML = hits.map((m) =>
      `<button data-mid="${m.id}">${esc(I18N.modTextZh(m, m.tiers.map((x) => x.ranges[0][0])).split("\n")[0])}</button>`
    ).join("");
    $$("button", box).forEach((b) => b.addEventListener("click", () => {
      addTarget(b.dataset.mid);
      $("#target-input").value = ""; renderTargetSuggest("");
    }));
  }
  function addTarget(modId) {
    const pool = targetPool();
    if (!pool.has(modId)) return;
    if (S.targets.includes(modId)) return;
    S.targets.push(modId);
    renderTargets();
    toast("已加入目标", "info");
    save();
  }
  function removeTarget(modId) {
    S.targets = S.targets.filter((x) => x !== modId);
    renderTargets();
    renderCard(false);
    save();
  }
  function renderTargets() {
    const pool = targetPool();
    // 清理已不在池中的目标
    S.targets = S.targets.filter((id) => pool.has(id));
    const box = $("#target-chips");
    box.innerHTML = S.targets.map((id) => {
      const m = pool.get(id);
      if (!m) return "";
      const zh = I18N.modTextZh(m, m.tiers.map((x) => x.ranges[0][0])).split("\n")[0];
      return `<span class="t-chip">${esc(zh)}<button data-mid="${id}">✕</button></span>`;
    }).join("");
    $$(".t-chip button", box).forEach((b) => b.addEventListener("click", () => removeTarget(b.dataset.mid)));
    $("#target-hint").textContent = S.targets.length ? `已设 ${S.targets.length} 个目标` : "命中目标会高亮并提示";
  }
  $("#target-input").addEventListener("input", (e) => renderTargetSuggest(e.target.value.trim().toLowerCase()));
  $("#target-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const q = e.target.value.trim().toLowerCase();
      if (!q) return;
      const pool = targetPool();
      const hit = [...pool.values()].find((m) => modSearchText(m).includes(q));
      if (hit) { addTarget(hit.id); e.target.value = ""; renderTargetSuggest(""); }
    }
  });
  function targetHitToast(events) {
    const pool = targetPool();
    const hit = (events || []).find((ev) => ev.type === "add" && S.targets.includes(ev.affix.modId));
    if (hit && pool.has(hit.affix.modId)) {
      const m = pool.get(hit.affix.modId);
      toast("🎯 达成目标：" + I18N.modTextZh(m, hit.affix.values).split("\n")[0], "");
    }
  }

  /* ───────── 其他控件 ───────── */
  $("#btn-apply").addEventListener("click", () => {
    if (S.selCur) useCurrency(S.selCur);
  });
  $("#btn-back-category").addEventListener("click", () => nav("screen-category"));
  $("#btn-back-base").addEventListener("click", () => {
    const cat = categoryOf(S.classId);
    // 单类目大类（项链/戒指）没有中间类型页，直接回分类页
    nav(cat && cat.classes.length > 1 ? "screen-class" : "screen-category");
  });
  $("#tier-switch").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tier]");
    if (!b) return;
    S.tier = b.dataset.tier;
    $$("#tier-switch button").forEach((x) => x.classList.toggle("on", x === b));
    renderCurrency(); renderProb();
  });
  $("#ilvl-input").addEventListener("change", () => {
    let v = Math.max(1, Math.min(86, +$("#ilvl-input").value || 75));
    $("#ilvl-input").value = v;
    S.ilvl = v; S.item.ilvl = v;
    renderCurrency(); renderProb(); renderCard(); save();
  });
  $("#ilvl-82").addEventListener("click", () => { $("#ilvl-input").value = 82; $("#ilvl-input").dispatchEvent(new Event("change")); });
  $("#ilvl-max").addEventListener("click", () => { $("#ilvl-input").value = 86; $("#ilvl-input").dispatchEvent(new Event("change")); });

  $("#btn-undo").addEventListener("click", () => {
    const prev = S.undoStack.pop();
    if (!prev) return;
    S.item = prev.item; S.usage = prev.usage || {}; S.steps = prev.steps;
    if (prev.log) S.log = prev.log; else S.log.pop();
    renderCraft(false);
    save();
  });
  $("#btn-reset").addEventListener("click", () => {
    if (!S.item.affixes.length && S.item.rarity === "normal") { toast("物品已经是白板了", "info"); return; }
    S.undoStack.push({ item: S.item, usage: JSON.parse(JSON.stringify(S.usage)), steps: S.steps, log: S.log.slice() });
    S.item = E.newItem(S.classId, S.baseId, S.ilvl, E.defaultRng);
    S.usage = {};
    S.log = [{ html: `<span class="l-t">重置物品</span><br>回到白板，用量统计已清零（可撤销）` }];
    renderCraft(true);
    save();
  });

  function renderCraft(animate) {
    renderCard(animate);
    renderCurrency();
    renderProb();
    renderLog();
    renderTopbar();
    renderQuality();
    renderRunes();
    renderLiquid();
    renderBoneBox();
    renderAlloys();
    renderAnointTab();
    renderBreachTab();
    if (S.item && S.item.classId) renderTargets();
  }
  function renderTopbar() {
    const list = Object.entries(S.usage)
      .filter(([, u]) => u.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([label, u]) => {
        const icon = u.kind === "omen" ? omenIcon(u.oid, 20)
          : u.kind === "essence" ? essenceIcon(u.name, 20)
          : u.kind === "breach" ? '<span class="usage-ico">☠</span>'
          : u.kind === "catalyst" ? '<span class="usage-ico q-ico">◆</span>'
          : u.kind === "vaal" ? '<span class="usage-ico q-ico">⚡</span>'
          : u.kind === "rune" ? '<span class="usage-ico rune-ico">ᚱ</span>'
          : u.kind === "liquid" ? '<span class="usage-ico liq-ico">◈</span>'
          : u.kind === "alloy" ? '<span class="usage-ico alloy-ico">⬢</span>'
          : u.kind === "anoint" ? '<span class="usage-ico an-ico">✦</span>'
          : u.kind === "augment" ? '<span class="usage-ico rune-ico">ᚣ</span>'
          : u.kind === "artificer" ? '<span class="usage-ico q-ico">⚒</span>'
          : curIcon(u.kind, 20);
        return `<span class="usage-chip">${icon}<b>${esc(label)}</b>×${u.count}</span>`;
      }).join("");
    $("#usage-list").innerHTML = list || `<span class="usage-empty">尚未使用通货</span>`;
    $("#usage-steps").textContent = S.steps;
    $("#topbar-status").innerHTML = `
      <span class="chip">部位 <b>${esc(E.classById.get(S.classId).zh)}</b></span>
      <span class="chip">基底 <b>${esc(E.baseIndex.get(S.classId + "/" + S.baseId).zh)}</b></span>
      <span class="chip">已用 <b>${S.steps}</b> 步</span>`;
  }

  /* ───────── 会话保存 ───────── */
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        classId: S.classId, baseId: S.baseId, ilvl: S.ilvl, item: S.item,
        log: S.log.slice(-80), usage: S.usage, steps: S.steps, tier: S.tier, boneTier: S.boneTier, omens: S.omens,
        category: S.category, targets: S.targets,
      }));
    } catch (e) { /* 忽略 */ }
  }
  function restore() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d.classId || !d.baseId || !d.item) return false;
      if (!E.baseIndex.get(d.classId + "/" + d.baseId)) return false;
      const omensMigrated = {};
      for (const [k, v] of Object.entries(d.omens || {})) omensMigrated[k] = Array.isArray(v) ? v : v ? [v] : []; // 旧版单值 -> 数组
      Object.assign(S, { classId: d.classId, baseId: d.baseId, ilvl: d.ilvl, item: d.item, log: d.log || [], usage: d.usage || {}, steps: d.steps || 0, tier: d.tier || "base", boneTier: d.boneTier || "preserved", omens: omensMigrated, targets: d.targets || [] });
      const cat = categoryOf(d.classId);
      if (cat) S.category = cat.id;
      return true;
    } catch (e) { return false; }
  }

  /* ───────── 做装分享：物品状态序列化进 URL ───────── */
  const b64e = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64d = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
  function shareUrl() {
    const d = {
      c: S.classId, b: S.baseId, i: S.ilvl,
      it: {
        r: S.item.rarity, a: S.item.affixes,
        ru: S.item.runes && S.item.runes.length ? S.item.runes : undefined,
        au: S.item.augments && S.item.augments.length ? S.item.augments : undefined,
        sb: S.item.socketsBonus || undefined,
        an: S.item.anoint ? S.item.anoint.slug : undefined,
        q: S.item.quality || undefined,
        co: S.item.corrupted || undefined,
        sf: S.item.sanctified || undefined,
      },
    };
    return location.href.split("#")[0] + "#share=" + b64e(JSON.stringify(d));
  }
  $("#btn-share").addEventListener("click", () => {
    if (!S.item) return;
    const url = shareUrl();
    const done = () => toast("分享链接已复制（" + url.length + " 字符）—— 发给别人即可复现当前物品", "info");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, () => { window.prompt("复制下面的分享链接：", url); });
    } else {
      window.prompt("复制下面的分享链接：", url);
    }
  });
  function restoreFromShare(hash) {
    try {
      const d = JSON.parse(b64d(hash));
      if (!d.c || !d.b || !E.baseIndex.get(d.c + "/" + d.b) || !d.it) return false;
      S.classId = d.c; S.baseId = d.b; S.ilvl = d.i || 82;
      const item = E.newItem(S.classId, S.baseId, S.ilvl, E.defaultRng);
      item.rarity = d.it.r || "normal";
      item.affixes = (d.it.a || []).filter((a) => E.modsById.get(a.modId));
      if (d.it.ru) item.runes = d.it.ru.filter((id) => E.runeById && E.runeById.get(id));
      if (d.it.au) item.augments = d.it.au.filter((id) => E.augmentById && E.augmentById.get(id));
      if (d.it.sb) item.socketsBonus = 1;
      if (d.it.an && E.anointBySlug && E.anointBySlug.get(d.it.an)) item.anoint = { slug: d.it.an };
      if (d.it.q) item.quality = d.it.q;
      if (d.it.co) item.corrupted = true;
      if (d.it.sf) item.sanctified = true;
      S.item = item;
      S.undoStack = []; S.log = []; S.steps = 0; S.usage = {}; S.omens = {}; S.targets = [];
      const cat = categoryOf(S.classId);
      if (cat) S.category = cat.id;
      $("#ilvl-input").value = S.ilvl;
      const cls = E.classById.get(S.classId), b = E.baseIndex.get(S.classId + "/" + S.baseId);
      $("#craft-title").textContent = `${cls.zh} · ${b.zh}`;
      renderBases();
      renderCraft(false);
      nav("screen-craft");
      toast("已载入分享的物品", "info");
      return true;
    } catch (e) { return false; }
  }

  /* ───────── 启动 ───────── */
  renderCategories();
  /* 直达做装台/基底页的入口（hash/分享/会话恢复）没经过大类点击，
     类型页（#class-grid）不会被渲染，返回「换类型」时会得到空白页 —— 这里统一预渲染 */
  function prerenderClassScreen() {
    const cat = categoryOf(S.classId);
    if (cat) S.category = cat.id;
    renderClasses();
  }
  const mShare = location.hash.match(/^#share=([A-Za-z0-9\-_]+)/);
  const mCls = !mShare && location.hash.match(/^#class=([A-Za-z_]+)/);
  if (mCls && E.classById.get(mCls[1])) {
    S.classId = mCls[1];
    const cat = categoryOf(S.classId);
    if (cat) S.category = cat.id;
    renderClasses();
    renderBases();
    nav("screen-base");
  }
  const mHash = !mShare && location.hash.match(/^#craft=([A-Za-z_]+),([A-Za-z0-9_]+)/);
  if (mShare && restoreFromShare(mShare[1])) {
    // 分享链接优先：已载入并进入做装台
    prerenderClassScreen();
  } else if (mHash && E.baseIndex.get(mHash[1] + "/" + mHash[2])) {
    S.classId = mHash[1]; S.baseId = mHash[2];
    const cat2 = categoryOf(S.classId);
    if (cat2) S.category = cat2.id;
    S.item = E.newItem(S.classId, S.baseId, 82, E.defaultRng);
    S.ilvl = 82;
    $("#ilvl-input").value = 82;
    const cls0 = E.classById.get(S.classId), b0 = E.baseIndex.get(S.classId + "/" + S.baseId);
    $("#craft-title").textContent = cls0.zh + " · " + b0.zh;
    prerenderClassScreen();
    renderBases(); // 直达做装台时也预渲染基底列表，保证「换基底」返回时有内容
    renderCraft(false);
    nav("screen-craft");
  } else if (restore()) {
    $("#ilvl-input").value = S.ilvl;
    $$("#tier-switch button").forEach((x) => x.classList.toggle("on", x.dataset.tier === S.tier));
    const cls = E.classById.get(S.classId);
    const b = E.baseIndex.get(S.classId + "/" + S.baseId);
    $("#craft-title").textContent = `${cls.zh} · ${b.zh}`;
    prerenderClassScreen();
    renderBases(); // 会话恢复直达做装台，同样预渲染基底列表
    renderCraft(false);
    nav("screen-craft");
    toast("已恢复上次的做装进度", "info");
  } else {
    $$("#tier-switch button").forEach((x) => x.classList.toggle("on", x.dataset.tier === "base"));
  }
})();
