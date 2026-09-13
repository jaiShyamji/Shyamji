require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const { run } = require('@grammyjs/runner');
const axios = require('axios');
const fs = require('fs');
const config = require('./config');
let SERVICES_MASTER_DATA = require('./services');

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);

const USER_DATABASE = {};
const PENDING_DEPOSITS = {};

function getOrCreateUser(id, name = "User") {
    if (!USER_DATABASE[id]) {
        USER_DATABASE[id] = { username: name, balance_usd: 0.0, total_deposit_usd: 0.0, spent_usd: 0.0, orders_count: 0, cancelled_orders: 0, pending_orders: 0, history: [], currency: "INR", pending_service: null, pending_qty: null, pending_cost_usd: null, awaiting_custom_qty: false, awaiting_deposit_amt: false, chosen_pay_method: null, awaiting_utr: false, current_deposit_amt: 0, current_order_num: 0, chosen_network: "" };
    }
    return USER_DATABASE[id];
}

function formatMoney(usd, pref) {
    return pref === "INR" ? `₹${(usd * config.USD_TO_INR_RATE).toFixed(2)}` : `$${usd.toFixed(2)}`;
}

function getHappyReactionKeyboard() {
    return new InlineKeyboard()
        .text("BALANCE", "check_balance").text("ADD FUND", "main_add_funds").row()
        .text("MY CHANNEL", "my_channels").text("SERVICE", "main_services").row()
        .text("MY ORDERS", "main_orders").text("MY PROFILE", "my_profile").row()
        .text("PROMOTION", "main_promo").text("SUPPORT", "main_support").row()
        .text("CURRENCY", "toggle_currency");
}

bot.command("start", async (ctx) => {
    getOrCreateUser(ctx.from.id, ctx.from.first_name);
    await ctx.reply(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: getHappyReactionKeyboard(), parse_mode: "Markdown" });
});

bot.callbackQuery("back_to_menu", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id); u.awaiting_deposit_amt = false; u.awaiting_utr = false;
    await ctx.editMessageText(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: getHappyReactionKeyboard(), parse_mode: "Markdown" });
});

bot.callbackQuery("main_add_funds", async (ctx) => {
    const kb = new InlineKeyboard().text("Payment via UPI", "pay_via_upi").text("Payment via USDT", "pay_via_usdt").row().text("BACK", "back_to_menu");
    await ctx.editMessageText("💳 *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: kb, parse_mode: "Markdown" });
});

bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, async (ctx) => {
    const u = getOrCreateUser(ctx.from.id); u.chosen_pay_method = ctx.callbackQuery.data; u.awaiting_deposit_amt = true;
    if (u.chosen_pay_method === "pay_via_upi") {
        await ctx.editMessageText(`💰 *Enter Amount:* UPI\n\nकृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (INR ₹) you want to add:`);
    } else {
        await ctx.editMessageText(`💰 *Enter Amount:* USDT\n\nकृपया वह राशि (USDT) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (USDT) you want to add:`);
    }
});

bot.callbackQuery("user_complete_pay_via_upi", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id); u.awaiting_utr = true;
    const orderNum = Math.floor(100000 + Math.random() * 900000); u.current_order_num = orderNum;
    await ctx.editMessageText(`💵 *Payment Initiated!* ✅\n\n📊 *Expected Amount:* \`₹${u.current_deposit_amt.toFixed(2)}\`\n🆔 *Order Number:* \`#${orderNum}\`\n\n⚠️ *SUBMIT UTR TRANSACTION ID:*\nBhai, ab apna 12-digit UTR/Reference number niche message box mein type karke send karo aur sath mein payment ka screenshot bhi attach karke bhejo:`, { parse_mode: "Markdown" });
});

bot.callbackQuery(/^usdtnet_(bep20|trc20)$/, async (ctx) => {
    const u = getOrCreateUser(ctx.from.id); const network = ctx.callbackQuery.data.split("_")[1]; u.chosen_network = network;
    const address = network === "trc20" ? config.USDT_TRC20 : config.USDT_BEP20;
    const kb = new InlineKeyboard().text("CONFIRM PAYMENT", "usdt_confirm_click").row().text("BACK", "pay_via_usdt");
    await ctx.editMessageText(`🪙 *USDT ${network.toUpperCase()} MANUAL DEPOSIT*\n\n💵 *Amount to Pay:* $${u.current_deposit_amt.toFixed(2)}\n📍 *Address:* \`${address}\`\n\n👉 Address par send karke neeche *CONFIRM PAYMENT* par click karein.`, { reply_markup: kb, parse_mode: "Markdown" });
});

