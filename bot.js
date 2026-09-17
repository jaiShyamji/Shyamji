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
    try {
        const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
        if (parsed.users && parsed.pending_deposits) DYNAMIC_USER_DB = parsed;
        else DYNAMIC_USER_DB = { users: parsed, pending_deposits: {}, dynamic_config: {} };
    } catch (e) { DYNAMIC_USER_DB = { users: {}, pending_deposits: {}, dynamic_config: {} }; }
}
if (!DYNAMIC_USER_DB.dynamic_config) DYNAMIC_USER_DB.dynamic_config = {};

function forceSaveDatabase() { fs.writeFileSync(DB_FILE, JSON.stringify(DYNAMIC_USER_DB, null, 4), 'utf-8'); }
function getLiveUpi() { return DYNAMIC_USER_DB.dynamic_config.upi_id || config.UPI_ID; }
function getLiveTrc() { return DYNAMIC_USER_DB.dynamic_config.usdt_trc20 || config.USDT_TRC20; }
function getLiveBep() { return DYNAMIC_USER_DB.dynamic_config.usdt_bep20 || config.USDT_BEP20; }

function getLocalUser(id, name = "User") {
    if (!DYNAMIC_USER_DB.users[id]) {
        DYNAMIC_USER_DB.users[id] = { username: name, balance_usd: 0.0, total_deposit_usd: 0.0, spent_usd: 0.0, orders_count: 0, cancelled_orders: 0, pending_orders: 0, history: [], currency: "INR", pending_service: null, pending_qty: null, pending_cost_usd: null, awaiting_custom_qty: false, awaiting_deposit_amt: false, chosen_pay_method: null, awaiting_utr: false, current_deposit_amt: 0, current_order_num: 0, chosen_network: "", is_banned: false }; forceSaveDatabase();
    } return DYNAMIC_USER_DB.users[id];
}
function formatMoneyLocal(usd, pref) { return pref === "INR" ? `₹${(usd * config.USD_TO_INR_RATE).toFixed(2)}` : `$${usd.toFixed(2)}`; }

bot.use(async (ctx, next) => {
    if (ctx.from && DYNAMIC_USER_DB.users[ctx.from.id]?.is_banned) {
        if (ctx.callbackQuery) return ctx.answerCallbackQuery({ text: "🛑 Aapko BAN kiya gaya hai!", show_alert: true });
        return ctx.reply("❌ *Aapko is bot se BAN kar diya gaya hai!*");
    } await next();
});

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
bot.callbackQuery("main_orders", o.ordersHistory);

bot.callbackQuery("main_add_funds", async (ctx) => {
    const kb = new InlineKeyboard().text("Payment via UPI", "pay_via_upi").text("Payment via USDT", "pay_via_usdt").row().text("BACK", "back_to_menu");
    await ctx.editMessageText("💳 *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: kb, parse_mode: "Markdown" });
});

bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, async (ctx) => {
    const u = getLocalUser(ctx.from.id); u.chosen_pay_method = ctx.callbackQuery.data; u.awaiting_deposit_amt = true;
    if (u.chosen_pay_method === "pay_via_upi") { await ctx.editMessageText(`💰 *Enter Amount:* UPI\n\n¼कृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (INR ₹) you want to add:`); }
    else { await ctx.editMessageText(`💰 *Enter Amount:* USDT\n\nकृपया वह राशि (USDT) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (USDT) you want to add:`); }
});

bot.callbackQuery("user_complete_pay_via_upi", async (ctx) => {
    const u = getLocalUser(ctx.from.id); u.awaiting_utr = true; const orderNum = Math.floor(100000 + Math.random() * 900000); u.current_order_num = orderNum;
    await ctx.editMessageText("💵 *Payment Initiated!* ✅\n\n📊 *Expected Amount:* `₹" + u.current_deposit_amt.toFixed(2) + "`\n🆔 *Order Number:* `# " + orderNum + "`\n\n**⚠️ SUBMIT UTR TRANSACTION ID:**\nBhai, ab apna 12-digit UTR/Reference number niche message box mein type karke send karo aur sath mein payment ka screenshot bhi attach karke bhejo:", { parse_mode: "Markdown" });
});

bot.callbackQuery("usdtnet_bep20", async (ctx) => {
    const u = getLocalUser(ctx.from.id); u.chosen_network = "bep20"; const kb = new InlineKeyboard().text("CONFIRM PAYMENT", "usdt_confirm_click").row().text("BACK", "main_add_funds");
    await ctx.editMessageText("🪙 *USDT BEP20 MANUAL DEPOSIT*\n\n💵 *Amount to Pay:* $" + u.current_deposit_amt.toFixed(2) + "\n📍 *Address:* `" + getLiveBep() + "`\n\n👉 *Instructions:* Diye gaye Address par exactly $" + u.current_deposit_amt.toFixed(2) + " send karke neeche *CONFIRM PAYMENT* par click karein.", { reply_markup: kb, parse_mode: "Markdown" });
});

