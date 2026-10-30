import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverEastOfWeb, eastOfWebLinks, mergeHistoricalItems, verifyStoryPage } from '../historical-core.mjs';

test('discovery takes title and author from the story rather than site navigation', () => {
  const html = '<h2>Other Author</h2><h1>A New Story</h1><article class="node node--type-author"><span class="field--name-title">A. Writer</span></article>';
  const item = discoverEastOfWeb(html, '2026-10-30T12:00:00Z');
  assert.equal(item.title, 'A New Story'); assert.equal(item.author, 'A. Writer');
  assert.equal(item.rightsMode, 'metadata_only'); assert.equal(item.originalYear, undefined);
  assert.throws(() => discoverEastOfWeb('<h1>Fiction</h1>', '2026-10-30'));
  assert.deepEqual(eastOfWebLinks('<a href="/author/someone">A</a><a href="/short-stories/UBooks/Valid.shtml">S</a><a href="https://unrelated.test">X</a>'), ['https://www.eastoftheweb.com/short-stories/UBooks/Valid.shtml']);
});

test('a successful HTTP page must still have the right title, attribution and story anchor', () => {
  const item = { title: 'A Story', author: 'A. Writer', url: 'https://example.org/story' };
  assert.throws(() => verifyStoryPage(item, '<title>Not found</title> A Story Writer'));
  assert.throws(() => verifyStoryPage(item, '<title>A Story</title>'));
  assert.doesNotThrow(() => verifyStoryPage(item, '<h1>A Story</h1> Writer'));
  assert.throws(() => verifyStoryPage({ ...item, url: item.url + '#chapter' }, '<h1>A Story</h1> Writer'));
  assert.doesNotThrow(() => verifyStoryPage({ ...item, url: item.url + '#chapter' }, '<a name="chapter"></a><h3>A Story</h3> Writer'));
});

test('canonical editions win over rediscovered duplicates and old verified metadata remains available', () => {
  const old = { id: 'one', title: 'A Story', author: 'A. Writer', url: 'https://example.org/one' };
  const duplicate = { ...old, id: 'two', url: 'https://elsewhere.org/two', title: 'A STORY' };
  assert.deepEqual(mergeHistoricalItems([old], [duplicate]), [old]);
});
