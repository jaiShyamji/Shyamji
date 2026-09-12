require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const { run } = require('@grammyjs/runner');
const axios = require('axios');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);

// Base layouts aur panels mapping bhai
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
bot.callbackQuery("main_orders", o.ordersHistory);

// 👑 ADMIN DASHBOARD CONTROL PANEL
bot.command("admin", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    await ctx.reply(`⚙️ *HAPPY REACTION Admin Control Panel*\n\nBhai tumhara admin access 100% active hai! Dashboard engine ready hai.`, { parse_mode: "Markdown" });
});

// 👑 ADMIN ACTIONS ROUTER: ACCEPT / CANCEL REAL CHANNELS LOGIC
bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)$/, async (ctx) => {
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
    if (action === "acc") {
        u.balance_usd += depositData.amount_usd;
        u.total_deposit_usd += depositData.amount_usd;
        
        // Tumhare bataye anusar success credit message response bhai
        const successMsg = `✅ *Payment Added Successful!* 💰\n\nBhai tumhara payment verify ho gaya hai.\n✨ *Added Amount:* ${m.formatMoney(depositData.amount_usd, u.currency)}\n💳 *Total Balance:* ${m.formatMoney(u.balance_usd, u.currency)}`;
        await bot.api.sendMessage(userId, successMsg, { parse_mode: "Markdown" });
        await ctx.editMessageText(`✅ Request Accepted Successfully for User ${userId}`);
    } else {
        await bot.api.sendMessage(userId, `❌ *Payment Request Cancelled!*\n\nBhai tumhara deposit request admin dwara cancel kar diya gaya hai.`);
        await ctx.editMessageText(`❌ Request Cancelled for User ${userId}`);
    }
    delete m.PENDING_DEPOSITS[refKey];
});

// 1. ADD FUND button dabane par UPI aur USDT ke 3 specific buttons screen par aayenge
bot.callbackQuery("main_add_funds", async (ctx) => {
    const kb = new InlineKeyboard()
        .text("Payment via UPI", "pay_via_upi")
        .text("Payment via USDT", "pay_via_usdt").row()
        .text("BACK", "back_to_menu");
    await ctx.editMessageText("💳 *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: kb, parse_mode: "Markdown" });
});

bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id);
    u.chosen_pay_method = ctx.callbackQuery.data;
    u.awaiting_deposit_amt = true;
    
    if (u.chosen_pay_method === "pay_via_upi") {
        await ctx.editMessageText(`💰 *Enter Amount:* UPI\n\nकृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (INR ₹) you want to add:`);
    } else {
        await ctx.editMessageText(`💰 *Enter Amount:* USDT\n\nकृपया वह राशि (USDT) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (USDT) you want to add:`);
    }
});

// User jab payment karne ke baad UPI ka "PAYMENT COMPLETE" dabaye
bot.callbackQuery("user_complete_pay_via_upi", async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id);
    u.awaiting_utr = true;
    const orderNum = Math.floor(100000 + Math.random() * 900000);
    u.current_order_num = orderNum;
    
    await ctx.editMessageText(
        `💵 *Payment Initiated!* ✅\n\n` +
        `📊 *Expected Amount:* \`₹${u.current_deposit_amt.toFixed(2)}\`\n` +
        `🆔 *Order Number:* \`#${orderNum}\`\n\n` +
        `⚠️ *SUBMIT UTR TRANSACTION ID:*\n` +
        `Bhai, ab apna 12-digit UTR/Reference number niche message box mein type karke send karo aur sath mein payment ka screenshot bhi attach karke bhejo:`, 
        { parse_mode: "Markdown" }
    );
});

// User jab USDT amount daalne ke baad Network select kare (BEP20 / TRC20)
bot.callbackQuery(/^usdtnet_(bep20|trc20)$/, async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id);
    const network = ctx.callbackQuery.data.split("_")[1];
    u.chosen_network = network;

    const address = network === "trc20" ? config.USDT_TRC20 : config.USDT_BEP20;
    const netName = network.toUpperCase();

    const kb = new InlineKeyboard()
        .text("CONFIRM PAYMENT", "usdt_confirm_click").row()
        .text("BACK", "pay_via_usdt");

    await ctx.editMessageText(
        `🪙 *USDT ${netName} MANUAL DEPOSIT*\n\n` +
        `💵 *Amount to Pay:* $${u.current_deposit_amt.toFixed(2)}\n` +
        `📍 *${netName} Address:* \`${address}\`\n\n` +
        `👉 *Instructions:* Diye gaye address par exactly $${u.current_deposit_amt.toFixed(2)} send karein aur uske baad neeche diye gaye *CONFIRM PAYMENT* button par click karein.`,
        { reply_markup: kb, parse_mode: "Markdown" }
    );
});

