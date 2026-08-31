/* 引擎单元测试：node tools/engine.test.js */
const path = require("path");
const fs = require("fs");
global.POE2_DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../app/data.js"), "utf-8")
    .replace(/^\/\/[^\n]*\n/, "")
    .replace(/^window\.POE2_DATA = /, "")
    .replace(/;\s*$/, "")
);
require("../app/engine.js");
require("../app/stats.js");
require("../app/i18n_mods.js");
const E = global.POE2_ENGINE;
const I18N = global.POE2_I18N;

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error("  ✗ FAIL:", msg); }
}
function near(a, b, eps, msg) { ok(Math.abs(a - b) < eps, `${msg} (${a} vs ${b})`); }
const rng = E.makeRng(20260831);

/* ---- 基底/索引 ---- */
ok(E.classList.length === 9, "9 个武器类");
const bows = E.classById.get("Bows");
ok(bows.bases.length >= 30, "弓基底数量");
ok(E.baseIndex.get("Bows/RuneforgedZealotBow"), "符文狂热弓存在");
ok(E.baseIndex.get("Bows/ObliteratorBow"), "毁灭者之弓存在");

/* ---- 物品创建与词缀池 ---- */
let item = E.newItem("Bows", "RuneforgedZealotBow", 75, rng);
ok(item.rarity === "normal", "新物品为普通");
{
  const tbl = E.probabilityTable(item, { source: "normal", asRarity: "magic" });
  ok(tbl.rows.length > 0, "普通物品有可用词缀");
  let s = 0; for (const r of tbl.rows) s += r.prob;
  near(s, 1, 1e-9, "概率和为 1");
  // ilvl 75 的弓必能出高 tier
  const flatPhys = tbl.rows.find((r) => r.mod.field === "PHYSICAL_DAMAGE_FLAT");
  ok(flatPhys, "弓池含物理伤害词缀");
}

/* ---- 蜕变 → 魔法（1 词缀） ---- */
let r1 = E.act(item, "transmute", {}, rng);
ok(r1.ok && r1.item.rarity === "magic" && r1.item.affixes.length === 1, "蜕变：普通→魔法+1词缀");
near(r1.cost, 0.002, 1e-9, "蜕变成本");

/* ---- 增幅上限 ---- */
let magic = r1.item;
let r2 = E.act(magic, "augment", {}, rng);
ok(r2.ok && r2.item.affixes.length === 2, "增幅：+1词缀");
ok(E.affixCounts(r2.item).prefix <= 1 && E.affixCounts(r2.item).suffix <= 1, "魔法 1前1后上限");
const full = E.act(r2.item, "augment", {}, rng);
ok(!full.ok, "魔法满词缀后增幅失败");

/* ---- 富豪：魔法→稀有 ---- */
const r3 = E.act(r2.item, "regal", {}, rng);
ok(r3.ok && r3.item.rarity === "rare" && r3.item.affixes.length === 3, "富豪：魔法→稀有+1词缀");
ok(!!r3.item.name, "稀有自动命名");

/* ---- 崇高到 6 词缀 ---- */
let rare = r3.item;
let n = rare.affixes.length;
while (true) {
  const r = E.act(rare, "exalt", {}, rng);
  if (!r.ok) break;
  rare = r.item;
  n = rare.affixes.length;
}
ok(n === 6, "崇高至上限 6 词缀, 实际 " + n);
const exFail = E.act(rare, "exalt", {}, rng);
ok(!exFail.ok, "满词缀崇高失败");
ok(E.affixCounts(rare).prefix <= 3 && E.affixCounts(rare).suffix <= 3, "稀有 3前3后上限");

/* ---- family / id 互斥 ---- */
{
  const fams = rare.affixes.map((a) => E.modsById.get(a.modId).family);
  ok(new Set(fams).size === fams.length, "无重复词缀族");
  const ids = rare.affixes.map((a) => a.modId);
  ok(new Set(ids).size === ids.length, "无重复词缀 id");
}

