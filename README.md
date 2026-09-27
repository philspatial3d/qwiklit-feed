# QwikLit public feed

This standalone repository publishes only publication metadata: titles, authors, dates, and links to the original publishers. It contains no app code, account data, or copied full text. The feed file is `site/v1/today.json`.

## Automatic updates

GitHub Actions runs `refresh.mjs` every six hours and deploys `site/` to GitHub Pages. A publisher failure retains its last available links and is recorded in `sourceStatus`; a run where fewer than half the publishers respond leaves the prior edition online. The workflow also saves each new edition in the repository, so its history is reviewable.

The feed is periodically refreshed, rather than an instantaneous stream. Publisher sites control what their RSS or public API makes available and may block automated requests. The JSON reports the number of successful sources and lists the failures.

To inspect the current edition, open `https://philspatial3d.github.io/qwiklit-feed/` in a browser. To check automatic updates, open the repository's **Actions** tab and choose **Refresh and publish the QwikLit feed**. The **Run workflow** button provides a one-time retry if GitHub misses a scheduled run; normal updates require no CLI commands.

GitHub may disable schedules in public repositories after 60 days without repository activity. The workflow saves each successful edition as a commit, but the Actions page should still be checked occasionally for failures or a disabled schedule.

## App connection

The app uses the HTTPS JSON address `https://philspatial3d.github.io/qwiklit-feed/v1/today.json`. Once that address is embedded in an App Store build, publication updates reach installed apps without another app release. The app keeps a bundled and on-device cached edition for outages.
