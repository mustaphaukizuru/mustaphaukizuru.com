import { useMemo, useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import {
  Mail, ShieldCheck, User, CalendarDays, Edit3, Save, X,
  Phone, Building, Lock, Camera, Trash2, CheckCircle2, AlertCircle, Eye, EyeOff
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { authFetch, API_BASE_URL } from "../lib/api"
import { useToast } from "../context/ToastContext"
import ProfileTabs from "../components/dashboard/ProfileTabs"

/* I18N · Phase 119B — strings keyed under `dashboard.profile.*`. The
 * editable fields and password form arrays carry plain object shape;
 * we resolve labels/placeholders via t() at render time using each
 * field's i18n key, keeping the field-iteration patterns intact. */

function InfoRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-charcoal-80/8 bg-mist p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-micro font-medium text-charcoal-80/55">{label}</div>
        <div className="mt-0.5 text-meta font-semibold text-violet break-words">{value || ","}</div>
      </div>
    </div>
  )
}

export default function DashboardProfilePage() {
  const { t, i18n } = useTranslation("dashboard")
  const { user, updateUser } = useAuth()
  const { showSuccess, showError } = useToast()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ fullName: user?.fullName || "", phone: user?.phone || "", company: user?.company || "" })
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUplAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)

  const [showPwForm, setShowPwForm] = useState(false)
  const [pwForm, setPwForm] = useState({ currentPassword:"", newPassword:"", confirmPassword:"" })
  const [showPw, setShowPw] = useState({ cur:false, new:false, conf:false })
  const [savingPw, setSavingPw] = useState(false)
  const [pwError, setPwError] = useState("")

  const avatarRef = useRef(null)

  const initials = useMemo(() => (
    user?.fullName?.split(" ").map((p) => p[0]).join("").slice(0,2).toUpperCase() || "MU"
  ), [user])

  // Locale-aware date format · resolves to es-MX when language is "es".
  const joinDate = useMemo(() => {
    if (!user?.createdAt) return ","
    const localeTag = i18n.language === "es" ? "es-MX" : "en-US"
    return new Date(user.createdAt).toLocaleDateString(localeTag, { year:"numeric", month:"long", day:"numeric" })
  }, [user, i18n.language])

  const avatarUrl = useMemo(() => {
    if (avatarPreview) return avatarPreview
    const url = user?.avatarUrl
    if (!url) return null
    return url.startsWith("http") ? url : `${API_BASE_URL}${url}`
  }, [user?.avatarUrl, avatarPreview])

  async function handleSave() {
    setSaving(true)
    try {
      await authFetch("/api/member/profile", { method:"PATCH", body: JSON.stringify(form) })
      showSuccess(t("profile.toast.profileUpdated"))
      setEditing(false)
      // Sync AuthContext so header/profile shows updated name immediately
      if (typeof updateUser === "function") {
        updateUser({ fullName: form.fullName, phone: form.phone, company: form.company })
      }
    } catch (err) {
      showError(err.message || t("profile.toast.profileFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarPreview(URL.createObjectURL(file))
    setUplAvatar(true)
    try {
      const fd = new FormData()
      fd.append("avatar", file)
      // authFetch detects FormData and lets the browser set the multipart
      // boundary itself — no manual Content-Type needed.
      const data = await authFetch("/api/v1/member/profile/avatar", {
        method: "POST",
        body:   fd,
      })
      // Sync avatar to auth context so all layouts update
      const url = data?.data?.avatarUrl
      if (url) {
        updateUser({ avatarUrl: url.startsWith("http") ? url : `${API_BASE_URL}${url}` })
      }
      showSuccess(t("profile.toast.avatarUpdated"))
    } catch (err) {
      showError(err?.toUserMessage?.() || err?.message || t("profile.toast.avatarUploadFail"))
      setAvatarPreview(null)
    } finally {
      setUplAvatar(false)
    }
  }

  async function handleDeleteAvatar() {
    try {
      await authFetch("/api/member/profile/avatar", { method:"DELETE" })
      setAvatarPreview(null)
      updateUser({ avatarUrl: null })
      showSuccess(t("profile.toast.avatarRemoved"))
    } catch (err) {
      showError(err.message || t("profile.toast.avatarRemoveFail"))
    }
  }

  // `hasPassword` comes from /api/auth/me — true if a passwordHash row
  // exists for this user. Google-only users (signed up via OAuth, never
  // opted into a local credential) get false here and see the "Set a
  // password" form instead of the standard change-password one. Default
  // to `true` for safety: if /me hasn't surfaced the field yet (e.g.,
  // backend not redeployed), we'd rather show the stricter change form
  // than accidentally offer set-password to someone who already has one
  // (the backend's 409-conflict guard would reject anyway, but UX is
  // better if we don't even show the wrong form).
  const hasPassword = user?.hasPassword !== false

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwError("")
    const { currentPassword, newPassword, confirmPassword } = pwForm
    if (!currentPassword || !newPassword || !confirmPassword) { setPwError(t("profile.passwordErrors.allRequired")); return }
    if (newPassword !== confirmPassword) { setPwError(t("profile.passwordErrors.mismatch")); return }
    if (newPassword.length < 6) { setPwError(t("profile.passwordErrors.tooShort")); return }
    setSavingPw(true)
    try {
      await authFetch("/api/member/profile/password", { method:"PATCH", body: JSON.stringify({ currentPassword, newPassword }) })
      showSuccess(t("profile.toast.passwordChanged"))
      setShowPwForm(false)
      setPwForm({ currentPassword:"", newPassword:"", confirmPassword:"" })
    } catch (err) {
      setPwError(err.message || t("profile.toast.passwordFailed"))
    } finally {
      setSavingPw(false)
    }
  }

  // Set-initial-password handler — for Google-only users adding a
  // fallback credential. Hits POST /api/member/profile/set-password
  // (no currentPassword required, since they don't have one).
  // On success: bump `hasPassword` in the auth context so the form
  // immediately re-renders as the standard change-password form.
  async function handleSetPassword(e) {
    e.preventDefault()
    setPwError("")
    const { newPassword, confirmPassword } = pwForm
    if (!newPassword || !confirmPassword) { setPwError(t("profile.passwordErrors.allRequired")); return }
    if (newPassword !== confirmPassword) { setPwError(t("profile.passwordErrors.mismatch")); return }
    if (newPassword.length < 6) { setPwError(t("profile.passwordErrors.tooShort")); return }
    setSavingPw(true)
    try {
      await authFetch("/api/member/profile/set-password", {
        method: "POST",
        body: JSON.stringify({ newPassword, confirmPassword }),
      })
      showSuccess(t("profile.password.passwordSet"))
      updateUser({ hasPassword: true })
      setShowPwForm(false)
      setPwForm({ currentPassword:"", newPassword:"", confirmPassword:"" })
    } catch (err) {
      setPwError(err.message || t("profile.toast.passwordFailed"))
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <section className="space-y-5">
      <ProfileTabs />
      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">

        {/* Avatar card */}
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_16px_rgb(var(--color-violet-rgb)/0.04)]">
          <div className="flex flex-col items-center text-center gap-4">
            {/* Avatar with upload overlay */}
            <div className="relative group">
              <div className="h-24 w-24 overflow-hidden rounded-xl bg-violet shadow-[0_12px_28px_rgb(var(--color-violet-rgb)/0.18)]">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user?.fullName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-section font-bold text-white">{initials}</div>
                )}
              </div>
              {/* Upload overlay */}
              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition group-hover:opacity-100"
              >
                <Camera className="h-6 w-6 text-white" />
              </button>
              <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => avatarRef.current?.click()}
                className="rounded-xl border border-charcoal-80/12 bg-white px-3 py-1.5 text-micro font-semibold text-violet hover:bg-violet-pale transition"
              >
                <Camera className="inline h-3.5 w-3.5 mr-1" />{t("profile.card.uploadPhoto")}
              </button>
              {avatarUrl && (
                <button type="button" onClick={handleDeleteAvatar}
                  className="rounded-xl border border-rose/20 bg-rose/10 px-3 py-1.5 text-micro font-semibold text-rose-700 hover:bg-red-100 transition"
                >
                  <Trash2 className="inline h-3.5 w-3.5 mr-1" />{t("profile.card.removePhoto")}
                </button>
              )}
            </div>

            <div>
              <div className="text-subsection font-bold text-violet">{user?.fullName || t("profile.fallback.memberName")}</div>
              <div className="mt-1 text-meta text-charcoal-80/60">{user?.email || "—"}</div>
              <span className="mt-3 inline-flex rounded-full bg-mint-100 px-4 py-1.5 text-micro font-semibold capitalize text-mint-800">
                {user?.role || t("profile.fallback.role")}
              </span>
            </div>

            <div className="w-full space-y-2 text-micro">
              <div className="flex justify-between border-b border-charcoal-80/8 pb-2">
                <span className="text-charcoal-80/55">{t("profile.card.memberSince")}</span>
                <span className="font-semibold text-violet">{joinDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-charcoal-80/55">{t("profile.card.status")}</span>
                <span className="font-semibold text-mint-600">{t("profile.card.active")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details card */}
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_16px_rgb(var(--color-violet-rgb)/0.04)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-card font-semibold text-violet">{t("profile.account.title")}</h3>
                <p className="mt-1 text-micro text-charcoal-80/60">{t("profile.account.subtitle")}</p>
              </div>
              {!editing ? (
                <button type="button" onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-violet/20 px-4 py-2 text-meta font-medium text-violet transition hover:bg-violet-pale"
                >
                  <Edit3 className="h-4 w-4" /> {t("profile.account.edit")}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button type="button" onClick={handleSave} disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet px-4 py-2 text-meta font-semibold text-white transition hover:bg-violet-deep disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" /> {saving ? t("profile.account.saving") : t("profile.account.save")}
                  </button>
                  <button type="button" onClick={() => setEditing(false)}
                    className="inline-flex items-center gap-2 rounded-xl border border-charcoal-80/15 px-4 py-2 text-meta text-charcoal-80 hover:bg-violet-pale/60"
                  >
                    <X className="h-4 w-4" /> {t("profile.account.cancel")}
                  </button>
                </div>
              )}
            </div>

            {!editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow label={t("profile.account.fields.fullName")}    value={user?.fullName} icon={User} />
                <InfoRow label={t("profile.account.fields.email")}       value={user?.email}    icon={Mail} />
                <InfoRow label={t("profile.account.fields.role")}        value={user?.role}     icon={ShieldCheck} />
                <InfoRow label={t("profile.account.fields.memberSince")} value={joinDate}       icon={CalendarDays} />
                <InfoRow label={t("profile.account.fields.phone")}       value={user?.phone}    icon={Phone} />
                <InfoRow label={t("profile.account.fields.company")}     value={user?.company}  icon={Building} />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { field:"fullName", labelKey:"profile.account.fields.fullName", icon:User,     placeholderKey:"profile.account.placeholders.fullName" },
                  { field:"phone",    labelKey:"profile.account.fields.phone",    icon:Phone,    placeholderKey:"profile.account.placeholders.phone" },
                  { field:"company",  labelKey:"profile.account.fields.company",  icon:Building, placeholderKey:"profile.account.placeholders.company" },
                ].map(({ field, labelKey, icon: Icon, placeholderKey }) => (
                  <div key={field}>
                    <label className="mb-1.5 block text-micro font-semibold text-violet">{t(labelKey)}</label>
                    <div className="relative">
                      <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/35" />
                      <input type="text" value={form[field]||""} onChange={(e) => setForm(f=>({...f,[field]:e.target.value}))} placeholder={t(placeholderKey)}
                        className="w-full rounded-xl border border-charcoal-80/15 bg-mist py-3 pl-10 pr-4 text-meta text-violet outline-none focus:border-violet/40"
                      />
                    </div>
                  </div>
                ))}
                <div>
                  <label className="mb-1.5 block text-micro font-semibold text-violet">{t("profile.account.fields.emailReadOnly")}</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/25" />
                    <input readOnly value={user?.email||""} className="w-full cursor-not-allowed rounded-xl border border-charcoal-80/10 bg-slate-50 py-3 pl-10 pr-4 text-meta text-charcoal-80/50 outline-none" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Password section · two variants driven by `hasPassword`:
              · hasPassword === true  → existing "Change password" form
                (requires current + new + confirm)
              · hasPassword === false → "Set password" form for Google-only
                users (just new + confirm, with an explanatory intro
                paragraph framing why this is useful and that we never
                see their Google password). */}
          <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_16px_rgb(var(--color-violet-rgb)/0.04)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-pale text-violet">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-meta font-bold text-violet">
                    {hasPassword ? t("profile.password.title") : t("profile.password.setTitle")}
                  </div>
                  <div className="text-micro text-charcoal-80/55">
                    {hasPassword ? t("profile.password.subtitle") : t("profile.password.setSubtitle")}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setShowPwForm(!showPwForm)}
                className="rounded-xl border border-violet/20 px-4 py-2 text-micro font-semibold text-violet hover:bg-violet-pale transition"
              >
                {showPwForm ? t("profile.password.cancel") : (hasPassword ? t("profile.password.change") : t("profile.password.set"))}
              </button>
            </div>

            {showPwForm && (
              <form
                onSubmit={hasPassword ? handleChangePassword : handleSetPassword}
                className="mt-5 flex flex-col gap-4"
              >
                {/* Intro callout for the set-password flow — explains the
                    "why" without burying it in microcopy elsewhere. Shown
                    only when the user has no current password (so it
                    can't confuse the standard change-password flow). */}
                {!hasPassword && (
                  <div className="flex items-start gap-3 rounded-xl border border-azure/20 bg-azure/5 px-4 py-3 text-micro text-charcoal-80/85">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-azure" />
                    <span>{t("profile.password.setIntro")}</span>
                  </div>
                )}

                {pwError && (
                  <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/10 px-4 py-3 text-meta text-rose-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {pwError}
                  </div>
                )}

                {/* Field list — filter out `currentPassword` when the user
                    is setting their initial password (they don't have
                    one to verify against). */}
                {[
                  { key:"currentPassword", labelKey:"profile.password.current", show:"cur" },
                  { key:"newPassword",     labelKey:"profile.password.new",     show:"new" },
                  { key:"confirmPassword", labelKey:"profile.password.confirm", show:"conf" },
                ]
                  .filter(({ key }) => hasPassword || key !== "currentPassword")
                  .map(({ key, labelKey, show }) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-micro font-semibold text-violet">{t(labelKey)}</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/35" />
                      <input type={showPw[show]?"text":"password"} value={pwForm[key]}
                        onChange={(e) => setPwForm(f=>({...f,[key]:e.target.value}))}
                        className="w-full rounded-xl border border-charcoal-80/15 bg-mist py-3 pl-10 pr-10 text-meta text-violet outline-none focus:border-violet/40"
                      />
                      <button type="button" onClick={()=>setShowPw(s=>({...s,[show]:!s[show]}))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-80/40 hover:text-violet"
                      >
                        {showPw[show] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ))}
                <button type="submit" disabled={savingPw}
                  className="w-full rounded-xl bg-violet py-3 text-meta font-semibold text-white transition hover:bg-violet-deep disabled:opacity-60"
                >
                  {savingPw
                    ? (hasPassword ? t("profile.password.saving") : t("profile.password.setSaving"))
                    : (hasPassword ? t("profile.password.submit") : t("profile.password.setSubmit"))}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
