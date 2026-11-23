"""Extract recipes from 'Ensiklopedia Masakan Malaysia - Edisi 7 Bahan Lengkap' PDF into JSON.
Usage: python scripts/extract_recipes.py book.pdf data/recipes.json
Only text printed in the book is kept. No nutrition is invented (the book has none)."""
import re, sys, json, subprocess
pdf, out = sys.argv[1], sys.argv[2]
txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True).stdout
pages = txt.split("\f")
GENERIC = "Siapkan semua bahan dulu. Basuh, potong dan sukat"
def sect(t, a, b):
    m = re.search(a + r"\n(.*?)(?:\n" + b + r"|\Z)", t, re.S)
    return m.group(1).strip() if m else ""
recs = []
for p in pages:
    m = re.match(r"\s*(\d+)\. (.+)\n\s*BAHAN-BAHAN", p)
    if not m: continue
    body = p[m.start():]
    bahan = sect(body, "BAHAN-BAHAN", "CARA PENYEDIAAN")
    cara = sect(body, "CARA PENYEDIAAN", "PETUA ORANG BARU")
    src = sect(body, "RUJUKAN / SUMBER", r"\s*Edisi 7")
    ings = [l.strip("• ").strip() for l in bahan.split("\n") if l.strip().startswith("•")]
    steps = re.split(r"\n(?=\d+\. )", cara)
    steps = [re.sub(r"\s*\n\s*", " ", s).split(". ", 1)[-1].strip() for s in steps if s.strip()]
    generic = GENERIC in cara
    has_qty = any(re.match(r"^[\d½¼¾/\.\-]+\s*(cawan|sudu|biji|ulas|helai|batang|cm|inci|g|kg|ml|liter|keping|ekor|cili|labu|bungkus|tin)", i) for i in ings)
    recs.append({"id": int(m.group(1)), "title": m.group(2).strip(), "ingredients": ings,
                 "steps": steps, "source": re.sub(r"\s*\n\s*", " ", src),
                 "complete": (not generic) and has_qty, "generic_placeholder": generic,
                 "nutrition": None})
json.dump({"book": "Ensiklopedia Masakan Malaysia - Gigantic Edisi 7 (Bahan Lengkap)",
           "note": "Nutrition is null: the book contains no nutrient values. Import sourced values (e.g. MyFCD) separately.",
           "recipes": recs}, open(out, "w"), ensure_ascii=False, indent=1)
print(len(recs), "recipes;", sum(r["complete"] for r in recs), "complete;", sum(r["generic_placeholder"] for r in recs), "generic")
