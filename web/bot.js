require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is missing in .env");
}

const bot = new Telegraf(token);

// /start command
bot.start((ctx) => {
  return ctx.reply(
    "Welcome. Choose an option:",
    Markup.keyboard([
      ["Help", "Services"],
      ["Contact", "Website"],
    ]).resize()
  );
});

// /menu command
bot.command("menu", (ctx) => {
  return ctx.reply(
    "Open one of these options:",
    Markup.inlineKeyboard([
      [Markup.button.callback("Help", "help_action")],
      [Markup.button.callback("Services", "services_action")],
      [Markup.button.url("Visit Website", "https://mustaphaukizuru.com")],
    ])
  );
});

// text buttons from reply keyboard
bot.hears("Help", (ctx) => ctx.reply("Tell me what you need help with."));
bot.hears("Services", (ctx) => ctx.reply("We offer digital products, consulting, training, and web solutions."));
bot.hears("Contact", (ctx) => ctx.reply("Send your question here and I will guide you."));
bot.hears("Website", (ctx) => ctx.reply("Website: https://mustaphaukizuru.com"));

// inline button actions
bot.action("help_action", async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.reply("Help section selected.");
});

bot.action("services_action", async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.reply("Services section selected.");
});

// fallback text message
bot.on("text", (ctx) => {
  return ctx.reply(`You said: ${ctx.message.text}`);
});

// launch bot
bot.launch()
  .then(() => {
    console.log("Telegram bot is running");
  })
  .catch((error) => {
    console.error("Failed to start bot:", error);
  });

// graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));