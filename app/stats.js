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
    if (!base || !cls || !cls.attack) return null;
    const rng = E.defaultRng;

    const flatPhysLo = sumRange(item, FLAT.phys, 0), flatPhysHi = sumRange(item, FLAT.phys, 1);
    const incPhys = sumField(item, INC_PHYS, 0) + hybridPhysReducedAS(item).inc;
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

    const aps = base.aps * (1 + incAS / 100);
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

  E.weaponStats = weaponStats;
})(typeof window !== "undefined" ? window : globalThis);
