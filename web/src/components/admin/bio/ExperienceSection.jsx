import { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import {
  adminListExperience, adminCreateExperience, adminUpdateExperience, adminDeleteExperience,
} from "../../../services/bioService"
import { experienceSchema } from "../../../lib/validation/bio"
import { TextField, TextAreaField, DateField, CheckboxField } from "../forms"
import BioEntryForm from "./BioEntryForm"
import { SEED_EXPERIENCE } from "./seeds"
import {
  useBioSection, Section, Body, RowActions, ViewOnAboutLink, DeleteConfirm, fmtDate, toDateInput,
} from "./shared"

const toForm = (x = {}) => ({
  id: x.id,
  role: x.role ?? "",
  company: x.company ?? "",
  location: x.location ?? "",
  startDate: toDateInput(x.startDate),
  endDate: toDateInput(x.endDate),
  description: x.description ?? "",
  highlights: x.highlights ?? null,
  tools: x.tools ?? null,
  isVisible: x.isVisible !== false,
  displayOrder: x.displayOrder ?? 0,
})

export default function ExperienceSection() {
  const s = useBioSection({
    label: "Experience",
    list: adminListExperience, create: adminCreateExperience,
    update: adminUpdateExperience, remove: adminDeleteExperience,
  })
  const [seeding, setSeeding] = useState(false)

  /* Bulk-import the authoritative entries; skips (role, company) keys that
   * already exist (case-insensitive). */
  const onSeedOriginals = async () => {
    if (!window.confirm(
      `Add the ${SEED_EXPERIENCE.length} authoritative experience entries to the database?\n\nThey'll be fully editable from this panel. Existing rows with the same role + company are skipped.`
    )) return
    setSeeding(true)
    const existing = new Set(s.items.map((x) => `${(x.role || "").trim().toLowerCase()}::${(x.company || "").trim().toLowerCase()}`))
    let added = 0, skipped = 0, failed = 0
    for (let i = 0; i < SEED_EXPERIENCE.length; i += 1) {
      const seed = SEED_EXPERIENCE[i]
      const key = `${seed.role.trim().toLowerCase()}::${seed.company.trim().toLowerCase()}`
      if (existing.has(key)) { skipped += 1; continue }
      try {
        await adminCreateExperience({ ...seed, displayOrder: i, isVisible: true })
        added += 1
      } catch (e) {
        console.error("[Bio · Experience] seed failed for:", seed.role, e)
        failed += 1
      }
    }
    setSeeding(false)
    if (added > 0) s.toast.showSuccess(`Added ${added} experience entr${added === 1 ? "y" : "ies"}${skipped ? ` · skipped ${skipped}` : ""}${failed ? ` · ${failed} failed` : ""}`)
    else if (skipped === SEED_EXPERIENCE.length) (s.toast.showInfo?.("All entries already in the database.") || s.toast.showSuccess("Already up to date."))
    else if (failed > 0) s.toast.showError(`${failed} entr${failed === 1 ? "y" : "ies"} failed to import.`, "Seed incomplete")
    await s.reload()
  }

  return (
    <Section
      title="Experience"
      onAdd={() => s.setEditing({})}
      onRefresh={s.reload}
      loading={s.loading}
      action={
        <div className="flex items-center gap-3">
          <ViewOnAboutLink hash="journey" />
          <button
            type="button"
            onClick={onSeedOriginals}
            disabled={seeding || s.loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet/20 bg-white px-2.5 py-1 text-xs font-semibold text-violet hover:bg-violet-pale disabled:opacity-60"
            title="Insert the 6 authoritative experience entries into the DB so they become editable here"
          >
            {seeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Seed originals ({SEED_EXPERIENCE.length})
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
            No experience entries yet.{" "}
            <button type="button" onClick={onSeedOriginals} disabled={seeding} className="font-semibold text-violet underline-offset-2 hover:underline">
              {seeding ? "Importing…" : `Import the ${SEED_EXPERIENCE.length} originals`}
            </button>{" "}
            or click <span className="font-semibold">Add</span> to create one from scratch.
          </span>
        }
      >
        <ul className="divide-y divide-slate-200">
          {s.items.map((x) => (
            <li key={x.id} className="flex items-start gap-3 py-4">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-charcoal">
                  {x.role} · <span className="font-normal text-charcoal-80">{x.company}</span>
                </div>
                <div className="mt-0.5 font-mono text-xs text-charcoal-50 tabular-nums">
                  {fmtDate(x.startDate)} → {x.endDate ? fmtDate(x.endDate) : "Present"}
                  {x.location ? ` · ${x.location}` : ""}
                  {x.isVisible ? "" : " · hidden"}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-charcoal-80">{x.description}</p>
              </div>
              <RowActions onEdit={() => s.setEditing(x)} onDelete={() => s.setPendingDelete(x)} />
            </li>
          ))}
        </ul>
      </Body>

      {s.editing && (
        <BioEntryForm
          title={s.editing.id ? "Edit experience" : "New experience"}
          schema={experienceSchema}
          initialValues={toForm(s.editing)}
          onSubmit={s.onSave}
          onCancel={() => s.setEditing(null)}
        >
          {(form) => (
            <>
              <TextField form={form} name="role" label="Role" required />
              <TextField form={form} name="company" label="Company" required />
              <TextField form={form} name="location" label="Location" />
              <div className="grid grid-cols-2 gap-3">
                <DateField form={form} name="startDate" label="Start date" required />
                <DateField form={form} name="endDate" label="End date" hint="Empty = present" />
              </div>
              <TextAreaField form={form} name="description" label="Description" rows={4} required />
              <CheckboxField form={form} name="isVisible" label="Visible on About page" />
            </>
          )}
        </BioEntryForm>
      )}

      <DeleteConfirm section={s} title="Delete this experience entry?" />
    </Section>
  )
}
