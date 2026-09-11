const { InlineKeyboard } = require('grammy');
const axios = require('axios');
const config = require('./config'); // Missing import fix kar diya bhai
const SERVICES_MASTER_DATA = require('./services');
const m = require('./menuHandlers');

const TG_POST_RE = /https:\/\/t\.me\/([A-Za-z0-9_]+)\/(\d+)\/?/;
const TG_CHANNEL_RE = /https:\/\/t\.me\/([A-Za-z0-9_]+)\/?/;
const IG_POST_RE = /https:\/\/(www\.)?instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_\-]+)\/?/;
const IG_PROFILE_RE = /https:\/\/(www\.)?instagram\.com\/([A-Za-z0-9_\.]+)\/?/;

function validateLink(l, t) {
    if (t === "tg_post") return TG_POST_RE.test(l);
    if (t === "tg_channel") return TG_CHANNEL_RE.test(l);
    if (t === "ig_post") return IG_POST_RE.test(l);
    if (t === "ig_profile") return IG_PROFILE_RE.test(l);
    return true;
}

function getPlatformsKeyboard() {
    return new InlineKeyboard()
        .text("🔹 TELEGRAM", "p_tg").text("🔸 INSTAGRAM", "p_ig").row()
        .text("🔺 YOUTUBE", "p_yt").text("🟩 FACEBOOK", "p_fb").row()
        .text("⬅️ Main Menu", "back_to_menu");
}

function getQuantityKeyboard(sid) {
    return new InlineKeyboard()
        .text("100", `q_${sid}_100`).text("200", `q_${sid}_200`).row()
        .text("500", `q_${sid}_500`).text("1000", `q_${sid}_1000`).row()
        .text("5000", `q_${sid}_5000`).text("10000", `q_${sid}_10000`).row()
        .text("⚙️ Custom Amount", `q_${sid}_custom`).row()
        .text("📦 Order History", "main_orders").text("⬅️ Back", "main_services");
}

async function proceedToLinkRequest(ctx, u, serviceId, qty) {
    const sInfo = SERVICES_MASTER_DATA[serviceId]; u.pending_qty = qty; u.pending_cost_usd = (qty / 1000.0) * sInfo.rate;
    let h = `Send ${sInfo.type.startsWith("tg") ? "Telegram" : "Instagram"} Link:`;
    const txt = `📋 *Order Summary*\n\n🛠️ Service: \`${sInfo.name}\`\n📊 Quantity: \`${qty}\`\n💸 Cost: ${m.formatMoney(u.pending_cost_usd, u.currency)}\n\n💬 ${h}`;
    if (ctx.callbackQuery) { await ctx.editMessageText(txt, { parse_mode: "Markdown" }); } else { await ctx.reply(txt, { parse_mode: "Markdown" }); }
}

