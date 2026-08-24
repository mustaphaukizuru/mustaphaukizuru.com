import { useState } from "react"
import { ExternalLink, FileText, Loader2, Sparkles } from "lucide-react"
import {
  adminListCertificates, adminCreateCertificate, adminUpdateCertificate, adminDeleteCertificate,
} from "../../../services/bioService"
import { certificateSchema } from "../../../lib/validation/bio"
import { Field, inputClass } from "../Field"
import { TextField, NumberField, DateField, CheckboxField } from "../forms"
import BioEntryForm from "./BioEntryForm"
import PdfUploader from "./PdfUploader"
import { SEED_CERTIFICATES } from "./seeds"
import {
  useBioSection, Section, Body, RowActions, ViewOnAboutLink, DeleteConfirm, fmtDate, toDateInput,
} from "./shared"

const toForm = (c = {}) => ({
  id: c.id,
  title: c.title ?? "",
  issuer: c.issuer ?? "",
  issuerLogo: c.issuerLogo ?? "",
  issueDate: toDateInput(c.issueDate),
  expiryDate: toDateInput(c.expiryDate),
  credentialId: c.credentialId ?? "",
  credentialUrl: c.credentialUrl ?? "",
  pdfUrl: c.pdfUrl ?? "",
  category: c.category ?? "",
  isVisible: c.isVisible !== false,
  displayOrder: typeof c.displayOrder === "number" ? c.displayOrder : 0,
})

function sourceModeFor(v) {
  if (v.pdfUrl) return { label: "PDF preview", tone: "bg-mint/15 text-mint", hint: "Hosted PDF will render inline as a thumbnail." }
  if (v.credentialUrl) return { label: "Credential card", tone: "bg-azure/10 text-azure", hint: "External link only, tile shows issuer logo + Verify button." }
  return { label: "Initial card", tone: "bg-charcoal-80/8 text-charcoal-80", hint: "No source, tile shows issuer initial only. Add a PDF or credential URL." }
}

