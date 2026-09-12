require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const { run } = require('@grammyjs/runner');
const fs = require('fs'); // File handling ke liye bhai
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');
let SERVICES_MASTER_DATA = require('./services');

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);

// Saare interface commands aur callbacks mapping bhai
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

// File rewrite helper function
function saveServicesToFile() {
    const fileContent = `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`;
    fs.writeFileSync('./services.js', fileContent, 'utf-8');
    o.reloadServices();
    SERVICES_MASTER_DATA = require('./services');
}

// 👑 ADMIN PANEL ROOT COMMAND
bot.command("admin", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const txt = `⚙️ *HAPPY REACTION Admin Control Panel*\n\n` +
                `Bhai, tum bot se hi direct services manage kar sakte ho:\n\n` +
                `➕ *Add Service:* \`/addservice ID Rate Type Name\`\n` +
                `📝 *Update Rate:* \`/updateservice ID NewRate\`\n` +
                `❌ *Delete Service:* \`/delservice ID\`\n\n` +
                `_Example: /addservice 9999 0.25 tg_post Premium Likes_`;
    await ctx.reply(txt, { parse_mode: "Markdown" });
});

// 👑 1. ADD SERVICE COMMAND
bot.command("addservice", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" ").slice(1);
    if (args.length < 4) {
        await ctx.reply("❌ *Format galat hai!*\nUse: `/addservice ID Rate Type Name`", { parse_mode: "Markdown" });
        return;
    }
    const id = args[0];
    const rate = parseFloat(args[1]);
    const type = args[2];
    const name = args.slice(3).join(" ");

    SERVICES_MASTER_DATA[id] = { name: name, rate: rate, type: type };
    saveServicesToFile();
    await ctx.reply(`✅ *Service Added Successfully!* \n🆔 ID: \`${id}\`\n📋 Name: \`${name}\`\n💸 Rate: \`${rate}\`\n🛠️ Type: \`${type}\``, { parse_mode: "Markdown" });
});

// 👑 2. UPDATE SERVICE RATE COMMAND
bot.command("updateservice", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" ").slice(1);
    if (args.length < 2) {
        await ctx.reply("❌ *Format galat hai!*\nUse: `/updateservice ID NewRate`", { parse_mode: "Markdown" });
        return;
    }
    const id = args[0];
    const newRate = parseFloat(args[1]);

    if (!SERVICES_MASTER_DATA[id]) {
        await ctx.reply("❌ Bhai, ye Service ID database mein nahi mili!");
        return;
    }

    SERVICES_MASTER_DATA[id].rate = newRate;
    saveServicesToFile();
    await ctx.reply(`✅ *Rate Updated!* \n🆔 ID: \`${id}\`\n💸 New Rate: \`${newRate}\``, { parse_mode: "Markdown" });
});

// 👑 3. DELETE SERVICE COMMAND
bot.command("delservice", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" ").slice(1);
    if (args.length < 1) {
        await ctx.reply("❌ *Format galat hai!*\nUse: `/delservice ID`", { parse_mode: "Markdown" });
        return;
    }
    const id = args[0];

    if (!SERVICES_MASTER_DATA[id]) {
        await ctx.reply("❌ Bhai, ye Service ID database mein nahi mili!");
        return;
    }

    delete SERVICES_MASTER_DATA[id];
    saveServicesToFile();
    await ctx.reply(`❌ *Service Deleted Successfully!* \n🆔 ID: \`${id}\` ko panel se hata diya gaya hai.`, { parse_mode: "Markdown" });
});

// Admin Deposit Approval System Callbacks
bot.callbackQuery(/^adm_(acc|can)_(.+)_(.+)$/, async (ctx) => {
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
    if (action === "acc") {
        u.balance_usd += depositData.amount_usd;
        u.total_deposit_usd += depositData.amount_usd;
        const successMsg = `✅ *Payment Added Successful!* 💰\n\nBhai tumhara payment verify ho gaya hai.\n✨ *Added Amount:* ${m.formatMoney(depositData.amount_usd, u.currency)}\n💳 *Total Balance:* ${m.formatMoney(u.balance_usd, u.currency)}`;
        await bot.api.sendMessage(userId, successMsg, { parse_mode: "Markdown" });
        await ctx.editMessageText(`✅ Request Accepted Successfully for User ${userId}`);
    } else {
        await bot.api.sendMessage(userId, `❌ *Payment Request Cancelled!*\n\nBhai tumhara deposit request admin dwara cancel kar diya gaya hai.`);
        await ctx.editMessageText(`❌ Request Cancelled for User ${userId}`);
    }
    delete m.PENDING_DEPOSITS[refKey];
});

