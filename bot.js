require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const { run } = require('@grammyjs/runner');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');
const p = require('./paymentHandlers');
let SERVICES_MASTER_DATA = require('./services');

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);

bot.command("start", m.start);
bot.callbackQuery("back_to_menu", m.backMenu);
bot.callbackQuery("check_balance", m.checkBalance);
bot.callbackQuery("my_profile", m.myProfile);
bot.callbackQuery("my_channels", m.myChannels);
bot.callbackQuery("main_promo", m.mainPromo);
bot.callbackQuery("main_support", m.mainSupport);
bot.callbackQuery("toggle_currency", m.toggleCurrency);

bot.callbackQuery("main_services", o.servicesMenu);
bot.callbackQuery("p_tg", o.tgMenu);
bot.callbackQuery("p_ig", o.igMenu);
bot.callbackQuery("p_fb", o.fbMenu);
bot.callbackQuery("p_yt", o.ytMenu);
bot.hears(/^\/\d+$/, o.handleSlashCode);
bot.callbackQuery(/^q_\d+_(.+)$/, o.handleQtyButtons);

bot.callbackQuery("main_add_funds", p.addFundsMenu);
bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, p.initPayMethod);
bot.callbackQuery(/^user_complete_pay_(.+)$/, p.handlePaymentComplete);
bot.callbackQuery(/^usdtnet_(.+)$/, p.handleUsdtNetworkSelect); 
bot.callbackQuery("usdt_confirm_click", p.handleUsdtConfirmClick); 
bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)$/, p.handleAdminActions);
bot.callbackQuery(/^submit_utr_(.+)$/, p.handleSubmitUtrTrigger);

bot.command("admin", p.handleAdminPanelCommand);
bot.command("addservice", p.handleAddServiceCommand);
bot.command("updateservice", p.handleUpdateServiceCommand);
bot.command("delservice", p.handleDelServiceCommand);

// ⚡ 100% FIXED WORKING DYNAMIC TEXT HANDLER BLOCK
bot.on("message:text", async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id, ctx.from.first_name);
    const txt = ctx.message.text.trim();

    if (u.awaiting_utr) {
        u.awaiting_utr = false; const refKey = Date.now().toString();
        const amtUsd = u.chosen_pay_method === "pay_via_upi" ? (u.current_deposit_amt / config.USD_TO_INR_RATE) : u.current_deposit_amt;
        m.PENDING_DEPOSITS[refKey] = { amount_usd: amtUsd, utr: txt, method: u.chosen_pay_method };
        const adminKb = new InlineKeyboard().text("✅ ACCEPT", `adm_acc_${ctx.from.id}_${refKey}`).text("❌ CANCEL", `adm_can_${ctx.from.id}_${refKey}`);
        let alertMsg = `🔔 *NEW MANUAL PAYMENT REQUEST!* 🔔\n\n👤 *User:* ${u.username} (ID: \`${ctx.from.id}\`)\n🆔 *Order Number:* \`#${u.current_order_num}\`\n💰 *Expected Amount:* ${u.chosen_pay_method === "pay_via_upi" ? "₹" + u.current_deposit_amt : "$" + u.current_deposit_amt}\n🛠️ *Method:* \`${u.chosen_pay_method === "pay_via_upi" ? "UPI" : "USDT (" + u.chosen_network.toUpperCase() + ")"}\`\n📝 *ID/UTR:* \`${txt}\``;
        await bot.api.sendMessage(config.ADMIN_ID, alertMsg, { reply_markup: adminKb, parse_mode: "Markdown" });
        await ctx.reply(`💌 *Details Received!* ✅\n\nTumhara Reference/Transaction ID \`${txt}\` verification ke liye admin ke paas bhej diya gaya hai!`); return;
    }

    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
        const amt = parseFloat(txt); if (isNaN(amt) || amt <= 0) return ctx.reply("❌ Invalid amount! Try again:");
        u.awaiting_deposit_amt = false; u.current_deposit_amt = amt;
        
        if (u.chosen_pay_method === "pay_via_upi") {
            const upiUrlEncoded = encodeURIComponent(`upi://pay?pa=${config.UPI_ID}&pn=${encodeURIComponent(config.MERCHANT_NAME)}&am=${amt.toFixed(2)}&cu=INR`);
            const appsKb = new InlineKeyboard()
                .url("Google pay", `https://upilinks.in{upiUrlEncoded}`)
                .url("PAYTM", `https://upilinks.in{upiUrlEncoded}`).row()
                .url("PHONE PAY", `https://upilinks.in{upiUrlEncoded}`)
                .url("UPI", `https://upilinks.in{upiUrlEncoded}`).row()
                .url("OTHER PAYMENT METHOD", `https://upilinks.in{upiUrlEncoded}`).row()
                .text("PAYMENT COMPLETE", "user_complete_pay_via_upi");
            await ctx.reply(`Select your payment method:\n\n💵 *Amount to Pay:* ₹${amt.toFixed(2)}\n📍 *UPI ID:* \`${config.UPI_ID}\`\n\n👉 App select karke pay karein aur uske baad *PAYMENT COMPLETE* par click karke UTR bhejein bhai.`, { reply_markup: appsKb, parse_mode: "Markdown" });
        } else {
            const netKb = new InlineKeyboard().text("BEP20", "usdtnet_bep20").text("TRC20", "usdtnet_trc20");
            await ctx.reply(`आप अपना USDT नेटवर्क सेलेक्ट करें:\n\n💵 *Amount:* $${amt.toFixed(2)}`, { reply_markup: netKb, parse_mode: "Markdown" });
        } return;
    }
    await o.handleTextMessages(ctx);
});

async function startBotEngine() {
    try {
        await bot.api.deleteWebhook({ drop_pending_updates: true }); run(bot);
        console.log("HAPPY REACTION Perfect Combined Engine Active Now!");
    } catch (err) { setTimeout(startBotEngine, 5000); }
}
startBotEngine();
