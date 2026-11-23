# Equilibra 🥗

Malaysia-first nutrition and wellbeing companion (web/PWA prototype). Nutrition first; sleep, hydration and mood provide context. Not a medical product.

## Run
```bash
npx serve .        # or: python3 -m http.server 8000
```
Open http://localhost:8000. (Must be served over http so `data/recipes.json` loads.)

## Deploy to GitHub Pages
Push to `main`, then Settings → Pages → Source: **GitHub Actions**. The included workflow publishes the site.

## What works now
Today screen with Next Best Action and animated rings, manual food logging, mock photo scan flow, hydration, optional check-in, breathing reset, Coach (rule-based), profile + demo targets, allergy hard filters, hide-calories, Focus-Friendly and Low-Energy modes, Reduce Motion, dark mode, export/delete data, and 219 dishes from Ensiklopedia Masakan Malaysia Edisi 7.

## Data honesty
- `data/recipes.json` – extracted from the book by `scripts/extract_recipes.py`. Only **5** recipes have full quantities and steps (Nasi lemak, Ayam percik, Acar Ayam dan Telur, Ayam Masak Bawang, Ayam Masak Kicap Pekat); the other 214 are base ingredient lists the book marks for specific-recipe review.
- `data/recipes_edisi8_complete6.json` – six complete recipes from the earlier edition.
- `data/ingredients_index.json` – ingredient names ready to match to sourced nutrition.
- **The book has no nutrition values.** `nutrition` is `null` everywhere. Food values in `index.html` (`F` array) are labelled **demo placeholders**, and targets are demo formulas. Replace with sourced data (e.g. MyFCD) before real use.
- Spoon/cup measures are not converted to grams without a verified source.

## Re-extract
```bash
python3 scripts/extract_recipes.py path/to/book.pdf data/recipes.json   # needs poppler-utils
```

## Docs
`docs/ARCHITECTURE.md` (stack decision), `ROADMAP.md` (status and next steps).

## Recipe completeness
All 219 entries now have ingredients and steps, but only 5 come from the book. 135 are drafted (batches 1-3, short but usable) and 79 are `draft_level: "outline"` (batch 4): very short, quantities mostly missing. Verify every drafted/outline entry against a real recipe source before relying on it.
