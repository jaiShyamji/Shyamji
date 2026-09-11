        require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);

// Commands aur callbacks routing bhai
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
bot.callbackQuery("p_done", m.payDone);
bot.callbackQuery("main_orders", o.ordersHistory);

bot.command("admin", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    await ctx.reply(`⚙️ *HAPPY REACTION Admin Control Panel*\n\nBhai access confirm hai. Alert panel ready hai.`, { parse_mode: "Markdown" });
});

bot.callbackQuery(/^admin_(approve|reject)_(.+)_(.+)$/, async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const parts = ctx.callbackQuery.data.split("_");
    const action = parts[1];
    const userId = parseInt(parts[2]);
    const refKey = parts[3];

    const depositData = m.PENDING_DEPOSITS[refKey];
    if (!depositData) {
        await ctx.answerCallbackQuery({ text: "❌ Request already processed!", show_alert: true });
        return;
    }

    const u = m.getOrCreateUser(userId);
    if (action === "approve") {
        u.balance_usd += depositData.amount_usd;
        u.total_deposit_usd += depositData.amount_usd;
        await bot.api.sendMessage(userId, `✅ *Payment Approved!* 💰\n\n✨ *Added:* ${m.formatMoney(depositData.amount_usd, u.currency)}\n💳 *New Balance:* ${m.formatMoney(u.balance_usd, u.currency)}`, { parse_mode: "Markdown" });
        await ctx.editMessageText(`✅ Approved for User ${userId}`);
    } else {
        await bot.api.sendMessage(userId, `❌ *Payment Rejected!*\n\nBhai tumhara Ref/UTR verify nahi ho paaya.`);
        await ctx.editMessageText(`❌ Rejected Request for User ${userId}`);
    }
    delete m.PENDING_DEPOSITS[refKey];
});

bot.callbackQuery(/^submit_utr_(.+)$/, async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id);
    u.awaiting_utr = true;
    await ctx.reply("📝 *Bhai, apna 12-digit UTR/Reference number yahan send karo:*", { parse_mode: "Markdown" });
});

bot.on("message:text", async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id, ctx.from.first_name);
    const txt = ctx.message.text.trim();

    if (u.awaiting_utr) {
        u.awaiting_utr = false;
        const refKey = Date.now().toString();
        const amtUsd = u.chosen_pay_method === "pay_via_upi" ? (u.current_deposit_amt / config.USD_TO_INR_RATE) : u.current_deposit_amt;

        m.PENDING_DEPOSITS[refKey] = { amount_usd: amtUsd, utr: txt, method: u.chosen_pay_method };

        const adminKb = new InlineKeyboard()
            .text("✅ APPROVE", `admin_approve_${ctx.from.id}_${refKey}`)
            .text("❌ REJECT", `admin_reject_${ctx.from.id}_${refKey}`);

        await bot.api.sendMessage(config.ADMIN_ID, 
            `🔔 *NEW PAYMENT SUBMISSION!* 🔔\n\n👤 *User:* ${u.username} (ID: \`${ctx.from.id}\`)\n💰 *Amount:* ${u.chosen_pay_method === "pay_via_upi" ? "₹" + u.current_deposit_amt : "$" + u.current_deposit_amt}\n📝 *UTR:* \`${txt}\``, 
            { reply_markup: adminKb, parse_mode: "Markdown" }
        );

        await ctx.reply(`💌 *Request Submitted!* ✅\n\nRef \`${txt}\` verify hote hi balance add ho jayega bhai!`);
        return;
    }

    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
        const amt = parseFloat(txt);
        if (isNaN(amt) || amt <= 0) {
            await ctx.reply("❌ Invalid amount! Try again:");
            return;
        }
        
        u.awaiting_deposit_amt = false;
        u.current_deposit_amt = amt;
        const kb = new InlineKeyboard().text("📝 SUBMIT UTR / REF", `submit_utr_${u.chosen_pay_method}`).row().text("⬅️ Main Menu", "back_to_menu");
        
        if (u.chosen_pay_method === "pay_via_upi") {
            const upiRaw = `upi://pay?pa=${config.UPI_ID}&pn=${config.MERCHANT_NAME}&am=${amt.toFixed(2)}&cu=INR`;
            const qrUrl = `https://googleapis.com{encodeURIComponent(upiRaw)}`;
            await ctx.replyWithPhoto(qrUrl, { caption: `🟢 *UPI AUTOMATIC QR CODE*\n\n💵 *Amount:* ₹${amt.toFixed(2)}\n📍 *UPI ID:* \`${config.UPI_ID}\`\n\nscan karke payment karein aur neeche UTR submit karein bhai.`, reply_markup: kb, parse_mode: "Markdown" });
        } else {
            const qrUrl = `https://googleapis.com{encodeURIComponent(config.USDT_ADDRESS)}`;
            await ctx.replyWithPhoto(qrUrl, { caption: `🪙 *USDT QR CODE*\n\n💵 *Amount:* $${amt.toFixed(2)}\n📍 *Address:* \`${config.USDT_ADDRESS}\``, reply_markup: kb, parse_mode: "Markdown" });
        }
        return;
    }

    await o.handleTextMessages(ctx);
});

// 🚀 POLLING MODE WITH SINGLE INSTANCE ENFORCER
async function initBot() {
    try {
        console.log("Dropping webhook if any and dropping pending updates...");
        await bot.api.deleteWebhook({ drop_pending_updates: true });
        
        // standard high speed polling active bhai
        bot.start({
            allowed_updates: ["message", "callback_query"],
            drop_pending_updates: true
        });
        console.log("HAPPY REACTION Engine Active via Polling Engine!");
    } catch (err) {
        console.error("Initialization Error:", err);
    }
}

initBot();
