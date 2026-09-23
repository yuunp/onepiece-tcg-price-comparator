# BountyDex clean-slate visual refactor handoff

## Direction

**A card identity workbench for comparing returned marketplace evidence.** BountyDex should feel like a buyer's inspection desk because the real decision is not browsing a feed; it is confirming that two listings represent the same card, then comparing price, variant, condition, and provenance. The dominant visual idea is the two-lane source board, supported by a compact search utility and a narrow identity index.

## Design research (completed before implementation)

Only public URLs that resolved directly were retained. Page Flows returned HTTP 403 from this environment, so it was not used as evidence.

### 1. Mobbin — iOS app discovery
URL: https://mobbin.com/discover/apps/ios (HTTP 200; redirected from the public browse path)

- **Problem it solves:** finding relevant product UI examples through a categorized, search/discovery-oriented library rather than a single editorial landing page.
- **Useful principles:** keep discovery utility close to the top; organize a large visual corpus around clear contexts; let the artifact/content carry the visual weight; use restrained metadata to orient scanning.
- **Intentionally not copied:** no screenshot gallery, app-category chrome, or inspiration-library framing; BountyDex needs returned marketplace evidence, not a portfolio of examples.

### 2. Mobbin — web app discovery
URL: https://mobbin.com/discover/apps/web (HTTP 200)

- **Problem it solves:** browsing web-product patterns across a broad set of contexts while preserving a quick path into the relevant artifact.
- **Useful principles:** use a stable utility frame; establish a predictable scan order; separate navigation/orientation from the content being inspected; keep density purposeful.
- **Intentionally not copied:** no generic browser-like shell, filter-heavy directory, or “infinite inspiration” feed. BountyDex uses a fixed identity rail and two source lanes instead.

### 3. Refero — ecommerce inspiration collection
URL: https://refero.design/inspiration/ecommerce (HTTP 200)

- **Problem it solves:** grouping ecommerce interface references around a task/domain so people can compare patterns relevant to product discovery.
- **Useful principles:** domain context should determine the example set; product discovery benefits from visible item identity; comparison and scanning need consistent alignment; utility should outrank promotional storytelling.
- **Intentionally not copied:** no ecommerce hero, generic product-grid landing page, or decorative category tiles. BountyDex starts with the search and comparison workspace.

### 4. Refero — product-page inspiration collection
URL: https://refero.design/inspiration/product-page (HTTP 200)

- **Problem it solves:** collecting product-detail patterns where identity, attributes, and the next action must be read together.
- **Useful principles:** make identity unambiguous before secondary attributes; give the decision value a clear visual anchor; keep action/provenance adjacent to the item it describes; avoid scattering key facts across unrelated modules.
- **Intentionally not copied:** no single-product commerce detail page, add-to-cart funnel, reviews/ratings pattern, or fabricated marketplace metric. BountyDex retains source links and factual availability states only.

## Synthesis into BountyDex

- Search is a compact persistent utility in the header, not an oversized hero.
- Results read as an inspection board: a left **Identity Index** rail and a main **Source lanes** workspace.
- Each matched identity uses a horizontal card header followed by parallel TCGPlayer and Liga One Piece lanes.
- Price is the strongest listing value; converted currency, variant, condition, image, and source link remain adjacent and explicit.
- A missing provider is represented as unavailable/paused, never as a fake zero-price match. Unmatched groups remain an identity-review section.
- Neutral green/ink/orange source markers, square-ish evidence surfaces, thin rules, and compact type create a catalog/workbench grammar distinct from the deployed warm editorial version.

## What changed

- Replaced the deployed oversized headline/hero-first composition with a compact three-part utility header: brand, search, source context.
- Made the comparison workspace the visual anchor: identity rail + parallel source lanes.
- Removed the old comparison stat strip and stacked comparison sections as the primary primitive.
- Kept source tabs/counts, grid/list view, sort controls, clear search, recent-search replay, live/fallback FX messaging, loading/error/empty states, safe source URLs, source links, image fallback, variant and condition details, and existing API routes.
- Liga unavailable state remains calm and explicit; local real query shows comparison paused rather than fabricating matches.
- No gradients, glass, glow, blobs, fake metrics, decorative icon grids, excessive pills, vague marketing copy, new dependencies, deployment, DNS, Cloudflare, or production checkout changes.

## Changed files

