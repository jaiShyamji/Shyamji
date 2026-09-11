require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const axios = require('axios');

// ENV Configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const SMM_API_URL = process.env.SMM_API_URL || "https://smmlite.com/api/v2";
const SMM_API_KEY = process.env.SMM_API_KEY;
const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME || "YourSupportUsername";
const UPI_ID = process.env.UPI_ID || "your-vpa@ybl";
const USDT_ADDRESS = process.env.USDT_ADDRESS || "TYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const USD_TO_INR_RATE = 95.0;

// Mock database (In-memory)
const USER_DATABASE = {};

// SMM Services Data
const SERVICES_MASTER_DATA = {
    // TELEGRAM REACTIONS
    "5153": { name: "telegram like (👍) [instant]", rate: 0.12, type: "tg_post" },
    "5160": { name: "telegram like (👍❤️🔥🥰) [instant]", rate: 0.15, type: "tg_post" },
    "5161": { name: "telegram like (❤️🔥👏🤩🎉🥰👍) [instant]", rate: 0.10, type: "tg_post" },
    "5162": { name: "telegram like (🔥) [instant]", rate: 0.15, type: "tg_post" },
    "5163": { name: "telegram like (❤️) [instant]", rate: 0.15, type: "tg_post" },
    "5164": { name: "telegram like (👏) [instant]", rate: 0.15, type: "tg_post" },
    "5165": { name: "telegram like (🤩) [instant]", rate: 0.15, type: "tg_post" },
    // TELEGRAM POST VIEWS
    "1512": { name: "telegram post views [Last 1 post] [SUPERFAST]", rate: 0.11, type: "tg_post" },
    "6855": { name: "telegram post views [1 post] [CHEAPEST]", rate: 0.09, type: "tg_post" },
    // TELEGRAM MEMBERS
    "7153": { name: "Telegram Members [Refill 3 Days]", rate: 0.52, type: "tg_channel" },
    "6787": { name: "Telegram Members [Mixed, Cheap]", rate: 0.38, type: "tg_channel" },
    "3274": { name: "Telegram Channel Member [Mixed, Cheap]", rate: 0.52, type: "tg_channel" },
    // INSTAGRAM LIKES
    "7802": { name: "Likes [Speed 20K/Hr]", rate: 0.21, type: "ig_post" },
    "7526": { name: "Likes [HQ Instant]", rate: 0.26, type: "ig_post" },
    "7374": { name: "Likes [Indian Mixed]", rate: 0.19, type: "ig_post" },
    // INSTAGRAM FOLLOWERS & VIEWS
    "3602": { name: "Followers [30 Days Refill]", rate: 3.12, type: "ig_profile" },
    "1658": { name: "Followers [Max 200K]", rate: 1.82, type: "ig_profile" },
    "1961": { name: "Followers [Max 10K]", rate: 2.48, type: "ig_profile" },
    "8810": { name: "Followers [No Refill]", rate: 1.77, type: "ig_profile" },
    "8782": { name: "Followers [Real Look]", rate: 1.97, type: "ig_profile" },
    "2968": { name: "Views [Unlimited]", rate: 0.40, type: "ig_post" },
    "6634": { name: "Views [Super Cheap]", rate: 0.30, type: "ig_post" },
    "7386": { name: "Emergency Views", rate: 0.10, type: "ig_post" }
};

if (!BOT_TOKEN) {
    console.error("ERROR: BOT_TOKEN is missing in environment variables!");
    process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

// Regex Expressions
const TG_POST_RE = /https:\/\/t\.me\/([A-Za-z0-9_]+)\/(\d+)\/?/;
const TG_CHANNEL_RE = /https:\/\/t\.me\/([A-Za-z0-9_]+)\/?/;
const IG_POST_RE = /https:\/\/(www\.)?instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_\-]+)\/?/;
const IG_PROFILE_RE = /https:\/\/(www\.)?instagram\.com\/([A-Za-z0-9_\.]+)\/?/;

