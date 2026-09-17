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

    // 👑 1. ADMIN PANEL HELP SHEETS
    bot.command("admin", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        await ctx.reply(`⚙️ *HAPPY REACTION Super Admin Control Panel*\n\n➕ *User Matrix Controls:*\n▫️ \`/ban USER_ID\` \n▫️ \`/unban USER_ID\` \n▫️ \`/addbalance USER_ID AMOUNT\` \n▫️ \`/deductbalance USER_ID AMOUNT\` \n▫️ \`/checkuser USER_ID\` -> Check total metrics\n\n🛠️ *SMM Live Controls:*\n▫️ \`/addservice ID Rate Type Name\`\n▫️ \`/updateservice ID NewRate\`\n▫️ \`/delservice ID\`\n\n💳 *Payment Credentials Controls:*\n▫️ \`/setupi NEW_UPI_ID\` \n▫️ \`/settrc20 WALLET_ADDRESS\` \n▫️ \`/setbep20 WALLET_ADDRESS\``, { parse_mode: "Markdown" });
    });

    // 👑 2. BAN / UNBAN CONTROLS FIXED STRICTLY
    bot.command("ban", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = parseInt(ctx.message.text.replace("/ban", "").trim()); if (isNaN(target) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ ID nahi mili!");
        core.DYNAMIC_USER_DB.users[target].is_banned = true; core.forceSaveDatabase(); await ctx.reply(`🚫 User \`${target}\` BAN ho gaya hai.`);
    });
    bot.command("unban", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = parseInt(ctx.message.text.replace("/unban", "").trim()); if (isNaN(target) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ ID nahi mili!");
        core.DYNAMIC_USER_DB.users[target].is_banned = false; core.forceSaveDatabase(); await ctx.reply(`✅ User \`${target}\` UNBAN ho gaya hai.`);
    });

    // 👑 3. PAYMENT ADD & DEDUCT WITH DYNAMIC LAYOUTS FIXED
    bot.command("addbalance", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.replace("/addbalance", "").trim().split(" "), target = parseInt(args[0]), amt = parseFloat(args[1]);
        if (isNaN(target) || isNaN(amt) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Format: \`/addbalance USER_ID AMOUNT\`");
        core.DYNAMIC_USER_DB.users[target].balance_usd += amt; core.forceSaveDatabase();
        await ctx.reply("💰 *Successfully Added $*" + amt.toFixed(2) + " *to User:* `" + target + "`", { parse_mode: "Markdown" });
        try { await bot.api.sendMessage(target, "✨ *Admin dwara tumhare account mein $*" + amt.toFixed(2) + " *add kar diye gaye hain!*"); } catch(e) {}
    });
    bot.command("deductbalance", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.replace("/deductbalance", "").trim().split(" "), target = parseInt(args[0]), amt = parseFloat(args[1]);
        if (isNaN(target) || isNaN(amt) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Format: \`/deductbalance USER_ID AMOUNT\`");
        core.DYNAMIC_USER_DB.users[target].balance_usd -= amt; if (core.DYNAMIC_USER_DB.users[target].balance_usd < 0) core.DYNAMIC_USER_DB.users[target].balance_usd = 0; core.forceSaveDatabase();
        await ctx.reply("💸 *Successfully Deducted $*" + amt.toFixed(2) + " *from User:* `" + target + "`", { parse_mode: "Markdown" });
    });

    // 👑 4. TOTAL PROFILE AND ORDERS COUNTS METRICS CHECKER FIXED
    bot.command("checkuser", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = parseInt(ctx.message.text.replace("/checkuser", "").trim()); if (isNaN(target) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ User nahi mila!");
        const u = core.DYNAMIC_USER_DB.users[target];
        await ctx.reply("👤 *USER PROFILE (ID: " + target + ")*\n\n💵 *Balance:* $" + u.balance_usd.toFixed(2) + " (" + formatMoneyLocal(u.balance_usd, "INR") + ")\n💰 *Total Deposit:* $" + u.total_deposit_usd.toFixed(2) + "\n💸 *Total Spent:* $" + u.spent_usd.toFixed(2) + "\n📦 *Total Orders:* " + u.orders_count + "\n⏳ *Pending Orders:* " + u.pending_orders + "\n🛑 *Status:* " + (u.is_banned ? "BANNED" : "ACTIVE"), { parse_mode: "Markdown" });
    });

    // 👑 5. LIVE SMM SERVICES MANAGER UPDATER
    bot.command("addservice", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.replace("/addservice", "").trim().split(" "); if (args.length < 4) return ctx.reply("❌ Format: \`/addservice ID Rate Type Name\`");
        const id = args[0], rate = parseFloat(args[1]), type = args[2], name = args.slice(3).join(" ");
        SERVICES_MASTER_DATA[id] = { name: name, rate: rate, type: type }; fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8'); await ctx.reply(`✅ Service Added successfully!`);
    });
    bot.command("updateservice", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.replace("/updateservice", "").trim().split(" "), id = args[0], newRate = parseFloat(args[1]);
        if (!SERVICES_MASTER_DATA[id] || isNaN(newRate)) return ctx.reply("❌ Not found / Invalid rate!");
        SERVICES_MASTER_DATA[id].rate = newRate; fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8'); await ctx.reply(`✅ Rate Updated successfully!`);
    });
    bot.command("delservice", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const id = ctx.message.text.replace("/delservice", "").trim(); if (!id || !SERVICES_MASTER_DATA[id]) return ctx.reply("❌ ID nahi mili!");
        delete SERVICES_MASTER_DATA[id]; fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8'); await ctx.reply(`❌ Service Deleted successfully!`);
    });

    // 👑 6. EDIT CONFIG CREDENTIALS LIVE
    bot.command("setupi", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const newUpi = ctx.message.text.replace("/setupi", "").trim(); if (!newUpi) return ctx.reply("❌ Format Error!");
        core.DYNAMIC_USER_DB.dynamic_config.upi_id = newUpi; core.forceSaveDatabase(); await ctx.reply(`✅ *Live UPI ID Updated to:* \`${newUpi}\``, { parse_mode: "Markdown" });
    });
    bot.command("settrc20", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const addr = ctx.message.text.replace("/settrc20", "").trim(); if (!addr) return ctx.reply("❌ Error!");
        core.DYNAMIC_USER_DB.dynamic_config.usdt_trc20 = addr; core.forceSaveDatabase(); await ctx.reply(`🪙 *USDT TRC20 Address Updated!*`);
    });
    bot.command("setbep20", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const addr = ctx.message.text.replace("/setbep20", "").trim(); if (!addr) return ctx.reply("❌ Error!");
        core.DYNAMIC_USER_DB.dynamic_config.usdt_bep20 = addr; core.forceSaveDatabase(); await ctx.reply(`🪙 *USDT BEP20 Address Updated!*`);
    });

    // Normal Callback Menu Buttons Binding bhai
    bot.command("start", m.start); bot.callbackQuery("back_to_menu", m.backMenu); bot.callbackQuery("check_balance", m.checkBalance); bot.callbackQuery("my_profile", m.myProfile); bot.callbackQuery("my_channels", m.myChannels); bot.callbackQuery("main_promo", m.mainPromo); bot.callbackQuery("main_support", m.mainSupport); bot.callbackQuery("toggle_currency", m.toggleCurrency); bot.callbackQuery("main_services", o.servicesMenu); bot.callbackQuery("p_tg", o.tgMenu); bot.callbackQuery("p_ig", o.igMenu); bot.callbackQuery("p_fb", o.fbMenu); bot.callbackQuery("p_yt", o.ytMenu); bot.hears(/^\/\d+$/, o.handleSlashCode); bot.callbackQuery(/^q_\d+_(.+)$/, o.handleQtyButtons); bot.callbackQuery("main_orders", o.ordersHistory);

    // 🟢 DYNAMIC GATEWAY CONTROLS UNFREEZED PERMANENTLY HERE BYHAI
    bot.callbackQuery("main_add_funds", async (ctx) => {
        await ctx.editMessageText("💳 *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: new InlineKeyboard().text("Payment via UPI", "pay_via_upi").text("Payment via USDT", "pay_via_usdt").row().text("BACK", "back_to_menu"), parse_mode: "Markdown" });
    });
    bot.callbackQuery("pay_via_upi", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.chosen_pay_method = "pay_via_upi"; u.awaiting_deposit_amt = true;
        await ctx.editMessageText(`💰 *Enter Amount:* UPI\n\nकृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (INR ₹) you want to add:`);
    });
    bot.callbackQuery("pay_via_usdt", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.chosen_pay_method = "pay_via_usdt"; u.awaiting_deposit_amt = true;
        await ctx.editMessageText(`💰 *Enter Amount:* USDT\n\nकृपया वह राशि (USDT) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (USDT) you want to add:`);
    });
    bot.callbackQuery("user_complete_pay_via_upi", async (ctx) => {
        const u = core.getLocalUser(ctx.from.id); u.awaiting_utr = true; u.current_order_num = Math.floor(100000 + Math.random() * 900000);
