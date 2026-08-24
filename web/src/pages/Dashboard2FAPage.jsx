import { useState } from "react"
import { useTranslation } from "react-i18next"
import { m, AnimatePresence } from "framer-motion"
import {
  ShieldCheck, Shield, Smartphone, Copy, Check, Download, RefreshCw,
  AlertCircle, Lock, X, KeyRound, Trash2, ChevronRight,
} from "lucide-react"
import {
  fetchTwoFactorStatus,
  setupTwoFactor as apiSetupTwoFactor,
  verifyTwoFactor as apiVerifyTwoFactor,
  disableTwoFactor as apiDisableTwoFactor,
  regenerateBackupCodes as apiRegenerateBackupCodes,
} from "../services/authService"
import { useToast } from "../context/ToastContext"
import useApiQuery from "../hooks/useApiQuery"
import { SectionCard, SkeletonCard } from "../components/ui/index"
import ProfileTabs from "../components/dashboard/ProfileTabs"

/* ────────────────────────────────────────────────────────────────────────────
 * Dashboard2FAPage — /dashboard/2fa
 *
 * I18N · Phase 119G — strings keyed under `dashboard.twoFactor.*`. The
 * 5 sub-components (DisabledState, SetupState, EnabledState,
 * BackupCodesModal, PasswordConfirmModal) each scope their own
 * useTranslation hook. The PasswordConfirmModal is reused for both
 * disable + regenerate paths via prop-driven titleKey/descKey/confirmKey.
 * ──────────────────────────────────────────────────────────────────────── */

