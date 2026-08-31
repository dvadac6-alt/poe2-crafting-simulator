# -*- coding: utf-8 -*-
"""把 data/ 目录下的全部 JSON 合并打包为 app/data.js（浏览器可直接使用，无需 HTTP 服务）。

用法: python tools/build_data.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
APP = os.path.join(ROOT, "app")


def load(name):
    for folder in (DATA, ROOT):
        p = os.path.join(folder, name)
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                return json.load(f)
    raise FileNotFoundError(name)


def main():
    mods = load("mods.json")
    base_items = load("base_items.json")
    currencies = load("currencies.json")
    tiers = load("currency_tiers.json")
    essences = load("essences.json")
    omens = load("omens.json")
    prices = load("prices.json")
    overrides = load("weights_overrides.json")
    bases = load("bases.json")

    mods_by_id = {m["id"]: m for m in mods["mods"]}

    # 装备类 -> 词缀组前缀（池 id 形如 "TwoHandMaces/XXX"，直接由池推导）
    class_pools = {}
    for it in base_items["items"]:
        class_pools[it["id"]] = it["pools"]

    # 校验：基底类必须在 base_items 中有词缀池
    for c in bases["classes"]:
        if c["id"] not in class_pools:
            print(f"[FAIL] 基底类 {c['id']} 在 base_items.json 中没有词缀池", file=sys.stderr)
            sys.exit(1)
        # 校验池内引用
        for src, pools in class_pools[c["id"]].items():
            for typ, ids in pools.items():
                for mid in ids:
                    if mid not in mods_by_id:
                        print(f"[FAIL] 悬空引用 {c['id']} {src}/{typ} -> {mid}", file=sys.stderr)
                        sys.exit(1)

    # 每个武器类可用的精华：essences.json 里 tier 列表中含该组前缀 mod id 的精华
    mods_group = {}
    for cid, pools in class_pools.items():
        prefix = None
        for pools_by_src in pools.values():
            for ids in pools_by_src.values():
                if ids:
                    prefix = ids[0].split("/")[0]
                    break
            if prefix:
                break
        mods_group[cid] = prefix  # e.g. TwoHand_Maces -> TwoHandMaces

    essence_index = {}  # classId -> [{name, tier, modId}...]
    for cid, gprefix in mods_group.items():
        avail = []
        for e in essences["essences"]:
            for tier, mod_ids in e["tiers"].items():
                for mid in mod_ids:
                    if mid.split("/")[0] == gprefix and mid in mods_by_id:
                        avail.append({"name": e["name"], "tier": tier, "modId": mid})
        essence_index[cid] = avail

    # 精华 modId -> 词缀 tier 下标（按档位名推断：Lesser/默认/Greater/Perfect）
    tier_rank = {"LESSER": 0, "NORMAL": 1, "GREATER": 2, "PERFECT": 3}
    def essence_tier_index(mod, want):
        for i, t in enumerate(mod["tiers"]):
            n = t["name"]
            has = None
            if n.startswith("Lesser"):
                has = "LESSER"
            elif n.startswith("Greater"):
                has = "GREATER"
            elif n.startswith("Perfect"):
                has = "PERFECT"
            else:
                has = "NORMAL"
            if has == want:
                return i
        return len(mod["tiers"]) - 1

    essence_mod_map = []  # {classId, essence, tier, modId, tierIndex}
    for cid, avail in essence_index.items():
        for a in avail:
            m = mods_by_id[a["modId"]]
            essence_mod_map.append({
                "classId": cid, "essence": a["name"], "tier": a["tier"],
                "modId": a["modId"],
                "tierIndex": essence_tier_index(m, a["tier"]),
            })

    # 词缀按池组织：classId -> { normal: {prefixes:[mod...], suffixes:[...]}, desecrated: {...} }
    pools_resolved = {}
    for cid, pools in class_pools.items():
        pools_resolved[cid] = {
            src: {typ: [mods_by_id[mid] for mid in ids] for typ, ids in pools[src].items()}
            for src in pools
        }

    # 亵渎词缀的首领归属（tags 含 kurgal_mod / amanamu_mod / ulaman_mod）
    for m in mods["mods"]:
        boss = None
        for t in m.get("tags", []):
            if t.endswith("_mod") and t[:-4] in ("kurgal", "amanamu", "ulaman"):
                boss = t[:-4]
                break
        if boss:
            m["boss"] = boss

    out = {
        "patch": mods.get("patch", "0.5"),
        "generated": mods.get("generated", ""),
        "bases": bases,
        "mods": mods["mods"],
        "classPoolsRaw": class_pools,
        "modsGroup": mods_group,
        "essenceModMap": essence_mod_map,
        "essences": essences["essences"],
        "currencies": currencies["currencies"],
        "tiers": tiers["tiers"],
        "tierAppliesTo": tiers["appliesTo"],
        "omens": omens["omens"],
        "prices": prices["prices"],
        "omenPrices": prices["omens"],
        "overrides": overrides["overrides"],
        "priceUnit": prices.get("unit", "exalt-equivalent"),
    }

    payload = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    js = "// 自动生成：python tools/build_data.py —— 请勿手改\nwindow.POE2_DATA = " + payload + ";\n"
    with open(os.path.join(APP, "data.js"), "w", encoding="utf-8") as f:
        f.write(js)

    n_bases = sum(len(c["bases"]) for c in bases["classes"])
    print(f"[OK] app/data.js 生成完毕：{len(bases['classes'])} 类武器 / {n_bases} 个基底 / {len(mods['mods'])} 条词缀 / "
          f"{len(essence_mod_map)} 条精华映射 / {len(omens['omens'])} 种预兆 / {os.path.getsize(os.path.join(APP,'data.js'))//1024} KB")


if __name__ == "__main__":
    main()
