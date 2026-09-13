const { InlineKeyboard } = require('grammy');
const config = require('./config');
const o = require('./orderHandlers');
const core = require('./bot'); 
let SERVICES_MASTER_DATA = require('./services');

module.exports = (bot) => {
    bot.command("admin", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        await ctx.reply(`⚙️ *HAPPY REACTION Super Admin Control Panel*\n\n➕ *Services Control:* \n▫️ \`/addservice ID Rate Type Name\`\n▫️ \`/updateservice ID NewRate\`\n▫️ \`/delservice ID\`\n\n🛡️ *Security Control:* \n▫️ \`/ban USER_ID\` \n▫️ \`/unban USER_ID\` \n\n💰 *Balance Control:* \n▫️ \`/addbalance USER_ID AMOUNT\` \n▫️ \`/deductbalance USER_ID AMOUNT\` \n▫️ \`/checkuser USER_ID\``, { parse_mode: "Markdown" });
    });

    bot.command("ban", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = ctx.message.text.split(" ")[1]; if (!target || !core.DYNAMIC_USER_DB[target]) return ctx.reply("❌ User nahi mila!");
        core.DYNAMIC_USER_DB[target].is_banned = true; core.forceSaveDatabase(); await ctx.reply(`🚫 *User ${target} ko BAN kar diya gaya hai!*`);
    });

    bot.command("unban", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = ctx.message.text.split(" ")[1]; if (!target || !core.DYNAMIC_USER_DB[target]) return ctx.reply("❌ User nahi mila!");
        core.DYNAMIC_USER_DB[target].is_banned = false; core.forceSaveDatabase(); await ctx.reply(`✅ *User ${target} ko UNBAN kar diya gaya hai!*`);
    });

    bot.command("addbalance", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" "); const target = args[1], amt = parseFloat(args[2]);
        if (!target || isNaN(amt) || !core.DYNAMIC_USER_DB[target]) return ctx.reply("❌ Format Error!");
        core.DYNAMIC_USER_DB[target].balance_usd += amt; core.forceSaveDatabase(); await ctx.reply(`💰 Added $${amt} to ${target}.`);
        await bot.api.sendMessage(target, `✨ *Admin dwara tumhare account mein $${amt} add kar diye gaye hain!*`);
    });

    bot.command("deductbalance", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" "); const target = args[1], amt = parseFloat(args[2]);
        if (!target || isNaN(amt) || !core.DYNAMIC_USER_DB[target]) return ctx.reply("❌ Format Error!");
        core.DYNAMIC_USER_DB[target].balance_usd -= amt; if (core.DYNAMIC_USER_DB[target].balance_usd < 0) core.DYNAMIC_USER_DB[target].balance_usd = 0; core.forceSaveDatabase();
        await ctx.reply(`💸 Balance Deducted Done.`);
    });

    bot.command("checkuser", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = ctx.message.text.split(" ")[1]; if (!target || !core.DYNAMIC_USER_DB[target]) return ctx.reply("❌ User nahi mila!");
        const u = core.DYNAMIC_USER_DB[target];
        await ctx.reply(`👤 *USER LIVE DATA PROFILE (ID: ${target})*\n\n💵 *Balance:* $${u.balance_usd.toFixed(2)} (₹${(u.balance_usd * config.USD_TO_INR_RATE).toFixed(2)})\n💰 *Total Deposit:* $${u.total_deposit_usd.toFixed(2)}\n💸 *Total Spent:* $${u.spent_usd.toFixed(2)}\n📦 *Orders:* ${u.orders_count}\n🛑 *Status:* ${u.is_banned ? "BANNED" : "ACTIVE"}`, { parse_mode: "Markdown" });
    });

    bot.command("addservice", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" ").slice(1); if (args.length < 4) return ctx.reply("❌ Format Error!");
        SERVICES_MASTER_DATA[args[0]] = { name: args.slice(3).join(" "), rate: parseFloat(args[1]), type: args[2] }; core.saveServicesToFile(); await ctx.reply(`✅ Service Added!`);
    });

    bot.command("updateservice", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" ").slice(1); if (args.length < 2 || !SERVICES_MASTER_DATA[args[0]]) return ctx.reply("❌ Not found!");
        SERVICES_MASTER_DATA[args[0]].rate = parseFloat(args[1]); core.saveServicesToFile(); await ctx.reply(`✅ Rate Updated!`);
    });

    bot.command("delservice", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" ").slice(1); if (args.length < 1 || !SERVICES_MASTER_DATA[args[0]]) return ctx.reply("❌ Not found!");
        delete SERVICES_MASTER_DATA[args[0]]; core.saveServicesToFile(); await ctx.reply(`❌ Service Deleted!`);
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
                await ctx.reply(`🟢 *UPI MANUAL PAYMENT SYSTEM*\n\n💵 *Amount to Pay:* ₹${amt.toFixed(2)}\n📍 *UPI ID:* \`${config.UPI_ID}\` _(Tap to copy)_\n\n👉 *Instructions:* Diye gaye UPI ID par exactly ₹${amt.toFixed(2)} transfer karein aur uske baad neeche diye gaye *CONFIRM PAYMENT* button par click karein bhai.`, { reply_markup: upiKb, parse_mode: "Markdown" });
            } else {
                const netKb = new InlineKeyboard().text("BEP20", "usdtnet_bep20").text("TRC20", "usdtnet_trc20");
                await ctx.reply(`आप अपना USDT नेटवर्क सेलेक्ट करें:\n\n💵 *Amount:* $${amt.toFixed(2)}`, { reply_markup: netKb, parse_mode: "Markdown" });
            } return;
        }
        if (u.awaiting_utr) {
            u.awaiting_utr = false; const refKey = Date.now().toString();
            const amtUsd = u.chosen_pay_method === "pay_via_upi" ? (u.current_deposit_amt / config.USD_TO_INR_RATE) : u.current_deposit_amt;
            core.SHARED_DEPOSITS_MAP[refKey] = { amount_usd: amtUsd, utr: txt, method: u.chosen_pay_method };
            const adminKb = new InlineKeyboard().text("✅ ACCEPT", `adm_acc_${ctx.from.id}_${refKey}`).text("❌ CANCEL", `adm_can_${ctx.from.id}_${refKey}`);
            let alertMsg = `🔔 *NEW MANUAL PAYMENT REQUEST!* 🔔\n\n👤 *User:* ${u.username} (ID: \`${ctx.from.id}\`)\n🆔 *Order Number:* \`#${u.current_order_num}\`\n💰 *Expected Amount:* ${u.chosen_pay_method === "pay_via_upi" ? "₹" + u.current_deposit_amt : "$" + u.current_deposit_amt}\n🛠️ *Method:* \`${u.chosen_pay_method === "pay_via_upi" ? "UPI" : "USDT (" + u.chosen_network.toUpperCase() + ")"}\`\n📝 *ID/UTR:* \`${txt}\``;
            await bot.api.sendMessage(config.ADMIN_ID, alertMsg, { reply_markup: adminKb, parse_mode: "Markdown" });
            await ctx.reply(`💌 *Details Received!* ✅\n\nTumhara Reference/Transaction ID \`${txt}\` verification ke liye admin ke paas bhej diya gaya hai!`); return;
        }
        await o.handleTextMessages(ctx);
    });
};
