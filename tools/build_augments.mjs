/* 从 poe2db 抓取的中英 Augment 页数据（scrape_augments_en.json / _cn.json）构建 app/augments.js
 * 用法：先在浏览器跑完抓取（en+cn 两份 JSON 放在仓库根目录），再 node tools/build_augments.mjs
 * 产出：app/augments.js（window.POE2_AUGMENTS）+ 图标下载到 app/assets/augments/ 并注册 assets.js
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const EN = JSON.parse(fs.readFileSync(path.join(ROOT, "scrape_augments_en.json"), "utf8"));
const CN = new Map(JSON.parse(fs.readFileSync(path.join(ROOT, "scrape_augments_cn.json"), "utf8")).map((x) => [x.id, x]));

/* 已有系统覆盖的符文（Runes of Aldur 特殊符文，见 data.js aldur.runes）与配方材料类条目跳过 */
const SKIP_IDS = new Set([
  "Serles_Triumph", "Astrids_Creativity", "Uhtreds_Sidereus", "Kolrs_Hunt",
  "Voranas_Carnage", "Thruds_Might", "Medveds_Tending", "Katlas_Gloom",
  "Cadigans_Epiphany", // 销毁全部插槽换珠宝插槽，模拟器不建模
  "Passion_of_Aldur", "Breath_of_Aldur", "Ire_of_Aldur", "Betrayal_of_Aldur", "Aldurs_Legacy",
  "Artificers_Orb", "Orb_of_Extraction", // 做装台动作，不走镶嵌面板
]);

/* 槽位前缀（英文）→ 可镶嵌的物品类别 id（权杖按施法组处理，与游戏 Martial/Wand-or-Staff 二分的近似） */
const MARTIAL = ["Bows", "Spears", "Crossbows", "Quarterstaves", "OneHand_Maces", "TwoHand_Maces"];
const CASTER = ["Wands", "Staves", "Sceptres"];
const ARMOUR = ["Helmets", "Body_Armours", "Boots", "Gloves", "Belts", "Foci", "Shields", "Bucklers"];
const JEWELLERY = ["Rings", "Amulets", "Belts"];
const TARGETS = {
  "Martial Weapon": MARTIAL,
  "Wand or Staff": CASTER,
  "Caster Weapon": CASTER,
  "Armour": ARMOUR,
  "All Equipment": [...MARTIAL, ...CASTER, ...ARMOUR, ...JEWELLERY],
  "Weapon": [...MARTIAL, ...CASTER],
  "Bows": ["Bows"], "Crossbows": ["Crossbows"], "Spears": ["Spears"], "Quarterstaves": ["Quarterstaves"],
  "Staves": ["Staves"], "Wands": ["Wands"], "Sceptres": ["Sceptres"],
  "One Hand Maces": ["OneHand_Maces"], "Two Hand Maces": ["TwoHand_Maces"],
  "One Hand Mace or Quarterstaff": ["OneHand_Maces", "Quarterstaves"],
  "Quarterstaff or Spear": ["Quarterstaves", "Spears"],
  "Foci": ["Foci"], "Talismans": ["Talismans"],
  "Shields": ["Shields"], "Bucklers": ["Bucklers"], "Shields and Bucklers": ["Shields", "Bucklers"],
  "Helmets": ["Helmets"], "Body Armours": ["Body_Armours"], "Boots": ["Boots"], "Gloves": ["Gloves"],
};
const ELE_WORD = { Fire: "fire", Cold: "cold", Lightning: "lightning", Chaos: "chaos" };

