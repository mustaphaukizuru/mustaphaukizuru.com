const asyncHandler = require("../utils/asyncHandler");
const { sendContactFormEmail } = require("../utils/mailer");
const {
  createContactMessage,
  subscribeNewsletter,
} = require("../services/contactService");

const sendContactMessage = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      message: "name, email, and message are required",
    });
  }

  const result = await createContactMessage({ name, email, subject, message });

  res.status(201).json({
    success: true,
    message: "Contact message saved successfully",
    data: result,
  });
});

const addNewsletterSubscriber = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "email is required",
    });
  }

  const result = await subscribeNewsletter(email);

  res.status(201).json({
    success: true,
    message: "Subscribed successfully",
    data: result,
  });
});

module.exports = {
  sendContactMessage,
  addNewsletterSubscriber,
};