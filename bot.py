import os
import logging
import asyncio
import requests
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiohttp import web
from services import SERVICES_MASTER_DATA

BOT_TOKEN = os.getenv("BOT_TOKEN")
SMM_API_URL = os.getenv("SMM_API_URL", "https://smmlite.com/api/v2")
SMM_API_KEY = os.getenv("SMM_API_KEY")
SUPPORT_USERNAME = os.getenv("SUPPORT_USERNAME", "YourSupportUsername")
UPI_ID = os.getenv("UPI_ID", "your-vpa@ybl")
USDT_ADDRESS = os.getenv("USDT_ADDRESS", "TYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")

USD_TO_INR_RATE = 95.0
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(name)   # FIX 1

if not BOT_TOKEN:
    raise ValueError("ERROR: BOT_TOKEN is missing!")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
USER_DATABASE = {}


def get_or_create_user(uid):
    if uid not in USER_DATABASE:
        USER_DATABASE[uid] = {
            "balance_usd": 0.0, "spent_usd": 0.0, "orders_count": 0,
            "channels": [], "history": [], "order_details": {}, "currency": "INR"
        }
    return USER_DATABASE[uid]


def format_money(usd, pref):
    if pref == "INR":
        return f"₹{round(usd * USD_TO_INR_RATE, 2)}"
    return f"${round(usd, 2)}"


@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    get_or_create_user(message.from_user.id)
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="💰 Balance", callback_data="main_balance"),
          types.InlineKeyboardButton(text="➕ Add Funds", callback_data="main_add_funds"))
    b.row(types.InlineKeyboardButton(text="📢 My Channels", callback_data="main_channels"),
          types.InlineKeyboardButton(text="🛠️ Services", callback_data="main_services"))
    b.row(types.InlineKeyboardButton(text="📦 My Orders", callback_data="main_orders"),
          types.InlineKeyboardButton(text="👤 My Profile", callback_data="main_profile"))
    b.row(types.InlineKeyboardButton(text="🎁 Promotions", callback_data="main_promo"),
          types.InlineKeyboardButton(text="💬 Support", callback_data="main_support"))
    await message.answer(
        "WELCOME TO HAPPY REACTION 🎉\n\nYOUR ACCOUNT IS READY ✅\n\nChoose an option below:👇",
        reply_markup=b.as_markup()
    )


@dp.callback_query(F.data == "main_balance")
async def process_balance(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))  # FIX 2
    await callback.message.edit_text(
        f"💰 Balance: {format_money(user['balance_usd'], user['currency'])}",
        reply_markup=b.as_markup()
    )


@dp.callback_query(F.data == "main_add_funds")
async def process_add_funds(callback: types.CallbackQuery):
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="₹100", callback_data="amt_100"),
          types.InlineKeyboardButton(text="₹200", callback_data="amt_200"))
    b.row(types.InlineKeyboardButton(text="₹500", callback_data="amt_500"),
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
    parts = callback.data.split("_")
    amount_inr = int(parts[-1])
    amount_usd = amount_inr / USD_TO_INR_RATE
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(
        text="✅ मैंने पेमेंट कर दी है",
        callback_data=f"paid_{amount_inr}"     # FIX 3: pass INR (int), not float USD
    ))
    b.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_add_funds"))
    await callback.message.edit_text(
        f"📲 Pay: ₹{amount_inr} (~${round(amount_usd, 2)} USD)\n"
        f"📌 UPI ID: {UPI_ID}\n"
        f"📌 USDT Address: {USDT_ADDRESS}\n\n"
        "Pay karke screenshot support par bhejein.",
        reply_markup=b.as_markup()
    )


@dp.callback_query(F.data.startswith("paid_"))
async def handle_paid(callback: types.CallbackQuery):
    amount_inr = int(callback.data.split("_")[-1])
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(
        text="💬 Contact Support",
        url=f"https://t.me/{SUPPORT_USERNAME}"
    ))
    b.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    await callback.message.edit_text(
        f"✅ Payment noted for ₹{amount_inr}.\n\n"
        f"Please send your payment screenshot to @{SUPPORT_USERNAME} "
        f"for verification. Your balance will be credited shortly after confirmation.",
        reply_markup=b.as_markup()
    )


