# ============================================================
# PART 1 — Imports, Config, Bot Setup, Helpers
# ============================================================
import os
import re
import logging
import asyncio
import requests
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiohttp import web
from services import SERVICES_MASTER_DATA

# ---------- ENV ----------
BOT_TOKEN      = os.getenv("BOT_TOKEN")
SMM_API_URL    = os.getenv("SMM_API_URL", "https://smmlite.com/api/v2")
SMM_API_KEY    = os.getenv("SMM_API_KEY")
SUPPORT_USERNAME = os.getenv("SUPPORT_USERNAME", "YourSupportUsername")
UPI_ID         = os.getenv("UPI_ID", "your-vpa@ybl")
USDT_ADDRESS   = os.getenv("USDT_ADDRESS", "TYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")

USD_TO_INR_RATE = 95.0

# ---------- LOGGING ----------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("name")  # ✅ double underscores

if not BOT_TOKEN:
    raise ValueError("ERROR: BOT_TOKEN is missing!")

# ---------- BOT ----------
bot = Bot(token=BOT_TOKEN)
dp  = Dispatcher()
USER_DATABASE = {}

# ---------- LINK REGEX ----------
TG_POST_RE    = re.compile(r"^https?://t\.me/([A-Za-z0-9_]+)/(\d+)/?$")
TG_CHANNEL_RE = re.compile(r"^(?:https?://t\.me/|@)([A-Za-z0-9_]{5,})/?$")
IG_POST_RE    = re.compile(r"^https?://(?:www\.)?instagram\.com/(?:p|reel|reels|tv)/[A-Za-z0-9_\-]+/?")
IG_PROFILE_RE = re.compile(r"^https?://(?:www\.)?instagram\.com/([A-Za-z0-9_.]{1,30})/?$")

# ---------- HELPERS ----------
def get_or_create_user(uid):
    if uid not in USER_DATABASE:
        USER_DATABASE[uid] = {
            "balance_usd": 0.0,
            "spent_usd": 0.0,
            "orders_count": 0,
            "channels": [],
            "history": [],
            "order_details": {},
            "currency": "INR",
            "pending_service": None,
            "pending_link": None,
            "pending_qty": None,
            "pending_cost_usd": None,
        }
    return USER_DATABASE[uid]


def format_money(usd, pref):
    if pref == "INR":
        return f"₹{round(usd * USD_TO_INR_RATE, 2)}"
    return f"${round(usd, 2)}"


def validate_link(link: str, stype: str) -> bool:
    link = link.strip()
    if stype == "tg_post":
        return bool(TG_POST_RE.match(link))
    if stype == "tg_channel":
        return bool(TG_CHANNEL_RE.match(link))
    if stype == "ig_post":
        return bool(IG_POST_RE.match(link))
    if stype == "ig_profile":
        if re.match(r"^https?://(?:www\.)?instagram\.com/(?:p|reel|reels|tv)/", link):
            return False
        return bool(IG_PROFILE_RE.match(link))
    return False


def main_menu_kb():
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="💰 Balance",      callback_data="main_balance"),
          types.InlineKeyboardButton(text="➕ Add Funds",    callback_data="main_add_funds"))
    b.row(types.InlineKeyboardButton(text="📢 My Channels",  callback_data="main_channels"),
          types.InlineKeyboardButton(text="🛠️ Services",     callback_data="main_services"))
    b.row(types.InlineKeyboardButton(text="📦 My Orders",    callback_data="main_orders"),
          types.InlineKeyboardButton(text="👤 My Profile",   callback_data="main_profile"))
    b.row(types.InlineKeyboardButton(text="🎁 Promotions",   callback_data="main_promo"),
          types.InlineKeyboardButton(text="💬 Support",      callback_data="main_support"))
    return b
    # ============================================================
# PART 2 — Start Menu, Balance, Back, Profile
# ============================================================
@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    get_or_create_user(message.from_user.id)
    await message.answer(
        "WELCOME TO HAPPY REACTION 🎉\n\n"
        "YOUR ACCOUNT IS READY ✅\n\n"
        "Choose an option below:👇",
        reply_markup=main_menu_kb().as_markup()
    )


@dp.callback_query(F.data == "back_to_menu")
async def back_to_menu(callback: types.CallbackQuery):
    await callback.message.edit_text(
        "🏠 Main Menu\n\nChoose an option below:👇",
        reply_markup=main_menu_kb().as_markup()
    )