module.exports = {
    servicesMenu: async (ctx) => { await ctx.editMessageText(`🛠️ *Select Platform / प्लेटफार्म चुनें:*`, { reply_markup: getPlatformsKeyboard(), parse_mode: "Markdown" }); },
    ordersHistory: async (ctx) => {
        const u = m.getOrCreateUser(ctx.from.id);
        let txt = `📦 *YOUR ORDERS STATUS & HISTORY:*\n\n📊 *Total Orders:* ${u.orders_count}\n⏳ *Pending Orders:* ${u.pending_orders}\n\n*Last 5 Orders:* \n`;
        if (u.history.length === 0) txt += "▫️ No orders placed yet.";
        else u.history.slice(-5).forEach(o => { txt += `🆔 ID: \`${o.order_id}\` | Qty: ${o.qty} | Status: ${o.status}\n`; });
        await ctx.editMessageText(txt, { reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), parse_mode: "Markdown" });
    },
    tgMenu: async (ctx) => {
        let t = `🔹 *TELEGRAM SERVICES*\n\n💬 *TELEGRAM REACTIONS*\n`;
        ["5153", "5160", "5161", "5162", "5163", "5164", "5165"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
        t += `\n👀 *TELEGRAM POST VIEWS*\n`; ["1512", "6855"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
        t += `\n👥 *TELEGRAM MEMBERS*\n`; ["7153", "6787", "3274"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
        t += `\n🛒 Order matching code type karein (e.g. /5153)`; await ctx.editMessageText(t, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
    },
    igMenu: async (ctx) => {
        let t = `🔸 *INSTAGRAM SERVICES*\n\n❤️ *INSTAGRAM LIKES*\n`;
        ["7802", "7526", "7374"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
        t += `\n👥 *FOLLOWERS & VIEWS*\n`; ["3602", "1658", "1961", "8810", "8782", "2968", "6634", "7386"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; });
        t += `\n🛒 Order matching code type karein (e.g. /7802)`; await ctx.editMessageText(t, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
    },
    fbMenu: async (ctx) => { let t = `🟩 *FACEBOOK SERVICES*\n\n`; ["8001", "8002", "8003"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; }); await ctx.editMessageText(t + `\n🛒 Order matching code type karein (e.g. /8001)`, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" }); },
    ytMenu: async (ctx) => { let t = `🔺 *YOUTUBE SERVICES*\n\n`; ["9001", "9002", "9003"].forEach(id => { if (SERVICES_MASTER_DATA[id]) t += `▫️ /${id} - ${SERVICES_MASTER_DATA[id].name}\n`; }); await ctx.editMessageText(t + `\n🛒 Order matching code type karein (e.g. /9001)`, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" }); },
    handleSlashCode: async (ctx) => {
        const id = ctx.message.text.slice(1); if (!SERVICES_MASTER_DATA[id]) return;
        const u = m.getOrCreateUser(ctx.from.id); u.pending_service = id; u.awaiting_custom_qty = false;
        await ctx.reply(`👉 *You selected:* ${SERVICES_MASTER_DATA[id].name}\n\n🔢 *Select Your Quantity:*`, { reply_markup: getQuantityKeyboard(id), parse_mode: "Markdown" });
    },
    handleQtyButtons: async (ctx) => {
        const parts = ctx.callbackQuery.data.split("_"), serviceId = parts, qtyType = parts, u = m.getOrCreateUser(ctx.from.id);
        if (qtyType === "custom") { u.awaiting_custom_qty = true; await ctx.editMessageText("🔢 Please type your custom quantity amount:"); return; }
        await proceedToLinkRequest(ctx, u, serviceId, parseInt(qtyType));
    },
    addFundsMenu: async (ctx) => { const kb = new InlineKeyboard().text("🇮🇳 Pay via UPI", "pay_via_upi").text("🪙 Pay via USDT", "pay_via_usdt").row().text("⬅️ Back", "back_to_menu"); await ctx.editMessageText("💳 *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: kb, parse_mode: "Markdown" }); },
    initPayMethod: async (ctx) => { const u = m.getOrCreateUser(ctx.from.id); u.chosen_pay_method = ctx.callbackQuery.data; u.awaiting_deposit_amt = true; await ctx.editMessageText(`💰 *Enter Amount:*\n\n` + (u.chosen_pay_method === "pay_via_upi" ? "कृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:" : "कृपया वह राशि (USD $) टाइप करें जो आप जोड़ना चाहते हैं:")); },
    handleTextMessages: async (ctx) => {
        const u = m.getOrCreateUser(ctx.from.id, ctx.from.first_name); const txt = ctx.message.text.trim();
        if (u.awaiting_deposit_amt && u.chosen_pay_method) {
            const amt = parseFloat(txt); if (isNaN(amt) || amt <= 0) { await ctx.reply("❌ Invalid amount. Try again:"); return; } u.awaiting_deposit_amt = false;
            const kb = new InlineKeyboard().text("✅ Payment Done", "p_done").row().text("⬅️ Menu", "back_to_menu");
            if (u.chosen_pay_method === "pay_via_upi") {
                const upiRaw = `upi://pay?pa=${config.UPI_ID}&pn=${config.MERCHANT_NAME}&am=${amt.toFixed(2)}&cu=INR`;
                const qrUrl = `https://googleapis.com{encodeURIComponent(upiRaw)}`;
                await ctx.replyWithPhoto(qrUrl, { caption: `🟢 *UPI Automatic QR Code*\n\n💵 *Amount:* ₹${amt.toFixed(2)}\n📍 *UPI ID:* \`${config.UPI_ID}\``, reply_markup: kb, parse_mode: "Markdown" });
                u.total_deposit_usd += (amt / config.USD_TO_INR_RATE);
                u.balance_usd += (amt / config.USD_TO_INR_RATE); // Dynamic balance logic
            } else {
                const qrUrl = `https://googleapis.com{encodeURIComponent(config.USDT_ADDRESS)}`;
                await ctx.replyWithPhoto(qrUrl, { caption: `🪙 *USDT (TRC20) QR Code*\n\n💵 *Amount:* $${amt.toFixed(2)}\n📍 *Address:* \`${config.USDT_ADDRESS}\``, reply_markup: kb, parse_mode: "Markdown" });
                u.total_deposit_usd += amt;
                u.balance_usd += amt; // Dynamic balance logic
            } return;
        }
        if (u.awaiting_custom_qty && u.pending_service) {
            const q = parseInt(txt); if (isNaN(q) || q <= 0) { await ctx.reply("❌ Invalid number:"); return; } u.awaiting_custom_qty = false;
            await proceedToLinkRequest(ctx, u, u.pending_service, q); return;
        }
        if (!u.pending_service || !u.pending_qty) return;
        const id = u.pending_service, sInfo = SERVICES_MASTER_DATA[id]; if (!validateLink(txt, sInfo.type)) { await ctx.reply("❌ *Invalid Link Format!*"); return; }
        if (u.balance_usd < u.pending_cost_usd) { await ctx.reply(`❌ *Insufficient Balance!*`); u.pending_service = null; return; }
        u.pending_orders++;
        try {
            const res = await axios.post(config.SMM_API_URL, null, { params: { key: config.SMM_API_KEY, action: "add", service: id, link: txt, quantity: u.pending_qty }, timeout: 20000 });
            if (res.data && res.data.order) {
                u.balance_usd -= u.pending_cost_usd; u.spent_usd += u.pending_cost_usd; u.orders_count++; u.pending_orders--;
                u.history.push({ order_id: res.data.order, service_id: id, qty: u.pending_qty, cost_usd: u.pending_cost_usd, status: "Pending ⏳" });
                await ctx.reply(`🎉 *Confirm Order!* ✅\n\n🆔 *Order ID:* \`${res.data.order}\`\n🛠️ *Service:* ${sInfo.name}\n📊 *Quantity:* \`${u.pending_qty}\`\n💰 *Amount:* ${m.formatMoney(u.pending_cost_usd, u.currency)}\n🔗 *Link:* ${txt}`, { parse_mode: "Markdown" });
            } else { u.pending_orders--; u.cancelled_orders++; await ctx.reply(`❌ Failed: ${res.data?.error || "Error"}`); }
        } catch (e) { u.pending_orders--; await ctx.reply("❌ API Error."); }
