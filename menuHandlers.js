const { InlineKeyboard } = require('grammy');
const config = require('./config');

const USER_DATABASE = {};

function getOrCreateUser(id, username = "User") {
    if (!USER_DATABASE[id]) {
        USER_DATABASE[id] = { 
            username: username || "User",
            balance_usd: 0.0, // Starting balance bilkul 0 kar diya bhai
            total_deposit_usd: 0.0, // Starting deposit bhi 0 rahega
            spent_usd: 0.0, 
            orders_count: 0, 
            cancelled_orders: 0,
            pending_orders: 0,
            history: [], 
            currency: "INR", 
            pending_service: null, 
            pending_qty: null, 
            pending_cost_usd: null, 
            awaiting_custom_qty: false, 
            awaiting_deposit_amt: false, 
            chosen_pay_method: null 
        };
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

module.exports = {
    USER_DATABASE,
    getOrCreateUser,
    formatMoney,
    getHappyReactionKeyboard,

    start: async (ctx) => { 
        getOrCreateUser(ctx.from.id, ctx.from.first_name); 
        await ctx.reply(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: getHappyReactionKeyboard(), parse_mode: "Markdown" }); 
    },
    backMenu: async (ctx) => { 
        const u = getOrCreateUser(ctx.from.id); u.awaiting_deposit_amt = false; 
        await ctx.editMessageText(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: getHappyReactionKeyboard(), parse_mode: "Markdown" }); 
    },
    checkBalance: async (ctx) => {
        const u = getOrCreateUser(ctx.from.id);
        await ctx.editMessageText(`💰 *Your Balance Details:*\n\n💵 *Current Balance:* ${formatMoney(u.balance_usd, u.currency)}\n💳 *Total Deposited:* ${formatMoney(u.total_deposit_usd, u.currency)}`, { reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), parse_mode: "Markdown" });
    },
    myProfile: async (ctx) => {
        const u = getOrCreateUser(ctx.from.id);
        await ctx.editMessageText(`👤 *USER PROFILE DETAILS:*\n\n📝 *Name:* ${u.username}\n🆔 *User ID:* \`${ctx.from.id}\`\n\n💳 *Current Balance:* ${formatMoney(u.balance_usd, u.currency)}\n💰 *Total Deposited:* ${formatMoney(u.total_deposit_usd, u.currency)}\n💸 *Total Spent:* ${formatMoney(u.spent_usd, u.currency)}\n\n📦 *Total Orders:* ${u.orders_count}\n⏳ *Pending Orders:* ${u.pending_orders}\n❌ *Cancelled Orders:* ${u.cancelled_orders}`, { reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), parse_mode: "Markdown" });
    },
    myChannels: async (ctx) => { await ctx.reply("📢 *My Channels Features* coming soon!", { reply_markup: new InlineKeyboard().text("⬅️ Back", "back_to_menu") }); },
    mainPromo: async (ctx) => { await ctx.reply("🎁 *Promotion* coming soon!", { reply_markup: new InlineKeyboard().text("⬅️ Back", "back_to_menu") }); },
    mainSupport: async (ctx) => { await ctx.reply(`📞 Contact support at @${config.SUPPORT_USERNAME}`, { reply_markup: new InlineKeyboard().text("⬅️ Back", "back_to_menu") }); },
    toggleCurrency: async (ctx) => {
        const u = getOrCreateUser(ctx.from.id); u.currency = u.currency === "USD" ? "INR" : "USD"; await ctx.answerCallbackQuery({ text: `Set: ${u.currency}` });
        await ctx.editMessageText(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: getHappyReactionKeyboard(), parse_mode: "Markdown" });
    }
};