@dp.callback_query(F.data == "main_balance")
async def process_balance(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="➕ Add Funds", callback_data="main_add_funds"))
    b.row(types.InlineKeyboardButton(text="⬅️ Back",      callback_data="back_to_menu"))
    await callback.message.edit_text(
        f"💰 Balance: {format_money(user['balance_usd'], user['currency'])}\n"
        f"💸 Spent:   {format_money(user['spent_usd'], user['currency'])}\n"
        f"📦 Orders:  {user['orders_count']}",
        reply_markup=b.as_markup()
    )


@dp.callback_query(F.data == "main_profile")
async def process_profile(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(
        text=f"💱 Currency: {user['currency']}",
        callback_data="toggle_currency"
    ))
    b.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    await callback.message.edit_text(
        f"👤 *My Profile*\n\n"
        f"🆔 User ID: {callback.from_user.id}\n"
        f"👋 Name: {callback.from_user.full_name}\n"
        f"💰 Balance: {format_money(user['balance_usd'], user['currency'])}\n"
        f"💸 Spent:   {format_money(user['spent_usd'], user['currency'])}\n"
        f"📦 Orders:  {user['orders_count']}\n"
        f"💱 Currency: {user['currency']}",
        reply_markup=b.as_markup(),
        parse_mode="Markdown"
    )


@dp.callback_query(F.data == "toggle_currency")
async def toggle_currency(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    user["currency"] = "USD" if user["currency"] == "INR" else "INR"
    await callback.answer(f"✅ Currency set to {user['currency']}")
    await process_profile(callback)
    # ============================================================
# PART 3 — Add Funds / Payment Flow
# ============================================================
@dp.callback_query(F.data == "main_add_funds")
async def process_add_funds(callback: types.CallbackQuery):
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="₹100",  callback_data="amt_100"),
          types.InlineKeyboardButton(text="₹200",  callback_data="amt_200"))
    b.row(types.InlineKeyboardButton(text="₹500",  callback_data="amt_500"),
          types.InlineKeyboardButton(text="₹1000", callback_data="amt_1000"))
    b.row(types.InlineKeyboardButton(text="₹2000", callback_data="amt_2000"),
          types.InlineKeyboardButton(text="₹5000", callback_data="amt_5000"))
    b.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    await callback.message.edit_text(
        "💳 Add Funds / डिपॉजिट Fund:\n\nकोई एक अमाउंट चुनें:",
        reply_markup=b.as_markup()
    )


@dp.callback_query(F.data.startswith("amt_"))
async def handle_amount_selection(callback: types.CallbackQuery):
    amount_inr = int(callback.data.split("_")[-1])
    amount_usd = amount_inr / USD_TO_INR_RATE

    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(
        text="✅ मैंने पेमेंट कर दी है",
        callback_data=f"paid_{amount_inr}"
    ))
    b.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_add_funds"))

    await callback.message.edit_text(
        f"📲 Pay: ₹{amount_inr} (~${round(amount_usd, 2)} USD)\n"
        f"📌 UPI ID: {UPI_ID}\n"
        f"📌 USDT Address: {USDT_ADDRESS}\n\n"
        f"Pay karke screenshot support par bhejein.",
        reply_markup=b.as_markup(),
        parse_mode="Markdown"
    )


@dp.callback_query(F.data.startswith("paid_"))
async def process_paid_click(callback: types.CallbackQuery):
    amount_inr = int(callback.data.split("_")[-1])
    amount_usd = amount_inr / USD_TO_INR_RATE

    user = get_or_create_user(callback.from_user.id)
    user["history"].append({
        "type": "deposit",
        "amount_inr": amount_inr,
        "amount_usd": amount_usd,
        "status": "Pending ⏳"
    })

    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(
        text="💬 Contact Support",
        url=f"https://t.me/{SUPPORT_USERNAME}"
    ))
    b.row(types.InlineKeyboardButton(text="⬅️ Menu", callback_data="back_to_menu"))

    await callback.message.edit_text(
        "✅ Request Sent!\n\n"
        "Team verify karke balance add karegi.\n"
        "Screenshot support par bhejein.",
        reply_markup=b.as_markup()
    )
    # ============================================================
