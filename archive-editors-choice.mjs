import { readFile, writeFile } from 'node:fs/promises';

// Keep each published edition before the weekly file is replaced again.
const current = JSON.parse(await readFile(new URL('./site/v1/editors-choice.json', import.meta.url), 'utf8'));
const archivePath = new URL('./site/v1/editors-choice-history.json', import.meta.url);
let history = { schemaVersion: 1, editions: [] };
try { history = JSON.parse(await readFile(archivePath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (history.schemaVersion !== 1 || !Array.isArray(history.editions)) throw new Error('Invalid editorial history');
if (!/^\d{4}-\d{2}-\d{2}$/.test(current.editionId) || current.items?.length !== 10) throw new Error('Incomplete editorial edition');
const editions = new Map(history.editions.map((edition) => [edition.editionId, edition]));
editions.set(current.editionId, current);
await writeFile(archivePath, JSON.stringify({ schemaVersion: 1, editions: [...editions.values()].sort((a, b) => b.editionId.localeCompare(a.editionId)) }, null, 2) + '\n');
