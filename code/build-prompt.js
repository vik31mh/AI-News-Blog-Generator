// n8n Code node "Code in JavaScript1" — mode: Run Once for All Items
// RECONSTRUCTED (not the original source). Input: 6 article items. Output: ONE item with the LLM prompt.

const articles = $input.all().map(i => i.json);

const block = articles.map(a =>
`ARTICLE ${a.rank}
Title: ${a.title}
Source: ${a.source}
Date: ${a.date}
URL: ${a.link}
Snippet: ${a.snippet || '(none provided)'}`
).join('\n\n');

const prompt =
`Write the newsletter entries for the ${articles.length} articles below.

${block}`;

return [{ json: { prompt, count: articles.length } }];
