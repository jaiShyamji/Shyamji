require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const { run } = require('@grammyjs/runner');
const axios = require('axios');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);

// Saare basic menus aur callback routings link ho gaye bhai
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
bot.callbackQuery("main_orders", o.ordersHistory);

// 👑 ADMIN COMMAND
bot.command("admin", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    await ctx.reply(`⚙️ *HAPPY REACTION Admin Control Panel*\n\nBhai tumhara admin access active hai!`, { parse_mode: "Markdown" });
});

// 👑 ADMIN ACTIONS: APPROVE / REJECT PIPELINE
bot.callbackQuery(/^adm_(app|rej)_(.+)_(.+)$/, async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const parts = ctx.callbackQuery.data.split("_");
    const action = parts;
    const userId = parseInt(parts);
    const refKey = parts;

    const depositData = m.PENDING_DEPOSITS[refKey];
    if (!depositData) {
        await ctx.answerCallbackQuery({ text: "❌ Request expired or already verified!", show_alert: true });
        return;
    }

    const u = m.getOrCreateUser(userId);
    if (action === "app") {
        u.balance_usd += depositData.amount_usd;
        u.total_deposit_usd += depositData.amount_usd;
        
        const successMsg = `✅ *Payment Added Successful!* 💰\n\nBhai tumhara payment verify ho gaya hai.\n✨ *Added Amount:* ${m.formatMoney(depositData.amount_usd, u.currency)}\n💳 *Total Balance:* ${m.formatMoney(u.balance_usd, u.currency)}`;
        
        await bot.api.sendMessage(userId, successMsg, { parse_mode: "Markdown" });
        await ctx.editMessageText(`✅ Approved Successfully for User ${userId}`);
    } else {
        await bot.api.sendMessage(userId, `❌ *Payment Rejected!*\n\nBhai tumhara Ref/UTR verify nahi ho paaya. Please support panel par sahi screenshot send karo.`);
        await ctx.editMessageText(`❌ Rejected Request for User ${userId}`);
    }
    delete m.PENDING_DEPOSITS[refKey];
});

// 💳 USER NE JAB "PAID" BUTTON DABAAYA
bot.callbackQuery(/^user_paid_(via_upi|via_usdt)$/, async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id);
    u.awaiting_utr = true;
    await ctx.editMessageText("📝 *Bhai, ab apna 12-digit UTR / Reference number niche message box mein type karke send karo:*", { parse_mode: "Markdown" });
});

// ⚡ LIVE TEXT INPUT RECEIVER
bot.on("message:text", async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id, ctx.from.first_name);
    const txt = ctx.message.text.trim();

    // 1. UTR Submission handler
    if (u.awaiting_utr) {
        u.awaiting_utr = false;
        const refKey = Date.now().toString();
        const amtUsd = u.chosen_pay_method === "pay_via_upi" ? (u.current_deposit_amt / config.USD_TO_INR_RATE) : u.current_deposit_amt;

        m.PENDING_DEPOSITS[refKey] = { amount_usd: amtUsd, utr: txt, method: u.chosen_pay_method };

        const adminKb = new InlineKeyboard()
            .text("✅ APPROVE", `adm_app_${ctx.from.id}_${refKey}`)
            .text("❌ REJECT", `adm_rej_${ctx.from.id}_${refKey}`);

        await bot.api.sendMessage(config.ADMIN_ID, 
            `🔔 *NEW MANUAL PAYMENT REQUEST!* 🔔\n\n` +
            `👤 *User:* ${u.username} (ID: \`${ctx.from.id}\`)\n` +
            `💰 *Expected Amount:* ${u.chosen_pay_method === "pay_via_upi" ? "₹" + u.current_deposit_amt : "$" + u.current_deposit_amt}\n` +
            `🛠️ *Method:* \`${u.chosen_pay_method === "pay_via_upi" ? "UPI" : "USDT"}\`\n` +
            `📝 *Submitted UTR/Hash:* \`${txt}\`\n\nBhai verify karke action chuno:`, 
            { reply_markup: adminKb, parse_mode: "Markdown" }
        );

        await ctx.reply(`💌 *Request Submitted!* ✅\n\nBhai tumhara Ref/UTR number \`${txt}\` verification ke liye admin ke paas bhej diya gaya hai. Check hone ke baad balance add ho jayega!`);
        return;
    }

    // 2. Add Fund Amount handler
    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
        const amt = parseFloat(txt);
        if (isNaN(amt) || amt <= 0) {
            await ctx.reply("❌ Invalid amount! Try again with a valid number:");
            return;
        }
        
        u.awaiting_deposit_amt = false;
        u.current_deposit_amt = amt;
        
        const kb = new InlineKeyboard()
            .text("🟢 PAID", `user_paid_${u.chosen_pay_method}`).row()
            .text("⬅️ Cancel", "back_to_menu");
        
        // 🔹 UPI SE ADD FUND CHUNNE PAR QR AUR ID CONFIG SE UTHTI HAI
        if (u.chosen_pay_method === "pay_via_upi") {
            await ctx.replyWithPhoto(config.UPI_QR_LINK, { 
                caption: `🟢 *UPI MANUAL PAYMENT SYSTEM*\n\n💵 *Amount to Pay:* ₹${amt.toFixed(2)}\n📍 *UPI ID:* \`${config.UPI_ID}\`\n\n👉 *Step 1:* Is QR code par ₹${amt.toFixed(2)} pay karein.\n👉 *Step 2:* Pay karne ke baad neeche diye gaye *PAID* button par click karein.`, 
                reply_markup: kb, 
                parse_mode: "Markdown" 
            });
        } 
        // 🔸 USDT SE ADD FUND CHUNNE PAR QR AUR ADDRESS CONFIG SE UTHTI HAI
        else {
            await ctx.replyWithPhoto(config.USDT_QR_LINK, { 
                caption: `🪙 *USDT (TRC20) MANUAL DEPOSIT*\n\n💵 *Amount to Pay:* $${amt.toFixed(2)}\n📍 *USDT Address:* \`${config.USDT_ADDRESS}\`\n\n👉 *Step 1:* Is address par $${amt.toFixed(2)} transfer karein.\n👉 *Step 2:* Pay karne ke baad neeche diye gaye *PAID* button par click karein.`, 
                reply_markup: kb, 
                parse_mode: "Markdown" 
            });
        }
        return;
    }

    await o.handleTextMessages(ctx);
});

async function startBotEngine() {
    try {
        console.log("Wiping out old container links...");
        await bot.api.deleteWebhook({ drop_pending_updates: true });
        run(bot);
        console.log("HAPPY REACTION Perfect Combined Engine Active Now!");
    } catch (err) {
        console.error("Starting Error:", err);
        setTimeout(startBotEngine, 5000);
    }
}

startBotEngine();
