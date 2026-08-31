# -*- coding: utf-8 -*-
"""从 poe2db 抓取游戏原图（通货/预兆/精华/武器基底插画）到 app/assets/。
产出 app/assets.js 清单（window.POE2_ASSETS），缺失项由前端 SVG 兜底。
用法: python tools/fetch_icons.py
"""
import json
import os
import re
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "app", "assets")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}
CDN = "https://cdn.poe2db.tw/image/"

CLASS_PAGES = {
    "Bows": "Bows", "Spears": "Spears", "Crossbows": "Crossbows",
    "Quarterstaves": "Quarterstaves", "OneHand_Maces": "One_Hand_Maces",
    "TwoHand_Maces": "Two_Hand_Maces", "Staves": "Staves", "Wands": "Wands", "Sceptres": "Sceptres",
}
# 已知通货内部资源路径
CURRENCY_ART = {
    "transmutation": "Art/2DItems/Currency/CurrencyUpgradeToMagic.webp",
    "augmentation": "Art/2DItems/Currency/CurrencyAddModToMagic.webp",
    "regal": "Art/2DItems/Currency/CurrencyUpgradeMagicToRare.webp",
    "alchemy": "Art/2DItems/Currency/CurrencyUpgradeToRare.webp",
    "exalted": "Art/2DItems/Currency/CurrencyAddModToRare.webp",
    "chaos": "Art/2DItems/Currency/CurrencyRerollRare.webp",
    "divine": "Art/2DItems/Currency/CurrencyModValues.webp",
    "fracturing": "Art/2DItems/Currency/FracturingOrb.webp",
    "hinekora": "Art/2DItems/Currency/HinekorasLock.webp",
    "annulment": None,      # 从页面抓
    "desecrated": "Art/2DItems/Currency/Breach/BreachDesecration.webp",
    "essence": "Art/2DItems/Currency/Essence/GreaterPhysicalEssence.webp",
}
OMEN_PAGES = {
    "OmenofSinistralExaltation": "Omen_of_Sinistral_Exaltation",
    "OmenofDextralExaltation": "Omen_of_Dextral_Exaltation",
    "OmenofGreaterExaltation": "Omen_of_Greater_Exaltation",
    "OmenofSinistralAnnulment": "Omen_of_Sinistral_Annulment",
    "OmenofDextralAnnulment": "Omen_of_Dextral_Annulment",
    "OmenofLight": "Omen_of_Light",
    "OmenofSinistralCrystallisation": "Omen_of_Sinistral_Crystallisation",
    "OmenofDextralCrystallisation": "Omen_of_Dextral_Crystallisation",
    "OmenofSinistralNecromancy": "Omen_of_Sinistral_Necromancy",
    "OmenofDextralNecromancy": "Omen_of_Dextral_Necromancy",
    "OmenoftheBlackblooded": "Omen_of_the_Blackblooded",
    "OmenoftheLiege": "Omen_of_the_Liege",
    "OmenoftheSovereign": "Omen_of_the_Sovereign",
}
# 我方 en 名 -> poe2db 页面名（个别变体在站上沿用符文熔铸插画）
ART_ALIAS = {
    "Runemastered Marching Mace": "Runeforged Marching Mace",
    "Runemastered Kalguuran Forgehammer": "Runeforged Kalguuran Forgehammer",
    "Runemastered Torment Club": "Runeforged Torment Club",
    "Runemastered Warden Bow": "Runeforged Warden Bow",
}

ESSENCE_NAMES = [
    "Abrasion", "Alacrity", "Battle", "Command", "Electricity", "Enhancement", "Flames",
    "Grounding", "Haste", "Horror", "Hysteria", "Ice", "Insulation", "Opulence", "Ruin",
    "Seeking", "Sorcery", "Thawing", "the Body", "the Infinite", "the Mind",
]


def fetch(url, binary=False, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=25) as r:
                data = r.read()
            return data if binary else data.decode("utf-8", "ignore")
        except Exception as e:
            if i == tries - 1:
                print(f"  [FETCH-FAIL] {url}: {e}")
                return None
            time.sleep(1.2 * (i + 1))


def save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


def img_urls(html):
    return re.findall(r'https://cdn\.poe2db\.tw/image/[^"\'\s>]+?\.webp', html)


def scrape_base_art():
    """类列表页 -> {enDisplayName: artPath}（锚点内嵌 <img src>，slug 即英文名）"""
    out = {}
    for cls, page in CLASS_PAGES.items():
        html = fetch(f"https://poe2db.tw/us/{page}")
        if not html:
            continue
        pairs = re.findall(
            r'href="([A-Za-z0-9_\-]+)"[^>]*>\s*<img[^>]+src="(https://cdn\.poe2db\.tw/image/Art/2DItems/Weapons/[^"]+?\.webp)"',
            html,
        )
        n = 0
        for slug, url in pairs:
            if "/Uniques/" in url:
                continue
            name = slug.replace("_", " ")
            if name not in out:
                out[name] = url.replace("https://cdn.poe2db.tw/image/", "")
                n += 1
        print(f"  {cls}: {n} 个基底插画")
    return out


