require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const axios = require('axios');
const config = require('./config');
const SERVICES_MASTER_DATA = require('./services');

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);
const USER_DATABASE = {};

const TG_POST_RE = /https:\/\/t\.me\/([A-Za-z0-9_]+)\/(\d+)\/?/;
const TG_CHANNEL_RE = /https:\/\/t\.me\/([A-Za-z0-9_]+)\/?/;
const IG_POST_RE = /https:\/\/(www\.)?instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_\-]+)\/?/;
const IG_PROFILE_RE = /https:\/\/(www\.)?instagram\.com\/([A-Za-z0-9_\.]+)\/?/;

function getOrCreateUser(id) {
    if (!USER_DATABASE[id]) {
        USER_DATABASE[id] = {
            balance_usd: 0.0,
            spent_usd: 0.0,
            orders_count: 0,
            history: [],
            currency: "INR",
            pending_service: null,
            pending_qty: null,
            pending_cost_usd: null,
            awaiting_custom_qty: false,
            awaiting_deposit_amt: false,
            chosen_pay_method: null
        };
    }
    return USER_DATABASE[id];
}

function formatMoney(usd, pref) {
    return pref === "INR" ? 
        `₹${(usd * config.USD_TO_INR_RATE).toFixed(2)}` : 
        `$${usd.toFixed(2)}`;
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

function getMainMenuKeyboard() {
    return new InlineKeyboard()
        .text("🛠️ Services", "main_services")
        .text("💳 Add Funds", "main_add_funds").row()
        .text("📦 My Orders", "main_orders")
        .text("🔄 Change Currency", "toggle_currency");
}

bot.command("start", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id);
    await ctx.reply(`👋 Welcome to SMM Panel Bot!\n\n💳 Balance: ${formatMoney(u.balance_usd, u.currency)}`, { reply_markup: getMainMenuKeyboard() });
});

bot.callbackQuery("back_to_menu", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id);
    u.awaiting_deposit_amt = false;
    await ctx.editMessageText(`👋 Main Menu\n\n💳 Balance: ${formatMoney(u.balance_usd, u.currency)}`, { reply_markup: getMainMenuKeyboard() });
});

bot.callbackQuery("main_services", async (ctx) => {
    await ctx.editMessageText(`🛠️ *Select Platform:*`, { reply_markup: getPlatformsKeyboard(), parse_mode: "Markdown" });
});

