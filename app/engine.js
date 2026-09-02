/* PoE2 做装模拟引擎 —— 纯逻辑，无 DOM 依赖。
 * 规则来源：POE2_HTC 引擎语义（currencies/omens/currency_tiers）+ poe2db 0.5 数据。
 * 词缀选取模型：(词缀, 档位) 成对加权抽取（与 addAffixProbability 一致），
 * 同 family / 同 id 互斥，档位受物品 ilvl 上限与通货档位下限（普通0/高级35/完美50）约束。
 */
(function (global) {
  "use strict";
  const D = global.POE2_DATA;

  /* ---------- 索引 ---------- */
  const modsById = new Map(D.mods.map((m) => [m.id, m]));
  /* 裂隙精华（Essence of the Breach）的保底词缀：Jewellery +20% to Maximum Quality（前缀，poe2db 确认）。
   * mods.json 未收录，合成注入以参与正常词缀流程（占前缀位、可被剥离/混沌移除）。 */
  const BREACH_QUALITY_MOD = {
    id: "Special/JEWELLERY_MAXIMUM_QUALITY", group: "JewelleryMaximumQuality",
    field: "JEWELLERY_MAXIMUM_QUALITY", source: "normal", type: "prefix",
    categories: [], family: "JewelleryMaximumQuality", tags: [],
    text: "+20% to Maximum Quality",
    tiers: [{ name: "裂隙精化", ilvl: 1, weight: 0, ranges: [[20, 20]] }],
  };
  modsById.set(BREACH_QUALITY_MOD.id, BREACH_QUALITY_MOD);

  /* ---------- Runes of Aldur（0.5）：符文 / 创世树 / 蒸馏情感 / 时逝珠宝 ---------- */
  const ALDUR = D.aldur || { runes: [], runePools: {}, genesisPools: {}, genesisBases: {}, timeLost: { pool: { prefixes: [], suffixes: [] }, bases: [] }, liquid: [], sockets: { weapons: 2, armour: 2, jewellery: 1 } };
  const runeById = new Map(ALDUR.runes.map((r) => [r.id, r]));
  const liquidById = new Map(ALDUR.liquid.map((e) => [e.id, e]));
  for (const pool of Object.values(ALDUR.runePools))
    for (const m of [...pool.prefixes, ...pool.suffixes]) modsById.set(m.id, m);
  for (const pool of Object.values(ALDUR.genesisPools))
    for (const m of [...pool.prefixes, ...pool.suffixes]) modsById.set(m.id, m);
  for (const m of [...ALDUR.timeLost.pool.prefixes, ...ALDUR.timeLost.pool.suffixes]) modsById.set(m.id, m);

  /* ---------- 基础符文 + 魂核（0.5 Augment 全表，tools/build_augments.mjs 生成） ---------- */
  const AUGM = (typeof window !== "undefined" && window.POE2_AUGMENTS) || { runes: [], soulCores: [] };
  const augmentById = new Map([...AUGM.runes, ...AUGM.soulCores].map((a) => [a.id, a]));
  const ARTIFICER_PRICE = 3; // 巧匠石：+1 插槽（种子估值）
  function socketsUsedOf(item) {
    return ((item.runes || []).length + (item.augments || []).length);
  }
  function augmentEffectFor(item, aug) {
    if (!aug) return null;
    return (aug.effects || []).find((f) => f.targets.includes(item.classId)) || null;
  }
  function augmentApplicable(item, aug) {
    if (!item.classId) return "无部位";
    return augmentEffectFor(item, aug) ? null : "该物品不能镶嵌此增幅物";
  }
  function socketAugment(item, augId) {
    const aug = augmentById.get(augId);
    if (!aug) return { ok: false, reason: "未知增幅物" };
    const err = augmentApplicable(item, aug);
    if (err) return { ok: false, reason: err };
    const cur = item.augments || [];
    if (aug.limited && cur.includes(augId)) return { ok: false, reason: "该增幅物每件限 1" };
    if (socketsUsedOf(item) >= runeSlotsOf(item)) return { ok: false, reason: "增幅器插槽数不足（该部位 " + runeSlotsOf(item) + " 个）" };
    const it = clone(item);
    it.augments = cur.concat(augId);
    return { ok: true, item: it, cost: aug.price || 0, events: [{ type: "augment", augId }] };
  }
  function unsocketAugment(item, augId) {
    const cur = item.augments || [];
    if (!cur.includes(augId)) return { ok: false, reason: "该增幅物未镶嵌" };
    const it = clone(item);
    it.augments = cur.filter((x) => x !== augId);
    return { ok: true, item: it, events: [{ type: "augment-remove", augId }] };
  }
  /* 巧匠石：为武器/护甲 +1 插槽（每件最多 1 次；首饰/珠宝不可用） */
  function addSocket(item) {
    if (item.classId && (item.classId.indexOf("Jewels") === 0 || ["Rings", "Amulets", "Belts"].includes(item.classId)))
      return { ok: false, reason: "巧匠石只能用于武器与护甲" };
    if (runeSlotsOf(item) === 0) return { ok: false, reason: "该物品没有增幅器插槽" };
    if (item.socketsBonus) return { ok: false, reason: "巧匠石每件物品只能使用一次" };
    const it = clone(item);
    it.socketsBonus = 1;
    return { ok: true, item: it, cost: ARTIFICER_PRICE, events: [{ type: "socket-add" }] };
  }
  /* 已镶嵌增幅物对武器面板的数值加成（附加元素伤害 / 物理伤害提高），来自效果级 stats */
  function augmentStatsOf(item) {
    const out = { physInc: 0, ele: {} };
    for (const id of (item.augments || [])) {
      const fx = augmentEffectFor(item, augmentById.get(id));
      if (!fx || !fx.stats) continue;
      if (fx.stats.physInc) out.physInc += fx.stats.physInc;
      if (fx.stats.ele) for (const [k, v] of Object.entries(fx.stats.ele)) {
        out.ele[k] = out.ele[k] || [0, 0];
        out.ele[k][0] += v[0]; out.ele[k][1] += v[1];
      }
    }
    return out;
  }
  // 蒸馏情感保证词缀注册为伪 mod（tier 权重 0：不参与随机池，仅由 liquidEmotion 注入）
  for (const e of ALDUR.liquid) {
    for (const [slot, aff] of Object.entries(e.affixes)) {
      const id = "Liquid/" + e.id + "_" + slot;
      modsById.set(id, {
        id, group: "Liquid", field: e.id + "_" + slot, source: "liquid", type: aff.type,
        categories: [], family: "Liquid_" + e.id + "_" + slot, tags: [],
        text: aff.text, textZh: aff.textZh || null,
        tiers: [{ name: e.zh, ilvl: 1, weight: 0, ranges: aff.ranges }],
      });
    }
  }
  // 合金保证词缀（0.5 Verisium 残迹）注册为伪 mod（weight 0：不参与随机池，仅由 alloy 注入）
  const alloyById = new Map((ALDUR.alloys || []).map((a) => [a.id, a]));
  for (const a of ALDUR.alloys || []) {
    (a.mods || []).forEach((m, i) => {
      const id = "Alloy/" + a.id + "_" + i;
      modsById.set(id, {
        id, group: "Alloy", field: a.id + "_" + i, source: "alloy", type: m.type,
        categories: [], family: "Alloy_" + a.id + "_" + i, tags: [],
        text: m.text, textZh: m.textZh || null,
        tiers: [{ name: a.zh, ilvl: m.level, weight: 0, ranges: m.ranges }],
      });
    });
  }
  // 涂油注入（枯萎之树）：3 种有序液体情感 → 项链专精天赋（874 条配方）
  const anointBySlug = new Map((ALDUR.anoints || []).map((n) => [n.slug, n]));
  const anointByCombo = new Map((ALDUR.anoints || []).map((n) => [n.emotions.join("|"), n]));
  const anointEmotionById = new Map((ALDUR.anointEmotions || []).map((e) => [e.id, e]));
  // 合金对该物品部位的词条下标（classes 按物品类精确匹配；未收录类自然不命中）
  function alloyModFor(item, alloy) {
    return (alloy.mods || []).findIndex((m) => (m.classes || []).includes(item.classId));
  }
  function alloyClassZh(alloy) {
    const seen = new Set();
    const out = [];
    for (const c of (alloy.mods || []).flatMap((m) => m.classes || [])) {
      if (seen.has(c)) continue;
      seen.add(c);
      const cls = classById.get(c);
      if (cls) out.push(cls.zh);
    }
    return out.join("、");
  }
  // 轻蔑系（+1 允许前缀/后缀）词缀 → 词缀上限调整表
  const LIQUID_CAP_ADJ = new Map();
  for (const e of ALDUR.liquid) {
    if (!/Contempt$/.test(e.id)) continue;
    for (const slot of Object.keys(e.affixes)) {
      const isSuffixVariant = /S$/.test(slot);
      LIQUID_CAP_ADJ.set("Liquid/" + e.id + "_" + slot, isSuffixVariant ? { prefix: 1 } : { suffix: 1 });
    }
  }
  // 部位 → 创世树独占池键（护身符 otherworldly 池单独提取）
  function genesisPoolKey(item, domain) {
    if (domain === "breach_otherworldly" && item.classId === "Amulets" && ALDUR.genesisPools.breach_otherworldly_amulet) return "breach_otherworldly_amulet";
    return domain;
  }
  // 珠宝颜色（蒸馏情感按颜色给词缀）
  const JEWEL_COLOR = { JewelsRuby: "ruby", JewelsEmerald: "emerald", JewelsSapphire: "sapphire", JewelsDiamond: "diamond" };
  function jewelColorOf(item) { return JEWEL_COLOR[item.classId] || null; }
  function isTimeLostJewel(item) {
    const b = item && baseIndex.get(item.classId + "/" + item.baseId);
    return !!(b && b.timeLost);
  }
  // 增幅器插槽数（武器/护甲 2、首饰 1、珠宝 0；巧匠石 +1 计入 socketsBonus）
  function runeSlotsOf(item) {
    const cid = item && item.classId;
    if (!cid || cid.indexOf("Jewels") === 0) return 0;
    const bonus = item.socketsBonus || 0;
    if (cid === "Rings" || cid === "Amulets" || cid === "Belts") return ALDUR.sockets.jewellery;
    return ALDUR.sockets.armour + bonus;
  }
  const WEAPON_CLASS_IDS = new Set(["Bows", "Spears", "Crossbows", "Quarterstaves", "OneHand_Maces", "TwoHand_Maces", "Staves", "Wands", "Sceptres", "Foci", "Quivers", "Talismans", "Shields", "Bucklers"]);
  function runeApplicable(item, rune) {
    if (!item.classId) return "无部位";
    const slots = rune.slots;
    if (slots === "all") return null;
    if (slots === "weapons") return WEAPON_CLASS_IDS.has(item.classId) ? null : "只能镶嵌在武器上";
    return slots.includes(item.classId) ? null : "只能镶嵌在" + { Boots: "鞋子", Gloves: "手套", Helmets: "头盔", Body_Armours: "胸甲" }[slots[0]] + "上";
  }
  function socketRune(item, runeId) {
    const rune = runeById.get(runeId);
    if (!rune) return { ok: false, reason: "未知符文" };
    const err = runeApplicable(item, rune);
    if (err) return { ok: false, reason: err };
    const runes = item.runes || [];
    if (runes.includes(runeId)) return { ok: false, reason: "该符文已镶嵌（每件限 1 颗）" };
    if (socketsUsedOf(item) >= runeSlotsOf(item)) return { ok: false, reason: "增幅器插槽数不足（该部位 " + runeSlotsOf(item) + " 个）" };
    const it = clone(item);
    it.runes = runes.concat(runeId);
    return { ok: true, item: it, cost: rune.price || 0, events: [{ type: "rune", runeId }] };
  }
  function unsocketRune(item, runeId) {
    const runes = item.runes || [];
    if (!runes.includes(runeId)) return { ok: false, reason: "该符文未镶嵌" };
    const it = clone(item);
    it.runes = runes.filter((r) => r !== runeId);
    return { ok: true, item: it, events: [{ type: "rune-remove", runeId }] };
  }
  // 工艺词缀（蒸馏情感）上限：基础 1，阿斯特丽德的创造 +1
  function liquidCapOf(item) {
    return 1 + ((item.runes || []).includes("Astrids_Creativity") ? 1 : 0);
  }

  const classList = D.bases.classes;
  const classById = new Map(classList.map((c) => [c.id, c]));
  const baseIndex = new Map(); // classId -> baseId -> base
  for (const c of classList) for (const b of c.bases) baseIndex.set(c.id + "/" + b.id, b);

  // classId -> { normal: {prefixes:[mod], suffixes:[mod]}, desecrated: {...} }
  const poolsByClass = {};
  for (const [cid, pools] of Object.entries(D.classPoolsRaw)) {
    poolsByClass[cid] = {};
    for (const [src, byType] of Object.entries(pools)) {
      poolsByClass[cid][src] = {
        prefixes: byType.prefixes.map((id) => modsById.get(id)).filter(Boolean),
        suffixes: byType.suffixes.map((id) => modsById.get(id)).filter(Boolean),
      };
    }
  }

  /* 防具基底按属性挂不同词缀池：基底带 poolClass 时优先于部位类（如 Helmets_str） */
  function poolKeyOf(item) {
    const base = item && baseIndex.get(item.classId + "/" + item.baseId);
    return (base && base.poolClass) || item.classId;
  }

  // (classId, essenceName, tier) -> {modId, tierIndex}
  const essenceIndex = new Map();
  for (const e of D.essenceModMap) {
    essenceIndex.set(e.classId + "|" + e.essence + "|" + e.tier, e);
  }
  // classId -> Set(essenceName) 可用精华
  const essencesByClass = new Map();
  for (const e of D.essenceModMap) {
    if (!essencesByClass.has(e.classId)) essencesByClass.set(e.classId, new Map());
    essencesByClass.get(e.classId).set(e.essence, e.essence);
  }

  const omenById = new Map(D.omens.map((o) => [o.id, o]));
  const TIER_FLOOR = { base: 0, greater: 35, perfect: 50 };
  const CAPS = { normal: { prefix: 0, suffix: 0 }, magic: { prefix: 1, suffix: 1 }, rare: { prefix: 3, suffix: 3 } };

  /* 珠宝（Jewels* 类）稀有度上限为 2 前 2 后（游戏规则与 PoE1 珠宝一致）；
   * 特殊基底（失神/哀悼/预兆项链、暮色系戒指项链、畸变/扭曲项链）通过 capAdj 调整允许的前缀/后缀；
   * 符文「瑟尔的凯旋」+1 允许后缀；蒸馏情感「轻蔑」词缀 ±1 允许前缀/后缀 */
  function capsFor(item, rarity) {
    const r = rarity || item.rarity;
    const cap = { prefix: CAPS[r].prefix, suffix: CAPS[r].suffix };
    if (r === "rare" && item.classId && item.classId.indexOf("Jewels") === 0) { cap.prefix = 2; cap.suffix = 2; }
    const base = item.classId ? baseIndex.get(item.classId + "/" + item.baseId) : null;
    if (base && base.capAdj) {
      if (r !== "normal") {
        cap.prefix = Math.max(0, Math.min(6, cap.prefix + (base.capAdj.prefix || 0)));
        cap.suffix = Math.max(0, Math.min(6, cap.suffix + (base.capAdj.suffix || 0)));
      }
    }
    if (r !== "normal") {
      if ((item.runes || []).includes("Serles_Triumph")) cap.suffix = Math.min(6, cap.suffix + 1);
      for (const a of item.affixes || []) {
        const adj = LIQUID_CAP_ADJ.get(a.modId);
        if (adj) {
          cap.prefix = Math.min(6, cap.prefix + (adj.prefix || 0));
          cap.suffix = Math.min(6, cap.suffix + (adj.suffix || 0));
        }
      }
    }
    return cap;
  }

  /* ---------- 随机（可注入种子，供测试） ---------- */
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const defaultRng = makeRng((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);

  function weightedPick(pairs, rng) {
    let total = 0;
    for (const p of pairs) total += p.weight;
    if (total <= 0) return null;
    let r = rng() * total;
    for (const p of pairs) {
      r -= p.weight;
      if (r <= 0) return p;
    }
    return pairs[pairs.length - 1];
  }

  function weightOf(mod, tier) {
    for (const o of D.overrides) if (o.modId === mod.id && o.tier === tier.name) return o.weight;
    return tier.weight;
  }

  /* ---------- 物品状态 ---------- */
  function newItem(classId, baseId, ilvl, rng) {
    const base = baseIndex.get(classId + "/" + baseId);
    if (!base) throw new Error("未知基底: " + baseId);
    return {
      classId, baseId, ilvl,
      rarity: "normal",
      affixes: [],           // {modId, tierIdx, values, source}
      runes: [],             // 已镶嵌的特殊符文 id（Runes of Aldur）
      name: null,            // 魔物/稀有自动命名
      uid: Math.floor((rng || defaultRng)() * 1e9),
    };
  }
  const clone = (it) => JSON.parse(JSON.stringify(it));
  const modOf = (a) => modsById.get(a.modId);

  function affixCounts(item) {
    let prefix = 0, suffix = 0;
    for (const a of item.affixes) (modOf(a).type === "prefix" ? prefix++ : suffix++);
    return { prefix, suffix };
  }
  function freeTypes(item, constrainTo, asRarity) {
    const cap = capsFor(item, asRarity);
    const c = affixCounts(item);
    const types = [];
    if (c.prefix < cap.prefix) types.push("prefix");
    if (c.suffix < cap.suffix) types.push("suffix");
    if (constrainTo) return types.includes(constrainTo) ? [constrainTo] : [];
    return types;
  }

  /* ---------- 词缀池与概率 ---------- */
  // opts: {source:'normal'|'desecrated', type:'prefix'|'suffix'|null, floor:0|35|50, boss, asRarity}
  // asRarity：以目标稀有度评估空位（如对普通物品模拟蜕变/点金结果时传 'magic'/'rare'）
  // 普通做装来源时，附加参与：符文解锁池（乌崔德/克尔/沃拉娜/斯鲁德/梅德维德/卡塔拉）与创世树独占池
  function extraPoolsOf(item) {
    const out = [];
    for (const rid of item.runes || []) {
      const rune = runeById.get(rid);
      if (rune && rune.effect.kind === "canRoll" && ALDUR.runePools[rune.effect.domain]) out.push(ALDUR.runePools[rune.effect.domain]);
    }
    const base = baseIndex.get(item.classId + "/" + item.baseId);
    if (base && base.genesis) {
      for (const domain of base.genesis) {
        const pool = ALDUR.genesisPools[genesisPoolKey(item, domain)];
        if (pool) out.push(pool);
      }
    }
    return out;
  }
  function eligiblePairs(item, opts) {
    const o = Object.assign({ source: "normal", type: null, floor: 0, boss: null, asRarity: null }, opts);
    const types = freeTypes(item, o.type, o.asRarity);
    if (!types.length) return [];
    const takenIds = new Set(item.affixes.map((a) => a.modId));
    const takenFam = new Set(item.affixes.map((a) => modOf(a).family));
    const srcs = o.source === "desecrated" ? ["desecrated", "normal"] : [o.source];
    const out = [];
    const collect = (pool, srcTag) => {
      if (!pool) return;
      for (const t of types) {
        for (const mod of pool[t === "prefix" ? "prefixes" : "suffixes"]) {
          if (takenIds.has(mod.id) || takenFam.has(mod.family)) continue;
      if (o.boss && (srcTag !== "desecrated" || mod.boss !== o.boss)) continue;
      for (let i = 0; i < mod.tiers.length; i++) {
        const tier = mod.tiers[i];
        if (tier.ilvl > item.ilvl) continue;   // 物品等级不足
        if (tier.ilvl < o.floor) continue;     // 通货档位下限
        if (o.maxIlvl && tier.ilvl > o.maxIlvl) continue; // 啃噬骨：只出低档渎灵词缀
        const w = weightOf(mod, tier) * (o.weightMult ? o.weightMult(mod) : 1);
        if (w > 0) out.push({ mod, tierIdx: i, weight: w });
      }
        }
      }
    };
    for (const src of srcs) {
      const pk = poolKeyOf(item);
      collect(poolsByClass[pk] && poolsByClass[pk][src], src);
    }
    if (o.source === "normal") for (const pool of extraPoolsOf(item)) collect(pool, "extra");
    // 去重（normal 池会被 desecrated 来源重复包含）
    const seen = new Set(), res = [];
    for (const p of out) {
      const k = p.mod.id + "#" + p.tierIdx;
      if (!seen.has(k)) { seen.add(k); res.push(p); }
    }
    return res;
  }

  // 概率表：按 modId 聚合（该词缀任意档位命中的概率），并展开档位明细
  function probabilityTable(item, opts) {
    const pairs = eligiblePairs(item, opts);
    let total = 0;
    for (const p of pairs) total += p.weight;
    const byMod = new Map();
    for (const p of pairs) {
      if (!byMod.has(p.mod.id)) byMod.set(p.mod.id, { mod: p.mod, tiers: [], weight: 0 });
      const g = byMod.get(p.mod.id);
      g.weight += p.weight;
      g.tiers.push({ tierIdx: p.tierIdx, tier: p.mod.tiers[p.tierIdx], weight: p.weight });
    }
    const rows = [...byMod.values()];
    for (const r of rows) {
      r.prob = total > 0 ? r.weight / total : 0;
      for (const t of r.tiers) t.prob = total > 0 ? t.weight / total : 0;
    }
    rows.sort((a, b) => b.weight - a.weight);
    return { rows, total, pairs };
  }

  /* ---------- 掷值 ---------- */
  function rollRange(lo, hi, rng) {
    if (Number.isInteger(lo) && Number.isInteger(hi)) return lo + Math.floor(rng() * (hi - lo + 1));
    const v = lo + rng() * (hi - lo);
    return Math.round(v * 10) / 10;
  }
  function rollAffixValues(mod, tierIdx, rng) {
    return mod.tiers[tierIdx].ranges.map(([lo, hi]) => rollRange(lo, hi, rng));
  }

  function makeAffix(pair, rng, source) {
    return {
      modId: pair.mod.id,
      tierIdx: pair.tierIdx,
      values: rollAffixValues(pair.mod, pair.tierIdx, rng),
      source: source || pair.mod.source,
    };
  }

  /* ---------- 随机命名（魔物/稀有） ---------- */
  const RARE_PRE = ["龙裔", "灾祸", "不朽", "深渊", "焚天", "裂魂", "噬星", "暗裔", "风暴", "湮灭", "猩红", "凛冬", "雷霆", "低语", "蛮荒", "黄昏"];
  const RARE_SUF = ["之怒", "之牙", "之握", "低语", "之噬", "之愿", "烙印", "挽歌", "盛宴", "裁决", "回响", "终焉"];
  function rollName(item, rng) {
    const r = rng || defaultRng;
    const pre = RARE_PRE[Math.floor(r() * RARE_PRE.length)];
    const suf = RARE_SUF[Math.floor(r() * RARE_SUF.length)];
    return item.rarity === "magic" ? pre + "之" : pre + "之" + suf;
  }

  /* ---------- 通货动作 ---------- */
  // 统一返回 {ok, reason?, item?, events:[{type, ...}], cost}
  function priceOf(key) { return D.prices[key] || 0; }
  function omenCost(omenId) { return D.omenPrices[omenId] || 0; }

  function checkRarity(item, want) {
    const okMap = {
      transmute: ["normal"], augment: ["magic"], regal: ["magic"], exalt: ["rare"],
      annul: ["magic", "rare"], desecrated: ["rare"], chaos: ["rare"], alchemy: ["normal", "magic"],
      divine: ["magic", "rare"], fracture: ["rare"], hinekora: ["normal", "magic", "rare"],
    };
    const list = okMap[want];
    if (list && !list.includes(item.rarity)) {
      return { ok: false, reason: rarityName(item.rarity) + "物品无法使用该通货" };
    }
    return null;
  }
  function rarityName(r) { return { normal: "普通", magic: "魔法", rare: "稀有" }[r] || r; }

  const ACT = {};

  ACT.transmute = (item, o, rng) => {
    const c = checkRarity(item, "transmute"); if (c) return c;
    const floor = TIER_FLOOR[o.tier || "base"];
    const pairs = eligiblePairs(item, { source: "normal", floor, asRarity: "magic" });
    const pair = weightedPick(pairs, rng);
    if (!pair) {
      // 失神类基底（前后缀 -1）魔法品质 0/0：游戏允许蜕变，只变稀有度不加词缀
      // （PoE1 Simplex 同语义：transmute turns the item blue with no explicit modifiers）
      const cap = capsFor(item, "magic");
      if (pairs.length === 0 && cap.prefix <= 0 && cap.suffix <= 0) {
        const it = clone(item);
        it.rarity = "magic"; it.name = null;
        return { ok: true, item: it, cost: priceOf("transmute" + tierSuffix(o.tier)), events: [{ type: "no-affix", to: "magic" }] };
      }
      return { ok: false, reason: "没有可用词缀" };
    }
    const it = clone(item);
    it.rarity = "magic"; it.name = null;
    it.affixes.push(makeAffix(pair, rng, "normal"));
    return { ok: true, item: it, cost: priceOf("transmute" + tierSuffix(o.tier)), events: [{ type: "add", affix: it.affixes[it.affixes.length - 1] }] };
  };

  ACT.augment = (item, o, rng) => {
    const c = checkRarity(item, "augment"); if (c) return c;
    const floor = TIER_FLOOR[o.tier || "base"];
    const pairs = eligiblePairs(item, { source: "normal", floor });
    const pair = weightedPick(pairs, rng);
    if (!pair) return { ok: false, reason: "没有可用词缀（词缀已满）" };
    const it = clone(item);
    it.affixes.push(makeAffix(pair, rng, "normal"));
    return { ok: true, item: it, cost: priceOf("augment" + tierSuffix(o.tier)), events: [{ type: "add", affix: it.affixes[it.affixes.length - 1] }] };
  };

  ACT.regal = (item, o, rng) => {
    const c = checkRarity(item, "regal"); if (c) return c;
    const floor = TIER_FLOOR[o.tier || "base"];
    const omen = o.omen ? omenById.get(o.omen) : null;
    let constrain = omen && omen.constrainTo ? omen.constrainTo : null;
    if (omen && omen.homogenise) {
      // 同质化加冕：与现有词缀同侧（有前缀则加前缀，否则后缀）
      const cnt = affixCounts(item);
      constrain = cnt.prefix > 0 ? "prefix" : cnt.suffix > 0 ? "suffix" : null;
    }
    const pairs = eligiblePairs(item, { source: "normal", floor, asRarity: "rare", type: constrain });
    const pair = weightedPick(pairs, rng);
    if (!pair) return { ok: false, reason: constrain ? "加冕预兆：没有可用的" + (constrain === "prefix" ? "前缀" : "后缀") : "没有可用词缀" };
    const it = clone(item);
    it.rarity = "rare";
    it.affixes.push(makeAffix(pair, rng, "normal"));
    if (!it.name) it.name = rollName(it, rng);
    const cost = priceOf("regal" + tierSuffix(o.tier)) + (omen ? omenCost(omen.id) : 0);
    return { ok: true, item: it, cost, events: [{ type: "add", affix: it.affixes[it.affixes.length - 1], upgrade: "rare" }] };
  };

  ACT.exalt = (item, o, rng) => {
    const c = checkRarity(item, "exalt"); if (c) return c;
    const floor = TIER_FLOOR[o.tier || "base"];
    const omen = o.omen ? omenById.get(o.omen) : null;
    const constrain = omen && omen.constrainTo ? omen.constrainTo : null;
    const count = omen && omen.extraMods ? 1 + omen.extraMods : 1;
    // 催化升华预兆：消耗全部催化剂品质，匹配类别词缀权重 ×(1+品质/100)（官方未公布倍率，比例近似）
    const catalysing = omen && omen.consumeQuality && item.quality && item.quality.type && item.quality.value > 0;
    const qMult = catalysing ? (mod) => qualityMultFor(item, mod) : null;
    const it = clone(item);
    const events = [];
    for (let k = 0; k < count; k++) {
      const pairs = eligiblePairs(it, { source: "normal", floor, type: constrain, weightMult: qMult });
      const pair = weightedPick(pairs, rng);
      if (!pair) {
        if (k === 0) return { ok: false, reason: "没有可用词缀（词缀已满）" };
        break;
      }
      it.affixes.push(makeAffix(pair, rng, "normal"));
      events.push({ type: "add", affix: it.affixes[it.affixes.length - 1] });
    }
    if (catalysing) {
      it.quality = { type: item.quality.type, value: 0 };
      events.push({ type: "consume-quality" });
    }
    const cost = priceOf("exalt" + tierSuffix(o.tier)) + (omen ? omenCost(omen.id) : 0);
    return { ok: true, item: it, cost, events, experimental: !!(omen && omen.extraMods) };
  };

  function removeAffix(it, filter, rng) {
    const cand = it.affixes.filter(filter);
    if (!cand.length) return null;
    return cand[Math.floor(rng() * cand.length)];
  }
  function applyRemove(it, affix) {
    const i = it.affixes.indexOf(affix);
    if (i >= 0) it.affixes.splice(i, 1);
  }

  ACT.annul = (item, o, rng) => {
    const c = checkRarity(item, "annul"); if (c) return c;
    const omen = o.omen ? omenById.get(o.omen) : null;
    const it = clone(item);
    const events = [];
    const removals = omen && omen.extraRemovals ? 1 + omen.extraRemovals : 1;
    const filter = omen && omen.id === "OmenofLight"
      ? (a) => a.source === "desecrated" && !a.fractured
      : omen && omen.constrainTo
        ? (a) => modOf(a).type === omen.constrainTo && !a.fractured
        : (a) => !a.fractured;
    const failReason = omen && omen.id === "OmenofLight"
      ? "光之预兆：没有可移除的亵渎词缀"
      : omen && omen.constrainTo
        ? "没有可删除的" + (omen.constrainTo === "prefix" ? "前缀" : "后缀")
        : "物品上没有可移除的词缀（分裂词缀不可被移除）";
    for (let k = 0; k < removals; k++) {
      const target = removeAffix(it, filter, rng);
      if (!target) {
        if (k === 0) return { ok: false, reason: failReason };
        break; // 强效剥离：可移除词缀不足 2 条时移除全部可移除项
      }
      applyRemove(it, target);
      events.push({ type: "remove", affix: target });
    }
    const cost = priceOf("annul") + (omen ? omenCost(omen.id) : 0);
    return { ok: true, item: it, cost, events };
  };

  ACT.alchemy = (item, o, rng) => {
    const c = checkRarity(item, "alchemy"); if (c) return c;
    const omen = o.omen ? omenById.get(o.omen) : null;
    const it = clone(item);
    it.rarity = "rare"; it.name = rollName(it, rng);
    const events = [];
    // 0.3.1+：魔法物品点金为「重掷」——清空原有词缀后重新生成 4 条
    if (item.rarity === "magic" && it.affixes.length) {
      events.push({ type: "reroll-all", affixes: it.affixes.slice() });
      it.affixes = [];
    }
    // 默认 4 条：先保证 1 前 1 后，再随机补 2 条；炼金预兆将指定侧拉满（3+1）
    let plan;
    if (omen && omen.constrainTo === "prefix") plan = ["prefix", "prefix", "prefix", "suffix"];
    else if (omen && omen.constrainTo === "suffix") plan = ["suffix", "suffix", "suffix", "prefix"];
    else plan = ["prefix", "suffix", null, null];
    for (const t of plan) {
      const pairs = eligiblePairs(it, { source: "normal", type: t, asRarity: "rare" });
      const pair = weightedPick(pairs, rng);
      if (pair) { it.affixes.push(makeAffix(pair, rng, "normal")); events.push({ type: "add", affix: it.affixes[it.affixes.length - 1] }); }
    }
    const cost = priceOf("alchemy") + (omen ? omenCost(omen.id) : 0);
    return { ok: true, item: it, cost, events };
  };

  ACT.chaos = (item, o, rng) => {
    const c = checkRarity(item, "chaos"); if (c) return c;
    const floor = TIER_FLOOR[o.tier || "base"];
    const omen = o.omen ? omenById.get(o.omen) : null;
    const it = clone(item);
    let target;
    if (omen && omen.id === "OmenofWhittling") {
      // 消减预兆：移除词缀档位等级需求最低的一条（确定性；并列时随机）
      const cand = it.affixes.filter((a) => !a.fractured);
      if (!cand.length) return { ok: false, reason: "物品上没有可移除的词缀（分裂词缀不可被移除）" };
      let lowest = Infinity;
      for (const a of cand) lowest = Math.min(lowest, modOf(a).tiers[a.tierIdx].ilvl);
      target = removeAffix(it, (a) => !a.fractured && modOf(a).tiers[a.tierIdx].ilvl === lowest, rng);
    } else if (omen && omen.constrainTo) {
      target = removeAffix(it, (a) => modOf(a).type === omen.constrainTo && !a.fractured, rng);
      if (!target) return { ok: false, reason: "消抹预兆：没有可删除的" + (omen.constrainTo === "prefix" ? "前缀" : "后缀") };
    } else {
      target = removeAffix(it, (a) => !a.fractured, rng);
      if (!target) return { ok: false, reason: "物品上没有可移除的词缀（分裂词缀不可被移除）" };
    }
    applyRemove(it, target);
    const pairs = eligiblePairs(it, { source: "normal", floor });
    const pair = weightedPick(pairs, rng);
    if (!pair) return { ok: false, reason: "删词后没有可用词缀" };
    it.affixes.push(makeAffix(pair, rng, "normal"));
    const cost = priceOf("chaos" + tierSuffix(o.tier)) + (omen ? omenCost(omen.id) : 0);
    return { ok: true, item: it, cost, events: [{ type: "remove", affix: target }, { type: "add", affix: it.affixes[it.affixes.length - 1] }] };
  };

  /* 神圣石：重掷全部词缀的数值（词缀与档位不变）；圣化预兆：数值 ×80-120% 并打圣化标记 */
  ACT.divine = (item, o, rng) => {
    if (item.rarity !== "magic" && item.rarity !== "rare")
      return { ok: false, reason: "只能作用于魔法或稀有物品" };
    if (!item.affixes.length) return { ok: false, reason: "物品上没有词缀" };
    const omen = o.omen ? omenById.get(o.omen) : null;
    const it = clone(item);
    const events = [];
    if (omen && omen.sanctify) {
      // 圣化：数值整体乘 0.8~1.2（一次性决定），并标记圣化
      const factor = 0.8 + rng() * 0.4;
      for (const a of it.affixes) {
        const mod = modsById.get(a.modId);
        a.values = rollAffixValues(mod, a.tierIdx, rng).map((v) => Math.round(v * factor * 10) / 10);
      }
      it.sanctified = true;
      events.push({ type: "sanctify", factor, affixes: it.affixes });
    } else {
      // 祝圣（the Blessed）在模拟器中基底隐匿为固定值，重掷行为与普通神圣一致
      for (const a of it.affixes) {
        const mod = modsById.get(a.modId);
        a.values = rollAffixValues(mod, a.tierIdx, rng);
      }
      events.push({ type: "reroll", affixes: it.affixes });
    }
    const cost = priceOf("divine") + (omen ? omenCost(omen.id) : 0);
    return { ok: true, item: it, cost, events };
  };

  /* 破溃宝珠：分裂（锁定）稀有物品（≥4 词缀）上的一个随机未分裂词缀 */
  ACT.fracture = (item, o, rng) => {
    if (item.rarity !== "rare") return { ok: false, reason: "只能作用于稀有物品" };
    if (item.affixes.length < 4) return { ok: false, reason: "需要至少 4 条词缀" };
    const cand = item.affixes.filter((a) => !a.fractured);
    if (!cand.length) return { ok: false, reason: "没有可分裂的词缀（均已分裂）" };
    const it = clone(item);
    const pick = cand[Math.floor(rng() * cand.length)];
    const affix = it.affixes.find((a) => a === pick || (a.modId === pick.modId && a.tierIdx === pick.tierIdx));
    affix.fractured = true;
    return { ok: true, item: it, cost: priceOf("fracturing"), events: [{ type: "fracture", affix }] };
  };

  /* 辛格拉的发辫：预示下一个通货的效果（引擎只打标记，预览/确认由 UI 层完成） */
  ACT.hinekora = (item, o, rng) => {
    const it = clone(item);
    it.foresee = true;
    return { ok: true, item: it, cost: priceOf("hinekora"), events: [{ type: "foresee" }] };
  };

  ACT.essence = (item, o, rng) => {
    // o: {essence:'Abrasion', tier:'LESSER'|'NORMAL'|'GREATER'|'PERFECT', omen?}
    if (item.rarity === "rare" && o.tier !== "PERFECT")
      return { ok: false, reason: "只有完美精华可用于稀有物品（替换一条词缀）" };
    if (item.rarity === "normal" || item.rarity === "magic") {
      // ok
    } else if (item.rarity === "rare") {
      // 完美精华：移除一条（预兆可限定前后缀）
    } else {
      return { ok: false, reason: rarityName(item.rarity) + "物品无法使用精华" };
    }
    const entry = essenceIndex.get(poolKeyOf(item) + "|" + o.essence + "|" + o.tier);
    if (!entry) return { ok: false, reason: "该精华不适用于此部位/基底" };
    const mod = modsById.get(entry.modId);
    // 规则（0.5 / POE2_HTC）：一件物品最多同时携带 1 条精华词缀（普通+完美合并计数，互斥）；
    // 其次才按词缀家族互斥（同族/同 id 不可叠加）。
    if (item.affixes.some((a) => a.source === "essence"))
      return { ok: false, reason: "物品已携带一条精华词缀，无法再使用精华（上限 1 条）" };
    if (item.affixes.some((a) => modOf(a).family === mod.family || a.modId === mod.id))
      return { ok: false, reason: "已存在同族词缀，无法使用该精华" };
    const it = clone(item);
    const events = [];
    const omen = o.omen ? omenById.get(o.omen) : null;
    if (item.rarity === "rare") {
      // 完美精华：替换同类型词缀（预兆可限定前/后缀），保持 3前3后上限
      const wantType = omen && omen.constrainTo ? omen.constrainTo : mod.type;
      const target = removeAffix(it, (a) => modOf(a).type === wantType && !a.fractured, rng);
      if (!target) return { ok: false, reason: "没有可替换的" + (wantType === "prefix" ? "前缀" : "后缀") };
      applyRemove(it, target);
      events.push({ type: "remove", affix: target });
    }
    if (item.rarity === "normal") { it.rarity = "magic"; }
    else if (item.rarity === "magic") { it.rarity = "rare"; if (!it.name) it.name = rollName(it, rng); }
    // 空位检查：强制词缀同样要占位（失神类基底魔法品质 0/0，精华也无法附加）
    const cap2 = capsFor(it, it.rarity);
    const cnt2 = affixCounts(it);
    if (mod.type === "prefix" ? cnt2.prefix >= cap2.prefix : cnt2.suffix >= cap2.suffix)
      return { ok: false, reason: "该基底没有可用的" + (mod.type === "prefix" ? "前缀" : "后缀") + "词缀位" };
    const affix = {
      modId: mod.id, tierIdx: entry.tierIndex,
      values: rollAffixValues(mod, entry.tierIndex, rng),
      source: "essence",
    };
    it.affixes.push(affix);
    events.push({ type: "add", affix });
    const priceKey = { LESSER: "essence_lesser", NORMAL: "essence", GREATER: "essence_greater", PERFECT: "perfect_essence" }[o.tier];
    return { ok: true, item: it, cost: priceOf(priceKey) + (omen ? omenCost(omen.id) : 0), events };
  };

  /* 蒸馏情感（0.5 谵妄）：对稀有基础/时逝珠宝 —— 移除一条随机词缀，
   * 附加一条保证的工艺词缀（按情感 × 珠宝颜色，凶暴/轻蔑可选前缀或后缀变体） */
  ACT.liquidEmotion = (item, o, rng) => {
    const e = liquidById.get(o.emotion);
    if (!e) return { ok: false, reason: "未知蒸馏情感" };
    if (!item.classId || item.classId.indexOf("Jewels") !== 0)
      return { ok: false, reason: "蒸馏情感只能作用于珠宝" };
    if (item.rarity !== "rare") return { ok: false, reason: "蒸馏情感只能作用于稀有珠宝" };
    const tl = isTimeLostJewel(item);
    if (e.target === "timelost" && !tl) return { ok: false, reason: "远古蒸馏情感只能作用于时逝珠宝" };
    if (e.target === "basic" && tl) return { ok: false, reason: "普通蒸馏情感只能作用于基础珠宝（红玉/翡翠/蓝玉/宝钻）" };
    const color = jewelColorOf(item);
    if (!color) return { ok: false, reason: "无法识别珠宝颜色" };
    // 凶暴/轻蔑有前后缀两个变体；其余情感每颜色只有单一词缀，自动回退
    const wantSlot = o.variant === "suffix" ? color + "S" : color;
    const slot = e.affixes[wantSlot] ? wantSlot : (e.affixes[color] ? color : color + "S");
    const aff = e.affixes[slot];
    if (!aff) return { ok: false, reason: "该情感不适用于此珠宝颜色" };
    const nCrafted = item.affixes.filter((a) => a.source === "liquid").length;
    if (nCrafted >= liquidCapOf(item))
      return { ok: false, reason: "工艺词缀已达上限（" + liquidCapOf(item) + " 条，阿斯特丽德的创造 +1）" };
    const it = clone(item);
    // 移除词缀：优先移除与工艺词缀同侧的一条（保证槽位可放下；游戏原文只说“随机移除”，此处近似）
    const mod0 = modsById.get("Liquid/" + e.id + "_" + slot);
    let removable = it.affixes.filter((a) => !a.fractured && modOf(a).type === mod0.type);
    if (!removable.length) removable = it.affixes.filter((a) => !a.fractured);
    if (!removable.length) return { ok: false, reason: "没有可移除的词缀" };
    const target = removable[Math.floor(rng() * removable.length)];
    applyRemove(it, target);
    const mod = modsById.get("Liquid/" + e.id + "_" + slot);
    const cnt = affixCounts(it);
    const cap2 = capsFor(it);
    if (cnt[mod.type] >= cap2[mod.type])
      return { ok: false, reason: "移除随机词缀后" + (mod.type === "prefix" ? "前缀" : "后缀") + "位已满，无法附加该工艺词缀" };
    const affix = {
      modId: mod.id, tierIdx: 0,
      values: mod.tiers[0].ranges.map((r) => rollRange(r[0], r[1], rng)),
      source: "liquid",
    };
    it.affixes.push(affix);
    return { ok: true, item: it, cost: e.price || 0, events: [{ type: "remove", affix: target }, { type: "add", affix }] };
  };

  /* ---------- 渎灵（Desecrate，0.5 官方术语）----------
   * 通货按部位分三件：遗存颚骨（武器/箭袋）、遗存肋骨（护甲）、遗存锁骨（项链/戒指/腰带）；
   * 每件有三档：啃噬（仅 ilvl≤64 的低档池）、遗存（无限制）、远古（词缀等级 ≥40）。
   * 预兆可叠加：死灵（左/右旋，限前/后缀）+ 首领（黑血/领主/至高，锁 boss 池）+ 揭示（回响/腐化揭示）。 */
  const BONE_SLOT = { weapon: ["Bows", "Spears", "Crossbows", "Quarterstaves", "OneHand_Maces", "TwoHand_Maces", "Staves", "Wands", "Sceptres", "Foci", "Quivers", "Talismans"], armour: ["Helmets", "Body_Armours", "Boots", "Gloves", "Shields", "Bucklers"], jewellery: ["Amulets", "Rings", "Belts"] };
  const BONE_TIER = {
    gnawed: { zh: "啃噬", maxIlvl: 64, priceMult: 1 / 3 },   // 只出 ilvl≤64 的低档渎灵词缀
    preserved: { zh: "遗存", priceMult: 1 },                 // 无限制
    ancient: { zh: "远古", floor: 40, priceMult: 2.8 },      // 只出词缀等级 ≥40 的高档渎灵词缀
  };
  function boneNameFor(classId, tier) {
    const t = BONE_TIER[tier || "preserved"] || BONE_TIER.preserved;
    const slot = BONE_SLOT.weapon.includes(classId) ? "颚骨" : BONE_SLOT.armour.includes(classId) ? "肋骨" : "锁骨";
    return t.zh + slot;
  }
  // 预兆多选聚合：数组 -> { constrainTo, boss, echoes, putrefaction }
  function omenEffects(omenIds) {
    const ids = Array.isArray(omenIds) ? omenIds : omenIds ? [omenIds] : [];
    const out = { constrainTo: null, boss: null, echoes: false, putrefaction: false };
    for (const id of ids) {
      const o = omenById.get(id);
      if (!o) continue;
      if (o.constrainTo) out.constrainTo = o.constrainTo;
      if (o.boss) out.boss = o.boss;
      if (o.extraCandidates) out.echoes = true;
      if (o.putrefaction) out.putrefaction = true;
    }
    return out;
  }

  ACT.desecrated = (item, o, rng) => {
    const c = checkRarity(item, "desecrated"); if (c) return c;
    const omens = Array.isArray(o.omens) ? o.omens : o.omen ? [o.omen] : [];
    const omenCostSum = omens.reduce((s, id) => s + omenCost(id), 0);
    const tier = BONE_TIER[o.boneTier || "preserved"] || BONE_TIER.preserved;
    if (tier.maxIlvl && item.ilvl > tier.maxIlvl)
      return { ok: false, reason: boneNameFor(item.classId, o.boneTier) + "只能用于物品等级 ≤ " + tier.maxIlvl + " 的物品" };
    // 两步流程第一步：添加骨头 phantom 槽（等待揭示），记录档位供揭示使用
    if (!item.bonePhantom) {
      const it = clone(item);
      it.bonePhantom = { pending: true, tier: o.boneTier || "preserved", omens: omens.slice() };
      return { ok: true, item: it, cost: priceOf("desecrate") * tier.priceMult + omenCostSum, events: [{ type: "bone" }] };
    }
    // 已有 phantom：由 UI 弹窗走描述，这里兜底不做
    return { ok: false, reason: "已加骨，等待揭示" };
  };

  /* 瓦尔催化注入器（0.5）：戒指/项链品质超上限 +1~10（总上限 max+10），
   * 只能用于已达品质上限的物品，每次有腐化风险（官方未公布概率，近似 30%）。
   * 腐化后物品锁定，无法再使用任何通货。 */
  ACT.vaalQuality = (item, o, rng) => {
    if (item.classId !== "Rings" && item.classId !== "Amulets")
      return { ok: false, reason: "瓦尔催化注入器只能用于戒指或项链" };
    const q = item.quality;
    if (!q || !q.type) return { ok: false, reason: "先上催化剂品质" };
    const max = maxQualityOf(item);
    if (q.value < max) return { ok: false, reason: "只能用于已达到品质上限的物品（当前 " + q.value + "%/" + max + "%）" };
    if (q.value >= max + 10) return { ok: false, reason: "已达到超上限的最大品质（" + (max + 10) + "%）" };
    const it = clone(item);
    const gain = Math.min(max + 10 - q.value, 1 + Math.floor(rng() * 10));
    it.quality = { type: q.type, value: q.value + gain };
    const events = [{ type: "quality", gain }];
    if (rng() < 0.3) { it.corrupted = true; events.push({ type: "corrupt" }); }
    return { ok: true, item: it, cost: priceOf("vaal_catalysing"), events };
  };

  function tierSuffix(t) { return t && t !== "base" ? "_" + t : ""; }

  /* ---------- 品质（催化剂，0.5）：匹配类别的词缀数值 ×(1+品质/100) ---------- */
  // 12 种珠宝催化剂 -> 词缀类别匹配（基于 mods 的 categories 细分标签）
  const CATALYST_MATCH = {
    attribute: (c) => /attribute/.test(c) || ["strength", "dexterity", "intelligence", "all_attributes"].includes(c),
    defences: (c) => /armour|evasion|energy_shield|defen|deflection|ward/.test(c),
    life: (c) => /life/.test(c),
    mana: (c) => /mana/.test(c),
    speed: (c) => /speed/.test(c),
    attack: (c) => /attack|accuracy/.test(c),
    caster: (c) => /spell|cast/.test(c),
    minion: (c) => /minion|companion|allies/.test(c),
    chaos: (c) => /chaos/.test(c),
    lightning: (c) => /lightning/.test(c),
    cold: (c) => /cold/.test(c),
    fire: (c) => /fire/.test(c),
  };
  function qualityMultFor(item, mod) {
    const q = item && item.quality;
    if (!q || !q.value || !q.type || !mod) return 1;
    const f = CATALYST_MATCH[q.type];
    if (!f) return 1;
    return (mod.categories || []).some(f) ? 1 + q.value / 100 : 1;
  }
  // 品质上限：20 基础 + 基底隐匿（裂隙戒指 +20 / 精炼裂隙戒指 +25）+ 每条裂隙精化词缀 +20。
  // 注意：已打的品质不随上限回落而降低（品质上限词缀被移除时仅影响后续可打上限）。
  function maxQualityOf(item) {
    let max = 20;
    const base = item && baseIndex.get(item.classId + "/" + item.baseId);
    if (base && base.implicit) {
      const m = base.implicit.match(/品质上限\s*\+(\d+)%/);
      if (m) max += +m[1];
    }
    if (item && item.affixes) {
      for (const a of item.affixes) if (modsById.get(a.modId) === BREACH_QUALITY_MOD) max += 20;
    }
    return max;
  }

  /* 裂隙精华：移除一条随机词缀，并添加保底前缀「品质上限 +20%」（仅稀有戒指/项链） */
  ACT.breachEssence = (item, o, rng) => {
    if (item.classId !== "Rings" && item.classId !== "Amulets")
      return { ok: false, reason: "裂隙精华只能用于戒指或项链" };
    if (item.rarity !== "rare") return { ok: false, reason: "只能作用于稀有物品" };
    if (item.affixes.some((a) => modOf(a).family === BREACH_QUALITY_MOD.family))
      return { ok: false, reason: "已携带品质上限词缀，无法再使用" };
    const it = clone(item);
    const removable = it.affixes.filter((a) => !a.fractured);
    if (!removable.length) return { ok: false, reason: "没有可移除的词缀" };
    const target = removable[Math.floor(rng() * removable.length)];
    applyRemove(it, target);
    const cnt = it.affixes.reduce((n, a) => n + (modOf(a).type === "prefix" ? 1 : 0), 0);
    if (cnt >= capsFor(it).prefix)
      return { ok: false, reason: "前缀位已满 —— 需先腾出一个前缀位（或移除的恰好是前缀）" };
    it.affixes.push({ modId: BREACH_QUALITY_MOD.id, tierIdx: 0, values: [20], source: "breach" });
    return { ok: true, item: it, cost: priceOf("breach_essence") + (o.omen ? omenCost(o.omen) : 0),
      events: [{ type: "remove", affix: target }, { type: "add", affix: it.affixes[it.affixes.length - 1] }] };
  };

  /* 合金（0.5 Verisium 残迹产出）：稀有物品 —— 移除一条随机词缀，附加该合金对当前部位的保证词缀。
   * 游戏原文只保证「随机移除一条」，这里优先移除同侧词缀以保证能放下（近似，同蒸馏情感处理）。 */
  ACT.alloy = (item, o, rng) => {
    const alloy = alloyById.get(o.alloy);
    if (!alloy) return { ok: false, reason: "未知合金" };
    if (item.rarity !== "rare") return { ok: false, reason: "合金只能作用于稀有物品" };
    const idx = alloyModFor(item, alloy);
    if (idx < 0) return { ok: false, reason: alloy.zh + "不适用于该部位（可用于：" + (alloyClassZh(alloy) || "—") + "）" };
    const m = alloy.mods[idx];
    const modId = "Alloy/" + alloy.id + "_" + idx;
    const it = clone(item);
    let removable = it.affixes.filter((a) => !a.fractured && modOf(a).type === m.type);
    if (!removable.length) {
      const cnt = it.affixes.reduce((n, a) => n + (modOf(a).type === m.type ? 1 : 0), 0);
      if (cnt >= capsFor(it)[m.type])
        return { ok: false, reason: (m.type === "prefix" ? "前缀" : "后缀") + "位已满且没有同侧词缀可替换" };
      removable = it.affixes.filter((a) => !a.fractured);
    }
    if (!removable.length) return { ok: false, reason: "没有可移除的词缀" };
    const target = removable[Math.floor(rng() * removable.length)];
    applyRemove(it, target);
    const cnt2 = it.affixes.reduce((n, a) => n + (modOf(a).type === m.type ? 1 : 0), 0);
    if (cnt2 >= capsFor(it)[m.type])
      return { ok: false, reason: "移除随机词缀后" + (m.type === "prefix" ? "前缀" : "后缀") + "位已满，无法附加保证词缀" };
    const affix = { modId, tierIdx: 0, values: m.ranges.map((r) => rollRange(r[0], r[1], rng)), source: "alloy" };
    it.affixes.push(affix);
    return { ok: true, item: it, cost: alloy.price || 0, events: [{ type: "remove", affix: target }, { type: "add", affix }] };
  };

  /* 涂油注入（0.5 枯萎之树 The Withered Willow）：3 种有序液体情感为项链注入一个专精天赋。
   * 附魔不占词缀位；模拟器允许重复注入覆盖（游戏内同样可覆盖涂油）。 */
  ACT.instill = (item, o) => {
    const n = anointBySlug.get(o.slug);
    if (!n) return { ok: false, reason: "未知专精天赋" };
    if (item.classId !== "Amulets") return { ok: false, reason: "涂油注入只能作用于项链" };
    const cost = n.emotions.reduce((s, id) => s + ((anointEmotionById.get(id) || {}).price || 0), 0);
    const it = clone(item);
    const replaced = !!it.anoint;
    it.anoint = { slug: n.slug };
    return { ok: true, item: it, cost, events: [{ type: "anoint", slug: n.slug, replaced }] };
  };

  /* 首领预兆仅适用于武器或珠宝（poe2db 原文；护甲为肋骨渎灵，不可用）——含腰带（锁骨部位） */  const BOSS_ALLOWED_CLASSES = new Set([
    "Bows", "Spears", "Crossbows", "Quarterstaves", "OneHand_Maces", "TwoHand_Maces",
    "Staves", "Wands", "Sceptres", "Foci", "Quivers", "Rings", "Amulets", "Talismans", "Belts",
  ]);
  function bossOmenAllowed(classId) { return BOSS_ALLOWED_CLASSES.has(classId); }

  /* ---------- 深渊揭示（三选一 / 深渊回响六选一） ---------- */
  // 从渎灵池（普通 ∪ 渎灵）抽样 N 个不同词缀的候选（去重：同一 mod 只出现一次，取第一档）
  // opts: { omens:[] | omen, boneTier, floor, boss, echoes } —— 预兆可叠加：死灵限侧 + 首领锁池 + 回响改 6 候选
  function desecrateCandidates(item, opts, rng) {
    const o = Object.assign({ floor: 0, boss: null, echoes: false }, opts || {});
    // 预兆来源：显式传入 > 加骨时快照的 bonePhantom.omens
    const omenIds = o.omens || (o.omen ? [o.omen] : null) || (item.bonePhantom && item.bonePhantom.omens) || [];
    const eff = omenEffects(omenIds);
    const tier = BONE_TIER[o.boneTier || (item.bonePhantom && item.bonePhantom.tier) || "preserved"] || BONE_TIER.preserved;
    const floor = Math.max(o.floor || 0, tier.floor || 0);
    const maxIlvl = tier.maxIlvl || null;
    const pairs = eligiblePairs(item, { source: "desecrated", asRarity: "rare", type: eff.constrainTo, floor, maxIlvl, boss: o.boss || eff.boss });
    // 每个 mod 只保留一个（最高权重档）
    const byMod = new Map();
    for (const p of pairs) {
      const g = byMod.get(p.mod.id);
      if (!g || p.weight > g.weight) byMod.set(p.mod.id, p);
    }
    const uniq = [...byMod.values()];
    const n = (o.echoes || eff.echoes) ? 6 : 3;
    const out = [];
    const pool = uniq.slice();
    while (out.length < n && pool.length) {
      const total = pool.reduce((s, p) => s + p.weight, 0);
      let r = rng() * total;
      let idx = 0;
      for (let i = 0; i < pool.length; i++) { r -= pool[i].weight; if (r <= 0) { idx = i; break; } }
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }
  function applyDesecrate(item, pair, rng) {
    const it = clone(item);
    it.affixes.push(makeAffix(pair, rng, "desecrated"));
    delete it.bonePhantom; // 揭示完成，消耗骨头槽
    return it;
  }

  const ENGINE = {
    modsById, classById, classList, baseIndex, poolsByClass, poolKeyOf,
    essenceIndex, essencesByClass, omenById, CAPS, capsFor, TIER_FLOOR,
    makeRng, defaultRng,
    newItem, clone, affixCounts, freeTypes,
    eligiblePairs, probabilityTable,
    rollAffixValues, rollName,
    desecrateCandidates, applyDesecrate, bossOmenAllowed,
    qualityMultFor, maxQualityOf, BREACH_QUALITY_MOD,
    boneNameFor, omenEffects, BONE_TIER,
    ALDUR, runeById, liquidById, LIQUID_CAP_ADJ,
    AUGM, augmentById, augmentEffectFor, augmentApplicable,
    socketAugment, unsocketAugment, addSocket, socketsUsedOf, augmentStatsOf,
    alloyById, anointBySlug, anointByCombo, anointEmotionById, alloyModFor, alloyClassZh,
    runeSlotsOf, runeApplicable, socketRune, unsocketRune,
    liquidCapOf, jewelColorOf, isTimeLostJewel, extraPoolsOf,
    act: (item, action, opts, rng) => {
      if (item && item.corrupted) return { ok: false, reason: "物品已腐化，无法再使用通货" };
      return ACT[action](item, opts || {}, rng || defaultRng);
    },
    rarityName,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = ENGINE;
  global.POE2_ENGINE = ENGINE;
})(typeof window !== "undefined" ? window : globalThis);
