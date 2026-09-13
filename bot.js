require('dotenv').config();
const { Bot } = require('grammy');
const { run } = require('@grammyjs/runner');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');
const p = require('./paymentHandlers'); // Connection established bhai

if (!config.BOT_TOKEN) process.exit(1);

const bot = new Bot(config.BOT_TOKEN);

// 🔐 STRICT ADMIN AUTH CHECK MIDDLEWARE (Fixed to match grammY standards)
const isAdmin = async (ctx, next) => {
    const userId = ctx.from ? ctx.from.id : null;
    if (String(userId) !== String(config.ADMIN_ID)) {
        return ctx.reply("❌ **Access Denied!** Ye command sirf Bot Owner/Admin ke liye reserved hai. 😎");
    }
    await next();
};

// ==========================================
// 👑 ADMIN CONTROLS (Direct Routes to ensure zero middleware errors)
// ==========================================
bot.command("addbal", isAdmin, async (ctx) => {
    if (typeof p.handleAdminAddBal === 'function') {
        return p.handleAdminAddBal(ctx);
    }
    ctx.reply("❌ Handler configuration error inside paymentHandlers.js");
});

bot.command("deductbal", isAdmin, async (ctx) => {
    if (typeof p.handleAdminDeductBal === 'function') {
        return p.handleAdminDeductBal(ctx);
    }
    ctx.reply("❌ Handler configuration error inside paymentHandlers.js");
});

bot.command("user", isAdmin, async (ctx) => {
    if (typeof p.handleAdminUserCheck === 'function') {
        return p.handleAdminUserCheck(ctx);
    }
    ctx.reply("❌ Handler configuration error inside paymentHandlers.js");
});

bot.command("broadcast", isAdmin, async (ctx) => {
    if (typeof p.handleAdminBroadcast === 'function') {
        return p.handleAdminBroadcast(ctx);
    }
    ctx.reply("❌ Handler configuration error inside paymentHandlers.js");
});

bot.command("ban", isAdmin, async (ctx) => {
    if (typeof p.handleAdminBan === 'function') {
        return p.handleAdminBan(ctx);
    }
    ctx.reply("❌ Handler configuration error inside paymentHandlers.js");
});

bot.command("unban", isAdmin, async (ctx) => {
    if (typeof p.handleAdminUnban === 'function') {
        return p.handleAdminUnban(ctx);
    }
    ctx.reply("❌ Handler configuration error inside paymentHandlers.js");
});

// Service Management Redirection
bot.command("addservice", isAdmin, async (ctx) => { 
    if (typeof o.handleTextMessages === 'function') return o.handleTextMessages(ctx);
});
bot.command("updateservice", isAdmin, async (ctx) => { 
    if (typeof o.handleTextMessages === 'function') return o.handleTextMessages(ctx);
});
bot.command("delservice", isAdmin, async (ctx) => { 
    if (typeof o.handleTextMessages === 'function') return o.handleTextMessages(ctx);
});

// ==========================================
// 🌟 USER CORE COMMANDS & INTERFACE
// ==========================================
bot.command("start", p.handleStartCommand);
bot.callbackQuery("back_to_menu", p.handleBackMenu);
bot.callbackQuery("check_balance", p.handleCheckBalance);
bot.callbackQuery("my_profile", p.handleMyProfile);
bot.callbackQuery("main_orders", p.handleMainOrders);
bot.callbackQuery("toggle_currency", p.handleToggleCurrency);

// ==========================================
// 🛒 SMM PANEL & SERVICE MENU ROUTING
// ==========================================
bot.callbackQuery("main_services", o.servicesMenu);
bot.callbackQuery("p_tg", o.tgMenu);
bot.callbackQuery("p_ig", o.igMenu);
bot.callbackQuery("p_fb", o.fbMenu);
bot.callbackQuery("p_yt", o.ytMenu);
bot.hears(/^\/\d+$/, o.handleSlashCode);
bot.callbackQuery(/^q_\d+_(.+)$/, o.handleQtyButtons);

// ==========================================
// 💳 ADD FUND & GATEWAY FLOWS
// ==========================================
bot.callbackQuery("main_add_funds", p.addFundsMenu);
bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, p.initPayMethod);
bot.callbackQuery("user_complete_pay_via_upi", p.handleUpiComplete);
bot.callbackQuery(/^usdtnet_(.+)$/, p.handleUsdtNetworkSelect);
bot.callbackQuery("usdt_confirm_click", p.handleUsdtConfirmClick);

// ==========================================
// 📲 CALLBACKS & TEXT MESSAGES ENGINE
// ==========================================
bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)$/, p.handleAdminActions);
bot.on("message:text", p.handleCombinedTextMessages);

// Global Error Catch to prevent bot crashes
bot.catch((err) => {
    console.error(`Error caught by system: ${err.message}`);
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
