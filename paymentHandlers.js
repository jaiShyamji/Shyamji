const { InlineKeyboard } = require('grammy');
const fs = require('fs');
const config = require('./config');
const m = require('./menuHandlers');
const o = require('./orderHandlers');

const DB_FILE = './database.json';
let DYNAMIC_USER_DB = {};
const LOCAL_DEPOSITS = {};

if (fs.existsSync(DB_FILE)) {
    try { DYNAMIC_USER_DB = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); } catch (e) { DYNAMIC_USER_DB = {}; }
}
function forceSaveDatabase() { fs.writeFileSync(DB_FILE, JSON.stringify(DYNAMIC_USER_DB, null, 4), 'utf-8'); }
function getLocalUser(id, name = "User") {
    if (!DYNAMIC_USER_DB[id]) {
        DYNAMIC_USER_DB[id] = { username: name, balance_usd: 0.0, total_deposit_usd: 0.0, spent_usd: 0.0, orders_count: 0, cancelled_orders: 0, pending_orders: 0, history: [], currency: "INR", pending_service: null, pending_qty: null, pending_cost_usd: null, awaiting_custom_qty: false, awaiting_deposit_amt: false, chosen_pay_method: null, awaiting_utr: false, current_deposit_amt: 0, current_order_num: 0, chosen_network: "", is_banned: false }; forceSaveDatabase();
    } return DYNAMIC_USER_DB[id];
}
function formatMoneyLocal(usd, pref) { return pref === "INR" ? `₹${(usd * config.USD_TO_INR_RATE).toFixed(2)}` : `$${usd.toFixed(2)}`; }

let SERVICES_MASTER_DATA = require('./services');
function saveServicesToFile() {
    fs.writeFileSync('./services.js', `module.exports = ${JSON.stringify(SERVICES_MASTER_DATA, null, 4)};`, 'utf-8');
    o.reloadServices(); SERVICES_MASTER_DATA = require('./services');
}

