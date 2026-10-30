const entities = { amp: '&', apos: "'", quot: '"', lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' };
export function cleanPublicationText(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (match, code) => { const n = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code); return n <= 0x10ffff ? String.fromCodePoint(n) : match; })
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match).replace(/\s+/g, ' ').trim();
}
const folded = (value) => cleanPublicationText(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const list = (value) => value === undefined ? [] : Array.isArray(value) ? value : [value];

export function canonicalPublicationUrl(value) {
  try {
    const url = new URL(cleanPublicationText(value));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    for (const key of [...url.searchParams.keys()]) if (/^(?:utm_|fbclid$|gclid$|mc_)/i.test(key)) url.searchParams.delete(key);
    url.hash = '';
    return url.href;
  } catch { return ''; }
}

/** Publisher-provided category labels outrank words in a title or hostname. */
export function classifyPublicationEntry(source, entry) {
  if (source.sourceType === 'public_domain_api') return ['archive', 'short_story'];
  const categories = list(entry.category).map(folded);
  let path = ''; try { path = new URL(entry.link || entry.guid).pathname; } catch { /* Invalid link rejected later. */ }
  const text = folded(`${entry.title ?? ''} ${path}`);
  const isCategory = (...terms) => categories.some((category) => terms.includes(category));
  const pair = (type) => [type, ({ archive: 'short_story', fiction: 'short_story', flash: 'flash', poetry: 'poem', essay: 'essay', review: 'review', interview: 'interview', audio: 'news', literary_news: 'news' })[type] ?? 'news'];
  if (/\b(?:podcast|audio)\b/.test(text)) return pair('audio');
  if (isCategory('interviews', 'interview', 'entrevista', 'entrevistas')) return pair('interview');
  if (isCategory('book reviews', 'review', 'reviews', 'resenha', 'resenhas', 'resena', 'resenas', 'reviews/essays')) return pair('review');
  if (isCategory('poetry', 'poem', 'poems', 'poesia', 'poemas', 'poesie')) return pair('poetry');
  if (isCategory('flash', 'flash fiction', 'microfiction', 'micro fiction')) return pair('flash');
  if (isCategory('fiction', 'short fiction', 'short stories', 'conto', 'contos', 'ficcao', 'ficcion', 'relato', 'relatos')) return pair('fiction');
  if (isCategory('essay', 'essays', 'nonfiction', 'non-fiction', 'creative nonfiction', 'creative non-fiction', 'memoir', 'beautiful things', 'ensaio', 'ensaios', 'cronica', 'cronicas')) return pair('essay');
  if (/\b(?:interview|conversation|entrevista|conversa|conversacion|conversacoes|dialogo)\b/.test(text)) return pair('interview');
  if (/\b(?:review|reviews|resenha|resena)\b/.test(text)) return pair('review');
  if (/\b(?:poem|poems|poetry|poesia|poemas|translations?)\b/.test(text) || categories.some((c) => /^poesia\b/.test(c))) return pair('poetry');
  if (/\b(?:essay|essays|nonfiction|non-fiction|ensaio|ensayo|cronica)\b/.test(text)) return pair('essay');
  if (/\b(?:flash|microfiction)\b/.test(text)) return pair('flash');
  if (/^(?:fiction|short story|short fiction|conto|cuento)\s*:/.test(text)) return pair('fiction');
  if (/\/(?:fiction|short-fiction|short-stories|stories|story|conto|contos)\//.test(text)) return pair('fiction');
  if (/\b(?:news|announcement|submissions?|contest|prize|noticias?|convocatoria)\b/.test(text)) return pair('literary_news');
  const fallback = pair(source.contentTypes.includes('literary_news') ? 'literary_news' : source.contentTypes[0] ?? 'literary_news');
  return source.contentTypes.length > 1 && !source.contentTypes.includes('literary_news') ? [...fallback, true] : fallback;
}

/** Reads only metadata from a feed body; no prose is returned or persisted. */
export function publicationEntryMetadata(source, entry) {
  const policy = source.feedMetadata ?? {};
  const categories = list(entry.category).map(folded);
  const originalTitle = cleanPublicationText(entry.title);
  if (policy.includeCategories?.length && !categories.some((value) => policy.includeCategories.map(folded).includes(value))) return null;
  if (policy.excludeCategories?.length && categories.some((value) => policy.excludeCategories.map(folded).includes(value))) return null;
  if (policy.originalWritingOnly && /(?:call for submissions|submissions? open|submission to|call for entries|(?:contest|competition|prize).{0,45}(?:announced|deadline|shortlist|submissions)|shortlist announced|launch party|reading event|cover reveal|convocatoria para|concurso de poesia)/i.test(folded(originalTitle))) return null;
  let title = originalTitle;
  let authorDisplay = policy.omitFeedAuthor ? '' : cleanPublicationText(entry.creator || entry.author || '');
  const body = entry.body ?? entry.encoded ?? entry.description ?? '';
  const capture = (pattern, value) => pattern ? cleanPublicationText(String(value).match(new RegExp(pattern, 'i'))?.[1] ?? '') : '';
  title = capture(policy.titleFromBody, body) || capture(policy.titleFromTitle, originalTitle) || title;
  authorDisplay = capture(policy.authorFromTitle, originalTitle) || capture(policy.authorFromBody, body) || authorDisplay;
  const rawUrl = cleanPublicationText(entry.link || entry.guid);
  // Keep existing feed identities stable; new source policies opt into normalized URLs.
  const canonicalUrl = canonicalPublicationUrl(rawUrl) ? (source.feedMetadata ? canonicalPublicationUrl(rawUrl) : rawUrl) : '';
  if (!title || !canonicalUrl || /^(?:protected|private):\s/i.test(title)) return null;
  const [contentType, formTag, inferred] = classifyPublicationEntry(source, { ...entry, title });
  const language = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(entry.language ?? '') ? entry.language : source.defaultLanguage ?? 'en';
  return { title, authorDisplay, canonicalUrl, contentType, formTag, language, qualityFlags: [...(authorDisplay ? [] : ['author_not_supplied']), ...(inferred ? ['needs_editorial_classification'] : [])] };
}