export default function CertificatesSection() {
  const s = useBioSection({
    label: "Certificate",
    list: adminListCertificates, create: adminCreateCertificate,
    update: adminUpdateCertificate, remove: adminDeleteCertificate,
  })
  const [seeding, setSeeding] = useState(false)

  // Seed the hardcoded fallback certificates; skips titles that already
  // exist (case-insensitive) so it is safe to run repeatedly.
  const onSeedOriginals = async () => {
    if (!window.confirm(`Add the ${SEED_CERTIFICATES.length} original certificates to the database?\n\nThey'll be fully editable from this panel.`)) return
    setSeeding(true)
    const today = new Date().toISOString().slice(0, 10)
    const existingTitles = new Set(s.items.map((c) => c.title?.trim().toLowerCase()))
    let added = 0, skipped = 0, failed = 0
    for (let i = 0; i < SEED_CERTIFICATES.length; i += 1) {
      const seed = SEED_CERTIFICATES[i]
      if (existingTitles.has(seed.title.toLowerCase())) { skipped += 1; continue }
      try {
        await adminCreateCertificate({
          title: seed.title, issuer: seed.issuer, issueDate: today, pdfUrl: seed.pdfUrl,
          category: seed.category || null, isVisible: true, displayOrder: i,
        })
        added += 1
      } catch (e) {
        console.error("[Bio · Certificates] seed failed for:", seed.title, e)
        failed += 1
      }
    }
    setSeeding(false)
    if (added > 0) s.toast.showSuccess(`Added ${added} certificate${added === 1 ? "" : "s"}${skipped ? ` · skipped ${skipped}` : ""}${failed ? ` · ${failed} failed` : ""}`)
    else if (skipped === SEED_CERTIFICATES.length) (s.toast.showInfo?.("All originals already in the database.") || s.toast.showSuccess("Already up to date."))
    else if (failed > 0) s.toast.showError(`${failed} certificate${failed === 1 ? "" : "s"} failed to import.`, "Seed incomplete")
    await s.reload()
  }

  // displayOrder ASC, then issueDate DESC — matches the public About order.
  const sortedItems = [...s.items].sort((a, b) => {
    const ord = (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
    if (ord !== 0) return ord
    return (b.issueDate ? new Date(b.issueDate).getTime() : 0) - (a.issueDate ? new Date(a.issueDate).getTime() : 0)
  })

  return (
    <Section
      title="Certificates"
      onAdd={() => s.setEditing({})}
      onRefresh={s.reload}
      loading={s.loading}
      action={
        <div className="flex items-center gap-3">
          <ViewOnAboutLink hash="certifications" />
          <button
            type="button"
            onClick={onSeedOriginals}
            disabled={seeding || s.loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet/20 bg-white px-2.5 py-1 text-xs font-semibold text-violet hover:bg-violet-pale disabled:opacity-60"
            title="Insert the 9 original certificates into the DB so they become editable here"
          >
            {seeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Seed originals ({SEED_CERTIFICATES.length})
          </button>
        </div>
      }
    >
      <Body
        loading={s.loading}
        error={s.error}
        empty={s.items.length === 0}
        emptyText={
          <span>
            No certificates yet.{" "}
            <button type="button" onClick={onSeedOriginals} disabled={seeding} className="font-semibold text-violet underline-offset-2 hover:underline">
              {seeding ? "Importing…" : `Import the ${SEED_CERTIFICATES.length} originals`}
            </button>{" "}
            or click <span className="font-semibold">Add</span> to create one from scratch.
          </span>
        }
      >
        <ul className="divide-y divide-slate-200">
          {sortedItems.map((c) => {
            const initial = (c.issuer || c.title || "?").trim().charAt(0).toUpperCase()
            const isPdf = Boolean(c.pdfUrl)
            return (
              <li key={c.id} className="flex items-start gap-4 py-4">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet/10 ring-1 ring-violet/15">
                  {c.issuerLogo ? (
                    <img src={c.issuerLogo} alt="" className="h-full w-full object-contain p-1.5" loading="lazy" />
                  ) : (
                    <span className="font-mono text-sm font-bold text-violet">{initial}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-charcoal">{c.title}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${
                        isPdf ? "bg-mint/15 text-mint" : c.credentialUrl ? "bg-azure/10 text-azure" : "bg-charcoal-80/8 text-charcoal-80"
                      }`}
                      title={isPdf ? "Hosted PDF" : c.credentialUrl ? "External credential URL" : "No source, tile will fall back to initial"}
                    >
                      {isPdf ? "PDF" : c.credentialUrl ? "URL" : "-"}
                    </span>
                    {!c.isVisible && (
                      <span className="inline-flex items-center rounded-full bg-amber/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">Hidden</span>
                    )}
                    {typeof c.displayOrder === "number" && c.displayOrder !== 0 && (
                      <span className="font-mono text-[10px] tabular-nums text-charcoal-50">#{c.displayOrder}</span>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-charcoal-50 tabular-nums">
                    {c.issuer} · {fmtDate(c.issueDate)}{c.category ? ` · ${c.category}` : ""}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs">
                    {c.pdfUrl && <a href={c.pdfUrl} target="_blank" rel="noreferrer" className="text-azure hover:underline">Open PDF →</a>}
                    {c.credentialUrl && <a href={c.credentialUrl} target="_blank" rel="noreferrer" className="text-azure hover:underline">Verify credential →</a>}
                  </div>
                </div>
                <RowActions onEdit={() => s.setEditing(c)} onDelete={() => s.setPendingDelete(c)} />
              </li>
            )
          })}
        </ul>
      </Body>

      {s.editing && (
        <BioEntryForm
          title={s.editing.id ? "Edit certificate" : "New certificate"}
          schema={certificateSchema}
          initialValues={toForm(s.editing)}
          onSubmit={s.onSave}
          onCancel={() => s.setEditing(null)}
          size="lg"
        >
          {(form) => {
            const sourceMode = sourceModeFor(form.values)
            return (
              <>
                <TextField form={form} name="title" label="Title" required placeholder="e.g. Google IT Support Professional" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                  <TextField form={form} name="issuer" label="Issuer" required placeholder="Google · Coursera · IBM" />
                  <NumberField form={form} name="displayOrder" label="Display order" hint="Lower shows first" className="sm:w-28" />
                </div>
                <TextField form={form} name="issuerLogo" label="Issuer logo URL" hint="Square or wide image. Falls back to issuer initial." placeholder="https://… (PNG/SVG)" />
                <div className="grid grid-cols-2 gap-3">
                  <DateField form={form} name="issueDate" label="Issue date" required />
                  <DateField form={form} name="expiryDate" label="Expiry date" />
                </div>
                <TextField form={form} name="category" label="Category" placeholder="cloud · education · language" />
                <TextField form={form} name="credentialId" label="Credential ID" mono placeholder="ABCD-1234-EFGH" />

                {/* Certificate file — primary source for the public tile. */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-charcoal-80">
                        <FileText className="h-3.5 w-3.5" /> Certificate file
                      </div>
                      <div className="mt-0.5 text-[11px] text-charcoal-50">
                        The PDF visitors see on /about. Renders as a page-1 thumbnail and opens in a viewer with download.
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${sourceMode.tone}`} title={sourceMode.hint}>
                      {sourceMode.label}
                    </span>
                  </div>
                  <PdfUploader value={form.values.pdfUrl} onChange={(url) => form.setValue("pdfUrl", url)} />
                  <details className="group mt-3">
                    <summary className="cursor-pointer select-none text-xs font-semibold text-charcoal-80 hover:text-violet">
                      Or paste a URL <span className="text-charcoal-50 group-open:hidden">(advanced)</span>
                    </summary>
                    <div className="mt-2">
                      <input
                        value={form.values.pdfUrl}
                        onChange={form.handleChange("pdfUrl")}
                        className={inputClass({ error: Boolean(form.errors.pdfUrl) })}
                        placeholder="/documents/certificates/cert.pdf · or full PDF URL"
                        aria-invalid={Boolean(form.errors.pdfUrl)}
                      />
                      {form.errors.pdfUrl && <p className="mt-1 text-micro text-rose-600" role="alert">{form.errors.pdfUrl}</p>}
                      <p className="mt-1 text-[11px] text-charcoal-50">
                        Same-origin path (e.g. <code>/documents/certificates/…</code>) or any direct <code>.pdf</code> link.
                      </p>
                    </div>
                  </details>
                </div>

                <Field label="Credential verification URL" hint="Issuer page (Coursera, Credly, Google). Shown when no PDF is attached." error={form.errors.credentialUrl}>
                  {(id, describedBy) => (
                    <div className="flex gap-2">
                      <input
                        id={id}
                        value={form.values.credentialUrl}
                        onChange={form.handleChange("credentialUrl")}
                        aria-describedby={describedBy}
                        aria-invalid={Boolean(form.errors.credentialUrl)}
                        className={inputClass({ error: Boolean(form.errors.credentialUrl) })}
                        placeholder="https://www.coursera.org/account/accomplishments/verify/…"
                      />
                      {form.values.credentialUrl && (
                        <a href={form.values.credentialUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-azure/20 bg-white px-3 text-xs font-semibold text-azure hover:bg-azure/5" title="Open in new tab">
                          <ExternalLink className="h-3.5 w-3.5" /> Test
                        </a>
                      )}
                    </div>
                  )}
                </Field>

                <CheckboxField form={form} name="isVisible" label="Visible on About page" />
              </>
            )
          }}
        </BioEntryForm>
      )}

      <DeleteConfirm section={s} title="Delete this certificate?" />
    </Section>
  )
}
