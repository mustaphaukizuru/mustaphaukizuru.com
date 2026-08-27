/**
 * /api/v1/portal · Tier 4 magic-link + PIN client portal (no login).
 *
 * Public:  GET  /:token             link probe (project name only)
 *          POST /:token/pin         email a PIN      (5 / 15 min / IP)
 *          POST /:token/verify      PIN → mu_portal  (10 / 15 min / IP)
 *          POST /logout             clear the cookie
 * Cookie:  GET  /me/project         read-only project (portalAuth)
 *          GET  /me/files/:fileId/download
 *
 * `/me` is declared before `/:token` so it can never be read as a token.
 */
const express = require("express")
const c = require("../controllers/portalController")
const { portalAuth } = require("../middleware/portalAuth")
const { portalPinRateLimiter, portalVerifyRateLimiter } = require("../middleware/rateLimiter")

const router = express.Router()

router.get ("/me/project",                 portalAuth, c.getProject)
router.get ("/me/files/:fileId/download",  portalAuth, c.downloadFile)
router.post("/logout",                     c.logout)

router.get ("/:token",                     c.probe)
router.post("/:token/pin",                 portalPinRateLimiter, c.sendPin)
router.post("/:token/verify",              portalVerifyRateLimiter, c.verify)

module.exports = router
