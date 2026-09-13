require('dotenv').config();
const { Bot } = require('grammy');
const { run } = require('@grammyjs/runner');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');
const p = require('./paymentHandlers'); // Connection established bhai

if (!config.BOT_TOKEN) process.exit(1);

const bot = new Bot(config.BOT_TOKEN);

// Global Error Catch to prevent bot crashes
bot.catch((err) => {
    console.error(`Error caught by system:`, err);
});

// 🔐 STRICT ADMIN AUTH CHECK MIDDLEWARE
const isAdmin = async (ctx, next) => {
    const userId = ctx.from ? ctx.from.id : null;
    if (String(userId) !== String(config.ADMIN_ID)) {
        return ctx.reply("❌ **Access Denied!** Ye command sirf Bot Owner/Admin ke liye reserved hai. 😎");
    }
    await next();
};

// ==========================================
// 👑 ADMIN CONTROLS (Safe Wrappers Built)
// ==========================================
bot.command("addbal", isAdmin, async (ctx) => {
    if (p && typeof p.handleAdminAddBal === 'function') return p.handleAdminAddBal(ctx);
    ctx.reply("❌ Handler configuration error inside paymentHandlers.js");
});

bot.command("deductbal", isAdmin, async (ctx) => {
    if (p && typeof p.handleAdminDeductBal === 'function') return p.handleAdminDeductBal(ctx);
    ctx.reply("❌ Handler configuration error inside paymentHandlers.js");
});

bot.command("user", isAdmin, async (ctx) => {
    if (p && typeof p.handleAdminUserCheck === 'function') return p.handleAdminUserCheck(ctx);
    ctx.reply("❌ Handler configuration error inside paymentHandlers.js");
});

bot.command("broadcast", isAdmin, async (ctx) => {
    if (p && typeof p.handleAdminBroadcast === 'function') return p.handleAdminBroadcast(ctx);
    ctx.reply("❌ Handler configuration error inside paymentHandlers.js");
});

bot.command("ban", isAdmin, async (ctx) => {
    if (p && typeof p.handleAdminBan === 'function') return p.handleAdminBan(ctx);
    ctx.reply("❌ Handler configuration error inside paymentHandlers.js");
});

bot.command("unban", isAdmin, async (ctx) => {
    if (p && typeof p.handleAdminUnban === 'function') return p.handleAdminUnban(ctx);
    ctx.reply("❌ Handler configuration error inside paymentHandlers.js");
});

// Service Management Redirection
bot.command("addservice", isAdmin, async (ctx) => { 
    if (o && typeof o.handleTextMessages === 'function') return o.handleTextMessages(ctx);
});
bot.command("updateservice", isAdmin, async (ctx) => { 
    if (o && typeof o.handleTextMessages === 'function') return o.handleTextMessages(ctx);
});
bot.command("delservice", isAdmin, async (ctx) => { 
    if (o && typeof o.handleTextMessages === 'function') return o.handleTextMessages(ctx);
});

// ==========================================
// 🌟 USER CORE COMMANDS & INTERFACE (Protected Wrappers)
// ==========================================
bot.command("start", async (ctx) => {
    if (p && typeof p.handleStartCommand === 'function') return p.handleStartCommand(ctx);
});
bot.callbackQuery("back_to_menu", async (ctx) => {
    if (p && typeof p.handleBackMenu === 'function') return p.handleBackMenu(ctx);
});
bot.callbackQuery("check_balance", async (ctx) => {
    if (p && typeof p.handleCheckBalance === 'function') return p.handleCheckBalance(ctx);
});
bot.callbackQuery("my_profile", async (ctx) => {
    if (p && typeof p.handleMyProfile === 'function') return p.handleMyProfile(ctx);
});
bot.callbackQuery("main_orders", async (ctx) => {
    if (p && typeof p.handleMainOrders === 'function') return p.handleMainOrders(ctx);
});
bot.callbackQuery("toggle_currency", async (ctx) => {
    if (p && typeof p.handleToggleCurrency === 'function') return p.handleToggleCurrency(ctx);
});

// ==========================================
// 🛒 SMM PANEL & SERVICE MENU ROUTING (Protected Wrappers)
// ==========================================
bot.callbackQuery("main_services", async (ctx) => {
    if (o && typeof o.servicesMenu === 'function') return o.servicesMenu(ctx);
});
bot.callbackQuery("p_tg", async (ctx) => {
    if (o && typeof o.tgMenu === 'function') return o.tgMenu(ctx);
});
bot.callbackQuery("p_ig", async (ctx) => {
    if (o && typeof o.igMenu === 'function') return o.igMenu(ctx);
});
bot.callbackQuery("p_fb", async (ctx) => {
    if (o && typeof o.fbMenu === 'function') return o.fbMenu(ctx);
});
bot.callbackQuery("p_yt", async (ctx) => {
    if (o && typeof o.ytMenu === 'function') return o.ytMenu(ctx);
});
bot.hears(/^\/\d+$/, async (ctx) => {
    if (o && typeof o.handleSlashCode === 'function') return o.handleSlashCode(ctx);
});
bot.callbackQuery(/^q_\d+_(.+)$/, async (ctx) => {
    if (o && typeof o.handleQtyButtons === 'function') return o.handleQtyButtons(ctx);
});

// ==========================================
// 💳 ADD FUND & GATEWAY FLOWS (Protected Wrappers)
// ==========================================
bot.callbackQuery("main_add_funds", async (ctx) => {
    if (p && typeof p.addFundsMenu === 'function') return p.addFundsMenu(ctx);
});
bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, async (ctx) => {
    if (p && typeof p.initPayMethod === 'function') return p.initPayMethod(ctx);
});
bot.callbackQuery("user_complete_pay_via_upi", async (ctx) => {
    if (p && typeof p.handleUpiComplete === 'function') return p.handleUpiComplete(ctx);
});
bot.callbackQuery(/^usdtnet_(.+)$/, async (ctx) => {
    if (p && typeof p.handleUsdtNetworkSelect === 'function') return p.handleUsdtNetworkSelect(ctx);
});
bot.callbackQuery("usdt_confirm_click", async (ctx) => {
    if (p && typeof p.handleUsdtConfirmClick === 'function') return p.handleUsdtConfirmClick(ctx);
});

// ==========================================
// 📲 CALLBACKS & TEXT MESSAGES ENGINE
// ==========================================
bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)$/, async (ctx) => {
    if (p && typeof p.handleAdminActions === 'function') return p.handleAdminActions(ctx);
});
bot.on("message:text", async (ctx) => {
    if (p && typeof p.handleCombinedTextMessages === 'function') return p.handleCombinedTextMessages(ctx);
});

// ==========================================
// 🚀 RUNNER ENGINE ACTIVATION
// ==========================================
async function startBotEngine() {
    try {
        await bot.api.deleteWebhook({ drop_pending_updates: true });
        run(bot);
        console.log("HAPPY REACTION Perfect Combined Engine Active Now!");
    } catch (err) { 
        setTimeout(startBotEngine, 5000); 
    }
}

startBotEngine();
