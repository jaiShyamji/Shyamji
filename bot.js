require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const { run } = require('@grammyjs/runner'); // Crash safety engine link
const axios = require('axios');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);

// Saare button callback commands link ho gaye bhai
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

// 👑 ADMIN PANEL ACCESS COMMAND
bot.command("admin", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    await ctx.reply(`⚙️ *HAPPY REACTION Admin Control Panel*\n\nBhai tumhara admin control 100% active hai! Base panels ready hain.`, { parse_mode: "Markdown" });
});

// 👑 ADMIN DEPOSIT ACTIONS (Approve / Reject System)
bot.callbackQuery(/^adm_(app|rej)_(.+)_(.+)$/, async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const parts = ctx.callbackQuery.data.split("_");
    const action = parts[1];
    const userId = parseInt(parts[2]);
    const refKey = parts[3];

    const depositData = m.PENDING_DEPOSITS[refKey];
    if (!depositData) {
        await ctx.answerCallbackQuery({ text: "❌ Request expired or already verified!", show_alert: true });
        return;
    }

    const u = m.getOrCreateUser(userId);
    if (action === "app") {
        u.balance_usd += depositData.amount_usd;
        u.total_deposit_usd += depositData.amount_usd;
        
        await bot.api.sendMessage(userId, `✅ *Payment Approved!* 💰\n\nBhai tumhara deposit verify ho gaya hai.\n✨ *Added:* ${m.formatMoney(depositData.amount_usd, u.currency)}\n💳 *New Balance:* ${m.formatMoney(u.balance_usd, u.currency)}`, { parse_mode: "Markdown" });
        await ctx.editMessageText(`✅ Approved for User ${userId}`);
    } else {
        await bot.api.sendMessage(userId, `❌ *Payment Rejected!*\n\nBhai tumhara Ref/UTR number verify nahi ho paaya. Please support panel par screenshot send karo.`);
        await ctx.editMessageText(`❌ Rejected Request for User ${userId}`);
    }
    delete m.PENDING_DEPOSITS[refKey];
});

bot.callbackQuery(/^submit_utr_(.+)$/, async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id);
    u.awaiting_utr = true;
    await ctx.reply("📝 *Bhai, ab apna 12-digit UTR / Reference number yahan type karke send karo:*", { parse_mode: "Markdown" });
});

// ⚡ LIVE TEXT INPUT INTERCEPTOR (Automatic Payment QR Generator + UTR Verification Flow)
bot.on("message:text", async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id, ctx.from.first_name);
    const txt = ctx.message.text.trim();

    // A. Agar User Payment karne ke baad manual UTR send kar raha hai
    if (u.awaiting_utr) {
        u.awaiting_utr = false;
        const refKey = Date.now().toString();
        const amtUsd = u.chosen_pay_method === "pay_via_upi" ? (u.current_deposit_amt / config.USD_TO_INR_RATE) : u.current_deposit_amt;

        m.PENDING_DEPOSITS[refKey] = { amount_usd: amtUsd, utr: txt, method: u.chosen_pay_method };

        // Admin panel notification triggers yahan par honge bhai
        const adminKb = new InlineKeyboard()
            .text("✅ APPROVE", `adm_app_${ctx.from.id}_${refKey}`)
            .text("❌ REJECT", `adm_rej_${ctx.from.id}_${refKey}`);

        await bot.api.sendMessage(config.ADMIN_ID, 
            `🔔 *NEW MANUAL PAYMENT REQUEST!* 🔔\n\n` +
            `👤 *User:* ${u.username} (ID: \`${ctx.from.id}\`)\n` +
            `💰 *Expected Amount:* ${u.chosen_pay_method === "pay_via_upi" ? "₹" + u.current_deposit_amt : "$" + u.current_deposit_amt}\n` +
            `📝 *Submitted UTR/Hash:* \`${txt}\`\n\nBhai verify karke action chuno:`, 
            { reply_markup: adminKb, parse_mode: "Markdown" }
        );

        await ctx.reply(`💌 *Request Submitted!* ✅\n\nTumhara Reference number \`${txt}\` verification ke liye admin ke paas bhej diya gaya hai. Kuch hi der mein balance add ho jayega!`);
        return;
    }

    // B. Agar User Add Fund chunte hi Amount type kar raha hai
    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
        const amt = parseFloat(txt);
        if (isNaN(amt) || amt <= 0) {
            await ctx.reply("❌ Invalid amount! Please enter a valid number:");
            return;
        }
        
        u.awaiting_deposit_amt = false;
        u.current_deposit_amt = amt;
        const kb = new InlineKeyboard().text("📝 SUBMIT UTR / REF", `submit_utr_${u.chosen_pay_method}`).row().text("⬅️ Main Menu", "back_to_menu");
        
        if (u.chosen_pay_method === "pay_via_upi") {
            // Live automatic QR code template creation
            const upiRaw = `upi://pay?pa=${config.UPI_ID}&pn=${encodeURIComponent(config.MERCHANT_NAME)}`;
            const qrUrl = `https://googleapis.com{encodeURIComponent(upiRaw)}`;
            
            await ctx.replyWithPhoto(qrUrl, { 
                caption: `🟢 *MANUAL PAYMENT SYSTEM*\n\n💵 *Amount to Pay:* 💰 ₹${amt.toFixed(2)}\n📍 *UPI ID:* \`${config.UPI_ID}\`\n\n👉 *Step 1:* Is QR code par ₹${amt.toFixed(2)} pay karein.\n👉 *Step 2:* Pay karne ke baad neeche "SUBMIT UTR / REF" button daba kar apna 12-digit UTR number send khre bhai.`, 
                reply_markup: kb, 
                parse_mode: "Markdown" 
            });
        } else {
            const qrUrl = `https://googleapis.com{encodeURIComponent(config.USDT_ADDRESS)}`;
            await ctx.replyWithPhoto(qrUrl, { 
                caption: `🪙 *USDT MANUAL DEPOSIT*\n\n💵 *Amount to Pay:* $${amt.toFixed(2)}\n📍 *Address:* \`${config.USDT_ADDRESS}\`\n\n👉 *Step 1:* Is address par $${amt.toFixed(2)} transfer karein.\n👉 *Step 2:* Transfer ke baad neeche "SUBMIT UTR / REF" button daba kar transaction hash code send karein bhai.`, 
                reply_markup: kb, 
                parse_mode: "Markdown" 
            });
        }
        return;
    }

    // Normal orders links pipeline ko forward karna
    await o.handleTextMessages(ctx);
});

// Force sessions wipe data out system
async function startBotEngine() {
    try {
        console.log("Forcing webhook sessions to clear up...");
        await bot.api.deleteWebhook({ drop_pending_updates: true });
        
        // Advanced parallel framework polling execution start bhai
        run(bot); 
        console.log("HAPPY REACTION Perfect Combined Engine Active Now!");
    } catch (err) {
        console.error("Runner Initialization Error:", err);
    }
}

startBotEngine();
