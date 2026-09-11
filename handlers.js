const { InlineKeyboard } = require('grammy');
const config = require('./config');

// यूज़र्स का डेटाबेस (In-Memory)
const USER_DATABASE = {};

// यूज़र का डेटा निकालने या नया बनाने का फ़ंक्शन
function getOrCreateUser(id, username = "User") {
    if (!USER_DATABASE[id]) {
        USER_DATABASE[id] = { 
            username: username || "User",
            balance_usd: 10.0, // टेस्ट के लिए डिफ़ॉल्ट $10 बैलेंस
            total_deposit_usd: 10.0, 
            spent_usd: 0.0, 
            orders_count: 0, 
            cancelled_orders: 0,
            pending_orders: 0,
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

// पैसे को ₹ (INR) या $ (USD) में दिखाने का फ़ंक्शन
function formatMoney(usd, pref) {
    if (pref === "INR") {
        return `₹${(usd * config.USD_TO_INR_RATE).toFixed(2)}`;
    }
    return `$${usd.toFixed(2)}`;
}

// 9 बटन्स का बिल्कुल परफेक्ट लेआउट (जैसा तुमने पॉइंट-टू-पॉइंट माँगा था)
function getHappyReactionKeyboard() {
    return new InlineKeyboard()
        .text("BALANCE", "check_balance")
        .text("ADD FUND", "main_add_funds").row()
        .text("MY CHANNEL", "my_channels")
        .text("SERVICE", "main_services").row()
        .text("MY ORDERS", "main_orders")
        .text("MY PROFILE", "my_profile").row()
        .text("PROMOTION", "main_promo")
        .text("SUPPORT", "main_support").row()
        .text("CURRENCY", "toggle_currency");
}

module.exports = {
    USER_DATABASE,
    getOrCreateUser,
    formatMoney,
    getHappyReactionKeyboard,

    // /start कमांड दबाने पर आने वाला मैसेज
    start: async (ctx) => { 
        const u = getOrCreateUser(ctx.from.id, ctx.from.first_name); 
        const text = `👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`;
        await ctx.reply(text, { 
            reply_markup: getHappyReactionKeyboard(), 
            parse_mode: "Markdown" 
        }); 
    },

    // बैक बटन दबाने पर वापस मेनू पर जाने का फ़ंक्शन
    backMenu: async (ctx) => { 
        const u = getOrCreateUser(ctx.from.id, ctx.from.first_name); 
        u.awaiting_deposit_amt = false; 
        const text = `👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`;
        await ctx.editMessageText(text, { 
            reply_markup: getHappyReactionKeyboard(), 
            parse_mode: "Markdown" 
        }); 
    },
    
    // BALANCE बटन का पूरा लॉजिक (करंट बैलेंस + टोटल डिपाजिट)
    checkBalance: async (ctx) => {
        const u = getOrCreateUser(ctx.from.id);
        const text = `💰 *Your Balance Details:*\n\n` +
                     `💵 *Current Balance:* ${formatMoney(u.balance_usd, u.currency)}\n` +
                     `💳 *Total Deposited:* ${formatMoney(u.total_deposit_usd, u.currency)}`;
        
        await ctx.editMessageText(text, { 
            reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), 
            parse_mode: "Markdown" 
        });
    },
    
    // MY PROFILE बटन का पूरा लॉजिक (यूज़र की पूरी डिटेल्स)
    myProfile: async (ctx) => {
        const u = getOrCreateUser(ctx.from.id);
        const text = `👤 *USER PROFILE DETAILS:*\n\n` +
                    `📝 *Name:* ${u.username}\n` +
                    `🆔 *User ID:* \`${ctx.from.id}\`\n\n` +
                    `💳 *Current Balance:* ${formatMoney(u.balance_usd, u.currency)}\n` +
                    `💰 *Total Deposited:* ${formatMoney(u.total_deposit_usd, u.currency)}\n` +
                    `💸 *Total Spent:* ${formatMoney(u.spent_usd, u.currency)}\n\n` +
                    `📦 *Total Orders:* ${u.orders_count}\n` +
                    `⏳ *Pending Orders:* ${u.pending_orders}\n` +
                    `❌ *Cancelled Orders:* ${u.cancelled_orders}`;
        
        await ctx.editMessageText(text, { 
            reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), 
            parse_mode: "Markdown" 
        });
    },

    // बाकी के बटन्स के छोटे फ़ंक्शन्स
    myChannels: async (ctx) => { 
        await ctx.reply("📢 *My Channels Features* coming soon!", { reply_markup: new InlineKeyboard().text("⬅️ Back", "back_to_menu") }); 
    },
    mainPromo: async (ctx) => { 
        await ctx.reply("🎁 *Promotion / Refer codes* coming soon!", { reply_markup: new InlineKeyboard().text("⬅️ Back", "back_to_menu") }); 
    },
    mainSupport: async (ctx) => { 
        await ctx.reply(`📞 Need Help? Contact support at @${config.SUPPORT_USERNAME}`, { reply_markup: new InlineKeyboard().text("⬅️ Back", "back_to_menu") }); 
    },
    
    // CURRENCY बदलने का फ़ंक्शन
    toggleCurrency: async (ctx) => {
        const u = getOrCreateUser(ctx.from.id); 
        u.currency = u.currency === "USD" ? "INR" : "USD"; 
        await ctx.answerCallbackQuery({ text: `Set to: ${u.currency}` }); 
        
        const text = `👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`;
        await ctx.editMessageText(text, { 
            reply_markup: getHappyReactionKeyboard(), 
            parse_mode: "Markdown" 
        }); 
    }
};
const { InlineKeyboard } = require('grammy');
const axios = require('axios');
const config = require('./config');
const SERVICES_MASTER_DATA = require('./services');
const menu = require('./menuHandlers');

// लिंक चेक करने वाले रेगुलर एक्सप्रेशंस (Regex)
const TG_POST_RE = /https:\/\/t\.me\/([A-Za-z0-9_]+)\/(\d+)\/?/;
const TG_CHANNEL_RE = /https:\/\/t\.me\/([A-Za-z0-9_]+)\/?/;
const IG_POST_RE = /https:\/\/(www\.)?instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_\-]+)\/?/;
const IG_PROFILE_RE = /https:\/\/(www\.)?instagram\.com\/([A-Za-z0-9_\.]+)\/?/;

