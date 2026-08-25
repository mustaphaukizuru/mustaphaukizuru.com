// ─────────────────────────────────────────────────────────────────────────────
// useForm · single form layer for admin create/edit forms
//
//   const form = useForm({ schema, initialValues, onSubmit })
//
//   form.values / form.errors / form.touched
//   form.setValue(path, value)          — set one field (dot paths allowed)
//   form.setValues(patch | fn)          — merge many fields at once
//   form.handleChange(path)(event|val)  — curried change handler for inputs
//   form.handleSubmit(event?)           — validates with zod, then calls onSubmit(parsed, helpers)
//   form.submitting                     — true while onSubmit is pending
//   form.reset(nextValues?)             — restore initial (or given) values, clear errors
//   form.setErrors(map)                 — replace error map ({ "path": "message" })
//   form.applyServerErrors(err)         — map an AppError (lib/api.js) onto fields + formError
//   form.formError                      — non-field error string ("" when none)
//   form.isDirty                        — values differ from the last reset baseline
//
// Validation runs `schema.safeParse(values)` — the *parsed* (coerced/trimmed)
// value is what gets handed to onSubmit, so pages send exactly what the schema
// declares. Errors are keyed by zod path joined with "." (e.g. "items.0.name").
//
// Server errors: AppError.details (see lib/api.js pickErrorDetails) can be
//   { field, ... }                                    — utils/validators.js shape
//   { errors: [{ field|path, message }] }             — list shape
//   { fields: { name: "msg" } } / { name: "msg" }     — map shape
// Anything unrecognised lands in formError via err.toUserMessage?.() || err.message.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useMemo, useRef, useState } from "react"

function getAt(obj, path) {
  return String(path).split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj)
}

function setAt(obj, path, value) {
  const keys = String(path).split(".")
  const root = Array.isArray(obj) ? [...obj] : { ...obj }
  let cur = root
  for (let i = 0; i < keys.length - 1; i += 1) {
    const k = keys[i]
    const next = cur[k]
    cur[k] = Array.isArray(next) ? [...next] : { ...(next || {}) }
    cur = cur[k]
  }
  cur[keys[keys.length - 1]] = value
  return root
}

function eventValue(evt) {
  if (evt && typeof evt === "object" && "target" in evt && evt.target) {
    const t = evt.target
    if (t.type === "checkbox") return Boolean(t.checked)
    if (t.type === "number") return t.value === "" ? "" : t.value
    return t.value
  }
  return evt
}

export function zodErrorsToMap(zodError) {
  const map = {}
  for (const issue of zodError?.issues || []) {
    const key = (issue.path || []).join(".") || "_form"
    if (!map[key]) map[key] = issue.message
  }
  return map
}

export function serverErrorsToMap(err) {
  const map = {}
  const details = err?.details
  if (details && typeof details === "object") {
    if (Array.isArray(details.errors)) {
      for (const e of details.errors) {
        const key = e?.field || (Array.isArray(e?.path) ? e.path.join(".") : e?.path)
        if (key && !map[key]) map[key] = e?.message || err?.message || "Invalid value"
      }
    } else if (details.fields && typeof details.fields === "object") {
      for (const [k, v] of Object.entries(details.fields)) map[k] = Array.isArray(v) ? v[0] : String(v)
    } else if (typeof details.field === "string") {
      map[details.field] = err?.message || "Invalid value"
    } else {
      for (const [k, v] of Object.entries(details)) {
        if (typeof v === "string" && !["code", "message", "status", "error"].includes(k)) map[k] = v
      }
    }
  }
  return map
}

export default function useForm({ schema, initialValues = {}, onSubmit, validateOnChange = true } = {}) {
  const baseline = useRef(initialValues)
  const [values, setValuesState] = useState(initialValues)
  const [errors, setErrorsState] = useState({})
  const [touched, setTouched] = useState({})
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submittedRef = useRef(false)

  const validate = useCallback((vals) => {
    if (!schema) return { ok: true, data: vals, errors: {} }
    const result = schema.safeParse(vals)
    if (result.success) return { ok: true, data: result.data, errors: {} }
    return { ok: false, data: vals, errors: zodErrorsToMap(result.error) }
  }, [schema])

  const setValue = useCallback((path, value) => {
    setValuesState((prev) => {
      const next = setAt(prev, path, value)
      if (validateOnChange && submittedRef.current) {
        const { errors: nextErrors } = validate(next)
        setErrorsState(nextErrors)
      } else {
        setErrorsState((e) => (e[path] ? { ...e, [path]: undefined } : e))
      }
      return next
    })
    setTouched((t) => (t[path] ? t : { ...t, [path]: true }))
  }, [validate, validateOnChange])

  const setValues = useCallback((patch) => {
    setValuesState((prev) => {
      const merged = typeof patch === "function" ? patch(prev) : { ...prev, ...patch }
      if (validateOnChange && submittedRef.current) setErrorsState(validate(merged).errors)
      return merged
    })
  }, [validate, validateOnChange])

  const handleChange = useCallback((path) => (evt) => setValue(path, eventValue(evt)), [setValue])

  const setErrors = useCallback((map) => setErrorsState(map || {}), [])

  const applyServerErrors = useCallback((err) => {
    const map = serverErrorsToMap(err)
    if (Object.keys(map).length) setErrorsState((e) => ({ ...e, ...map }))
    setFormError(err?.toUserMessage?.() || err?.message || "Save failed.")
  }, [])

  const reset = useCallback((next) => {
    const vals = next === undefined ? baseline.current : next
    baseline.current = vals
    submittedRef.current = false
    setValuesState(vals)
    setErrorsState({})
    setTouched({})
    setFormError("")
  }, [])

  const handleSubmit = useCallback(async (evt) => {
    if (evt && typeof evt.preventDefault === "function") evt.preventDefault()
    submittedRef.current = true
    setFormError("")
    const { ok, data, errors: nextErrors } = validate(values)
    setErrorsState(nextErrors)
    if (!ok) return false
    if (!onSubmit) return true
    setSubmitting(true)
    try {
      await onSubmit(data, { values, reset, setErrors, applyServerErrors, setFormError })
      return true
    } catch (err) {
      applyServerErrors(err)
      return false
    } finally {
      setSubmitting(false)
    }
  }, [validate, values, onSubmit, reset, setErrors, applyServerErrors])

  const isDirty = useMemo(() => {
    try { return JSON.stringify(values) !== JSON.stringify(baseline.current) } catch { return true }
  }, [values])

  const getValue = useCallback((path) => getAt(values, path), [values])

  return {
    values, errors, touched, formError, submitting, isDirty,
    getValue, setValue, setValues, handleChange, handleSubmit,
    reset, setErrors, setFormError, applyServerErrors,
  }
}
