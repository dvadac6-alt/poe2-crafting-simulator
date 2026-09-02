/* 把 app/data.js（全量包）拆成 首屏核心包 + 词缀池懒加载包
 * 核心 app/data.js      ：bases / 通货 / 精华 / 预兆 / 价格 / aldur 概要（符文·合金·情感·创世树底子）
 * 池   app/data_pools.js：mods / classPoolsRaw / essenceModMap / aldur.anoints / runePools / genesisPools / timeLost
 * 引擎在 app.js 注入 data_pools.js 后调用 ENGINE.loadPools(POE2_POOLS) 补建索引。
 * 用法：node tools/split_data.mjs（读当前 app/data.js；若已是拆分后的核心包会直接报错停止） */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const APP = path.resolve(import.meta.dirname, "..", "app");
const src = fs.readFileSync(path.join(APP, "data.js"), "utf8");
const sb = { window: {} };
vm.createContext(sb);
vm.runInContext(src, sb);
const D = sb.window.POE2_DATA;
if (!D || !Array.isArray(D.mods) || !D.mods.length) {
  throw new Error("app/data.js 已是拆分后的核心包（无 mods），请先用原始全量包重跑");
}

/* 核心包 aldur：去掉 4 个大池字段 */
const aldurCore = { ...D.aldur };
const poolsAldur = {
  anoints: aldurCore.anoints ?? [],
  runePools: aldurCore.runePools ?? {},
  genesisPools: aldurCore.genesisPools ?? {},
  timeLost: aldurCore.timeLost ?? { pool: { prefixes: [], suffixes: [] }, bases: [], classes: [] },
};
delete aldurCore.anoints;
delete aldurCore.runePools;
delete aldurCore.genesisPools;
delete aldurCore.timeLost;

const core = {
  patch: D.patch, generated: D.generated,
  bases: D.bases, essences: D.essences, currencies: D.currencies, omens: D.omens,
  prices: D.prices, omenPrices: D.omenPrices, priceUnit: D.priceUnit,
  modsGroup: D.modsGroup, tiers: D.tiers, tierAppliesTo: D.tierAppliesTo, overrides: D.overrides,
  aldur: aldurCore,
};
const pools = {
  mods: D.mods, classPoolsRaw: D.classPoolsRaw, essenceModMap: D.essenceModMap,
  aldur: poolsAldur,
};

const header = "// 自动生成：tools/build_data.py 打包 + tools/split_data.mjs 拆分 —— 请勿手改\n";
fs.writeFileSync(path.join(APP, "data.js"), header + "window.POE2_DATA = " + JSON.stringify(core) + ";\n");
fs.writeFileSync(path.join(APP, "data_pools.js"),
  "// 自动生成：tools/split_data.mjs —— 词缀池（首屏后由 app.js 注入，ENGINE.loadPools 补建索引）\n" +
  "window.POE2_POOLS = " + JSON.stringify(pools) + ";\n");

const kb = (n) => (n / 1024).toFixed(0) + "KB";
console.log("core data.js:", kb(fs.statSync(path.join(APP, "data.js")).size),
  "| pools data_pools.js:", kb(fs.statSync(path.join(APP, "data_pools.js")).size));
