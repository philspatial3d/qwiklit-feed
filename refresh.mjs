import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';
import sources from './sources.json' with { type: 'json' };
import { publicationEntryMetadata } from './publication-metadata.mjs';

const output = new URL('./site/v1/today.json', import.meta.url);
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, textNodeName: '#text', processEntities: false });
const perSourceLimit = 8;
const concurrency = 6;
const timeoutMs = 20_000;
const values = (value) => value === undefined ? [] : Array.isArray(value) ? value : [value];
const valueText = (value) => typeof value === 'string' || typeof value === 'number'
  ? String(value)
  : value && typeof value === 'object' ? valueText(value['#text'] ?? '') : '';
const linkValue = (value) => typeof value === 'string' ? value : valueText(value?.['@_href']);

function cleanText(value) {
  return valueText(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&(amp|apos|quot|lt|gt|nbsp);/gi, (_, name) => ({ amp: '&', apos: "'", quot: '"', lt: '<', gt: '>', nbsp: ' ' })[name.toLowerCase()])
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceOwnsUrl(source, value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const allowed = [source.canonicalDomain, new URL(source.homepageUrl).hostname]
      .map((name) => name.replace(/^www\./, '').toLowerCase());
    return allowed.some((name) => host === name || host.endsWith(`.${name}`));
  } catch {
    return false;
  }
}


function normalize(source, entry, checkedAt) {
  const metadata = publicationEntryMetadata(source, entry);
  if (!metadata || !sourceOwnsUrl(source, metadata.canonicalUrl)) return null;
  const { title, canonicalUrl, authorDisplay, contentType, formTag, language } = metadata;
  if (contentType === 'audio' || contentType === 'submission_call') return null;
  const rawDate = cleanText(entry.pubDate);
  const publicationDate = rawDate && !Number.isNaN(Date.parse(rawDate)) ? new Date(rawDate).toISOString() : undefined;
  const id = createHash('sha1').update(`live|${source.id}|${canonicalUrl}`).digest('hex');
  return {
    id, sourceId: source.id, canonicalUrl, title,
    authorDisplay, publicationDate, discoveredAt: checkedAt,
    contentType, genreTags: [], moodTags: [], formTags: [formTag], language,
    rightsMode: 'metadata_only', canonicalSourceName: source.name,
    qualityFlags: ['live_feed_request', ...metadata.qualityFlags], dedupeHash: createHash('sha256').update(`${source.id}|${canonicalUrl}`).digest('hex'),
    status: 'approved',
  };
}

function parseEntries(source, body, endpoint) {
  if (/^[\s\r\n]*\[/.test(body)) {
    return values(JSON.parse(body)).map((post) => ({
      title: post.title?.rendered, link: post.link,
      pubDate: post.date_gmt ? `${post.date_gmt}Z` : post.date,
      category: values(post.class_list).filter((value) => value.startsWith('genre-')).map((value) => value.slice(6)),
      body: post.content?.rendered ?? post.excerpt?.rendered,
    }));
  }
  if (source.sourceType === 'wordpress_rest') {
    return values(JSON.parse(body).posts).map((post) => ({
      title: post.title, link: post.URL, pubDate: post.date,
      author: post.author?.name,
      category: values(post.categories).map((category) => category?.name ?? category),
    }));
  }
  if (endpoint.includes('/wp-json/wp/v2/posts')) {
    return values(JSON.parse(body)).map((post) => ({
      title: post.title?.rendered, link: post.link, pubDate: post.date,
    }));
  }
  const xml = parser.parse(body);
  const entries = values(xml.rss?.channel?.item ?? xml.feed?.entry);
  return entries.map((item) => ({
    title: valueText(item.title), link: linkValue(item.link), guid: valueText(item.guid ?? item.id),
    pubDate: valueText(item.pubDate ?? item.published ?? item.updated),
    author: valueText(item.creator ?? item.author?.name ?? item.author),
    category: values(item.category).map(valueText),
    body: valueText(item.encoded ?? item.description ?? item.content),
    language: valueText(item.language ?? item['@_lang'] ?? xml.rss?.channel?.language ?? xml.feed?.['@_lang']),
  }));
}

async function fetchSource(source, checkedAt) {
  const endpoints = [source.apiUrl ?? source.feedUrl, source.fallbackUrl].filter(Boolean);
  if (!endpoints.length) throw new Error('No publication feed URL');
  let lastError;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: 'application/rss+xml, application/atom+xml, application/json;q=0.9', 'User-Agent': 'QwikLitBot/1.0 (+https://qwiklit.com/contact; feed metadata)' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const items = parseEntries(source, await response.text(), endpoint)
        .map((entry) => normalize(source, entry, checkedAt))
        .filter(Boolean)
        .slice(0, perSourceLimit);
      if (!items.length) throw new Error('No usable publication entries');
      return items;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const previous = JSON.parse(await readFile(output, 'utf8'));
const previousBySource = new Map(sources.map((source) => [source.id, previous.items.filter((item) => item.sourceId === source.id).slice(0, perSourceLimit)]));
const checkedAt = new Date().toISOString();
const results = [];
for (let offset = 0; offset < sources.length; offset += concurrency) {
  const group = await Promise.all(sources.slice(offset, offset + concurrency).map(async (source) => {
    try {
      const items = await fetchSource(source, checkedAt);
      return { sourceId: source.id, name: source.name, ok: true, items };
    } catch (error) {
      return { sourceId: source.id, name: source.name, ok: false, error: String(error), items: previousBySource.get(source.id) ?? [] };
    }
  }));
  results.push(...group);
}
const successes = results.filter((result) => result.ok).length;
if (successes < Math.ceil(sources.length * 0.8)) {
  throw new Error(`Only ${successes}/${sources.length} feeds responded; the last published edition was kept.`);
}
const seen = new Set();
const items = results.flatMap((result) => result.items)
  .sort((a, b) => (Date.parse(b.publicationDate ?? '') || 0) - (Date.parse(a.publicationDate ?? '') || 0))
  .filter((item) => item.canonicalUrl && !seen.has(item.canonicalUrl) && seen.add(item.canonicalUrl));
const payload = {
  items, refreshedAt: checkedAt, attemptedAt: checkedAt,
  successfulSourceCount: successes, totalSourceCount: sources.length,
  degraded: false, partial: successes < sources.length, revalidating: false,
  sourceStatus: results.map(({ sourceId, name, ok, error }) => ({ sourceId, name, ok, ...(error ? { error } : {}) })),
};
await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Published ${items.length} links from ${successes}/${sources.length} publications at ${checkedAt}.`);
if (successes < sources.length) console.log('Unavailable publications kept their last available links.');
