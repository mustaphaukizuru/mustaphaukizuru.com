/* ────────────────────────────────────────────────────────────────────────────
 * WhatsAppQualifierDemo — scripted "bot" qualifies an inbound WhatsApp lead
 * (need → budget → timeline) and a CRM card fills in beside the chat.
 * Pure client-side; no network, no LLM. Lazy chunk (see ServiceDemo.jsx).
 * Animations are CSS-only under `motion-safe:` so reduced-motion users get
 * instant updates; the bot "typing" delay is also skipped for them.
 * ──────────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { absorb, nextQuestion, score } from "./qualifier"

const EMPTY = { need: null, budget: null, timeline: null }
const prefersReduced = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

const BTN = "rounded-xl bg-violet px-4 py-2 text-sm font-semibold text-white hover:bg-violet-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-azure disabled:opacity-50"

export default function WhatsAppQualifierDemo() {
  const { t } = useTranslation("services")
  const [lead, setLead] = useState(EMPTY)
  const [msgs, setMsgs] = useState(() => [{ id: 0, from: "bot", text: t("demo.bot.greeting") }])
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const [done, setDone] = useState(false)
  const idRef = useRef(1)
  const timerRef = useRef(null)
  const logRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, typing])

  const push = (from, text) => setMsgs((m) => [...m, { id: idRef.current++, from, text }])

  const send = useCallback((raw) => {
    const text = String(raw || "").trim()
    if (!text || typing || done) return
    setInput("")
    push("user", text)
    const next = absorb(lead, text)
    setLead(next)
    const missing = nextQuestion(next)
    setTyping(true)
    timerRef.current = setTimeout(() => {
      setTyping(false)
      if (missing) {
        push("bot", t(`demo.bot.ask.${missing}`))
      } else {
        push("bot", t(`demo.bot.done.${score(next).status}`))
        setDone(true)
      }
    }, prefersReduced() ? 0 : 700)
  }, [lead, typing, done, t])

  const reset = () => {
    clearTimeout(timerRef.current)
    setLead(EMPTY); setDone(false); setTyping(false); setInput("")
    setMsgs([{ id: idRef.current++, from: "bot", text: t("demo.bot.greeting") }])
  }

  const samplesRaw = t("demo.samples", { returnObjects: true })
  const samples = Array.isArray(samplesRaw) ? samplesRaw : []
  const { score: pts, status } = score(lead)
  const fields = [
    ["need", lead.need && t(`demo.values.need.${lead.need}`)],
    ["budget", lead.budget && t(`demo.values.budget.${lead.budget.tier}`)],
    ["timeline", lead.timeline && t(`demo.values.timeline.${lead.timeline}`)],
  ]

  return (
    <section aria-labelledby="svc-demo-title" className="rounded-2xl border border-violet/15 bg-white p-5 sm:p-7">
      <div className="mb-5">
        <p className="text-micro font-semibold uppercase tracking-[0.16em] text-violet">{t("demo.eyebrow")}</p>
        <h3 id="svc-demo-title" className="mt-1 text-section font-bold text-violet">{t("demo.title")}</h3>
        <p className="mt-1 text-meta text-charcoal-80/70">{t("demo.subtitle")}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* Chat panel */}
        <div className="flex flex-col rounded-2xl border border-charcoal-80/10 bg-mist">
          <div className="flex items-center gap-2 border-b border-charcoal-80/10 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-feedback-success" aria-hidden="true" />
            <span className="text-meta font-semibold text-charcoal-80">{t("demo.chat.header")}</span>
          </div>
          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label={t("demo.chat.logLabel")}
            className="h-64 space-y-2 overflow-y-auto px-4 py-3"
          >
            {msgs.map((msg) => (
              <div key={msg.id} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-meta leading-6 motion-safe:animate-[demo-in_.25s_ease-out] ${msg.from === "user" ? "rounded-br-sm bg-violet text-white" : "rounded-bl-sm bg-white text-charcoal-80 shadow-sm"}`}>
                  <span className="sr-only">{t(msg.from === "user" ? "demo.chat.you" : "demo.chat.bot")}: </span>
                  {msg.text}
                </p>
              </div>
            ))}
            {typing && <p className="text-micro text-charcoal-80/65" aria-hidden="true">{t("demo.chat.typing")}</p>}
          </div>
          <div className="border-t border-charcoal-80/10 p-3">
            {!done && (
              <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label={t("demo.chat.samplesLabel")}>
                {samples.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    disabled={typing}
                    className="rounded-full border border-violet/25 bg-white px-3 py-1 text-left text-micro text-violet hover:bg-violet-pale focus:outline-none focus-visible:ring-2 focus-visible:ring-azure disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input) }}>
              <label htmlFor="svc-demo-input" className="sr-only">{t("demo.chat.inputLabel")}</label>
              <input
                id="svc-demo-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={typing || done}
                placeholder={t("demo.chat.placeholder")}
                maxLength={200}
                autoComplete="off"
                className="min-w-0 flex-1 rounded-xl border border-charcoal-80/15 bg-white px-3 py-2 text-meta text-charcoal-80 focus:border-azure focus:outline-none focus:ring-2 focus:ring-azure-pale disabled:opacity-60"
              />
              {done ? (
                <button type="button" onClick={reset} className={BTN}>{t("demo.chat.reset")}</button>
              ) : (
                <button type="submit" disabled={typing || !input.trim()} className={BTN}>{t("demo.chat.send")}</button>
              )}
            </form>
          </div>
        </div>

        {/* CRM card */}
        <div className="rounded-2xl border border-charcoal-80/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-micro font-semibold uppercase tracking-[0.16em] text-charcoal-80/65">{t("demo.crm.title")}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-micro font-semibold ${done ? "bg-feedback-success-bg text-feedback-success-text" : "bg-violet-pale text-violet"}`}>
              {t(done ? `demo.crm.status.${status}` : "demo.crm.status.open")}
            </span>
          </div>
          <dl className="mt-4 space-y-3">
            {fields.map(([key, val]) => (
              <div key={key} className="flex items-start justify-between gap-3 border-b border-charcoal-80/10 pb-2.5">
                <dt className="text-meta text-charcoal-80/65">{t(`demo.crm.fields.${key}`)}</dt>
                <dd className="text-right text-meta font-semibold text-charcoal-80">
                  {val
                    ? <span className="inline-block motion-safe:animate-[demo-in_.35s_ease-out]">{val}</span>
                    : <span role="img" className="text-charcoal-80/30" aria-label={t("demo.crm.empty")}>—</span>}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <div className="flex justify-between text-micro text-charcoal-80/65">
              <span>{t("demo.crm.fields.score")}</span>
              <span className="font-semibold text-charcoal-80">{pts}/100</span>
            </div>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-charcoal-80/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pts}
              aria-label={t("demo.crm.fields.score")}
            >
              <div className="h-full rounded-full bg-gradient-to-r from-violet to-azure motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${pts}%` }} />
            </div>
          </div>
          <p className="mt-4 text-micro text-charcoal-80/65">{t("demo.crm.note")}</p>
        </div>
      </div>
      <style>{"@keyframes demo-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}"}</style>
    </section>
  )
}
