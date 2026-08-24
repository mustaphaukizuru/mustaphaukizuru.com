import {
  adminListSkills, adminCreateSkill, adminUpdateSkill, adminDeleteSkill,
} from "../../../services/bioService"
import { skillSchema, SKILL_CATEGORIES } from "../../../lib/validation/bio"
import { ICON_REGISTRY } from "../../SkillsByCapability"
import { Field } from "../Field"
import { TextField, NumberField, SelectField, CheckboxField } from "../forms"
import BioEntryForm from "./BioEntryForm"
import IconPicker from "./IconPicker"
import { useBioSection, Section, Body, RowActions, DeleteConfirm } from "./shared"

/* Maps each DB category to the public-facing capability section it lands in. */
const CATEGORY_TO_PUBLIC = {
  frontend: { capability: "Build", section: "Capabilities" },
  backend: { capability: "Build", section: "Capabilities" },
  database: { capability: "Data", section: "Capabilities" },
  cloud: { capability: "Ship", section: "Capabilities" },
  tools: { capability: "Ship / Operate / Secure", section: "Capabilities (auto-grouped by name + iconKey)" },
  soft_skill: { capability: "Teach & Lead", section: "Capabilities" },
  language: { capability: "-", section: "Languages I work in (CEFR strip)" },
}

const PROFICIENCY_TIERS = {
  1: { label: "Familiar", tone: "bg-charcoal-80/30" },
  2: { label: "Working", tone: "bg-charcoal-80/45" },
  3: { label: "Proficient", tone: "bg-violet/55" },
  4: { label: "Advanced", tone: "bg-violet/80" },
  5: { label: "Expert", tone: "bg-violet" },
}

const toForm = (x = {}) => ({
  id: x.id,
  name: x.name ?? "",
  category: x.category ?? "frontend",
  proficiency: x.proficiency ?? 3,
  yearsUsing: x.yearsUsing ?? "",
  iconKey: x.iconKey ?? "",
  isVisible: x.isVisible !== false,
  displayOrder: x.displayOrder ?? 0,
})

export default function SkillsSection() {
  const s = useBioSection({
    label: "Skill",
    list: adminListSkills, create: adminCreateSkill,
    update: adminUpdateSkill, remove: adminDeleteSkill,
  })

  return (
    <Section title="Skills" onAdd={() => s.setEditing({})} onRefresh={s.reload} loading={s.loading}>
      <Body loading={s.loading} error={s.error} empty={s.items.length === 0} emptyText="No skills yet.">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {s.items.map((x) => (
            <li key={x.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-charcoal">{x.name}</div>
                <div className="font-mono text-xs text-charcoal-50 tabular-nums">
                  {x.category} · {x.proficiency}/5{x.yearsUsing ? ` · ${x.yearsUsing}y` : ""}
                  {x.isVisible ? "" : " · hidden"}
                </div>
              </div>
              <RowActions onEdit={() => s.setEditing(x)} onDelete={() => s.setPendingDelete(x)} />
            </li>
          ))}
        </ul>
      </Body>

      {s.editing && (
        <BioEntryForm
          title={s.editing.id ? "Edit skill" : "New skill"}
          schema={skillSchema}
          initialValues={toForm(s.editing)}
          onSubmit={s.onSave}
          onCancel={() => s.setEditing(null)}
        >
          {(form) => {
            const f = form.values
            const publicHint = CATEGORY_TO_PUBLIC[f.category] || {}
            const tier = PROFICIENCY_TIERS[Number(f.proficiency)] || PROFICIENCY_TIERS[3]
            const ChosenIcon = f.iconKey ? ICON_REGISTRY[f.iconKey] : null
            return (
              <>
                <TextField form={form} name="name" label="Skill name" required placeholder="e.g. React, TCP/IP, Curriculum design" />

                <div>
                  <SelectField
                    form={form}
                    name="category"
                    label="Category"
                    required
                    options={SKILL_CATEGORIES.map((c) => ({ value: c, label: c.replace("_", " ") }))}
                  />
                  <p className="mt-1.5 text-[11px] leading-4 text-charcoal-50">
                    Will appear on the public About page under{" "}
                    <strong className="font-semibold text-violet">{publicHint.capability || "-"}</strong>
                    {publicHint.section ? <> in <em>{publicHint.section}</em></> : null}.
                  </p>
                </div>

                <Field label="Icon, optional, monochrome render">
                  <IconPicker value={f.iconKey} onChange={(v) => form.setValue("iconKey", v)} />
                </Field>

                <Field label="Proficiency" error={form.errors.proficiency}>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((n) => {
                        const active = Number(f.proficiency) >= n
                        const t = PROFICIENCY_TIERS[n]
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => form.setValue("proficiency", n)}
                            aria-pressed={Number(f.proficiency) === n}
                            className={`group h-8 flex-1 rounded-md transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/40 ${active ? t.tone : "bg-slate-100 hover:bg-slate-200"}`}
                            title={`${n} · ${t.label}`}
                          >
                            <span className={`block text-center font-mono text-[10px] font-semibold tabular-nums ${active ? "text-white/90" : "text-charcoal-50"}`}>{n}</span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-charcoal-50">1 Familiar → 5 Expert</span>
                      <span className="font-semibold text-violet">{tier.label}</span>
                    </div>
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <NumberField form={form} name="yearsUsing" label="Years using" min={0} />
                  <NumberField form={form} name="displayOrder" label="Display order" />
                </div>

                <CheckboxField form={form} name="isVisible" label="Visible on the public About page" />

                <div className="rounded-xl border border-dashed border-violet/30 bg-violet-pale/30 p-3">
                  <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-violet/70">Live preview</div>
                  {f.name ? (
                    <span className="inline-flex items-center gap-2 rounded-lg bg-violet-pale px-3 py-1.5 text-sm text-violet ring-1 ring-inset ring-violet/20">
                      {ChosenIcon && <ChosenIcon className="h-3.5 w-3.5 text-violet/85" aria-hidden="true" />}
                      <span className="font-medium">{f.name}</span>
                      <span className={`h-1.5 w-1.5 rounded-full ${tier.tone}`} aria-hidden="true" />
                    </span>
                  ) : (
                    <span className="text-xs italic text-charcoal-50">Type a name above to see the chip render.</span>
                  )}
                </div>
              </>
            )
          }}
        </BioEntryForm>
      )}

      <DeleteConfirm section={s} title="Delete this skill?" />
    </Section>
  )
}
