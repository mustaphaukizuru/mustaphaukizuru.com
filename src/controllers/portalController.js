const asyncHandler = require("../utils/asyncHandler")
const prisma = require("../lib/prisma")
const { requestPin, verifyPin, loadPortalProject, loadProjectByToken } = require("../services/portalAccessService")
const { setPortalCookie, clearPortalCookie } = require("../utils/portalCookie")
const { sendProjectFile } = require("./clientProjectController")
const { ndaStatus } = require("../services/projectPortalService")
const { resolveUserLocale } = require("../utils/resolveUserLocale")

function portalError(res, e) {
  if (e?.statusCode && e?.code) {
    return res.status(e.statusCode).json({ success: false, error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } })
  }
  throw e
}

/** GET /portal/:token — is this link alive? (name only, no PIN yet) */
const probe = asyncHandler(async (req, res) => {
  try {
    const project = await loadProjectByToken(req.params.token)
    res.status(200).json({ success: true, data: { projectName: project.projectName, expiresAt: project.portalTokenExpiresAt } })
  } catch (e) { return portalError(res, e) }
})

/** POST /portal/:token/pin — email a 6-digit PIN to the project owner. */
const sendPin = asyncHandler(async (req, res) => {
  try {
    const data = await requestPin(req.params.token, { locale: resolveUserLocale({ req }) })
    res.status(200).json({ success: true, data })
  } catch (e) { return portalError(res, e) }
})

/** POST /portal/:token/verify { pin } — sets the httpOnly mu_portal cookie. */
const verify = asyncHandler(async (req, res) => {
  try {
    const { token, projectId, projectName } = await verifyPin(req.params.token, req.body?.pin)
    setPortalCookie(res, token)
    res.status(200).json({ success: true, data: { projectId, projectName } })
  } catch (e) { return portalError(res, e) }
})

/** POST /portal/logout — drop the portal cookie. */
const logout = asyncHandler(async (_req, res) => {
  clearPortalCookie(res)
  res.status(200).json({ success: true })
})

/** GET /portal/me/project — read-only project view (portalAuth). */
const getProject = asyncHandler(async (req, res) => {
  try {
    const data = await loadPortalProject(req.portal)
    res.status(200).json({ success: true, data })
  } catch (e) { return portalError(res, e) }
})

/** GET /portal/me/files/:fileId/download — scoped to the token's project. */
const downloadFile = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.portal
  const file = await prisma.projectFile.findFirst({
    where:   { id: String(req.params.fileId), projectId, supportMessageId: null },
    include: { project: { select: { id: true, userId: true, projectName: true, requiresNda: true, ndaVersion: true } } },
  })
  if (!file || file.project?.userId !== userId) {
    return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "File not found" } })
  }
  const nda = await ndaStatus(file.project, userId)
  if (nda.required && !nda.accepted) {
    return res.status(403).json({ success: false, error: { code: "NDA_REQUIRED", message: "Sign in to accept the project NDA before downloading files." } })
  }
  return sendProjectFile({ file, req, res, userId, action: "project.file.downloaded.portal" })
})

module.exports = { probe, sendPin, verify, logout, getProject, downloadFile }
