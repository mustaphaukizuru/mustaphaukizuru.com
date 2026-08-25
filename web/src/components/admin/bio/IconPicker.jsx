/* ── IconPicker — searchable visual dropdown bound to ICON_REGISTRY ──── */
import { useEffect, useMemo, useRef, useState } from "react"
import { Search } from "lucide-react"
import { m, AnimatePresence } from "framer-motion"
import { ICON_REGISTRY } from "../../SkillsByCapability"
import { inputClass } from "../Field"

export default function IconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const wrapRef = useRef(null)
  const Selected = value ? ICON_REGISTRY[value] : null

  // close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const allKeys = useMemo(() => Object.keys(ICON_REGISTRY).sort(), [])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allKeys
    return allKeys.filter((k) => k.includes(q))
  }, [allKeys, query])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputClass()} flex items-center gap-2 text-left`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {Selected ? (
          <>
            <span className="flex h-5 w-5 items-center justify-center rounded bg-violet-pale text-violet">
              <Selected className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="font-mono text-[12px] text-violet">{value}</span>
          </>
        ) : (
          <span className="text-charcoal-50">No icon, text-only chip</span>
        )}
        <span className="ml-auto text-charcoal-50">▾</span>
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_44px_rgb(var(--color-charcoal-rgb)/0.10)]"
            role="listbox"
          >
            <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
              <Search className="h-3.5 w-3.5 text-charcoal-50" aria-hidden="true" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search icons (react, jwt, postgres…)"
                className="w-full bg-transparent text-sm outline-none placeholder:text-charcoal-50"
              />
              {value && (
                <button
                  type="button"
                  onClick={() => { onChange(""); setOpen(false) }}
                  className="rounded px-1.5 text-[10px] font-semibold uppercase text-charcoal-50 hover:text-violet"
                  title="Clear"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="p-3 text-center text-xs italic text-charcoal-50">
                  No matches for "{query}"
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-1.5">
                  {filtered.map((key) => {
                    const Ic = ICON_REGISTRY[key]
                    const sel = key === value
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { onChange(key); setOpen(false); setQuery("") }}
                        className={`group flex flex-col items-center gap-1 rounded-lg px-1.5 py-2 transition focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-violet/40 ${
                          sel ? "bg-violet-pale ring-1 ring-violet/30" : "hover:bg-slate-50"
                        }`}
                      >
                        <span className={`flex h-7 w-7 items-center justify-center rounded ${sel ? "bg-white" : "bg-slate-100 group-hover:bg-white"}`}>
                          <Ic className="h-4 w-4 text-violet" aria-hidden="true" />
                        </span>
                        <span className="font-mono text-[9px] text-charcoal-50 group-hover:text-charcoal">
                          {key}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="border-t border-slate-200 px-3 py-1.5 font-mono text-[10px] text-charcoal-50">
              {filtered.length} of {allKeys.length} icons
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