function validateLink(link, type) {
    if (type === "tg_post") return TG_POST_RE.test(link);
    if (type === "tg_channel") return TG_CHANNEL_RE.test(link);
    if (type === "ig_post") return IG_POST_RE.test(link);
    if (type === "ig_profile") return IG_PROFILE_RE.test(link);
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

async function proceedToLinkRequest(ctx, u, serviceId, qty) {
    const sInfo = SERVICES_MASTER_DATA[serviceId];
    u.pending_qty = qty; 
    u.pending_cost_usd = (qty / 1000.0) * sInfo.rate;
    
    let hint = `Send ${sInfo.type.startsWith("tg") ? "Telegram" : "Instagram"} Link:`;
    const txt = `📋 *Order Summary*\n\n🛠️ Service: \`${sInfo.name}\`\n📊 Quantity: \`${qty}\`\n💸 Cost: ${menu.formatMoney(u.pending_cost_usd, u.currency)}\n\n💬 ${hint}`;
    
    if (ctx.callbackQuery) { 
        await ctx.editMessageText(txt, { parse_mode: "Markdown" }); 
    } else { 
        await ctx.reply(txt, { parse_mode: "Markdown" }); 
    }
}

module.exports = {
    // 🛠️ सर्विस कैटगरी मेनू दिखाना
    servicesMenu: async (ctx) => { 
        await ctx.editMessageText(`🛠️ *Select Platform / प्लेटफार्म चुनें:*`, { reply_markup: getPlatformsKeyboard(), parse_mode: "Markdown" }); 
    },

    // टेलीग्राम लिस्ट दिखाना
    tgMenu: async (ctx) => {
        let t = `🔹 *TELEGRAM SERVICES*\n\n💬 *TELEGRAM REACTIONS*\n`;
        ["5153", "5160", "5161", "5162", "5163", "5164", "5165"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
        t += `\n👀 *TELEGRAM POST VIEWS*\n`; ["1512", "6855"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
        t += `\n👥 *TELEGRAM MEMBERS*\n`; ["7153", "6787", "3274"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
        t += `\n🛒 Order matching code type karein (e.g. /5153)`; 
        await ctx.editMessageText(t, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
    },

    // इंस्टाग्राम लिस्ट दिखाना
    igMenu: async (ctx) => {
        let t = `🔸 *INSTAGRAM SERVICES*\n\n❤️ *INSTAGRAM LIKES*\n`;
        ["7802", "7526", "7374"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
        t += `\n👥 *FOLLOWERS & VIEWS*\n`; ["3602", "1658", "1961", "8810", "8782", "2968", "6634", "7386"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
        t += `\n🛒 Order matching code type karein (e.g. /7802)`; 
        await ctx.editMessageText(t, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
    },

    fbMenu: async (ctx) => { let t = `🟩 *FACEBOOK SERVICES*\n\n`; ["8001", "8002", "8003"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; }); await ctx.editMessageText(t + `\n🛒 Order matching code type karein (e.g. /8001)`, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" }); },
    ytMenu: async (ctx) => { let t = `🔺 *YOUTUBE SERVICES*\n\n`; ["9001", "9002", "9003"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; }); await ctx.editMessageText(t + `\n🛒 Order matching code type karein (e.g. /9001)`, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" }); },

    // जब यूजर /5153 टाइप करे
    handleSlashCode: async (ctx) => { 
        const id = ctx.message.text.slice(1); 
        if (!SERVICES_MASTER_DATA[id]) return; 
        const u = menu.getOrCreateUser(ctx.from.id); 
        u.pending_service = id; 
        u.awaiting_custom_qty = false; 
        await ctx.reply(`👉 *You selected:* ${SERVICES_MASTER_DATA[id].name}\n\n🔢 *Select Your Quantity:*`, { reply_markup: getQuantityKeyboard(id), parse_mode: "Markdown" }); 
    },

    // क्वांटिटी बटन दबाने पर
    handleQtyButtons: async (ctx) => {
        const parts = ctx.callbackQuery.data.split("_");
        const serviceId = parts[1]; 
        const qtyType = parts[2]; 
        const u = menu.getOrCreateUser(ctx.from.id); 
        
        if (qtyType === "custom") { 
            u.awaiting_custom_qty = true; 
            await ctx.editMessageText("🔢 Please type your custom quantity amount:"); 
            return; 
        }
        await proceedToLinkRequest(ctx, u, serviceId, parseInt(qtyType));
    },

    // पेमेंट गेटवे मेनू दिखाना
    addFundsMenu: async (ctx) => { 
        const kb = new InlineKeyboard().text("🇮🇳 Pay via UPI", "pay_via_upi").text("🪙 Pay via USDT", "pay_via_usdt").row().text("⬅️ Back", "back_to_menu"); 
        await ctx.editMessageText("💳 *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: kb, parse_mode: "Markdown" }); 
    },

    initPayMethod: async (ctx) => { 
        const u = menu.getOrCreateUser(ctx.from.id); 
        u.chosen_pay_method = ctx.callbackQuery.data; 
        u.awaiting_deposit_amt = true; 
        await ctx.editMessageText(`💰 *Enter Amount:*\n\n` + (u.chosen_pay_method === "pay_via_upi" ? "कृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:" : "कृपया वह राशि (USD $) टाइप करें जो आप जोड़ना चाहते हैं:")); 
    },

    // टेक्स्ट मैसेज (लिंक या अमाउंट भेजना) हैंडल करना
    handleTextMessages: async (ctx) => {
        const u = menu.getOrCreateUser(ctx.from.id, ctx.from.first_name);
        const txt = ctx.message.text.trim();

        // अगर अमाउंट टाइप किया है (QR जनरेट करना)
        if (u.awaiting_deposit_amt && u.chosen_pay_method) {
            const amt = parseFloat(txt); 
            if (isNaN(amt) || amt <= 0) { await ctx.reply("❌ Invalid amount. Try again:"); return; } 
            u.awaiting_deposit_amt = false; 
            const kb = new InlineKeyboard().text("✅ Payment Done", "p_done").row().text("⬅️ Menu", "back_to_menu");
            
            if (u.chosen_pay_method === "pay_via_upi") {
                const upiRaw = `upi://pay?pa=${config.UPI_ID}&pn=${config.MERCHANT_NAME}&am=${amt.toFixed(2)}&cu=INR`;
                const qrUrl = `https://googleapis.com{encodeURIComponent(upiRaw)}`;
                await ctx.replyWithPhoto(qrUrl, { caption: `🟢 *UPI Automatic QR Code*\n\n💵 *Amount:* ₹${amt.toFixed(2)}\n📍 *UPI ID:* \`${config.UPI_ID}\``, reply_markup: kb, parse_mode: "Markdown" });
                u.total_deposit_usd += (amt / config.USD_TO_INR_RATE);
            } else {
                const qrUrl = `https://googleapis.com{encodeURIComponent(config.USDT_ADDRESS)}`;
                await ctx.replyWithPhoto(qrUrl, { caption: `🪙 *USDT (TRC20) QR Code*\n\n💵 *Amount:* $${amt.toFixed(2)}\n📍 *Address:* \`${config.USDT_ADDRESS}\``, reply_markup: kb, parse_mode: "Markdown" });
                u.total_deposit_usd += amt;
            } 
            return;
        }

        // अगर कस्टम क्वांटिटी टाइप की है
        if (u.awaiting_custom_qty && u.pending_service) { 
            const q = parseInt(txt); 
            if (isNaN(q) || q <= 0) { await ctx.reply("❌ Invalid number:"); return; } 
            u.awaiting_custom_qty = false; 
            await proceedToLinkRequest(ctx, u, u.pending_service, q); 
            return; 
        }

        // अगर लिंक भेजा है (ऑर्डर फाइनल करना)
        if (!u.pending_service || !u.pending_qty) return;
        const id = u.pending_service;
        const sInfo = SERVICES_MASTER_DATA[id]; 
        
        if (!validateLink(txt, sInfo.type)) { await ctx.reply("❌ *Invalid Link Format!*"); return; }
        if (u.balance_usd < u.pending_cost_usd) { await ctx.reply(`❌ *Insufficient Balance!*`); u.pending_service = null; return; }
        
        u.pending_orders++;
        try {
            const res = await axios.post(config.SMM_API_URL, null, { params: { key: config.SMM_API_KEY, action: "add", service: id, link: txt, quantity: u.pending_qty }, timeout: 20000 });
            if (res.data && res.data.order) {
                u.balance_usd -= u.pending_cost_usd; u.spent_usd += u.pending_cost_usd; u.orders_count++; u.pending_orders--; 
                u.history.push({ order_id: res.data.order, service_id: id, qty: u.pending_qty, cost_usd: u.pending_cost_usd, status: "Pending ⏳" });
                
                await ctx.reply(`🎉 *Confirm Order!* ✅\n\n🆔 *Order ID:* \`${res.data.order}\`\n🛠️ *Service:* ${sInfo.name}\n📊 *Quantity:* \`${u.pending_qty}\`\n💰 *Amount:* ${menu.formatMoney(u.pending_cost_usd, u.currency)}\n🔗 *Link:* ${txt}`, { parse_mode: "Markdown" });
        
