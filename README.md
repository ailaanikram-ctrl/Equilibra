# Equilibra

A Malaysia-first nutrition and wellbeing companion, built as an installable web app (PWA). Nutrition comes first; hydration, mood and rhythm provide context. It is a wellness tool, not a medical product.

## Run locally
```bash
npx serve .          # or: python3 -m http.server 8000
```
Open http://localhost:8000. The app must be served over http so `data/recipes.json` loads.

## Publish on GitHub Pages
1. Create a repository and upload the contents of this folder.
2. Settings, Pages, Source: **GitHub Actions**.
3. Push to `main`; the workflow in `.github/workflows/pages.yml` publishes the site.

## What the app does
- **Today (dashboard):** a plate of four progress rings, next best action with a plain-language reason, and a live dashboard that processes your logs: day balance with a transparent breakdown (protein, fibre and water pace against the time of day, plus meal spacing), a timeline of your meals, a read on your eating behaviour, a recent trend, and ranked suggestions for what to improve. It refreshes on every action and every 30 seconds.
- **Nutrition:** scan a meal (photo, search or repeat last) sits at the top. Below it: food search and logging, daily completion, today's meals, 219 recipes from the Ensiklopedia Masakan Malaysia, and a weekly view.
- **Health:** hydration, an optional energy and mood check-in, and a breathing reset.
- **Coach:** answers questions about your day from your logged data using fixed rules.
- **Profile and settings:** name, age, height, weight; allergies as hard filters; hide calories; Focus-Friendly mode; Low-Energy mode; Reduce Motion; light and dark theme; export and delete your data.
- All data stays in the browser (localStorage). Nothing is sent anywhere.

## Data honesty
- `data/recipes.json` has 219 dishes extracted from the Ensiklopedia (Edisi 7). Only 5 have full quantities and steps in the book. Six more come from the Ministry of Health Resipi Sihat booklet with quantities and per-serving nutrition as published (`web_sourced: true`). The rest were completed from standard cooking methods (`drafted: true`), and the shortest are marked `draft_level: "outline"`. Verify every drafted or outline recipe against a trusted source before relying on it.
- Nutrition is `null` unless a sourced value is published. Spoon and cup measures are not converted to grams without a verified source.
- The food values in `index.html` (the `F` array) are labelled demo placeholders, and daily targets are demo formulas. Replace them with sourced data (for example MyFCD) before real use.
- The meal scan is a clearly labelled development placeholder; it does not recognise food.

## Files
```
index.html              the app (HTML, CSS and JavaScript in one file)
data/recipes.json       219 recipes with source and status fields
data/recipes_edisi8_complete6.json   six complete recipes from the earlier edition
data/ingredients_index.json          ingredient names ready for nutrition matching
scripts/extract_recipes.py           extracts recipes from the book PDF
scripts/pdf/                         builds the printable recipe book PDF
docs/                                architecture notes and the recipe book PDF
```

## Rebuild the recipe book PDF
```bash
python3 scripts/pdf/build_pdf.py path/to/book.pdf docs/Ensiklopedia_Masakan_Malaysia_Edisi_Lengkap.pdf
```
Needs Python with `reportlab` and `poppler-utils`.