# PART 4 — Channels, Support, Promo, Orders
# ============================================================
@dp.callback_query(F.data == "main_channels")
async def process_channels(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    bot_info = await bot.get_me()

    promote_url = (
        f"https://t.me/{bot_info.username}"
        f"?startchannel=true"
        f"&admin=post_messages+edit_messages+delete_messages+invite_users"
    )

    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="➕ Promote Bot as Admin", url=promote_url))
    b.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))

    text = "📢 My Channels:\n\n"
    if not user["channels"]:
        text += "❌ Koi channel linked nahi hai.\n"
    else:
        for idx, ch in enumerate(user["channels"], start=1):
            text += f"🔹 {idx}. {ch} (Active ✅)\n"

    await callback.message.edit_text(text, reply_markup=b.as_markup())


@dp.callback_query(F.data == "main_support")
async def process_support(callback: types.CallbackQuery):
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(
        text="💬 Chat with Support",
        url=f"https://t.me/{SUPPORT_USERNAME}"
    ))
    b.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    await callback.message.edit_text(
        "💬 *Support*\n\nKisi bhi problem ke liye yahan contact karein:",
        reply_markup=b.as_markup(),
        parse_mode="Markdown"
    )


@dp.callback_query(F.data == "main_promo")
async def process_promo(callback: types.CallbackQuery):
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    await callback.message.edit_text(
        "🎁 *Promotions*\n\n"
        "🎉 Welcome Bonus: Coming soon!\n"
        "🎉 Refer & Earn: Coming soon!\n",
        reply_markup=b.as_markup(),
        parse_mode="Markdown"
    )


@dp.callback_query(F.data == "main_orders")
async def process_orders(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)

    orders = [h for h in user["history"] if "order_id" in h]
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))

    if not orders:
        await callback.message.edit_text(
            "📦 *My Orders*\n\nAbhi tak koi order nahi hai.",
            reply_markup=b.as_markup(),
            parse_mode="Markdown"
        )
        return

    text = "📦 *My Orders* (last 10):\n\n"
    for o in orders[-10:]:
        text += (
            f"🆔 {o['order_id']}\n"
            f"   📦 {o['service']} | 🔢 {o['qty']:,}\n"
            f"   💵 {format_money(o['cost_usd'], user['currency'])} | {o['status']}\n\n"
        )

    await callback.message.edit_text(
        text,
        reply_markup=b.as_markup(),
        parse_mode="Markdown"
    )
    # ============================================================
# PART 5 — Services Charts (Telegram + Instagram)
# ============================================================
@dp.callback_query(F.data == "main_services")
async def process_services_platforms(callback: types.CallbackQuery):
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="🔹 TELEGRAM",  callback_data="platform_telegram"),
          types.InlineKeyboardButton(text="📸 INSTAGRAM", callback_data="platform_instagram"))
    b.row(types.InlineKeyboardButton(text="📘 FACEBOOK",  callback_data="platform_facebook"),
          types.InlineKeyboardButton(text="▶️ YOUTUBE",   callback_data="platform_youtube"))
    b.row(types.InlineKeyboardButton(text="⬅️ Back",      callback_data="back_to_menu"))
    await callback.message.edit_text(
        "🛠️ Select Platform / प्लेटफॉर्म चुनें:\n\n"
        "Aap kiski services dekhna chahte hain?",
        reply_markup=b.as_markup()
    )


