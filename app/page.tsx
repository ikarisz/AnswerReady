import Scanner from "@/components/Scanner";

const CONTACT =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@answerready.io";

const CHECKS = [
  {
    t: "AI crawler access",
    d: "Whether OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended and seven others are allowed by your robots.txt. One stray Disallow line makes you invisible to an entire engine.",
  },
  {
    t: "Content extractability",
    d: "AI crawlers do not run JavaScript. We read your page the way they do and count what actually survives.",
  },
  {
    t: "Structured data",
    d: "Organization, FAQPage, Product and sameAs markup. This is how a model knows you are a company and not a string of words.",
  },
  {
    t: "Answer-ready writing",
    d: "Question-shaped headings, self-contained paragraphs, lists and tables. Models quote chunks, not chapters.",
  },
  {
    t: "Trust and freshness",
    d: "Dates, named authors, sitemap and llms.txt. Between two equal pages, the model cites the one it can date and attribute.",
  },
];

const FAQ = [
  {
    q: "What is AI search readiness?",
    a: "It measures whether AI answer engines can reach your pages, extract the text, understand what your business is, and quote you. It is decided by robots.txt access for AI crawlers, server-rendered content, Schema.org markup, and answer-shaped writing.",
  },
  {
    q: "How is this different from SEO?",
    a: "Classic SEO optimises for a ranked list of links. AI search returns one synthesised answer citing a handful of sources. Winning means being the source a model quotes, which depends on crawler access and machine-readable structure far more than on backlinks.",
  },
  {
    q: "Do you query ChatGPT to see if it mentions my brand?",
    a: "Not on the free scan. The free audit measures readiness, which is deterministic and verifiable: we fetch your robots.txt, your HTML and your markup, and report exactly what we found. Live answer tracking across ChatGPT and Perplexity is part of the paid plan.",
  },
  {
    q: "Is the audit free?",
    a: "Yes. The homepage scan, the score out of 100 and the priority fixes are free with no account.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
      <header className="mb-12">
        <p className="font-mono text-sm tracking-widest text-brand">
          ANSWERREADY
        </p>
        <h1 className="mt-5 text-4xl font-semibold leading-[1.1] sm:text-5xl">
          Your customers stopped Googling.
          <br />
          Can ChatGPT still find you?
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-mute">
          AI answer engines cite a handful of sources per question. Most
          websites are quietly disqualified before the writing is even
          considered. Scan yours and see where you stand, in about ten seconds.
        </p>
      </header>

      <Scanner />

      <section className="mt-24">
        <h2 className="text-2xl font-semibold">What the scan checks</h2>
        <p className="mt-2 text-mute">
          Five categories, one hundred points. Every finding comes from your
          live page, not from a guess.
        </p>
        <ul className="mt-7 space-y-6">
          {CHECKS.map((c) => (
            <li key={c.t} className="border-l-2 border-line pl-5">
              <h3 className="font-semibold">{c.t}</h3>
              <p className="mt-1 leading-relaxed text-mute">{c.d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="pricing" className="mt-24 scroll-mt-8">
        <h2 className="text-2xl font-semibold">Pricing</h2>
        <div className="mt-7 space-y-4">
          <div className="rounded-xl border border-line bg-panel p-6">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">Free scan</h3>
              <span className="font-mono text-lg">$0</span>
            </div>
            <p className="mt-2 text-mute">
              One page. Score, crawler report, priority fixes. No account.
            </p>
          </div>

          <div className="rounded-xl border border-brand/40 bg-brand/[0.04] p-6">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">Full site report</h3>
              <span className="font-mono text-lg">$29 once</span>
            </div>
            <ul className="mt-3 space-y-1.5 text-mute">
              <li>Up to 50 pages audited, ranked worst first</li>
              <li>Side by side against two competitors</li>
              <li>Copy-paste fix list for your developer</li>
              <li>Ready-to-ship robots.txt, schema and llms.txt files</li>
            </ul>
            <a
              href={`mailto:${CONTACT}?subject=Full%20site%20report&body=My%20website%3A%20`}
              className="mt-5 inline-block rounded-lg bg-brand px-5 py-2.5 font-semibold text-ink transition hover:opacity-90"
            >
              Request the full report
            </a>
            <p className="mt-2.5 text-sm text-mute">
              Delivered within 48 hours. Not fixable? You do not pay.
            </p>
          </div>

          <div className="rounded-xl border border-line bg-panel p-6">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">Tracking</h3>
              <span className="font-mono text-lg">$29 / month</span>
            </div>
            <p className="mt-2 text-mute">
              Weekly re-scan of your whole site, an alert the moment a deploy
              blocks a crawler or your score drops, and monthly competitor
              movement.
            </p>
            <a
              href={`mailto:${CONTACT}?subject=Tracking%20waitlist&body=My%20website%3A%20`}
              className="mt-5 inline-block rounded-lg border border-line px-5 py-2.5 font-semibold transition hover:border-brand"
            >
              Join the waitlist
            </a>
          </div>
        </div>
      </section>

      <section className="mt-24">
        <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
        <div className="mt-7 space-y-6">
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold">{f.q}</h3>
              <p className="mt-1.5 leading-relaxed text-mute">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-24 border-t border-line pt-8 text-sm text-mute">
        <p>
          AnswerReady reads only public pages, at one request per scan, and
          identifies itself as AnswerReadyBot.
        </p>
        <p className="mt-2">
          Questions:{" "}
          <a href={`mailto:${CONTACT}`} className="text-brand">
            {CONTACT}
          </a>
        </p>
      </footer>
    </main>
  );
}