- `app/globals.css` — new compact workbench visual system, source lanes, identity rail, responsive layout, focus/reduced-motion rules.
- `components/price-comparison.tsx` — new first-class identity/source-lane comparison composition, truthful unavailable lane, explicit price/variant/condition/source fields, placeholder fallback.
- `app/page.tsx` — retained existing search/API/state behavior and routes; existing header/results markup is styled into the new compact utility and tab workspace.
- `HANDOFF.md` — research, synthesis, rejected patterns, and verification evidence.

## Verification evidence

Executed only in `/home/yun/work/bountydex-forge-visual`.

- `npm run typecheck` — passed.
- `npm run build` — passed. Routes remained `/`, `/api/currency/convert`, `/api/liga/search`, `/api/tcgplayer/categories`, `/api/tcgplayer/search`.
- Isolated dev server: `http://localhost:3036` via `npm run dev -- --hostname localhost --port 3036`; no production port or deploy touched.
- Browser first viewport at local `localhost:3036`: compact header with brand/search/source context, no editorial headline; screenshot showed no clipping.
- Real query `OP01-025`: loading state displayed “Checking both marketplaces”; TCGPlayer returned 2 listings; currency returned live rate (`1 USD = R$ 5.15` in browser); Liga returned `available: false`, zero results, warning `SCRAPER_API_KEY is not configured`.
- Comparison tab: displayed real Liga warning and “Comparison paused: Liga has no returned listings”; did not fabricate a comparison workspace without the second provider.
- TCGPlayer tab: displayed 2 listings, Grid/List controls, Market/Low/High sort controls, and Low to High direction control. Browser clicks exercised List, direction toggle, and clear.
- Clear search: removed query/results and returned to landing state; recent-search button `OP01-025` appeared and was clicked to replay the search.
- Browser console after clearing: no messages/JS errors observed. Desktop geometry probe: `innerWidth 1280`, `scrollWidth 1265`, `overflow false`; controls measured at least 44px where applicable.
- Image evidence: real TCGPlayer card assets rendered; placeholder fallback path is `public/placeholder.svg` and exists.
- Source links were rendered with safe URL handling and `target="_blank" rel="noopener noreferrer"` in source-card markup.
- Accessibility/static checks: semantic search textbox/label, tab roles and selected state, alt text for returned images and placeholder, visible focus rule, and `prefers-reduced-motion` rule present.
- Deployed baseline comparison: `https://bountydex.yunp.fun` screenshot showed the prior warm paper field, red top rule, large “Find the card. Read the market.” headline, and search beneath hero copy. Local screenshot showed a one-row compact search header and results organized beneath an identity/source workspace. This is a material change in first-viewport geometry, reading order, surfaces, spacing rhythm, and comparison primitive.

## Issues and limitations

- Local environment has no `SCRAPER_API_KEY`; a true matched two-provider comparison cannot be runtime-exercised. The unavailable branch was exercised honestly, and the matched branch is covered by the rendered component/data logic.
- Direct smoke probe returned HTTP 500 for `/api/tcgplayer/categories` in this environment. This is an existing route issue outside the visual refactor and is recorded rather than hidden; search, Liga, and currency routes returned HTTP 200.
- Browser tooling provided a desktop viewport (`1280x577`) but no device emulation. Responsive CSS was statically inspected and the desktop no-overflow assertion passed; mobile-specific runtime behavior remains unverified.

## Canonical identity and conservative matching

The comparison model now uses `CanonicalIdentity` in `lib/comparison.ts`: `game`, `setCode`, `cardNumber`, `variant`, explicit markers, and optional language/printing. Values are only populated from source fields or recognizable One Piece code/name patterns; missing values remain `null`/`unknown`.

- Recognized code families: `OP`, `ST`, `EB`, `PRB`, `P`, and `DON`.
- Parenthetical source suffixes are removed only for known source labels; unknown parenthetical text is retained as card-name evidence.
- Variant markers retain alternate art/parallel, promo, reprint, manga, gold/foil, and special. Unknown variants are never renamed `Standard`.
- `matchStatus` is `exact`, `ambiguous`, or `unmatched`. Only complete same-code/same-variant/same-marker identities become `exact` and receive price comparison. Missing code/number/variant, source omission, or conflicting markers become identity review; complete identities with no counterpart are unmatched.
- Candidate grouping uses code boundaries or same set/name only to keep listings together for review. It never upgrades a name-only similarity into a verified match.
- UI labels are `VERIFIED IDENTITY`, `NEEDS IDENTITY REVIEW`, and `NO VERIFIED COUNTERPART`; evidence calls out exact code, variant differences, missing fields, promo/reprint markers, and counterpart availability. All listings remain in source tabs and review lanes.

