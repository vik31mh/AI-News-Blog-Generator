// n8n Code node "Code in JavaScript" — mode: Run Once for All Items
// RECONSTRUCTED (not the original source). Input: ~99 articles {title, link, source, date, snippet}.
// Output: top 6 cleaned, de-duplicated, AI-relevant articles.

const TOP_N = 6;

const AI_TERMS = /\b(ai|a\.i\.|artificial intelligence|machine learning|deep learning|neural|llm|large language model|generative|genai|chatbot|gpt|chatgpt|openai|anthropic|claude|gemini|deepmind|mistral|llama|groq|nvidia|copilot|agentic|agents?|robotics|foundation model|diffusion|transformer)\b/i;
const BLOCK_TITLE = /\b(horoscope|coupon|promo code|black friday|giveaway|casino|betting odds|sponsored)\b/i;
const BLOCK_SOURCES = /(pinterest|facebook|instagram|tiktok|youtube)/i;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const cleanTitle = (t = '', source = '') => {
  let s = String(t).replace(/\s+/g, ' ').trim();
  // Google News often appends " - Source Name"
  if (source) {
    const tail = ' - ' + source;
    if (s.toLowerCase().endsWith(tail.toLowerCase())) s = s.slice(0, -tail.length).trim();
  }
  return s;
};

const canonicalUrl = (u = '') => {
  try {
    const url = new URL(u);
    url.hash = '';
    [...url.searchParams.keys()].forEach(k => {
      if (/^(utm_|fbclid|gclid|ref|cmpid|mc_)/i.test(k)) url.searchParams.delete(k);
    });
    return (url.hostname.replace(/^www\./, '') + url.pathname.replace(/\/+$/, '') + url.search).toLowerCase();
  } catch (e) { return String(u).toLowerCase(); }
};

const tokens = (t) => new Set(
  t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
);
const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let inter = 0; a.forEach(x => { if (b.has(x)) inter++; });
  return inter / (a.size + b.size - inter);
};

// SerpAPI dates look like "05/13/2026, 07:00 AM, +0000 UTC"; fall back to relative strings ("3 hours ago")
const parseDate = (raw) => {
  if (!raw) return null;
  const m = String(raw).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));
  const rel = String(raw).match(/(\d+)\s*(minute|hour|day|week|month)s?\s+ago/i);
  if (rel) {
    const unit = { minute: 60e3, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6 }[rel[2].toLowerCase()];
    return new Date(Date.now() - (+rel[1]) * unit);
  }
  const d = new Date(raw);
  return isNaN(d) ? null : d;
};
const fmtDate = (d) => d ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}` : '';

const seenUrls = new Set();
const kept = [];

for (const item of $input.all()) {
  const j = item.json;
  const source = (j.source || '').toString().trim();
  const title = cleanTitle(j.title, source);
  const link = (j.link || '').toString().trim();
  const snippet = (j.snippet || '').toString().replace(/\s+/g, ' ').trim();

  // 1. validity
  if (!title || !/^https?:\/\//i.test(link)) continue;
  // 2. relevance / noise
  if (BLOCK_TITLE.test(title) || BLOCK_SOURCES.test(source)) continue;
  const haystack = `${title} ${snippet}`;
  if (!AI_TERMS.test(haystack)) continue;
  // 3. exact URL duplicate
  const key = canonicalUrl(link);
  if (seenUrls.has(key)) continue;
  seenUrls.add(key);

  const date = parseDate(j.date);
  const score = (haystack.match(new RegExp(AI_TERMS.source, 'gi')) || []).length;
  kept.push({ title, link, source: source || 'Unknown source', snippet, date, score, tok: tokens(title) });
}

// 4. near-duplicate titles (same story, different outlet): keep the first / higher-scored
kept.sort((a, b) => b.score - a.score);
const unique = [];
for (const a of kept) {
  if (!unique.some(b => jaccard(a.tok, b.tok) >= 0.7)) unique.push(a);
}

// 5. newest first, tie-break on relevance score; take top N
unique.sort((a, b) => ((b.date?.getTime() || 0) - (a.date?.getTime() || 0)) || (b.score - a.score));

return unique.slice(0, TOP_N).map((a, i) => ({
  json: {
    rank: i + 1,
    title: a.title,
    link: a.link,
    source: a.source,
    date: fmtDate(a.date),
    snippet: a.snippet,
  },
}));