bot.callbackQuery("p_tg", async (ctx) => {
    let t = `🔹 *TELEGRAM SERVICES*\n\n💬 *REACTIONS*\n`;
    ["5153", "5160", "5161", "5162", "5163", "5164", "5165"].forEach(id => {
        if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`;
    });
    t += `\n👀 *VIEWS*\n`;
    ["1512", "6855"].forEach(id => {
        if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`;
    });
    t += `\n👥 *MEMBERS*\n`;
    ["7153", "6787", "3274"].forEach(id => {
        if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`;
    });
    t += `\n🛒 Order matching code type karein (e.g. /5153)`;
    await ctx.editMessageText(t, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
});

bot.callbackQuery("p_ig", async (ctx) => {
    let t = `🔸 *INSTAGRAM SERVICES*\n\n❤️ *LIKES*\n`;
    ["7802", "7526", "7374"].forEach(id => {
        if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`;
    });
    t += `\n👥 *FOLLOWERS & VIEWS*\n`;
    ["3602", "1658", "1961", "8810", "8782", "2968", "6634", "7386"].forEach(id => {
        if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`;
    });
    t += `\n🛒 Order matching code type karein (e.g. /7802)`;
    await ctx.editMessageText(t, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
});

bot.callbackQuery("p_fb", async (ctx) => {
    let t = `🟩 *FACEBOOK SERVICES*\n\n`;
    ["8001", "8002", "8003"].forEach(id => {
        if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`;
    });
    await ctx.editMessageText(t + `\n🛒 Code: (e.g. /8001)`, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
});

bot.callbackQuery("p_yt", async (ctx) => {
    let t = `🔺 *YOUTUBE SERVICES*\n\n`;
    ["9001", "9002", "9003"].forEach(id => {
        if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`;
    });
    await ctx.editMessageText(t + `\n🛒 Code: (e.g. /9001)`, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
});

bot.hears(/^\/\d+$/, async (ctx) => {
    const id = ctx.message.text.slice(1);
    if (!SERVICES_MASTER_DATA[id]) return;
    const u = getOrCreateUser(ctx.from.id);
    u.pending_service = id;
    u.awaiting_custom_qty = false;
    await ctx.reply(`👉 *Selected:* ${SERVICES_MASTER_DATA[id].name}\n\n🔢 *Select Quantity:*`, { reply_markup: getQuantityKeyboard(id), parse_mode: "Markdown" });
});

bot.callbackQuery(/^q_\d+_(.+)$/, async (ctx) => {
    const parts = ctx.callbackQuery.data.split("_");
    const serviceId = parts[1];
    const qtyType = parts[2];
    const u = getOrCreateUser(ctx.from.id);

    if (qtyType === "custom") {
        u.awaiting_custom_qty = true;
        await ctx.editMessageText("🔢 Please type your custom quantity amount:");
        return;
    }
    const sInfo = SERVICES_MASTER_DATA[serviceId];
    u.pending_qty = parseInt(qtyType);
    u.pending_cost_usd = (u.pending_qty / 1000.0) * sInfo.rate;
    await ctx.editMessageText(`📋 *Summary*\n🛠️ Service: \`${sInfo.name}\`\n📊 Qty: \`${u.pending_qty}\`\n💸 Cost: ${formatMoney(u.pending_cost_usd, u.currency)}\n\n🔗 Send Target Link:`, { parse_mode: "Markdown" });
});

bot.callbackQuery("main_add_funds", async (ctx) => {
    const kb = new InlineKeyboard().text("🇮🇳 UPI", "pay_via_upi").text("🪙 USDT", "pay_via_usdt").row().text("⬅️ Back", "back_to_menu");
    await ctx.editMessageText("💳 *Select Payment Method:*", { reply_markup: kb, parse_mode: "Markdown" });
});

bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, async (ctx) => {
    const u = getOrCreateUser(ctx.from.id);
    u.chosen_pay_method = ctx.callbackQuery.data;
    u.awaiting_deposit_amt = true;
    await ctx.editMessageText(`💰 *Enter Amount:* ` + (u.chosen_pay_method === "pay_via_upi" ? "Type INR ₹ Amount:" : "Type USD $ Amount:"));
});

async function proceedToLinkRequest(ctx, u, serviceId, qty) {
    const sInfo = SERVICES_MASTER_DATA[serviceId];
    u.pending_qty = qty;
    u.pending_cost_usd = (qty / 1000.0) * sInfo.rate;
    let h = `🔗 Send ${sInfo.type.startsWith("tg") ? "Telegram" : "Instagram"} Link:`;
    const txt = `📋 *Order Summary*\n\n🛠️ Service: \`${sInfo.name}\`\n📊 Quantity: \`${qty}\`\n💸 Cost: ${formatMoney(u.pending_cost_usd, u.currency)}\n\n💬 ${h}`;
    if (ctx.callbackQuery) {
        await ctx.editMessageText(txt, { parse_mode: "Markdown" });
    } else {
        await ctx.reply(txt, { parse_mode: "Markdown" });
    }
}

bot.on("message:text", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id);
    const txt = ctx.message.text.trim();

    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
        const amt = parseFloat(txt);
        if (isNaN(amt) || amt <= 0) {
            await ctx.reply("❌ Invalid amount. Try again:");
            return;
        }
        u.awaiting_deposit_amt = false;
        const kb = new InlineKeyboard().text("✅ Payment Done", "p_done").row().text("⬅️ Menu", "back_to_menu");
        
        if (u.chosen_pay_method === "pay_via_upi") {
            const upiUrl = `upi://pay?pa=${config.UPI_ID}&pn=${encodeURIComponent(config.MERCHANT_NAME)}&am=${amt.toFixed(2)}&cu=INR`;
            const qrUrl = `https://googleapis.com{encodeURIComponent(upiUrl)}`;
            await ctx.replyWithPhoto(qrUrl, { caption: `🟢 *UPI QR*\n💵 *Amount:* ₹${amt.toFixed(2)}\n📍 *UPI:* \`${config.UPI_ID}\``, reply_markup: kb, parse_mode: "Markdown" });
        } else {
            const qrUrl = `https://googleapis.com{encodeURIComponent(config.USDT_ADDRESS)}`;
            await ctx.replyWithPhoto(qrUrl, { caption: `🪙 *USDT QR*\n💵 *Amount:* $${amt.toFixed(2)}\n📍 *Address:* \`${config.USDT_ADDRESS}\``, reply_markup: kb, parse_mode: "Markdown" });
        }
        return;
    }

    if (u.awaiting_custom_qty && u.pending_service) {
        const q = parseInt(txt);
        if (isNaN(q) || q <= 0) {
            await ctx.reply("❌ Invalid number:");
            return;
        }
        u.awaiting_custom_qty = false;
        await proceedToLinkRequest(ctx, u, u.pending_service, q);
        return;
    }

    if (!u.pending_service || !u.pending_qty) return;
    const id = u.pending_service;
    const sInfo = SERVICES_MASTER_DATA[id];

    if (!validateLink(txt, sInfo.type)) {
        await ctx.reply("❌ *Invalid Link Format!*");
        return;
    }

    if (u.balance_usd < u.pending_cost_usd) {
