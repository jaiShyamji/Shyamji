const { InlineKeyboard } = require('grammy');
const config = require('./config');
const o = require('./orderHandlers');
const core = require('./bot'); 
let SERVICES_MASTER_DATA = require('./services');

module.exports = (bot) => {
    function getLiveUpiId() { return core.DYNAMIC_USER_DB.dynamic_config.upi_id || config.UPI_ID; }

    bot.command("admin", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        await ctx.reply(`⚙️ *HAPPY REACTION Super Admin Panel Commands List*:\n\n` +
            `👤 *User Controls:*\n` +
            `▫️ \`/ban USER_ID\` \n▫️ \`/unban USER_ID\` \n` +
            `▫️ \`/addbalance USER_ID AMOUNT\` \n▫️ \`/deductbalance USER_ID AMOUNT\` \n` +
            `▫️ \`/checkuser USER_ID\` -> View complete user profile\n\n` +
            `🛠️ *SMM Services Controls:*\n` +
            `▫️ \`/addservice ID Rate Type Name\`\n` +
            `▫️ \`/updateservice ID NewRate\`\n` +
            `▫️ \`/delservice ID\`\n\n` +
            `💳 *Payment Config Controls (Direct Live Change):*\n` +
            `▫️ \`/setupi NEW_UPI_ID\` \n▫️ \`/settrc20 WALLET_ADDRESS\` \n▫️ \`/setbep20 WALLET_ADDRESS\``, { parse_mode: "Markdown" });
    });

    bot.command("ban", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = parseInt(ctx.message.text.split(" ")[1]); if (isNaN(target) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Sahi User ID daalein!");
        core.DYNAMIC_USER_DB.users[target].is_banned = true; core.forceSaveDatabase(); await ctx.reply(`🚫 User \`${target}\` BAN ho gaya hai.`);
    });

    bot.command("unban", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = parseInt(ctx.message.text.split(" ")[1]); if (isNaN(target) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Sahi User ID daalein!");
        core.DYNAMIC_USER_DB.users[target].is_banned = false; core.forceSaveDatabase(); await ctx.reply(`✅ User \`${target}\` UNBAN ho gaya hai.`);
    });

    bot.command("addbalance", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" "), target = parseInt(args[1]), amt = parseFloat(args[2]);
        if (isNaN(target) || isNaN(amt) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Format: \`/addbalance USER_ID AMOUNT\`");
        core.DYNAMIC_USER_DB.users[target].balance_usd += amt; core.forceSaveDatabase(); await ctx.reply(`💰 Added $${amt.toFixed(2)} to ${target}.`);
        try { await bot.api.sendMessage(target, `✨ *Admin dwara tumhare account mein $${amt.toFixed(2)} add kar diye gaye hain!*`); } catch(e) {}
    });

    bot.command("deductbalance", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" "), target = parseInt(args[1]), amt = parseFloat(args[2]);
        if (isNaN(target) || isNaN(amt) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Format: \`/deductbalance USER_ID AMOUNT\`");
        core.DYNAMIC_USER_DB.users[target].balance_usd -= amt; if (core.DYNAMIC_USER_DB.users[target].balance_usd < 0) core.DYNAMIC_USER_DB.users[target].balance_usd = 0; core.forceSaveDatabase();
        await ctx.reply(`💸 Balance Deducted from ${target}.`);
    });

    bot.command("checkuser", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = parseInt(ctx.message.text.split(" ")[1]); if (isNaN(target) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ User nahi mila!");
        const u = core.DYNAMIC_USER_DB.users[target];
        await ctx.reply(`👤 *USER LIVE DATA PROFILE (ID: ${target})*\n\n💵 *Balance:* $${u.balance_usd.toFixed(2)} (${core.formatMoneyLocal(u.balance_usd, "INR")})\n💰 *Total Deposit:* $${u.total_deposit_usd.toFixed(2)}\n💸 *Total Spent:* $${u.spent_usd.toFixed(2)}\n📦 *Orders placed:* ${u.orders_count}\n⏳ *Pending Orders:* ${u.pending_orders}\n🛑 *Status:* ${u.is_banned ? "BANNED" : "ACTIVE"}`, { parse_mode: "Markdown" });
    });

    bot.command("setupi", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const newUpi = ctx.message.text.split(" ")[1]; if (!newUpi) return ctx.reply("❌ Format: \`/setupi NEW_UPI_ID\`");
        core.DYNAMIC_USER_DB.dynamic_config.upi_id = newUpi; core.forceSaveDatabase(); await ctx.reply(`✅ *Live UPI ID Updated to:* \`${newUpi}\``, { parse_mode: "Markdown" });
    });

    bot.command("settrc20", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const newWallet = ctx.message.text.split(" ")[1]; if (!newWallet) return ctx.reply("❌ Format: \`/settrc20 WALLET_ADDRESS\`");
        core.DYNAMIC_USER_DB.dynamic_config.usdt_trc20 = newWallet; core.forceSaveDatabase(); await ctx.reply(`🪙 *USDT TRC20 Address Updated!*`);
    });

    bot.command("setbep20", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const newWallet = ctx.message.text.split(" ")[1]; if (!newWallet) return ctx.reply("❌ Format: \`/setbep20 WALLET_ADDRESS\`");
        core.DYNAMIC_USER_DB.dynamic_config.usdt_bep20 = newWallet; core.forceSaveDatabase(); await ctx.reply(`🪙 *USDT BEP20 Address Updated!*`);
    });

    bot.command("addservice", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" ").slice(1); if (args.length < 4) return ctx.reply("❌ Format error!");
        const id = args[0], rate = parseFloat(args[1]), type = args[2], name = args.slice(3).join(" ");
        SERVICES_MASTER_DATA[id] = { name: name, rate: rate, type: type };
        fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8');
        await ctx.reply(`✅ Service Added successfully!`);
    });

    bot.command("updateservice", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" ").slice(1); if (args.length < 2) return ctx.reply("❌ Format error!");
        const id = args[0], newRate = parseFloat(args[1]); if (!SERVICES_MASTER_DATA[id]) return ctx.reply("❌ ID nahi mili!");
        SERVICES_MASTER_DATA[id].rate = newRate;
        fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8');
        await ctx.reply(`✅ Rate Updated successfully!`);
    });

    bot.command("delservice", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const id = ctx.message.text.split(" ")[1]; if (!id || !SERVICES_MASTER_DATA[id]) return ctx.reply("❌ ID nahi mili!");
        delete SERVICES_MASTER_DATA[id];
        fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8');
        await ctx.reply(`❌ Service Deleted successfully!`);
    });

    bot.callbackQuery("main_services", o.servicesMenu);
    bot.callbackQuery("p_tg", o.tgMenu);
    bot.callbackQuery("p_ig", o.igMenu);
    bot.callbackQuery("p_fb", o.fbMenu);
    bot.callbackQuery("p_yt", o.ytMenu);
    bot.hears(/^\/\d+$/, o.handleSlashCode);
    bot.callbackQuery(/^q_\d+_(.+)$/, o.handleQtyButtons);
    bot.callbackQuery("my_channels", async (ctx) => { await ctx.reply("📢 *Coming soon!*", { reply_markup: new InlineKeyboard().text("⬅️ Back", "back_to_menu") }); });
    bot.callbackQuery("main_promo", async (ctx) => { await ctx.reply("🎁 *Coming soon!*", { reply_markup: new InlineKeyboard().text("⬅️ Back", "back_to_menu") }); });
    bot.callbackQuery("main_support", async (ctx) => { await ctx.reply(`📞 Support at @${config.SUPPORT_USERNAME}`, { reply_markup: new InlineKeyboard().text("⬅️ Back", "back_to_menu") }); });

    bot.on("message:text", async (ctx) => {
        const txt = ctx.message.text.trim(); if (txt.startsWith("/")) return;
        const u = core.getLocalUser(ctx.from.id, ctx.from.first_name);
        
        if (u.awaiting_deposit_amt && u.chosen_pay_method) {
            const amt = parseFloat(txt); if (isNaN(amt) || amt <= 0) return ctx.reply("❌ Invalid amount!");
            u.awaiting_deposit_amt = false; u.current_deposit_amt = amt;
            if (u.chosen_pay_method === "pay_via_upi") {
                const upiKb = new InlineKeyboard().text("CONFIRM PAYMENT", "user_complete_pay_via_upi").row().text("BACK", "main_add_funds");
                await ctx.reply("🟢 *UPI MANUAL PAYMENT SYSTEM*\n\n💵 *Amount to Pay:* ₹" + amt.toFixed(2) + "\n📍 *UPI ID:* `" + getLiveUpiId() + "` _(Tap to copy)_\n\n👉 *Instructions:* Diye gaye UPI ID par exactly ₹" + amt.toFixed(2) + " transfer karein aur uske baad neeche diye gaye *CONFIRM PAYMENT* button par click karein bhai.", { reply_markup: upiKb, parse_mode: "Markdown" });
            } else {
                const netKb = new InlineKeyboard().text("BEP20", "usdtnet_bep20").text("TRC20", "usdtnet_trc20");
                await ctx.reply("आप अपना USDT नेटवर्क सेलेक्ट करें:\n\n💵 *Amount:* $" + amt.toFixed(2), { reply_markup: netKb, parse_mode: "Markdown" });
            } return;
        }
        if (u.awaiting_utr) {
            u.awaiting_utr = false; const refKey = Date.now().toString();
            const amtUsd = u.chosen_pay_method === "pay_via_upi" ? (u.current_deposit_amt / config.USD_TO_INR_RATE) : u.current_deposit_amt;
            core.DYNAMIC_USER_DB.pending_deposits[refKey] = { amount_usd: amtUsd, utr: txt, method: u.chosen_pay_method }; core.forceSaveDatabase();
            
            const adminKb = new InlineKeyboard().text("✅ ACCEPT", "adm_acc_" + ctx.from.id + "_" + refKey).text("❌ CANCEL", "adm_can_" + ctx.from.id + "_" + refKey);
