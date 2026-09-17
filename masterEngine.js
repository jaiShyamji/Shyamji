const { InlineKeyboard } = require('grammy');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');
const core = require('./bot');

module.exports = (bot) => {
    const getLiveUpi = () => core.DYNAMIC_USER_DB.dynamic_config.upi_id || config.UPI_ID;
    const getLiveTrc = () => core.DYNAMIC_USER_DB.dynamic_config.usdt_trc20 || config.USDT_TRC20;
    const getLiveBep = () => core.DYNAMIC_USER_DB.dynamic_config.usdt_bep20 || config.USDT_BEP20;
    const formatMoneyLocal = (usd, pref) => pref === "INR" ? `₹${(usd * config.USD_TO_INR_RATE).toFixed(2)}` : `$${usd.toFixed(2)}`;

    bot.command("start", m.start); bot.callbackQuery("back_to_menu", m.backMenu); bot.callbackQuery("check_balance", m.checkBalance); bot.callbackQuery("my_profile", m.myProfile); bot.callbackQuery("my_channels", m.myChannels); bot.callbackQuery("main_promo", m.mainPromo); bot.callbackQuery("main_support", m.mainSupport); bot.callbackQuery("toggle_currency", m.toggleCurrency); bot.callbackQuery("main_services", o.servicesMenu); bot.callbackQuery("p_tg", o.tgMenu); bot.callbackQuery("p_ig", o.igMenu); bot.callbackQuery("p_fb", o.fbMenu); bot.callbackQuery("p_yt", o.ytMenu); bot.hears(/^\/\d+\(/, o.handleSlashCode); bot.callbackQuery(/^q_\d+_(.+)\)/, o.handleQtyButtons); bot.callbackQuery("main_orders", o.ordersHistory);

    bot.callbackQuery("main_add_funds", async (ctx) => {
        await ctx.editMessageText("💳 *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: new InlineKeyboard().text("Payment via UPI", "pay_via_upi").text("Payment via USDT", "pay_via_usdt").row().text("BACK", "back_to_menu"), parse_mode: "Markdown" });
    });
    bot.callbackQuery("pay_via_upi", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.chosen_pay_method = "pay_via_upi"; u.awaiting_deposit_amt = true;
        await ctx.editMessageText(`💰 *Enter Amount:* UPI\n\nकृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (INR ₹) you want to add:`);
    });
    bot.callbackQuery("pay_via_usdt", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.chosen_pay_method = "pay_via_usdt"; u.awaiting_deposit_amt = true;
        await ctx.editMessageText(`💰 *Enter Amount:* USDT\n\n¼कृपया वह राशि (USDT) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (USDT) you want to add:`);
    });
    bot.callbackQuery("user_complete_pay_via_upi", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.awaiting_utr = true; u.current_order_num = Math.floor(100000 + Math.random() * 900000);
        await ctx.editMessageText("💵 *Payment Initiated!* ✅\n\n📊 *Expected Amount:* `₹" + u.current_deposit_amt.toFixed(2) + "`\n🆔 *Order Number:* `# " + u.current_order_num + "`\n\n**⚠️ SUBMIT UTR TRANSACTION ID:**\nBhai, ab apna 12-digit UTR number niche message box mein type karke send karo aur payment ka screenshot bhi attach karke bhejo:", { parse_mode: "Markdown" });
    });
    bot.callbackQuery("usdtnet_bep20", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.chosen_network = "bep20";
        await ctx.editMessageText("🪙 *USDT BEP20 MANUAL DEPOSIT*\n\n💵 *Amount to Pay:* \$" + u.current_deposit_amt.toFixed(2) + "\n📍 *Address:* `" + getLiveBep() + "`\n\n👉 Address par send karke neeche *CONFIRM PAYMENT* par click karein.", { reply_markup: new InlineKeyboard().text("CONFIRM PAYMENT", "usdt_confirm_click").row().text("BACK", "main_add_funds"), parse_mode: "Markdown" });
    });
    bot.callbackQuery("usdtnet_trc20", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.chosen_network = "trc20";
        await ctx.editMessageText("🪙 *USDT TRC20 MANUAL DEPOSIT*\n\n💵 *Amount to Pay:* \$" + u.current_deposit_amt.toFixed(2) + "\n📍 *Address:* `" + getLiveTrc() + "`\n\n👉 Address par send karke neeche *CONFIRM PAYMENT* par click karein.", { reply_markup: new InlineKeyboard().text("CONFIRM PAYMENT", "usdt_confirm_click").row().text("BACK", "main_add_funds"), parse_mode: "Markdown" });
    });
    bot.callbackQuery("usdt_confirm_click", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.awaiting_utr = true; u.current_order_num = Math.floor(100000 + Math.random() * 900000);
        await ctx.editMessageText("🪙 *USDT Deposit Initiated!* ✅\n\n📊 *Requested Amount:* `$" + u.current_deposit_amt.toFixed(2) + "`\n🌐 *Network:* `" + u.chosen_network.toUpperCase() + "`\n🆔 *Order Number:* `# " + u.current_order_num + "`\n\n**⚠️ SUBMIT TRANSACTION ID / HASH:**\nBhai, apni USDT Transaction Hash ID niche message box mein type karke send karo:", { parse_mode: "Markdown" });
    });

    bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)\$/, async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const parts = ctx.callbackQuery.data.split("_"), action = parts[1], userId = parseInt(parts[2]), refKey = parts[3];
        const d = core.DYNAMIC_USER_DB.pending_deposits[refKey]; if (!d) return ctx.answerCallbackQuery({ text: "❌ Link Expired!", show_alert: true });
        const u = core.getLocalUser(userId);
        if (action === "acc") {
            u.balance_usd += d.amount_usd; u.total_deposit_usd += d.amount_usd; core.forceSaveDatabase();
            await bot.api.sendMessage(userId, `✅ *Payment Added Successful!* 💰\n\nBhai tumhara payment verify ho gaya hai.\n✨ *Added Amount:* ${formatMoneyLocal(d.amount_usd, u.currency)}\n💳 *Total Balance:* ${formatMoneyLocal(u.balance_usd, u.currency)}`, { parse_mode: "Markdown" });
            await ctx.editMessageText(`✅ Request Accepted for User ${userId}`);
        } else { await bot.api.sendMessage(userId, `❌ *Payment Request Cancelled!*`); await ctx.editMessageText(`❌ Cancelled for User ${userId}`); }
        delete core.DYNAMIC_USER_DB.pending_deposits[refKey]; core.forceSaveDatabase();
    });
};