function parseEntry(e) {
  const c = CN.get(e.id);
  if (!c) return null;
  const enLines = e.text.split("\n");
  const cnLines = c.text.split("\n");
  if (enLines.length !== cnLines.length) return null; // 中英行不对齐的条目放弃
  const name = enLines[0].trim();
  const zh = cnLines[0].trim();
  if (!e.text.includes("Stack Size")) return null; // 非可堆叠货币 → 非镶嵌物
  const lvlMatch = e.text.match(/Requires: Level (\d+)/);
  const lvl = lvlMatch ? +lvlMatch[1] : 1;
  const limited = /Limited to: 1/.test(e.text) || /仅限: 1/.test(c.text);
  const effects = [], bonded = [];
  let inBonded = false;
  for (let i = 1; i < enLines.length; i++) {
    const line = enLines[i];
    if (/^Bonded:?$/.test(line)) { inBonded = true; continue; }
    const colon = line.indexOf(":");
    if (colon < 2 || colon > 40) continue;
    const prefix = line.slice(0, colon).trim();
    const targets = TARGETS[prefix];
    if (!targets) continue;
    const body = line.slice(colon + 1).trim();
    const bodyZh = cnLines[i].slice(cnLines[i].indexOf(":") + 1).trim();
    const fx = { targets, text: body, textZh: bodyZh };
    /* 武器面板可直接吃进 DPS 的两种效果（挂在具体槽位效果上；解析失败则只展示文本） */
    const add = body.match(/^Adds (\d+) to (\d+) (Fire|Cold|Lightning|Chaos) Damage$/);
    const inc = body.match(/^(\d+)% increased Physical Damage$/);
    if (add) fx.stats = { ele: { [ELE_WORD[add[3]]]: [+add[1], +add[2]] } };
    else if (inc) fx.stats = { physInc: +inc[1] };
    (inBonded ? bonded : effects).push(fx);
  }
  if (!effects.length && !bonded.length) return null;
  const tier = /^(Lesser|Greater|Perfect)_/.test(e.id)
    ? { Lesser_: "lesser", Greater_: "greater", Perfect_: "perfect" }[e.id.match(/^(Lesser|Greater|Perfect)_/)[0]]
    : "normal";
  return {
    id: e.id, en: name, zh, lvl, limited, tier,
    icon: e.icon ? "assets/augments/" + e.id + ".webp" : null,
    iconSource: e.icon,
    effects, bonded: bonded.length ? bonded : null,
    price: e.id.includes("Soul_Core") ? 2 : { lesser: 0.5, normal: 1, greater: 2, perfect: 4 }[tier],
  };
}

const all = EN.map(parseEntry).filter(Boolean);
const runes = all.filter((x) => /Rune/.test(x.id) && !SKIP_IDS.has(x.id) && !/^Legacy_of/.test(x.id));
const soulCores = all.filter((x) => x.id.includes("Soul_Core") && !SKIP_IDS.has(x.id));

fs.writeFileSync(path.join(ROOT, "app", "augments.js"),
  "// 自动生成：tools/build_augments.mjs（poe2db /us+/cn/Augment 提取）—— 0.5 基础符文与魂核\n" +
  "window.POE2_AUGMENTS = " + JSON.stringify({ runes, soulCores }) + ";\n");

/* 图标下载（cdn.poe2db.tw 允许直连；已存在则跳过） */
const dir = path.join(ROOT, "app", "assets", "augments");
fs.mkdirSync(dir, { recursive: true });
let ok = 0, skip = 0, fail = [];
for (const a of all) {
  if (!a.iconSource) { fail.push(a.id + " (no src)"); continue; }
  const file = path.join(dir, a.id + ".webp");
  if (fs.existsSync(file) && fs.statSync(file).size > 100) { skip++; continue; }
  try {
    const res = await fetch("https://cdn.poe2db.tw/image/" + a.iconSource, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36" },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100 || buf.slice(0, 4).toString() !== "RIFF") throw new Error("not webp");
    fs.writeFileSync(file, buf);
    ok++;
  } catch (e) { fail.push(a.id + " (" + e.message + ")"); }
}

/* 注册进 assets.js 清单（新增 augments 类别） */
const assetsPath = path.join(ROOT, "app", "assets.js");
const src = fs.readFileSync(assetsPath, "utf8");
const header = src.slice(0, src.indexOf("window.POE2_ASSETS"));
const manifest = JSON.parse(src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1));
manifest.augments = {};
for (const a of all) if (a.iconSource && !fail.some(f => f.startsWith(a.id))) manifest.augments[a.id] = a.icon;
fs.writeFileSync(assetsPath, header + "window.POE2_ASSETS = " + JSON.stringify(manifest) + ";\n");

console.log(`runes: ${runes.length} | soulCores: ${soulCores.length} | icons downloaded: ${ok}, skipped: ${skip}, failed: ${fail.length}`);
if (fail.length) console.log("failed:", fail.slice(0, 10).join(", "));
