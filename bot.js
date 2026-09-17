require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const { run } = require('@grammyjs/runner');
const fs = require('fs');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');
let SERVICES_MASTER_DATA = require('./services');

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);

const DB_FILE = './database.json';
let DYNAMIC_USER_DB = { users: {}, pending_deposits: {}, dynamic_config: {} };
if (fs.existsSync(DB_FILE)) {
    try { const p = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); if (p.users) DYNAMIC_USER_DB = p; else DYNAMIC_USER_DB = { users: p, pending_deposits: {}, dynamic_config: {} }; } catch (e) { DYNAMIC_USER_DB = { users: {}, pending_deposits: {}, dynamic_config: {} }; }
}
if (!DYNAMIC_USER_DB.dynamic_config) DYNAMIC_USER_DB.dynamic_config = {};

const forceSaveDatabase = () => fs.writeFileSync(DB_FILE, JSON.stringify(DYNAMIC_USER_DB, null, 4), 'utf-8');
const getLiveUpi = () => DYNAMIC_USER_DB.dynamic_config.upi_id || config.UPI_ID;
const getLiveTrc = () => DYNAMIC_USER_DB.dynamic_config.usdt_trc20 || config.USDT_TRC20;
const getLiveBep = () => DYNAMIC_USER_DB.dynamic_config.usdt_bep20 || config.USDT_BEP20;

function getLocalUser(id, name = "User") {
    if (!DYNAMIC_USER_DB.users[id]) { DYNAMIC_USER_DB.users[id] = { username: name, balance_usd: 0.0, total_deposit_usd: 0.0, spent_usd: 0.0, orders_count: 0, cancelled_orders: 0, pending_orders: 0, history: [], currency: "INR", pending_service: null, pending_qty: null, pending_cost_usd: null, awaiting_custom_qty: false, awaiting_deposit_amt: false, chosen_pay_method: null, awaiting_utr: false, current_deposit_amt: 0, current_order_num: 0, chosen_network: "", is_banned: false }; forceSaveDatabase(); }
    return DYNAMIC_USER_DB.users[id];
}
const formatMoneyLocal = (usd, pref) => pref === "INR" ? `₹${(usd * config.USD_TO_INR_RATE).toFixed(2)}` : `$${usd.toFixed(2)}`;

bot.use(async (ctx, next) => {
    if (ctx.from && DYNAMIC_USER_DB.users[ctx.from.id]?.is_banned) {
        if (ctx.callbackQuery) return ctx.answerCallbackQuery({ text: "🛑 Aapko BAN kiya gaya hai!", show_alert: true });
        return ctx.reply("❌ *Aapko is bot se BAN kar diya gaya hai!*");
    } await next();
});

// Basic menus callbacks registration bhai
bot.command("start", m.start); bot.callbackQuery("back_to_menu", m.backMenu); bot.callbackQuery("check_balance", m.checkBalance); bot.callbackQuery("my_profile", m.myProfile); bot.callbackQuery("my_channels", m.myChannels); bot.callbackQuery("main_promo", m.mainPromo); bot.callbackQuery("main_support", m.mainSupport); bot.callbackQuery("toggle_currency", m.toggleCurrency); bot.callbackQuery("main_services", o.servicesMenu); bot.callbackQuery("p_tg", o.tgMenu); bot.callbackQuery("p_ig", o.igMenu); bot.callbackQuery("p_fb", o.fbMenu); bot.callbackQuery("p_yt", o.ytMenu); bot.hears(/^\/\d+$/, o.handleSlashCode); bot.callbackQuery(/^q_\d+_(.+)$/, o.handleQtyButtons); bot.callbackQuery("main_orders", o.ordersHistory);

bot.callbackQuery("main_add_funds", async (ctx) => {
    await ctx.editMessageText("?. *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: new InlineKeyboard().text("Payment via UPI", "pay_via_upi").text("Payment via USDT", "pay_via_usdt").row().text("BACK", "back_to_menu"), parse_mode: "Markdown" });
});
bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, async (ctx) => {
    const u = getLocalUser(ctx.from.id); u.chosen_pay_method = ctx.callbackQuery.data; u.awaiting_deposit_amt = true;
    await ctx.editMessageText(u.chosen_pay_method === "pay_via_upi" ? `💰 *Enter Amount:* UPI\n\nकृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (INR ₹) you want to add:` : `💰 *Enter Amount:* USDT\n\nकृपया वह राशि (USDT) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (USDT) you want to add:`);
});
bot.callbackQuery("user_complete_pay_via_upi", async (ctx) => {
    const u = getLocalUser(ctx.from.id); u.awaiting_utr = true; u.current_order_num = Math.floor(100000 + Math.random() * 900000);
    await ctx.editMessageText("💵 *Payment Initiated!* ✅\n\n📊 *Expected Amount:* `₹" + u.current_deposit_amt.toFixed(2) + "`\n🆔 *Order Number:* `# " + u.current_order_num + "`\n\n**⚠️ SUBMIT UTR TRANSACTION ID:**\nBhai, ab apna 12-digit UTR/Reference number niche message box mein type karke send karo aur sath mein payment ka screenshot bhi attach karke bhejo:", { parse_mode: "Markdown" });
});
bot.callbackQuery("usdtnet_bep20", async (ctx) => {
    const u = getLocalUser(ctx.from.id); u.chosen_network = "bep20";
    await ctx.editMessageText("🪙 *USDT BEP20 MANUAL DEPOSIT*\n\n💵 *Amount to Pay:* $" + u.current_deposit_amt.toFixed(2) + "\n📍 *Address:* `" + getLiveBep() + "`\n\n👉 *Instructions:* Diye gaye Address par exactly $" + u.current_deposit_amt.toFixed(2) + " send karke neeche *CONFIRM PAYMENT* par click karein.", { reply_markup: new InlineKeyboard().text("CONFIRM PAYMENT", "usdt_confirm_click").row().text("BACK", "main_add_funds"), parse_mode: "Markdown" });
});
bot.callbackQuery("usdtnet_trc20", async (ctx) => {
    const u = getLocalUser(ctx.from.id); u.chosen_network = "trc20";
    await ctx.editMessageText("🪙 *USDT TRC20 MANUAL DEPOSIT*\n\n💵 *Amount to Pay:* $" + u.current_deposit_amt.toFixed(2) + "\n📍 *Address:* `" + getLiveTrc() + "`\n\n👉 *Instructions:* Diye gaye Address par exactly $" + u.current_deposit_amt.toFixed(2) + " send karke neeche *CONFIRM PAYMENT* par click karein.", { reply_markup: new InlineKeyboard().text("CONFIRM PAYMENT", "usdt_confirm_click").row().text("BACK", "main_add_funds"), parse_mode: "Markdown" });
});
bot.callbackQuery("usdt_confirm_click", async (ctx) => {
    const u = getLocalUser(ctx.from.id); u.awaiting_utr = true; u.current_order_num = Math.floor(100000 + Math.random() * 900000);
    await ctx.editMessageText("🪙 *USDT Deposit Initiated!* ✅\n\n📊 *Requested Amount:* `$" + u.current_deposit_amt.toFixed(2) + "`\n🌐 *Network:* `" + u.chosen_network.toUpperCase() + "`\n🆔 *Order Number:* `# " + u.current_order_num + "`\n\n**⚠️ SUBMIT TRANSACTION ID / HASH:**\nBhai, apni USDT Transaction Hash ID niche message box mein type karke send karo:", { parse_mode: "Markdown" });
});

