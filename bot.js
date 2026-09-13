require('dotenv').config();
const { Bot } = require('grammy');
const { run } = require('@grammyjs/runner');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');
const p = require('./paymentHandlers');

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);

// 🛡️ BAN CHECK MIDDLEWARE: Ban user ko yahan par hi block kar dega bhai
bot.use(async (ctx, next) => {
    if (ctx.from) {
        const u = p.getDatabaseUserOnly(ctx.from.id);
        if (u && u.is_banned) {
            if (ctx.callbackQuery) return ctx.answerCallbackQuery({ text: "❌ Tumhe is bot se BAN kar diya gaya hai!", show_alert: true });
            return ctx.reply("❌ *Aapko is bot se BAN kar diya gaya hai!* Aap koi bhi features use nahi kar sakte.", { parse_mode: "Markdown" });
        }
    }
    await next();
});

bot.command("start", p.handleStartCommand);
bot.callbackQuery("back_to_menu", p.handleBackMenu);
bot.callbackQuery("check_balance", p.handleCheckBalance);
bot.callbackQuery("my_profile", p.handleMyProfile);
bot.callbackQuery("main_orders", p.handleMainOrders);
bot.callbackQuery("toggle_currency", p.handleToggleCurrency);

bot.callbackQuery("main_services", o.servicesMenu);
bot.callbackQuery("p_tg", o.tgMenu);
bot.callbackQuery("p_ig", o.igMenu);
bot.callbackQuery("p_fb", o.fbMenu);
bot.callbackQuery("p_yt", o.ytMenu);
bot.hears(/^\/\d+$/, o.handleSlashCode);
bot.callbackQuery(/^q_\d+_(.+)$/, o.handleQtyButtons);

bot.callbackQuery("main_add_funds", p.addFundsMenu);
bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, p.initPayMethod);
bot.callbackQuery("user_complete_pay_via_upi", p.handleUpiComplete);
bot.callbackQuery(/^usdtnet_(.+)$/, p.handleUsdtNetworkSelect); 
bot.callbackQuery("usdt_confirm_click", p.handleUsdtConfirmClick); 
bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)$/, p.handleAdminActions);
bot.callbackQuery(/^submit_utr_(.+)$/, p.handleSubmitUtrTrigger);

// 👑 SUPER ADMIN POWER COMMANDS REGISTERED BYHAI
bot.command("admin", p.handleAdminPanelCommand);
bot.command("addservice", p.handleAddServiceCommand);
bot.command("updateservice", p.handleUpdateServiceCommand);
bot.command("delservice", p.handleDelServiceCommand);
bot.command("ban", p.handleBanCommand);
bot.command("unban", p.handleUnbanCommand);
bot.command("addbalance", p.handleAddBalanceCommand);
bot.command("deductbalance", p.handleDeductBalanceCommand);
bot.command("checkuser", p.handleCheckUserCommand);

bot.on("message:text", p.handleCombinedTextMessages);

async function startBotEngine() {
    try {
        await bot.api.deleteWebhook({ drop_pending_updates: true });
        run(bot);
        console.log("HAPPY REACTION Perfect Combined Engine Active Now!");
    } catch (err) { setTimeout(startBotEngine, 5000); }
}
startBotEngine();
