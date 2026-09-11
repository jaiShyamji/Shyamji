require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const axios = require('axios');
const config = require('./config');
const SERVICES_MASTER_DATA = require('./services'); // Alag file link ho gayi bhai

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);
const USER_DATABASE = {};

const TG_POST_RE = /https:\/\/t\.me\/([A-Za-z0-9_]+)\/(\d+)\/?/;
const TG_CHANNEL_RE = /https:\/\/t\.me\/([A-Za-z0-9_]+)\/?/;
const IG_POST_RE = /https:\/\/(www\.)?instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_\-]+)\/?/;
const IG_PROFILE_RE = /https:\/\/(www\.)?instagram\.com\/([A-Za-z0-9_\.]+)\/?/;

function getOrCreateUser(id, name = "User") {
    if (!USER_DATABASE[id]) {
        USER_DATABASE[id] = { username: name, balance_usd: 10.0, total_deposit_usd: 10.0, spent_usd: 0.0, orders_count: 0, cancelled_orders: 0, pending_orders: 0, history: [], currency: "INR", pending_service: null, pending_qty: null, pending_cost_usd: null, awaiting_custom_qty: false, awaiting_deposit_amt: false, chosen_pay_method: null };
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

function getPlatformsKeyboard() {
    return new InlineKeyboard()
        .text("🔹 TELEGRAM", "p_tg")
        .text("🔸 INSTAGRAM", "p_ig").row()
        .text("🔺 YOUTUBE", "p_yt")
        .text("🟩 FACEBOOK", "p_fb").row()
        .text("⬅️ Main Menu", "back_to_menu");
}

function getQuantityKeyboard(sid) {
    return new InlineKeyboard()
        .text("100", `q_${sid}_100`)
        .text("200", `q_${sid}_200`).row()
        .text("500", `q_${sid}_500`)
        .text("1000", `q_${sid}_1000`).row()
        .text("5000", `q_${sid}_5000`)
        .text("10000", `q_${sid}_10000`).row()
        .text("⚙️ Custom Amount", `q_${sid}_custom`).row()
        .text("📦 Order History", "main_orders")
        .text("⬅️ Back", "main_services");
}

function getHappyReactionKeyboard() {
    return new InlineKeyboard()
        .text("BALANCE", "check_balance").text("ADD FUND", "main_add_funds").row()
        .text("MY CHANNEL", "my_channels").text("SERVICE", "main_services").row()
        .text("MY ORDERS", "main_orders").text("MY PROFILE", "my_profile").row()
        .text("PROMOTION", "main_promo").text("SUPPORT", "main_support").row()
        .text("CURRENCY", "toggle_currency");
}

bot.command("start", async (ctx) => {
    getOrCreateUser(ctx.from.id, ctx.from.first_name);
    await ctx.reply(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: getHappyReactionKeyboard(), parse_mode: "Markdown" });
});

bot.callbackQuery("back_to_menu", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id); u.awaiting_deposit_amt = false;
    await ctx.editMessageText(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: getHappyReactionKeyboard(), parse_mode: "Markdown" });
});

