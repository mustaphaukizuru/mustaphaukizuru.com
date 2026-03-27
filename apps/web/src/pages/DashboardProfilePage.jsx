import { useMemo, useState, useRef } from "react"
import {
  Mail, ShieldCheck, User, CalendarDays, Edit3, Save, X,
  Phone, Building, Lock, Camera, Trash2, CheckCircle2, AlertCircle, Eye, EyeOff
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { authFetch, API_BASE_URL } from "../lib/api"
import { getStoredToken } from "../services/authService"
import { useToast } from "../context/ToastContext"

function InfoRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#634F40]/8 bg-[#fafafa] p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-[#634F40]/55">{label}</div>
        <div className="mt-0.5 text-[14px] font-semibold text-[#420060] break-words">{value || "—"}</div>
      </div>
    </div>
  )
}

export default function DashboardProfilePage() {
  const { user, login, updateUser } = useAuth()
  const { showSuccess, showError } = useToast()

  const [editing, setEditing]     = useState(false)
  const [form, setForm]           = useState({ fullName: user?.fullName || "", phone: user?.phone || "", company: user?.company || "" })
  const [saving, setSaving]       = useState(false)
  const [uploadingAvatar, setUplAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)

  const [showPwForm, setShowPwForm] = useState(false)
  const [pwForm, setPwForm] = useState({ currentPassword:"", newPassword:"", confirmPassword:"" })
  const [showPw, setShowPw] = useState({ cur:false, new:false, conf:false })
  const [savingPw, setSavingPw] = useState(false)
  const [pwError, setPwError]   = useState("")

  const avatarRef = useRef(null)

  const initials = useMemo(() => (
    user?.fullName?.split(" ").map((p) => p[0]).join("").slice(0,2).toUpperCase() || "MU"
  ), [user])

  const joinDate = useMemo(() => {
    if (!user?.createdAt) return "—"
    return new Date(user.createdAt).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })
  }, [user])

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
      showSuccess("Profile updated")
      setEditing(false)
      // Sync AuthContext so header/profile shows updated name immediately
      if (typeof updateUser === "function") {
        updateUser({ fullName: form.fullName, phone: form.phone, company: form.company })
      }
    } catch (err) {
      showError(err.message || "Failed to update")
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
      const token = getStoredToken()
      const res = await fetch(`${API_BASE_URL}/api/member/profile/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      showSuccess("Avatar updated")
    } catch (err) {
      showError(err.message || "Upload failed")
      setAvatarPreview(null)
    } finally {
      setUplAvatar(false)
    }
  }

  async function handleDeleteAvatar() {
    try {
      await authFetch("/api/member/profile/avatar", { method:"DELETE" })
      setAvatarPreview(null)
      showSuccess("Avatar removed")
    } catch (err) {
      showError(err.message || "Failed to remove avatar")
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwError("")
    const { currentPassword, newPassword, confirmPassword } = pwForm
    if (!currentPassword || !newPassword || !confirmPassword) { setPwError("All fields required"); return }
    if (newPassword !== confirmPassword) { setPwError("New passwords do not match"); return }
    if (newPassword.length < 6) { setPwError("Password must be at least 6 characters"); return }
    setSavingPw(true)
    try {
      await authFetch("/api/member/profile/password", { method:"PATCH", body: JSON.stringify({ currentPassword, newPassword }) })
      showSuccess("Password changed successfully")
      setShowPwForm(false)
      setPwForm({ currentPassword:"", newPassword:"", confirmPassword:"" })
    } catch (err) {
      setPwError(err.message || "Failed to change password")
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">

        {/* Avatar card */}
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
          <div className="flex flex-col items-center text-center gap-4">
            {/* Avatar with upload overlay */}
            <div className="relative group">
              <div className="h-24 w-24 overflow-hidden rounded-xl bg-[#420060] shadow-[0_12px_28px_rgba(66,0,96,0.18)]">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user?.fullName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[26px] font-bold text-white">{initials}</div>
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
                className="rounded-xl border border-[#634F40]/12 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#420060] hover:bg-[#ede4ef] transition"
              >
                <Camera className="inline h-3.5 w-3.5 mr-1" />Upload Photo
              </button>
              {avatarUrl && (
                <button type="button" onClick={handleDeleteAvatar}
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-100 transition"
                >
                  <Trash2 className="inline h-3.5 w-3.5 mr-1" />Remove
                </button>
              )}
            </div>

            <div>
              <div className="text-[20px] font-bold text-[#420060]">{user?.fullName || "Member"}</div>
              <div className="mt-1 text-[13px] text-[#634F40]/60">{user?.email || "—"}</div>
              <span className="mt-3 inline-flex rounded-full bg-[#e5f4e8] px-4 py-1.5 text-[12px] font-semibold capitalize text-[#3b8f47]">
                {user?.role || "member"}
              </span>
            </div>

            <div className="w-full space-y-2 text-[12px]">
              <div className="flex justify-between border-b border-[#634F40]/8 pb-2">
                <span className="text-[#634F40]/55">Member since</span>
                <span className="font-semibold text-[#420060]">{joinDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#634F40]/55">Status</span>
                <span className="font-semibold text-[#2FA36B]">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details card */}
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-[18px] font-semibold text-[#420060]">Account Information</h3>
                <p className="mt-1 text-[12px] text-[#634F40]/60">Your personal details and account settings.</p>
              </div>
              {!editing ? (
                <button type="button" onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#420060]/20 px-4 py-2 text-[13px] font-medium text-[#420060] transition hover:bg-[#ede4ef]"
                >
                  <Edit3 className="h-4 w-4" /> Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button type="button" onClick={handleSave} disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#420060] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
                  </button>
                  <button type="button" onClick={() => setEditing(false)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#634F40]/15 px-4 py-2 text-[13px] text-[#634F40] hover:bg-[#f4eef6]"
                  >
                    <X className="h-4 w-4" /> Cancel
                  </button>
                </div>
              )}
            </div>

            {!editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow label="Full Name"    value={user?.fullName} icon={User} />
                <InfoRow label="Email"        value={user?.email}    icon={Mail} />
                <InfoRow label="Role"         value={user?.role}     icon={ShieldCheck} />
                <InfoRow label="Member Since" value={joinDate}       icon={CalendarDays} />
                <InfoRow label="Phone"        value={user?.phone}    icon={Phone} />
                <InfoRow label="Company"      value={user?.company}  icon={Building} />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { field:"fullName", label:"Full Name",  icon:User,     placeholder:"Your full name" },
                  { field:"phone",    label:"Phone",       icon:Phone,    placeholder:"Your phone" },
                  { field:"company",  label:"Company",     icon:Building, placeholder:"Organization" },
                ].map(({ field, label, icon: Icon, placeholder }) => (
                  <div key={field}>
                    <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">{label}</label>
                    <div className="relative">
                      <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#634F40]/35" />
                      <input type="text" value={form[field]||""} onChange={(e) => setForm(f=>({...f,[field]:e.target.value}))} placeholder={placeholder}
                        className="w-full rounded-xl border border-[#634F40]/15 bg-[#fafafa] py-3 pl-10 pr-4 text-[14px] text-[#420060] outline-none focus:border-[#420060]/40"
                      />
                    </div>
                  </div>
                ))}
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">Email (read-only)</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#634F40]/25" />
                    <input readOnly value={user?.email||""} className="w-full cursor-not-allowed rounded-xl border border-[#634F40]/10 bg-[#f2f2f2] py-3 pl-10 pr-4 text-[14px] text-[#634F40]/50 outline-none" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Password section */}
          <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-[#420060]">Password</div>
                  <div className="text-[12px] text-[#634F40]/55">Keep your account secure</div>
                </div>
              </div>
              <button type="button" onClick={() => setShowPwForm(!showPwForm)}
                className="rounded-xl border border-[#420060]/20 px-4 py-2 text-[12px] font-semibold text-[#420060] hover:bg-[#ede4ef] transition"
              >
                {showPwForm ? "Cancel" : "Change Password"}
              </button>
            </div>

            {showPwForm && (
              <form onSubmit={handleChangePassword} className="mt-5 flex flex-col gap-4">
                {pwError && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {pwError}
                  </div>
                )}
                {[
                  { key:"currentPassword", label:"Current Password", show:"cur" },
                  { key:"newPassword",     label:"New Password",     show:"new" },
                  { key:"confirmPassword", label:"Confirm Password", show:"conf" },
                ].map(({ key, label, show }) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">{label}</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#634F40]/35" />
                      <input type={showPw[show]?"text":"password"} value={pwForm[key]}
                        onChange={(e) => setPwForm(f=>({...f,[key]:e.target.value}))}
                        className="w-full rounded-xl border border-[#634F40]/15 bg-[#fafafa] py-3 pl-10 pr-10 text-[14px] text-[#420060] outline-none focus:border-[#420060]/40"
                      />
                      <button type="button" onClick={()=>setShowPw(s=>({...s,[show]:!s[show]}))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#634F40]/40 hover:text-[#420060]"
                      >
                        {showPw[show] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ))}
                <button type="submit" disabled={savingPw}
                  className="w-full rounded-xl bg-[#420060] py-3 text-[14px] font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-60"
                >
                  {savingPw ? "Changing…" : "Change Password"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
