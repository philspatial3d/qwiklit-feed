import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalPublicationUrl, publicationEntryMetadata } from '../publication-metadata.mjs';

const source = { contentTypes: ['fiction', 'poetry', 'essay'], defaultLanguage: 'en' };
test('genre classification uses publisher categories and paths without hostname false positives', () => {
  const metadata = publicationEntryMetadata(source, { title: 'A New Work', link: 'https://poetry-review.example.org/a-work', category: ['Fiction'], author: 'A Writer' });
  assert.equal(metadata.contentType, 'fiction');
  const unknown = publicationEntryMetadata(source, { title: 'An Untyped Work', link: 'https://poetry-review.example.org/new-work' });
  assert.ok(unknown.qualityFlags.includes('needs_editorial_classification'));
});
test('Spanish and Portuguese poetry preserve language and diacritics', () => {
  for (const [language, category, title] of [['es', 'Poesía', 'Poesía de Lucía'], ['pt', 'Poesia', 'Três poemas']]) {
    const value = publicationEntryMetadata({ ...source, defaultLanguage: language }, { title, category, link: 'https://example.org/work' });
    assert.equal(value.language, language); assert.equal(value.contentType, 'poetry'); assert.equal(value.title, title);
  }
  assert.equal(publicationEntryMetadata(source, { title: 'Poem', category: 'Poetry', language: 'pt-BR', link: 'https://example.org/work' }).language, 'pt-BR');
});
test('publisher-specific bylines and work titles replace CMS names and issue labels without returning bodies', () => {
  const metadata = publicationEntryMetadata({ ...source, feedMetadata: { titleFromBody: '<h3>([\\s\\S]*?)</h3>', omitFeedAuthor: true, authorFromTitle: '^[^|]+\\|\\s*(.+)$' } }, { title: 'Fiction Issue 20 | A Writer', author: 'CMS Administrator', link: 'https://example.org/work', body: '<h3>A Named Story</h3><p>Private test prose.</p>' });
  assert.equal(metadata.title, 'A Named Story'); assert.equal(metadata.authorDisplay, 'A Writer');
  for (const field of ['body', 'fullText', 'sourceExcerpt', 'thumbnailUrl']) assert.equal(field in metadata, false);
});
test('creative-work filtering rejects calls and directory entries while allowing a story called The Prize', () => {
  const configured = { ...source, feedMetadata: { originalWritingOnly: true, includeCategories: ['Fiction', 'Poetry'] } };
  assert.equal(publicationEntryMetadata(configured, { title: 'Call for Submissions: Water', category: 'Fiction', link: 'https://example.org/call' }), null);
  assert.equal(publicationEntryMetadata(configured, { title: 'A Contributor', category: 'Contributor', link: 'https://example.org/person' }), null);
  assert.equal(publicationEntryMetadata(configured, { title: 'The Prize', category: 'Fiction', link: 'https://example.org/story' }).title, 'The Prize');
});
test('canonical links remove ordinary and percent-encoded tracking while preserving publisher paths', () => {
  assert.equal(canonicalPublicationUrl('https://example.org/story/?utm_source=rss&#038;utm_medium=feed'), 'https://example.org/story/');
  assert.equal(canonicalPublicationUrl('https://example.org/story?utm_source%3Drss-feed%26utm_medium%3Drss'), 'https://example.org/story');
  assert.equal(canonicalPublicationUrl('javascript:alert(1)'), '');
});

test('existing publication URLs retain their legacy feed identity until explicitly migrated', () => {
  const link = 'https://example.org/story/?utm_source=rss';
  assert.equal(publicationEntryMetadata(source, { title: 'A Story', link }).canonicalUrl, link);
  assert.equal(publicationEntryMetadata({ ...source, feedMetadata: {} }, { title: 'A Story', link }).canonicalUrl, 'https://example.org/story/');
});

test('an empty Atom-style author field does not hide a supplied RSS creator', () => {
  assert.equal(publicationEntryMetadata(source, { title: 'A Story', link: 'https://example.org/story', author: '', creator: 'Actual Writer' }).authorDisplay, 'Actual Writer');
});
