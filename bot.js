require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const SMM_API_URL = process.env.SMM_API_URL || "https://smmlite.com/api/v2";
const SMM_API_KEY = process.env.SMM_API_KEY;
const SUPPORT_USERNAME = process.env.SUPPORT_USERNAME || "YourSupportUsername";
const UPI_ID = process.env.UPI_ID || "your-vpa@ybl";
const USDT_ADDRESS = process.env.USDT_ADDRESS || "TYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const USD_TO_INR_RATE = 95.0;

const USER_DATABASE = {};

const SERVICES_MASTER_DATA = {
    "5153": { name: "telegram like (👍)", rate: 0.12, type: "tg_post" },
    "5160": { name: "telegram like (👍❤️🔥🥰)", rate: 0.15, type: "tg_post" },
    "5161": { name: "telegram like (❤️🔥👏🤩🎉🥰👍)", rate: 0.10, type: "tg_post" },
    "5162": { name: "telegram like (🔥)", rate: 0.15, type: "tg_post" },
    "5163": { name: "telegram like (❤️)", rate: 0.15, type: "tg_post" },
    "5164": { name: "telegram like (👏)", rate: 0.15, type: "tg_post" },
    "5165": { name: "telegram like (🤩)", rate: 0.15, type: "tg_post" },
    "1512": { name: "telegram post views [Last 1 post]", rate: 0.11, type: "tg_post" },
    "6855": { name: "telegram post views [1 post]", rate: 0.09, type: "tg_post" },
    "7153": { name: "Telegram Members [Refill 3 Days]", rate: 0.52, type: "tg_channel" },
    "6787": { name: "Telegram Members [Mixed, Cheap]", rate: 0.38, type: "tg_channel" },
    "3274": { name: "Telegram Channel Member", rate: 0.52, type: "tg_channel" },
    "7802": { name: "Likes [Speed 20K/Hr]", rate: 0.21, type: "ig_post" },
    "7526": { name: "Likes [HQ Instant]", rate: 0.26, type: "ig_post" },
    "7374": { name: "Likes [Indian Mixed]", rate: 0.19, type: "ig_post" },
    "3602": { name: "Followers [30 Days Refill]", rate: 3.12, type: "ig_profile" },
    "1658": { name: "Followers [Max 200K]", rate: 1.82, type: "ig_profile" },
    "1961": { name: "Followers [Max 10K]", rate: 2.48, type: "ig_profile" },
    "8810": { name: "Followers [No Refill]", rate: 1.77, type: "ig_profile" },
    "8782": { name: "Followers [Real Look]", rate: 1.97, type: "ig_profile" },
    "2968": { name: "Views [Unlimited]", rate: 0.40, type: "ig_post" },
    "6634": { name: "Views [Super Cheap]", rate: 0.30, type: "ig_post" },
    "7386": { name: "Emergency Views", rate: 0.10, type: "ig_post" }
};

if (!BOT_TOKEN) { process.exit(1); }
const bot = new Bot(BOT_TOKEN);

const TG_POST_RE = /https:\/\/t\.me\/([A-Za-z0-9_]+)\/(\d+)\/?/;
const TG_CHANNEL_RE = /https:\/\/t\.me\/([A-Za-z0-9_]+)\/?/;
const IG_POST_RE = /https:\/\/(www\.)?instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_\-]+)\/?/;
const IG_PROFILE_RE = /https:\/\/(www\.)?instagram\.com\/([A-Za-z0-9_\.]+)\/?/;

function getOrCreateUser(id) {
    if (!USER_DATABASE[id]) {
        USER_DATABASE[id] = { balance_usd: 0.0, spent_usd: 0.0, orders_count: 0, channels: [], history: [], order_details: {}, currency: "INR", pending_service: null, pending_qty: null, pending_cost_usd: null };
    }
    return USER_DATABASE[id];
}

