require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const { run } = require('@grammyjs/runner');
const fs = require('fs');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');
let SERVICES_MASTER_DATA = require('./services');

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

// Services file rewrite helper function
function saveServicesToFile() {
    const fileContent = `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`;
    fs.writeFileSync('./services.js', fileContent, 'utf-8');
    o.reloadServices();
    SERVICES_MASTER_DATA = require('./services');
}

// 👑 ADMIN COMMAND PANEL
bot.command("admin", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const txt = `⚙️ *HAPPY REACTION Admin Control Panel*\n\n` +
                `➕ *Add Service:* \`/addservice ID Rate Type Name\`\n` +
                `📝 *Update Rate:* \`/updateservice ID NewRate\`\n` +
                `❌ *Delete Service:* \`/delservice ID\``;
    await ctx.reply(txt, { parse_mode: "Markdown" });
});

bot.command("addservice", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" ").slice(1);
    if (args.length < 4) return ctx.reply("❌ Use: `/addservice ID Rate Type Name`", { parse_mode: "Markdown" });
    const id = args[0], rate = parseFloat(args[1]), type = args[2], name = args.slice(3).join(" ");
    SERVICES_MASTER_DATA[id] = { name: name, rate: rate, type: type };
    saveServicesToFile();
    await ctx.reply(`✅ *Service Added!* \n🆔 ID: \`${id}\`\n📋 Name: \`${name}\``, { parse_mode: "Markdown" });
});

bot.command("updateservice", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" ").slice(1);
    if (args.length < 2) return ctx.reply("❌ Use: `/updateservice ID NewRate`", { parse_mode: "Markdown" });
    const id = args[0], newRate = parseFloat(args[1]);
    if (!SERVICES_MASTER_DATA[id]) return ctx.reply("❌ Service ID nahi mili!");
    SERVICES_MASTER_DATA[id].rate = newRate;
    saveServicesToFile();
    await ctx.reply(`✅ *Rate Updated!* \n🆔 ID: \`${id}\`\n💸 New Rate: \`${newRate}\``, { parse_mode: "Markdown" });
});

bot.command("delservice", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" ").slice(1);
    if (args.length < 1) return ctx.reply("❌ Use: `/delservice ID`", { parse_mode: "Markdown" });
    const id = args[0];
    if (!SERVICES_MASTER_DATA[id]) return ctx.reply("❌ Service ID nahi mili!");
    delete SERVICES_MASTER_DATA[id];
    saveServicesToFile();
    await ctx.reply(`❌ *Service Deleted!* \n🆔 ID: \`${id}\``, { parse_mode: "Markdown" });
});

// 👑 ADMIN ACTIONS: ACCEPT / CANCEL DECISION PANEL LOGIC
bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)$/, async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const parts = ctx.callbackQuery.data.split("_");
    const action = parts[1], userId = parseInt(parts[2]), refKey = parts[3];
    const depositData = m.PENDING_DEPOSITS[refKey];
    if (!depositData) return ctx.answerCallbackQuery({ text: "❌ Request expired!", show_alert: true });

    const u = m.getOrCreateUser(userId);
    if (action === "acc") {
        u.balance_usd += depositData.amount_usd;
        u.total_deposit_usd += depositData.amount_usd;
        const successMsg = `✅ *Payment Added Successful!* 💰\n\nBhai tumhara payment verify ho gaya hai.\n✨ *Added Amount:* ${m.formatMoney(depositData.amount_usd, u.currency)}\n💳 *Total Balance:* ${m.formatMoney(u.balance_usd, u.currency)}`;
        await bot.api.sendMessage(userId, successMsg, { parse_mode: "Markdown" });
        await ctx.editMessageText(`✅ Request Accepted for User ${userId}`);
    } else {
        await bot.api.sendMessage(userId, `❌ *Payment Request Cancelled!*\n\nBhai tumhara deposit request cancel kar diya gaya hai.`);
        await ctx.editMessageText(`❌ Request Cancelled for User ${userId}`);
    }
    delete m.PENDING_DEPOSITS[refKey];
});

// User jab payment karne ke baad final UTR submit karne ki screen par ho
bot.callbackQuery(/^user_complete_pay_(via_upi|via_usdt)$/, async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id);
    u.awaiting_utr = true;
    const orderNum = Math.floor(100000 + Math.random() * 900000);
    u.current_order_num = orderNum;
    const targetAmt = u.chosen_pay_method === "pay_via_upi" ? `₹${u.current_deposit_amt.toFixed(2)}` : `$${u.current_deposit_amt.toFixed(2)}`;
    
    await ctx.editMessageText(
        `💵 *Payment Initiated!* ✅\n\n` +
        `📊 *Amount:* \`${targetAmt}\`\n` +
        `🆔 *Order Number:* \`#${orderNum}\`\n\n` +
        `⚠️ *SUBMIT UTR REFERENCE NUMBER:*\n` +
        `Bhai, ab apna 12-digit UTR/Reference number niche message box mein type karke send karo aur sath mein payment ka screenshot bhi attach karke bhejo:`, 
        { parse_mode: "Markdown" }
    );
});

