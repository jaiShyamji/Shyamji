const { InlineKeyboard } = require('grammy');
const fs = require('fs');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');
let SERVICES_MASTER_DATA = require('./services');

function saveServicesToFile() {
    fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8');
    o.reloadServices(); SERVICES_MASTER_DATA = require('./services');
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
    },
    handleAdminActions: async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const parts = ctx.callbackQuery.data.split("_"), action = parts, userId = parseInt(parts), refKey = parts;
        const depositData = m.PENDING_DEPOSITS[refKey]; if (!depositData) return ctx.answerCallbackQuery({ text: "❌ Request expired!", show_alert: true });
        const u = m.getOrCreateUser(userId);
        if (action === "acc") {
            u.balance_usd += depositData.amount_usd; u.total_deposit_usd += depositData.amount_usd;
            const successMsg = `✅ *Payment Added Successful!* 💰\n\nBhai tumhara payment verify ho gaya hai.\n✨ *Added Amount:* ${m.formatMoney(depositData.amount_usd, u.currency)}\n💳 *Total Balance:* ${m.formatMoney(u.balance_usd, u.currency)}`;
            await ctx.api.sendMessage(userId, successMsg, { parse_mode: "Markdown" }); await ctx.editMessageText(`✅ Request Accepted for User ${userId}`);
        } else {
            await ctx.api.sendMessage(userId, `❌ *Payment Request Cancelled!*`); await ctx.editMessageText(`❌ Request Cancelled for User ${userId}`);
        } delete m.PENDING_DEPOSITS[refKey];
    },
    handleSubmitUtrTrigger: async (ctx) => {
        const u = m.getOrCreateUser(ctx.from.id); u.awaiting_utr = true;
        await ctx.reply("📝 *Bhai, apna Reference / Transaction ID yahan send karo:*", { parse_mode: "Markdown" });
    },
    handleAdminPanelCommand: async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        await ctx.reply(`⚙️ *HAPPY REACTION Admin Control Panel*\n\n➕ *Add Service:* \`/addservice ID Rate Type Name\`\n📝 *Update Rate:* \`/updateservice ID NewRate\`\n❌ *Delete Service:* \`/delservice ID\``, { parse_mode: "Markdown" });
    },
    handleAddServiceCommand: async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" ").slice(1); if (args.length < 4) return ctx.reply("❌ Use: `/addservice ID Rate Type Name`");
        SERVICES_MASTER_DATA[args] = { name: args.slice(3).join(" "), rate: parseFloat(args), type: args }; saveServicesToFile();
        await ctx.reply(`✅ *Service Added!* \n🆔 ID: \`${args}\``);
    },
    handleUpdateServiceCommand: async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" ").slice(1); if (args.length < 2 || !SERVICES_MASTER_DATA[args]) return ctx.reply("❌ Not found!");
        SERVICES_MASTER_DATA[args].rate = parseFloat(args); saveServicesToFile();
        await ctx.reply(`✅ *Rate Updated!*`);
    },
    handleDelServiceCommand: async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" ").slice(1); if (args.length < 1 || !SERVICES_MASTER_DATA[args]) return ctx.reply("❌ Not found!");
        delete SERVICES_MASTER_DATA[args]; saveServicesToFile();
        await ctx.reply(`❌ *Service Deleted!*`);
    }
};
