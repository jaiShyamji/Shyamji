const { InlineKeyboard } = require('grammy');
const config = require('./config');
const o = require('./orderHandlers');
const core = require('./bot');

module.exports = (bot) => {
    bot.callbackQuery("main_services", o.servicesMenu);
    bot.callbackQuery("p_tg", o.tgMenu);
    bot.callbackQuery("p_ig", o.igMenu);
    bot.callbackQuery("p_fb", o.fbMenu);
    bot.callbackQuery("p_yt", o.ytMenu);
    bot.hears(/^\/\d+\$/, o.handleSlashCode);
    bot.callbackQuery(/^q_\d+_(.+)\$/, o.handleQtyButtons);
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
                const liveUpi = core.DYNAMIC_USER_DB.dynamic_config.upi_id || config.UPI_ID;
                const upiKb = new InlineKeyboard().text("CONFIRM PAYMENT", "user_complete_pay_via_upi").row().text("BACK", "main_add_funds");
                await ctx.reply("🟢 *UPI MANUAL PAYMENT SYSTEM*\n\n💵 *Amount to Pay:* ₹" + amt.toFixed(2) + "\n📍 *UPI ID:* `" + liveUpi + "` _(Tap to copy)_\n\n👉 *Instructions:* Diye gaye UPI ID par exactly ₹" + amt.toFixed(2) + " transfer karein aur uske baad neeche diye gaye *CONFIRM PAYMENT* button par click karein bhai.", { reply_markup: upiKb, parse_mode: "Markdown" });
            } else {
                const netKb = new InlineKeyboard().text("BEP20", "usdtnet_bep20").text("TRC20", "usdtnet_trc20");
                await ctx.reply("आप अपना USDT नेटवर्क सेलेक्ट करें:\n\n💵 *Amount:* \$" + amt.toFixed(2), { reply_markup: netKb, parse_mode: "Markdown" });
            } return;
        }
        if (u.awaiting_utr) {
            u.awaiting_utr = false; const refKey = Date.now().toString();
            const amtUsd = u.chosen_pay_method === "pay_via_upi" ? (u.current_deposit_amt / config.USD_TO_INR_RATE) : u.current_deposit_amt;
            core.DYNAMIC_USER_DB.pending_deposits[refKey] = { amount_usd: amtUsd, utr: txt, method: u.chosen_pay_method }; core.forceSaveDatabase();
            
            const adminKb = new InlineKeyboard().text("✅ ACCEPT", "adm_acc_" + ctx.from.id + "_" + refKey).text("❌ CANCEL", "adm_can_" + ctx.from.id + "_" + refKey);
            let alertMsg = "🔔 *NEW MANUAL PAYMENT REQUEST!* 🔔\n\n👤 *User:* " + u.username + " (ID: `" + ctx.from.id + "`)\n🆔 *Order Number:* `# " + u.current_order_num + "`\n💰 *Expected Amount:* " + (u.chosen_pay_method === "pay_via_upi" ? "₹" + u.current_deposit_amt : "\$" + u.current_deposit_amt) + "\n🛠️ *Method:* " + (u.chosen_pay_method === "pay_via_upi" ? "UPI" : "USDT (" + u.chosen_network.toUpperCase() + ")") + "\n📝 *ID/UTR:* `" + txt + "`";
            await bot.api.sendMessage(config.ADMIN_ID, alertMsg, { reply_markup: adminKb, parse_mode: "Markdown" });
            await ctx.reply("💌 *Details Received!* ✅\n\nTumhara Reference/Transaction ID `" + txt + "` verification ke liye admin ke paas bhej diya gaya hai!"); return;
        }
        await o.handleTextMessages(ctx);
    });
};