@dp.callback_query(F.data == "platform_telegram")
async def show_telegram_services_chart(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    pref = user["currency"]

    def r(usd):
        return f"₹{round(usd * USD_TO_INR_RATE, 2)}" if pref == "INR" else f"${usd}"

    text = (
        f"📊 Select your service ID [Currency: {pref}]\n\n"
        f"🔥 TELEGRAM REACTIONS\n"
        f"/5153 - telegram like (👍) [instant] - {r(0.12)} per 1000\n"
        f"/5160 - telegram like (👍🤩🔥♥️🥰🎉) [instant] - {r(0.15)} per 1000\n"
        f"/5161 - telegram like (👎😁🥲💩🤮🤔🤯😡) [instant] - {r(0.10)} per 1000\n"
        f"/5162 - telegram like (♥️) [instant] - {r(0.15)} per 1000\n"
        f"/5163 - telegram like (🔥) [instant] - {r(0.15)} per 1000\n"
        f"/5164 - telegram like (🎉) [instant] - {r(0.15)} per 1000\n"
        f"/5165 - telegram like (🤩) [instant] - {r(0.15)} per 1000\n\n"
        f"👀 TELEGRAM POST VIEWS\n"
        f"/1512 - telegram post views [Last 1 post] [SUPERFAST] - {r(0.11)} per 1000\n"
        f"/6855 - telegram post views [1 post] [CHEAPEST] - {r(0.09)} per 1000\n\n"
        f"👥 TELEGRAM MEMBERS\n"
        f"/7153 - Telegram Members [Refill 3 Days] - {r(0.52)} per 1000\n"
        f"/6787 - Telegram Members [Mixed, Cheap] - {r(0.38)} per 1000\n"
        f"/3274 - Telegram Channel Member [Mixed, Cheap] - {r(0.52)} per 1000\n\n"
        f"ℹ️ Order karne ke liye code *type* karein (e.g. /5153)"
    )
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_services"))
    await callback.message.edit_text(text, reply_markup=b.as_markup(), parse_mode="Markdown")


@dp.callback_query(F.data == "platform_instagram")
async def show_instagram_services_chart(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    pref = user["currency"]

    def r(usd):
        return f"₹{round(usd * USD_TO_INR_RATE, 2)}" if pref == "INR" else f"${usd}"

    text = (
        f"📸 INSTAGRAM SERVICES [Currency: {pref}]\n\n"
        f"👍 LIKES\n"
        f"/7802 - Likes [Speed 20k/Hr] - {r(0.21)}\n"
        f"/7526 - Likes [HQ Instant] - {r(0.26)}\n"
        f"/7374 - Likes [Indian Mixed] - {r(0.19)}\n\n"
        f"👥 FOLLOWERS & VIEWS\n"
        f"/3602 - Followers [30 Days Refill] - {r(3.12)}\n"
        f"/1658 - Followers [Max 200k] - {r(1.82)}\n"
        f"/1961 - Followers [Max 10k] - {r(2.48)}\n"
        f"/8810 - Followers [No Refill] - {r(1.77)}\n"
        f"/8782 - Followers [Real Look] - {r(1.97)}\n"
        f"/2968 - Views [Unlimited] - {r(0.40)}\n"
        f"/6634 - Views [Super Cheap] - {r(0.30)}\n"
        f"/7386 - Emergency Views - {r(0.10)}\n\n"
        f"ℹ️ Order karne ke liye code *type* karein (e.g. /7802)"
    )
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_services"))
    await callback.message.edit_text(text, reply_markup=b.as_markup(), parse_mode="Markdown")


@dp.callback_query(F.data == "platform_facebook")
async def coming_soon_fb(callback: types.CallbackQuery):
    await callback.answer("⏳ Facebook updates soon!", show_alert=True)


@dp.callback_query(F.data == "platform_youtube")
async def coming_soon_yt(callback: types.CallbackQuery):
    await callback.answer("⏳ YouTube updates soon!", show_alert=True)
    # ============================================================
# PART 6 — Order Flow + Entrypoint
# ============================================================
@dp.message(F.text.regexp(r"^/\d+$"))
async def process_service_id_command(message: types.Message):
    service_id = message.text[1:]
    if service_id not in SERVICES_MASTER_DATA:
        return

    user = get_or_create_user(message.from_user.id)
    user["pending_service"] = service_id

    service_info = SERVICES_MASTER_DATA[service_id]
    name = service_info.get("name", f"Service {service_id}")

    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="1,000",  callback_data=f"buy_{service_id}_1000"),
          types.InlineKeyboardButton(text="2,000",  callback_data=f"buy_{service_id}_2000"))
    b.row(types.InlineKeyboardButton(text="5,000",  callback_data=f"buy_{service_id}_5000"),
          types.InlineKeyboardButton(text="10,000", callback_data=f"buy_{service_id}_10000"))
    b.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_services"))

    await message.answer(
        f"🛒 *{name}*\n"
        f"🆔 Service ID: {service_id}\n\n"
        f"Kitni quantity chahiye? 👇",
        reply_markup=b.as_markup(),
        parse_mode="Markdown"
    )