bot.callbackQuery("usdtnet_trc20", async (ctx) => {
    const u = getLocalUser(ctx.from.id); u.chosen_network = "trc20"; const kb = new InlineKeyboard().text("CONFIRM PAYMENT", "usdt_confirm_click").row().text("BACK", "main_add_funds");
    await ctx.editMessageText("🪙 *USDT TRC20 MANUAL DEPOSIT*\n\n💵 *Amount to Pay:* $" + u.current_deposit_amt.toFixed(2) + "\n📍 *Address:* `" + getLiveTrc() + "`\n\n👉 *Instructions:* Diye gaye Address par exactly $" + u.current_deposit_amt.toFixed(2) + " send karke neeche *CONFIRM PAYMENT* par click karein.", { reply_markup: kb, parse_mode: "Markdown" });
});

bot.callbackQuery("usdt_confirm_click", async (ctx) => {
    const u = getLocalUser(ctx.from.id); u.awaiting_utr = true; const orderNum = Math.floor(100000 + Math.random() * 900000); u.current_order_num = orderNum;
    await ctx.editMessageText("🪙 *USDT Deposit Initiated!* ✅\n\n📊 *Requested Amount:* `$" + u.current_deposit_amt.toFixed(2) + "`\n🌐 *Network:* `" + u.chosen_network.toUpperCase() + "`\n🆔 *Order Number:* `# " + orderNum + "`\n\n**⚠️ SUBMIT TRANSACTION ID / HASH:**\nBhai, apni USDT Transaction Hash ID niche message box mein type karke send karo:", { parse_mode: "Markdown" });
});

// 👑 Galti No. 1 Fixed: Dynamic indices mapping updated strictly for approval routines
bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)$/, async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const parts = ctx.callbackQuery.data.split("_"), action = parts[1], userId = parseInt(parts[2]), refKey = parts[3];
    const depositData = DYNAMIC_USER_DB.pending_deposits[refKey]; if (!depositData) return ctx.answerCallbackQuery({ text: "❌ Link Expired or Already Approved!", show_alert: true });
    const u = getLocalUser(userId);
    if (action === "acc") {
        u.balance_usd += depositData.amount_usd; u.total_deposit_usd += depositData.amount_usd; forceSaveDatabase();
        await bot.api.sendMessage(userId, `✅ *Payment Added Successful!* 💰\n\nBhai tumhara payment verify ho gaya hai.\n✨ *Added Amount:* ${formatMoneyLocal(depositData.amount_usd, u.currency)}\n💳 *Total Balance:* ${formatMoneyLocal(u.balance_usd, u.currency)}`, { parse_mode: "Markdown" });
        await ctx.editMessageText(`✅ Request Accepted for User ${userId}`);
    } else {
        await bot.api.sendMessage(userId, `❌ *Payment Request Cancelled!*`); await ctx.editMessageText(`❌ Cancelled for User ${userId}`);
    } delete DYNAMIC_USER_DB.pending_deposits[refKey]; forceSaveDatabase();
});

bot.command("admin", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    await ctx.reply(`⚙️ *HAPPY REACTION Super Admin Control Panel*\n\n➕ *User Matrix Controls:*\n▫️ \`/ban USER_ID\` \n▫️ \`/unban USER_ID\` \n▫️ \`/addbalance USER_ID AMOUNT\` \n▫️ \`/deductbalance USER_ID AMOUNT\` \n▫️ \`/checkuser USER_ID\` -> View total profile & order metrics\n\n🛠️ *SMM Live Controls:*\n▫️ \`/addservice ID Rate Type Name\`\n▫️ \`/updateservice ID NewRate\`\n▫️ \`/delservice ID\`\n\n💳 *Payment Credentials Controls (Live Change):*\n▫️ \`/setupi NEW_UPI_ID\` \n▫️ \`/settrc20 WALLET_ADDRESS\` \n▫️ \`/setbep20 WALLET_ADDRESS\``, { parse_mode: "Markdown" });
});

bot.command("ban", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const target = parseInt(ctx.message.text.split(" ")[1]); if (isNaN(target) || !DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ ID nahi mili!");
    DYNAMIC_USER_DB.users[target].is_banned = true; forceSaveDatabase(); await ctx.reply(`🚫 User \`${target}\` BAN ho gaya hai.`);
});

bot.command("unban", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const target = parseInt(ctx.message.text.split(" ")[1]); if (isNaN(target) || !DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ ID nahi mili!");
    DYNAMIC_USER_DB.users[target].is_banned = false; forceSaveDatabase(); await ctx.reply(`✅ User \`${target}\` UNBAN ho gaya hai.`);
});

// 👑 Galti No. 2 Fixed: Template literal string concatenated properly
bot.command("addbalance", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" "), target = parseInt(args[1]), amt = parseFloat(args[2]);
    if (isNaN(target) || isNaN(amt) || !DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Format: \`/addbalance USER_ID AMOUNT\`");
    DYNAMIC_USER_DB.users[target].balance_usd += amt; forceSaveDatabase(); 
    await ctx.reply("💰 *Successfully Added $*" + amt.toFixed(2) + " *to User:* `" + target + "`");
    try { await bot.api.sendMessage(target, "✨ *Admin dwara tumhare account mein $*" + amt.toFixed(2) + " *add kar diye gaye hain!*"); } catch(e) {}
});

bot.command("deductbalance", async (ctx) => {