@dp.callback_query(F.data == "back_to_menu")
async def back_to_menu(callback: types.CallbackQuery):
    # Reuse start menu layout
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="💰 Balance", callback_data="main_balance"),
          types.InlineKeyboardButton(text="➕ Add Funds", callback_data="main_add_funds"))
    b.row(types.InlineKeyboardButton(text="📢 My Channels", callback_data="main_channels"),
          types.InlineKeyboardButton(text="🛠️ Services", callback_data="main_services"))
    b.row(types.InlineKeyboardButton(text="📦 My Orders", callback_data="main_orders"),
          types.InlineKeyboardButton(text="👤 My Profile", callback_data="main_profile"))
    b.row(types.InlineKeyboardButton(text="🎁 Promotions", callback_data="main_promo"),
          types.InlineKeyboardButton(text="💬 Support", callback_data="main_support"))
    await callback.message.edit_text("🏠 Main Menu\n\nChoose an option below:👇", reply_markup=b.as_markup())


async def main():
    await dp.start_polling(bot)


if name == "main":
    asyncio.run(main())
    @dp.callback_query(F.data == "platform_instagram")
async def show_instagram_services_chart(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    pref = user["currency"]

    def r(usd):
        return f"₹{round(usd * USD_TO_INR_RATE, 2)}" if pref == "INR" else f"${usd}"

    text = f"📊 Select your service ID [Current Currency: {pref}]\n\n"
    text += "📸 INSTAGRAM SERVICES\n\n"

    text += "❤️ INSTAGRAM LIKES\n"
    text += f"/1024 - Instagram Likes [Real, Instant] - {r(0.08)} per 1000\n"
    text += f"/1025 - Instagram Likes [HQ, Non-Drop] - {r(0.12)} per 1000\n"
    text += f"/1026 - Instagram Likes [Cheap, Mixed] - {r(0.05)} per 1000\n\n"

    text += "👀 INSTAGRAM VIEWS\n"
    text += f"/2010 - Instagram Reels Views [Instant] - {r(0.02)} per 1000\n"
    text += f"/2011 - Instagram Video Views [Cheap] - {r(0.01)} per 1000\n"
    text += f"/2012 - Instagram Story Views [Fast] - {r(0.03)} per 1000\n\n"

    text += "👥 INSTAGRAM FOLLOWERS\n"
    text += f"/3001 - Instagram Followers [Real, Refill 30d] - {r(0.85)} per 1000\n"
    text += f"/3002 - Instagram Followers [HQ, Non-Drop] - {r(0.65)} per 1000\n"
    text += f"/3003 - Instagram Followers [Cheap, Mixed] - {r(0.40)} per 1000\n\n"

    text += "💬 INSTAGRAM COMMENTS\n"
    text += f"/4001 - Instagram Custom Comments [HQ] - {r(0.90)} per 1000\n"
    text += f"/4002 - Instagram Random Comments - {r(0.55)} per 1000\n\n"

    text += "ℹ️ *Tip:* Order ke liye blue link (e.g. /1024) par tap karein."

    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_services"))
    await callback.message.edit_text(text, reply_markup=b.as_markup(), parse_mode="Markdown")
    # ---------- INSTAGRAM CHART ----------
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


# ---------- UNREACHABLE UNLESS YOU ADD BUTTONS ----------
# These are fine but currently dead — see main_services handler.
@dp.callback_query(F.data == "platform_facebook")
async def coming_soon_fb(callback: types.CallbackQuery):
    await callback.answer("⏳ Facebook updates soon!", show_alert=True)


@dp.callback_query(F.data == "platform_youtube")
async def coming_soon_yt(callback: types.CallbackQuery):
    await callback.answer("⏳ YouTube updates soon!", show_alert=True)


# ---------- SERVICE COMMAND HANDLER (FIXED) ----------
@dp.message(F.text.regexp(r"^/\d+$"))   # only /<digits>
async def process_service_id_command(message: types.Message):
    service_id = message.text[1:]       # strip leading "/"

    if service_id not in SERVICES_MASTER_DATA:
        # Unknown ID — silently ignore OR tell user
        return

    user = get_or_create_user(message.from_user.id)
    user["pending_service"] = service_id

    service_info = SERVICES_MASTER_DATA[service_id]
    name = service_info.get("name", f"Service {service_id}")

    b = InlineKeyboardBuilder()
    b.row(
        types.InlineKeyboardButton(text="1,000",  callback_data=f"buy_{service_id}_1000"),
        types.InlineKeyboardButton(text="2,000",  callback_data=f"buy_{service_id}_2000"),
    )
    b.row(
        types.InlineKeyboardButton(text="5,000",  callback_data=f"buy_{service_id}_5000"),
        types.InlineKeyboardButton(text="10,000", callback_data=f"buy_{service_id}_10000"),
    )
    b.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_services"))

    await message.answer(
        f"🛒 *{name}*\n"
        f"🆔 Service ID: {service_id}\n\n"
        f"Kitni quantity chahiye? 👇",
        reply_markup=b.as_markup(),
        parse_mode="Markdown"
    )


# ---------- BUY BUTTON HANDLER (NEW — was missing) ----------
@dp.callback_query(F.data.startswith("buy_"))
async def handle_buy_quantity(callback: types.CallbackQuery):
    parts = callback.data.split("_")   # ["buy", service_id, qty]
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
    price_per_1k = float(service_info.get("price_per_1k", 0))
    cost_usd = (qty / 1000.0) * price_per_1k
    cost_inr = cost_usd * USD_TO_INR_RATE

    # Save pending order state for link-input step
    user["pending_service"] = service_id
    user["pending_qty"] = qty
    user["pending_cost_usd"] = cost_usd

    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="❌ Cancel", callback_data="main_services"))

    await callback.message.edit_text(
        f"🛒 *Order Summary*\n\n"
        f"📦 Service: {service_id}\n"
        f"🔢 Quantity: {qty:,}\n"
        f"💵 Cost: ₹{round(cost_inr, 2)} (~${round(cost_usd, 2)})\n"
        f"💰 Your Balance: {format_money(user['balance_usd'], user['currency'])}\n\n"
        f"Ab apna *link / username* bhejein:",
        reply_markup=b.as_markup(),
        parse_mode="Markdown"
    )


