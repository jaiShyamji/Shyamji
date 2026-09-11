require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const axios = require('axios');

const config = require('./config');
const SERVICES_MASTER_DATA = require('./services');

if (!config.BOT_TOKEN) {
    console.error("ERROR: BOT_TOKEN is missing!");
    process.exit(1);
}

const bot = new Bot(config.BOT_TOKEN);
const USER_DATABASE = {};

// Link Validation
const TG_POST_RE = /https:\/\/t\.me\/([A-Za-z0-9_]+)\/(\d+)\/?/;
const TG_CHANNEL_RE = /https:\/\/t\.me\/([A-Za-z0-9_]+)\/?/;
const IG_POST_RE = /https:\/\/(www\.)?instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_\-]+)\/?/;
const IG_PROFILE_RE = /https:\/\/(www\.)?instagram\.com\/([A-Za-z0-9_\.]+)\/?/;

function getOrCreateUser(id) {
    if (!USER_DATABASE[id]) {
        USER_DATABASE[id] = { 
            balance_usd: 100.0, 
            spent_usd: 0.0, 
            orders_count: 0, 
            channels: [], 
            history: [], 
            order_details: {}, 
            currency: "INR", 
            pending_service: null, 
            pending_qty: null, 
            pending_cost_usd: null,
            awaiting_custom_qty: false
        };
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

// 1. पहली प्रॉब्लम का सोल्यूशन: यहाँ चारों बटन्स ग्रिड में ऐड कर दिए हैं
function getPlatformsKeyboard() {
    return new InlineKeyboard()
        .text("🔹 TELEGRAM", "platform_telegram")
        .text("🔸 INSTAGRAM", "platform_instagram").row()
        .text("🔺 YOUTUBE", "platform_youtube")
        .text("🟩 FACEBOOK", "platform_facebook").row()
        .text("⬅️ Main Menu", "back_to_menu");
}

// नया क्वांटिटी कीबोर्ड लेआउट
function getQuantityKeyboard(serviceId) {
    return new InlineKeyboard()
        .text("100", `qty_${serviceId}_100`).text("200", `qty_${serviceId}_200`).row()
        .text("500", `qty_${serviceId}_500`).text("1000", `qty_${serviceId}_1000`).row()
        .text("5000", `qty_${serviceId}_5000`).text("10000", `qty_${serviceId}_10000`).row()
        .text("⚙️ Custom Amount", `qty_${serviceId}_custom`).row()
        .text("📦 Order History", "main_orders").text("⬅️ Back", "main_services");
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
    await ctx.editMessageText(`👋 Main Menu\n\n💳 Balance: ${formatMoney(u.balance_usd, u.currency)}`, { reply_markup: getMainMenuKeyboard() }); 
});

bot.callbackQuery("main_services", async (ctx) => {
    await ctx.editMessageText(`🛠️ *Select Platform / प्लेटफार्म चुनें:*`, { reply_markup: getPlatformsKeyboard(), parse_mode: "Markdown" });
});

// 2. दूसरी प्रॉब्लम का सोल्यूशन: यहाँ टेलीग्राम की सभी सर्विसेज की पूरी लिस्ट बिना किसी फ़िल्टर के शो होगी
bot.callbackQuery("platform_telegram", async (ctx) => {
    let t = `🔹 *TELEGRAM SERVICES*\n\n`;
    
    t += `💬 *TELEGRAM REACTIONS*\n`;
    const reactions = ["5153", "5160", "5161", "5162", "5163", "5164", "5165"];
    reactions.forEach(id => {
        if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`;
    });

    t += `\n👀 *TELEGRAM POST VIEWS*\n`;
    const views = ["1512", "6855"];
    views.forEach(id => {
        if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`;
    });

    t += `\n👥 *TELEGRAM MEMBERS*\n`;
    const members = ["7153", "6787", "3274"];
    members.forEach(id => {
        if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`;
    });

    t += `\n🛒 Order matching code type karein (e.g. /5153)`;
    await ctx.editMessageText(t, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
});

// इंस्टाग्राम की सभी सर्विसेज की पूरी लिस्ट
bot.callbackQuery("platform_instagram", async (ctx) => {
    let t = `🔸 *INSTAGRAM SERVICES*\n\n`;
    
    t += `❤️ *INSTAGRAM LIKES*\n`;
    const likes = ["7802", "7526", "7374"];
    likes.forEach(id => {
        if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`;
    });

    t += `\n👥 *INSTAGRAM FOLLOWERS & VIEWS*\n`;
    const instaOther = ["3602", "1658", "1961", "8810", "8782", "2968", "6634", "7386"];
    instaOther.forEach(id => {
        if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`;
    });

    t += `\n🛒 Order matching code type karein (e.g. /7802)`;
    await ctx.editMessageText(t, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
});

bot.callbackQuery("platform_facebook", async (ctx) => {
    let t = `🟩 *FACEBOOK SERVICES*\n\n`;
    const fbIds = ["8001", "8002", "8003"];
    fbIds.forEach(id => {
        if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`;
    });
    t += `\n🛒 Order matching code type karein (e.g. /8001)`;
    await ctx.editMessageText(t, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
});

bot.callbackQuery("platform_youtube", async (ctx) => {
    let t = `🔺 *YOUTUBE SERVICES*\n\n`;
    const ytIds = ["9001", "9002", "9003"];
    ytIds.forEach(id => {
        if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`;
    });
    t += `\n🛒 Order matching code type karein (e.g. /9001)`;
    await ctx.editMessageText(t, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
});

// कोड डिटेक्ट और क्वांटिटी फ्लो
bot.hears(/^\/\d+$/, async (ctx) => {
    const id = ctx.message.text.slice(1);
    if (!SERVICES_MASTER_DATA[id]) return;
    
    const u = getOrCreateUser(ctx.from.id);
    u.pending_service = id;
    u.awaiting_custom_qty = false;

    await ctx.reply(`👉 *You selected:* ${SERVICES_MASTER_DATA[id].name}\n\n🔢 *Select Your Quantity:*`, { 
        reply_markup: getQuantityKeyboard(id),
        parse_mode: "Markdown"
    });
});

bot.callbackQuery(/^qty_\d+_(.+)$/, async (ctx) => {
    const parts = ctx.callbackQuery.data.split("_");
    const serviceId = parts[1];
    const qtyType = parts[2];
    const u = getOrCreateUser(ctx.from.id);

    if (qtyType === "custom") {
        u.awaiting_custom_qty = true;
        await ctx.editMessageText("🔢 Please type your custom quantity amount:");
        return;
    }

    const qty = parseInt(qtyType);
    await proceedToLinkRequest(ctx, u, serviceId, qty);
});

async function proceedToLinkRequest(ctx, u, serviceId, qty) {
    const serviceInfo = SERVICES_MASTER_DATA[serviceId];
    u.pending_qty = qty;
    u.pending_cost_usd = (qty / 1000.0) * serviceInfo.rate;

    let hint = "Send target link.";
    if (serviceInfo.type.startsWith("tg")) hint = "🔗 Send Telegram link:";
    else if (serviceInfo.type.startsWith("ig")) hint = "🔗 Send Instagram link:";
    else hint = "🔗 Send Target link:";

    const msgText = `📋 *Order Summary*\n\n🛠️ Service: \`${serviceInfo.name}\`\n📊 Quantity: \`${qty}\`\n💸 Cost: ${formatMoney(u.pending_cost_usd, u.currency)}\n\n💬 ${hint}`;
    
    if (ctx.callbackQuery) {
        await ctx.editMessageText(msgText, { parse_mode: "Markdown" });
    } else {
        await ctx.reply(msgText, { parse_mode: "Markdown" });
    }
}

bot.on("message:text", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id);
    
    if (u.awaiting_custom_qty && u.pending_service) {
        const qty = parseInt(ctx.message.text.trim());
        if (isNaN(qty) || qty <= 0) {
            await ctx.reply("❌ Invalid quantity. Please send a valid number:");
            return;
        }
        u.awaiting_custom_qty = false;
        await proceedToLinkRequest(ctx, u, u.pending_service, qty);
        return;
    }

    if (!u.pending_service || !u.pending_qty) return;

    const id = u.pending_service;
    const link = ctx.message.text.trim();
    const serviceInfo = SERVICES_MASTER_DATA[id];

    if (!validateLink(link, serviceInfo.type)) { 
        await ctx.reply("❌ *Invalid Link Format!*\nPlease check the service type and try again.", { parse_mode: "Markdown" }); 
        return; 
    }
    
    if (u.balance_usd < u.pending_cost_usd) {
        await ctx.reply(`❌ *Insufficient Balance!*\nRequired: ${formatMoney(u.pending_cost_usd, u.currency)}`);
        u.pending_service = null;
        return;
    }

    try {
        const res = await axios.post(config.SMM_API_URL, null, { 
            params: { key: config.SMM_API_KEY, action: "add", service: id, link: link, quantity: u.pending_qty }, 
            timeout: 20000 
        });

        if (res.data && res.data.order) {
            u.balance_usd -= u.pending_cost_usd;
            u.spent_usd += u.pending_cost_usd;
            u.orders_count++;
            
            u.history.push({ order_id: res.data.order, service_id: id, qty: u.pending_qty, cost_usd: u.pending_cost_usd, status: "Success ✅" });

            await ctx.reply(
                `🎉 *Confirm Order!* ✅\n\n` +
                `🆔 *Order ID:* \`${res.data.order}\`\n` +
                `🛠️ *Service:* ${serviceInfo.name}\n` +
                `📊 *Quantity:* \`${u.pending_qty}\`\n` +