bot.callbackQuery(/^user_complete_pay_(.+)$/, async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id);
    u.awaiting_utr = true;
    const orderNum = Math.floor(100000 + Math.random() * 900000);
    u.current_order_num = orderNum;
    const targetAmt = u.chosen_pay_method === "pay_via_upi" ? `₹${u.current_deposit_amt.toFixed(2)}` : `$${u.current_deposit_amt.toFixed(2)}`;
    await ctx.editMessageText(`💵 *Payment Initiated!* ✅\n\n📊 *Amount:* \`${targetAmt}\`\n🆔 *Order Number:* \`#${orderNum}\`\n\n⚠️ *SUBMIT UTR REFERENCE NUMBER AND SCREENSHOT:*\nBhai, ab apna 12-digit UTR/Reference number niche message box mein type karke send karo:`, { parse_mode: "Markdown" });
});

bot.on("message:text", async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id, ctx.from.first_name);
    const txt = ctx.message.text.trim();

    if (u.awaiting_utr) {
        u.awaiting_utr = false;
        const refKey = Date.now().toString();
        const amtUsd = u.chosen_pay_method === "pay_via_upi" ? (u.current_deposit_amt / config.USD_TO_INR_RATE) : u.current_deposit_amt;
        m.PENDING_DEPOSITS[refKey] = { amount_usd: amtUsd, utr: txt, method: u.chosen_pay_method };
        const adminKb = new InlineKeyboard().text("✅ ACCEPT", `adm_acc_${ctx.from.id}_${refKey}`).text("❌ CANCEL", `adm_can_${ctx.from.id}_${refKey}`);
        await bot.api.sendMessage(config.ADMIN_ID, `🔔 *NEW MANUAL PAYMENT REQUEST!* 🔔\n\n👤 *User:* ${u.username} (ID: \`${ctx.from.id}\`)\n💰 *Expected Amount:* ${u.chosen_pay_method === "pay_via_upi" ? "₹" + u.current_deposit_amt : "$" + u.current_deposit_amt}\n📝 *Submitted UTR/Hash:* \`${txt}\``, { reply_markup: adminKb, parse_mode: "Markdown" });
        await ctx.reply(`💌 *Details Received!* ✅\n\nTumhara Reference number \`${txt}\` approval ke liye bhej diya gaya hai bhai!`);
        return;
    }

    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
        const amt = parseFloat(txt);
        if (isNaN(amt) || amt <= 0) { await ctx.reply("❌ Invalid amount! Try again:"); return; }
        u.awaiting_deposit_amt = false; u.current_deposit_amt = amt;
        const kb = new InlineKeyboard().text("PAYMENT COMPLETE", `user_complete_pay_${u.chosen_pay_method}`).row().text("BACK", "main_add_funds");
        if (u.chosen_pay_method === "pay_via_upi") {
            await ctx.reply(`🟢 *UPI MANUAL PAYMENT SYSTEM*\n\n💵 *Amount to Pay:* ₹${amt.toFixed(2)}\n📍 *UPI ID:* \`${config.UPI_ID}\`\n\n👉 UPI ID par transfer karke neeche *PAYMENT COMPLETE* par click karein.`, { reply_markup: kb, parse_mode: "Markdown" });
        } else {
            await ctx.reply(`🪙 *USDT MANUAL CONFIGURATION*\n\n💵 *Amount to Pay:* $${amt.toFixed(2)}\n📍 *USDT Address:* \`${config.USDT_ADDRESS}\`\n\n👉 Address par send karke neeche *PAYMENT COMPLETE* par click karein.`, { reply_markup: kb, parse_mode: "Markdown" });
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
