const prisma = require("../lib/prisma")

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
    const { title, slug, pageType = "public", contentHtml, metaTitle, metaDescription } = req.body
    if (!title || !slug) return res.status(400).json({ success: false, message: "title and slug required" })

    const page = await prisma.page.create({
      data: { title, slug, pageType, contentHtml, metaTitle, metaDescription, createdById: req.user?.id, updatedById: req.user?.id },
    })
    return res.status(201).json({ success: true, data: page })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const updatePage = async (req, res) => {
  try {
    const { title, slug, pageType, contentHtml, metaTitle, metaDescription } = req.body
    const page = await prisma.page.update({
      where: { id: req.params.id },
      data: { title, slug, pageType, contentHtml, metaTitle, metaDescription, updatedById: req.user?.id },
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
