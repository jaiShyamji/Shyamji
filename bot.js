require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const { run } = require('@grammyjs/runner');
const fs = require('fs');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');

if (!config.BOT_TOKEN) process.exit(1);
const bot = new Bot(config.BOT_TOKEN);

let SERVICES_MASTER_DATA = require('./services');
const DB_FILE = './database.json';
let DYNAMIC_USER_DB = { users: {}, pending_deposits: {} }; // Structure updated for permanent storage bhai

// Safe Database Auto-Loader
if (fs.existsSync(DB_FILE)) {
    try { 
        const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); 
        if (parsed.users) DYNAMIC_USER_DB = parsed;
        else DYNAMIC_USER_DB = { users: parsed, pending_deposits: {} };
    } catch (e) { DYNAMIC_USER_DB = { users: {}, pending_deposits: {} }; }
}

function forceSaveDatabase() { fs.writeFileSync(DB_FILE, JSON.stringify(DYNAMIC_USER_DB, null, 4), 'utf-8'); }

function getLocalUser(id, name = "User") {
    if (!DYNAMIC_USER_DB.users[id]) {
        DYNAMIC_USER_DB.users[id] = { username: name, balance_usd: 0.0, total_deposit_usd: 0.0, spent_usd: 0.0, orders_count: 0, cancelled_orders: 0, pending_orders: 0, history: [], currency: "INR", pending_service: null, pending_qty: null, pending_cost_usd: null, awaiting_custom_qty: false, awaiting_deposit_amt: false, chosen_pay_method: null, awaiting_utr: false, current_deposit_amt: 0, current_order_num: 0, chosen_network: "", is_banned: false }; 
        forceSaveDatabase();
    } return DYNAMIC_USER_DB.users[id];
}

function formatMoneyLocal(usd, pref) { return pref === "INR" ? `₹${(usd * config.USD_TO_INR_RATE).toFixed(2)}` : `$${usd.toFixed(2)}`; }
function saveServicesToFile() { fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8'); delete require.cache[require.resolve('./services')]; SERVICES_MASTER_DATA = require('./services'); }

bot.use(async (ctx, next) => {
    if (ctx.from) {
        const u = DYNAMIC_USER_DB.users[ctx.from.id];
        if (u && u.is_banned) {
            if (ctx.callbackQuery) return ctx.answerCallbackQuery({ text: "🛑 Aapko BAN kiya gaya hai!", show_alert: true });
            return ctx.reply("❌ *Aapko is bot se BAN kar diya gaya hai!*");
        }
    }
    await next();
});

module.exports = { DYNAMIC_USER_DB, getLocalUser, formatMoneyLocal, forceSaveDatabase, saveServicesToFile };

require('./adminEngine')(bot);
require('./adminCommands')(bot);

async function startBotEngine() {
    try {
        await bot.api.deleteWebhook({ drop_pending_updates: true }); run(bot);
        console.log("HAPPY REACTION Perfect Combined Engine Active Now!");
    } catch (err) { setTimeout(startBotEngine, 5000); }
}
startBotEngine();