def scrape_page_first_art(page, folder_keyword="2DItems/Currency"):
    html = fetch(f"https://poe2db.tw/us/{page}")
    if not html:
        return None
    for u in sorted(img_urls(html)):
        if folder_keyword in u and "Essence" not in u.split("/Currency/")[-1][:8]:
            pass
    for u in img_urls(html):
        if folder_keyword in u:
            return u.replace("https://cdn.poe2db.tw/image/", "")
    return None


_dl_cache = {}  # 按目标文件缓存（多个基底可能共用同一张图）

def download(rel, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 200:
        return True
    if dest in _dl_cache:
        return _dl_cache[dest]
    data = fetch(CDN + rel, binary=True, tries=4)
    ok = bool(data) and len(data) >= 200 and data[:4] == b"RIFF"
    _dl_cache[dest] = ok
    if not ok:
        return False
    save(dest, data)
    return True


def main():
    manifest = {"currency": {}, "omens": {}, "essences": {}, "weapons": {}}

    # ── 武器基底 ──
    print("[1/4] 抓取武器基底插画…")
    art_by_name = scrape_base_art()
    bases = json.load(open(os.path.join(ROOT, "data", "bases.json"), encoding="utf-8"))
    miss = []
    for cls in bases["classes"]:
        for b in cls["bases"]:
            rel = art_by_name.get(b["en"]) or art_by_name.get(ART_ALIAS.get(b["en"], ""))
            if not rel:
                miss.append(b["en"])
                continue
            dest = os.path.join(ASSETS, "weapons", cls["id"], b["id"] + ".webp")
            if download(rel, dest):
                manifest["weapons"][cls["id"] + "/" + b["id"]] = "assets/weapons/" + cls["id"] + "/" + b["id"] + ".webp"
            else:
                miss.append(b["en"] + " (下载失败)")
    print(f"  基底插画：{len(manifest['weapons'])} 成功 / {len(miss)} 缺失")
    for m in miss[:15]:
        print("   MISS:", m)

    # ── 通货 ──
    print("[2/4] 抓取通货图标…")
    annul_art = scrape_page_first_art("Orb_of_Annulment")
    if annul_art:
        CURRENCY_ART["annulment"] = annul_art
    for cid, rel in CURRENCY_ART.items():
        if not rel:
            print(f"  {cid}: 无资源路径")
            continue
        dest = os.path.join(ASSETS, "currency", cid + ".webp")
        if download(rel, dest):
            manifest["currency"][cid] = "assets/currency/" + cid + ".webp"
            print(f"  {cid}: OK ({rel.split('/')[-1]})")
        else:
            print(f"  {cid}: 下载失败 ({rel})")

    # ── 预兆 ──
    print("[3/4] 抓取预兆图标…")
    for oid, page in OMEN_PAGES.items():
        rel = scrape_page_first_art(page, "2DItems/Currency")
        dest = os.path.join(ASSETS, "omens", oid + ".webp")
        if rel and download(rel, dest):
            manifest["omens"][oid] = "assets/omens/" + oid + ".webp"
            print(f"  {oid}: OK")
        else:
            print(f"  {oid}: MISS (rel={rel})")
        time.sleep(0.25)

    # ── 精华 ──
    print("[4/4] 抓取精华图标…")
    for name in ESSENCE_NAMES:
        page = "Essence_of_" + name.replace(" ", "_")
        rel = scrape_page_first_art(page, "Currency/Essence")
        key = name.replace(" ", "_")
        dest = os.path.join(ASSETS, "essences", key + ".webp")
        if rel and download(rel, dest):
            manifest["essences"][key] = "assets/essences/" + key + ".webp"
        else:
            print(f"  Essence {name}: MISS (rel={rel})")
        time.sleep(0.25)
    print(f"  精华图标：{len(manifest['essences'])}/21")

    js = "// 自动生成：python tools/fetch_icons.py —— 本地图标清单\nwindow.POE2_ASSETS = " + json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + ";\n"
    with open(os.path.join(ROOT, "app", "assets.js"), "w", encoding="utf-8") as f:
        f.write(js)
    total = sum(len(v) for v in manifest.values())
    print(f"[DONE] 共 {total} 张图标；清单写入 app/assets.js")


if __name__ == "__main__":
    main()