## Focused identity fixtures

`npm run test:identity` runs `scripts/identity-fixtures.ts` with Node's built-in TypeScript stripping. It covers exact OP01-025, alternate-art vs base, promo vs base, reprint suffix, missing code, similar-name/different-code false match, and incomplete identity rejection.

## Additional changed files

- `lib/comparison.ts` — canonical identity extraction, explicit resolution statuses, evidence, conservative grouping.
- `components/price-comparison.tsx` — exact-only comparison and separate identity-review rendering.
- `app/globals.css` — evidence row styling.
- `scripts/identity-fixtures.ts`, `package.json`, `tsconfig.json` — focused executable fixtures and script configuration.

## Focused verification evidence

- `npm run test:identity` — passed; all listed fixtures passed. Node emitted only the expected module-type performance warning.
- `npm run typecheck` — passed.
- `npm run build` — passed; all existing routes generated successfully.
- Isolated preview `http://localhost:3037` — started from this worktree. `OP01-025` rendered the honest Liga unavailable/paused state with 2 TCGPlayer listings preserved. Variant-like query `OP01-025 alternate art` returned 100 TCGPlayer listings and the same source-availability state. Browser console had 0 messages and 0 JS errors.
- A real two-provider exact/review render was not runtime-available because `SCRAPER_API_KEY` is absent; pure fixtures exercise those branches deterministically.

## Updated limitations

- The live environment still lacks Liga scraper credentials, so no live cross-source exact card can be exercised. This is explicitly unverifiable, not treated as a pass.
- Matching is intentionally conservative: listings with incomplete source metadata remain review-only even if their names look identical.

## Focused correction pass after Vera FAIL

This pass was limited to canonical identity parsing/matching, identity fixtures, and this handoff. Production was not opened or modified; no deploy, commit, push, DNS, or Cloudflare action was performed.

- Unknown code suffixes such as `OP01-025-XYZ` now canonicalize to `variant: "unknown"` and remain identity-review-only, even when both sources share the same unknown code.
- Deterministic `P-001` and `DON-001` base identities now canonicalize to `setCode: "P"`/`"DON"`, `cardNumber: "001"`, `variant: "base"`, so equal bases are exact-matchable.
- `P-001-AA` and `DON-001-AA` now parse as set `P`/`DON`, card `001`, and alternate-art variant rather than treating the whole base as the set.
- Full-art is now a shared canonical marker for both name-only `Full Art` and `-FA` code evidence, allowing those two representations to match exactly when all other identity fields agree.
- Existing conservative behavior remains: exact comparison still requires complete, recognized variants and identical markers; missing, unknown, or conflicting metadata stays in review. Existing promo, reprint, alternate-art, manga, gold/foil, and special marker logic was retained.

### Focused verification evidence

Executed in `/home/yun/work/bountydex-forge-visual`:

- `npm run test:identity` — passed. Fixtures cover exact OP01-025, variant disagreement, promo/base, reprint, missing code, similar-name false match, unknown suffix review, P/DON bases, P/DON alternate-art suffix parsing, full-art name/code consistency, OP/ST/EB/PRB base identities, and alternate/reprint/manga/gold/foil/special markers. Node emitted only the existing module-type performance warning.
- `npm run typecheck` — passed.
- `npm run build` — passed. Next generated the existing routes: `/`, `/api/currency/convert`, `/api/liga/search`, `/api/tcgplayer/categories`, and `/api/tcgplayer/search`.
- Isolated browser preview was not needed for this pure identity-library correction; the changed behavior is covered by executable fixtures. Live two-provider matching remains unavailable without `SCRAPER_API_KEY`.

### Updated limitations

- `npm run test:identity` uses Node's experimental TypeScript stripping and continues to emit a non-failing `MODULE_TYPELESS_PACKAGE_JSON` performance warning.
- No live Liga-backed exact/review render was possible because the local environment lacks `SCRAPER_API_KEY`; UI/provider behavior outside the pure identity path remains subject to the prior handoff evidence.

## Readiness

**Ready for Vera's independent review; not deployment-ready without Vera/stakeholder approval.** No production files, deploys, commits, pushes, DNS, or Cloudflare changes were made.
