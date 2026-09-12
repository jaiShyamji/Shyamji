const { InlineKeyboard } = require('grammy');
const fs = require('fs');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');
let SERVICES_MASTER_DATA = require('./services');

function saveServicesToFile() {
    const fileContent = `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`;
    fs.writeFileSync('./services.js', fileContent, 'utf-8');
    o.reloadServices();
    SERVICES_MASTER_DATA = require('./services');
}

module.exports = {
    addFundsMenu: async (ctx) => {
        const kb = new InlineKeyboard().text("Payment via UPI", "pay_via_upi").text("Payment via USDT", "pay_via_usdt").row().text("BACK", "back_to_menu");
        await ctx.editMessageText("💳 *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: kb, parse_mode: "Markdown" });
    },
    initPayMethod: async (ctx) => {
        const u = m.getOrCreateUser(ctx.from.id); u.chosen_pay_method = ctx.callbackQuery.data; u.awaiting_deposit_amt = true;
        if (u.chosen_pay_method === "pay_via_upi") {
            await ctx.editMessageText(`💰 *Enter Amount:* UPI\n\nकृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (INR ₹) you want to add:`);
        } else {
            await ctx.editMessageText(`💰 *Enter Amount:* USDT\n\nकृपया वह राशि (USDT) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (USDT) you want to add:`);
        }
    },
    handlePaymentComplete: async (ctx) => {
        const u = m.getOrCreateUser(ctx.from.id); u.awaiting_utr = true;
        const orderNum = Math.floor(100000 + Math.random() * 900000); u.current_order_num = orderNum;
        const targetAmt = u.chosen_pay_method === "pay_via_upi" ? `₹${u.current_deposit_amt.toFixed(2)}` : `$${u.current_deposit_amt.toFixed(2)}`;
        await ctx.editMessageText(`💵 *Payment Initiated!* ✅\n\n📊 *Expected Amount:* \`${targetAmt}\`\n🆔 *Order Number:* \`#${orderNum}\`\n\n⚠️ *SUBMIT UTR TRANSACTION ID:*\nBhai, ab apna 12-digit UTR/Reference number niche message box mein type karke send karo aur sath mein payment ka screenshot bhi attach karke bhejo:`, { parse_mode: "Markdown" });
    },
    handleUsdtNetworkSelect: async (ctx) => {
        const parts = ctx.callbackQuery.data.split("_"), network = parts, u = m.getOrCreateUser(ctx.from.id); u.chosen_network = network;
        const address = network === "trc20" ? config.USDT_TRC20 : config.USDT_BEP20;
        const kb = new InlineKeyboard().text("CONFIRM PAYMENT", "usdt_confirm_click").row().text("BACK", "pay_via_usdt");
        await ctx.editMessageText(`🪙 *USDT ${network.toUpperCase()} MANUAL DEPOSIT*\n\n💵 *Amount to Pay:* $${u.current_deposit_amt.toFixed(2)}\n📍 *Address:* \`${address}\`\n\n👉 Address par send karke neeche *CONFIRM PAYMENT* par click karein.`, { reply_markup: kb, parse_mode: "Markdown" });
    },
    handleUsdtConfirmClick: async (ctx) => {
        const u = m.getOrCreateUser(ctx.from.id); u.awaiting_utr = true;
        const orderNum = Math.floor(100000 + Math.random() * 900000); u.current_order_num = orderNum;
        await ctx.editMessageText(`🪙 *USDT Deposit Initiated!* ✅\n\n📊 *Requested Amount:* \`$${u.current_deposit_amt.toFixed(2)}\`\n🌐 *Network:* \`${u.chosen_network.toUpperCase()}\`\n\n⚠️ *SUBMIT TRANSACTION ID:*\nBhai, apni USDT Transaction Hash ID (Transaction ID) niche message box mein type karke send karo:`, { parse_mode: "Markdown" });
    }
};
module.exports.handleAdminActions = async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const parts = ctx.callbackQuery.data.split("_"), action = parts, userId = parseInt(parts), refKey = parts;
    const depositData = m.PENDING_DEPOSITS[refKey]; if (!depositData) return ctx.answerCallbackQuery({ text: "❌ Request expired!", show_alert: true });
    const u = m.getOrCreateUser(userId);
    if (action === "acc") {
        u.balance_usd += depositData.amount_usd; u.total_deposit_usd += depositData.amount_usd;
        const successMsg = `✅ *Payment Added Successful!* 💰\n\nBhai tumhara payment verify ho gaya hai.\n✨ *Added Amount:* ${m.formatMoney(depositData.amount_usd, u.currency)}\n💳 *Total Balance:* ${m.formatMoney(u.balance_usd, u.currency)}`;
        await ctx.api.sendMessage(userId, successMsg, { parse_mode: "Markdown" }); await ctx.editMessageText(`✅ Request Accepted for User ${userId}`);
    } else {
        await ctx.api.sendMessage(userId, `❌ *Payment Request Cancelled!*\n\nBhai tumhara deposit request cancel kar diya gaya hai.`); await ctx.editMessageText(`❌ Request Cancelled for User ${userId}`);
    } delete m.PENDING_DEPOSITS[refKey];
};

module.exports.handleSubmitUtrTrigger = async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id); u.awaiting_utr = true;
    await ctx.reply("📝 *Bhai, apna Reference / Transaction ID yahan send karo:*", { parse_mode: "Markdown" });
};

module.exports.handleAdminPanelCommand = async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    await ctx.reply(`⚙️ *HAPPY REACTION Admin Control Panel*\n\n➕ *Add Service:* \`/addservice ID Rate Type Name\`\n📝 *Update Rate:* \`/updateservice ID NewRate\`\n❌ *Delete Service:* \`/delservice ID\``, { parse_mode: "Markdown" });
};

