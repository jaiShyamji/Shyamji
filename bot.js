require('dotenv').config();
const { Bot } = require('grammy');
const { run } = require('@grammyjs/runner');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');
const p = require('./paymentEngine'); // Naya super engine linked bhai

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);

bot.command("start", m.start);
bot.callbackQuery("back_to_menu", m.backMenu);
bot.callbackQuery("check_balance", m.checkBalance);
bot.callbackQuery("my_profile", m.myProfile);
bot.callbackQuery("my_channels", m.myChannels);
bot.callbackQuery("main_promo", m.mainPromo);
bot.callbackQuery("main_support", m.mainSupport);
bot.callbackQuery("toggle_currency", m.toggleCurrency);

bot.callbackQuery("main_services", o.servicesMenu);
bot.callbackQuery("p_tg", o.tgMenu);
bot.callbackQuery("p_ig", o.igMenu);
bot.callbackQuery("p_fb", o.fbMenu);
bot.callbackQuery("p_yt", o.ytMenu);
bot.hears(/^\/\d+$/, o.handleSlashCode);
bot.callbackQuery(/^q_\d+_(.+)$/, o.handleQtyButtons);

bot.callbackQuery("main_add_funds", p.addFundsMenu);
bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, p.initPayMethod);
bot.callbackQuery(/^user_complete_pay_(.+)$/, p.handlePaymentComplete);
bot.callbackQuery(/^usdtnet_(.+)$/, p.handleUsdtNetworkSelect); 
bot.callbackQuery("usdt_confirm_click", p.handleUsdtConfirmClick); 
bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)$/, p.handleAdminActions);
bot.callbackQuery(/^submit_utr_(.+)$/, p.handleSubmitUtrTrigger);

bot.command("admin", p.handleAdminPanelCommand);
bot.command("addservice", p.handleAddServiceCommand);
bot.command("updateservice", p.handleUpdateServiceCommand);
bot.command("delservice", p.handleDelServiceCommand);
bot.on("message:text", p.handleCombinedTextMessages);

async function startBotEngine() {
    try {
        await bot.api.deleteWebhook({ drop_pending_updates: true });
        run(bot);
        console.log("HAPPY REACTION Perfect Combined Engine Active Now!");
    } catch (err) { setTimeout(startBotEngine, 5000); }
}
startBotEngine();
