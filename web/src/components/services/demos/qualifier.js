/* Deterministic, client-only lead qualifier used by the WhatsApp demo.
 * Extracts need / budget / timeline from free text via keyword rules. */

const NEED_RULES = [
  ["whatsappBot", /whatsapp|chatbot|bot\b|chat/i],
  ["invoicing", /factur|invoice|cobro|billing/i],
  ["crmSync", /crm|lead|hubspot|pipedrive|clientes/i],
  ["emailFlows", /email|correo|newsletter|mail/i],
  ["reporting", /report|informe|dashboard|excel|sheet/i],
]

export function detectNeed(text) {
  const hit = NEED_RULES.find(([, re]) => re.test(text))
  return hit ? hit[0] : null
}

/** Returns { tier, amount } or null. Tiers: none, low (<1k), mid (1k-5k), high (>5k). */
export function detectBudget(text) {
  if (/sin presupuesto|no budget|no tengo presupuesto/i.test(text)) return { tier: "none", amount: 0 }
  const m = text.replace(/[.,](?=\d{3}\b)/g, "").match(/(\d+(?:[.,]\d+)?)\s*(k|mil)?/i)
  if (!m) return null
  let amount = parseFloat(m[1].replace(",", "."))
  if (m[2]) amount *= 1000
  if (amount < 50) return null // "3 semanas" etc. is not money
  const tier = amount < 1000 ? "low" : amount <= 5000 ? "mid" : "high"
  return { tier, amount }
}

export function detectTimeline(text) {
  if (/urgent|urgente|asap|\bya\b|inmediat|esta semana|this week|cuanto antes/i.test(text)) return "now"
  if (/semana|week|\bmes\b|meses|month|pronto|soon|trimestre|quarter/i.test(text)) return "soon"
  if (/a[nñ]o|year|explor|alg[uú]n d[ií]a|someday|idea|no s[eé]|not sure|later|m[aá]s adelante/i.test(text)) return "later"
  return null
}

/** Merge a user message into the lead; returns the next lead state. */
export function absorb(lead, text) {
  return {
    need: lead.need || detectNeed(text),
    budget: lead.budget || detectBudget(text),
    timeline: lead.timeline || detectTimeline(text),
  }
}

/** First missing field in qualification order, or null when complete. */
export function nextQuestion(lead) {
  if (!lead.need) return "need"
  if (!lead.budget) return "budget"
  if (!lead.timeline) return "timeline"
  return null
}

/** 0-100 score + status: hot / warm / nurture. */
export function score(lead) {
  let s = 0
  if (lead.need) s += 30
  if (lead.budget) s += { none: 0, low: 15, mid: 30, high: 40 }[lead.budget.tier] || 0
  if (lead.timeline) s += { now: 30, soon: 20, later: 5 }[lead.timeline] || 0
  const status = s >= 70 ? "hot" : s >= 45 ? "warm" : "nurture"
  return { score: s, status }
}