export default function Dashboard2FAPage() {
  const { t, i18n } = useTranslation("dashboard")
  const localeTag = i18n.language === "es" ? "es-MX" : "en-US"
  const { data: status = null, loading, error, refetch: loadStatus, setData: setStatus } = useApiQuery(
    "twoFactor:status",
    () => fetchTwoFactorStatus(),
    { select: (data) => data || { isEnabled: false, isSetupInProgress: false } }
  )

  const [setupData, setSetupData] = useState(null)
  const [setupBusy, setSetupBusy] = useState(false)
  const [verifyCode, setVerifyCode] = useState("")
  const [verifyBusy, setVerifyBusy] = useState(false)

  const [backupCodes, setBackupCodes] = useState(null)
  const [disableModalOpen, setDisableModalOpen] = useState(false)
  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false)

  const { showSuccess, showError } = useToast()


  async function handleStartSetup() {
    setSetupBusy(true)
    try {
      const data = await apiSetupTwoFactor()
      setSetupData(data)
      setStatus({ isEnabled: false, isSetupInProgress: true })
    } catch (err) {
      showError(err?.message || t("twoFactor.errors.startSetup"))
    } finally {
      setSetupBusy(false)
    }
  }

  async function handleVerifyAndEnable() {
    if (verifyCode.length !== 6) return
    setVerifyBusy(true)
    try {
      const data = await apiVerifyTwoFactor(verifyCode)
      setBackupCodes(data?.backupCodes || [])
      setSetupData(null)
      setVerifyCode("")
      await loadStatus()
      showSuccess(t("twoFactor.toast.enabled"))
    } catch (err) {
      showError(err?.message || t("twoFactor.errors.verifyFailed"))
    } finally {
      setVerifyBusy(false)
    }
  }

  async function handleDisable(password) {
    await apiDisableTwoFactor(password)
    setDisableModalOpen(false)
    setSetupData(null)
    await loadStatus()
    showSuccess(t("twoFactor.toast.disabled"))
  }

  async function handleRegenerate(password) {
    const data = await apiRegenerateBackupCodes(password)
    setBackupCodes(data?.backupCodes || [])
    setRegenerateModalOpen(false)
    await loadStatus()
    showSuccess(t("twoFactor.toast.regenerated"))
  }

  if (loading) {
    return (
      <section className="space-y-5">
        <SkeletonCard height="h-[120px]" />
        <SkeletonCard height="h-[280px]" />
      </section>
    )
  }

  const currentState = status?.isEnabled
    ? "enabled"
    : status?.isSetupInProgress || setupData
      ? "setup"
      : "disabled"

  return (
    <>
      {/* Backup codes modal */}
      <AnimatePresence>
        {backupCodes && (
          <BackupCodesModal codes={backupCodes} onClose={() => setBackupCodes(null)} />
        )}
      </AnimatePresence>

      {/* Disable / regenerate password-confirmation modals */}
      <AnimatePresence>
        {disableModalOpen && (
          <PasswordConfirmModal
            titleKey="twoFactor.passwordModal.disable.title"
            descKey="twoFactor.passwordModal.disable.description"
            confirmKey="twoFactor.passwordModal.disable.confirm"
            confirmTone="red"
            onClose={() => setDisableModalOpen(false)}
            onConfirm={handleDisable}
          />
        )}
        {regenerateModalOpen && (
          <PasswordConfirmModal
            titleKey="twoFactor.passwordModal.regenerate.title"
            descKey="twoFactor.passwordModal.regenerate.description"
            confirmKey="twoFactor.passwordModal.regenerate.confirm"
            confirmTone="purple"
            onClose={() => setRegenerateModalOpen(false)}
            onConfirm={handleRegenerate}
          />
        )}
      </AnimatePresence>

      <section className="space-y-5">
      <ProfileTabs />
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose/20 bg-rose/10 px-4 py-3 text-meta text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Hero */}
        <div className={`rounded-xl border p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)] sm:p-6 ${
          currentState === "enabled"
            ? "border-mint/20 bg-gradient-to-br from-emerald-50 to-white"
            : "border-charcoal-80/10 bg-white"
        }`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                currentState === "enabled"
                  ? "bg-emerald-500 text-white shadow-[0_8px_20px_rgba(16,185,129,0.25)]"
                  : "bg-violet text-white shadow-[0_8px_20px_rgba(93,63,211,0.18)]"
              }`}>
                {currentState === "enabled" ? <ShieldCheck className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
              </div>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.12em] text-violet">
                  {t("twoFactor.hero.eyebrow")}
                </div>
                <h2 className="mt-2 text-subsection font-bold text-violet">
                  {t("twoFactor.hero.title")}
                </h2>
                <p className="mt-1 max-w-2xl text-meta leading-6 text-charcoal-80/70">
                  {currentState === "enabled"
                    ? t("twoFactor.hero.bodyEnabled")
                    : t("twoFactor.hero.bodyDisabled")}
                </p>
              </div>
            </div>

            {currentState === "enabled" && (
              <div className="flex flex-col items-end text-right">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-micro font-bold uppercase tracking-wider text-white">
                  <ShieldCheck className="h-3 w-3" /> {t("twoFactor.hero.enabledPill")}
                </span>
                {status?.enabledAt && (
                  <span className="mt-1.5 text-micro text-charcoal-80/55">
                    {t("twoFactor.hero.since", { date: new Date(status.enabledAt).toLocaleDateString(localeTag) })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        {currentState === "disabled" && (
          <DisabledState onStart={handleStartSetup} starting={setupBusy} />
        )}

        {currentState === "setup" && setupData && (
          <SetupState
            data={setupData}
            code={verifyCode}
            setCode={setVerifyCode}
            onVerify={handleVerifyAndEnable}
            verifying={verifyBusy}
            onCancel={async () => {
              try {
                setDisableModalOpen(true)
              } catch {
                /* ignore */
              }
            }}
          />
        )}

        {currentState === "setup" && !setupData && (
          <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 text-center shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
            <p className="text-meta text-charcoal-80/70">{t("twoFactor.stale.body")}</p>
            <button
              type="button"
              onClick={handleStartSetup}
              disabled={setupBusy}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-meta font-semibold text-white hover:bg-violet-deep disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" /> {t("twoFactor.stale.restart")}
            </button>
          </div>
        )}

        {currentState === "enabled" && (
          <EnabledState
            status={status}
            onRegenerate={() => setRegenerateModalOpen(true)}
            onDisable={() => setDisableModalOpen(true)}
          />
        )}
      </section>
    </>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * Sub-components
 * ──────────────────────────────────────────────────────────────────────────── */

function DisabledState({ onStart, starting }) {
  const { t } = useTranslation("dashboard")
  const apps = [
    { key: "google",   name: t("twoFactor.disabled.apps.google.name"),   desc: t("twoFactor.disabled.apps.google.desc") },
    { key: "authy",    name: t("twoFactor.disabled.apps.authy.name"),    desc: t("twoFactor.disabled.apps.authy.desc") },
    { key: "managers", name: t("twoFactor.disabled.apps.managers.name"), desc: t("twoFactor.disabled.apps.managers.desc") },
  ]
  return (
    <SectionCard
      title={t("twoFactor.disabled.title")}
      subtitle={t("twoFactor.disabled.subtitle")}
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {apps.map((app) => (
            <div key={app.key} className="rounded-xl border border-charcoal-80/10 bg-mist p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-meta font-semibold text-violet">{app.name}</div>
                  <div className="mt-0.5 text-micro text-charcoal-80/65">{app.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          className="inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-3 text-meta font-semibold text-white shadow-[0_8px_22px_rgba(93,63,211,0.22)] transition hover:-translate-y-0.5 hover:bg-violet-deep disabled:opacity-60"
        >
          <Shield className="h-4 w-4" />
          {starting ? t("twoFactor.disabled.starting") : t("twoFactor.disabled.enable")}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </SectionCard>
  )
}

function SetupState({ data, code, setCode, onVerify, verifying, onCancel }) {
  const { t } = useTranslation("dashboard")
  const [copied, setCopied] = useState(false)

  function copyManual() {
    navigator.clipboard.writeText(data.manualEntryCode || "")
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {})
  }

  return (
    <SectionCard
      title={t("twoFactor.setup.title")}
      subtitle={t("twoFactor.setup.subtitle")}
    >
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl border border-charcoal-80/15 bg-white p-3 shadow-[0_4px_16px_rgba(93,63,211,0.06)]">
            {data.qrCodeDataUrl ? (
              <img src={data.qrCodeDataUrl} alt={t("twoFactor.setup.qrAlt")} width={220} height={220} className="block" />
            ) : (
              <div className="flex h-[220px] w-[220px] items-center justify-center text-micro text-charcoal-80/50">
                {t("twoFactor.setup.qrUnavailable")}
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-micro font-semibold uppercase tracking-wider text-charcoal-80/55">{t("twoFactor.setup.manualLabel")}</div>
            <button
              type="button"
              onClick={copyManual}
              className="mt-1 inline-flex items-center gap-2 rounded-lg border border-charcoal-80/15 bg-mist px-3 py-1.5 font-mono text-micro text-violet transition hover:bg-violet-pale"
            >
              {data.manualEntryCode}
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5 opacity-60" />}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-violet/10 bg-violet-ghost p-4">
            <div className="text-micro font-semibold text-violet">{t("twoFactor.setup.step2Title")}</div>
            <p className="mt-1 text-micro text-charcoal-80/70">
              {t("twoFactor.setup.step2Body")}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-micro font-semibold text-violet">{t("twoFactor.setup.codeLabel")}</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-full rounded-xl border-2 border-charcoal-80/20 bg-mist px-4 py-4 text-center text-section font-bold tracking-[0.4em] text-violet outline-none focus:border-violet focus:ring-2 focus:ring-violet/15"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onVerify}
              disabled={verifying || code.length !== 6}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet px-5 py-3 text-meta font-semibold text-white transition hover:bg-violet-deep disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              {verifying ? t("twoFactor.setup.verifying") : t("twoFactor.setup.verifyEnable")}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose/20 bg-white px-5 py-3 text-meta font-medium text-rose-700 transition hover:bg-rose/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("twoFactor.setup.cancelSetup")}
            </button>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}

function EnabledState({ status, onRegenerate, onDisable }) {
  const { t } = useTranslation("dashboard")
  const used = status?.backupCodesUsed || 0
  const total = status?.backupCodesTotal || 0
  const remaining = total - used
  const lowOnCodes = total > 0 && remaining <= 2

  const remainingLine = t("twoFactor.enabled.backupRemaining", { remaining, total }) +
    (used > 0 ? t("twoFactor.enabled.backupUsedSuffix", { used }) : "")

  return (
    <SectionCard title={t("twoFactor.enabled.title")} subtitle={t("twoFactor.enabled.subtitle")}>
      <div className="space-y-3">
        {/* Backup code status */}
        <div className={`flex items-start gap-3 rounded-xl border p-4 ${
          lowOnCodes
            ? "border-amber/20 bg-amber/10"
            : "border-charcoal-80/10 bg-mist"
        }`}>
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            lowOnCodes ? "bg-amber-500 text-white" : "bg-violet-pale text-violet"
          }`}>
            <KeyRound className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-meta font-semibold text-violet">{t("twoFactor.enabled.backupTitle")}</div>
            <div className="mt-0.5 text-micro text-charcoal-80/70">
              {remainingLine}
              {lowOnCodes && (
                <span className="ml-1 font-semibold text-amber-700">
                  {t("twoFactor.enabled.backupLowWarning")}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-violet/15 px-3 py-2 text-micro font-semibold text-violet transition hover:bg-violet-pale"
          >
            <RefreshCw className="h-3.5 w-3.5" /> {t("twoFactor.enabled.regenerate")}
          </button>
        </div>

        {/* Disable */}
        <div className="flex items-start gap-3 rounded-xl border border-charcoal-80/10 bg-mist p-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose/10 text-rose-700">
            <Trash2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-meta font-semibold text-violet">{t("twoFactor.enabled.disableTitle")}</div>
            <div className="mt-0.5 text-micro text-charcoal-80/70">
              {t("twoFactor.enabled.disableBody")}
            </div>
          </div>
          <button
            type="button"
            onClick={onDisable}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-rose/20 bg-white px-3 py-2 text-micro font-semibold text-rose-700 transition hover:bg-rose/10"
          >
            <Lock className="h-3.5 w-3.5" /> {t("twoFactor.enabled.disable")}
          </button>
        </div>
      </div>
    </SectionCard>
  )
}

