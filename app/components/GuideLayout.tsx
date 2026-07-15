import Link from "next/link";

type Section = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

type Faq = { question: string; answer: string };

type GuideLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  canonicalPath: string;
  sections: Section[];
  faq?: Faq[];
  updatedLabel?: string;
};

const siteUrl = "https://co2table.haorio.com";

export function GuideLayout({
  eyebrow,
  title,
  description,
  canonicalPath,
  sections,
  faq,
  updatedLabel = "2026년 7월 15일",
}: GuideLayoutProps) {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    inLanguage: "ko-KR",
    mainEntityOfPage: `${siteUrl}${canonicalPath}`,
    dateModified: "2026-07-15",
    publisher: { "@type": "Organization", name: "BREATHLINE" },
  };

  const faqSchema = faq
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }
    : null;

  return (
    <main className="resource-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <header className="resource-header">
        <Link className="brand" href="/" aria-label="BREATHLINE 홈">
          <span className="brand-mark">B</span>
          <span>
            <strong>BREATHLINE</strong>
            <small>CO₂ TABLE</small>
          </span>
        </Link>
        <nav className="resource-nav" aria-label="주요 메뉴">
          <Link href="/">훈련 시작</Link>
          <Link href="/co2-table">CO₂ 테이블 안내</Link>
          <Link href="/freediving-safety">안전 수칙</Link>
        </nav>
      </header>

      <article className="article-shell">
        <div className="article-hero">
          <p className="kicker">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <span>업데이트 · {updatedLabel}</span>
        </div>

        <div className="article-content">
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets && (
                <ul>
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              )}
            </section>
          ))}

          {faq && (
            <section className="article-faq" aria-labelledby="faq-title">
              <h2 id="faq-title">자주 묻는 질문</h2>
              {faq.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </section>
          )}

          <aside className="article-cta">
            <div>
              <span>DRY ONLY</span>
              <strong>안전한 장소에서, 짧게 시작하세요.</strong>
              <p>CO₂ 테이블은 물 밖에서만 사용하세요. 불편하거나 이상 신호가 느껴지면 언제든 종료할 수 있습니다.</p>
            </div>
            <Link href="/">CO₂ 테이블 훈련 시작</Link>
          </aside>
        </div>
      </article>

      <footer className="resource-footer">
        <div className="footer-brand"><span className="brand-mark">B</span><strong>BREATHLINE</strong></div>
        <nav aria-label="하단 메뉴">
          <Link href="/co2-table-beginner">초보자 안내</Link>
          <Link href="/freediving-safety">안전 수칙</Link>
          <Link href="/privacy">개인정보 처리방침</Link>
        </nav>
      </footer>
    </main>
  );
}
