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

const DB_FILE = './database.json';
let DYNAMIC_USER_DB = { users: {}, pending_deposits: {}, dynamic_config: {} };

if (fs.existsSync(DB_FILE)) {
    try {
        const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
        if (parsed.users && parsed.pending_deposits) { DYNAMIC_USER_DB = parsed; }
        else { DYNAMIC_USER_DB = { users: parsed, pending_deposits: {}, dynamic_config: {} }; }
    } catch (e) { DYNAMIC_USER_DB = { users: {}, pending_deposits: {}, dynamic_config: {} }; }
}
if (!DYNAMIC_USER_DB.dynamic_config) DYNAMIC_USER_DB.dynamic_config = {};

// Direct root context bridging layer for external menu files compatibility bhai
const globalCompatibilityBridge = new Proxy(DYNAMIC_USER_DB.users, {
    get: (target, prop) => target[prop] || null,
    set: (target, prop, value) => { target[prop] = value; return true; }
});

const forceSaveDatabase = () => fs.writeFileSync(DB_FILE, JSON.stringify(DYNAMIC_USER_DB, null, 4), 'utf-8');
const getLiveUpi = () => DYNAMIC_USER_DB.dynamic_config.upi_id || config.UPI_ID;
const getLiveTrc = () => DYNAMIC_USER_DB.dynamic_config.usdt_trc20 || config.USDT_TRC20;
const getLiveBep = () => DYNAMIC_USER_DB.dynamic_config.usdt_bep20 || config.USDT_BEP20;

function getLocalUser(id, name = "User") {
    if (!DYNAMIC_USER_DB.users[id]) {
        DYNAMIC_USER_DB.users[id] = { username: name, balance_usd: 0.0, total_deposit_usd: 0.0, spent_usd: 0.0, orders_count: 0, cancelled_orders: 0, pending_orders: 0, history: [], currency: "INR", pending_service: null, pending_qty: null, pending_cost_usd: null, awaiting_custom_qty: false, awaiting_deposit_amt: false, chosen_pay_method: null, awaiting_utr: false, current_deposit_amt: 0, current_order_num: 0, chosen_network: "", is_banned: false };
        forceSaveDatabase();
    } return DYNAMIC_USER_DB.users[id];
}
const formatMoneyLocal = (usd, pref) => pref === "INR" ? `₹${(usd * config.USD_TO_INR_RATE).toFixed(2)}` : `$${usd.toFixed(2)}`;

bot.use(async (ctx, next) => {
    if (ctx.from && DYNAMIC_USER_DB.users[ctx.from.id]?.is_banned) {
        if (ctx.callbackQuery) return ctx.answerCallbackQuery({ text: "🛑 Aapko BAN kiya gaya hai!", show_alert: true });
        return ctx.reply("❌ *Aapko is bot se BAN kar diya gaya hai!*");
    } await next();
});

// 👑 HIGHEST PRIORITY ADVANCED ADMIN COMMANDS ENGINE
bot.command("admin", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    await ctx.reply(`⚙️ *HAPPY REACTION Super Admin Control Panel*\n\n➕ *User Matrix Controls:*\n▫️ \`/ban USER_ID\` \n▫️ \`/unban USER_ID\` \n▫️ \`/addbalance USER_ID AMOUNT\` \n▫️ \`/deductbalance USER_ID AMOUNT\` \n▫️ \`/checkuser USER_ID\` -> View complete analytics profile\n\n🛠️ *SMM Live Controls:*\n▫️ \`/addservice ID Rate Type Name\`\n▫️ \`/updateservice ID NewRate\`\n▫️ \`/delservice ID\`\n\n💳 *Payment Credentials Controls (Direct Change):*\n▫️ \`/setupi NEW_UPI_ID\` \n▫️ \`/settrc20 WALLET_ADDRESS\` \n▫️ \`/setbep20 WALLET_ADDRESS\``, { parse_mode: "Markdown" });
});

bot.command("ban", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const target = parseInt(ctx.message.text.replace("/ban", "").trim());
    if (isNaN(target) || !DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ ID nahi mili!");
    DYNAMIC_USER_DB.users[target].is_banned = true; forceSaveDatabase(); await ctx.reply(`🚫 User \`${target}\` BAN ho gaya hai.`);
});

bot.command("unban", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const target = parseInt(ctx.message.text.replace("/unban", "").trim());
    if (isNaN(target) || !DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ ID nahi mili!");
    DYNAMIC_USER_DB.users[target].is_banned = false; forceSaveDatabase(); await ctx.reply(`✅ User \`${target}\` UNBAN ho gaya hai.`);
});