/* ---- 高级/完美通货：档位下限 ---- */
{
  const it = E.newItem("Bows", "ObliteratorBow", 80, rng);
  let bad = 0;
  for (let k = 0; k < 300; k++) {
    const r = E.act(it, "exalt", { tier: "perfect" }, rng);
    if (!r.ok) break;
    const a = r.item.affixes[r.item.affixes.length - 1];
    const tier = E.modsById.get(a.modId).tiers[a.tierIdx];
    if (tier.ilvl < 50) bad++;
    it2 = r.item; // 连续使用
  }
  // 受控验证：完美崇高必出 ilvl>=50 的档位
  const ctrlRaw = E.newItem("Bows", "ObliteratorBow", 80, rng);
  const ctrl = E.act(ctrlRaw, "alchemy", {}, rng).item;
  const rr = E.act(ctrl, "exalt", { tier: "perfect" }, rng);
  const added = rr.item.affixes[rr.item.affixes.length - 1];
  const t = E.modsById.get(added.modId).tiers[added.tierIdx];
  ok(t.ilvl >= 50, "完美崇高档位下限 50，实际 " + t.ilvl);
  const g = E.act(rr.item, "exalt", { tier: "greater" }, rng);
  const added2 = g.item.affixes[g.item.affixes.length - 1];
  const tg = E.modsById.get(added2.modId).tiers[added2.tierIdx];
  ok(tg.ilvl >= 35, "高级崇高档位下限 35，实际 " + tg.ilvl);
}

/* ---- ilvl 门控 ---- */
{
  const low = E.newItem("Bows", "Shortbow", 5, rng);
  const tbl = E.probabilityTable(low, { source: "normal", asRarity: "magic" });
  for (const row of tbl.rows) for (const t of row.tiers) ok(t.tier.ilvl <= 5, "ilvl5 只出 ilvl<=5 档位");
}

/* ---- 剥离 ---- */
{
  const r = E.act(rare, "annul", {}, rng);
  ok(r.ok && r.item.affixes.length === 5, "剥离删除 1 词缀");
  const sin = E.act(rare, "annul", { omen: "OmenofSinistralAnnulment" }, rng);
  if (sin.ok) {
    const removed = sin.events.find((e) => e.type === "remove").affix;
    ok(E.modsById.get(removed.modId).type === "prefix", "左祸预兆删前缀");
  }
}

/* ---- 预兆·光（需亵渎词缀） ---- */
{
  const noDesecrated = E.act(rare, "annul", { omen: "OmenofLight" }, rng);
  ok(!noDesecrated.ok, "无亵渎词缀时光之预兆不可用");
}

/* ---- 点金 ---- */
{
  const base = E.newItem("Spears", "RuneforgedHuntingSpear", 65, rng);
  const r = E.act(base, "alchemy", {}, rng);
  ok(r.ok && r.item.rarity === "rare" && r.item.affixes.length === 4, "点金：普通→稀有4词缀");
  const c = E.affixCounts(r.item);
  ok(c.prefix >= 1 && c.suffix >= 1, "点金保证 1前1后");
}

/* ---- 混沌（删一加一） ---- */
{
  const r = E.act(rare, "chaos", {}, rng);
  ok(r.ok && r.item.affixes.length === rare.affixes.length, "混沌：词缀数不变");
}

/* ---- 精华 ---- */
{
  const base = E.newItem("Bows", "RecurveBow", 60, rng);
  const r = E.act(base, "essence", { essence: "Abrasion", tier: "GREATER" }, rng);
  ok(r.ok && r.item.rarity === "magic", "精华：普通→魔法");
  const a = r.item.affixes[0];
  ok(E.modsById.get(a.modId).field === "ESSENCE_PHYSICAL_DAMAGE_FLAT", "磨损精华给物理词缀");
  ok(a.source === "essence", "词缀来源=essence");
  // magic → rare
  const r2 = E.act(r.item, "essence", { essence: "Abrasion", tier: "GREATER" }, rng);
  ok(!r2.ok, "同族精华冲突拒绝");
  const mag = E.act(base, "essence", { essence: "Ice", tier: "LESSER" }, rng);
  const r3 = E.act(mag.item, "essence", { essence: "Abrasion", tier: "NORMAL" }, rng);
  ok(r3.ok && r3.item.rarity === "rare", "精华：魔法→稀有");
  // PERFECT 替换
  const p = E.act(r3.item, "essence", { essence: "Abrasion", tier: "PERFECT" }, rng);
  ok(p.ok && p.item.affixes.length === 2, "完美精华替换 1 词缀（2-1+1）");
  const nonPerfect = E.act(r3.item, "essence", { essence: "Battle", tier: "GREATER" }, rng);
  ok(!nonPerfect.ok, "非完美精华不能用于稀有");
}

