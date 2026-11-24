# Architecture decisions (current prototype)

- **Client:** a single-file web app in plain HTML, CSS and JavaScript. No build step, so it runs from any static host (GitHub Pages).
- **Storage:** browser localStorage. Data never leaves the device. Export and delete are in the profile sheet.
- **Data:** static JSON in `data/`. Nutrition stays null until a sourced value is imported.
- **Logic:** deterministic rules for targets, nutrient gaps, allergy filtering, suggestions, meal timing, day balance and dashboard insights. The Coach only explains results these rules produce.
- **Dashboard:** `dstat()` computes pace against time of day (assuming a 7:00 AM to 10:00 PM day), meal gaps, energy or protein distribution by period, recent trend and ranked improvements. `dashHTML()` renders it; `tickDash()` refreshes it every 30 seconds.
- **Scan:** a placeholder adapter behind `analyse()`. Replace it with a real image-recognition provider; the review, portion and confirmation steps already exist.
- **Safety:** allergies are hard filters applied before ranking. No diagnosis, no shame language, demo targets are not clinical advice. Missing data is never scored as poor.
- **Accessibility:** labelled controls, scalable text, Reduce Motion support, text alternatives for charts.
- **Production path:** typed client (React Native or similar), typed API, relational database, S3-compatible storage, job scheduler for reminders, as a modular monolith.

- **Home atmosphere:** `phase()` maps the device time to dawn, day, dusk or night; `scene()` draws the matching animated sky and `greet()` picks the Malay greeting. `tickSky()` refreshes both every 30 seconds. Settings has a preview of each time of day.
- **Allergies:** `ALG` lists the built-in allergens and `ALK` maps each to ingredient keywords for recipes; foods carry explicit tags. `alHit()` also matches custom entries by name. Suggestions are filtered, and logging a flagged food asks for confirmation.
- **Icons:** the four bottom-tab icons keep their original set and animation (`TI`); every other icon comes from the `IC2` line set.