# ---------- LINK INPUT HANDLER (NEW) ----------
@dp.message(F.text & ~F.text.regexp(r"^/"))
async def handle_order_link(message: types.Message):
    user = get_or_create_user(message.from_user.id)

    # Only act if user is mid-order
    if not user.get("pending_service"):
        return

    link = message.text.strip()

    # Basic validation — Telegram / Instagram URL or @username
    if not (
        link.startswith("https://t.me/")
        or link.startswith("https://instagram.com/")
        or link.startswith("https://www.instagram.com/")
        or link.startswith("@")
    ):
        await message.answer("⚠️ Invalid link. Please send a valid Telegram or Instagram link.")
        return

    service_id = user["pending_service"]
    qty = user["pending_qty"]
    cost_usd = user["pending_cost_usd"]

    if user["balance_usd"] < cost_usd:
        await message.answer(
            f"❌ Insufficient balance!\n"
            f"Required: {format_money(cost_usd, user['currency'])}\n"
            f"Your balance: {format_money(user['balance_usd'], user['currency'])}\n\n"
            f"Please add funds first."
        )
        # Clear pending state
        user["pending_service"] = None
        user["pending_qty"] = None
        user["pending_cost_usd"] = None
        return

    # ---- Place order via SMM API ----
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
    except Exception as e:
        logger.exception("SMM API error")
        await message.answer("⚠️ Order place karte waqt error aaya. Support se contact karein.")
        return

    if "order" not in data:
        await message.answer(f"❌ Order failed: {data.get('error', 'Unknown error')}")
        return

    order_id = data["order"]
    user["balance_usd"] -= cost_usd
    user["spent_usd"] += cost_usd
    user["orders_count"] += 1
    user["history"].append({
        "order_id": order_id,
        "service": service_id,
        "link": link,
        "qty": qty,
        "cost_usd": cost_usd,
        "status": "Processing ⏳",
    })
    user["order_details"][order_id] = user["history"][-1]

    # Clear pending
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
    price_per_1k = float(service_info["rate"])          # ✅ "rate" not "price_per_1k"
    cost_usd = (qty / 1000.0) * price_per_1k
    cost_inr = cost_usd * USD_TO_INR_RATE

    user["pending_service"] = service_id
    user["pending_qty"] = qty
    user["pending_cost_usd"] = cost_usd

    # Tell the user what link format is expected
    stype = service_info["type"]
    if stype == "tg_post":
        hint = "📎 Send the Telegram *post* link, e.g. https://t.me/mychannel/123"
    elif stype == "tg_channel":
        hint = "📎 Send the Telegram *channel* link, e.g. https://t.me/mychannel or @mychannel"
    elif stype == "ig_post":
        hint = "📎 Send the Instagram *post/reel* link, e.g. https://www.instagram.com/p/xxxxx/"
    elif stype == "ig_profile":
        hint = "📎 Send the Instagram *profile* link, e.g. https://www.instagram.com/username/"
    else:
        hint = "📎 Send the target link."

    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="❌ Cancel", callback_data="main_services"))

    await callback.message.edit_text(
        f"🛒 *Order Summary*\n\n"
        f"📦 Service: {service_id}\n"
        f"📝 {service_info['name'][:60]}{'…' if len(service_info['name']) > 60 else ''}\n"
        f"🔢 Quantity: {qty:,}\n"
        f"💵 Cost: ₹{round(cost_inr, 2)} (~${round(cost_usd, 4)})\n"
        f"💰 Your Balance: {format_money(user['balance_usd'], user['currency'])}\n\n"
        f"{hint}",
        reply_markup=b.as_markup(),
        parse_mode="Markdown"
    )
    import re

