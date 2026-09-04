import { FileText, Building2, MapPin, ChevronRight } from "lucide-react"
import { REGIMEN_FISCAL, USO_CFDI } from "../../lib/fiscalCatalog"

/**
 * FiscalFields · CFDI 4.0 receiver data (razón social, régimen, uso, C.P.).
 *
 * Rendered by CheckoutPage only when the buyer is in MX and typed an RFC —
 * the four fields are what the SAT requires on a factura and nothing else.
 * Presentational: parent owns state via `form` / `onChange(field, value)`.
 * `t` is the checkout namespace translator.
 */
const inputCls = "w-full rounded-xl border border-charcoal-80/15 bg-mist py-3.5 pl-10 pr-4 text-meta text-violet outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20"
const selectCls = "w-full appearance-none rounded-xl border border-charcoal-80/15 bg-mist py-3.5 pl-4 pr-9 text-meta text-violet outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20"

function Select({ id, label, value, onChange, options, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-micro font-semibold text-violet">{label}</label>
      <div className="relative">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
          <option value="">{placeholder}</option>
          {options.map(([code, name]) => (
            <option key={code} value={code}>{code} · {name}</option>
          ))}
        </select>
        <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-charcoal-80" aria-hidden="true" />
      </div>
    </div>
  )
}

export default function FiscalFields({ form, onChange, t }) {
  return (
    <fieldset className="sm:col-span-2 mt-2 rounded-xl border border-violet/15 bg-violet-pale/30 p-4">
      <legend className="px-1 text-micro font-semibold text-violet">{t("form.fiscalTitle")}</legend>
      <p className="mb-4 text-micro text-charcoal-80/65">{t("form.fiscalHint")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="legalName" className="mb-1.5 block text-micro font-semibold text-violet">{t("form.legalName")}</label>
          <div className="relative">
            <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80" aria-hidden="true" />
            <input
              id="legalName" type="text" value={form.legalName}
              onChange={(e) => onChange("legalName", e.target.value.toUpperCase())}
              placeholder={t("form.legalNamePlaceholder")} autoComplete="organization" className={inputCls}
            />
          </div>
        </div>
        <Select id="regimenFiscal" label={t("form.regimenFiscal")} value={form.regimenFiscal}
          onChange={(v) => onChange("regimenFiscal", v)} options={REGIMEN_FISCAL} placeholder={t("form.selectOption")} />
        <Select id="usoCfdi" label={t("form.usoCfdi")} value={form.usoCfdi}
          onChange={(v) => onChange("usoCfdi", v)} options={USO_CFDI} placeholder={t("form.selectOption")} />
        <div>
          <label htmlFor="fiscalPostalCode" className="mb-1.5 block text-micro font-semibold text-violet">{t("form.fiscalPostalCode")}</label>
          <div className="relative">
            <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80" aria-hidden="true" />
            <input
              id="fiscalPostalCode" type="text" inputMode="numeric" maxLength={5} value={form.fiscalPostalCode}
              onChange={(e) => onChange("fiscalPostalCode", e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder={t("form.fiscalPostalCodePlaceholder")} autoComplete="postal-code" className={inputCls}
            />
          </div>
        </div>
        <div className="hidden sm:block" aria-hidden="true"><FileText className="h-0 w-0" /></div>
      </div>
    </fieldset>
  )
}
