require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const { run } = require('@grammyjs/runner');
const axios = require('axios');
const fs = require('fs');
const config = require('./config');
let SERVICES_MASTER_DATA = require('./services');

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);

const USER_DATABASE = {};
const PENDING_DEPOSITS = {};

const TG_POST_RE = /https:\/\/t\.me\/([A-Za-z0-9_]+)\/(\d+)\/?/;
const TG_CHANNEL_RE = /https:\/\/t\.me\/([A-Za-z0-9_]+)\/?/;
const IG_POST_RE = /https:\/\/(www\.)?instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_\-]+)\/?/;
const IG_PROFILE_RE = /https:\/\/(www\.)?instagram\.com\/([A-Za-z0-9_\.]+)\/?/;

function getOrCreateUser(id, name = "User") {
    if (!USER_DATABASE[id]) {
        USER_DATABASE[id] = { username: name, balance_usd: 0.0, total_deposit_usd: 0.0, spent_usd: 0.0, orders_count: 0, cancelled_orders: 0, pending_orders: 0, history: [], currency: "INR", pending_service: null, pending_qty: null, pending_cost_usd: null, awaiting_custom_qty: false, awaiting_deposit_amt: false, chosen_pay_method: null, awaiting_utr: false, current_deposit_amt: 0, current_order_num: 0, chosen_network: "" };
    }
    return USER_DATABASE[id];
}

function formatMoney(usd, pref) {
    return pref === "INR" ? `₹${(usd * config.USD_TO_INR_RATE).toFixed(2)}` : `$${usd.toFixed(2)}`;
}

function validateLink(l, t) {
    if (t === "tg_post") return TG_POST_RE.test(l);
    if (t === "tg_channel") return TG_CHANNEL_RE.test(l);
    if (t === "ig_post") return IG_POST_RE.test(l);
    if (t === "ig_profile") return IG_PROFILE_RE.test(l);
    return true;
}

function getHappyReactionKeyboard() {
    return new InlineKeyboard()
        .text("BALANCE", "check_balance").text("ADD FUND", "main_add_funds").row()
        .text("MY CHANNEL", "my_channels").text("SERVICE", "main_services").row()
        .text("MY ORDERS", "main_orders").text("MY PROFILE", "my_profile").row()
        .text("PROMOTION", "main_promo").text("SUPPORT", "main_support").row()
        .text("CURRENCY", "toggle_currency");
}

function getPlatformsKeyboard() {
    return new InlineKeyboard().text("🔹 TELEGRAM", "p_tg").text("🔸 INSTAGRAM", "p_ig").row().text("🔺 YOUTUBE", "p_yt").text("🟩 FACEBOOK", "p_fb").row().text("⬅️ Main Menu", "back_to_menu");
}

function getQuantityKeyboard(sid) {
    return new InlineKeyboard().text("100", `q_${sid}_100`).text("200", `q_${sid}_200`).row().text("500", `q_${sid}_500`).text("1000", `q_${sid}_1000`).row().text("5000", `q_${sid}_5000`).text("10000", `q_${sid}_10000`).row().text("⚙️ Custom Amount", `q_${sid}_custom`).row().text("📦 Order History", "main_orders").text("⬅️ Back", "main_services");
}

function saveServicesToFile() {
    fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8');
    delete require.cache[require.resolve('./services')]; SERVICES_MASTER_DATA = require('./services');
}

// 👑 START & CORE MENUS SYSTEM (Saare buttons yahan jod diye bhai)
bot.command("start", async (ctx) => {
    getOrCreateUser(ctx.from.id, ctx.from.first_name);
    await ctx.reply(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: getHappyReactionKeyboard(), parse_mode: "Markdown" });
});

bot.callbackQuery("back_to_menu", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id); u.awaiting_deposit_amt = false; u.awaiting_utr = false;
    await ctx.editMessageText(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: getHappyReactionKeyboard(), parse_mode: "Markdown" });
});

bot.callbackQuery("check_balance", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id);
    await ctx.editMessageText(`💰 *Your Balance Details:*\n\n💵 *Current Balance:* ${formatMoney(u.balance_usd, u.currency)}\n💳 *Total Deposited:* ${formatMoney(u.total_deposit_usd, u.currency)}`, { reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), parse_mode: "Markdown" });
});

bot.callbackQuery("my_profile", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id);
    await ctx.editMessageText(`👤 *USER PROFILE DETAILS:*\n\n📝 *Name:* ${u.username}\n🆔 *User ID:* \`${ctx.from.id}\`\n\n💳 *Current Balance:* ${formatMoney(u.balance_usd, u.currency)}\n💰 *Total Deposited:* ${formatMoney(u.total_deposit_usd, u.currency)}\n💸 *Total Spent:* ${formatMoney(u.spent_usd, u.currency)}\n\n📦 *Total Orders:* ${u.orders_count}\n⏳ *Pending Orders:* ${u.pending_orders}\n❌ *Cancelled Orders:* ${u.cancelled_orders}`, { reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), parse_mode: "Markdown" });
});

bot.callbackQuery("main_orders", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id);
    let txt = `📦 *YOUR ORDERS STATUS & HISTORY:*\n\n📊 *Total Orders:* ${u.orders_count}\n⏳ *Pending Orders:* ${u.pending_orders}\n\n*Last 5 Orders:* \n`;
    if (u.history.length === 0) txt += "▫️ No orders placed yet.";
    else u.history.slice(-5).forEach(o => { txt += `🆔 ID: \`${o.order_id}\` | Qty: ${o.qty} | Status: ${o.status}\n`; });
    await ctx.editMessageText(txt, { reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), parse_mode: "Markdown" });
});

