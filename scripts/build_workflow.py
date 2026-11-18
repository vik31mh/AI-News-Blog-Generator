#!/usr/bin/env python3
"""Generate workflow/ai-news-workflow.json from the source files in code/, prompts/ and templates/."""
import json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
read = lambda p: (root / p).read_text(encoding="utf-8")

DATE_EXPR = "{{ $now.format('LLLL dd, yyyy') }}"
ARTICLES_EXPR = "{{ ($json.text || '').replace(/```html|```/g, '').trim() }}"
html = "\n".join(l.strip() for l in read("templates/email.html").splitlines() if l.strip())
html_expr = "=" + html.replace("{{DATE}}", DATE_EXPR).replace("{{ARTICLES}}", ARTICLES_EXPR)

SERP_Q = "artificial intelligence OR generative AI OR LLM"
def assign(i, name, value, typ="string"):
    return {"id": f"a{i}", "name": name, "value": value, "type": typ}

nodes = [
 {"parameters": {"rule": {"interval": [{"triggerAtHour": 8}]}},
  "name": "Schedule Trigger", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2, "position": [0, 0]},
 {"parameters": {"url": "https://serpapi.com/search.json", "authentication": "genericCredentialType",
                 "genericAuthType": "httpQueryAuth", "sendQuery": True,
                 "queryParameters": {"parameters": [
                    {"name": "engine", "value": "google_news"},
                    {"name": "q", "value": SERP_Q},
                    {"name": "gl", "value": "us"}, {"name": "hl", "value": "en"}]},
                 "options": {}},
  "name": "Google_news search", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [220, 0],
  "credentials": {"httpQueryAuth": {"id": "REPLACE_ME", "name": "SerpAPI (api_key)"}}},
 {"parameters": {"fieldToSplitOut": "news_results", "options": {}},
  "name": "Split Out", "type": "n8n-nodes-base.splitOut", "typeVersion": 1, "position": [440, 0]},
 {"parameters": {"mode": "manual", "assignments": {"assignments": [
    assign(1, "title", "={{ $json.title }}"),
    assign(2, "link", "={{ $json.link }}"),
    assign(3, "source", "={{ $json.source && $json.source.name ? $json.source.name : '' }}"),
    assign(4, "date", "={{ $json.date || '' }}"),
    assign(5, "snippet", "={{ $json.snippet || '' }}")]}, "options": {}},
  "name": "Edit Fields", "type": "n8n-nodes-base.set", "typeVersion": 3.4, "position": [660, 0]},
 {"parameters": {"conditions": {"options": {"caseSensitive": False, "leftValue": "", "typeValidation": "loose"},
    "conditions": [
      {"id": "c1", "leftValue": "={{ $json.title }}", "rightValue": "", "operator": {"type": "string", "operation": "notEmpty", "singleValue": True}},
      {"id": "c2", "leftValue": "={{ $json.link }}", "rightValue": "", "operator": {"type": "string", "operation": "notEmpty", "singleValue": True}}],
    "combinator": "and"}, "options": {}},
  "name": "Filter", "type": "n8n-nodes-base.filter", "typeVersion": 2.2, "position": [0, 260]},
 {"parameters": {"mode": "runOnceForAllItems", "language": "javaScript", "jsCode": read("code/clean-dedupe-select.js")},
  "name": "Code in JavaScript", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [220, 260]},
 {"parameters": {"mode": "runOnceForAllItems", "language": "javaScript", "jsCode": read("code/build-prompt.js")},
  "name": "Code in JavaScript1", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [440, 260]},
 {"parameters": {"promptType": "define", "text": "={{ $json.prompt }}", "hasOutputParser": False,
    "messages": {"messageValues": [{"message": read("prompts/system.md").strip()}]}},
  "name": "Basic LLM Chain", "type": "@n8n/n8n-nodes-langchain.chainLlm", "typeVersion": 1.5, "position": [660, 260]},
 {"parameters": {"model": "llama-3.3-70b-versatile", "options": {"temperature": 0.3}},
  "name": "Groq Chat Model", "type": "@n8n/n8n-nodes-langchain.lmChatGroq", "typeVersion": 1, "position": [680, 460],
  "credentials": {"groqApi": {"id": "REPLACE_ME", "name": "Groq account"}}},
 {"parameters": {"mode": "manual", "assignments": {"assignments": [
    assign(1, "subject", "=AI.NEWS | {{ $now.format('LLLL dd, yyyy') }}"),
    assign(2, "html", html_expr)]}, "options": {}},
  "name": "Edit Fields1", "type": "n8n-nodes-base.set", "typeVersion": 3.4, "position": [880, 260]},
 {"parameters": {"resource": "message", "operation": "send", "sendTo": "YOUR_EMAIL@example.com",
    "subject": "={{ $json.subject }}", "emailType": "html", "message": "={{ $json.html }}",
    "options": {"appendAttribution": False}},
  "name": "Send a message", "type": "n8n-nodes-base.gmail", "typeVersion": 2.1, "position": [1100, 260],
  "credentials": {"gmailOAuth2": {"id": "REPLACE_ME", "name": "Gmail account"}}},
]
conn = {}
for a, b in [("Schedule Trigger","Google_news search"),("Google_news search","Split Out"),("Split Out","Edit Fields"),
             ("Edit Fields","Filter"),("Filter","Code in JavaScript"),("Code in JavaScript","Code in JavaScript1"),
             ("Code in JavaScript1","Basic LLM Chain"),("Basic LLM Chain","Edit Fields1"),("Edit Fields1","Send a message")]:
    conn[a] = {"main": [[{"node": b, "type": "main", "index": 0}]]}
conn["Groq Chat Model"] = {"ai_languageModel": [[{"node": "Basic LLM Chain", "type": "ai_languageModel", "index": 0}]]}

wf = {"name": "AI News Digest (reconstructed)", "nodes": nodes, "connections": conn, "active": False,
      "settings": {"executionOrder": "v1", "timezone": "Asia/Kolkata"}, "tags": []}
out = root / "workflow" / "ai-news-workflow.json"
out.write_text(json.dumps(wf, indent=2, ensure_ascii=False), encoding="utf-8")
print("wrote", out)
