module.exports.handleQtyButtons = async (ctx) => {
    const parts = ctx.callbackQuery.data.split("_"), serviceId = parts[1], qtyType = parts[2], u = getOrCreateUser(ctx.from.id);
    if (qtyType === "custom") { u.awaiting_custom_qty = true; await ctx.editMessageText("🔢 Please type your custom quantity amount:"); return; }
    await proceedToLinkRequest(ctx, u, serviceId, parseInt(qtyType));
};

module.exports.addFundsMenu = async (ctx) => { const kb = new InlineKeyboard().text("🇮🇳 Pay via UPI", "pay_via_upi").text("🪙 Pay via USDT", "pay_via_usdt").row().text("⬅️ Back", "back_to_menu"); await ctx.editMessageText("💳 *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: kb, parse_mode: "Markdown" }); };

module.exports.initPayMethod = async (ctx) => { const u = getOrCreateUser(ctx.from.id); u.chosen_pay_method = ctx.callbackQuery.data; u.awaiting_deposit_amt = true; await ctx.editMessageText(`💰 *Enter Amount:*\n\n` + (u.chosen_pay_method === "pay_via_upi" ? "कृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:" : "कृपया वह राशि (USD $) टाइप करें जो आप जोड़ना चाहते हैं:")); };

module.exports.handleTextMessages = async (ctx) => {
    const u = getOrCreateUser(ctx.from.id), txt = ctx.message.text.trim();
    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
        const amt = parseFloat(txt); if (isNaN(amt) || amt <= 0) { await ctx.reply("❌ Invalid amount. Try again:"); return; } u.awaiting_deposit_amt = false; const kb = new InlineKeyboard().text("✅ Payment Done", "p_done").row().text("⬅️ Menu", "back_to_menu");
        if (u.chosen_pay_method === "pay_via_upi") {
            const upiRaw = `upi://pay?pa=${config.UPI_ID}&pn=${config.MERCHANT_NAME}&am=${amt.toFixed(2)}&cu=INR`;
            const qrUrl = `https://googleapis.com{encodeURIComponent(upiRaw)}`;
            await ctx.replyWithPhoto(qrUrl, { caption: `🟢 *UPI Automatic QR Code*\n\n💵 *Amount:* ₹${amt.toFixed(2)}\n📍 *UPI ID:* \`${config.UPI_ID}\``, reply_markup: kb, parse_mode: "Markdown" });
        } else {
            const qrUrl = `https://googleapis.com{encodeURIComponent(config.USDT_ADDRESS)}`;
            await ctx.replyWithPhoto(qrUrl, { caption: `🪙 *USDT (TRC20) QR Code*\n\n💵 *Amount:* $${amt.toFixed(2)}\n📍 *Address:* \`${config.USDT_ADDRESS}\``, reply_markup: kb, parse_mode: "Markdown" });
        } return;
    }
    if (u.awaiting_custom_qty && u.pending_service) { const q = parseInt(txt); if (isNaN(q) || q <= 0) { await ctx.reply("❌ Invalid number:"); return; } u.awaiting_custom_qty = false; await proceedToLinkRequest(ctx, u, u.pending_service, q); return; }
    if (!u.pending_service || !u.pending_qty) return;
    const id = u.pending_service, sInfo = SERVICES_MASTER_DATA[id]; if (!validateLink(txt, sInfo.type)) { await ctx.reply("❌ *Invalid Link Format!*"); return; }
    if (u.balance_usd < u.pending_cost_usd) { await ctx.reply(`❌ *Insufficient Balance!*`); u.pending_service = null; return; }
    try {
        const res = await axios.post(config.SMM_API_URL, null, { params: { key: config.SMM_API_KEY, action: "add", service: id, link: txt, quantity: u.pending_qty }, timeout: 20000 });
        if (res.data && res.data.order) {
            u.balance_usd -= u.pending_cost_usd; u.spent_usd += u.pending_cost_usd; u.orders_count++; u.history.push({ order_id: res.data.order, service_id: id, qty: u.pending_qty, cost_usd: u.pending_cost_usd, status: "Success ✅" });
            await ctx.reply(`🎉 *Confirm Order!* ✅\n\n🆔 *Order ID:* \`${res.data.order}\`\n🛠️ *Service:* ${sInfo.name}\n📊 *Quantity:* \`${u.pending_qty}\`\n💰 *Amount:* ${formatMoney(u.pending_cost_usd, u.currency)}\n🔗 *Link:* ${txt}`, { parse_mode: "Markdown" });
        } else { await ctx.reply(`❌ Failed: ${res.data?.error || "Error"}`); }
    } catch (e) { await ctx.reply("❌ API Error."); }
    u.pending_service = null; u.pending_qty = null; u.pending_cost_usd = null;
};

module.exports.payDone = async (ctx) => { await ctx.reply(`💌 *Registered!* Send screenshot to @${config.SUPPORT_USERNAME}`); };

module.exports.ordersHistory = async (ctx) => {
    const u = getOrCreateUser(ctx.from.id); let txt = `📦 *Your Order History:*\n\nTotal: ${u.orders_count}\n\n`;
    if (u.history.length === 0) txt += "No orders."; else u.history.slice(-5).forEach(o => { txt += `🆔 ID: ${o.order_id} | Qty: ${o.qty} (${o.status})\n`; });
    await ctx.editMessageText(txt, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services"), parse_mode: "Markdown" });
};

module.exports.toggleCurrency = async (ctx) => { 
    const u = getOrCreateUser(ctx.from.id); u.currency = u.currency === "USD" ? "INR" : "USD"; 
    await ctx.answerCallbackQuery({ text: `Set: ${u.currency}` }); 
    const mainKb = new InlineKeyboard().text("🛠️ Services", "main_services").text("💳 Add Funds", "main_add_funds").row().text("📦 My Orders", "main_orders").text("🔄 Change Currency", "toggle_currency");
    await ctx.editMessageText(`💳 Balance: ${formatMoney(u.balance_usd, u.currency)}`, { reply_markup: mainKb }); 
};
