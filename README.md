# QwikLit public feed

This standalone repository publishes only publication metadata: titles, authors, dates, and links to the original publishers. It contains no app code, account data, or copied full text. The feed file is `site/v1/today.json`.

## Editor’s Choice candidates

The proposed weekly editorial edition is at `site/v1/editors-choice.json`, with a readable page at `site/editors-choice/`. It is a separate ten-item selection for the QwikLit owner to read and curate; `status: proposed_for_reader_review` and each item’s `reviewStatus` record that boundary. The app’s active `today.json` feed is unchanged, and the current app does not yet consume Editor’s Choice.

For the October 7, 2026 edition, all 456 active-feed entries were screened by title, form, source, and date. Original publisher pages were checked before selecting ten pieces published between August 7 and October 7. The editorial file corrects the active feed’s wrong bylines for “The Cleaner,” “Spectacular Barbecue,” and “The Last Bayog”; it also uses the publisher’s September 28 issue date for “Witnesses.” Feed dates and publisher dates are kept separately.

For each new weekly edition, review the current `today.json`, reject non-literary or misclassified entries and older works surfaced by a feed update, read the publisher pages, then replace the ten candidates and notes. Keep all outbound works `metadata_only`, retain `sourceFeedItemId` and `sourceFeedRefreshedAt` for audit, and leave review status pending until the QwikLit owner makes a decision. The app can adopt this separate JSON route in a later release after the owner’s curation.

## Automatic updates

The roster now contains 77 source feeds. The October 30 expansion adds fifteen university, community-led, and international publications, including Spanish and Portuguese poetry. `publication-metadata.mjs` provides shared genre, language, canonical-link, and publisher-specific title/byline rules for the public feed and service ingestion. New-source filters prefer original literary works over submission notices and contributor directories. When a feed supplies a CMS account instead of a creative byline, that account is omitted. Run `npm test` before publishing parser changes.

GitHub Actions runs `refresh.mjs` every six hours and deploys `site/` to GitHub Pages. A publisher failure retains its last available links and is recorded in `sourceStatus`; a run where fewer than 80% of the publishers respond leaves the prior edition online. The workflow also saves each new edition in the repository, so its history is reviewable.

The feed is periodically refreshed, rather than an instantaneous stream. Publisher sites control what their RSS or public API makes available and may block automated requests. The JSON reports the number of successful sources and lists the failures.

## Historical stories

`site/v1/historical.json` is a separate metadata-only reading catalog. `historical-catalog.json` supplies curated individual classics and later free fiction; `node refresh-historical.mjs` checks their story links and discovers additional stories from East of the Web’s fiction index. It does not modify `today.json` or editorial picks. The six-hour workflow publishes all routes together. `site/v1/historical-health.json` records per-link checks and retained records when a host fails. Run `npm test` to verify the discovery and deduplication rules.

To add a curated work, register its host and add a stable ID, title, author, canonical HTTPS reading URL, form, era, genre tags, and `rightsMode: metadata_only`. Supply an original year only when known. Use `attributionUrl` only for a verified collection page when the individual reading page omits its author; it must be on the same host and link to or contain that story. Successful verification updates `verifiedAt`, which is never used as a publication date. QwikLit stores no host story text or artwork.

To inspect the current edition, open `https://philspatial3d.github.io/qwiklit-feed/` in a browser. To check automatic updates, open the repository's **Actions** tab and choose **Refresh and publish the QwikLit feed**. The **Run workflow** button provides a one-time retry if GitHub misses a scheduled run; normal updates require no CLI commands.

GitHub may disable schedules in public repositories after 60 days without repository activity. The workflow saves each successful edition as a commit, but the Actions page should still be checked occasionally for failures or a disabled schedule.

## App connection

The app uses the HTTPS JSON address `https://philspatial3d.github.io/qwiklit-feed/v1/today.json`. Once that address is embedded in an App Store build, publication updates reach installed apps without another app release. The app keeps a bundled and on-device cached edition for outages.
