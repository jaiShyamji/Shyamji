const { InlineKeyboard } = require('grammy');
const config = require('./config');
const o = require('./orderHandlers');
const core = require('./bot');

module.exports = (bot) => {
    bot.command("start", async (ctx) => {
        core.getLocalUser(ctx.from.id, ctx.from.first_name);
        await ctx.reply(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: new InlineKeyboard().text("BALANCE", "check_balance").text("ADD FUND", "main_add_funds").row().text("MY CHANNEL", "my_channels").text("SERVICE", "main_services").row().text("MY ORDERS", "main_orders").text("MY PROFILE", "my_profile").row().text("PROMOTION", "main_promo").text("SUPPORT", "main_support").row().text("CURRENCY", "toggle_currency"), parse_mode: "Markdown" });
    });

    bot.callbackQuery("back_to_menu", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.awaiting_deposit_amt = false; u.awaiting_utr = false;
        await ctx.editMessageText(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: new InlineKeyboard().text("BALANCE", "check_balance").text("ADD FUND", "main_add_funds").row().text("MY CHANNEL", "my_channels").text("SERVICE", "main_services").row().text("MY ORDERS", "main_orders").text("MY PROFILE", "my_profile").row().text("PROMOTION", "main_promo").text("SUPPORT", "main_support").row().text("CURRENCY", "toggle_currency"), parse_mode: "Markdown" });
    });

    bot.callbackQuery("check_balance", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); await ctx.editMessageText(`💰 *Your Balance Details:*\n\n💵 *Current Balance:* ${core.formatMoneyLocal(u.balance_usd, u.currency)}\n💳 *Total Deposited:* ${core.formatMoneyLocal(u.total_deposit_usd, u.currency)}`, { reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), parse_mode: "Markdown" });
    });

    bot.callbackQuery("my_profile", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); await ctx.editMessageText(`👤 *USER PROFILE DETAILS:*\n\n📝 *Name:* ${u.username}\n🆔 *User ID:* \`\${ctx.from.id}\`\n\n💳 *Current Balance:* ${core.formatMoneyLocal(u.balance_usd, u.currency)}\n💰 *Total Deposited:* ${core.formatMoneyLocal(u.total_deposit_usd, u.currency)}\n💸 *Total Spent:* ${core.formatMoneyLocal(u.spent_usd, u.currency)}\n\n📦 *Total Orders:* ${u.orders_count}\n⏳ *Pending Orders:* ${u.pending_orders}\n❌ *Cancelled Orders:* ${u.cancelled_orders}`, { reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), parse_mode: "Markdown" });
    });

    bot.callbackQuery("main_orders", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); let txt = `📦 *YOUR ORDERS STATUS & HISTORY:*\n\n📊 *Total Orders:* ${u.orders_count}\n⏳ *Pending Orders:* ${u.pending_orders}\n\n*Last 5 Orders:* \n`;
        if (!u.history || u.history.length === 0) txt += "▫️ No orders placed yet."; else u.history.slice(-5).forEach(o => { txt += `🆔 ID: \`\${o.order_id}\` | Qty: ${o.qty} | Status: ${o.status}\n`; });
        await ctx.editMessageText(txt, { reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), parse_mode: "Markdown" });
    });

    bot.callbackQuery("toggle_currency", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.currency = u.currency === "USD" ? "INR" : "USD"; core.forceSaveDatabase();
        await ctx.editMessageText(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: new InlineKeyboard().text("BALANCE", "check_balance").text("ADD FUND", "main_add_funds").row().text("MY CHANNEL", "my_channels").text("SERVICE", "main_services").row().text("MY ORDERS", "main_orders").text("MY PROFILE", "my_profile").row().text("PROMOTION", "main_promo").text("SUPPORT", "main_support").row().text("CURRENCY", "toggle_currency"), parse_mode: "Markdown" });
    });

    bot.callbackQuery("main_add_funds", async (ctx) => {
        const kb = new InlineKeyboard().text("Payment via UPI", "pay_via_upi").text("Payment via USDT", "pay_via_usdt").row().text("BACK", "back_to_menu");
        await ctx.editMessageText("💳 *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: kb, parse_mode: "Markdown" });
    });

    bot.callbackQuery("pay_via_upi", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.chosen_pay_method = "pay_via_upi"; u.awaiting_deposit_amt = true;
        await ctx.editMessageText(`💰 *Enter Amount:* UPI\n\nकृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (INR ₹) you want to add:`);
    });

    bot.callbackQuery("pay_via_usdt", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.chosen_pay_method = "pay_via_usdt"; u.awaiting_deposit_amt = true;
        await ctx.editMessageText(`💰 *Enter Amount:* USDT\n\nकृपया वह राशि (USDT) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (USDT) you want to add:`);
    });

    // 🌟 1. UPI CONFIRM PAYMENT LAYOUT STRINGS FIXED 100%
    bot.callbackQuery("user_complete_pay_via_upi", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.awaiting_utr = true; 
        const orderNum = Math.floor(100000 + Math.random() * 900000); u.current_order_num = orderNum;
        
        await ctx.editMessageText("💵 *Payment Initiated!* ✅\n\n📊 *Expected Amount:* `₹" + u.current_deposit_amt.toFixed(2) + "`\n🆔 *Order Number:* `# " + orderNum + "`\n\n**⚠️ SUBMIT UTR TRANSACTION ID:**\nBhai, ab apna 12-digit UTR/Reference number niche message box mein type karke send karo aur sath mein payment ka screenshot bhi attach karke bhejo:", { parse_mode: "Markdown" });
    });

    // 🪙 2. USDT TRC20 & BEP20 WALLET ADDRESS RENDER LINES 100% FIXED
    bot.callbackQuery("usdtnet_bep20", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.chosen_network = "bep20";
        const kb = new InlineKeyboard().text("CONFIRM PAYMENT", "usdt_confirm_click").row().text("BACK", "main_add_funds");
        
        await ctx.editMessageText("🪙 *USDT BEP20 MANUAL DEPOSIT*\n\n💵 *Amount to Pay:* \$" + u.current_deposit_amt.toFixed(2) + "\n📍 *Address:* `" + config.USDT_BEP20 + "`\n\n👉 *Instructions:* Diye gaye Address par exactly \$" + u.current_deposit_amt.toFixed(2) + " send karke neeche *CONFIRM PAYMENT* par click karein.", { reply_markup: kb, parse_mode: "Markdown" });
    });

    bot.callbackQuery("usdtnet_trc20", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.chosen_network = "trc20";
        const kb = new InlineKeyboard().text("CONFIRM PAYMENT", "usdt_confirm_click").row().text("BACK", "main_add_funds");
        
        await ctx.editMessageText("🪙 *USDT TRC20 MANUAL DEPOSIT*\n\n💵 *Amount to Pay:* \$" + u.current_deposit_amt.toFixed(2) + "\n📍 *Address:* `" + config.USDT_TRC20 + "`\n\n👉 *Instructions:* Diye gaye Address par exactly \$" + u.current_deposit_amt.toFixed(2) + " send karke neeche *CONFIRM PAYMENT* par click karein.", { reply_markup: kb, parse_mode: "Markdown" });
    });

    // 🪙 3. USDT CONFIRM PAYMENT LAYOUT STRINGS FIXED 100%
    bot.callbackQuery("usdt_confirm_click", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.awaiting_utr = true; 
        const orderNum = Math.floor(100000 + Math.random() * 900000); u.current_order_num = orderNum;
        
        await ctx.editMessageText("🪙 *USDT Deposit Initiated!* ✅\n\n📊 *Requested Amount:* `$" + u.current_deposit_amt.toFixed(2) + "`\n🌐 *Network:* `" + u.chosen_network.toUpperCase() + "`\n🆔 *Order Number:* `# " + orderNum + "`\n\n**⚠️ SUBMIT TRANSACTION ID / HASH:**\nBhai, apni USDT Transaction Hash ID niche message box mein type karke send karo:", { parse_mode: "Markdown" });
    });

    bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)\$/, async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const parts = ctx.callbackQuery.data.split("_");
        const action = parts, userId = parseInt(parts), refKey = parts;
        const depositData = core.DYNAMIC_USER_DB.pending_deposits[refKey]; if (!depositData) return ctx.answerCallbackQuery({ text: "❌ Request expired!", show_alert: true });

        const u = core.getLocalUser(userId);
        if (action === "acc") {
            u.balance_usd += depositData.amount_usd; u.total_deposit_usd += depositData.amount_usd; core.forceSaveDatabase();
            await bot.api.sendMessage(userId, `✅ *Payment Added Successful!* 💰\n\nBhai tumhara payment verify ho gaya hai.\n✨ *Added Amount:* ${core.formatMoneyLocal(depositData.amount_usd, u.currency)}\n💳 *Total Balance:* ${core.formatMoneyLocal(u.balance_usd, u.currency)}`, { parse_mode: "Markdown" });
            await ctx.editMessageText(`✅ Request Accepted for User ${userId}`);
        } else {
            await bot.api.sendMessage(userId, `❌ *Payment Request Cancelled!*`); await ctx.editMessageText(`❌ Cancelled for User ${userId}`);
        } delete core.DYNAMIC_USER_DB.pending_deposits[refKey]; core.forceSaveDatabase();
    });
};
