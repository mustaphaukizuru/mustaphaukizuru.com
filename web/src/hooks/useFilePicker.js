import { useCallback, useState } from "react"

/**
 * useFilePicker · client-side validation for project attachments.
 *
 * Lives outside ProjectSupportPanel because MessagesPanel's composer needs
 * it too, and a hook exported from a file of components breaks Fast Refresh.
 * The limits mirror ALLOWED_EXT / the multer config in
 * src/middleware/uploadProjectFile.js — keep them in sync. Validating here is
 * a courtesy, not a control: the server refuses the same things again.
 */

export const MAX_FILES = 10
export const MAX_MB = 50
export const ALLOWED_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
  ".pdf", ".zip", ".txt", ".md", ".csv", ".json",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".fig", ".sketch", ".ai", ".psd",
])
export const ACCEPT = Array.from(ALLOWED_EXT).join(",")

export const ext = (name) => {
  const i = String(name || "").lastIndexOf(".")
  return i >= 0 ? String(name).slice(i).toLowerCase() : ""
}

export default function useFilePicker({ t }) {
  const [files, setFiles] = useState([])
  const [fileError, setFileError] = useState("")

  const addFiles = useCallback((incoming) => {
    const list = Array.from(incoming || [])
    setFileError("")
    setFiles((prev) => {
      const next = [...prev]
      for (const f of list) {
        if (next.length >= MAX_FILES) { setFileError(t("projects.support.errors.tooMany", { max: MAX_FILES })); break }
        if (!ALLOWED_EXT.has(ext(f.name))) { setFileError(t("projects.support.errors.badType", { name: f.name })); continue }
        if (f.size > MAX_MB * 1024 * 1024) { setFileError(t("projects.support.errors.tooLarge", { name: f.name, size: MAX_MB })); continue }
        if (next.some((p) => p.name === f.name && p.size === f.size)) continue
        next.push(f)
      }
      return next
    })
  }, [t])

  const removeFile = useCallback((idx) => setFiles((prev) => prev.filter((_, i) => i !== idx)), [])
  const reset = useCallback(() => { setFiles([]); setFileError("") }, [])
  return { files, fileError, addFiles, removeFile, reset }
}
