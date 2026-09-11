require('dotenv').config();
const { Bot } = require('grammy');
const config = require('./config');
const h = require('./handlers');

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);

bot.command("start", h.start);
bot.callbackQuery("back_to_menu", h.backMenu);
bot.callbackQuery("main_services", h.servicesMenu);
bot.callbackQuery("p_tg", h.tgMenu);
bot.callbackQuery("p_ig", h.igMenu);
bot.callbackQuery("p_fb", h.fbMenu);
bot.callbackQuery("p_yt", h.ytMenu);
bot.hears(/^\/\d+$/, h.handleSlashCode);
bot.callbackQuery(/^q_\d+_(.+)$/, h.handleQtyButtons);
bot.callbackQuery("main_add_funds", h.addFundsMenu);
bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, h.initPayMethod);
bot.callbackQuery("p_done", h.payDone);
bot.callbackQuery("main_orders", h.ordersHistory);
bot.callbackQuery("toggle_currency", h.toggleCurrency);
bot.on("message:text", h.handleTextMessages);

bot.start();
console.log("Super Clean System Active!");
