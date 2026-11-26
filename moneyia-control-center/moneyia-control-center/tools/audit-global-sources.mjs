import fs from 'node:fs';
import { canonicalUrl } from '../app/radar.mjs';

const file = new URL('../data/global-sources.json', import.meta.url);
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
const ids = new Set();
const urls = new Set();
const kinds = new Set();
const currencies = new Set();
for (const [index, row] of rows.entries()) {
  for (const field of ['id', 'name', 'url', 'kind', 'regions', 'languages', 'currencies', 'discovery', 'cost']) {
    if (row[field] === undefined || row[field] === null || row[field] === '') errors.push(`${index + 1}: campo ausente ${field}`);
  }
  if (ids.has(row.id)) errors.push(`${row.id}: id duplicado`);
  ids.add(row.id);
  const url = canonicalUrl(row.url);
  if (!/^https:\/\//.test(url)) errors.push(`${row.id}: URL não HTTPS`);
  if (urls.has(url)) errors.push(`${row.id}: URL duplicada ${url}`);
  urls.add(url);
  kinds.add(row.kind);
  for (const currency of row.currencies || []) currencies.add(currency);
}
const report = {
  generatedAt: new Date().toISOString(),
  sourceCount: rows.length,
  uniqueIds: ids.size,
  uniqueCanonicalUrls: urls.size,
  kinds: [...kinds].sort(),
  currencies: [...currencies].sort(),
  minimumMet: rows.length >= 100 && errors.length === 0,
  status: 'catalog_only',
  errors
};
console.log(JSON.stringify(report, null, 2));
if (!report.minimumMet) process.exitCode = 1;
