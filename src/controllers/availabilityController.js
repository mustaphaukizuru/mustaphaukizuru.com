// ─────────────────────────────────────────────────────────────────────────────
// availabilityController.js — public read endpoints for the booking calendar
// ─────────────────────────────────────────────────────────────────────────────

const asyncHandler = require("../utils/asyncHandler")
const {
  getAvailableSlots,
  getAvailableDaysInMonth,
} = require("../services/availabilityService")

// GET /api/v1/availability/slots?serviceId=&date=YYYY-MM-DD&timezone=
const listSlots = asyncHandler(async (req, res) => {
  const { serviceId, date, timezone } = req.query

  if (!date || !timezone) {
    return res.status(400).json({
      success: false,
      code:    "BAD_REQUEST",
      message: "date (YYYY-MM-DD) and timezone are required",
    })
  }

  const slots = await getAvailableSlots({
    serviceId:        serviceId || null,
    dateLocal:        date,
    displayTimezone:  timezone,
  })

  return res.status(200).json({ success: true, data: slots })
})

// GET /api/v1/availability/days?serviceId=&year=YYYY&month=M&timezone=
const listDays = asyncHandler(async (req, res) => {
  const { serviceId, year, month, timezone } = req.query

  if (!year || !month || !timezone) {
    return res.status(400).json({
      success: false,
      code:    "BAD_REQUEST",
      message: "year, month, and timezone are required",
    })
  }

  const days = await getAvailableDaysInMonth({
    serviceId:        serviceId || null,
    year:             Number(year),
    month:            Number(month),
    displayTimezone:  timezone,
  })

  return res.status(200).json({ success: true, data: days })
})

module.exports = { listSlots, listDays }
