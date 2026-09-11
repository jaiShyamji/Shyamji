require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const axios = require('axios');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);

// Saare basic menus aur callback routings
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

// 👑 ADMIN COMMAND PANEL: Access check karne ke liye
bot.command("admin", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    await ctx.reply(`⚙️ *HAPPY REACTION Admin Control Panel*\n\nBhai, tumhara admin control 100% active hai aur tumhare paas poora access hai!`, { parse_mode: "Markdown" });
});

// 👑 ADMIN ACTIONS: Buttons verification split logic fixed
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
        
        await bot.api.sendMessage(userId, `✅ *Payment Approved!* 💰\n\nBhai, tumhara deposit verify ho gaya hai.\n✨ *Added:* ${m.formatMoney(depositData.amount_usd, u.currency)}\n💳 *New Balance:* ${m.formatMoney(u.balance_usd, u.currency)}`, { parse_mode: "Markdown" });
        await ctx.editMessageText(`✅ Approved for User ${userId}`);
    } else {
        await bot.api.sendMessage(userId, `❌ *Payment Rejected!*\n\nBhai, tumhara Ref/UTR number verify nahi ho paaya. Please support panel par contact karo.`);
        await ctx.editMessageText(`❌ Rejected Request for User ${userId}`);
    }
    delete m.PENDING_DEPOSITS[refKey];
});

// UTR input request screen popup
bot.callbackQuery(/^submit_utr_(.+)$/, async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id);
    u.awaiting_utr = true;
    await ctx.reply("📝 *Bhai, ab apna 12-digit UTR / Reference number yahan box mein type karke send karo:*", { parse_mode: "Markdown" });
});

// ⚡ LIVE TEXT INPUT RECEIVER (Payment QR code generator + UTR dynamic tracker)
bot.on("message:text", async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id, ctx.from.first_name);
    const txt = ctx.message.text.trim();

    // 1. Agar user payment ke baad UTR number bhej raha hai
    if (u.awaiting_utr) {
        u.awaiting_utr = false;
        const refKey = Date.now().toString();
        const amtUsd = u.chosen_pay_method === "pay_via_upi" ? (u.current_deposit_amt / config.USD_TO_INR_RATE) : u.current_deposit_amt;

        m.PENDING_DEPOSITS[refKey] = { amount_usd: amtUsd, utr: txt, method: u.chosen_pay_method };

        // Admin ko single-row callback short-string mapping ke sath alert bhejega
        const adminKb = new InlineKeyboard()
            .text("✅ APPROVE", `adm_app_${ctx.from.id}_${refKey}`)
            .text("❌ REJECT", `adm_rej_${ctx.from.id}_${refKey}`);

        await bot.api.sendMessage(config.ADMIN_ID, 
            `🔔 *NEW DEPOSIT ALERT!* 🔔\n\n` +
            `👤 *User:* ${u.username} (ID: \`${ctx.from.id}\`)\n` +
            `💰 *Amount:* ${u.chosen_pay_method === "pay_via_upi" ? "₹" + u.current_deposit_amt : "$" + u.current_deposit_amt}\n` +
            `📝 *UTR/Hash:* \`${txt}\`\n\nBhai verify karke action chuno:`, 
            { reply_markup: adminKb, parse_mode: "Markdown" }
        );

        await ctx.reply(`💌 *Request Submitted!* ✅\n\nBhai tumhara Ref/UTR number \`${txt}\` verification ke liye admin ke paas bhej diya gaya hai. Kuch hi der mein balance add ho jayega!`);
        return;
    }

    // 2. Agar user Add Fund button dabane ke baad amount enter kar raha hai
    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
        const amt = parseFloat(txt);
        if (isNaN(amt) || amt <= 0) {
            await ctx.reply("❌ Invalid amount! Please try again with a valid number:");
            return;
        }
        
        u.awaiting_deposit_amt = false;
        u.current_deposit_amt = amt;
        const kb = new InlineKeyboard().text("📝 SUBMIT UTR / REF", `submit_utr_${u.chosen_pay_method}`).row().text("⬅️ Main Menu", "back_to_menu");
        
        if (u.chosen_pay_method === "pay_via_upi") {
            // UPI Payload verification configuration
            const upiPayload = `upi://pay?pa=${config.UPI_ID}&pn=${encodeURIComponent(config.MERCHANT_NAME)}&am=${amt.toFixed(2)}&cu=INR`;
            const finalQrLink = `https://googleapis.com{encodeURIComponent(upiPayload)}`;
            
            await ctx.replyWithPhoto(finalQrLink, {
                caption: `🟢 *UPI AUTOMATIC QR CODE*\n\n💵 *Amount:* ₹${amt.toFixed(2)}\n📍 *UPI ID:* \`${config.UPI_ID}\`\n\n👉 *Step 1:* Is QR code ko scan karke pay karein.\n👉 *Step 2:* Payment ke baad neeche "SUBMIT UTR / REF" button daba kar reference number send karein bhai.`,
                reply_markup: kb,
                parse_mode: "Markdown"
            });
        } else {
            // USDT payment standard mapping
            const finalQrLink = `https://googleapis.com{encodeURIComponent(config.USDT_ADDRESS)}`;
            
            await ctx.replyWithPhoto(finalQrLink, {
                caption: `🪙 *USDT (TRC20) QR CODE*\n\n💵 *Amount:* $${amt.toFixed(2)}\n📍 *Address:* \`${config.USDT_ADDRESS}\`\n\n👉 *Step 1:* Is address par USDT send karein.\n👉 *Step 2:* Transfer ke baad neeche "SUBMIT UTR / REF" button daba kar txHash hash number send karein bhai.`,
                reply_markup: kb,
                parse_mode: "Markdown"
            });
        }
        return;
    }

    // Normal text router (jaise links verify karna order pipeline mein)
    await o.handleTextMessages(ctx);
});

// Single instance polling activation engine
async function initBot() {
    try {
        console.log("Dropping webhook if any and dropping pending updates...");
        await bot.api.deleteWebhook({ drop_pending_updates: true });
        
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
