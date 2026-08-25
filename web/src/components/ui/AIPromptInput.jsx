// ════════════════════════════════════════════════════════════════════════════
// AIPromptInput · ui composite · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Modern AI / chat composer (2026 trend). Shape:
//
//   ┌────────────────────────────────────────────────────────────┐
//   │ [model selector ▾]   [attach]    [voice]                   │
//   │ ┌────────────────────────────────────────────────────────┐ │
//   │ │ Type or paste your prompt…                              │ │  (autogrow textarea)
//   │ │                                                          │ │
//   │ └────────────────────────────────────────────────────────┘ │
//   │ [hint chips]                                  [↑ Send]     │
//   └────────────────────────────────────────────────────────────┘
//
// Pure presentational — receives:
//   value, onChange, onSubmit (submitting=true disables Send / shows pulse),
//   models[]?, model?, onModelChange, suggestions[]?, onSuggestion,
//   placeholder?, busy?, maxLength?
//
// Behaviours:
//   · Cmd/Ctrl+Enter submits; Shift+Enter newline; Enter alone submits when
//     `submitOnEnter` is true (default false — multi-line first).
//   · Autogrows up to ~14 rows then scrolls.
//   · Subtle violet glow when focused (matches form-system focus ring).
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useId, useRef, useState } from "react"
import { ArrowUp, Paperclip, Mic, Sparkles, ChevronDown, Square } from "lucide-react"
import { m } from "framer-motion"

import { useTranslation } from "react-i18next"
/**
 * AIPromptInput · presentational AI composer.
 *
 * Props:
 *   value, onChange, onSubmit                        · core (controlled)
 *   busy?                                            · boolean — show "Stop"
 *   onStop?                                          · () => void
 *   placeholder?                                     · string
 *   models?                                          · [{ value, label, hint? }]
 *   model?, onModelChange?                           · selected model
 *   suggestions?                                     · [string] — chip prompts
 *   onSuggestion?                                    · (text) => void
 *   onAttach?                                        · () => void — clip icon
 *   onVoice?                                         · () => void — mic icon
 *   submitOnEnter?                                   · default false
 *   maxLength?                                       · counter when set
 *   className?
 */
export default function AIPromptInput({
  value,
  onChange,
  onSubmit,
  busy = false,
  onStop,
  placeholder = "Ask anything, Cmd/Ctrl+Enter to send",
  models,
  model,
  onModelChange,
  suggestions = [],
  onSuggestion,
  onAttach,
  onVoice,
  submitOnEnter = false,
  maxLength,
  className = "",
}) {
  const { t } = useTranslation("common")
  const reactId = useId()
  const taId = `ai-prompt-${reactId}`
  const ref = useRef(null)
  const [focused, setFocused] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)

  // Autogrow
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    const max = 280 // ~14 rows of 20px
    el.style.height = `${Math.min(el.scrollHeight, max)}px`
  }, [value])

  const canSubmit = !busy && typeof value === "string" && value.trim().length > 0

  const submit = () => {
    if (!canSubmit) return
    onSubmit?.(value)
  }

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      submit()
    } else if (submitOnEnter && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const currentModel = models?.find((m) => m.value === model)

  return (
    <div
      className={[
        "relative w-full rounded-[18px] border bg-[var(--color-surface-card)]",
        "transition-[border-color,box-shadow,background-color] duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
        focused
          ? "border-[var(--color-action-primary)] shadow-[0_0_0_4px_rgb(var(--color-violet-rgb)/0.10),0_8px_24px_rgb(var(--color-violet-rgb)/0.06)]"
          : "border-[var(--color-border-subtle)] shadow-[var(--shadow-rest)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Top row · model selector + utility icons */}
      <div className="flex items-center gap-2 px-3 pt-2.5">
        {models?.length ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setModelOpen((o) => !o)}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-violet)] hover:border-[var(--color-border-violet)] transition-colors"
              aria-haspopup="listbox"
              aria-expanded={modelOpen}
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {currentModel?.label || model || "Default"}
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </button>
            {modelOpen && (
              <ul
                role="listbox"
                className="absolute left-0 top-[calc(100%+6px)] z-30 min-w-[220px] overflow-hidden rounded-[12px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] shadow-[var(--shadow-overlay)]"
              >
                {models.map((m) => {
                  const active = m.value === model
                  return (
                    <li key={m.value} role="option" aria-selected={active}>
                      <button
                        type="button"
                        onClick={() => {
                          onModelChange?.(m.value)
                          setModelOpen(false)
                        }}
                        className={[
                          "cursor-pointer flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-[13px]",
                          "transition-colors hover:bg-[var(--color-violet-pale)] hover:text-[var(--color-violet)]",
                          active && "bg-[var(--color-violet-pale)] text-[var(--color-violet)] font-semibold",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <span>{m.label}</span>
                        {m.hint && (
                          <span className="text-[11.5px] text-[var(--color-text-muted)]">
                            {m.hint}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-0.5">
          {onAttach && (
            <UtilityIcon onClick={onAttach} label={t("ui.ai.attachFile")}>
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            </UtilityIcon>
          )}
          {onVoice && (
            <UtilityIcon onClick={onVoice} label="Dictate">
              <Mic className="h-4 w-4" aria-hidden="true" />
            </UtilityIcon>
          )}
        </div>
      </div>

      {/* Textarea */}
      <textarea
        ref={ref}
        id={taId}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value, e)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        rows={2}
        maxLength={maxLength}
        aria-label="Prompt"
        className="block w-full resize-none bg-transparent px-4 pt-2 pb-3 text-[14.5px] leading-[1.55] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none"
      />

      {/* Suggestion chips */}
      {suggestions.length > 0 && !value?.trim() && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {suggestions.slice(0, 6).map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSuggestion?.(s)}
              className="cursor-pointer inline-flex items-center gap-1 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-violet)] hover:border-[var(--color-border-violet)] hover:bg-[var(--color-violet-pale)] transition-colors"
            >
              <Sparkles className="h-3 w-3 opacity-60" aria-hidden="true" />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Bottom row · counter + send */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] px-3 py-2">
        <div className="text-[11px] text-[var(--color-text-muted)]">
          {maxLength ? (
            <span className="font-mono tabular-nums">
              {(value?.length || 0)}/{maxLength}
            </span>
          ) : (
            <span>{t("ui.ai.sendShortcut")}</span>
          )}
        </div>

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-full bg-[var(--color-action-destructive)] px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[var(--color-action-destructive-hover)] transition-colors"
            aria-label={t("ui.ai.stopGenerating")}
          >
            <Square className="h-3 w-3 fill-current" aria-hidden="true" />
            Stop
          </button>
        ) : (
          <m.button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            whileTap={canSubmit ? { scale: 0.96 } : {}}
            className={[
              "inline-flex h-8 w-8 items-center justify-center rounded-full",
              "transition-[background-color,box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
              canSubmit
                ? "bg-[var(--color-action-primary)] text-[var(--color-text-on-violet)] shadow-[0_4px_14px_rgb(var(--color-violet-rgb)/0.30)] hover:bg-[var(--color-action-primary-hover)]"
                : "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] cursor-not-allowed",
            ].join(" ")}
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          </m.button>
        )}
      </div>
    </div>
  )
}

function UtilityIcon({ children, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="cursor-pointer inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-violet)] hover:bg-[var(--color-violet-pale)] transition-colors"
    >
      {children}
    </button>
  )
}

export { AIPromptInput }
