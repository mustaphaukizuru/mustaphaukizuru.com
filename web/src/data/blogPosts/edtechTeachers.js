import { AUTHOR_MUSTAPHA } from "./_author"

export default {
  slug: "edtech-that-actually-helps-teachers",
  title: "EdTech that actually helps teachers (not just admins)",
  excerpt:
    "A practical framework for evaluating learning platforms by the people who use them every period, not the people who buy them.",
  category: "edtech",
  tags: ["Schools", "Productivity"],
  author: AUTHOR_MUSTAPHA,
  publishedAt: "2026-03-12T09:00:00Z",
  readMinutes: 8,
  cover: null,
  featured: false,
  body: [
    { type: "p", text: "There's a quiet disaster behind most school software purchases: the people choosing the tool aren't the people using it. Admins evaluate dashboards, teachers inherit workflows, and three months in everyone is quietly resentful." },
    { type: "p", text: "Here's the five-question framework I run before recommending any new platform to a school." },

    { type: "h2", text: "1. Can a teacher set up a class in under five minutes?" },
    { type: "p", text: "Time-to-first-class is the most predictive metric I know. If onboarding requires a training session, the platform will lose against the platform that doesn't. Demo it on a teacher's actual laptop, in the teacher's actual lounge, with the teacher's actual coffee." },

    { type: "h2", text: "2. Does it work with what teachers already use?" },
    { type: "p", text: "Google Classroom, Microsoft Teams, WhatsApp groups, paper handouts. The platform that fights the existing toolset always loses. The one that integrates with two of the four wins." },

    { type: "h2", text: "3. Is the offline path real?" },
    { type: "p", text: "In Mexico, in Rwanda, in many parts of LATAM and Africa, internet drops at 10 AM and comes back at 11. Offline-first isn't a feature, it's a survival requirement. Watch the platform behave when you switch off wifi mid-lesson." },

    { type: "h2", text: "4. Who owns the data?" },
    { type: "p", text: "Read the data export clause. If you can't get the gradebook out as CSV in three clicks, you don't own the gradebook." },

    { type: "h2", text: "5. What happens when the salesperson leaves?" },
    { type: "p", text: "Most EdTech sales teams churn faster than school administrations. The product you're buying is the docs and the community, not the salesperson." },

    { type: "callout", variant: "info", title: "Red flag shortlist", text: "If the platform requires a separate \"training package\", charges per teacher account, hides the data export behind support tickets, or markets harder than it iterates, keep walking." },
  ],
}
