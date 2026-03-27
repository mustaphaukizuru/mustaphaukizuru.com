import crypto from "crypto";
import bcrypt from "bcryptjs";
import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.json({ message: "If the email exists, a reset link has been sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const expiry = new Date(Date.now() + 1000 * 60 * 60);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: expiry,
      },
    });

    const resetLink = `http://localhost:5173/reset-password/${token}`;

    console.log("RESET LINK:", resetLink);

    res.json({
      message: "Password reset link generated.",
      resetLink,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to generate reset link." });
  }
});