// Helper Functions
function getOrCreateUser(userId) {
    if (!USER_DATABASE[userId]) {
        USER_DATABASE[userId] = {
            balance_usd: 0.0,
            spent_usd: 0.0,
            orders_count: 0,
            channels: [],
            history: [],
            order_details: {},
            currency: "INR",
            pending_service: null,
            pending_qty: null,
            pending_cost_usd: null
        };
    }
    return USER_DATABASE[userId];
}

function formatMoney(usd, pref) {
    if (pref === "INR") {
        return `₹${(usd * USD_TO_INR_RATE).toFixed(2)}`;
    }
    return `$${usd.toFixed(2)}`;
}

function validateLink(link, type) {
    if (type === "tg_post") return TG_POST_RE.test(link);
    if (type === "tg_channel") return TG_CHANNEL_RE.test(link);
    if (type === "ig_post") return IG_POST_RE.test(link);
    if (type === "ig_profile") return IG_PROFILE_RE.test(link);
    return true;
}

function getMainAddFundsKeyboard() {
    return new InlineKeyboard()
        .text("₹100", "amt_100").text("₹200", "amt_200").row()
        .text("₹500", "amt_500").text("₹1000", "amt_1000").row()
        .text("₹2000", "amt_2000").text("₹5000", "amt_5000").row()
        .text("⬅️ Back", "back_to_menu");
}

// Bot Callbacks and Event Handlers
bot.callbackQuery("toggle_currency", async (ctx) => {
    const user = getOrCreateUser(ctx.from.id);
    user.currency = user.currency === "USD" ? "INR" : "USD";
    await ctx.answerCallbackQuery({ text: `✔️ Currency set to ${user.currency}` });
});

bot.callbackQuery("main_add_funds", async (ctx) => {
    await ctx.editMessageText(
        `💳 *Add Funds / डिपाजिट Fund:*\n\nनीचे दिए गए अमाउंट्स में से कोई एक अमाउंट चुनें:`,
        { reply_markup: getMainAddFundsKeyboard(), parse_mode: "Markdown" }
    );
});

bot.callbackQuery(/^amt_\d+$/, async (ctx) => {
    const amtInr = parseInt(ctx.callbackQuery.data.split("_")[1]);
    const amtUsd = amtInr / USD_TO_INR_RATE;

    const keyboard = new InlineKeyboard()
        .text("✅ मैंने पेमेंट कर दी है", `paid_${amtInr}`).row()
        .text("⬅️ Back", "main_add_funds");

    const text = `💵 *Pay:* ₹${amtInr} (~$${amtUsd.toFixed(2)}) USD\n\n` +
                 `📍 *UPI ID:* \`${UPI_ID}\`\n` +
                 `🪙 *USDT Address:* \`${USDT_ADDRESS}\`\n\n` +
                 `⚠️ Pay karke screenshot support par bhejein.`;

    await ctx.editMessageText(text, { reply_markup: keyboard, parse_mode: "Markdown" });
});

bot.callbackQuery(/^paid_\d+$/, async (ctx) => {
    const user = getOrCreateUser(ctx.from.id);
    const amtInr = parseInt(ctx.callbackQuery.data.split("_")[1]);
    const amtUsd = amtInr / USD_TO_INR_RATE;

    user.history.push({
        type: "deposit",
        amount_inr: amtInr,
        amount_usd: amtUsd,
        status: "Pending ⏳"
    });

    const keyboard = new InlineKeyboard()
        .url("👤 Contact Support", `https://t.me{SUPPORT_USERNAME}`).row()
        .text("⬅️ Menu", "back_to_menu");

    await ctx.editMessageText(
        `💌 *Request Sent!*\n\nTeam verify karke balance add karegi.\nScreenshot support par bhejein.`,
        { reply_markup: keyboard }
    );
});