module.exports = {
    getDatabaseUserOnly: (id) => DYNAMIC_USER_DB[id],
    handleStartCommand: async (ctx) => {
        getLocalUser(ctx.from.id, ctx.from.first_name);
        await ctx.reply(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: new InlineKeyboard().text("BALANCE", "check_balance").text("ADD FUND", "main_add_funds").row().text("MY CHANNEL", "my_channels").text("SERVICE", "main_services").row().text("MY ORDERS", "main_orders").text("MY PROFILE", "my_profile").row().text("PROMOTION", "main_promo").text("SUPPORT", "main_support").row().text("CURRENCY", "toggle_currency"), parse_mode: "Markdown" });
    },
    handleBackMenu: async (ctx) => {
        const u = getLocalUser(ctx.from.id); u.awaiting_deposit_amt = false; u.awaiting_utr = false;
        await ctx.editMessageText(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: new InlineKeyboard().text("BALANCE", "check_balance").text("ADD FUND", "main_add_funds").row().text("MY CHANNEL", "my_channels").text("SERVICE", "main_services").row().text("MY ORDERS", "main_orders").text("MY PROFILE", "my_profile").row().text("PROMOTION", "main_promo").text("SUPPORT", "main_support").row().text("CURRENCY", "toggle_currency"), parse_mode: "Markdown" });
    },
    handleCheckBalance: async (ctx) => {
        const u = getLocalUser(ctx.from.id); await ctx.editMessageText(`💰 *Your Balance Details:*\n\n💵 *Current Balance:* ${formatMoneyLocal(u.balance_usd, u.currency)}\n💳 *Total Deposited:* ${formatMoneyLocal(u.total_deposit_usd, u.currency)}`, { reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), parse_mode: "Markdown" });
    },
    handleMyProfile: async (ctx) => {
        const u = getLocalUser(ctx.from.id); await ctx.editMessageText(`👤 *USER PROFILE DETAILS:*\n\n📝 *Name:* ${u.username}\n🆔 *User ID:* \`${ctx.from.id}\`\n\n💳 *Current Balance:* ${formatMoneyLocal(u.balance_usd, u.currency)}\n💰 *Total Deposited:* ${formatMoneyLocal(u.total_deposit_usd, u.currency)}\n💸 *Total Spent:* ${formatMoneyLocal(u.spent_usd, u.currency)}\n\n📦 *Total Orders:* ${u.orders_count}\n⏳ *Pending Orders:* ${u.pending_orders}\n❌ *Cancelled Orders:* ${u.cancelled_orders}`, { reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), parse_mode: "Markdown" });
    },
    handleMainOrders: async (ctx) => {
        const u = getLocalUser(ctx.from.id); let txt = `📦 *YOUR ORDERS STATUS & HISTORY:*\n\n📊 *Total Orders:* ${u.orders_count}\n⏳ *Pending Orders:* ${u.pending_orders}\n\n*Last 5 Orders:* \n`;
        if (!u.history || u.history.length === 0) txt += "▫️ No orders placed yet."; else u.history.slice(-5).forEach(o => { txt += `🆔 ID: \`${o.order_id}\` | Qty: ${o.qty} | Status: ${o.status}\n`; });
        await ctx.editMessageText(txt, { reply_markup: new InlineKeyboard().text("⬅️ Back to Menu", "back_to_menu"), parse_mode: "Markdown" });
    },
    handleToggleCurrency: async (ctx) => {
        const u = getLocalUser(ctx.from.id); u.currency = u.currency === "USD" ? "INR" : "USD"; forceSaveDatabase();
        await ctx.editMessageText(`👋 Welcome to HAPPY REACTION!\n\nYour bot is ready ✅\n\nChoose an option below:`, { reply_markup: new InlineKeyboard().text("BALANCE", "check_balance").text("ADD FUND", "main_add_funds").row().text("MY CHANNEL", "my_channels").text("SERVICE", "main_services").row().text("MY ORDERS", "main_orders").text("MY PROFILE", "my_profile").row().text("PROMOTION", "main_promo").text("SUPPORT", "main_support").row().text("CURRENCY", "toggle_currency"), parse_mode: "Markdown" });
    },
    addFundsMenu: async (ctx) => {
        const kb = new InlineKeyboard().text("Payment via UPI", "pay_via_upi").text("Payment via USDT", "pay_via_usdt").row().text("BACK", "back_to_menu");
        await ctx.editMessageText("💳 *Select Payment Method / पेमेंट का तरीका चुनें:*", { reply_markup: kb, parse_mode: "Markdown" });
    },
    initPayMethod: async (ctx) => {
        const u = getLocalUser(ctx.from.id); u.chosen_pay_method = ctx.callbackQuery.data; u.awaiting_deposit_amt = true;
        if (u.chosen_pay_method === "pay_via_upi") { await ctx.editMessageText(`💰 *Enter Amount:* UPI\n\nकृपया वह राशि (INR ₹) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (INR ₹) you want to add:`); }
        else { await ctx.editMessageText(`💰 *Enter Amount:* USDT\n\nकृपया वह राशि (USDT) टाइप करें जो आप जोड़ना चाहते हैं:\nPlease enter the amount (USDT) you want to add:`); }
    },
    handleUpiComplete: async (ctx) => {
        const u = getLocalUser(ctx.from.id); u.awaiting_utr = true; const orderNum = Math.floor(100000 + Math.random() * 900000); u.current_order_num = orderNum;
        await ctx.editMessageText(`💵 *Payment Initiated!* ✅\n\n📊 *Expected Amount:* \`₹${u.current_deposit_amt.toFixed(2)}\`\n🆔 *Order Number:* \`#${orderNum}\`\n\n**⚠️ SUBMIT UTR TRANSACTION ID:**\nBhai, ab apna 12-digit UTR/Reference number niche message box mein type karke send karo aur sath mein payment ka screenshot bhi attach karke bhejo:`, { parse_mode: "Markdown" });
    },
    handleUsdtNetworkSelect: async (ctx) => {
        const parts = ctx.callbackQuery.data.split("_"), network = parts, u = getLocalUser(ctx.from.id); u.chosen_network = network;
        const address = network === "trc20" ? config.USDT_TRC20 : config.USDT_BEP20;
        const kb = new InlineKeyboard().text("CONFIRM PAYMENT", "usdt_confirm_click").row().text("BACK", "pay_via_usdt");
        await ctx.editMessageText(`🪙 *USDT ${network.toUpperCase()} MANUAL DEPOSIT*\n\n💵 *Amount to Pay:* $${u.current_deposit_amt.toFixed(2)}\n📍 *Address:* \`${address}\`\n\n👉 Address par send karke neeche *CONFIRM PAYMENT* par click karein.`, { reply_markup: kb, parse_mode: "Markdown" });
    },
    handleUsdtConfirmClick: async (ctx) => {
        const u = getLocalUser(ctx.from.id); u.awaiting_utr = true; const orderNum = Math.floor(100000 + Math.random() * 900000); u.current_order_num = orderNum;
        await ctx.editMessageText(`🪙 *USDT Deposit Initiated!* ✅\n\n📊 *Requested Amount:* \`$${u.current_deposit_amt.toFixed(2)}\`\n🌐 *Network:* \`${u.chosen_network.toUpperCase()}\`\n\n**⚠️ SUBMIT TRANSACTION ID:**\nBhai, apni USDT Transaction Hash ID (Transaction ID) niche message box mein type karke send karo:`, { parse_mode: "Markdown" });
    }
};
module.exports.handleAdminActions = async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const parts = ctx.callbackQuery.data.split("_"), action = parts, userId = parseInt(parts), refKey = parts;
    const depositData = LOCAL_DEPOSITS[refKey]; if (!depositData) return ctx.answerCallbackQuery({ text: "❌ Request expired!", show_alert: true });
    const u = getLocalUser(userId);
    if (action === "acc") {
        u.balance_usd += depositData.amount_usd; u.total_deposit_usd += depositData.amount_usd; forceSaveDatabase();
        const successMsg = `✅ *Payment Added Successful!* 💰\n\nBhai tumhara payment verify ho gaya hai.\n✨ *Added Amount:* ${formatMoneyLocal(depositData.amount_usd, u.currency)}\n💳 *Total Balance:* ${formatMoneyLocal(u.balance_usd, u.currency)}`;
        await ctx.api.sendMessage(userId, successMsg, { parse_mode: "Markdown" }); await ctx.editMessageText(`✅ Request Accepted for User ${userId}`);
    } else {
        await ctx.api.sendMessage(userId, `❌ *Payment Request Cancelled!*`); await ctx.editMessageText(`❌ Request Cancelled for User ${userId}`);
    } delete LOCAL_DEPOSITS[refKey];
};

