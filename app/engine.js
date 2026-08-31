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
    const cap = CAPS[asRarity || item.rarity];
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
  function eligiblePairs(item, opts) {
    const o = Object.assign({ source: "normal", type: null, floor: 0, boss: null, asRarity: null }, opts);
    const types = freeTypes(item, o.type, o.asRarity);
    if (!types.length) return [];
    const takenIds = new Set(item.affixes.map((a) => a.modId));
    const takenFam = new Set(item.affixes.map((a) => modOf(a).family));
    const srcs = o.source === "desecrated" ? ["desecrated", "normal"] : [o.source];
    const out = [];
    for (const src of srcs) {
      const pool = poolsByClass[item.classId] && poolsByClass[item.classId][src];
      if (!pool) continue;
      for (const t of types) {
        for (const mod of pool[t === "prefix" ? "prefixes" : "suffixes"]) {
          if (takenIds.has(mod.id) || takenFam.has(mod.family)) continue;
          if (o.boss && (src !== "desecrated" || mod.boss !== o.boss)) continue;
          for (let i = 0; i < mod.tiers.length; i++) {
            const tier = mod.tiers[i];
            if (tier.ilvl > item.ilvl) continue;   // 物品等级不足
            if (tier.ilvl < o.floor) continue;     // 通货档位下限
            out.push({ mod, tierIdx: i, weight: weightOf(mod, tier) });
          }
        }
      }
    }
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
      annul: ["magic", "rare"], desecrated: ["rare"], chaos: ["rare"], alchemy: ["normal"],
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
    if (!pair) return { ok: false, reason: "没有可用词缀" };
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
    const pairs = eligiblePairs(item, { source: "normal", floor, asRarity: "rare" });
    const pair = weightedPick(pairs, rng);
    if (!pair) return { ok: false, reason: "没有可用词缀" };
    const it = clone(item);
    it.rarity = "rare";
    it.affixes.push(makeAffix(pair, rng, "normal"));
    if (!it.name) it.name = rollName(it, rng);
    return { ok: true, item: it, cost: priceOf("regal" + tierSuffix(o.tier)), events: [{ type: "add", affix: it.affixes[it.affixes.length - 1], upgrade: "rare" }] };
  };

  ACT.exalt = (item, o, rng) => {
    const c = checkRarity(item, "exalt"); if (c) return c;
    const floor = TIER_FLOOR[o.tier || "base"];
    const omen = o.omen ? omenById.get(o.omen) : null;
    const constrain = omen && omen.constrainTo ? omen.constrainTo : null;
    const count = omen && omen.extraMods ? 1 + omen.extraMods : 1;
    const it = clone(item);
    const events = [];
    for (let k = 0; k < count; k++) {
      const pairs = eligiblePairs(it, { source: "normal", floor, type: constrain });
      const pair = weightedPick(pairs, rng);
      if (!pair) {
        if (k === 0) return { ok: false, reason: "没有可用词缀（词缀已满）" };
        break;
      }
      it.affixes.push(makeAffix(pair, rng, "normal"));
      events.push({ type: "add", affix: it.affixes[it.affixes.length - 1] });
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
    let target = null;
    if (omen && omen.id === "OmenofLight") {
      target = removeAffix(it, (a) => a.source === "desecrated" && !a.fractured, rng);
      if (!target) return { ok: false, reason: "光之预兆：没有可移除的亵渎词缀" };
    } else if (omen && omen.constrainTo) {
      target = removeAffix(it, (a) => modOf(a).type === omen.constrainTo && !a.fractured, rng);
      if (!target) return { ok: false, reason: "没有可删除的" + (omen.constrainTo === "prefix" ? "前缀" : "后缀") };
    } else {
      target = removeAffix(it, (a) => !a.fractured, rng);
      if (!target) return { ok: false, reason: "物品上没有可移除的词缀（分裂词缀不可被移除）" };
    }
    applyRemove(it, target);
    const cost = priceOf("annul") + (omen ? omenCost(omen.id) : 0);
    return { ok: true, item: it, cost, events: [{ type: "remove", affix: target }] };
  };

  ACT.alchemy = (item, o, rng) => {
    const c = checkRarity(item, "alchemy"); if (c) return c;
    const it = clone(item);
    it.rarity = "rare"; it.name = rollName(it, rng);
    const events = [];
    // 4 条词缀：先保证 1 前 1 后，再随机补 2 条
    for (const t of ["prefix", "suffix"]) {
      const pairs = eligiblePairs(it, { source: "normal", type: t, asRarity: "rare" });
      const pair = weightedPick(pairs, rng);
      if (pair) { it.affixes.push(makeAffix(pair, rng, "normal")); events.push({ type: "add", affix: it.affixes[it.affixes.length - 1] }); }
    }
    for (let k = 0; k < 2; k++) {
      const pairs = eligiblePairs(it, { source: "normal", asRarity: "rare" });
      const pair = weightedPick(pairs, rng);
      if (pair) { it.affixes.push(makeAffix(pair, rng, "normal")); events.push({ type: "add", affix: it.affixes[it.affixes.length - 1] }); }
    }
    return { ok: true, item: it, cost: priceOf("alchemy"), events };
  };

  ACT.chaos = (item, o, rng) => {
    const c = checkRarity(item, "chaos"); if (c) return c;
    const floor = TIER_FLOOR[o.tier || "base"];
    const it = clone(item);
    const target = removeAffix(it, (a) => !a.fractured, rng);
    if (!target) return { ok: false, reason: "物品上没有可移除的词缀（分裂词缀不可被移除）" };
    applyRemove(it, target);
    const pairs = eligiblePairs(it, { source: "normal", floor });
    const pair = weightedPick(pairs, rng);
    if (!pair) return { ok: false, reason: "删词后没有可用词缀" };
    it.affixes.push(makeAffix(pair, rng, "normal"));
    return { ok: true, item: it, cost: priceOf("chaos" + tierSuffix(o.tier)), events: [{ type: "remove", affix: target }, { type: "add", affix: it.affixes[it.affixes.length - 1] }] };
  };

  /* 神圣石：重掷全部词缀的数值（词缀与档位不变） */
  ACT.divine = (item, o, rng) => {
    if (item.rarity !== "magic" && item.rarity !== "rare")
      return { ok: false, reason: "只能作用于魔法或稀有物品" };
    if (!item.affixes.length) return { ok: false, reason: "物品上没有词缀" };
    const it = clone(item);
    for (const a of it.affixes) {
      const mod = modsById.get(a.modId);
      a.values = rollAffixValues(mod, a.tierIdx, rng);
    }
    return { ok: true, item: it, cost: priceOf("divine"), events: [{ type: "reroll", affixes: it.affixes }] };
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
    const entry = essenceIndex.get(item.classId + "|" + o.essence + "|" + o.tier);
    if (!entry) return { ok: false, reason: "该精华不适用于此武器类型" };
    const mod = modsById.get(entry.modId);
    // 与现有词缀的 family 冲突检查（精华词缀若与现有 family 冲突，游戏表现为覆盖？——保守：不允许）
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

  ACT.desecrated = (item, o, rng) => {
    const c = checkRarity(item, "desecrated"); if (c) return c;
    const omen = o.omen ? omenById.get(o.omen) : null;
    let boss = null, constrain = null;
    if (omen) {
      if (omen.id === "OmenoftheBlackblooded") boss = "kurgal";
      else if (omen.id === "OmenoftheLiege") boss = "amanamu";
      else if (omen.id === "OmenoftheSovereign") boss = "ulaman";
      else if (omen.constrainTo) constrain = omen.constrainTo;
    }
    const pairs = eligiblePairs(item, { source: "desecrated", type: constrain, boss });
    // boss 预兆：强制从首领池等权抽取
    if (boss) for (const p of pairs) p.weight = 1;
    const pair = weightedPick(pairs, rng);
    if (!pair) return { ok: false, reason: boss ? "该首领池没有可用词缀" : "没有可用词缀（词缀已满）" };
    const it = clone(item);
    it.affixes.push(makeAffix(pair, rng, pair.mod.source));
    const cost = priceOf("desecrate") + (omen ? omenCost(omen.id) : 0);
    return { ok: true, item: it, cost, events: [{ type: "add", affix: it.affixes[it.affixes.length - 1] }] };
  };

  function tierSuffix(t) { return t && t !== "base" ? "_" + t : ""; }

  const ENGINE = {
    modsById, classById, classList, baseIndex, poolsByClass,
    essenceIndex, essencesByClass, omenById, CAPS, TIER_FLOOR,
    makeRng, defaultRng,
    newItem, clone, affixCounts, freeTypes,
    eligiblePairs, probabilityTable,
    rollAffixValues, rollName,
    act: (item, action, opts, rng) => ACT[action](item, opts || {}, rng || defaultRng),
    rarityName,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = ENGINE;
  global.POE2_ENGINE = ENGINE;
})(typeof window !== "undefined" ? window : globalThis);