bot.callbackQuery("main_services", async (ctx) => {
    await ctx.editMessageText(`🛠️ *Select Platform / प्लेटफार्म चुनें:*`, { reply_markup: getPlatformsKeyboard(), parse_mode: "Markdown" });
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

bot.callbackQuery("p_tg", async (ctx) => {
    let t = `🔹 *TELEGRAM SERVICES*\n\n💬 *TELEGRAM REACTIONS*\n`;
    ["5153", "5160", "5161", "5162", "5163", "5164", "5165"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
    t += `\n👀 *TELEGRAM POST VIEWS*\n`; ["1512", "6855"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
    t += `\n👥 *TELEGRAM MEMBERS*\n`; ["7153", "6787", "3274"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
    t += `\n🛒 Order matching code type karein (e.g. /5153)`; await ctx.editMessageText(t, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
});

bot.callbackQuery("p_ig", async (ctx) => {
    let t = `🔸 *INSTAGRAM SERVICES*\n\n❤️ *INSTAGRAM LIKES*\n`;
    ["7802", "7526", "7374"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
    t += `\n👥 *FOLLOWERS & VIEWS*\n`; ["3602", "1658", "1961", "8810", "8782", "2968", "6634", "7386"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
    t += `\n🛒 Order matching code type karein (e.g. /7802)`; await ctx.editMessageText(t, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
});

bot.callbackQuery("p_fb", async (ctx) => {
    let t = `🟩 *FACEBOOK SERVICES*\n\n`; ["8001", "8002", "8003"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
    await ctx.editMessageText(t + `\n🛒 Order matching code type karein (e.g. /8001)`, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
});

bot.callbackQuery("p_yt", async (ctx) => {
    let t = `🔺 *YOUTUBE SERVICES*\n\n`; ["9001", "9002", "9003"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
    await ctx.editMessageText(t + `\n🛒 Order matching code type karein (e.g. /9001)`, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
});

bot.hears(/^\/\d+$/, async (ctx) => {
    const id = ctx.message.text.slice(1); if (!SERVICES_MASTER_DATA[id]) return;
    const u = getOrCreateUser(ctx.from.id); u.pending_service = id; u.awaiting_custom_qty = false;
    await ctx.reply(`👉 *You selected:* ${SERVICES_MASTER_DATA[id].name}\n\n🔢 *Select Your Quantity:*`, { reply_markup: getQuantityKeyboard(id), parse_mode: "Markdown" });
});

async function proceedToLinkRequest(ctx, u, serviceId, qty) {
    const sInfo = SERVICES_MASTER_DATA[serviceId]; u.pending_qty = qty; u.pending_cost_usd = (qty / 1000.0) * sInfo.rate;
    let h = `Send ${sInfo.type.startsWith("tg") ? "Telegram" : "Instagram"} Link:`;
    const txt = `📋 *Order Summary*\n\n🛠️ Service: \`${sInfo.name}\`\n📊 Quantity: \`${qty}\`\n💸 Cost: ${formatMoney(u.pending_cost_usd, u.currency)}\n\n💬 ${h}`;
    if (ctx.callbackQuery) { await ctx.editMessageText(txt, { parse_mode: "Markdown" }); } else { await ctx.reply(txt, { parse_mode: "Markdown" }); }
}

bot.callbackQuery(/^q_\d+_(.+)$/, async (ctx) => {
    const parts = ctx.callbackQuery.data.split("_"), serviceId = parts[1], qtyType = parts[2], u = getOrCreateUser(ctx.from.id);
    if (qtyType === "custom") { u.awaiting_custom_qty = true; await ctx.editMessageText("🔢 Please type your custom quantity amount:"); return; }
    await proceedToLinkRequest(ctx, u, serviceId, parseInt(qtyType));
});

bot.callbackQuery("main_add_funds", async (ctx) => {
    const kb = new InlineKeyboard().text("🇮🇳 Pay via UPI", "pay_via_upi").text("🪙 Pay via USDT", "pay_via_usdt").row().text("⬅️ Back", "back_to_menu");
    await ctx.editMessageText("💳 *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: kb, parse_mode: "Markdown" });
});

bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, async (ctx) => {
    const u = getOrCreateUser(ctx.from.id); u.chosen_pay_method = ctx.callbackQuery.data; u.awaiting_deposit_amt = true;
    await ctx.editMessageText(`💰 *Enter Amount:*\n\n` + (u.chosen_pay_method === "pay_via_upi" ? "कृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:" : "कृपया वह राशि (USD $) टाइप करें जो आप जोड़ना चाहते हैं:"));
});

bot.on("message:text", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id, ctx.from.first_name); const txt = ctx.message.text.trim();
    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
        const amt = parseFloat(txt); if (isNaN(amt) || amt <= 0) { await ctx.reply("❌ Invalid amount. Try again:"); return; } u.awaiting_deposit_amt = false;
        const kb = new InlineKeyboard().text("✅ Payment Done", "p_done").row().text("⬅️ Menu", "back_to_menu");
