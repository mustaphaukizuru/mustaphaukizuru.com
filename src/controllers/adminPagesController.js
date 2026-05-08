const prisma = require("../lib/prisma")

/**
 * Helper: pick the HTML body from the request, preferring `contentHtml`
 * (schema-canonical name) and falling back to `content` for back-compat
 * with the existing AdminPagesPage form state.
 */
function pickHtmlBody(body = {}) {
  if (typeof body.contentHtml === "string") return body.contentHtml
  if (typeof body.content === "string") return body.content
  return undefined
}

function pickHtmlBodyEs(body = {}) {
  if (typeof body.contentHtmlEs === "string") return body.contentHtmlEs
  if (typeof body.contentEs === "string") return body.contentEs
  return undefined
}

const listPages = async (req, res) => {
  try {
    const { status, pageType } = req.query
    const where = {}
    if (status)   where.status   = status
    if (pageType) where.pageType = pageType

    const pages = await prisma.page.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, slug: true, pageType: true, status: true, publishedAt: true, updatedAt: true },
    })
    return res.status(200).json({ success: true, data: pages })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const getPage = async (req, res) => {
  try {
    const page = await prisma.page.findUnique({ where: { id: req.params.id } })
    if (!page) return res.status(404).json({ success: false, message: "Page not found" })
    return res.status(200).json({ success: true, data: page })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const createPage = async (req, res) => {
  try {
    const { title, slug, pageType = "public", metaTitle, metaDescription,
            // I18N06 · bilingual columns shipped in Phase 4 schema
            titleEs, metaTitleEs, metaDescriptionEs } = req.body
    if (!title || !slug) return res.status(400).json({ success: false, message: "title and slug required" })

    const contentHtml   = pickHtmlBody(req.body)
    const contentEs     = pickHtmlBodyEs(req.body)

    const page = await prisma.page.create({
      data: {
        title, slug, pageType, contentHtml,
        metaTitle, metaDescription,
        // Spanish parallel columns (all nullable, all optional in body)
        titleEs:           titleEs           || null,
        contentEs:         contentEs         || null,
        metaTitleEs:       metaTitleEs       || null,
        metaDescriptionEs: metaDescriptionEs || null,
        createdById: req.user?.id,
        updatedById: req.user?.id,
      },
    })
    return res.status(201).json({ success: true, data: page })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const updatePage = async (req, res) => {
  try {
    const { title, slug, pageType, metaTitle, metaDescription,
            titleEs, metaTitleEs, metaDescriptionEs } = req.body

    const contentHtml = pickHtmlBody(req.body)
    const contentEs   = pickHtmlBodyEs(req.body)

    // Build the update payload defensively — only include fields that were
    // explicitly sent. Prisma's update treats `undefined` as "leave alone",
    // so spreading `{ titleEs: undefined }` is safe; spreading
    // `{ titleEs: null }` overwrites with null (which is what we want when
    // admin clears the Spanish field).
    const data = {
      ...(title       !== undefined ? { title }       : {}),
      ...(slug        !== undefined ? { slug }        : {}),
      ...(pageType    !== undefined ? { pageType }    : {}),
      ...(contentHtml !== undefined ? { contentHtml } : {}),
      ...(metaTitle   !== undefined ? { metaTitle }   : {}),
      ...(metaDescription !== undefined ? { metaDescription } : {}),
      // Spanish parallel columns — empty strings normalize to null so
      // emptying a field actually clears it.
      ...(titleEs           !== undefined ? { titleEs:           titleEs           || null } : {}),
      ...(contentEs         !== undefined ? { contentEs:         contentEs         || null } : {}),
      ...(metaTitleEs       !== undefined ? { metaTitleEs:       metaTitleEs       || null } : {}),
      ...(metaDescriptionEs !== undefined ? { metaDescriptionEs: metaDescriptionEs || null } : {}),
      updatedById: req.user?.id,
    }

    const page = await prisma.page.update({
      where: { id: req.params.id },
      data,
    })
    return res.status(200).json({ success: true, data: page })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const publishPage = async (req, res) => {
  try {
    const { publish = true } = req.body
    const page = await prisma.page.update({
      where: { id: req.params.id },
      data: { status: publish ? "published" : "draft", publishedAt: publish ? new Date() : null, updatedById: req.user?.id },
    })
    return res.status(200).json({ success: true, data: page })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const deletePage = async (req, res) => {
  try {
    await prisma.page.delete({ where: { id: req.params.id } })
    return res.status(200).json({ success: true, message: "Page deleted" })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { listPages, getPage, createPage, updatePage, publishPage, deletePage }