module.exports.handleSubmitUtrTrigger = async (ctx) => {
    const u = getLocalUser(ctx.from.id); u.awaiting_utr = true;
    await ctx.reply("📝 *Bhai, apna Reference / Transaction ID yahan send karo:*", { parse_mode: "Markdown" });
};

// 👑 INCREASED POWERS ADMIN COMMANDS FUNCTIONS LOGIC
module.exports.handleAdminPanelCommand = async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const adminHelp = `⚙️ *HAPPY REACTION Super Admin Control Panel*\n\n` +
                      `➕ *Services Control:* \n` +
                      `▫️ \`/addservice ID Rate Type Name\`\n` +
                      `▫️ \`/updateservice ID NewRate\`\n` +
                      `▫️ \`/delservice ID\`\n\n` +
                      `🛡️ *User Security Control:* \n` +
                      `▫️ \`/ban USER_ID\` -> User block karne ke liye\n` +
                      `▫️ \`/unban USER_ID\` -> Block hatane ke liye\n\n` +
                      `💰 *Balance & Profiles Control:* \n` +
                      `▫️ \`/addbalance USER_ID AMOUNT_USD\` -> Dollar add karne ke liye\n` +
                      `▫️ \`/deductbalance USER_ID AMOUNT_USD\` -> Dollar gidak (kam) karne ke liye\n` +
                      `▫️ \`/checkuser USER_ID\` -> Poori profile aur total balance dekhne ke liye`;
    await ctx.reply(adminHelp, { parse_mode: "Markdown" });
};

