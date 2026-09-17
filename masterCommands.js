const { InlineKeyboard } = require('grammy');
const config = require('./config');
const o = require('./orderHandlers');
const core = require('./bot');
let SERVICES_MASTER_DATA = require('./services');

module.exports = (bot) => {
    const getLiveUpi = () => core.DYNAMIC_USER_DB.dynamic_config.upi_id || config.UPI_ID;
    const formatMoneyLocal = (usd, pref) => pref === "INR" ? `₹\${(usd * config.USD_TO_INR_RATE).toFixed(2)}` : `\$\${usd.toFixed(2)}`;

    bot.command("admin", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        await ctx.reply(`⚙️ *HAPPY REACTION Super Admin Control Panel*\n\n➕ *User Matrix Controls:*\n▫️ \`/ban USER_ID\` \n▫️ \`/unban USER_ID\` \n▫️ \`/addbalance USER_ID AMOUNT\` \n▫️ \`/deductbalance USER_ID AMOUNT\` \n▫️ \`/checkuser USER_ID\`\n\n🛠️ *SMM Live Controls:*\n▫️ \`/addservice ID Rate Type Name\`\n▫️ \`/updateservice ID NewRate\`\n▫️ \`/delservice ID\`\n\n💳 *Payment Credentials Controls:*\n▫️ \`/setupi NEW_UPI_ID\` \n▫️ \`/settrc20 WALLET_ADDRESS\` \n▫️ \`/setbep20 WALLET_ADDRESS\``, { parse_mode: "Markdown" });
    });
    bot.command("ban", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = parseInt(ctx.message.text.split(" ")[1]); if (isNaN(target) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ ID nahi mili!");
        core.DYNAMIC_USER_DB.users[target].is_banned = true; core.forceSaveDatabase(); await ctx.reply(`🚫 User \`${target}\` BAN ho gaya hai.`);
    });
    bot.command("unban", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = parseInt(ctx.message.text.split(" ")[1]); if (isNaN(target) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ ID nahi mili!");
        core.DYNAMIC_USER_DB.users[target].is_banned = false; core.forceSaveDatabase(); await ctx.reply(`✅ User \`${target}\` UNBAN ho gaya hai.`);
    });
    bot.command("addbalance", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" "), target = parseInt(args[1]), amt = parseFloat(args[2]);
        if (isNaN(target) || isNaN(amt) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Format: \`/addbalance USER_ID AMOUNT\`");
        core.DYNAMIC_USER_DB.users[target].balance_usd += amt; core.forceSaveDatabase(); await ctx.reply("💰 *Successfully Added $*" + amt.toFixed(2) + " *to User:* `" + target + "`");
        try { await bot.api.sendMessage(target, "✨ *Admin dwara tumhare account mein $*" + amt.toFixed(2) + " *add kar diye gaye hain!*"); } catch(e) {}
    });
    bot.command("deductbalance", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" "), target = parseInt(args[1]), amt = parseFloat(args[2]);
        if (isNaN(target) || isNaN(amt) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Format: \`/deductbalance USER_ID AMOUNT\`");
        core.DYNAMIC_USER_DB.users[target].balance_usd -= amt; if (core.DYNAMIC_USER_DB.users[target].balance_usd < 0) core.DYNAMIC_USER_DB.users[target].balance_usd = 0; core.forceSaveDatabase();
        await ctx.reply("💸 *Successfully Deducted $*" + amt.toFixed(2) + " *from User:* `" + target + "`");
    });
    bot.command("checkuser", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = parseInt(ctx.message.text.split(" ")[1]); if (isNaN(target) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ User nahi mila!");
        const u = core.DYNAMIC_USER_DB.users[target];
        await ctx.reply("👤 *USER PROFILE (ID: " + target + ")*\n\n💵 *Balance:* $" + u.balance_usd.toFixed(2) + " (" + formatMoneyLocal(u.balance_usd, "INR") + ")\n💰 *Deposit:* $" + u.total_deposit_usd.toFixed(2) + "\n💸 *Spent:* $" + u.spent_usd.toFixed(2) + "\n📦 *Orders:* " + u.orders_count + "\n⏳ *Pending:* " + u.pending_orders + "\n🛑 *Status:* " + (u.is_banned ? "BANNED" : "ACTIVE"), { parse_mode: "Markdown" });
    });
    bot.command("setupi", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const newUpi = ctx.message.text.split(" ")[1]; if (!newUpi) return ctx.reply("❌ Format: \`/setupi NEW_UPI_ID\`");
        core.DYNAMIC_USER_DB.dynamic_config.upi_id = newUpi; core.forceSaveDatabase(); await ctx.reply(`✅ *Live UPI ID Updated to:* \`${newUpi}\``);
    });
    bot.command("settrc20", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const newWallet = ctx.message.text.split(" ")[1]; if (!newWallet) return ctx.reply("❌ Format: \`/settrc20 WALLET_ADDRESS\`");
        core.DYNAMIC_USER_DB.dynamic_config.usdt_trc20 = newWallet; core.forceSaveDatabase(); await ctx.reply(`🪙 *USDT TRC20 Address Updated!*`);
    });
    bot.command("setbep20", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const newWallet = ctx.message.text.split(" ")[1]; if (!newWallet) return ctx.reply("❌ Format: \`/setbep20 WALLET_ADDRESS\`");
        core.DYNAMIC_USER_DB.dynamic_config.usdt_bep20 = newWallet; core.forceSaveDatabase(); await ctx.reply(`🪙 *USDT BEP20 Address Updated!*`);
    });
    bot.command("addservice", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" ").slice(1); if (args.length < 4) return ctx.reply("❌ Use: \`/addservice ID Rate Type Name\`");
        SERVICES_MASTER_DATA[args[0]] = { name: args.slice(3).join(" "), rate: parseFloat(args[1]), type: args[2] };
        fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8'); await ctx.reply(`✅ Service Added successfully!`);
    });
    bot.command("updateservice", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" ").slice(1); if (args.length < 2 || !SERVICES_MASTER_DATA[args[0]]) return ctx.reply("❌ Not found!");
        SERVICES_MASTER_DATA[args[0]].rate = parseFloat(args[1]);
        fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8'); await ctx.reply(`✅ Rate Updated successfully!`);
    });
    bot.command("delservice", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const id = ctx.message.text.split(" ")[1]; if (!id || !SERVICES_MASTER_DATA[id]) return ctx.reply("❌ ID nahi mili!");
        delete SERVICES_MASTER_DATA[id]; fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8'); await ctx.reply(`❌ Service Deleted successfully!`);
    });

    bot.on("message:text", async (ctx) => {
        const txt = ctx.message.text.trim(); if (txt.startsWith("/")) return;
        const u = core.getLocalUser(ctx.from.id, ctx.from.first_name);
        if (u.awaiting_deposit_amt && u.chosen_pay_method) {
            const amt = parseFloat(txt); if (isNaN(amt) || amt <= 0) return ctx.reply("❌ Invalid amount!");
            u.awaiting_deposit_amt = false; u.current_deposit_amt = amt;
            if (u.chosen_pay_method === "pay_via_upi") {
                await ctx.reply("🟢 *UPI MANUAL PAYMENT SYSTEM*\n\n💵 *Amount to Pay:* ₹" + amt.toFixed(2) + "\n📍 *UPI ID:* `" + getLiveUpi() + "` _(Tap to copy)_\n\n👉 *Instructions:* Diye gaye UPI ID par exactly ₹" + amt.toFixed(2) + " transfer karein aur uske baad neeche diye gaye *CONFIRM PAYMENT* button par click karein bhai. ", { reply_markup: new InlineKeyboard().text("CONFIRM PAYMENT", "user_complete_pay_via_upi").row().text("BACK", "main_add_funds"), parse_mode: "Markdown" });
            } else {
                await ctx.reply("आप अपना USDT नेटवर्क सेलेक्ट करें:\n\n💵 *Amount:* \$" + amt.toFixed(2), { reply_markup: new InlineKeyboard().text("BEP20", "usdtnet_bep20").text("TRC20", "usdtnet_trc20"), parse_mode: "Markdown" });
            } return;
        }
        if (u.awaiting_utr) {
            u.awaiting_utr = false; const refKey = Date.now().toString();
            const amtUsd = u.chosen_pay_method === "pay_via_upi" ? (u.current_deposit_amt / config.USD_TO_INR_RATE) : u.current_deposit_amt;
            core.DYNAMIC_USER_DB.pending_deposits[refKey] = { amount_usd: amtUsd, utr: txt, method: u.chosen_pay_method }; core.forceSaveDatabase();
            const adminKb = new InlineKeyboard().text("✅ ACCEPT", "adm_acc_" + ctx.from.id + "_" + refKey).text("❌ CANCEL", "adm_can_" + ctx.from.id + "_" + refKey);
            let alertMsg = "🔔 *NEW MANUAL PAYMENT REQUEST!* 🔔\n\n👤 *User:* " + u.username + " (ID: `" + ctx.from.id + "`)\n🆔 *Order Number:* `# " + u.current_order_num + "`\n💰 *Expected Amount:* " + (u.chosen_pay_method === "pay_via_upi" ? "₹" + u.current_deposit_amt : "\$" + u.current_deposit_amt) + "\n🛠️ *Method:* " + (u.chosen_pay_method === "pay_via_upi" ? "UPI" : "USDT (" + u.chosen_network.toUpperCase() + ")") + "\n📝 *ID/UTR:* `" + txt + "`";
            await bot.api.sendMessage(config.ADMIN_ID, alertMsg, { reply_markup: adminKb, parse_mode: "Markdown" });
            await ctx.reply("💌 *Details Received!* ✅\n\nTumhara Reference/Transaction ID `" + txt + "` verification ke liye admin ke paas bhej diya gaya hai!"); return;
        }
        await o.handleTextMessages(ctx);
    });
};
