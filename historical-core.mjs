import { createHash } from 'node:crypto';

export const clean = (value) => value.replace(/<[^>]*>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&(?:amp|nbsp|quot|apos|rsquo|lsquo|rdquo|ldquo|ndash|mdash);/g, (entity) => ({ '&amp;': '&', '&nbsp;': ' ', '&quot;': '"', '&apos;': "'", '&rsquo;': "'", '&lsquo;': "'", '&rdquo;': '"', '&ldquo;': '"', '&ndash;': '-', '&mdash;': '-' })[entity]).replace(/\s+/g, ' ').trim();
export const normalized = (value) => clean(value).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');

export function verifyStoryPage(item, html, attributionHtml = '') {
  const url = new URL(item.url);
  const headings = [...html.matchAll(/<(?:title|h[1-3])\b[^>]*>([\s\S]*?)<\/(?:title|h[1-3])>/gi)].map((match) => normalized(match[1]));
  if (url.hostname === 'en.wikisource.org') headings.push(...[...html.matchAll(/<div\b[^>]*class="header-section-text"[^>]*>([\s\S]*?)<\/div>/gi)].map((match) => normalized(match[1])));
  if (url.hash) {
    const anchor = decodeURIComponent(url.hash.slice(1));
    const marker = new RegExp(`(?:id|name)=["']${anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i');
    const position = html.search(marker);
    if (position < 0 || !normalized(html.slice(position, position + 1200)).includes(normalized(item.title))) throw new Error('Story anchor/title missing');
  } else if (!headings.some((heading) => heading.includes(normalized(item.title)))) throw new Error('Story title missing from page headings');
  const surname = item.author.trim().split(' ').at(-1);
  if (!normalized(html + attributionHtml).includes(normalized(surname))) throw new Error('Author attribution missing');
  if (/isAccessibleForFree["']?\s*:\s*false/i.test(html) || /<title[^>]*>[^<]*(?:not found|access denied|just a moment)/i.test(html)) throw new Error('Page is unavailable or access-restricted');
}

/** Only accepts story routes and the story's own author block on this host. */
export function discoverEastOfWeb(html, checkedAt) {
  const title = clean(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  const authorBlock = html.match(/<article\b[^>]*class="[^"]*node--type-author[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? '';
  const author = clean(authorBlock.match(/field--name-title[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '');
  if (!title || !author) throw new Error('Story title/byline unavailable');
  const classicAuthors = /^(?:Saki|Mark Twain|John Polidori|Edith Wharton|Anton Chekhov|O\.? Henry|Edgar Allan Poe|W\. W\. Jacobs|Guy de Maupassant|Katherine Mansfield|Kate Chopin|Ambrose Bierce|Nathaniel Hawthorne|H\. G\. Wells|Oscar Wilde|Arthur Conan Doyle|Charles Dickens|Jack London|Bram Stoker|Robert Louis Stevenson|F\. Scott Fitzgerald)$/;
  return { title, author, form: 'short_story', era: classicAuthors.test(author) ? 'classic' : 'rediscovery', genres: ['fiction'], verifiedAt: checkedAt, rightsMode: 'metadata_only' };
}

export function eastOfWebLinks(html) {
  return [...new Set([...html.matchAll(/href="(\/short-stories\/UBooks\/[^"?#]+\.shtml)"/gi)].map((match) => `https://www.eastoftheweb.com${match[1]}`))].slice(0, 12);
}

export const discoveredId = (url) => `historical-eotw-${createHash('sha256').update(url).digest('hex').slice(0, 16)}`;

export function mergeHistoricalItems(catalogItems, discoveredItems) {
  const ids = new Set(); const urls = new Set(); const works = new Set();
  return [...catalogItems, ...discoveredItems].filter((item) => {
    const work = `${normalized(item.author)}|${normalized(item.title)}`;
    if (ids.has(item.id) || urls.has(item.url) || works.has(work)) return false;
    ids.add(item.id); urls.add(item.url); works.add(work);
    return true;
  });
}
