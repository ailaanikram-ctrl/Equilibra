# Architecture Decision (prototype)
- **Client:** single-file vanilla JS PWA (no build step) so it runs anywhere and deploys to GitHub Pages.
- **Storage:** browser localStorage; all data stays on device. Export/delete in Profile.
- **Data:** static JSON in `data/`. Nutrition is `null` until sourced values are imported.
- **Intelligence:** deterministic rules (targets, nutrient gaps, allergy filtering, suggestions); Coach only explains these results.
- **Vision:** mock adapter, visibly labelled. Replace `analyse()` with a provider behind a typed interface.
- **Production path:** TypeScript React Native/Expo client, typed API (Fastify/NestJS), PostgreSQL, S3-compatible storage, job scheduler for notifications. Modular monolith, no microservices.
- **Safety:** allergies are hard filters before ranking; no diagnosis; no shame language; demo targets are not clinical.