module.exports.handleAddServiceCommand = async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" ").slice(1); if (args.length < 4) return ctx.reply("❌ Use: `/addservice ID Rate Type Name`", { parse_mode: "Markdown" });
    const id = args, rate = parseFloat(args), type = args, name = args.slice(3).join(" ");
    SERVICES_MASTER_DATA[id] = { name: name, rate: rate, type: type }; saveServicesToFile();
    await ctx.reply(`✅ *Service Added!* \n🆔 ID: \`${id}\`\n📋 Name: \`${name}\``, { parse_mode: "Markdown" });
};

module.exports.handleUpdateServiceCommand = async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" ").slice(1); if (args.length < 2) return ctx.reply("❌ Use: `/updateservice ID NewRate`", { parse_mode: "Markdown" });
    const id = args, newRate = parseFloat(args); if (!SERVICES_MASTER_DATA[id]) return ctx.reply("❌ Service ID nahi mili!");
    SERVICES_MASTER_DATA[id].rate = newRate; saveServicesToFile();
    await ctx.reply(`✅ *Rate Updated!* \n🆔 ID: \`${id}\`\n💸 New Rate: \`${newRate}\``, { parse_mode: "Markdown" });
};

module.exports.handleDelServiceCommand = async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" ").slice(1); if (args.length < 1) return ctx.reply("❌ Use: `/delservice ID`", { parse_mode: "Markdown" });
    const id = args; if (!SERVICES_MASTER_DATA[id]) return ctx.reply("❌ Service ID nahi mili!");
    delete SERVICES_MASTER_DATA[id]; saveServicesToFile();
    await ctx.reply(`❌ *Service Deleted!* \n🆔 ID: \`${id}\``, { parse_mode: "Markdown" });
};

module.exports.handleCombinedTextMessages = async (ctx) => {
    const u = m.getOrCreateUser(ctx.from.id, ctx.from.first_name); const txt = ctx.message.text.trim();
    if (u.awaiting_utr) {
        u.awaiting_utr = false; const refKey = Date.now().toString();
        const amtUsd = u.chosen_pay_method === "pay_via_upi" ? (u.current_deposit_amt / config.USD_TO_INR_RATE) : u.current_deposit_amt;
        m.PENDING_DEPOSITS[refKey] = { amount_usd: amtUsd, utr: txt, method: u.chosen_pay_method };
        const adminKb = new InlineKeyboard().text("✅ ACCEPT", `adm_acc_${ctx.from.id}_${refKey}`).text("❌ CANCEL", `adm_can_${ctx.from.id}_${refKey}`);
        let alertMsg = `🔔 *NEW MANUAL PAYMENT REQUEST!* 🔔\n\n👤 *User:* ${u.username} (ID: \`${ctx.from.id}\`)\n🆔 *Order Number:* \`#${u.current_order_num}\`\n💰 *Expected Amount:* ${u.chosen_pay_method === "pay_via_upi" ? "₹" + u.current_deposit_amt : "$" + u.current_deposit_amt}\n🛠️ *Method:* \`${u.chosen_pay_method === "pay_via_upi" ? "UPI" : "USDT (" + u.chosen_network.toUpperCase() + ")"}\`\n📝 *ID/UTR:* \`${txt}\``;
        await ctx.api.sendMessage(config.ADMIN_ID, alertMsg, { reply_markup: adminKb, parse_mode: "Markdown" });
        await ctx.reply(`💌 *Details Received!* ✅\n\nTumhara Reference/Transaction ID \`${txt}\` verification ke liye admin ke paas bhej diya gaya hai!`); return;
    }
    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
        const amt = parseFloat(txt); if (isNaN(amt) || amt <= 0) return ctx.reply("❌ Invalid amount! Try again:");
        u.awaiting_deposit_amt = false; u.current_deposit_amt = amt;
        if (u.chosen_pay_method === "pay_via_upi") {
            const upiUrlEncoded = encodeURIComponent(`upi://pay?pa=${config.UPI_ID}&pn=${encodeURIComponent(config.MERCHANT_NAME)}&am=${amt.toFixed(2)}&cu=INR`);
            const appsKb = new InlineKeyboard()
                .url("Google pay", `https://upilinks.in{upiUrlEncoded}`)
                .url("PAYTM", `https://upilinks.in{upiUrlEncoded}`).row()
                .url("PHONE PAY", `https://upilinks.in{upiUrlEncoded}`)
                .url("UPI", `https://upilinks.in{upiUrlEncoded}`).row()
                .url("OTHER PAYMENT METHOD", `https://upilinks.in{upiUrlEncoded}`).row()
                .text("PAYMENT COMPLETE", "user_complete_pay_via_upi");
            await ctx.reply(`Select your payment method:\n\n💵 *Amount to Pay:* ₹${amt.toFixed(2)}\n📍 *UPI ID:* \`${config.UPI_ID}\`\n\n👉 App select karke pay karein aur uske baad *PAYMENT COMPLETE* par click karke UTR bhejein bhai.`, { reply_markup: appsKb, parse_mode: "Markdown" });
        } else {
            const netKb = new InlineKeyboard().text("BEP20", "usdtnet_bep20").text("TRC20", "usdtnet_trc20");
            await ctx.reply(`आप अपना USDT नेटवर्क सेलेक्ट करें:\n\n💵 *Amount:* $${amt.toFixed(2)}`, { reply_markup: netKb, parse_mode: "Markdown" });
        } return;
    }
    await o.handleTextMessages(ctx);
};
