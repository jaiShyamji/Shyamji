require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const { run } = require('@grammyjs/runner');
const axios = require('axios');
const fs = require('fs');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);

// 🛡️ SECURE JSON DATABASE LOCAL STORAGE SYSTEM
const DB_FILE = './database.json';
let DYNAMIC_USER_DB = {};
const LOCAL_DEPOSITS = {};

// Bot start hote hi purana saara data load karne ka system bhai
if (fs.existsSync(DB_FILE)) {
    try {
        DYNAMIC_USER_DB = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
        console.log("🛡️ SECURITY SYSTEM: All users data successfully loaded from local backup!");
    } catch (e) {
        DYNAMIC_USER_DB = {};
    }
}

// Data permanent save karne ka core trigger function
function forceSaveDatabase() {
    fs.writeFileSync(DB_FILE, JSON.stringify(DYNAMIC_USER_DB, null, 4), 'utf-8');
}

function getLocalUser(id, name = "User") {
    if (!DYNAMIC_USER_DB[id]) {
        DYNAMIC_USER_DB[id] = { username: name, balance_usd: 0.0, total_deposit_usd: 0.0, spent_usd: 0.0, orders_count: 0, cancelled_orders: 0, pending_orders: 0, history: [], currency: "INR", pending_service: null, pending_qty: null, pending_cost_usd: null, awaiting_custom_qty: false, awaiting_deposit_amt: false, chosen_pay_method: null, awaiting_utr: false, current_deposit_amt: 0, current_order_num: 0, chosen_network: "" };
        forceSaveDatabase(); // Naya user bante hi file mein lock bhai
    }
    return DYNAMIC_USER_DB[id];
}

function formatMoneyLocal(usd, pref) {
    return pref === "INR" ? `₹${(usd * config.USD_TO_INR_RATE).toFixed(2)}` : `$${usd.toFixed(2)}`;
}

bot.command("start", async (ctx) => {
    getLocalUser(ctx.from.id, ctx.from.first_name);
    await ctx.reply(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: new InlineKeyboard().text("BALANCE", "check_balance").text("ADD FUND", "main_add_funds").row().text("MY CHANNEL", "my_channels").text("SERVICE", "main_services").row().text("MY ORDERS", "main_orders").text("MY PROFILE", "my_profile").row().text("PROMOTION", "main_promo").text("SUPPORT", "main_support").row().text("CURRENCY", "toggle_currency"), parse_mode: "Markdown" });
});

bot.callbackQuery("back_to_menu", async (ctx) => {
    const u = getLocalUser(ctx.from.id); u.awaiting_deposit_amt = false; u.awaiting_utr = false;
    await ctx.editMessageText(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: new InlineKeyboard().text("BALANCE", "check_balance").text("ADD FUND", "main_add_funds").row().text("MY CHANNEL", "my_channels").text("SERVICE", "main_services").row().text("MY ORDERS", "main_orders").text("MY PROFILE", "my_profile").row().text("PROMOTION", "main_promo").text("SUPPORT", "main_support").row().text("CURRENCY", "toggle_currency"), parse_mode: "Markdown" });
});

bot.callbackQuery("check_balance", async (ctx) => {
    const u = getLocalUser(ctx.from.id);
    await ctx.editMessageText(`💰 *Your Balance Details:*\n\n💵 *Current Balance:* ${formatMoneyLocal(u.balance_usd, u.currency)}\n💳 *Total Deposited:* ${formatMoneyLocal(u.total_deposit_usd, u.currency)}`, { reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), parse_mode: "Markdown" });
});

bot.callbackQuery("my_profile", async (ctx) => {
    const u = getLocalUser(ctx.from.id);
    await ctx.editMessageText(`👤 *USER PROFILE DETAILS:*\n\n📝 *Name:* ${u.username}\n🆔 *User ID:* \`${ctx.from.id}\`\n\n💳 *Current Balance:* ${formatMoneyLocal(u.balance_usd, u.currency)}\n💰 *Total Deposited:* ${formatMoneyLocal(u.total_deposit_usd, u.currency)}\n💸 *Total Spent:* ${formatMoneyLocal(u.spent_usd, u.currency)}\n\n📦 *Total Orders:* ${u.orders_count}\n⏳ *Pending Orders:* ${u.pending_orders}\n❌ *Cancelled Orders:* ${u.cancelled_orders}`, { reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), parse_mode: "Markdown" });
});

bot.callbackQuery("main_orders", async (ctx) => {
    const u = getLocalUser(ctx.from.id);
    let txt = `📦 *YOUR ORDERS STATUS & HISTORY:*\n\n📊 *Total Orders:* ${u.orders_count}\n⏳ *Pending Orders:* ${u.pending_orders}\n\n*Last 5 Orders:* \n`;
    if (!u.history || u.history.length === 0) txt += "▫️ No orders placed yet.";
    else u.history.slice(-5).forEach(o => { txt += `🆔 ID: \`${o.order_id}\` | Qty: ${o.qty} | Status: ${o.status}\n`; });
    await ctx.editMessageText(txt, { reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), parse_mode: "Markdown" });
});

