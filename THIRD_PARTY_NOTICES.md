# Third-party notices

The MIT license in `LICENSE` covers this project's original code, not third-party packages, the Node.js runtime or external data sources. Dependencies retain their own licenses. There are no npm runtime dependencies.

Pinned development dependencies:

| Package            | Version | License    | Upstream                                           |
| ------------------ | ------- | ---------- | -------------------------------------------------- |
| `@playwright/test` | 1.65.0  | Apache-2.0 | https://github.com/microsoft/playwright            |
| `@types/node`      | 24.19.2 | MIT        | https://github.com/DefinitelyTyped/DefinitelyTyped |
| `axe-core`         | 4.14.0  | MPL-2.0    | https://github.com/dequelabs/axe-core              |
| `prettier`         | 3.10.1  | MIT        | https://github.com/prettier/prettier               |
| `typescript`       | 7.0.2   | Apache-2.0 | https://github.com/microsoft/TypeScript            |

The lockfile pins transitive development dependencies; their package distributions carry their respective license notices. Unmodified packages are installed through npm, not copied into this source release. Node.js and its bundled SQLite implementation retain their respective upstream notices.

## Self-hosted font in local v0.5

`web/assets/hanken-grotesk-variable.ttf` is the unmodified Hanken Grotesk variable font, copyright 2021 The Hanken Grotesk Project Authors. It remains under **SIL Open Font License 1.1**, not this project's MIT license. The full notice is bundled at `web/assets/HankenGrotesk-OFL.txt`. Source: https://github.com/google/fonts/tree/main/ofl/hankengrotesk (original project https://github.com/marcologous/hanken-grotesk). Font requests are served locally, not from Google/CDN at runtime.

The public sample transaction and token identifiers are blockchain facts cited for reproducibility. They are not our program funding, customer activity or an endorsement by their participants. Protocol documentation and token-issuer references are cited in `docs/NEAR_RECEIPTS.md`; no NEAR or Circle endorsement is implied.
