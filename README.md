# Equilibra

Malaysia-first, nutrition-first wellness app prototype. Static site, no build step, no runtime dependencies.

> **Not medical advice.** Food values, allergen tags and daily targets in this repo are synthetic development data. Do not rely on the allergen tags for real allergy decisions; always check actual ingredients.

## Features (current)

- **Today**: Next Best Action with a "Why?" explanation, remaining protein/fibre/hydration, next-meal window
- **Allergy-aware suggestions**: foods containing your allergens (e.g. soy) are never suggested. If the best-fitting food is blocked, the most nutritionally similar allergen-free food is offered instead, with a note explaining the swap (`src/domain/allergy.js`, `src/domain/recommend.js`)
- **Profile**: name, age, height, weight feed the greeting, daily targets, hydration goal, suggestions and Coach
- **Nutrition**: search and log foods (S/M/L portion estimates), meal history
- **Scan**: photo to review to correct to portion to log, using a clearly labelled **mock** recognizer
- **Health**: hydration, optional check-ins, breathing reset (respects Reduce Motion)
- **Coach**: rule-based preview (no LLM)
- Hide calories, Focus-Friendly Mode, data export and delete. All data stays in the browser (`localStorage`)

## Design

Calm, organic-modern interface built on CSS design tokens (`src/styles.css`): warm neutral surfaces, deep botanical green, system font stack, SVG icons, bottom-sheet dialogs, toasts instead of browser alerts, intentional dark mode, 44px touch targets, visible focus rings, `prefers-reduced-motion` support, and text alternatives for all progress bars.

## Run

ES modules need a web server (opening `index.html` directly will not work):

```bash
npm start            # python3 -m http.server 8080, then open http://localhost:8080
npm test             # Node >= 18, uses the built-in test runner
```

## Structure

```
index.html
src/
  app.js              UI and event handlers
  styles.css          design tokens, light/dark
  storage.js          localStorage state (sanitised on load)
  icons.js            inline SVG icon set
  util.js
  data/foods.js       DEV food data (replace with sourced records)
  domain/
    allergy.js        hard allergen filter + nutrition-similarity substitutes
    recommend.js      gap-based ranking, applies allergy filter before output
    nutrition.js      targets, portion scaling, daily totals
tests/                node:test unit tests
```

## How allergy substitution works

1. Every food carries allergen tags. Foods matching the user's allergy list are unsafe.
2. Foods are ranked by how much of today's remaining protein and fibre they cover.
3. An unsafe food is never returned. In its place, `substitutesFor` picks the allergen-free food with the smallest scaled distance over kcal, protein, carbs, fat and fibre.
4. The UI says "Instead of X (contains soy)" so the swap is transparent.

## Deploy on GitHub Pages

Push to GitHub, then Settings > Pages > Deploy from branch > `main` / root.

## Roadmap

Verified Malaysian nutrition source with provenance, real vision provider behind an interface, goals, weekly summary, Bahasa Melayu localization, backend and auth, notifications, safety policy service.