/* ── One-time backup codes modal ───────────────────────────────────────── */

function BackupCodesModal({ codes, onClose }) {
  const { t, i18n } = useTranslation("dashboard")
  const localeTag = i18n.language === "es" ? "es-MX" : "en-US"
  const [copied, setCopied] = useState(false)

  function copyAll() {
    navigator.clipboard.writeText(codes.join("\n"))
      .then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800) })
      .catch(() => {})
  }

  function downloadTxt() {
    const content = [
      t("twoFactor.backupModal.fileBrand"),
      t("twoFactor.backupModal.fileGenerated", { date: new Date().toLocaleString(localeTag) }),
      "",
      t("twoFactor.backupModal.fileWarning"),
      "",
      ...codes,
    ].join("\n")
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `2fa-backup-codes-${new Date().toISOString().slice(0,10)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <m.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <m.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className="w-full max-w-[520px] rounded-xl bg-white shadow-[0_30px_80px_rgba(93,63,211,0.22)]"
      >
        <div className="flex items-start justify-between border-b border-charcoal-80/10 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-[0_8px_20px_rgba(217,119,6,0.25)]">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-card font-bold text-violet">{t("twoFactor.backupModal.title")}</h2>
              <p className="mt-0.5 text-micro text-charcoal-80/70">
                {t("twoFactor.backupModal.subtitle")}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-charcoal-80/15 bg-mist p-4 sm:grid-cols-2">
            {codes.map((code) => (
              <code key={code} className="rounded-lg bg-white px-3 py-2 text-center font-mono text-meta font-bold tracking-wider text-violet shadow-sm">
                {code}
              </code>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={downloadTxt}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet px-4 py-3 text-meta font-semibold text-white transition hover:bg-violet-deep"
            >
              <Download className="h-4 w-4" /> {t("twoFactor.backupModal.downloadTxt")}
            </button>
            <button
              type="button"
              onClick={copyAll}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-violet/15 px-4 py-3 text-meta font-semibold text-violet transition hover:bg-violet-pale"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t("twoFactor.backupModal.copied") : t("twoFactor.backupModal.copyAll")}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-xl border border-charcoal-80/15 py-2.5 text-micro font-medium text-charcoal-80 hover:bg-violet-pale/60"
          >
            {t("twoFactor.backupModal.saved")}
          </button>
        </div>
      </m.div>
    </m.div>
  )
}

/* ── Generic password-confirmation modal ───────────────────────────────── */

function PasswordConfirmModal({ titleKey, descKey, confirmKey, confirmTone, onClose, onConfirm }) {
  const { t } = useTranslation("dashboard")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function handleConfirm() {
    if (!password) { setError(t("twoFactor.errors.passwordRequired")); return }
    setError(""); setBusy(true)
    try {
      await onConfirm(password)
    } catch (err) {
      setError(err?.message || t("twoFactor.errors.actionFailed"))
    } finally {
      setBusy(false)
    }
  }

  const toneClasses = confirmTone === "red"
    ? "bg-red-600 hover:bg-red-700 shadow-[0_8px_20px_rgba(220,38,38,0.25)]"
    : "bg-violet hover:bg-violet-deep shadow-[0_8px_20px_rgba(93,63,211,0.22)]"

  return (
    <m.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <m.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className="w-full max-w-[440px] rounded-xl bg-white shadow-[0_30px_80px_rgba(93,63,211,0.22)]"
      >
        <div className="flex items-center justify-between border-b border-charcoal-80/10 p-5">
          <h2 className="text-body font-bold text-violet">{t(titleKey)}</h2>
          <button onClick={onClose} type="button" aria-label={t("twoFactor.passwordModal.close")} className="rounded-xl p-1.5 text-charcoal-80/50 hover:bg-violet-pale/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-micro text-charcoal-80/75">{t(descKey)}</p>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/10 px-3 py-2 text-micro text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-micro font-semibold text-violet">{t("twoFactor.passwordModal.passwordLabel")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleConfirm() }}
              placeholder={t("twoFactor.passwordModal.passwordPlaceholder")}
              autoFocus
              className="w-full rounded-xl border border-charcoal-80/20 bg-mist px-4 py-3 text-meta text-violet outline-none focus:border-violet/40"
            />
          </div>
        </div>

        <div className="flex gap-2 border-t border-charcoal-80/10 p-5">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !password}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-meta font-semibold text-white transition disabled:opacity-60 ${toneClasses}`}
          >
            {busy ? t("twoFactor.passwordModal.working") : t(confirmKey)}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-charcoal-80/15 px-4 py-3 text-meta font-medium text-charcoal-80 hover:bg-violet-pale/60"
          >
            {t("twoFactor.passwordModal.cancel")}
          </button>
        </div>
      </m.div>
    </m.div>
  )
}
