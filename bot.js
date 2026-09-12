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

// 👑 ADMIN COMMAND PANEL
bot.command("admin", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    await ctx.reply(`⚙️ *HAPPY REACTION Admin Control Panel*\n\nBhai tumhara admin access active hai! Control grid ready hai.`, { parse_mode: "Markdown" });
});

// 👑 ADMIN ACTIONS: ACCEPT / CANCEL DECISION PANEL LOGIC
bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)$/, async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const parts = ctx.callbackQuery.data.split("_");
    const action = parts[1];
    const userId = parseInt(parts[2]);
    const refKey = parts[3];

    const depositData = m.PENDING_DEPOSITS[refKey];
    if (!depositData) {
        await ctx.answerCallbackQuery({ text: "❌ Request expired or already processed!", show_alert: true });
        return;
    }

    const u = m.getOrCreateUser(userId);
    if (action === "acc") {
        u.balance_usd += depositData.amount_usd;
        u.total_deposit_usd += depositData.amount_usd;
        
        const successMsg = `✅ *Payment Added Successful!* 💰\n\nBhai tumhara payment verify ho gaya hai.\n✨ *Added Amount:* ${m.formatMoney(depositData.amount_usd, u.currency)}\n💳 *Total Balance:* ${m.formatMoney(u.balance_usd, u.currency)}`;
        
        await bot.api.sendMessage(userId, successMsg, { parse_mode: "Markdown" });
        await ctx.editMessageText(`✅ Request Accepted Successfully for User ${userId}`);
    } else {
        await bot.api.sendMessage(userId, `❌ *Payment Request Cancelled!*\n\nBhai tumhara deposit request admin dwara cancel kar diya gaya hai. Agar koi dikkat hai toh support par contact karo.`);
        await ctx.editMessageText(`❌ Request Cancelled for User ${userId}`);
    }
    delete m.PENDING_DEPOSITS[refKey];
});

// 💳 USER NE JAB "PAYMENT COMPLETE" BUTTON DABAAYA (Regex and String split sequence fixed properly yahan)
bot.callbackQuery(/^user_complete_pay_(.+)$/, async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id);
    u.awaiting_utr = true;
    const orderNum = Math.floor(100000 + Math.random() * 900000);
    u.current_order_num = orderNum;
    
    const targetAmt = u.chosen_pay_method === "pay_via_upi" ? `₹${u.current_deposit_amt.toFixed(2)}` : `$${u.current_deposit_amt.toFixed(2)}`;
    
    await ctx.editMessageText(
        `💵 *Payment Initiated!* ✅\n\n` +
        `📊 *Amount:* \`${targetAmt}\`\n` +
        `🆔 *Order Number:* \`#${orderNum}\`\n\n` +
        `⚠️ *SUBMIT UTR REFERENCE NUMBER AND SCREENSHOT:*\n` +
        `Bhai, ab apna 12-digit UTR/Reference number niche message box mein type karke send karo aur sath mein payment ka screenshot bhi attach karke bhejo:`, 
        { parse_mode: "Markdown" }
    );
});

// ⚡ LIVE TEXT INPUT RECEIVER
bot.on("message:text", async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id, ctx.from.first_name);
    const txt = ctx.message.text.trim();

    // A. UTR Submission logic
    if (u.awaiting_utr) {
        u.awaiting_utr = false;
        const refKey = Date.now().toString();
        const amtUsd = u.chosen_pay_method === "pay_via_upi" ? (u.current_deposit_amt / config.USD_TO_INR_RATE) : u.current_deposit_amt;

        m.PENDING_DEPOSITS[refKey] = { amount_usd: amtUsd, utr: txt, method: u.chosen_pay_method };

        const adminKb = new InlineKeyboard()
            .text("✅ ACCEPT", `adm_acc_${ctx.from.id}_${refKey}`)
            .text("❌ CANCEL", `adm_can_${ctx.from.id}_${refKey}`);

        await bot.api.sendMessage(config.ADMIN_ID, 
            `🔔 *NEW DEPOSIT REQUEST RECEIVED!* 🔔\n\n` +
            `👤 *User:* ${u.username} (ID: \`${ctx.from.id}\`)\n` +
            `🆔 *Order Number:* \`#${u.current_order_num}\`\n` +
            `💰 *Expected Amount:* ${u.chosen_pay_method === "pay_via_upi" ? "₹" + u.current_deposit_amt : "$" + u.current_deposit_amt}\n` +
            `🛠️ *Method:* \`${u.chosen_pay_method === "pay_via_upi" ? "UPI" : "USDT"}\`\n` +
            `📝 *Submitted UTR/Hash:* \`${txt}\`\n\nBhai check karke apna decision le lo:`, 
            { reply_markup: adminKb, parse_mode: "Markdown" }
        );

        await ctx.reply(`💌 *Details Received!* ✅\n\nTumhara Reference number \`${txt}\` aur order details admin ke paas approval ke liye bhej di gayi hain. Check hone ke baad balance add ho jayega!`);
        return;
    }

    // B. Add Fund Amount input handler
    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
        const amt = parseFloat(txt);
        if (isNaN(amt) || amt <= 0) {
            await ctx.reply("❌ Invalid amount! Try again with a valid number:");
            return;
        }
        
        u.awaiting_deposit_amt = false;
        u.current_deposit_amt = amt;
        
        const kb = new InlineKeyboard()
            .text("PAYMENT COMPLETE", `user_complete_pay_${u.chosen_pay_method}`).row()
            .text("BACK", "main_add_funds");
        
        // AGAR UPI SELECT KIYA HAI
        if (u.chosen_pay_method === "pay_via_upi") {
            await ctx.reply(
                `🟢 *UPI MANUAL PAYMENT SYSTEM*\n\n` +
                `💵 *Amount to Pay:* ₹${amt.toFixed(2)}\n` +
                `📍 *UPI ID:* \`${config.UPI_ID}\`\n\n` +
                `👉 *Instructions:* Diye gaye UPI ID par ₹${amt.toFixed(2)} transfer karein aur uske baad neeche diye gaye *PAYMENT COMPLETE* button par click karein.`, 
                { reply_markup: kb, parse_mode: "Markdown" }
            );
        } 
        // AGAR USDT SELECT KIYA HAI
        else {
            await ctx.reply(
                `🪙 *USDT MANUAL CONFIGURATION*\n\n` +
                `💵 *Amount to Pay:* $${amt.toFixed(2)}\n` +
                `📍 *USDT Address:* \`${config.USDT_ADDRESS}\`\n\n` +
                `👉 *Instructions:* Diye gaye TRC20 address par $${amt.toFixed(2)} send karein aur uske baad neeche diye gaye *PAYMENT COMPLETE* button par click karein.`, 
                { reply_markup: kb, parse_mode: "Markdown" }
            );
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
