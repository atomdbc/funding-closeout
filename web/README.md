# Local review interface

`view.ts` server-renders escaped HTML and native forms. `app.css` and `near.css` supply responsive light/dark styling. `app.js` enhances submission feedback, error focus and local JSON file selection; it does not calculate return eligibility, make RPC requests or move money. The server handles fixed-endpoint read-only NEAR checks and local storage. No frontend build step, external assets or wallet is needed. See the root README and `docs/LOCAL_STORAGE.md` for the boundary between fictional records, checked movement facts and reporter claims.
