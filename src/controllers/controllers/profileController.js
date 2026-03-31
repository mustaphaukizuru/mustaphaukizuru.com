const prisma = require("../lib/prisma")
const path   = require("path")
const fs     = require("fs")

// GET /api/member/profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user?.id
    const user   = await prisma.user.findUnique({
      where: { id: userId },
      select: { id:true, fullName:true, email:true, role:true, phone:true, company:true, avatarUrl:true, createdAt:true },
    })
    const profile = await prisma.userProfile.findUnique({ where: { userId } }).catch(() => null)
    return res.status(200).json({ success: true, data: { ...user, profile } })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

// PATCH /api/member/profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id
    const { fullName, phone, company } = req.body
    const data = {}
    if (fullName !== undefined) data.fullName = fullName
    if (phone    !== undefined) data.phone    = phone
    if (company  !== undefined) data.company  = company

    const user = await prisma.user.update({ where: { id: userId }, data, select: { id:true, fullName:true, email:true, phone:true, company:true, avatarUrl:true } })
    return res.status(200).json({ success: true, data: user })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

// POST /api/member/profile/avatar
const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user?.id
    const file   = req.file
    if (!file) return res.status(400).json({ success: false, message: "No image uploaded" })

    const avatarUrl = `/images/avatars/${file.filename}`

    // Delete old avatar if exists
    const current = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } })
    if (current?.avatarUrl) {
      const oldPath = path.join(__dirname, "../../public", current.avatarUrl)
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    }

    const user = await prisma.user.update({ where: { id: userId }, data: { avatarUrl }, select: { id:true, avatarUrl:true, fullName:true } })
    return res.status(200).json({ success: true, data: user })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

// DELETE /api/member/profile/avatar
const deleteAvatar = async (req, res) => {
  try {
    const userId = req.user?.id
    const current = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } })
    if (current?.avatarUrl) {
      const oldPath = path.join(__dirname, "../../public", current.avatarUrl)
      if (fs.existsSync(oldPath)) try { fs.unlinkSync(oldPath) } catch {}
    }
    await prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } })
    return res.status(200).json({ success: true, message: "Avatar removed" })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

// PATCH /api/member/profile/password
const changePassword = async (req, res) => {
  try {
    const bcrypt = require("bcryptjs")
    const userId = req.user?.id
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: "Both passwords required" })
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: "New password must be at least 6 characters" })

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } })
    const isMatch = await bcrypt.compare(currentPassword, user?.passwordHash || "")
    if (!isMatch) return res.status(401).json({ success: false, message: "Current password is incorrect" })

    const hash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } })
    return res.status(200).json({ success: true, message: "Password changed successfully" })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { getProfile, updateProfile, uploadAvatar, deleteAvatar, changePassword }
