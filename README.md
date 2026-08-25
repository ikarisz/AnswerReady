# AnswerReady

**Is your website visible to ChatGPT?**

AnswerReady scores a website 0-100 on whether AI answer engines — ChatGPT
Search, Perplexity, Google AI Overviews, Claude — can reach it, read it,
understand it and cite it. Paste a URL, get the score and the exact fixes in
about ten seconds.

Classic SEO optimises for ten blue links, where rank 7 still earns clicks. An
answer engine writes one paragraph and cites two or three sources. There is
no rank 7. You are quoted or you are absent.

## How the score works

100 points across five categories. Every finding is deterministic and
verifiable against the live page — nothing is guessed.

| Category | Points | What it measures |
| --- | --- | --- |
| AI Crawler Access | 30 | Whether `OAI-SearchBot`, `PerplexityBot`, `Google-Extended`, `ClaudeBot` and 7 others are allowed by `robots.txt` |
| Content Extractability | 20 | Words surviving in raw HTML, since AI crawlers largely do not run JavaScript |
| Structured Data | 20 | Valid JSON-LD, meaningful Schema.org types, `sameAs` entity links |
| Answer-Ready Content | 20 | Single H1, section headings, question-shaped content, lists and tables, concise paragraphs |
| Trust & Discoverability | 10 | Title and description, date and author signals, `sitemap.xml`, `llms.txt` |

Access is weighted heaviest because it is binary: a crawler that cannot fetch
the page can never cite it, no matter how good the content is.

Validated against ground truth — `nytimes.com`, which blocks every AI crawler
in its `robots.txt`, scores 0/30 on access.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Cheerio · OpenRouter
with a Groq fallback · deployed on Vercel.

The audit itself needs no API key. The model only writes the plain-language
verdict and the ranked fix list; without a key the full deterministic report
still renders.

Both providers speak the OpenAI chat-completions dialect, so swapping models
is an environment variable, not a code change. OpenRouter is tried first and
Groq stands behind it, which keeps the report intact through a single
provider outage.

## Running locally

```bash
npm install
cp .env.example .env.local   # optional: add an OpenRouter key for the AI verdict
npm run dev
```

## Crawler etiquette

AnswerReady requests one page per scan, identifies itself as
`AnswerReadyBot/1.0`, reads only public URLs, and refuses private and
loopback addresses.
