const { InlineKeyboard } = require('grammy');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');
const core = require('./bot'); 
let SERVICES_MASTER_DATA = require('./services');

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
        const u = core.getLocalUser(ctx.from.id); await ctx.editMessageText(`👤 *USER PROFILE DETAILS:*\n\n📝 *Name:* ${u.username}\n🆔 *User ID:* \`${ctx.from.id}\`\n\n💳 *Current Balance:* ${core.formatMoneyLocal(u.balance_usd, u.currency)}\n💰 *Total Deposited:* ${core.formatMoneyLocal(u.total_deposit_usd, u.currency)}\n💸 *Total Spent:* ${core.formatMoneyLocal(u.spent_usd, u.currency)}\n\n📦 *Total Orders:* ${u.orders_count}\n⏳ *Pending Orders:* ${u.pending_orders}\n❌ *Cancelled Orders:* ${u.cancelled_orders}`, { reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), parse_mode: "Markdown" });
    });

    bot.callbackQuery("main_orders", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); let txt = `📦 *YOUR ORDERS STATUS & HISTORY:*\n\n📊 *Total Orders:* ${u.orders_count}\n⏳ *Pending Orders:* ${u.pending_orders}\n\n*Last 5 Orders:* \n`;
        if (!u.history || u.history.length === 0) txt += "▫️ No orders placed yet."; else u.history.slice(-5).forEach(o => { txt += `🆔 ID: \`${o.order_id}\` | Qty: ${o.qty} | Status: ${o.status}\n`; });
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

    bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.chosen_pay_method = ctx.callbackQuery.data; u.awaiting_deposit_amt = true;
        if (u.chosen_pay_method === "pay_via_upi") { await ctx.editMessageText(`💰 *Enter Amount:* UPI\n\nकृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (INR ₹) you want to add:`); }
        else { await ctx.editMessageText(`💰 *Enter Amount:* USDT\n\nकृपया वह राशि (USDT) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (USDT) you want to add:`); }
    });

    bot.callbackQuery("user_complete_pay_via_upi", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.awaiting_utr = true; const orderNum = Math.floor(100000 + Math.random() * 900000); u.current_order_num = orderNum;
        await ctx.editMessageText(`💵 *Payment Initiated!* ✅\n\n📊 *Expected Amount:* \`₹${u.current_deposit_amt.toFixed(2)}\`\n🆔 *Order Number:* \`#${orderNum}\`\n\n**⚠️ SUBMIT UTR TRANSACTION ID:**\nBhai, ab apna 12-digit UTR/Reference number niche message box mein type karke send karo aur sath mein payment ka screenshot bhi attach karke bhejo:`, { parse_mode: "Markdown" });
    });

    bot.callbackQuery(/^usdtnet_(bep20|trc20)$/, async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); const network = ctx.callbackQuery.data.split("_"); u.chosen_network = network;
        const address = network === "trc20" ? config.USDT_TRC20 : config.USDT_BEP20;
        const kb = new InlineKeyboard().text("CONFIRM PAYMENT", "usdt_confirm_click").row().text("BACK", "pay_via_usdt");
        await ctx.editMessageText(`🪙 *USDT ${network.toUpperCase()} MANUAL DEPOSIT*\n\n💵 *Amount to Pay:* $${u.current_deposit_amt.toFixed(2)}\n📍 *Address:* \`${address}\`\n\n👉 Address par send karke neeche *CONFIRM PAYMENT* par click karein.`, { reply_markup: kb, parse_mode: "Markdown" });
    });

    bot.callbackQuery("usdt_confirm_click", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.awaiting_utr = true; const orderNum = Math.floor(100000 + Math.random() * 900000); u.current_order_num = orderNum;
        await ctx.editMessageText(`🪙 *USDT Deposit Initiated!* ✅\n\n📊 *Requested Amount:* \`$${u.current_deposit_amt.toFixed(2)}\`\n🌐 *Network:* \`${u.chosen_network.toUpperCase()}\`\n\n**⚠️ SUBMIT TRANSACTION ID:**\nBhai, apni USDT Transaction Hash ID niche message box mein type karke send karo:`, { parse_mode: "Markdown" });
    });

    bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)$/, async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const parts = ctx.callbackQuery.data.split("_"), action = parts, userId = parseInt(parts), refKey = parts;
        const depositData = core.SHARED_DEPOSITS_MAP[refKey]; if (!depositData) return ctx.answerCallbackQuery({ text: "❌ Request expired!", show_alert: true });
        const u = core.getLocalUser(userId);
        if (action === "acc") {
            u.balance_usd += depositData.amount_usd; u.total_deposit_usd += depositData.amount_usd; core.forceSaveDatabase();
            await bot.api.sendMessage(userId, `✅ *Payment Added Successful!* 💰\n\nBhai tumhara payment verify ho gaya hai.\n✨ *Added Amount:* ${core.formatMoneyLocal(depositData.amount_usd, u.currency)}\n💳 *Total Balance:* ${core.formatMoneyLocal(u.balance_usd, u.currency)}`, { parse_mode: "Markdown" });
            await ctx.editMessageText(`✅ Request Accepted for User ${userId}`);
        } else {
            await bot.api.sendMessage(userId, `❌ *Payment Request Cancelled!*`); await ctx.editMessageText(`❌ Cancelled for User ${userId}`);
        } delete core.SHARED_DEPOSITS_MAP[refKey];
    });

    // Admin Commands
    bot.command("admin", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        await ctx.reply(`⚙️ *HAPPY REACTION Super Admin Control Panel*\n\n➕ *Services Control:* \n▫️ \`/addservice ID Rate Type Name\`\n▫️ \`/updateservice ID NewRate\`\n▫️ \`/delservice ID\`\n\n🛡️ *Security Control:* \n▫️ \`/ban USER_ID\` \n▫️ \`/unban USER_ID\` \n\n💰 *Balance Control:* \n▫️ \`/addbalance USER_ID AMOUNT\` \n▫️ \`/deductbalance USER_ID AMOUNT\` \n▫️ \`/checkuser USER_ID\``, { parse_mode: "Markdown" });
    });

    bot.command("ban", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = ctx.message.text.split(" "); if (!target || !core.DYNAMIC_USER_DB[target]) return ctx.reply("❌ User nahi mila!");
        core.DYNAMIC_USER_DB[target].is_banned = true; core.forceSaveDatabase(); await ctx.reply(`🚫 *User ${target} ko BAN kar diya gaya hai!*`);
    });

    bot.command("unban", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = ctx.message.text.split(" "); if (!target || !core.DYNAMIC_USER_DB[target]) return ctx.reply("❌ User nahi mila!");
        core.DYNAMIC_USER_DB[target].is_banned = false; core.forceSaveDatabase(); await ctx.reply(`✅ *User ${target} ko UNBAN kar diya gaya hai!*`);
    });

    bot.command("addbalance", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" "); const target = args, amt = parseFloat(args);
        if (!target || isNaN(amt) || !core.DYNAMIC_USER_DB[target]) return ctx.reply("❌ Format Error!");
        core.DYNAMIC_USER_DB[target].balance_usd += amt; core.forceSaveDatabase(); await ctx.reply(`💰 Added $${amt} to ${target}.`);
        await bot.api.sendMessage(target, `✨ *Admin dwara tumhare account mein $${amt} add kar diye gaye hain!*`);
    });

