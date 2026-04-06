const prisma = require("../lib/prisma");

async function createContactMessage(payload) {
  return prisma.contactMessage.create({
    data: {
      name: payload.name,
      email: payload.email,
      subject: payload.subject || null,
      message: payload.message,
    },
  });
}

async function subscribeNewsletter(email) {
  // Handle re-subscribes: if previously unsubscribed, re-activate
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } })

  if (existing) {
    if (existing.status === "unsubscribed") {
      return prisma.newsletterSubscriber.update({
        where: { email },
        data: { status: "subscribed", subscribedAt: new Date(), unsubscribedAt: null },
      })
    }
    // Already subscribed
    return existing
  }

  return prisma.newsletterSubscriber.create({
    data: { email, status: "subscribed" },
  })
}

async function unsubscribeNewsletter(email) {
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } })
  if (!existing) return null

  return prisma.newsletterSubscriber.update({
    where: { email },
    data: { status: "unsubscribed", unsubscribedAt: new Date() },
  })
}

module.exports = {
  createContactMessage,
  subscribeNewsletter,
  unsubscribeNewsletter,
};