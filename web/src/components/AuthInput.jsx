import { CheckCircle2, AlertCircle } from "lucide-react"

/* ──────────────────────────────────────────────────────────────────────────
 *  AuthInput · F09 · Batch 1
 *
 *  Universal input used by every auth page (LoginPage / SignupPage /
 *  ForgotPasswordPage / ResetPasswordPage). Replaces the per-page duplicate
 *  AuthInput definitions that used to live inline in each page file.
 *
 *  Visual contract (F09 brand v3.0):
 *    - Default border: charcoal-80/15
 *    - Focus ring: 3px Deep Azure with 2px white offset (WCAG-friendly)
 *    - Error state: rose border + AlertCircle indicator (right side, below `right`)
 *    - Success state: mint border + CheckCircle2 indicator
 *    - Disabled: 60% opacity, not-allowed cursor
 *
 *  Props (all optional except `value` + `onChange`):
 *    label         — string · text shown above the input (semantic <label>)
 *    icon          — Lucide React component · rendered absolute-left
 *    type          — "text" | "email" | "password" | etc · default "text"
 *    value         — string
 *    onChange      — event handler (receives native event, not just value)
 *    placeholder   — string
 *    autoComplete  — input autocomplete attribute
 *    name          — input name attribute
 *    id            — string · associates the <label> with the <input>
 *    required      — boolean
 *    disabled      — boolean
 *    right         — ReactNode · rendered absolute-right (eye toggle, etc.)
 *    error         — string · when truthy, switches to error styling (message
 *                    rendered below). Empty string = no error.
 *    success       — boolean · when true (and no error), shows mint state
 *    hint          — string · shown below in muted tone when no error/success
 *    showStrength  — boolean · when true and type="password", shows
 *                    PasswordStrengthMeter directly below
 *    onStrengthChange — function(score, label) · optional callback when
 *                    strength changes (consumers like SignupPage can use it
 *                    to gate submit on a minimum score)
 *
 *  Note: This component is purely presentational — it does not own any
 *  state. Pages keep useState for full control over validation timing,
 *  persistence, async checks, etc.
 *  ──────────────────────────────────────────────────────────────────────── */