@dp.callback_query(F.data.startswith("buy_"))
async def handle_buy_quantity(callback: types.CallbackQuery):
    parts = callback.data.split("_")
    if len(parts) != 3:
        await callback.answer("⚠️ Invalid selection.", show_alert=True)
        return

    _, service_id, qty_str = parts
    qty = int(qty_str)

    if service_id not in SERVICES_MASTER_DATA:
        await callback.answer("⚠️ Service unavailable.", show_alert=True)
        return

    user = get_or_create_user(callback.from_user.id)
    service_info = SERVICES_MASTER_DATA[service_id]
    price_per_1k = float(service_info["rate"])
    cost_usd = (qty / 1000.0) * price_per_1k
    cost_inr = cost_usd * USD_TO_INR_RATE

    user["pending_service"] = service_id
    user["pending_qty"] = qty
    user["pending_cost_usd"] = cost_usd

    stype = service_info["type"]
    if stype == "tg_post":
        hint = "📎 Send Telegram *post* link, e.g. https://t.me/mychannel/123"
    elif stype == "tg_channel":
        hint = "📎 Send Telegram *channel* link or @username"
    elif stype == "ig_post":
        hint = "📎 Send Instagram *post/reel* link"
    elif stype == "ig_profile":
        hint = "📎 Send Instagram *profile* link, e.g. https://instagram.com/username/"
    else:
        hint = "📎 Send target link."

    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="❌ Cancel", callback_data="main_services"))

    await callback.message.edit_text(
        f"🛒 *Order Summary*\n\n"
        f"📦 Service: {service_id}\n"
        f"📝 {service_info['name'][:60]}\n"
        f"🔢 Quantity: {qty:,}\n"
        f"💵 Cost: ₹{round(cost_inr, 2)} (~${round(cost_usd, 4)})\n"
        f"💰 Balance: {format_money(user['balance_usd'], user['currency'])}\n\n"
        f"{hint}",
        reply_markup=b.as_markup(),
        parse_mode="Markdown"
    )


@dp.message(F.text & ~F.text.regexp(r"^/"))
async def handle_order_link(message: types.Message):
    user = get_or_create_user(message.from_user.id)

    if not user.get("pending_service"):
        return

    service_id = user["pending_service"]
    service_info = SERVICES_MASTER_DATA[service_id]
    stype = service_info["type"]

    link = message.text.strip()

    if not validate_link(link, stype):
        await message.answer(
            f"⚠️ *Invalid link format.*\n\n"
            f"Expected type: {stype}\n"
            f"Please send correct link and try again."
        )
        return

    qty = user["pending_qty"]
    cost_usd = user["pending_cost_usd"]

    if user["balance_usd"] < cost_usd:
        await message.answer(
            f"❌ Insufficient balance!\n"
            f"Required: {format_money(cost_usd, user['currency'])}\n"
            f"Your balance: {format_money(user['balance_usd'], user['currency'])}"
        )
        user["pending_service"] = None
        user["pending_qty"] = None
        user["pending_cost_usd"] = None
        return

    try:
        resp = requests.post(
            SMM_API_URL,
            data={
                "key": SMM_API_KEY,
                "action": "add",
                "service": service_id,
                "link": link,
                "quantity": qty,
            },
            timeout=20,
        )
        data = resp.json()
    except Exception:
        logger.exception("SMM API error")
        await message.answer("⚠️ Network error. Please try again or contact support.")
        return

    if "order" not in data:
        await message.answer(f"❌ Order failed: {data.get('error', 'Unknown error')}")
        return

    order_id = data["order"]
    user["balance_usd"] -= cost_usd
    user["spent_usd"] += cost_usd
    user["orders_count"] += 1

    entry = {
        "order_id": order_id,
        "service": service_id,
        "link": link,
        "qty": qty,
        "cost_usd": cost_usd,
        "status": "Processing ⏳",
    }
    user["history"].append(entry)
    user["order_details"][order_id] = entry

    user["pending_service"] = None
    user["pending_qty"] = None
    user["pending_cost_usd"] = None

    await message.answer(
        f"✅ *Order Placed!*\n\n"
        f"🆔 Order ID: {order_id}\n"
        f"📦 Service: {service_id}\n"
        f"🔗 Link: {link}\n"
        f"🔢 Quantity: {qty:,}\n"
        f"💵 Charged: {format_money(cost_usd, user['currency'])}\n\n"
        f"Status: Processing ⏳",
        parse_mode="Markdown"
    )


# ============================================================
# ENTRYPOINT
# ============================================================
async def main():
    logger.info("🚀 Starting Happy Reaction Bot...")
    await dp.start_polling(bot)


if name == "main":
    asyncio.run(main())