bot.callbackQuery("main_channels", async (ctx) => {
    const user = getOrCreateUser(ctx.from.id);
    const botInfo = await ctx.api.getMe();
    const promoteUrl = `https://t.me{botInfo.username}?startchannel=true&admin=post_messages+edit_messages+delete_messages+invite_users`;

    let text = `📢 *My Channels:*\n\n`;
    if (!user.channels || user.channels.length === 0) {
        text += `❌ Koi channel linked nahi hai.\n`;
    } else {
        user.channels.forEach((ch, idx) => {
            text += `${idx + 1}. ${ch.title} (Active ✅)\n`;
        });
    }

    const keyboard = new InlineKeyboard()
        .url("➕ Promote Bot as Admin", promoteUrl).row()
        .text("⬅️ Back", "back_to_menu");

    await ctx.editMessageText(text, { reply_markup: keyboard, parse_mode: "Markdown" });
});

bot.callbackQuery("main_support", async (ctx) => {
    const keyboard = new InlineKeyboard()
        .url("💬 Chat with Support", `https://t.me{SUPPORT_USERNAME}`).row()
        .text("⬅️ Back", "back_to_menu");

    await ctx.editMessageText(
        `📞 *Support*\n\nKisi bhi problem ke liye yahan contact karein:`,
        { reply_markup: keyboard, parse_mode: "Markdown" }
    );
});

bot.callbackQuery("main_promo", async (ctx) => {
    const keyboard = new InlineKeyboard().text("⬅️ Back", "back_to_menu");
    await ctx.editMessageText(
        `🎁 *Promotions*\n\n✨ Welcome Bonus: Coming soon!\n🤝 Refer & Earn: Coming soon!`,
        { reply_markup: keyboard, parse_mode: "Markdown" }
    );
});

bot.callbackQuery("main_orders", async (ctx) => {
    const user = getOrCreateUser(ctx.from.id);
    const keyboard = new InlineKeyboard().text("⬅️ Back", "back_to_menu");
    const orders = user.history.filter(h => h.order_id);

    if (orders.length === 0) {
        await ctx.editMessageText(`📦 *My Orders*\n\nAbhi tak koi order nahi hai.`, { reply_markup: keyboard, parse_mode: "Markdown" });
        return;
    }

    let text = `📦 *My Orders (Last 10):*\n\n`;
    const lastOrders = orders.slice(-10);
    for (const o of lastOrders) {
        text += `🆔 OID: \`${o.order_id}\`\n` +
                `🛠️ Service: ${o.service_id}\n` +
                `📊 Qty: ${o.qty}\n` +
                `💰 Cost: ${formatMoney(o.cost_usd, user.currency)} | Status: ${o.status}\n\n`;
    }

    await ctx.editMessageText(text, { reply_markup: keyboard, parse_mode: "Markdown" });
});

bot.callbackQuery("main_services", async (ctx) => {
    const keyboard = new InlineKeyboard()
        .text("🔹 TELEGRAM", "platform_telegram")
        .text("🔸 INSTAGRAM", "platform_instagram").row()
        .text("🔹 FACEBOOK", "platform_facebook")
        .text("🔸 YOUTUBE", "platform_youtube").row()
        .text("⬅️ Back", "back_to_menu");

    await ctx.editMessageText(
        `🛠️ *Select Platform / प्लेटफार्म चुनें:*\n\nAap kiski services dekhna chahte hain?`,
        { reply_markup: keyboard, parse_mode: "Markdown" }
    );
});

bot.callbackQuery("platform_telegram", async (ctx) => {
    const user = getOrCreateUser(ctx.from.id);
    const pref = user.currency;
    const r = (usd) => pref === "INR" ? `₹${(usd * USD_TO_INR_RATE).toFixed(2)}` : `$${usd.toFixed(2)}`;

    let text = `🔹 *TELEGRAM SERVICES* [Currency: ${pref}]\n\n` +
               `💬 *TELEGRAM REACTIONS*\n` +
               `▫️ /5153 - telegram like (👍) [instant] - ${r(0.12)} per 1000\n` +
               `▫️ /5160 - telegram like (👍❤️🔥🥰) [instant] - ${r(0.15)} per 1000\n` +
               `▫️ /5161 - telegram like (❤️🔥👏🤩🎉🥰👍) [instant] - ${r(0.10)} per 1000\n` +
               `▫️ /5162 - telegram like (🔥) [instant] - ${r(0.15)} per 1000\n` +