bot.callbackQuery("toggle_currency", async (ctx) => {
    const u = getLocalUser(ctx.from.id); u.currency = u.currency === "USD" ? "INR" : "USD"; 
    forceSaveDatabase(); await ctx.answerCallbackQuery({ text: `Set: ${u.currency}` });
    await ctx.editMessageText(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: new InlineKeyboard().text("BALANCE", "check_balance").text("ADD FUND", "main_add_funds").row().text("MY CHANNEL", "my_channels").text("SERVICE", "main_services").row().text("MY ORDERS", "main_orders").text("MY PROFILE", "my_profile").row().text("PROMOTION", "main_promo").text("SUPPORT", "main_support").row().text("CURRENCY", "toggle_currency"), parse_mode: "Markdown" });
});

// 👑 ADMIN APPROVAL ACTION HANDLERS WITH FILE WRITE LOCK
bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)$/, async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const parts = ctx.callbackQuery.data.split("_");
    const action = parts, userId = parseInt(parts), refKey = parts;

    const depositData = LOCAL_DEPOSITS[refKey];
    if (!depositData) return ctx.answerCallbackQuery({ text: "❌ Request expired!", show_alert: true });

    const u = getLocalUser(userId);
    if (action === "acc") {
        u.balance_usd += depositData.amount_usd;
        u.total_deposit_usd += depositData.amount_usd;
        forceSaveDatabase(); // Balance add hote hi file mein update lock bhai
        
        const successMsg = `✅ *Payment Added Successful!* 💰\n\nBhai tumhara payment verify ho gaya hai.\n✨ *Added Amount:* ${formatMoneyLocal(depositData.amount_usd, u.currency)}\n💳 *Total Balance:* ${formatMoneyLocal(u.balance_usd, u.currency)}`;
        await bot.api.sendMessage(userId, successMsg, { parse_mode: "Markdown" });
        await ctx.editMessageText(`✅ Request Accepted for User ${userId}`);
    } else {
        await bot.api.sendMessage(userId, `❌ *Payment Request Cancelled!*\n\nBhai tumhara deposit request admin dwara cancel kar diya gaya hai.`);
        await ctx.editMessageText(`❌ Request Cancelled for User ${userId}`);
    }
    delete LOCAL_DEPOSITS[refKey];
});

// 💳 ADD FUND SELECTION SYSTEM
bot.callbackQuery("main_add_funds", async (ctx) => {
    const kb = new InlineKeyboard().text("Payment via UPI", "pay_via_upi").text("Payment via USDT", "pay_via_usdt").row().text("BACK", "back_to_menu");
    await ctx.editMessageText("💳 *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: kb, parse_mode: "Markdown" });
});

bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, async (ctx) => {
    const u = getLocalUser(ctx.from.id); u.chosen_pay_method = ctx.callbackQuery.data; u.awaiting_deposit_amt = true;
    if (u.chosen_pay_method === "pay_via_upi") {
        await ctx.editMessageText(`💰 *Enter Amount:* UPI\n\nकृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (INR ₹) you want to add:`);
    } else {
        await ctx.editMessageText(`💰 *Enter Amount:* USDT\n\nकृपया वह राशि (USDT) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (USDT) you want to add:`);
    }
});

bot.callbackQuery("user_complete_pay_via_upi", async (ctx) => {
    const u = getLocalUser(ctx.from.id); u.awaiting_utr = true;
    const orderNum = Math.floor(100000 + Math.random() * 900000); u.current_order_num = orderNum;
    await ctx.editMessageText(`💵 *Payment Initiated!* ✅\n\n📊 *Expected Amount:* \`₹${u.current_deposit_amt.toFixed(2)}\`\n🆔 *Order Number:* \`#${orderNum}\`\n\n**⚠️ SUBMIT UTR TRANSACTION ID:**\nBhai, ab apna 12-digit UTR/Reference number niche message box mein type karke send karo aur sath mein payment ka screenshot bhi attach karke bhejo:`, { parse_mode: "Markdown" });
});

bot.callbackQuery(/^usdtnet_(bep20|trc20)$/, async (ctx) => {
    const u = getLocalUser(ctx.from.id); const network = ctx.callbackQuery.data.split("_"); u.chosen_network = network;
    const address = network === "trc20" ? config.USDT_TRC20 : config.USDT_BEP20;
    const kb = new InlineKeyboard().text("CONFIRM PAYMENT", "usdt_confirm_click").row().text("BACK", "pay_via_usdt");
    await ctx.editMessageText(`🪙 *USDT ${network.toUpperCase()} MANUAL DEPOSIT*\n\n💵 *Amount to Pay:* $${u.current_deposit_amt.toFixed(2)}\n📍 *Address:* \`${address}\`\n\n👉 Address par send karke neeche *CONFIRM PAYMENT* par click karein.`, { reply_markup: kb, parse_mode: "Markdown" });
});

bot.callbackQuery("usdt_confirm_click", async (ctx) => {
    const u = getLocalUser(ctx.from.id); u.awaiting_utr = true;
    const orderNum = Math.floor(100000 + Math.random() * 900000); u.current_order_num = orderNum;
    await ctx.editMessageText(`🪙 *USDT Deposit Initiated!* ✅\n\n📊 *Requested Amount:* \`$${u.current_deposit_amt.toFixed(2)}\`\n🌐 *Network:* \`${u.chosen_network.toUpperCase()}\`\n\n**⚠️ SUBMIT TRANSACTION ID:**\nBhai, apni USDT Transaction Hash ID niche message box mein type karke send karo:`, { parse_mode: "Markdown" });
});

bot.on("message:text", async (ctx) => {
    const u = getLocalUser(ctx.from.id, ctx.from.first_name);
    const txt = ctx.message.text.trim();

    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
