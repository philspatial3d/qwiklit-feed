# QwikLit public feed

This standalone repository publishes only publication metadata: titles, authors, dates, and links to the original publishers. It contains no app code, account data, or copied full text. The feed file is `site/v1/today.json`.

## Editor’s Choice candidates

The proposed weekly editorial edition is at `site/v1/editors-choice.json`, with a readable page at `site/editors-choice/`. It is a separate ten-item selection for the QwikLit owner to read and curate; `status: proposed_for_reader_review` and each item’s `reviewStatus` record that boundary. The app’s active `today.json` feed is unchanged, and the current app does not yet consume Editor’s Choice.

For the October 7, 2026 edition, all 456 active-feed entries were screened by title, form, source, and date. Original publisher pages were checked before selecting ten pieces published between August 7 and October 7. The editorial file corrects the active feed’s wrong bylines for “The Cleaner,” “Spectacular Barbecue,” and “The Last Bayog”; it also uses the publisher’s September 28 issue date for “Witnesses.” Feed dates and publisher dates are kept separately.

For each new weekly edition, review the current `today.json`, reject non-literary or misclassified entries and older works surfaced by a feed update, read the publisher pages, then replace the ten candidates and notes. Keep all outbound works `metadata_only`, retain `sourceFeedItemId` and `sourceFeedRefreshedAt` for audit, and leave review status pending until the QwikLit owner makes a decision. The app can adopt this separate JSON route in a later release after the owner’s curation.

## Automatic updates

GitHub Actions runs `refresh.mjs` every six hours and deploys `site/` to GitHub Pages. A publisher failure retains its last available links and is recorded in `sourceStatus`; a run where fewer than 80% of the publishers respond leaves the prior edition online. The workflow also saves each new edition in the repository, so its history is reviewable.

The feed is periodically refreshed, rather than an instantaneous stream. Publisher sites control what their RSS or public API makes available and may block automated requests. The JSON reports the number of successful sources and lists the failures.

To inspect the current edition, open `https://philspatial3d.github.io/qwiklit-feed/` in a browser. To check automatic updates, open the repository's **Actions** tab and choose **Refresh and publish the QwikLit feed**. The **Run workflow** button provides a one-time retry if GitHub misses a scheduled run; normal updates require no CLI commands.

GitHub may disable schedules in public repositories after 60 days without repository activity. The workflow saves each successful edition as a commit, but the Actions page should still be checked occasionally for failures or a disabled schedule.

## App connection

The app uses the HTTPS JSON address `https://philspatial3d.github.io/qwiklit-feed/v1/today.json`. Once that address is embedded in an App Store build, publication updates reach installed apps without another app release. The app keeps a bundled and on-device cached edition for outages.
