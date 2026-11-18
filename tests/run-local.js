// Runs both Code-node scripts locally against sample data (no n8n needed):  node tests/run-local.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const load = f => fs.readFileSync(path.join(__dirname, '..', 'code', f), 'utf8');
const run = (code, items) => new Function('$input', code)({ all: () => items.map(json => ({ json })) });

const sample = require('./sample-articles.json');
const selected = run(load('clean-dedupe-select.js'), sample);
console.log(`in: ${sample.length}  out: ${selected.length}`);
selected.forEach(s => console.log(`#${s.json.rank} ${s.json.title} | ${s.json.source} | ${s.json.date}\n   ${s.json.link}`));

const prompt = run(load('build-prompt.js'), selected.map(s => s.json));
console.log('\n--- prompt preview ---\n' + prompt[0].json.prompt.slice(0, 300) + '...');

assert(selected.length <= 6, 'max six');
assert(new Set(selected.map(s => s.json.link)).size === selected.length, 'no duplicate links');
assert(selected.every(s => /^https?:\/\//.test(s.json.link)), 'links preserved');
console.log('\nAll checks passed');