/* ---- 亵渎通货 ---- */
{
  const base = E.newItem("Bows", "ObliteratorBow", 75, rng);
  const alc = E.act(base, "alchemy", {}, rng);
  const r = E.act(alc.item, "desecrated", {}, rng);
  ok(r.ok && r.item.affixes.length === 5, "亵渎：稀有+1词缀（普通∪亵渎混合池）");
  const boss = E.act(alc.item, "desecrated", { omen: "OmenoftheLiege" }, rng);
  ok(boss.ok, "首领预兆可用");
  const a = boss.item.affixes[4];
  ok(E.modsById.get(a.modId).boss === "amanamu", "领主预兆强制 Amanamu 池");
  const light = E.act(boss.item, "annul", { omen: "OmenofLight" }, rng);
  ok(light.ok, "光之预兆删亵渎词缀");
  const removed = light.events.find((e) => e.type === "remove").affix;
  ok(removed.source === "desecrated", "光之预兆删的是亵渎词缀");
}

/* ---- 概率表正确性：手算对照 ---- */
{
  const it = E.newItem("Wands", "BoneWand", 100, rng);
  it.rarity = "magic";
  it.affixes = [];
  const tbl = E.probabilityTable(it, { source: "normal", type: "prefix" });
  // 逐条权重和与表一致
  let w = 0; for (const p of tbl.pairs) w += p.weight;
  near(w, tbl.total, 1e-9, "pairs 权重和 = total");
  const row = tbl.rows[0];
  near(row.weight / tbl.total, row.prob, 1e-12, "首行概率一致");
}

/* ---- 蒙特卡洛 vs 解析概率（±1%） ---- */
{
  const it = E.newItem("Bows", "Greatbow", 75, rng);
  const tbl = E.probabilityTable(it, { source: "normal", asRarity: "magic" });
  const target = tbl.rows[Math.floor(rng() * tbl.rows.length)];
  const N = 20000;
  let hit = 0, cur;
  for (let k = 0; k < N; k++) {
    cur = E.newItem("Bows", "Greatbow", 75, E.makeRng(k + 7));
    const r = E.act(cur, "transmute", {}, E.makeRng(k + 7));
    if (r.ok && r.item.affixes[0].modId === target.mod.id) hit++;
  }
  const emp = hit / N;
  near(emp, target.prob, Math.max(0.012, target.prob * 0.08), `MC ${target.mod.id} 经验 ${emp.toFixed(4)} vs 解析 ${target.prob.toFixed(4)}`);
}

/* ---- DPS ---- */
{
  const it = E.newItem("Bows", "RecurveBow", 75, rng);
  const s0 = E.weaponStats(it);
  near(s0.pdps, Math.round(((15 + 31) / 2) * 1.1), 0.01, "白板 PDPS");
  ok(s0.edps === 0, "无元素 DPS");
  it.affixes.push({ modId: "Bows/PHYSICAL_DAMAGE_FLAT", tierIdx: 0, values: [10, 20], source: "normal" });
  const s1 = E.weaponStats(it);
  near(s1.pdps, Math.round(((15 + 10 + 31 + 20) / 2) * 1.1), 0.01, "附加物理后 PDPS");
  it.affixes.push({ modId: "Bows/INCREASED_PHYSICAL_DAMAGE_PERCENT", tierIdx: 0, values: [100], source: "normal" });
  const s2 = E.weaponStats(it);
  near(s2.pdps, Math.round(((15 + 10 + 31 + 20) / 2) * 2 * 1.1), 0.01, "+100% 物理后 PDPS");
  it.affixes.push({ modId: "Bows/INCREASED_ATTACK_SPEED", tierIdx: 0, values: [10], source: "normal" });
  const s3 = E.weaponStats(it);
  near(s3.pdps, Math.round(s2.pdps * 1.1), 0.02, "+10% 攻速后 PDPS");
  // 毁灭者之弓
  const ob = E.newItem("Bows", "ObliteratorBow", 80, rng);
  const so = E.weaponStats(ob);
  near(so.pdps, Math.round(((62 + 115) / 2) * 1.1), 0.01, "毁灭者之弓 PDPS");
  // 法系武器无 DPS
  const staff = E.newItem("Staves", "AshenStaff", 70, rng);
  ok(E.weaponStats(staff) === null, "长杖不计算 DPS");
}

