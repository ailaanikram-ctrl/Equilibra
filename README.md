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
- **Today (daily dashboard):** a sky that follows your device clock and the weather: sunrise and morning, daylight, sunset, moon and stars, each in clear, cloudy, rainy (animated rain), stormy (lightning) or hazy versions, with a mood line to match and the correct Malay greeting (Selamat Pagi, Selamat Tengah Hari, Selamat Petang or Selamat Malam). It updates on its own. Weather can come from your location (opt in, free Open-Meteo service, approximate location only, not stored) or you can set it yourself. Weather also shapes the tips: a hot-day water nudge, indoor movement when it rains or the air is hazy, and warmer or lighter food picks. Below it: four live tiles for hydration against your daily water target, calories in against estimated burn, activity and wellness progress; the next best action; a plate of nutrition rings; and a live dashboard with a day balance and its breakdown, a meal timeline, a read on your eating habits, a recent trend, and ranked suggestions for what to improve.
- **Nutrition:** Scan sits at the top and nowhere else. Tabs: Log (search, daily completion, today's meals), For you (what to eat and what to cook, based on your goal, eating style, allergies and what you still need today), Recipes (219 dishes) and Weekly.
- **Health:** Water (animated glass), Mind (check-in and a one-minute breathing reset), Activity (log walks, runs and more; burn is estimated from activity, time and weight and never changes your eating targets).
- **Coach:** answers questions about your day from your logged data using fixed rules.
- **First run:** a short four-step setup (name, about you, allergies, optional weather) that you can skip.
- **Meal timing:** next-meal window from your own routine (wake, meals, bedtime), with Remind me, In 30 min, Already ate, Skip today and Adjust. Reminders fire while the app is open (and as a system notification if you allow it). Recent foods give one-tap repeat logging, and water has quick amounts.
- **Profile:** name, age, height, weight, goal, eating style; allergies (soy, seafood, shellfish, dairy, eggs, peanuts, tree nuts, wheat/gluten, sesame, plus your own custom ones) that filter suggestions and warn before you log a food; switches for hide calories, Focus-Friendly mode, Low-Energy mode, Reduce Motion and dark theme; a preview of the four times of day; export and delete your data.
- All data stays in the browser (localStorage). Nothing is sent anywhere.

## Motion and interaction
A single motion system (shared easing and timing) drives the app: a short opening animation, direction-aware screen transitions, scroll-triggered reveals with staggered lists, parallax on the sky, a condensed header that appears as you scroll, count-up numbers and rings that glide from their previous value, a spring-feel on buttons with a soft ripple, draggable bottom sheets, and an Undo toast after logging food. Updating a value (for example adding water) keeps your scroll position and does not replay the whole screen. Everything respects the device's Reduce Motion setting and the in-app switch.

## Data honesty
- `data/recipes.json` has 219 dishes extracted from the Ensiklopedia (Edisi 7). Only 5 have full quantities and steps in the book. Six more come from the Ministry of Health Resipi Sihat booklet with quantities and per-serving nutrition as published (`web_sourced: true`). The rest were completed from standard cooking methods (`drafted: true`), and the shortest are marked `draft_level: "outline"`. Verify every drafted or outline recipe against a trusted source before relying on it.
- Nutrition is `null` unless a sourced value is published. Spoon and cup measures are not converted to grams without a verified source.
- The food values in `index.html` (the `F` array) are labelled demo placeholders, and daily targets are demo formulas. Replace them with sourced data (for example MyFCD) before real use.
- The meal scan is a clearly labelled development placeholder; it does not recognise food. Allergy checks read food tags and recipe ingredient text, so always check labels and sauces.

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