bot.callbackQuery("toggle_currency", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id); u.currency = u.currency === "USD" ? "INR" : "USD"; await ctx.answerCallbackQuery({ text: `Set: ${u.currency}` });
    await ctx.editMessageText(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: getHappyReactionKeyboard(), parse_mode: "Markdown" });
});

// 💳 ADD FUNDS & MULTI-FLOW SYSTEM FIXED
bot.callbackQuery("main_add_funds", async (ctx) => {
    const kb = new InlineKeyboard().text("Payment via UPI", "pay_via_upi").text("Payment via USDT", "pay_via_usdt").row().text("BACK", "back_to_menu");
    await ctx.editMessageText("💳 *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: kb, parse_mode: "Markdown" });
});

bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, async (ctx) => {
    const u = getOrCreateUser(ctx.from.id); u.chosen_pay_method = ctx.callbackQuery.data; u.awaiting_deposit_amt = true;
    if (u.chosen_pay_method === "pay_via_upi") {
        await ctx.editMessageText(`💰 *Enter Amount:* UPI\n\nकृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (INR ₹) you want to add:`);
    } else {
        await ctx.editMessageText(`💰 *Enter Amount:* USDT\n\nकृपया वह राशि (USDT) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (USDT) you want to add:`);
    }
});

bot.callbackQuery("user_complete_pay_via_upi", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id); u.awaiting_utr = true;
    const orderNum = Math.floor(100000 + Math.random() * 900000); u.current_order_num = orderNum;
    await ctx.editMessageText(`💵 *Payment Initiated!* ✅\n\n📊 *Expected Amount:* \`₹${u.current_deposit_amt.toFixed(2)}\`\n🆔 *Order Number:* \`#${orderNum}\`\n\n⚠️ *SUBMIT UTR TRANSACTION ID:*\nBhai, ab apna 12-digit UTR/Reference number niche message box mein type karke send karo aur sath mein payment ka screenshot bhi attach karke bhejo:`, { parse_mode: "Markdown" });
});

bot.callbackQuery(/^usdtnet_(bep20|trc20)$/, async (ctx) => {
    const u = getOrCreateUser(ctx.from.id); const network = ctx.callbackQuery.data.split("_")[1]; u.chosen_network = network;
    const address = network === "trc20" ? config.USDT_TRC20 : config.USDT_BEP20;
    const kb = new InlineKeyboard().text("CONFIRM PAYMENT", "usdt_confirm_click").row().text("BACK", "pay_via_usdt");
    await ctx.editMessageText(`🪙 *USDT ${network.toUpperCase()} MANUAL DEPOSIT*\n\n💵 *Amount to Pay:* $${u.current_deposit_amt.toFixed(2)}\n📍 *Address:* \`${address}\`\n\n👉 Address par send karke neeche *CONFIRM PAYMENT* par click karein.`, { reply_markup: kb, parse_mode: "Markdown" });
});

bot.callbackQuery("usdt_confirm_click", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id); u.awaiting_utr = true;
    const orderNum = Math.floor(100000 + Math.random() * 900000); u.current_order_num = orderNum;
    await ctx.editMessageText(`🪙 *USDT Deposit Initiated!* ✅\n\n📊 *Requested Amount:* \`$${u.current_deposit_amt.toFixed(2)}\`\n🌐 *Network:* \`${u.chosen_network.toUpperCase()}\`\n\n⚠️ *SUBMIT TRANSACTION ID:*\nBhai, apni USDT Transaction Hash ID niche message box mein type karke send karo:`, { parse_mode: "Markdown" });
});

bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)$/, async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const parts = ctx.callbackQuery.data.split("_"), action = parts[1], userId = parseInt(parts[2]), refKey = parts[3];
    const depositData = PENDING_DEPOSITS[refKey]; if (!depositData) return ctx.answerCallbackQuery({ text: "❌ Expired!", show_alert: true });
    const u = getOrCreateUser(userId);
    if (action === "acc") {
        u.balance_usd += depositData.amount_usd; u.total_deposit_usd += depositData.amount_usd;
        await bot.api.sendMessage(userId, `✅ *Payment Added Successful!* 💰\n\nBhai tumhara payment verify ho gaya hai.\n✨ *Added Amount:* ${formatMoney(depositData.amount_usd, u.currency)}\n💳 *Total Balance:* ${formatMoney(u.balance_usd, u.currency)}`, { parse_mode: "Markdown" });
        await ctx.editMessageText(`✅ Approved for User ${userId}`);
    } else {
        await bot.api.sendMessage(userId, `❌ *Payment Request Cancelled!*`); await ctx.editMessageText(`❌ Cancelled for User ${userId}`);
    } delete PENDING_DEPOSITS[refKey];
});

// 🛠️ SERVICES GRID LAYOUT (Baki saare platforms yahan jod diye bhai)
bot.callbackQuery("main_services", async (ctx) => { await ctx.editMessageText(`🛠️ *Select Platform / प्लेटफार्म चुनें:*`, { reply_markup: getPlatformsKeyboard(), parse_mode: "Markdown" }); });
bot.callbackQuery("p_tg", async (ctx) => {