bot.command("addbalance", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.replace("/addbalance", "").trim().split(" "), target = parseInt(args), amt = parseFloat(args);
    if (isNaN(target) || isNaN(amt) || !DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Format: \`/addbalance USER_ID AMOUNT\`");
    DYNAMIC_USER_DB.users[target].balance_usd += amt; forceSaveDatabase();
    await ctx.reply("💰 *Successfully Added $*" + amt.toFixed(2) + " *to User:* `" + target + "`");
    try { await bot.api.sendMessage(target, "✨ *Admin dwara tumhare account mein $*" + amt.toFixed(2) + " *add kar diye gaye hain!*"); } catch(e) {}
});

bot.command("deductbalance", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.replace("/deductbalance", "").trim().split(" "), target = parseInt(args), amt = parseFloat(args);
    if (isNaN(target) || isNaN(amt) || !DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ Format: \`/deductbalance USER_ID AMOUNT\`");
    DYNAMIC_USER_DB.users[target].balance_usd -= amt; if (DYNAMIC_USER_DB.users[target].balance_usd < 0) DYNAMIC_USER_DB.users[target].balance_usd = 0; forceSaveDatabase();
    await ctx.reply("💸 *Successfully Deducted $*" + amt.toFixed(2) + " *from User:* `" + target + "`");
});

bot.command("checkuser", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const target = parseInt(ctx.message.text.replace("/checkuser", "").trim());
    if (isNaN(target) || !DYNAMIC_USER_DB.users[target]) return ctx.reply("❌ User nahi mila!");
    const u = DYNAMIC_USER_DB.users[target];
    await ctx.reply("👤 *USER PROFILE (ID: " + target + ")*\n\n💵 *Balance:* $" + u.balance_usd.toFixed(2) + " (" + formatMoneyLocal(u.balance_usd, "INR") + ")\n💰 *Total Deposit:* $" + u.total_deposit_usd.toFixed(2) + "\n💸 *Total Spent:* $" + u.spent_usd.toFixed(2) + "\n📦 *Total Orders:* " + u.orders_count + "\n⏳ *Pending Orders:* " + u.pending_orders + "\n🛑 *Status:* " + (u.is_banned ? "BANNED" : "ACTIVE"), { parse_mode: "Markdown" });
});

bot.command("setupi", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const newUpi = ctx.message.text.replace("/setupi", "").trim(); if (!newUpi) return ctx.reply("❌ Format Error!");
    DYNAMIC_USER_DB.dynamic_config.upi_id = newUpi; forceSaveDatabase(); await ctx.reply(`✅ *Live UPI ID Updated to:* \`${newUpi}\``);
});

bot.command("settrc20", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const addr = ctx.message.text.replace("/settrc20", "").trim(); if (!addr) return ctx.reply("❌ Error!");
    DYNAMIC_USER_DB.dynamic_config.usdt_trc20 = addr; forceSaveDatabase(); await ctx.reply(`🪙 *USDT TRC20 Address Updated!*`);
});

bot.command("setbep20", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const addr = ctx.message.text.replace("/setbep20", "").trim(); if (!addr) return ctx.reply("❌ Error!");
    DYNAMIC_USER_DB.dynamic_config.usdt_bep20 = addr; forceSaveDatabase(); await ctx.reply(`🪙 *USDT BEP20 Address Updated!*`);
});

bot.command("addservice", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.replace("/addservice", "").trim().split(" "); if (args.length < 4) return ctx.reply("❌ Format Error!");
    SERVICES_MASTER_DATA[args] = { name: args.slice(3).join(" "), rate: parseFloat(args), type: args };
    fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8'); await ctx.reply(`✅ Service Added successfully!`);
});

bot.command("updateservice", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.replace("/updateservice", "").trim().split(" "), id = args, newRate = parseFloat(args);
    if (!SERVICES_MASTER_DATA[id] || isNaN(newRate)) return ctx.reply("❌ Not found / Invalid rate!");
    SERVICES_MASTER_DATA[id].rate = newRate; fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8'); await ctx.reply(`✅ Rate Updated successfully!`);
});

bot.command("delservice", async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const id = ctx.message.text.replace("/delservice", "").trim(); if (!id || !SERVICES_MASTER_DATA[id]) return ctx.reply("❌ ID nahi mili!");
    delete SERVICES_MASTER_DATA[id]; fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8'); await ctx.reply(`❌ Service Deleted successfully!`);
});

// 👑 PLATFORMS MENUS & CALLPLAY ROUTER BINDINGS
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

bot.callbackQuery("main_add_funds", async (ctx) => {
    await ctx.editMessageText("💳 *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: new InlineKeyboard().text("Payment via UPI", "pay_via_upi").text("Payment via USDT", "pay_via_usdt").row().text("BACK", "back_to_menu"), parse_mode: "Markdown" });
});

bot.callbackQuery(/^pay_(via_upi|via_usdt)$/, async (ctx) => {