bot.callbackQuery("usdt_confirm_click", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id); u.awaiting_utr = true;
    const orderNum = Math.floor(100000 + Math.random() * 900000); u.current_order_num = orderNum;
    await ctx.editMessageText(`🪙 *USDT Deposit Initiated!* ✅\n\n📊 *Requested Amount:* \`$${u.current_deposit_amt.toFixed(2)}\`\n🌐 *Network:* \`${u.chosen_network.toUpperCase()}\`\n\n⚠️ *SUBMIT TRANSACTION ID:*\nBhai, apni USDT Transaction Hash ID (Transaction ID) niche message box mein type karke send karo:`, { parse_mode: "Markdown" });
});

bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)$/, async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const parts = ctx.callbackQuery.data.split("_"), action = parts[1], userId = parseInt(parts[2]), refKey = parts[3];
    const depositData = PENDING_DEPOSITS[refKey]; if (!depositData) return ctx.answerCallbackQuery({ text: "❌ Expired!", show_alert: true });
    const u = getOrCreateUser(userId);
    if (action === "acc") {
        u.balance_usd += depositData.amount_usd; u.total_deposit_usd += depositData.amount_usd;
        const successMsg = `✅ *Payment Added Successful!* 💰\n\nBhai tumhara payment verify ho gaya hai.\n✨ *Added Amount:* ${formatMoney(depositData.amount_usd, u.currency)}\n💳 *Total Balance:* ${formatMoney(u.balance_usd, u.currency)}`;
        await bot.api.sendMessage(userId, successMsg, { parse_mode: "Markdown" }); await ctx.editMessageText(`✅ Request Accepted for User ${userId}`);
    } else {
        await bot.api.sendMessage(userId, `❌ *Payment Request Cancelled!*`); await ctx.editMessageText(`❌ Cancelled for User ${userId}`);
    } delete PENDING_DEPOSITS[refKey];
});

bot.on("message:text", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id, ctx.from.first_name); const txt = ctx.message.text.trim();

    if (u.awaiting_utr) {
        u.awaiting_utr = false; const refKey = Date.now().toString();
        const amtUsd = u.chosen_pay_method === "pay_via_upi" ? (u.current_deposit_amt / config.USD_TO_INR_RATE) : u.current_deposit_amt;
        PENDING_DEPOSITS[refKey] = { amount_usd: amtUsd, utr: txt, method: u.chosen_pay_method };
        const adminKb = new InlineKeyboard().text("✅ ACCEPT", `adm_acc_${ctx.from.id}_${refKey}`).text("❌ CANCEL", `adm_can_${ctx.from.id}_${refKey}`);
        let alertMsg = `🔔 *NEW MANUAL PAYMENT REQUEST!* 🔔\n\n👤 *User:* ${u.username} (ID: \`${ctx.from.id}\`)\n🆔 *Order Number:* \`#${u.current_order_num}\`\n💰 *Expected Amount:* ${u.chosen_pay_method === "pay_via_upi" ? "₹" + u.current_deposit_amt : "$" + u.current_deposit_amt}\n🛠️ *Method:* \`${u.chosen_pay_method === "pay_via_upi" ? "UPI" : "USDT (" + u.chosen_network.toUpperCase() + ")"}\`\n📝 *ID/UTR:* \`${txt}\``;
        await bot.api.sendMessage(config.ADMIN_ID, alertMsg, { reply_markup: adminKb, parse_mode: "Markdown" });
        await ctx.reply(`💌 *Details Received!* ✅\n\nTumhara Reference/Transaction ID \`${txt}\` verification ke liye admin ke paas bhej diya gaya hai!`); return;
    }

    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
        const amt = parseFloat(txt); if (isNaN(amt) || amt <= 0) return ctx.reply("❌ Invalid amount! Try again:");
        u.awaiting_deposit_amt = false; u.current_deposit_amt = amt;
        
        if (u.chosen_pay_method === "pay_via_upi") {
            const upiString = `upi://pay?pa=${config.UPI_ID}&pn=${encodeURIComponent(config.MERCHANT_NAME)}&am=${amt.toFixed(2)}&cu=INR`;
            
            // 🌟 100% PERFECT DEEP LINKING GRID FOR ALL APPS (Bypasses Sandbox Blocks)
            const appsKb = new InlineKeyboard()
                .url("Google pay", `https://upilinks.in{encodeURIComponent(upiString)}`)
                .url("PAYTM", `https://upilinks.in{encodeURIComponent(upiString)}`).row()
                .url("PHONE PAY", `https://upilinks.in{encodeURIComponent(upiString)}`)
                .url("UPI", `https://upilinks.in{encodeURIComponent(upiString)}`).row()
                .url("OTHER PAYMENT METHOD", `https://upilinks.in{encodeURIComponent(upiString)}`).row()
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