module.exports.handleBanCommand = async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const target = ctx.message.text.split(" ")[1]; if (!target || !DYNAMIC_USER_DB[target]) return ctx.reply("❌ Use: `/ban USER_ID` (User database mein hona chahiye)");
    DYNAMIC_USER_DB[target].is_banned = true; forceSaveDatabase();
    await ctx.reply(`🚫 *User ${target} ko successfully BAN kar diya gaya hai!*`, { parse_mode: "Markdown" });
};

module.exports.handleUnbanCommand = async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const target = ctx.message.text.split(" ")[1]; if (!target || !DYNAMIC_USER_DB[target]) return ctx.reply("❌ Use: `/unban USER_ID`");
    DYNAMIC_USER_DB[target].is_banned = false; forceSaveDatabase();
    await ctx.reply(`✅ *User ${target} ko successfully UNBAN kar diya gaya hai!*`, { parse_mode: "Markdown" });
};

module.exports.handleAddBalanceCommand = async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" "); const target = args[1], amt = parseFloat(args[2]);
    if (!target || isNaN(amt) || !DYNAMIC_USER_DB[target]) return ctx.reply("❌ Use: `/addbalance USER_ID AMOUNT_USD`");
    DYNAMIC_USER_DB[target].balance_usd += amt; forceSaveDatabase();
    await ctx.reply(`💰 *Successfully Added $${amt}* to User ${target}! New: $${DYNAMIC_USER_DB[target].balance_usd}`);
    await ctx.api.sendMessage(target, `✨ *Admin dwara tumhare account mein $${amt} add kar diye gaye hain!*`, { parse_mode: "Markdown" });
};

module.exports.handleDeductBalanceCommand = async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" "); const target = args[1], amt = parseFloat(args[2]);
    if (!target || isNaN(amt) || !DYNAMIC_USER_DB[target]) return ctx.reply("❌ Use: `/deductbalance USER_ID AMOUNT_USD`");
    DYNAMIC_USER_DB[target].balance_usd -= amt; if (DYNAMIC_USER_DB[target].balance_usd < 0) DYNAMIC_USER_DB[target].balance_usd = 0; forceSaveDatabase();
    await ctx.reply(`💸 *Successfully Gidak (Deduct) $${amt}* from User ${target}! New: $${DYNAMIC_USER_DB[target].balance_usd}`);
};

module.exports.handleCheckUserCommand = async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const target = ctx.message.text.split(" ")[1]; if (!target || !DYNAMIC_USER_DB[target]) return ctx.reply("❌ Use: `/checkuser USER_ID`");
    const u = DYNAMIC_USER_DB[target];
    const profileText = `👤 *USER LIVE DATA PROFILE (ID: ${target})* \n\n` +
                        `📝 *Username:* ${u.username}\n` +
                        `💵 *Current Balance:* $${u.balance_usd.toFixed(2)} (₹${(u.balance_usd * config.USD_TO_INR_RATE).toFixed(2)})\n` +
                        `💰 *Total Deposited:* $${u.total_deposit_usd.toFixed(2)}\n` +
                        `💸 *Total Spent:* $${u.spent_usd.toFixed(2)}\n\n` +
                        `📦 *Total SMM Orders:* ${u.orders_count}\n` +
                        `⏳ *Pending Orders:* ${u.pending_orders}\n` +
                        `🚫 *Status:* ${u.is_banned ? "BANNED 🛑" : "ACTIVE ✅"}`;
    await ctx.reply(profileText, { parse_mode: "Markdown" });
};

module.exports.handleAddServiceCommand = async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" ").slice(1); if (args.length < 4) return ctx.reply("❌ Use: `/addservice ID Rate Type Name`");
    SERVICES_MASTER_DATA[args[0]] = { name: args.slice(3).join(" "), rate: parseFloat(args[1]), type: args[2] }; saveServicesToFile();
    await ctx.reply(`✅ *Service Added!* \n🆔 ID: \`${args[0]}\``);
};

