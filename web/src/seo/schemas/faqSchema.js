/**
 * FAQPage — schema.org/FAQPage
 *
 *   faqSchema([
 *     { question: "Do you work internationally?", answer: "Yes — Mexico, US, Europe..." },
 *     ...
 *   ])
 */
export function faqSchema(items = []) {
  if (!Array.isArray(items) || items.length === 0) return null
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items
      .filter((it) => it && it.question && it.answer)
      .map((it) => ({
        "@type": "Question",
        name: it.question,
        acceptedAnswer: { "@type": "Answer", text: it.answer },
      })),
  }
}
