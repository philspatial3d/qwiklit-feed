import { readFile, writeFile } from 'node:fs/promises';
import { discoverEastOfWeb, discoveredId, eastOfWebLinks, mergeHistoricalItems, verifyStoryPage } from './historical-core.mjs';

const catalog = JSON.parse(await readFile(new URL('./historical-catalog.json', import.meta.url), 'utf8'));
const output = new URL('./site/v1/historical.json', import.meta.url);
let previous;
try { previous = JSON.parse(await readFile(output, 'utf8')); } catch { /* First edition. */ }
const checkedAt = new Date().toISOString();
const priorById = new Map((previous?.items ?? []).map((item) => [item.id, item]));
const checks = [];
const pageCache = new Map();

async function page(url) {
  const endpoint = new URL(url); endpoint.hash = '';
  if (endpoint.protocol !== 'https:') throw new Error('HTTPS required');
  if (pageCache.has(endpoint.href)) return pageCache.get(endpoint.href);
  const request = (async () => {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'QwikLit/1.0 (+https://qwiklit.com; story metadata and link verification)' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== 'https:' || finalUrl.hostname.replace(/^www\./, '') !== endpoint.hostname.replace(/^www\./, '')) throw new Error('Unexpected reading host redirect');
    const type = response.headers.get('content-type') ?? '';
    if (type.includes('pdf')) {
      const reader = response.body.getReader(); const { value } = await reader.read(); await reader.cancel();
      if (!new TextDecoder().decode(value).startsWith('%PDF-')) throw new Error('Invalid PDF');
      return { pdf: true };
    }
    if (!/(?:html|xml)/i.test(type)) throw new Error('Not a reading page');
    // Bound network and memory use; never persist page bodies.
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let html = ''; let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.length; if (bytes > 3_000_000) throw new Error('Page exceeds metadata verification limit');
        html += decoder.decode(value, { stream: true });
      }
      html += decoder.decode();
    } finally { await reader.cancel().catch(() => {}); }
    return { html };
  })();
  pageCache.set(endpoint.href, request);
  return request;
}

async function verify(item) {
  try {
    const body = await page(item.url);
    let attributionHtml = '';
    if (item.attributionUrl) {
      const attributionUrl = new URL(item.attributionUrl);
      const storyUrl = new URL(item.url);
      if (attributionUrl.origin !== storyUrl.origin) throw new Error('Invalid collection attribution host');
      attributionHtml = (await page(item.attributionUrl)).html;
      const linksToStory = [...attributionHtml.matchAll(/href=["']([^"']+)["']/gi)].some((match) => {
        try { return new URL(match[1], attributionUrl).pathname === storyUrl.pathname; } catch { return false; }
      });
      if (!storyUrl.pathname.startsWith(`${attributionUrl.pathname}/`) && !linksToStory) throw new Error('Attribution page does not identify story');
    }
    if (!body.pdf) verifyStoryPage(item, body.html, attributionHtml);
    checks.push({ id: item.id, sourceId: item.sourceId, url: item.url, checkedAt, ok: true });
    return { ...item, verifiedAt: checkedAt };
  } catch (error) {
    checks.push({ id: item.id, sourceId: item.sourceId, url: item.url, checkedAt, ok: false, error: error.message, retained: priorById.has(item.id) });
    return priorById.get(item.id);
  }
}

async function mapBounded(items, fn) {
  let cursor = 0; const results = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; results[index] = await fn(items[index]); }
  }));
  return results.filter(Boolean);
}

const verified = await mapBounded(catalog.items, verify);
let discovered = [];
try {
  const index = await page('https://www.eastoftheweb.com/fiction');
  const links = eastOfWebLinks(index.html).filter((url) => !catalog.items.some((item) => item.url === url));
  discovered = await mapBounded(links, async (url) => {
    try {
      const body = await page(url);
      const item = { id: discoveredId(url), sourceId: 'historical-east-of-web', url, ...discoverEastOfWeb(body.html, checkedAt) };
      verifyStoryPage(item, body.html);
      checks.push({ id: item.id, sourceId: item.sourceId, url, checkedAt, ok: true, discovered: true });
      return item;
    } catch (error) { checks.push({ sourceId: 'historical-east-of-web', url, checkedAt, ok: false, error: error.message }); }
  });
} catch (error) { checks.push({ sourceId: 'historical-east-of-web', checkedAt, ok: false, error: error.message }); }

const catalogIds = new Set(catalog.items.map((item) => item.id));
// Keep a bounded backlist of prior discoveries; never promote an unverified candidate.
const backlist = (previous?.items ?? []).filter((item) => !catalogIds.has(item.id)).slice(-48);
const items = mergeHistoricalItems(verified, [...discovered, ...backlist]);
const represented = new Set(items.map((item) => item.sourceId));
await writeFile(new URL('./site/v1/historical-health.json', import.meta.url), `${JSON.stringify({ checkedAt, checks }, null, 2)}\n`);
if (represented.size < 10 || items.length < 40) {
  const reason = `Historical edition too thin: ${items.length} stories / ${represented.size} hosts.`;
  if (previous?.items?.length >= 40 && previous?.sources?.length >= 10) { console.warn(`${reason} Previous historical edition preserved; current publication feed may still publish.`); process.exit(0); }
  throw new Error(`${reason} ${checks.filter((check) => !check.ok).map((check) => `${check.id}: ${check.error}`).join('; ')}`);
}
const sources = catalog.sources.filter((source) => represented.has(source.id));
const feed = { schemaVersion: 1, refreshedAt: checkedAt, sources, items, sourceStatus: sources.map((source) => {
  const status = checks.filter((check) => check.sourceId === source.id);
  return { sourceId: source.id, checkedAt, successful: status.filter((check) => check.ok).length, failed: status.filter((check) => !check.ok).length };
}) };
await writeFile(output, `${JSON.stringify(feed, null, 2)}\n`);
console.log(`Historical feed: ${items.length} stories from ${sources.length} sources; ${checks.filter((check) => !check.ok).length} failed checks (last verified links retained).`);
