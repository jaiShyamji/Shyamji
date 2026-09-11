require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);

// सभी बटन्स के रूट को लिंक करना
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
bot.callbackQuery("main_add_funds", o.addFundsMenu);
bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, o.initPayMethod);
bot.callbackQuery("p_done", o.payDone);
bot.callbackQuery("main_orders", o.ordersHistory);

// ⚡ पेमेंट और टेक्स्ट मैसेज का सबसे मजबूत कंबाइंड हैंडलर
bot.on("message:text", async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id, ctx.from.first_name);
    const txt = ctx.message.text.trim();

    // 1. अगर यूज़र फंड ऐड करने के लिए राशि (Amount) टाइप कर रहा है
    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
        const amt = parseFloat(txt);
        if (isNaN(amt) || amt <= 0) {
            await ctx.reply("❌ Invalid amount! Please try again with a valid number:");
            return;
        }
        
        u.awaiting_deposit_amt = false;
        const kb = new InlineKeyboard().text("✅ Payment Done", "p_done").row().text("⬅️ Main Menu", "back_to_menu");
        
        if (u.chosen_pay_method === "pay_via_upi") {
            // UPI पेमेंट के लिए डायनामिक यूआरएल और लाइव क्यूआर कोड जनरेशन
            const upiRaw = `upi://pay?pa=${config.UPI_ID}&pn=${encodeURIComponent(config.MERCHANT_NAME)}&am=${amt.toFixed(2)}&cu=INR`;
            const qrUrl = `https://googleapis.com{encodeURIComponent(upiRaw)}`;
            
            await ctx.replyWithPhoto(qrUrl, {
                caption: `🟢 *UPI Automatic QR Code*\n\n💵 *Amount:* ₹${amt.toFixed(2)}\n📍 *UPI ID:* \`${config.UPI_ID}\`\n\n⚠️ ऊपर दिए गए QR कोड को स्कैन करके पे करें और "Payment Done" पर क्लिक करके स्क्रीनशॉट सपोर्ट पर भेजें।`,
                reply_markup: kb,
                parse_mode: "Markdown"
            });
            
            // बैलेंस और डिपाजिट अपडेट
            u.total_deposit_usd += (amt / config.USD_TO_INR_RATE);
            u.balance_usd += (amt / config.USD_TO_INR_RATE);
        } else {
            // USDT पेमेंट के लिए एड्रेस आधारित क्यूआर कोड जनरेशन
            const qrUrl = `https://googleapis.com{encodeURIComponent(config.USDT_ADDRESS)}`;
            
            await ctx.replyWithPhoto(qrUrl, {
                caption: `🪙 *USDT (TRC20) QR Code*\n\n💵 *Amount:* $${amt.toFixed(2)}\n📍 *Address:* \`${config.USDT_ADDRESS}\`\n\n⚠️ इस एड्रेस पर USDT ट्रांसफर करें और स्क्रीनशॉट सपोर्ट पर भेजें।`,
                reply_markup: kb,
                parse_mode: "Markdown"
            });
            
            u.total_deposit_usd += amt;
            u.balance_usd += amt;
        }
        return;
    }

    // 2. बाकी सभी सामान्य टेक्स्ट मैसेजेस (जैसे ऑर्डर के लिए लिंक भेजना) को orderHandlers को पास करना
    await o.handleTextMessages(ctx);
});

bot.start();
console.log("HAPPY REACTION Perfect Combined Engine Started Live!");
