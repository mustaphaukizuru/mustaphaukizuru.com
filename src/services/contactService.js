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
  return prisma.newsletterSubscriber.upsert({
    where: { email },
    update: {},
    create: { email },
  });
}

module.exports = {
  createContactMessage,
  subscribeNewsletter,
};