TG_POST_RE     = re.compile(r"^https?://t\.me/([A-Za-z0-9_]+)/(\d+)/?$")
TG_CHANNEL_RE  = re.compile(r"^(?:https?://t\.me/|@)([A-Za-z0-9_]{5,})/?$")
IG_POST_RE     = re.compile(r"^https?://(?:www\.)?instagram\.com/(?:p|reel|reels|tv)/[A-Za-z0-9_\-]+/?")
IG_PROFILE_RE  = re.compile(r"^https?://(?:www\.)?instagram\.com/([A-Za-z0-9_.]{1,30})/?$")

def validate_link(link: str, stype: str) -> bool:
    link = link.strip()
    if stype == "tg_post":
        return bool(TG_POST_RE.match(link))
    if stype == "tg_channel":
        return bool(TG_CHANNEL_RE.match(link))
    if stype == "ig_post":
        return bool(IG_POST_RE.match(link))
    if stype == "ig_profile":
        # Must not be a post/reel URL
        if re.match(r"^https?://(?:www\.)?instagram\.com/(?:p|reel|reels|tv)/", link):
            return False
        return bool(IG_PROFILE_RE.match(link))
    return False


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
            "⚠️ *Invalid link format.*\n\n"
            f"Expected type: {stype}\n"
            "Please send the correct link and try again.\n\n"
            "(/main_services se dobara start kar sakte hain)"
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

    # ---- Call SMM API ----
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
        err = data.get("error", "Unknown error")
        await message.answer(f"❌ Order failed: {err}")
        # keep pending state? clear it to avoid loops
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
        f"Status: Processing ⏳\n"
        f"Track: /orders",
        parse_mode="Markdown"
    )
