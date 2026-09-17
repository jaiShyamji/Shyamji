const { InlineKeyboard } = require('grammy');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');
const core = require('./bot');
let SERVICES_MASTER_DATA = require('./services');

module.exports = (bot) => {
    const getLiveUpi = () => core.DYNAMIC_USER_DB.dynamic_config.upi_id || config.UPI_ID;
    const getLiveTrc = () => core.DYNAMIC_USER_DB.dynamic_config.usdt_trc20 || config.USDT_TRC20;
    const getLiveBep = () => core.DYNAMIC_USER_DB.dynamic_config.usdt_bep20 || config.USDT_BEP20;
    const formatMoneyLocal = (usd, pref) => pref === "INR" ? `₹${(usd * config.USD_TO_INR_RATE).toFixed(2)}` : `$${usd.toFixed(2)}`;

    bot.command("start", m.start); bot.callbackQuery("back_to_menu", m.backMenu); bot.callbackQuery("check_balance", m.checkBalance); bot.callbackQuery("my_profile", m.myProfile); bot.callbackQuery("my_channels", m.myChannels); bot.callbackQuery("main_promo", m.mainPromo); bot.callbackQuery("main_support", m.mainSupport); bot.callbackQuery("toggle_currency", m.toggleCurrency); bot.callbackQuery("main_services", o.servicesMenu); bot.callbackQuery("p_tg", o.tgMenu); bot.callbackQuery("p_ig", o.igMenu); bot.callbackQuery("p_fb", o.fbMenu); bot.callbackQuery("p_yt", o.ytMenu); bot.hears(/^\/\d+$/, o.handleSlashCode); bot.callbackQuery(/^q_\d+_(.+)$/, o.handleQtyButtons); bot.callbackQuery("main_orders", o.ordersHistory);

    bot.callbackQuery("main_add_funds", async (ctx) => {
        await ctx.editMessageText("💳 *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: new InlineKeyboard().text("Payment via UPI", "pay_via_upi").text("Payment via USDT", "pay_via_usdt").row().text("BACK", "back_to_menu"), parse_mode: "Markdown" });
    });
    bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.chosen_pay_method = ctx.callbackQuery.data; u.awaiting_deposit_amt = true;
        await ctx.editMessageText(u.chosen_pay_method === "pay_via_upi" ? `💰 *Enter Amount:* UPI\n\nकृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (INR ₹) you want to add:` : `💰 *Enter Amount:* USDT\n\nकृपया वह राशि (USDT) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (USDT) you want to add:`);
    });
    bot.callbackQuery("user_complete_pay_via_upi", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.awaiting_utr = true; u.current_order_num = Math.floor(100000 + Math.random() * 900000);
        await ctx.editMessageText("💵 *Payment Initiated!* ✅\n\n📊 *Expected Amount:* `₹" + u.current_deposit_amt.toFixed(2) + "`\n🆔 *Order Number:* `# " + u.current_order_num + "`\n\n**⚠️ SUBMIT UTR TRANSACTION ID:**\nBhai, ab apna 12-digit UTR/Reference number niche message box mein type karke send karo:", { parse_mode: "Markdown" });
    });
    bot.callbackQuery("usdtnet_bep20", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.chosen_network = "bep20";
        await ctx.editMessageText("🪙 *USDT BEP20 MANUAL DEPOSIT*\n\n💵 *Amount:* $" + u.current_deposit_amt.toFixed(2) + "\n📍 *Address:* `" + getLiveBep() + "`\n\n👉 Address par send karke neeche *CONFIRM PAYMENT* par click karein.", { reply_markup: new InlineKeyboard().text("CONFIRM PAYMENT", "usdt_confirm_click").row().text("BACK", "main_add_funds"), parse_mode: "Markdown" });
    });
    bot.callbackQuery("usdtnet_trc20", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.chosen_network = "trc20";
        await ctx.editMessageText("🪙 *USDT TRC20 MANUAL DEPOSIT*\n\n💵 *Amount:* $" + u.current_deposit_amt.toFixed(2) + "\n📍 *Address:* `" + getLiveTrc() + "`\n\n👉 Address par send karke neeche *CONFIRM PAYMENT* par click karein.", { reply_markup: new InlineKeyboard().text("CONFIRM PAYMENT", "usdt_confirm_click").row().text("BACK", "main_add_funds"), parse_mode: "Markdown" });
    });
    bot.callbackQuery("usdt_confirm_click", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.awaiting_utr = true; u.current_order_num = Math.floor(100000 + Math.random() * 900000);
        await ctx.editMessageText("🪙 *USDT Deposit Initiated!* ✅\n\n📊 *Amount:* `$" + u.current_deposit_amt.toFixed(2) + "`\n🌐 *Network:* `" + u.chosen_network.toUpperCase() + "`\n🆔 *Order:* `# " + u.current_order_num + "`\n\n**⚠️ SUBMIT HASH ID:**\nBhai, apni USDT Transaction Hash ID niche message box mein type karke send karo:", { parse_mode: "Markdown" });
    });

    bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)$/, async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const parts = ctx.callbackQuery.data.split("_"), action = parts, userId = parseInt(parts), refKey = parts;
        const d = core.DYNAMIC_USER_DB.pending_deposits[refKey]; if (!d) return ctx.answerCallbackQuery({ text: "❌ Link Expired!", show_alert: true });
        const u = core.getLocalUser(userId);
        if (action === "acc") {
            u.balance_usd += d.amount_usd; u.total_deposit_usd += d.amount_usd; core.forceSaveDatabase();
            await bot.api.sendMessage(userId, `✅ *Payment Added Successful!* 💰\n\nBhai tumhara payment verify ho gaya hai.\n✨ *Added Amount:* ${formatMoneyLocal(d.amount_usd, u.currency)}\n💳 *Total Balance:* ${formatMoneyLocal(u.balance_usd, u.currency)}`, { parse_mode: "Markdown" });
            await ctx.editMessageText(`✅ Request Accepted for User ${userId}`);
        } else { await bot.api.sendMessage(userId, `❌ *Payment Request Cancelled!*`); await ctx.editMessageText(`❌ Cancelled for User ${userId}`); }
        delete core.DYNAMIC_USER_DB.pending_deposits[refKey]; core.forceSaveDatabase();
    });

    bot.command("admin", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        await ctx.reply(`⚙️ *HAPPY REACTION Super Admin Control Panel*\n\n➕ *User Matrix Controls:*\n▫️ \`/ban USER_ID\` \n▫️ \`/unban USER_ID\` \n▫️ \`/addbalance USER_ID AMOUNT\` \n▫️ \`/deductbalance USER_ID AMOUNT\` \n▫️ \`/checkuser USER_ID\`\n\n🛠️ *SMM Live Controls:*\n▫️ \`/addservice ID Rate Type Name\`\n▫️ \`/updateservice ID NewRate\`\n▫️ \`/delservice ID\`\n\n💳 *Payment Credentials Controls:*\n▫️ \`/setupi NEW_UPI_ID\` \n▫️ \`/settrc20 WALLET_ADDRESS\` \n▫️ \`/setbep20 WALLET_ADDRESS\``, { parse_mode: "Markdown" });
    });
    bot.command("ban", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = parseInt(ctx.message.text.split(" ")); if (isNaN(target) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ ID nahi mili!");
        core.DYNAMIC_USER_DB.users[target].is_banned = true; core.forceSaveDatabase(); await ctx.reply(`🚫 User \`${target}\` BAN ho gaya hai.`);
    });
    bot.command("unban", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = parseInt(ctx.message.text.split(" ")); if (isNaN(target) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ ID nahi mili!");
        core.DYNAMIC_USER_DB.users[target].is_banned = false; core.forceSaveDatabase(); await ctx.reply(`✅ User \`${target}\` UNBAN ho gaya hai.`);
    });
    bot.command("addbalance", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" "), target = parseInt(args), amt = parseFloat(args);
        if (isNaN(target) || isNaN(amt) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Format: \`/addbalance USER_ID AMOUNT\`");
        core.DYNAMIC_USER_DB.users[target].balance_usd += amt; core.forceSaveDatabase(); await ctx.reply("💰 *Successfully Added $*" + amt.toFixed(2) + " *to User:* `" + target + "`");
        try { await bot.api.sendMessage(target, "✨ *Admin dwara tumhare account mein $*" + amt.toFixed(2) + " *add kar diye gaye hain!*"); } catch(e) {}
    });
    bot.command("deductbalance", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" "), target = parseInt(args), amt = parseFloat(args);
        if (isNaN(target) || isNaN(amt) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Format: \`/deductbalance USER_ID AMOUNT\`");
        core.DYNAMIC_USER_DB.users[target].balance_usd -= amt; if (core.DYNAMIC_USER_DB.users[target].balance_usd < 0) core.DYNAMIC_USER_DB.users[target].balance_usd = 0; core.forceSaveDatabase();
        await ctx.reply("💸 *Successfully Deducted $*" + amt.toFixed(2) + " *from User:* `" + target + "`");
    });
    bot.command("checkuser", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = parseInt(ctx.message.text.split(" ")); if (isNaN(target) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ User nahi mila!");
        const u = core.DYNAMIC_USER_DB.users[target];
        await ctx.reply("👤 *USER PROFILE (ID: " + target + ")*\n\n💵 *Balance:* $" + u.balance_usd.toFixed(2) + " (" + formatMoneyLocal(u.balance_usd, "INR") + ")\n💰 *Deposit:* $" + u.total_deposit_usd.toFixed(2) + "\n💸 *Spent:* $" + u.spent_usd.toFixed(2) + "\n📦 *Orders:* " + u.orders_count + "\n⏳ *Pending:* " + u.pending_orders + "\n🛑 *Status:* " + (u.is_banned ? "BANNED" : "ACTIVE"), { parse_mode: "Markdown" });
    });
    bot.command("setupi", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const newUpi = ctx.message.text.split(" "); if (!newUpi) return ctx.reply("❌ Format: \`/setupi NEW_UPI_ID\`");
        core.DYNAMIC_USER_DB.dynamic_config.upi_id = newUpi; core.forceSaveDatabase(); await ctx.reply(`✅ *Live UPI ID Updated to:* \`${newUpi}\``);
    });
    bot.command("settrc20", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const newWallet = ctx.message.text.split(" "); if (!newWallet) return ctx.reply("❌ Format: \`/settrc20 WALLET_ADDRESS\`");
        core.DYNAMIC_USER_DB.dynamic_config.usdt_trc20 = newWallet; core.forceSaveDatabase(); await ctx.reply(`🪙 *USDT TRC20 Address Updated!*`);
    });
