import {
  adminListEducation, adminCreateEducation, adminUpdateEducation, adminDeleteEducation,
} from "../../../services/bioService"
import { educationSchema } from "../../../lib/validation/bio"
import { TextField, TextAreaField, DateField, CheckboxField } from "../forms"
import BioEntryForm from "./BioEntryForm"
import { useBioSection, Section, Body, RowActions, DeleteConfirm, fmtDate, toDateInput } from "./shared"

const toForm = (x = {}) => ({
  id: x.id,
  degree: x.degree ?? "",
  institution: x.institution ?? "",
  location: x.location ?? "",
  fieldOfStudy: x.fieldOfStudy ?? "",
  grade: x.grade ?? "",
  startDate: toDateInput(x.startDate),
  endDate: toDateInput(x.endDate),
  description: x.description ?? "",
  highlights: x.highlights ?? null,
  isVisible: x.isVisible !== false,
  displayOrder: x.displayOrder ?? 0,
})

export default function EducationSection() {
  const s = useBioSection({
    label: "Education",
    list: adminListEducation, create: adminCreateEducation,
    update: adminUpdateEducation, remove: adminDeleteEducation,
  })

  return (
    <Section title="Education" onAdd={() => s.setEditing({})} onRefresh={s.reload} loading={s.loading}>
      <Body loading={s.loading} error={s.error} empty={s.items.length === 0} emptyText="No education entries yet.">
        <ul className="divide-y divide-slate-200">
          {s.items.map((x) => (
            <li key={x.id} className="flex items-start gap-3 py-4">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-charcoal">
                  {x.degree} · <span className="font-normal text-charcoal-80">{x.institution}</span>
                </div>
                <div className="mt-0.5 font-mono text-xs text-charcoal-50 tabular-nums">
                  {fmtDate(x.startDate)} → {x.endDate ? fmtDate(x.endDate) : "Present"}
                  {x.location ? ` · ${x.location}` : ""}
                  {x.fieldOfStudy ? ` · ${x.fieldOfStudy}` : ""}
                  {x.grade ? ` · ${x.grade}` : ""}
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
          title={s.editing.id ? "Edit education" : "New education"}
          schema={educationSchema}
          initialValues={toForm(s.editing)}
          onSubmit={s.onSave}
          onCancel={() => s.setEditing(null)}
        >
          {(form) => (
            <>
              <TextField form={form} name="degree" label="Degree / qualification" required placeholder="e.g. Master's in Strategic Management" />
              <TextField form={form} name="institution" label="Institution" required placeholder="e.g. Universidad Europea del Atlántico" />
              <div className="grid grid-cols-2 gap-3">
                <TextField form={form} name="fieldOfStudy" label="Field of study" placeholder="e.g. Software Engineering" />
                <TextField form={form} name="grade" label="Grade" placeholder="e.g. Distinction" />
              </div>
              <TextField form={form} name="location" label="Location" placeholder="e.g. Santander, Spain" />
              <div className="grid grid-cols-2 gap-3">
                <DateField form={form} name="startDate" label="Start date" required />
                <DateField form={form} name="endDate" label="End date" hint="Empty = present" />
              </div>
              <TextAreaField form={form} name="description" label="Description" rows={4} required placeholder="What you studied, projects, focus areas, anything noteworthy." />
              <CheckboxField form={form} name="isVisible" label="Visible on About page" />
            </>
          )}
        </BioEntryForm>
      )}

      <DeleteConfirm section={s} title="Delete this education entry?" />
    </Section>
  )
}