// ⚡ LIVE TEXT INPUT RECEIVER (Payment Apps Router Included)
bot.on("message:text", async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id, ctx.from.first_name);
    const txt = ctx.message.text.trim();

    // A. UTR Submission logic
    if (u.awaiting_utr) {
        u.awaiting_utr = false;
        const refKey = Date.now().toString();
        const amtUsd = u.chosen_pay_method === "pay_via_upi" ? (u.current_deposit_amt / config.USD_TO_INR_RATE) : u.current_deposit_amt;
        m.PENDING_DEPOSITS[refKey] = { amount_usd: amtUsd, utr: txt, method: u.chosen_pay_method };

        const adminKb = new InlineKeyboard().text("✅ ACCEPT", `adm_acc_${ctx.from.id}_${refKey}`).text("❌ CANCEL", `adm_can_${ctx.from.id}_${refKey}`);
        await bot.api.sendMessage(config.ADMIN_ID, `🔔 *NEW MANUAL PAYMENT REQUEST!* 🔔\n\n👤 *User:* ${u.username} (ID: \`${ctx.from.id}\`)\n🆔 *Order Number:* \`#${u.current_order_num}\`\n💰 *Expected Amount:* ${u.chosen_pay_method === "pay_via_upi" ? "₹" + u.current_deposit_amt : "$" + u.current_deposit_amt}\n📝 *Submitted UTR/Hash:* \`${txt}\``, { reply_markup: adminKb, parse_mode: "Markdown" });
        await ctx.reply(`💌 *Details Received!* ✅\n\nTumhara Reference number \`${txt}\` verification ke liye admin ke paas bhej diya gaya hai!`);
        return;
    }

    // B. Add Fund Amount input handler (App Specific Specific Redirection added yahan par bhai)
    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
        const amt = parseFloat(txt);
        if (isNaN(amt) || amt <= 0) return ctx.reply("❌ Invalid amount! Try again:");
        
        u.awaiting_deposit_amt = false;
        u.current_deposit_amt = amt;
        
        // Agar user ne UPI select kiya hai toh apps ke links automatic generate honge bhai
        if (u.chosen_pay_method === "pay_via_upi") {
            const upiString = `upi://pay?pa=${config.UPI_ID}&pn=${encodeURIComponent(config.MERCHANT_NAME)}&am=${amt.toFixed(2)}&cu=INR`;
            
            // Premium App Specific Deep Linking Keyboard grid layout bhai
            const appsKb = new InlineKeyboard()
                .url("Paytm", `https://paytm.me{encodeURIComponent(upiString)}`)
                .url("PhonePe", `phonepe://pay?pa=${config.UPI_ID}&pn=${encodeURIComponent(config.MERCHANT_NAME)}&am=${amt.toFixed(2)}&cu=INR`).row()
                .url("Google Pay", `gpay://upi/pay?pa=${config.UPI_ID}&pn=${encodeURIComponent(config.MERCHANT_NAME)}&am=${amt.toFixed(2)}&cu=INR`)
                .text("Other UPI", `user_complete_pay_via_upi`).row() // Normal text format ke liye bhai
                .text("PAYMENT COMPLETE", "user_complete_pay_via_upi").row()
                .text("BACK", "main_add_funds");

            await ctx.reply(
                `🟢 *UPI MANUAL PAYMENT SYSTEM*\n\n` +
                `💵 *Amount to Pay:* ₹${amt.toFixed(2)}\n` +
                `📍 *UPI ID:* \`${config.UPI_ID}\`\n\n` +
                `👉 *Instructions:* Neeche diye gaye buttons mein se apna favorite app chuno ya directly UPI ID par transfer karke *PAYMENT COMPLETE* button par click karo bhai.`, 
                { reply_markup: appsKb, parse_mode: "Markdown" }
            );
        } 
        // Agar user ne USDT chuna hai toh normal address layout chalega
        else {
            const kb = new InlineKeyboard().text("PAYMENT COMPLETE", `user_complete_pay_${u.chosen_pay_method}`).row().text("BACK", "main_add_funds");
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