// 👑 100% FIXED SHARED-MEMORY UNIFIED APPROVAL ENGINE
bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)$/, async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const parts = ctx.callbackQuery.data.split("_"), action = parts, userId = parseInt(parts), refKey = parts;
    const d = DYNAMIC_USER_DB.pending_deposits[refKey]; if (!d) return ctx.answerCallbackQuery({ text: "❌ Link Expired!", show_alert: true });
    const u = getLocalUser(userId);
    if (action === "acc") {
        u.balance_usd += d.amount_usd; u.total_deposit_usd += d.amount_usd; forceSaveDatabase();
        await bot.api.sendMessage(userId, `?. *Payment Added Successful!* ?. \n\nBhai tumhara payment verify ho gaya hai.\n?. *Added Amount:* ${formatMoneyLocal(d.amount_usd, u.currency)}\n?. *Total Balance:* ${formatMoneyLocal(u.balance_usd, u.currency)}`, { parse_mode: "Markdown" });
        await ctx.editMessageText(`?. Request Accepted for User ${userId}`);
    } else { await bot.api.sendMessage(userId, `?. *Payment Request Cancelled!*`); await ctx.editMessageText(`?. Cancelled for User ${userId}`); }
    delete DYNAMIC_USER_DB.pending_deposits[refKey]; forceSaveDatabase();
});

// 👑 HIGH PRIORITY SUPER ADMIN POWERS CONTROLS INTERCEPTORS
bot.command("admin", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    await ctx.reply(`?. *HAPPY REACTION Super Admin Control Panel*\n\n` +
        `?. *User Matrix Controls:*\n▫️ \`/ban USER_ID\` \n▫️ \`/unban USER_ID\` \n▫️ \`/addbalance USER_ID AMOUNT\` \n▫️ \`/deductbalance USER_ID AMOUNT\` \n▫️ \`/checkuser USER_ID\`\n\n` +
        `?. *SMM Live Controls:*\n▫️ \`/addservice ID Rate Type Name\`\n▫️ \`/updateservice ID NewRate\`\n▫️ \`/delservice ID\`\n\n` +
        `?. *Payment Credentials Controls:*\n▫️ \`/setupi NEW_UPI_ID\` \n▫️ \`/settrc20 WALLET_ADDRESS\` \n▫️ \`/setbep20 WALLET_ADDRESS\``, { parse_mode: "Markdown" });
});
bot.command("ban", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const target = parseInt(ctx.message.text.split(" ")); if (isNaN(target) || !DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ ID nahi mili!");
    DYNAMIC_USER_DB.users[target].is_banned = true; forceSaveDatabase(); await ctx.reply(`🚫 User \`${target}\` BAN ho gaya hai.`);
});
bot.command("unban", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const target = parseInt(ctx.message.text.split(" ")); if (isNaN(target) || !DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ ID nahi mili!");
    DYNAMIC_USER_DB.users[target].is_banned = false; forceSaveDatabase(); await ctx.reply(`✅ User \`${target}\` UNBAN ho gaya hai.`);
});
bot.command("addbalance", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" "), target = parseInt(args), amt = parseFloat(args);
    if (isNaN(target) || isNaN(amt) || !DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Format: \`/addbalance USER_ID AMOUNT\`");
    DYNAMIC_USER_DB.users[target].balance_usd += amt; forceSaveDatabase(); await ctx.reply("💰 *Successfully Added $*" + amt.toFixed(2) + " *to User:* `" + target + "`");
    try { await bot.api.sendMessage(target, "✨ *Admin dwara tumhare account mein $*" + amt.toFixed(2) + " *add kar diye gaye hain!*"); } catch(e) {}
});
bot.command("deductbalance", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" "), target = parseInt(args), amt = parseFloat(args);
    if (isNaN(target) || isNaN(amt) || !DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Format: \`/deductbalance USER_ID AMOUNT\`");