export default function AuthInput({
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  name,
  id,
  required,
  disabled,
  right,
  error,
  success,
  hint,
  showStrength = false,
  onStrengthChange,
}) {
  const hasError = Boolean(error)
  const isOk = Boolean(success) && !hasError

  // Border color precedence: error > success > default
  const borderClass = hasError
    ? "border-rose/55"
    : isOk
    ? "border-mint/65"
    : "border-charcoal-80/15"

  // Focus ring: rose for error state, Deep Azure for normal (F09 spec)
  const focusRingClass = hasError
    ? "focus-within:border-rose focus-within:ring-rose/15"
    : "focus-within:border-azure focus-within:ring-azure/20"

  return (
    <div className="block">
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-micro font-semibold text-violet"
        >
          {label}
        </label>
      )}

      <div
        className={`relative flex items-center rounded-xl border bg-mist transition-all ${borderClass} ${focusRingClass} focus-within:bg-white focus-within:ring-[3px] focus-within:ring-offset-2 focus-within:ring-offset-white`}
      >
        {Icon && (
          <Icon
            className={`absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none ${
              hasError ? "text-rose" : isOk ? "text-mint" : "text-charcoal-80/35"
            }`}
            aria-hidden="true"
          />
        )}

        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError && id ? `${id}-error` : undefined}
          className={`w-full bg-transparent py-3.5 text-meta text-violet outline-none placeholder:text-charcoal-80/35 disabled:cursor-not-allowed disabled:opacity-60 ${
            Icon ? "pl-11" : "pl-4"
          } ${right || isOk || hasError ? "pr-11" : "pr-4"}`}
        />

        {/* Right adornment slot (eye toggle, etc.) takes priority over status icon. */}
        {right ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>
        ) : isOk ? (
          <CheckCircle2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mint"
            aria-hidden="true"
          />
        ) : hasError ? (
          <AlertCircle
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose"
            aria-hidden="true"
          />
        ) : null}
      </div>

      {/* Error / success / hint line, only one renders at a time */}
      {hasError && (
        <p
          id={id ? `${id}-error` : undefined}
          role="alert"
          className="mt-1.5 flex items-center gap-1.5 text-micro font-medium text-rose"
        >
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {!hasError && isOk && hint && (
        <p className="mt-1.5 text-micro font-medium text-mint">{hint}</p>
      )}
      {!hasError && !isOk && hint && (
        <p className="mt-1.5 text-micro text-charcoal-80/55">{hint}</p>
      )}

      {/* Optional password strength meter */}
      {showStrength && type === "password" && (
        <PasswordStrengthMeter value={value} onChange={onStrengthChange} />
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  PasswordStrengthMeter · F09 · Batch 1
 *
 *  Inline strength meter with no external dependencies. Scores 0-4 based on:
 *    - length ≥ 8       (1)
 *    - has lowercase    (1)
 *    - has uppercase    (1)
 *    - has digit        (1)
 *    - has symbol       (1)
 *
 *  Mapped levels:
 *    0     · empty       · neutral grey
 *    1-2   · weak        · rose (Rose Signal)
 *    3     · medium      · amber (Amber Glow)
 *    4-5   · strong      · mint  (Neon Mint)
 *
 *  Renders a 4-segment bar + a small label so the visual scales cleanly with
 *  the input width.
 *  ──────────────────────────────────────────────────────────────────────── */
function PasswordStrengthMeter({ value = "", onChange }) {
  const score = scorePassword(value)
  const meta = STRENGTH_META[score] ?? STRENGTH_META[0]

  // Notify consumer (e.g. SignupPage) when score crosses a threshold.
  // We deliberately do not memoize — the parent should also memoize if needed.
  if (typeof onChange === "function") {
    // Defer to next microtask so React doesn't complain about state updates
    // during render in strict mode.
    queueMicrotask(() => onChange(score, meta.label))
  }

  // Empty input → render reserved space so layout doesn't shift on first key.
  if (!value) {
    return (
      <div className="mt-2 flex items-center gap-2" aria-hidden="true">
        <div className="flex flex-1 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-1 flex-1 rounded-full bg-charcoal-80/8"
            />
          ))}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wide text-charcoal-80/30">
         ,
        </span>
      </div>
    )
  }

  // Filled segment count: 0 score → 0 segments, 5 score → 4 segments
  const filled = Math.min(4, Math.ceil(score))

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex flex-1 gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < filled ? meta.barClass : "bg-charcoal-80/8"
            }`}
          />
        ))}
      </div>
      <span
        className={`font-mono text-[10px] font-bold uppercase tracking-wide ${meta.labelClass}`}
        role="status"
        aria-live="polite"
      >
        {meta.label}
      </span>
    </div>
  )
}

function scorePassword(pw) {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (/[a-z]/.test(pw)) s++
  if (/[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}

const STRENGTH_META = {
  0: { label: ",", barClass: "bg-charcoal-80/8", labelClass: "text-charcoal-80/30" },
  1: { label: "Weak", barClass: "bg-rose", labelClass: "text-rose" },
  2: { label: "Weak", barClass: "bg-rose", labelClass: "text-rose" },
  3: { label: "Medium", barClass: "bg-amber", labelClass: "text-amber" },
  4: { label: "Strong", barClass: "bg-mint", labelClass: "text-mint" },
  5: { label: "Strong", barClass: "bg-mint", labelClass: "text-mint" },
}

// Expose the scorer for pages that want to gate submit on a minimum score
// (used by SignupPage + ResetPasswordPage to require ≥ medium).
export { scorePassword, PasswordStrengthMeter }