module.exports.handleUpdateServiceCommand = async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" ").slice(1); if (args.length < 2 || !SERVICES_MASTER_DATA[args[0]]) return ctx.reply("❌ Not found!");
    SERVICES_MASTER_DATA[args[0]].rate = parseFloat(args[1]); saveServicesToFile();
    await ctx.reply(`✅ *Rate Updated!*`);
};

module.exports.handleDelServiceCommand = async (ctx) => {
    if (ctx.from.id !== config.ADMIN_ID) return;
    const args = ctx.message.text.split(" ").slice(1); if (args.length < 1 || !SERVICES_MASTER_DATA[args[0]]) return ctx.reply("❌ Not found!");
    delete SERVICES_MASTER_DATA[args[0]]; saveServicesToFile();
    await ctx.reply(`❌ *Service Deleted!*`);
};

module.exports.handleCombinedTextMessages = async (ctx) => {
    const u = getLocalUser(ctx.from.id, ctx.from.first_name); const txt = ctx.message.text.trim();
    if (u.awaiting_deposit_amt && u.chosen_pay_method) {
        const amt = parseFloat(txt); if (isNaN(amt) || amt <= 0) return ctx.reply("❌ Invalid amount! Try again:");
        u.awaiting_deposit_amt = false; u.current_deposit_amt = amt;
        if (u.chosen_pay_method === "pay_via_upi") {
            const upiKb = new InlineKeyboard().text("CONFIRM PAYMENT", "user_complete_pay_via_upi").row().text("BACK", "main_add_funds");
            await ctx.reply(`🟢 *UPI MANUAL PAYMENT SYSTEM*\n\n💵 *Amount to Pay:* ₹${amt.toFixed(2)}\n📍 *UPI ID:* \`${config.UPI_ID}\` _(Tap to copy)_\n\n👉 *Instructions:* Diye gaye UPI ID par exactly ₹${amt.toFixed(2)} transfer karein aur uske baad neeche diye gaye *CONFIRM PAYMENT* button par click karein bhai.`, { reply_markup: upiKb, parse_mode: "Markdown" });
        } else {
            const netKb = new InlineKeyboard().text("BEP20", "usdtnet_bep20").text("TRC20", "usdtnet_trc20");
            await ctx.reply(`आप अपना USDT नेटवर्क सेलेक्ट करें:\n\n💵 *Amount:* $${amt.toFixed(2)}`, { reply_markup: netKb, parse_mode: "Markdown" });
        } return;
    }
    if (u.awaiting_utr) {
        u.awaiting_utr = false; const refKey = Date.now().toString();
        const amtUsd = u.chosen_pay_method === "pay_via_upi" ? (u.current_deposit_amt / config.USD_TO_INR_RATE) : u.current_deposit_amt;
        LOCAL_DEPOSITS[refKey] = { amount_usd: amtUsd, utr: txt, method: u.chosen_pay_method };
        const adminKb = new InlineKeyboard().text("✅ ACCEPT", `adm_acc_${ctx.from.id}_${refKey}`).text("❌ CANCEL", `adm_can_${ctx.from.id}_${refKey}`);
        let alertMsg = `🔔 *NEW MANUAL PAYMENT REQUEST!* 🔔\n\n👤 *User:* ${u.username} (ID: \`${ctx.from.id}\`)\n🆔 *Order Number:* \`#${u.current_order_num}\`\n💰 *Expected Amount:* ${u.chosen_pay_method === "pay_via_upi" ? "₹" + u.current_deposit_amt : "$" + u.current_deposit_amt}\n🛠️ *Method:* \`${u.chosen_pay_method === "pay_via_upi" ? "UPI" : "USDT (" + u.chosen_network.toUpperCase() + ")"}\`\n📝 *ID/UTR:* \`${txt}\``;
        await ctx.api.sendMessage(config.ADMIN_ID, alertMsg, { reply_markup: adminKb, parse_mode: "Markdown" });
        await ctx.reply(`💌 *Details Received!* ✅\n\nTumhara Reference/Transaction ID \`${txt}\` verification ke liye admin ke paas bhej diya gaya hai!`); return;
    }
    await o.handleTextMessages(ctx);
};
