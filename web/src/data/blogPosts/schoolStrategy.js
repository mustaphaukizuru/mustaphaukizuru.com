import { AUTHOR_MUSTAPHA } from "./_author"

export default {
  slug: "designing-an-it-strategy-for-a-school-in-mexico",
  title: "Designing an IT strategy for a Mexican school in 90 days",
  excerpt:
    "What changed when Colegio de Excelencia Raindrop went from ad-hoc IT to a documented strategy with measurable outcomes.",
  category: "it-strategy",
  tags: ["Schools", "Mexico", "Productivity"],
  author: AUTHOR_MUSTAPHA,
  publishedAt: "2026-04-08T09:00:00Z",
  readMinutes: 7,
  cover: null,
  featured: false,
  body: [
    { type: "p", text: "Most school IT is reactive. A projector dies, a teacher needs a password reset, the wifi drops during exams, the day is the to-do list. Building a real strategy means stepping out of the queue long enough to draw the queue, and that's harder than it sounds when you're the only IT manager on campus." },
    { type: "p", text: "Here's the 90-day framework I used to take Colegio de Excelencia Raindrop from ad-hoc support to a documented strategy with measurable outcomes." },

    { type: "h2", text: "Days 0–30 · Map the reality" },
    { type: "p", text: "Before changing anything, document what already exists, every device, license, vendor contract, network segment, and recurring cost. One row per asset, one column for *who depends on it*. The dependency column is the artefact that turns IT from a cost centre into a service catalogue." },

    { type: "h2", text: "Days 31–60 · Pick three outcomes" },
    { type: "p", text: "Strategy without outcomes is a wishlist. I forced myself to pick exactly three, all measurable:" },
    { type: "ordered", items: [
      "**Reduce ticket volume by 40%** through a self-service portal and clearer documentation.",
      "**Cut printing costs by 30%** through duplex defaults and quota enforcement.",
      "**Bring 100% of staff onto SSO** within the term, retiring shared logins.",
    ] },

    { type: "h2", text: "Days 61–90 · Ship one thing per week" },
    { type: "p", text: "The temptation is a 12-month transformation plan. What actually moves the needle is shipping one improvement per week, in public. A Friday \"This week we…\" email to staff changed how IT was perceived more than any roadmap document." },
    { type: "callout", variant: "success", title: "What changed", text: "Inside the first quarter, ticket volume dropped 38%, printing costs fell 26%, and 92% of staff were on SSO. Not the targets, close enough to ship the next term confidently." },

    { type: "h2", text: "What I'd tell other school IT leads" },
    { type: "list", items: [
      "Strategy is a one-page document the principal can read over coffee. Longer than that and it's a plan, not a strategy.",
      "Pick outcomes that survive the school-year boundary. \"Improve wifi\" doesn't. \"95th-percentile speed > 50 Mbps in every classroom\" does.",
      "The vendor list is your strategy in disguise. If half your stack is on month-to-month consumer plans, you don't have a strategy.",
    ] },
  ],
}