// User jab USDT ka "CONFIRM PAYMENT" dabaye
bot.callbackQuery("usdt_confirm_click", async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id);
    u.awaiting_utr = true;
    const orderNum = Math.floor(100000 + Math.random() * 900000);
    u.current_order_num = orderNum;

    await ctx.editMessageText(
        `🪙 *USDT Deposit Initiated!* ✅\n\n` +
        `📊 *Requested Amount:* \`$${u.current_deposit_amt.toFixed(2)}\`\n` +
        `🌐 *Network:* \`${u.chosen_network.toUpperCase()}\`\n\n` +
        `⚠️ *SUBMIT TRANSACTION ID:*\n` +
        `Bhai, apni USDT Transaction Hash ID (Transaction ID) niche message box mein type karke send karo aur sath mein transfer ka screenshot bhi attach karke bhejo:`,
        { parse_mode: "Markdown" }
    );
});

// ⚡ CORE INTERCEPTOR ENGINE (Amount, UTR aur normal messages ka direct router)
bot.on("message:text", async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id, ctx.from.first_name);
    const txt = ctx.message.text.trim();

    // 1. Agar User ID/UTR text format mein bhej raha hai
    if (u.awaiting_utr) {
        u.awaiting_utr = false;
        const refKey = Date.now().toString();
        const amtUsd = u.chosen_pay_method === "pay_via_upi" ? (u.current_deposit_amt / config.USD_TO_INR_RATE) : u.current_deposit_amt;

        m.PENDING_DEPOSITS[refKey] = { amount_usd: amtUsd, utr: txt, method: u.chosen_pay_method };

        const adminKb = new InlineKeyboard()
            .text("✅ ACCEPT", `adm_acc_${ctx.from.id}_${refKey}`)
            .text("❌ CANCEL", `adm_can_${ctx.from.id}_${refKey}`);

        let alertMsg = `🔔 *NEW MANUAL PAYMENT REQUEST!* 🔔\n\n` +
                       `👤 *User:* ${u.username} (ID: \`${ctx.from.id}\`)\n` +
                       `🆔 *Order Number:* \`#${u.current_order_num}\`\n` +
                       `💰 *Expected Amount:* ${u.chosen_pay_method === "pay_via_upi" ? "₹" + u.current_deposit_amt : "$" + u.current_deposit_amt}\n` +
                       `🛠️ *Method:* \`${u.chosen_pay_method === "pay_via_upi" ? "UPI" : "USDT (" + u.chosen_network.toUpperCase() + ")"}\`\n` +
                       `📝 *ID/UTR:* \`${txt}\``;

        await bot.api.sendMessage(config.ADMIN_ID, alertMsg, { reply_markup: adminKb, parse_mode: "Markdown" });
        await ctx.reply(`💌 *Details Received!* ✅\n\nTumhara Reference/Transaction ID \`${txt}\` verification ke liye admin ke paas bhej diya gaya hai!`);
        return;
    }

    // 2. JAISE HI USER AMOUNT ENTER KAREGA (Response block fixed properly bhai)
    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
        const amt = parseFloat(txt);
        if (isNaN(amt) || amt <= 0) {
            await ctx.reply("❌ Invalid amount! Try again with a valid number:");
            return;
        }
        
        u.awaiting_deposit_amt = false;
        u.current_deposit_amt = amt;
        
        // A. AGAR USER NE UPI SE KA FLOW CHUNA HAI
        if (u.chosen_pay_method === "pay_via_upi") {
            const upiString = `upi://pay?pa=${config.UPI_ID}&pn=${encodeURIComponent(config.MERCHANT_NAME)}&am=${amt.toFixed(2)}&cu=INR`;
            
            const appsKb = new InlineKeyboard()
                .url("Google pay", `gpay://upi/pay?pa=${config.UPI_ID}&pn=${encodeURIComponent(config.MERCHANT_NAME)}&am=${amt.toFixed(2)}&cu=INR`)
                .url("PAYTM", `https://paytm.me{encodeURIComponent(upiString)}`).row()
                .url("PHONE PAY", `phonepe://pay?pa=${config.UPI_ID}&pn=${encodeURIComponent(config.MERCHANT_NAME)}&am=${amt.toFixed(2)}&cu=INR`)
                .text("UPI", "user_complete_pay_via_upi").row()
                .text("OTHER PAYMENT METHOD", "user_complete_pay_via_upi").row()
                .text("PAYMENT COMPLETE", "user_complete_pay_via_upi");

            await ctx.reply(`Select your payment method:\n\n💵 *Amount to Pay:* ₹${amt.toFixed(2)}\n📍 *UPI ID:* \`${config.UPI_ID}\`\n\n👉 App select karke pay karein aur uske baad *PAYMENT COMPLETE* par click karein bhai.`, { reply_markup: appsKb, parse_mode: "Markdown" });
        } 
        // B. AGAR USER NE USDT KA FLOW CHUNA HAI
        else {
            const netKb = new InlineKeyboard()
                .text("BEP20", "usdtnet_bep20")
                .text("TRC20", "usdtnet_trc20");
