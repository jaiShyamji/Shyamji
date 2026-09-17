const { InlineKeyboard } = require('grammy');
const config = require('./config');
const o = require('./orderHandlers');
const core = require('./bot'); 
let SERVICES_MASTER_DATA = require('./services');

module.exports = (bot) => {
    bot.command("admin", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        await ctx.reply(`⚙️ *HAPPY REACTION Super Admin Panel Commands List*:\n\n` +
            `👤 *User Controls:*\n▫️ \`/ban USER_ID\` \n▫️ \`/unban USER_ID\` \n▫️ \`/addbalance USER_ID AMOUNT\` \n▫️ \`/deductbalance USER_ID AMOUNT\` \n▫️ \`/checkuser USER_ID\` -> View user profile\n\n` +
            `🛠️ *SMM Services Controls:*\n▫️ \`/addservice ID Rate Type Name\`\n▫️ \`/updateservice ID NewRate\`\n▫️ \`/delservice ID\`\n\n` +
            `💳 *Payment Config Controls (Direct Live Change):*\n▫️ \`/setupi NEW_UPI_ID\` \n▫️ \`/settrc20 WALLET_ADDRESS\` \n▫️ \`/setbep20 WALLET_ADDRESS\``, { parse_mode: "Markdown" });
    });

    bot.command("ban", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = parseInt(ctx.message.text.split(" ")[1]); if (isNaN(target) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Sahi User ID daalein!");
        core.DYNAMIC_USER_DB.users[target].is_banned = true; core.forceSaveDatabase(); await ctx.reply(`🚫 User \`${target}\` BAN ho gaya hai.`);
    });

    bot.command("unban", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = parseInt(ctx.message.text.split(" ")[1]); if (isNaN(target) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Sahi User ID daalein!");
        core.DYNAMIC_USER_DB.users[target].is_banned = false; core.forceSaveDatabase(); await ctx.reply(`✅ User \`${target}\` UNBAN ho gaya hai.`);
    });

    bot.command("addbalance", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" "), target = parseInt(args[1]), amt = parseFloat(args[2]);
        if (isNaN(target) || isNaN(amt) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Format: \`/addbalance USER_ID AMOUNT\`");
        core.DYNAMIC_USER_DB.users[target].balance_usd += amt; core.forceSaveDatabase(); await ctx.reply(`💰 Added \({amt.toFixed(2)} to\){target}.`);
        try { await bot.api.sendMessage(target, `✨ *Admin dwara tumhare account mein \$\${amt.toFixed(2)} add kar diye gaye hain!*`); } catch(e) {}
    });

    bot.command("deductbalance", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" "), target = parseInt(args[1]), amt = parseFloat(args[2]);
        if (isNaN(target) || isNaN(amt) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Format: \`/deductbalance USER_ID AMOUNT\`");
        core.DYNAMIC_USER_DB.users[target].balance_usd -= amt; if (core.DYNAMIC_USER_DB.users[target].balance_usd < 0) core.DYNAMIC_USER_DB.users[target].balance_usd = 0; core.forceSaveDatabase();
        await ctx.reply(`💸 Balance Deducted from \${target}.`);
    });

    bot.command("checkuser", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const target = parseInt(ctx.message.text.split(" ")[1]); if (isNaN(target) || !core.DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ User nahi mila!");
        const u = core.DYNAMIC_USER_DB.users[target];
        await ctx.reply(`👤 *USER LIVE DATA PROFILE (ID: \({target})*\n\n💵 *Balance:* \)\${u.balance_usd.toFixed(2)} (\({core.formatMoneyLocal(u.balance_usd, "INR")})\n💰 *Total Deposit:* \)\({u.total_deposit_usd.toFixed(2)}\n💸 *Total Spent:* \)\({u.spent_usd.toFixed(2)}\n📦 *Orders placed:* \){u.orders_count}\n⏳ *Pending Orders:* \({u.pending_orders}\n🛑 *Status:* \){u.is_banned ? "BANNED" : "ACTIVE"}`, { parse_mode: "Markdown" });
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
        const args = ctx.message.text.split(" ").slice(1); if (args.length < 4) return ctx.reply("❌ Format error!");
        const id = args[0], rate = parseFloat(args[1]), type = args[2], name = args.slice(3).join(" ");
        SERVICES_MASTER_DATA[id] = { name: name, rate: rate, type: type };
        fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8'); await ctx.reply(`✅ Service Added successfully!`);
    });

    bot.command("updateservice", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const args = ctx.message.text.split(" ").slice(1); if (args.length < 2) return ctx.reply("❌ Format error!");
        const id = args[0], newRate = parseFloat(args[1]); if (!SERVICES_MASTER_DATA[id]) return ctx.reply("❌ ID nahi mili!");
        SERVICES_MASTER_DATA[id].rate = newRate;
        fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8'); await ctx.reply(`✅ Rate Updated successfully!`);
    });

    bot.command("delservice", async (ctx) => {
        if (ctx.from.id !== config.ADMIN_ID) return;
        const id = ctx.message.text.split(" ")[1]; if (!id || !SERVICES_MASTER_DATA[id]) return ctx.reply("❌ ID nahi mili!");
        delete SERVICES_MASTER_DATA[id];
        fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8'); await ctx.reply(`❌ Service Deleted successfully!`);
    });
};
