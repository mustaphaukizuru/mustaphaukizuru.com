// ─────────────────────────────────────────────────────────────────────────────
// Lightweight request validation middleware
// ─────────────────────────────────────────────────────────────────────────────

function validateFields(rules) {
  return (req, res, next) => {
    const errors = []
    for (const [field, rule] of Object.entries(rules)) {
      const val = req.body[field]
      if (rule.required && (val === undefined || val === null || val === "")) {
        errors.push(`${field} is required`)
        continue
      }
      if (val !== undefined && val !== null && val !== "") {
        const str = String(val)
        if (rule.min && str.length < rule.min) {
          errors.push(`${field} must be at least ${rule.min} characters`)
        }
        if (rule.max && str.length > rule.max) {
          errors.push(`${field} must not exceed ${rule.max} characters`)
        }
        if (rule.pattern && !rule.pattern.test(str)) {
          errors.push(`${field} has an invalid format`)
        }
      }
    }
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors[0], errors })
    }
    next()
  }
}

module.exports = { validateFields }
