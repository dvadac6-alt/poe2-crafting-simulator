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
    desecrated: { zh: "亵渎通货", desc: "稀有 +1 词缀（普通 ∪ 亵渎池）", color1: "#f8bca9", color2: "#c05234", glyph: "☠", priceKey: () => "desecrate" },
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
    OmenofLight: ["光之预兆", "剥离石必定移除一条亵渎词缀"],
    OmenofSinistralCrystallisation: ["晶化·左", "完美精华只会替换前缀"],
    OmenofDextralCrystallisation: ["晶化·右", "完美精华只会替换后缀"],
    OmenofSinistralNecromancy: ["死灵·左", "亵渎通货只会添加前缀"],
    OmenofDextralNecromancy: ["死灵·右", "亵渎通货只会添加后缀"],
    OmenoftheBlackblooded: ["黑血预兆", "限定库尔加尔的亵渎池"],
    OmenoftheLiege: ["领主预兆", "限定阿玛纳姆的亵渎池"],
    OmenoftheSovereign: ["君主预兆", "限定乌拉曼的亵渎池"],
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
    omens: {},        // currencyId -> omenId（每种通货记忆一个预兆）
    focusCur: null,   // 概率面板聚焦的通货
  };
  const SAVE_KEY = "poe2-craft-sim-v1";

  /* ───────── 工具 ───────── */
  function baseDps(b, cls) {
    if (!cls.attack) return null;
    let pdps = 0, edps = 0;
    if (b.phys) pdps = ((b.phys[0] + b.phys[1]) / 2) * b.aps;
    if (b.ele) for (const v of Object.values(b.ele)) edps += ((v[0] + v[1]) / 2) * b.aps;
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
    return `<img class="game-icon weapon-art" src="${p}" alt="" draggable="false" style="width:${size}px">`;
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

  /* ───────── 第一步：武器类 ───────── */
  function renderClasses() {
    const grid = $("#class-grid");
    grid.innerHTML = D.bases.classes.map((c) => `
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
  function renderBases() {
    const cls = E.classById.get(S.classId);
    $("#base-title").textContent = `选择${cls.zh}基底`;
    const grid = $("#base-grid");
    const q = ($("#base-search").value || "").trim().toLowerCase();
    const sort = $("#base-sort").value;
    let list = cls.bases.slice();
    if (q) list = list.filter((b) => b.zh.toLowerCase().includes(q) || b.en.toLowerCase().includes(q));
    list.sort((a, b) => {
      if (sort === "dps") return (baseDps(b, cls)?.dps || 0) - (baseDps(a, cls)?.dps || 0);
      if (sort === "aps") return (b.aps || 0) - (a.aps || 0);
      if (sort === "crit") return (b.crit || 0) - (a.crit || 0);
      return a.level - b.level;
    });
    grid.innerHTML = list.map((b) => {
      const dps = baseDps(b, cls);
      const isRune = b.zh.startsWith("符文");
      return `
      <button class="base-card" data-base="${b.id}">
        ${weaponArt(S.classId, b.id, 74)}
        ${isRune ? '<span class="rune">RUNE</span>' : ""}
        <div class="b-row1">
          <span><span class="b-zh ${isRune ? "tag-rune" : ""}">${esc(b.zh)}</span><div class="b-en">${esc(b.en)}</div></span>
          <span class="b-lv">等级 ${b.level}</span>
        </div>
        <div class="b-stats">
          ${b.phys ? `<span>物理 <b>${b.phys[0]}–${b.phys[1]}</b></span>` : ""}
          ${b.aps ? `<span>攻速 <b>${b.aps}</b></span>` : ""}
          ${b.crit ? `<span>暴击 <b>${b.crit}%</b></span>` : ""}
          ${b.reload ? `<span>装填 <b>${b.reload}s</b></span>` : ""}
          ${dps ? `<span class="b-dps">DPS ${dps.dps}</span>` : ""}
        </div>
        ${b.ele ? `<div class="b-implicit">${Object.entries(b.ele).map(([k, v]) => eleZh(k) + " " + v[0] + "–" + v[1]).join(" · ")}</div>` : ""}
        ${b.implicit ? `<div class="b-implicit">${esc(b.implicit)}</div>` : ""}
      </button>`;
    }).join("") || `<div class="log-empty">没有匹配的基底</div>`;
    $$(".base-card", grid).forEach((el) => el.addEventListener("click", () => {
      S.baseId = el.dataset.base;
      S.item = E.newItem(S.classId, S.baseId, S.ilvl, E.defaultRng);
      S.undoStack = []; S.log = []; S.totalCost = 0; S.steps = 0;
      S.omens = {}; S.focusCur = null;
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
  const CURRENCY_ORDER = ["transmutation", "augmentation", "regal", "alchemy", "exalted", "divine", "chaos", "fracturing", "hinekora", "annulment", "essence", "desecrated"];
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
  function rFor(cur) {
    // 返回当前 UI 上下文（档位/预兆）下的 act 参数与成本
    const omenId = S.omens[cur] || null;
    const omen = omenId ? E.omenById.get(omenId) : null;
    const opts = { tier: TIERABLE.has(cur) ? S.tier : "base", omen: omenId };
    let cost = 0;
    const m = CUR_META[cur];
    if (cur === "essence") cost = (D.prices.essence || 0);
    else if (cur === "desecrated") cost = D.prices.desecrate || 0;
    else cost = D.prices[m.priceKey(TIERABLE.has(cur) ? S.tier : "base")] || 0;
    if (omen) cost += D.omenPrices[omen.id] || 0;
    return { opts, cost, omen };
  }

  function renderCurrency() {
    const wrap = $("#currency-list");
    wrap.innerHTML = CURRENCY_ORDER.map((cur) => {
      const m = CUR_META[cur];
      const { opts, cost, omen } = rFor(cur);
      const probe = E.act(S.item, ACTION[cur], opts, E.makeRng(1));
      // 精华入口始终可点（弹窗内按等级细分可用性；稀有物品可用完美精华）
      const essenceOk = ["normal", "magic", "rare"].includes(S.item.rarity) && availEssences().length > 0;
      const ok2 = cur === "essence" ? essenceOk : probe.ok;
      const disabled = ok2 ? "" : "disabled";
      const reason = ok2 ? "" : (cur === "essence" ? "该武器类型没有可用精华" : probe.reason);
      const tierBadge = TIERABLE.has(cur) && S.tier !== "base"
        ? `<span class="exp">${{ greater: "高级", perfect: "完美" }[S.tier]}</span>` : "";
      const omenBadge = omen ? `<span class="exp" style="color:#d4c4f4;border-color:rgba(157,127,212,.5)">${OMEN_ZH[omen.id][0]}</span>` : "";
      const usedBadge = usageCountOf(cur) ? `<span class="used-n">×${usageCountOf(cur)}</span>` : "";
      return `
      <button class="cur-btn" data-cur="${cur}" ${disabled} title="${esc(reason)}">
        ${curIcon(cur, 40)}
        <span class="cur-info">
          <span class="cur-name">${m.zh}${tierBadge}${omenBadge}</span>
          <span class="cur-desc">${esc(reason || m.desc)}</span>
        </span>
        ${usedBadge}
      </button>`;
    }).join("");

    $$(".cur-btn", wrap).forEach((btn) => {
      const cur = btn.dataset.cur;
      btn.addEventListener("click", () => useCurrency(cur));
      btn.addEventListener("mouseenter", () => { S.focusCur = cur; renderProb(); renderOmens(cur); });
    });
    renderOmens(S.focusCur || defaultCurrency());
  }

  function availEssences() {
    const set = new Set();
    for (const [k] of E.essenceIndex) {
      if (k.startsWith(S.classId + "|")) set.add(k.split("|")[1]);
    }
    return [...set];
  }
  function defaultCurrency() {
    const r = S.item.rarity;
    if (r === "normal") return "transmutation";
    if (r === "magic") return "regal";
    return "exalted";
  }

  function renderOmens(cur) {
    const box = $("#omen-list");
    const c = D.currencies.find((x) => x.id === cur);
    let list = [];
    if (c && c.omens) list = c.omens;
    if (!list.length) {
      $("#omen-box").style.display = "none";
      return;
    }
    $("#omen-box").style.display = "";
    box.innerHTML = list.map((oid) => {
      const o = E.omenById.get(oid);
      const on = S.omens[cur] === oid ? "on" : "";
      return `<button class="omen-chip ${on}" data-oid="${oid}" title="${esc(OMEN_ZH[oid][1])} (+${D.omenPrices[oid]} 崇)">${omenIcon(oid, 22)}<span>${OMEN_ZH[oid][0]}</span></button>`;
    }).join("");
    $$(".omen-chip", box).forEach((b) => b.addEventListener("click", () => {
      if (S.omens[cur] === b.dataset.oid) delete S.omens[cur];
      else S.omens[cur] = b.dataset.oid;
      renderCurrency(); renderProb();
    }));
  }

  function useCurrency(cur) {
    if (cur === "essence") { openEssenceModal(); return; }
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
    const om1 = S.omens[cur];
    if (om1) countUsage("omen", OMEN_ZH[om1][0], { oid: om1 });
    addLog(cur, r);
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
      if (ev.type === "reroll") parts.push(`<span class="l-affix">↻ 重掷了 ${ev.affixes.length} 条词缀的数值</span>`);
      if (ev.type === "fracture") parts.push(`<span class="l-fract">⊘ 分裂锁定 ${renderAffixText(ev.affix, true)}</span>`);
      if (ev.type === "foresee") parts.push(`<span class="l-t">物品获得预示：下一个通货可预览结果</span>`);
    }
    const omenId = S.omens[cur];
    const omenTxt = omenId ? ` · ${OMEN_ZH[omenId][0]}` : "";
    const label = labelOverride || m.zh;
    S.log.push({
      html: `<span class="l-t">${label}${omenTxt}</span><br>${parts.join("<br>")}`,
    });
  }

  /* ───────── 物品卡片 ───────── */
  function renderAffixText(a, plain) {
    const mod = E.modsById.get(a.modId);
    const zh = I18N.modTextZh(mod, a.values);
    return zh.split("\n").map((l, i) => (i === 0 || plain ? l : `<span class="hybrid-line">${l}</span>`)).join(plain ? "\n" : "");
  }

  function renderCard(animate) {
    const card = $("#item-card");
    const cls = E.classById.get(S.classId);
    const base = E.baseIndex.get(S.classId + "/" + S.baseId);
    const item = S.item;
    const st = E.weaponStats(item);

    const affixHtml = item.affixes.map((a, i) => {
      const mod = E.modsById.get(a.modId);
      const tagCls = mod.type === "prefix" ? "p" : "s";
      const srcCls = a.fractured ? "fractured" : a.source === "essence" ? "essence-src" : a.source === "desecrated" ? "desec-src" : "";
      const tierName = mod.tiers[a.tierIdx] && mod.tiers[a.tierIdx].name;
      const isNew = animate && i === item.affixes.length - 1 && animate !== "remove";
      return `<div class="ic-affix ${isNew ? "new" : ""} ${srcCls}">
        <span class="affix-tag ${tagCls}">${mod.type === "prefix" ? "前缀" : "后缀"}</span>${a.fractured ? '<span class="affix-tag frac">分裂</span>' : ""}${renderAffixText(a)}
        <span class="tier-name">${esc(tierName || "")}</span>
      </div>`;
    }).join("");

    const c = E.affixCounts(item);
    const cap = E.CAPS[item.rarity];
    const pips = (n, total, cls2) => Array.from({ length: total }, (_, i) => `<span class="pip ${i < n ? "filled " + cls2 : ""}"></span>`).join("");

    const nameLine = item.name ? `${item.name}` : "";
    const dpsHtml = st ? `
      <div class="dps-block">
        <div class="dps-row total"><span>每秒伤害总和</span><b>${st.dps.toLocaleString()}</b></div>
        <div class="dps-row"><span>物理 ${st.physRange[0]}–${st.physRange[1]}</span><b>${st.pdps.toLocaleString()} / 秒</b></div>
        ${Object.entries(st.eleRanges).map(([k, v]) => `<div class="dps-row"><span>${eleZh(k)} ${v[0]}–${v[1]}</span><b>${Math.round(((v[0] + v[1]) / 2) * st.aps * (k === "chaos" ? 1 : 1 + st.incEle / 100)).toLocaleString()} / 秒</b></div>`).join("")}
        <div class="dps-row"><span>攻击速度</span><b>${st.aps.toFixed(2)}</b></div>
        <div class="dps-row"><span>暴击几率 / 加成</span><b>${st.crit}% / +${st.critDmg}%</b></div>
      </div>` : "";

    card.className = `item-card rarity-${item.rarity}` + (animate ? " shake" : "");
    if (animate) { card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake"); }
    const art = asset("weapons", S.classId + "/" + S.baseId);
    card.innerHTML = `
      ${item.foresee ? `<div class="ic-foresee">⟡ 辛格拉的预示已就绪 —— 下一个通货可预览结果</div>` : ""}
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
      </div>` : ""}
      ${affixHtml ? `<div class="ic-sep"></div>${affixHtml}` : ""}
      <div class="slots-row">
        <span class="slots"><span class="lbl">前缀</span>${pips(c.prefix, cap.prefix, "p")}</span>
        <span class="slots"><span class="lbl">后缀</span>${pips(c.suffix, cap.suffix, "s")}</span>
      </span>
      ${dpsHtml}
      <div class="ic-stats" style="margin-top:10px"><span>物品等级 <b>${item.ilvl}</b></span><span>词缀 <b>${item.affixes.length}</b></span></div>
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
    const omenId = S.omens[cur];

    // 剥离：显示删除概率
    if (cur === "annulment") {
      const c = E.affixCounts(S.item);
      const rows = [];
      if (omenId === "OmenofSinistralAnnulment") rows.push(["随机一条前缀", c.prefix ? 1 : 0]);
      else if (omenId === "OmenofDextralAnnulment") rows.push(["随机一条后缀", c.suffix ? 1 : 0]);
      else if (omenId === "OmenofLight") {
        const n = S.item.affixes.filter((a) => a.source === "desecrated").length;
        rows.push(["一条亵渎词缀", n ? 1 : 0]);
      } else {
        const n = S.item.affixes.length;
        S.item.affixes.forEach((a) => rows.push([renderAffixText(a, true).replace(/\n/g, " / "), n ? 1 / n : 0]));
      }
      sub.textContent = `· ${m.zh} 会删掉什么`;
      list.innerHTML = rows.length
        ? rows.map(([t, p]) => probRow(t, p)).join("") + `<div class="prob-note">剥离以 <b>1/当前词缀数</b> 的等概率随机移除；预兆可锁定前缀 / 后缀 / 亵渎词缀。</div>`
        : `<div class="prob-note">物品上没有词缀。</div>`;
      return;
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
    if (omenId) {
      const o = E.omenById.get(omenId);
      if (o.constrainTo) type = o.constrainTo;
    }
    const tbl = E.probabilityTable(S.item, { source, asRarity, type, floor });
    sub.textContent = `· 下一次${m.zh}的结果分布`;

    if (!tbl.rows.length) {
      list.innerHTML = `<div class="prob-note">当前状态无法用${m.zh}（稀有度不符或词缀已满）。</div>`;
      return;
    }
    const top = tbl.rows.slice(0, 60);
    list.innerHTML = top.map((r) => {
      const best = r.tiers.reduce((a, b) => (a.prob >= b.prob ? a : b));
      const tierTxt = r.tiers.length === 1
        ? `档位「${best.tier.name}」 ${fmtP(best.prob)}`
        : `${r.tiers.length} 个可达档位 · 最佳「${best.tier.name}」${fmtP(best.prob)}`;
      return `<div class="prob-row">
        <div class="p-head"><span class="p-text">${renderAffixText({ modId: r.mod.id, values: r.tiers[0].tier.ranges.map((x) => x[0]), tierIdx: r.tiers[0].tierIdx })}</span>
        <span class="p-pct">${fmtP(r.prob)}</span></div>
        <div class="p-bar"><i style="width:${(r.prob * 100).toFixed(1)}%"></i></div>
        <div class="p-tier">${esc(tierTxt)}</div>
      </div>`;
    }).join("") +
    (tbl.rows.length > 60 ? `<div class="prob-note">… 其余 ${tbl.rows.length - 60} 条词缀概率均低于 ${(fmtP(top[top.length - 1].prob))}</div>` : "") +
    `<div class="prob-note">共 <b>${tbl.pairs.length}</b> 个（词缀×档位）组合参与 roll。${floor ? `当前为<b>${{ 35: "高级", 50: "完美" }[floor]}</b>通货，只 roll 档位需求 ≥ ${floor} 的词缀档。` : ""}${type ? `预兆限定只出<b>${type === "prefix" ? "前缀" : "后缀"}</b>。` : ""}</div>`;
  }
  function fmtP(p) { return (p * 100).toFixed(p >= 0.1 ? 1 : 2) + "%"; }
  function probRow(text, p) {
    return `<div class="prob-row">
      <div class="p-head"><span class="p-text">${esc(text)}</span><span class="p-pct">${fmtP(p)}</span></div>
      <div class="p-bar"><i style="width:${(p * 100).toFixed(1)}%"></i></div>
    </div>`;
  }

  /* ───────── 精华弹窗 ───────── */
  function openEssenceModal() {
    const grid = $("#essence-grid");
    // 该类可用的精华
    const avail = new Map();
    for (const e of D.essenceModMap) {
      if (e.classId !== S.classId) continue;
      if (!avail.has(e.essence)) avail.set(e.essence, new Set());
      avail.get(e.essence).add(e.tier);
    }
    const essenceTierZh = { LESSER: "低", NORMAL: "中", GREATER: "高", PERFECT: "完美" };
    grid.innerHTML = [...avail.entries()].map(([name, tiers]) => {
      const preview = E.essenceIndex.get(S.classId + "|" + name + "|" + (tiers.has("GREATER") ? "GREATER" : [...tiers][0]));
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
  function useEssence(name, tier) {
    const omenId = S.omens.essence || null;
    const r = E.act(S.item, "essence", { essence: name, tier, omen: omenId });
    if (!r.ok) { toast(r.reason); return; }
    $("#essence-modal").classList.add("hidden");
    S.undoStack.push({ item: S.item, cost: S.totalCost, steps: S.steps });
    S.item = r.item;
    S.totalCost += r.cost;
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
      const om2 = S.omens[cur];
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

  /* ───────── 其他控件 ───────── */
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
  }
  function renderTopbar() {
    const list = Object.entries(S.usage)
      .filter(([, u]) => u.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([label, u]) => {
        const icon = u.kind === "omen" ? omenIcon(u.oid, 20) : u.kind === "essence" ? essenceIcon(u.name, 20) : curIcon(u.kind, 20);
        return `<span class="usage-chip">${icon}<b>${esc(label)}</b>×${u.count}</span>`;
      }).join("");
    $("#usage-list").innerHTML = list || `<span class="usage-empty">尚未使用通货</span>`;
    $("#usage-steps").textContent = S.steps;
    $("#topbar-status").innerHTML = `
      <span class="chip">武器 <b>${esc(E.classById.get(S.classId).zh)}</b></span>
      <span class="chip">基底 <b>${esc(E.baseIndex.get(S.classId + "/" + S.baseId).zh)}</b></span>
      <span class="chip">已用 <b>${S.steps}</b> 步</span>`;
  }

  /* ───────── 会话保存 ───────── */
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        classId: S.classId, baseId: S.baseId, ilvl: S.ilvl, item: S.item,
        log: S.log.slice(-80), usage: S.usage, steps: S.steps, tier: S.tier, omens: S.omens,
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
      Object.assign(S, { classId: d.classId, baseId: d.baseId, ilvl: d.ilvl, item: d.item, log: d.log || [], usage: d.usage || {}, steps: d.steps || 0, tier: d.tier || "base", omens: d.omens || {} });
      return true;
    } catch (e) { return false; }
  }

  /* ───────── 启动 ───────── */
  renderClasses();
  const mCls = location.hash.match(/^#class=([A-Za-z_]+)/);
  if (mCls && E.classById.get(mCls[1])) {
    S.classId = mCls[1];
    renderBases();
    nav("screen-base");
  }
  const mHash = location.hash.match(/^#craft=([A-Za-z_]+),([A-Za-z0-9_]+)/);
  if (mHash && E.baseIndex.get(mHash[1] + "/" + mHash[2])) {
    S.classId = mHash[1]; S.baseId = mHash[2];
    S.item = E.newItem(S.classId, S.baseId, 82, E.defaultRng);
    S.ilvl = 82;
    $("#ilvl-input").value = 82;
    const cls0 = E.classById.get(S.classId), b0 = E.baseIndex.get(S.classId + "/" + S.baseId);
    $("#craft-title").textContent = cls0.zh + " · " + b0.zh;
    renderCraft(false);
    nav("screen-craft");
  } else if (restore()) {
    $("#ilvl-input").value = S.ilvl;
    $$("#tier-switch button").forEach((x) => x.classList.toggle("on", x.dataset.tier === S.tier));
    const cls = E.classById.get(S.classId);
    const b = E.baseIndex.get(S.classId + "/" + S.baseId);
    $("#craft-title").textContent = `${cls.zh} · ${b.zh}`;
    renderCraft(false);
    nav("screen-craft");
    toast("已恢复上次的做装进度", "info");
  } else {
    $$("#tier-switch button").forEach((x) => x.classList.toggle("on", x.dataset.tier === "base"));
  }
})();