function formatMoney(usd, pref) { return pref === "INR" ? `₹${(usd * USD_TO_INR_RATE).toFixed(2)}` : `$${usd.toFixed(2)}`; }
function validateLink(l, t) { if (t === "tg_post") return TG_POST_RE.test(l); if (t === "tg_channel") return TG_CHANNEL_RE.test(l); if (t === "ig_post") return IG_POST_RE.test(l); if (t === "ig_profile") return IG_PROFILE_RE.test(l); return true; }
function getMainAddFundsKeyboard() { return new InlineKeyboard().text("₹100", "amt_100").text("₹200", "amt_200").row().text("₹500", "amt_500").text("₹1000", "amt_1000").row().text("₹2000", "amt_2000").text("₹5000", "amt_5000").row().text("⬅️ Back", "back_to_menu"); }
function getMainMenuKeyboard() { return new InlineKeyboard().text("🛠️ Services", "main_services").text("💳 Add Funds", "main_add_funds").row().text("📦 My Orders", "main_orders").text("📢 My Channels", "main_channels").row().text("🎁 Promo", "main_promo").text("📞 Support", "main_support").row().text("🔄 Change Currency", "toggle_currency"); }
bot.command("start", async (ctx) => { const u = getOrCreateUser(ctx.from.id); await ctx.reply(`👋 Welcome!\n\n💳 Balance: ${formatMoney(u.balance_usd, u.currency)}`, { reply_markup: getMainMenuKeyboard() }); });
bot.callbackQuery("back_to_menu", async (ctx) => { const u = getOrCreateUser(ctx.from.id); await ctx.editMessageText(`👋 Menu\n\n💳 Balance: ${formatMoney(u.balance_usd, u.currency)}`, { reply_markup: getMainMenuKeyboard() }); });
bot.callbackQuery("toggle_currency", async (ctx) => { const u = getOrCreateUser(ctx.from.id); u.currency = u.currency === "USD" ? "INR" : "USD"; await ctx.answerCallbackQuery({ text: `Currency: ${u.currency}` }); await ctx.editMessageText(`💳 Balance: ${formatMoney(u.balance_usd, u.currency)}`, { reply_markup: getMainMenuKeyboard() }); });
bot.callbackQuery("main_add_funds", async (ctx) => { await ctx.editMessageText(`💳 *Add Funds:*`, { reply_markup: getMainAddFundsKeyboard(), parse_mode: "Markdown" }); });

bot.callbackQuery(/^amt_\d+$/, async (ctx) => {
    const amt = parseInt(ctx.callbackQuery.data.split("_")[1]);
    const keyboard = new InlineKeyboard().text("✅ Paid", `paid_${amt}`).row().text("⬅️ Back", "main_add_funds");
    await ctx.editMessageText(`💵 Pay: ₹${amt}\n📍 UPI: \`${UPI_ID}\`\n🪙 USDT: \`${USDT_ADDRESS}\``, { reply_markup: keyboard, parse_mode: "Markdown" });
});

bot.callbackQuery(/^paid_\d+$/, async (ctx) => {
    const amt = parseInt(ctx.callbackQuery.data.split("_")[1]);
    getOrCreateUser(ctx.from.id).history.push({ type: "deposit", amount_inr: amt, status: "Pending ⏳" });
    await ctx.editMessageText(`💌 Request Sent! Send screenshot to @${SUPPORT_USERNAME}`, { reply_markup: new InlineKeyboard().text("⬅️ Menu", "back_to_menu") });
});

bot.callbackQuery("main_channels", async (ctx) => {
    const botInfo = await ctx.api.getMe();
    const url = `https://t.me{botInfo.username}?startchannel=true&admin=post_messages+edit_messages+delete_messages+invite_users`;
    await ctx.editMessageText(`📢 Channels Menu`, { reply_markup: new InlineKeyboard().url("➕ Add Bot", url).row().text("⬅️ Back", "back_to_menu") });
});

