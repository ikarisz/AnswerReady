import type { Metadata } from "next";
import "./globals.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://answerready.io";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "AnswerReady — Is your website visible to ChatGPT and Perplexity?",
  description:
    "Free audit that scores how ready your website is to be found, read and cited by AI search engines like ChatGPT, Perplexity and Google AI Overviews. Results in 10 seconds.",
  keywords: [
    "AI search optimization",
    "answer engine optimization",
    "AEO audit",
    "ChatGPT visibility",
    "Perplexity SEO",
    "llms.txt",
  ],
  openGraph: {
    title: "Is your website visible to ChatGPT?",
    description:
      "Free 10-second audit of your site's AI search readiness. Score out of 100 plus the exact fixes.",
    url: SITE,
    siteName: "AnswerReady",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: SITE },
};

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#org`,
      name: "AnswerReady",
      url: SITE,
      description:
        "AnswerReady audits websites for AI search readiness and reports the fixes needed to be cited by ChatGPT, Perplexity and Google AI Overviews.",
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#site`,
      url: SITE,
      name: "AnswerReady",
      publisher: { "@id": `${SITE}/#org` },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "What is AI search readiness?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "AI search readiness measures whether AI answer engines can reach your pages, extract the text, understand what your business is, and quote you. It is decided by robots.txt access for AI crawlers, server-rendered content, Schema.org markup, and answer-shaped writing.",
          },
        },
        {
          "@type": "Question",
          name: "How is this different from SEO?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Classic SEO optimises for a ranked list of links. AI search returns one synthesised answer that cites a handful of sources. Winning means being the source a model quotes, which depends on crawler access and machine-readable structure more than on backlinks.",
          },
        },
        {
          "@type": "Question",
          name: "Is the audit free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. The scan of your homepage, the score out of 100 and the priority fixes are free with no account. Paid plans add full-site audits, competitor comparison and weekly tracking.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
        {children}
      </body>
    </html>
  );
}
