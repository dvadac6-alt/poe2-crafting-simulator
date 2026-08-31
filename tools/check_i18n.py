# -*- coding: utf-8 -*-
"""校验 i18n_mods.js 翻译表覆盖 mods.json 的全部词缀文本。"""
import json, re, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

mods = json.load(open("mods.json", encoding="utf-8"))["mods"]
src = open("app/i18n_mods.js", encoding="utf-8").read()
body = src.split("const T = {", 1)[1].split("\n  };", 1)[0]
pattern = r'"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"'
entries = re.findall(pattern, body)
t = {k.replace("\\n", "\n"): v for k, v in entries}
texts = set(m["text"] for m in mods)
missing = [x for x in sorted(texts) if x not in t]
print(f"翻译键数: {len(t)} / 唯一词缀文本: {len(texts)}")
print(f"缺失: {len(missing)}")
for x in missing:
    print("MISS:", repr(x))
# 反向：翻译表里多余的键（不影响运行，仅提示）
extra = [k for k in t if k not in texts]
if extra:
    print("多余键(仅提示):", len(extra))
sys.exit(1 if missing else 0)