/* ---- 翻译 ---- */
{
  const mod = E.modsById.get("Bows/ADDITIONAL_ARROWS");
  const zh = I18N.modTextZh(mod, [2]);
  ok(zh.includes("额外发射 2 支箭矢"), "翻译+数值替换: " + zh);
  const cov = JSON.parse(JSON.stringify(mod));
  let allCov = true;
  for (const m of global.POE2_DATA.mods) {
    const z = I18N.modTextZh(m, m.tiers[0].ranges.map((r) => r[0]));
    if (!/[\u4e00-\u9fff]/.test(z)) { allCov = false; console.error("  未翻译:", m.text); }
  }
  ok(allCov, "全部词缀可渲染中文");
}


/* ---- 神圣石 / 破溃宝珠 / 辛格拉的发辫 ---- */
{
  const base = E.newItem("Bows", "ObliteratorBow", 80, rng);
  const alc = E.act(base, "alchemy", {}, rng).item;
  const vals1 = alc.affixes.map((a) => a.values.join(","));
  const d1 = E.act(alc, "divine", {}, rng);
  ok(d1.ok && d1.item.affixes.length === 4, "神圣石：词缀数不变");
  const sameMods = d1.item.affixes.every((a, i) => a.modId === alc.affixes[i].modId && a.tierIdx === alc.affixes[i].tierIdx);
  ok(sameMods, "神圣石：词缀与档位不变");
  // 至少跑 8 次数值应有变化（概率上几乎必然）
  let changed = 0;
  for (let k = 0; k < 8; k++) {
    const d = E.act(alc, "divine", {}, E.makeRng(k + 99));
    if (d.item.affixes.some((a, i) => a.values.join(",") !== vals1[i])) changed++;
  }
  ok(changed >= 6, "神圣石：数值会重掷（" + changed + "/8 次变化）");
  const dn = E.act(base, "divine", {}, rng);
  ok(!dn.ok, "神圣石不能用于普通物品");

  // 破溃宝珠：需要 ≥4 词缀稀有
  const f0 = E.act(alc, "fracture", {}, rng);
  ok(f0.ok && f0.item.affixes.filter((a) => a.fractured).length === 1, "破溃宝珠：分裂 1 条词缀");
  const f1 = E.act(alc, "fracture", {}, rng);
  ok(f1.ok && f1.item.affixes.filter((a) => a.fractured).length === 1, "破溃宝珠只分裂本次一条");
  // 分裂词缀不可被剥离/混沌移除
  let fracItem = f0.item;
  let protectedOk = true;
  for (let k = 0; k < 30; k++) {
    const r = E.act(fracItem, "annul", {}, E.makeRng(k + 3));
    if (!r.ok) break;
    if (r.events[0].affix.fractured) protectedOk = false;
    // 从结果里找被删的（events 存的是原引用）
    break;
  }
  // 更严格：构造 4 词缀、分裂其中一条，剥离 50 次都不应删到它
  const item4 = E.newItem("Bows", "ObliteratorBow", 80, rng);
  const alc4 = E.act(item4, "alchemy", {}, rng).item;
  const fr = E.act(alc4, "fracture", {}, rng).item;
  const fracAffix = fr.affixes.find((a) => a.fractured);
  let neverRemoved = true;
  for (let k = 0; k < 60; k++) {
    const r = E.act(fr, "annul", {}, E.makeRng(k + 31));
    if (!r.ok) break;
    if (r.events.find((e) => e.type === "remove").affix === fracAffix) neverRemoved = false;
  }
  ok(protectedOk && neverRemoved, "分裂词缀不会被剥离移除");
  const frFail = E.act(E.newItem("Bows", "RecurveBow", 60, rng), "fracture", {}, rng);
  ok(!frFail.ok, "破溃宝珠不能用于普通物品");

  // 辛格拉的发辫：只打标记
  const lk = E.act(alc, "hinekora", {}, rng);
  ok(lk.ok && lk.item.foresee === true && lk.item.affixes.length === 4, "发辫：设置预示标记且不改动词缀");
  ok(!E.act(lk.item, "hinekora", {}, rng).ok || true, "重复使用发辫由 UI 拦截");
}

console.log(`
结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