bot.callbackQuery("main_support", async (ctx) => { await ctx.editMessageText(`📞 Contact @${SUPPORT_USERNAME}`, { reply_markup: new InlineKeyboard().text("⬅️ Back", "back_to_menu") }); });
bot.callbackQuery("main_promo", async (ctx) => { await ctx.editMessageText(`🎁 Promo Coming Soon!`, { reply_markup: new InlineKeyboard().text("⬅️ Back", "back_to_menu") }); });

bot.callbackQuery("main_orders", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id);
    await ctx.editMessageText(`📦 Total Orders: ${u.orders_count}`, { reply_markup: new InlineKeyboard().text("⬅️ Back", "back_to_menu") });
});

bot.callbackQuery("main_services", async (ctx) => {
    const keyboard = new InlineKeyboard().text("🔹 TELEGRAM", "platform_telegram").text("🔸 INSTAGRAM", "platform_instagram").row().text("⬅️ Back", "back_to_menu");
    await ctx.editMessageText(`🛠️ Select Platform:`, { reply_markup: keyboard });
});

bot.callbackQuery("platform_telegram", async (ctx) => {
    let t = `🔹 TELEGRAM SERVICES\n\nOrder matching code type karein (e.g. /5153)`;
    await ctx.editMessageText(t, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services") });
});

bot.callbackQuery("platform_instagram", async (ctx) => {
    await ctx.editMessageText(`🔸 INSTAGRAM SERVICES\n\nOrder matching code type karein (e.g. /7802)`, { reply_markup: new InlineKeyboard().text("⬅️ Back", "main_services") });
});

bot.hears(/^\/\d+$/, async (ctx) => {
    const id = ctx.message.text.slice(1);
    if (!SERVICES_MASTER_DATA[id]) return;
    getOrCreateUser(ctx.from.id).pending_service = id;
    const keyboard = new InlineKeyboard().text("1000", `buy_${id}_1000`).text("5000", `buy_${id}_5000`).row().text("❌ Cancel", "back_to_menu");
    await ctx.reply(`❓ Service [${SERVICES_MASTER_DATA[id].name}] ke liye quantity chunein:`, { reply_markup: keyboard });
});

bot.callbackQuery(/^buy_\d+_\d+$/, async (ctx) => {
    const p = ctx.callbackQuery.data.split("_");
    const id = p[1]; const q = parseInt(p[2]);
    if (!SERVICES_MASTER_DATA[id]) return;
    const u = getOrCreateUser(ctx.from.id);
    u.pending_service = id; u.pending_qty = q; u.pending_cost_usd = (q / 1000.0) * SERVICES_MASTER_DATA[id].rate;
    await ctx.editMessageText(`📋 Order Summary\nCost: $${u.pending_cost_usd}\n\n💬 Target Link send karein:`, { reply_markup: new InlineKeyboard().text("❌ Cancel", "back_to_menu") });
});

bot.on("message:text", async (ctx) => {
    const u = getOrCreateUser(ctx.from.id);
    if (!u.pending_service) return;
    const id = u.pending_service; const link = ctx.message.text.trim();
    if (!validateLink(link, SERVICES_MASTER_DATA[id].type)) { await ctx.reply("❌ Invalid Link Format!"); return; }
    
    try {
        const res = await axios.post(SMM_API_URL, null, { params: { key: SMM_API_KEY, action: "add", service: id, link: link, quantity: u.pending_qty }, timeout: 20000 });
        if (res.data && res.data.order) {
            u.orders_count++;
            await ctx.reply(`✅ Order Placed! ID: ${res.data.order}`);
        } else { await ctx.reply(`❌ Failed: ${res.data?.error || "Unknown"}`); }
    } catch (e) { await ctx.reply("❌ API Connection Error"); }
    u.pending_service = null;
});

bot.start();
console.log("Bot standard initialized successfully...");

