/* 武器数值统计：DPS / 攻速 / 暴击。局部词缀按 poe2db 字段识别。 */
(function (global) {
  "use strict";
  const E = global.POE2_ENGINE;
  const D = global.POE2_DATA;
  const M = E.modsById;

  const FLAT = {
    phys: ["PHYSICAL_DAMAGE_FLAT", "ESSENCE_PHYSICAL_DAMAGE_FLAT"],
    fire: ["FIRE_DAMAGE_FLAT", "ESSENCE_FIRE_DAMAGE_FLAT"],
    cold: ["COLD_DAMAGE_FLAT", "ESSENCE_COLD_DAMAGE_FLAT"],
    lightning: ["LIGHTNING_DAMAGE_FLAT", "ESSENCE_LIGHTNING_DAMAGE_FLAT"],
  };
  const INC_PHYS = ["INCREASED_PHYSICAL_DAMAGE_PERCENT", "HYBRID_INCREASED_PHYSICAL_DAMAGE_PERCENT_AND_ACCURACY_RATING"];
  const INC_ELE_ATK = ["INCREASED_ELEMENTAL_DAMAGE_WITH_ATTACKS", "DESECRATED_INCREASED_ELEMENTAL_DAMAGE"];
  const INC_AS = ["INCREASED_ATTACK_SPEED", "ESSENCE_INCREASED_ATTACK_SPEED"];
  const CRIT_CH = ["CRITICAL_HIT_CHANCE", "ESSENCE_CRITICAL_STRIKE_CHANCE"];
  const CRIT_DMG = ["CRITICAL_DAMAGE_BONUS"];

  function sumField(item, fields, valueIdx) {
    let v = 0;
    for (const a of item.affixes) {
      const m = M.get(a.modId);
      if (!m) continue;
      if (fields.includes(m.field)) v += a.values[valueIdx || 0];
    }
    return v;
  }
  // "% increased Physical Damage, #% reduced Attack Speed" 亵渎混合词缀
  function hybridPhysReducedAS(item) {
    let inc = 0, red = 0;
    for (const a of item.affixes) {
      const m = M.get(a.modId);
      if (m && m.field === "DESECRATED_INCREASED_PHYSICAL_DAMAGE_REDUCED_ATTACK_SPEED") {
        inc += a.values[0]; red += a.values[1];
      }
    }
    return { inc, red };
  }

  function weaponStats(item) {
    const base = E.baseIndex.get(item.classId + "/" + item.baseId);
    const cls = E.classById.get(item.classId);
    if (!base || !cls) return null;
    // 武器分类下所有类都显示 DPS 面板；无基础攻速/伤害的类（法器/箭袋/魔符）以 1.0 攻速 + 附加伤害词缀计算
    const isWeaponCat = cls.attack || ["Foci", "Quivers", "Talismans"].includes(item.classId);
    if (!isWeaponCat) return null;
    const rng = E.defaultRng;

    const flatPhysLo = sumRange(item, FLAT.phys, 0), flatPhysHi = sumRange(item, FLAT.phys, 1);
    const aug = (E.augmentStatsOf && E.augmentStatsOf(item)) || { physInc: 0, ele: {} }; // 镶嵌符文的固定加成
    const incPhys = sumField(item, INC_PHYS, 0) + hybridPhysReducedAS(item).inc + aug.physInc;
    const redAS = hybridPhysReducedAS(item).red;
    const incAS = sumField(item, INC_AS, 0) - redAS;
    const incEle = sumField(item, INC_ELE_ATK, 0);

    const basePhys = base.phys || [0, 0];
    const physLo = (basePhys[0] + flatPhysLo) * (1 + incPhys / 100);
    const physHi = (basePhys[1] + flatPhysHi) * (1 + incPhys / 100);

    const eles = {};
    for (const [k, fields] of Object.entries(FLAT)) {
      if (k === "phys") continue;
      const lo = sumRange(item, fields, 0) + (base.ele && base.ele[k] ? base.ele[k][0] : 0);
      const hi = sumRange(item, fields, 1) + (base.ele && base.ele[k] ? base.ele[k][1] : 0);
      if (lo || hi) eles[k] = [lo, hi];
    }
    // 混伤基底的隐藏元素已并入 base.ele；混沌同理
    if (base.ele && base.ele.chaos) {
      const lo = base.ele.chaos[0], hi = base.ele.chaos[1];
      if (lo || hi) eles.chaos = [lo, hi];
    }
    // 镶嵌符文的附加元素伤害（如 沙漠/冰川/风暴符文 在武器上）
    for (const [k, [lo, hi]] of Object.entries(aug.ele || {})) {
      eles[k] = eles[k] || [0, 0];
      eles[k][0] += lo; eles[k][1] += hi;
    }

    const aps = (base.aps || 1) * (1 + incAS / 100);
    const pdps = ((physLo + physHi) / 2) * aps;
    let edps = 0;
    for (const [k, [lo, hi]] of Object.entries(eles)) {
      const mult = k === "chaos" ? 1 : 1 + incEle / 100; // 元素伤害提高不吃混沌
      edps += ((lo + hi) / 2) * mult * aps;
    }
    const critCh = (base.crit || 0) + sumField(item, CRIT_CH, 0);
    const critDmg = 150 + sumField(item, CRIT_DMG, 0); // 基础 150% 暴击伤害加成

    return {
      aps: round2(aps), pdps: Math.round(pdps), edps: Math.round(edps),
      dps: Math.round(pdps + edps),
      physRange: [Math.round(physLo), Math.round(physHi)],
      eleRanges: Object.fromEntries(Object.entries(eles).map(([k, [lo, hi]]) => [k, [Math.round(lo), Math.round(hi)]])),
      crit: round2(critCh), critDmg: Math.round(critDmg),
      incPhys, incAS, incEle,
    };
  }
  function sumRange(item, fields, idx) {
    let v = 0;
    for (const a of item.affixes) {
      const m = M.get(a.modId);
      if (m && fields.includes(m.field) && a.values[idx] != null) v += a.values[idx];
    }
    return v;
  }
  const round2 = (x) => Math.round(x * 100) / 100;

  /* ---------- 防具：防御值汇总（基础白值 + 词缀加成） ---------- */
  const DEF_FLAT = {
    ar: ["BASE_ARMOUR", "HYBRID_BASE_AND_PERCENT_ARMOUR"],
    ev: ["BASE_EVASION", "HYBRID_BASE_AND_PERCENT_EVASION"],
    es: ["BASE_ENERGY_SHIELD", "HYBRID_BASE_AND_PERCENT_ENERGY_SHIELD"],
  };
  const DEF_FLAT2 = {
    ar: ["BASE_ARMOUR_EVASION", "HYBRID_BASE_ARMOUR_EVASION"],
    ev: ["BASE_ARMOUR_EVASION", "HYBRID_BASE_ARMOUR_EVASION"],
    ar2: ["BASE_ARMOUR_ENERGY_SHIELD", "HYBRID_BASE_ARMOUR_ENERGY_SHIELD"],
    es2: ["BASE_ARMOUR_ENERGY_SHIELD", "HYBRID_BASE_ARMOUR_ENERGY_SHIELD"],
    ev2: ["BASE_EVASION_ENERGY_SHIELD", "HYBRID_BASE_EVASION_ENERGY_SHIELD"],
    es3: ["BASE_EVASION_ENERGY_SHIELD", "HYBRID_BASE_EVASION_ENERGY_SHIELD"],
  };
  const DEF_PCT = {
    ar: ["INCREASED_PERCENT_ARMOUR", "ESSENCE_INCREASED_PERCENT_ARMOUR"],
    ev: ["INCREASED_PERCENT_EVASION", "EVASIONRATINGPERCENT", "ESSENCE_INCREASED_PERCENT_EVASION"],
    es: ["INCREASED_PERCENT_ENERGY_SHIELD", "ESSENCE_INCREASED_PERCENT_ENERGY_SHIELD"],
  };
  function armourStats(item) {
    const base = E.baseIndex.get(item.classId + "/" + item.baseId);
    if (!base || !base.def) return null;
    const out = { total: 0, rows: [] };
    const keys = Object.keys(base.def).filter((k) => k !== "blk");
    // 白值
    const baseVal = (k) => base.def[k] || 0;
    for (const k of keys) {
      let flat = 0, pct = 0;
      for (const a of item.affixes) {
        const m = M.get(a.modId); if (!m) continue;
        if ((DEF_FLAT[k] || []).includes(m.field)) flat += a.values[0] || 0;
        if ((DEF_PCT[k] || []).includes(m.field)) pct += a.values[0] || 0;
      }
      // 双属性白值词缀：第一条主属性
      for (const a of item.affixes) {
        const m = M.get(a.modId); if (!m) continue;
        if ((DEF_FLAT2[k] || []).includes(m.field) && a.values[0] != null) flat += a.values[0] || 0;
      }
      let v = (baseVal(k) + flat) * (1 + pct / 100);
      // 双属性词缀第二条（分配到另一属性）
      const twin = { ar: "ev", ev: "ar", es: "ev" }[k];
      // 简化：混合白值第二条合入主行不做二次分配
      out.rows.push({ key: k, base: Math.round(baseVal(k)), flat: Math.round(flat), pct, total: Math.round(v) });
      out.total += Math.round(v);
    }
    if (base.def.blk) out.rows.push({ key: "blk", base: base.def.blk, flat: 0, pct: 0, total: base.def.blk });
    return out;
  }

  /* ---------- 首饰：常用属性汇总 ---------- */
  const JEWEL_SUMS = [
    { field: ["BASE_MAXIMUM_LIFE"], zh: "生命", unit: "" },
    { field: ["BASE_MAXIMUM_MANA"], zh: "魔力", unit: "" },
    { field: ["BASE_SPIRIT"], zh: "精魂", unit: "" },
    { field: ["STRENGTH"], zh: "力量", unit: "" },
    { field: ["DEXTERITY"], zh: "敏捷", unit: "" },
    { field: ["INTELLIGENCE"], zh: "智慧", unit: "" },
    { field: ["ALL_ATTRIBUTES"], zh: "全属性", unit: "" },
    { field: ["FIRE_RESISTANCE"], zh: "火焰抗性", unit: "%" },
    { field: ["COLD_RESISTANCE"], zh: "冰霜抗性", unit: "%" },
    { field: ["LIGHTNING_RESISTANCE"], zh: "闪电抗性", unit: "%" },
    { field: ["CHAOS_RESISTANCE"], zh: "混沌抗性", unit: "%" },
    { field: ["ALL_RESISTANCES"], zh: "全抗性", unit: "%" },
    { field: ["INCREASED_CAST_SPEED"], zh: "施法速度", unit: "%" },
    { field: ["INCREASED_ATTACK_SPEED", "ESSENCE_INCREASED_ATTACK_SPEED"], zh: "攻速", unit: "%" },
    { field: ["INCREASED_CRITICAL_HIT_CHANCE"], zh: "暴击率", unit: "%" },
    { field: ["ITEM_FOUND_RARITY_INCREASE"], zh: "稀有度", unit: "%" },
    { field: ["LIFE_REGENERATION_PER_SECOND"], zh: "生命回复", unit: "/s" },
    { field: ["MANA_REGENERATION_RATE"], zh: "魔力回复", unit: "%" },
  ];
  function jewelryStats(item) {
    const cls = E.classById.get(item.classId);
    if (!cls || item.classId !== "Rings" && item.classId !== "Amulets") return null;
    const rows = [];
    let any = false;
    for (const g of JEWEL_SUMS) {
      let v = 0;
      for (const a of item.affixes) {
        const m = M.get(a.modId);
        if (m && g.field.includes(m.field) && a.values[0] != null)
          v += a.values[0] * (E.qualityMultFor ? E.qualityMultFor(item, m) : 1);
      }
      if (v) { rows.push({ zh: g.zh, v: Math.round(v), unit: g.unit }); any = true; }
    }
    return any ? rows : null;
  }

  E.weaponStats = weaponStats;
  E.armourStats = armourStats;
  E.jewelryStats = jewelryStats;
})(typeof window !== "undefined" ? window : globalThis);
