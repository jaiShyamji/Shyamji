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
SMM_API_URL = os.getenv("SMM_API_URL", "https://your-smm-panel.com")
SMM_API_KEY = os.getenv("SMM_API_KEY")
SUPPORT_USERNAME = os.getenv("SUPPORT_USERNAME", "YourSupportUsername")
UPI_ID = os.getenv("UPI_ID", "your-vpa@ybl")
USDT_ADDRESS = os.getenv("USDT_ADDRESS", "TYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")

USD_TO_INR_RATE = 95.0 
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if not BOT_TOKEN:
    raise ValueError("ERROR: BOT_TOKEN is missing!")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
USER_DATABASE = {}

def get_or_create_user(uid):
    if uid not in USER_DATABASE:
        USER_DATABASE[uid] = {"balance_usd": 0.0, "spent_usd": 0.0, "orders_count": 0, "channels": [], "history": [], "order_details": {}, "currency": "INR"}
    return USER_DATABASE[uid]

def format_money(usd, pref):
    if pref == "INR": return f"₹{round(usd * USD_TO_INR_RATE, 2)}"
    return f"${round(usd, 2)}"

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    get_or_create_user(message.from_user.id)
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="💰 Balance", callback_data="main_balance"), types.InlineKeyboardButton(text="➕ Add Funds", callback_data="main_add_funds"))
    b.row(types.InlineKeyboardButton(text="📢 My Channels", callback_data="main_channels"), types.InlineKeyboardButton(text="🛠️ Services", callback_data="main_services"))
    b.row(types.InlineKeyboardButton(text="📦 My Orders", callback_data="main_orders"), types.InlineKeyboardButton(text="👤 My Profile", callback_data="main_profile"))
    b.row(types.InlineKeyboardButton(text="🎁 Promotions", callback_data="main_promo"), types.InlineKeyboardButton(text="💬 Support", callback_data="main_support"))
    await message.answer("WELCOME TO HAPPY REACTION 🎉\n\nYOUR ACCOUNT IS READY ✅\n\nChoose an option below:👇", reply_markup=b.as_markup())

@dp.callback_query(F.data == "main_balance")
async def process_balance(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    b = InlineKeyboardBuilder().add(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    await callback.message.edit_text(f"💰 Balance: {format_money(user['balance_usd'], user['currency'])}", reply_markup=b.as_markup())

@dp.callback_query(F.data == "main_add_funds")
async def process_add_funds(callback: types.CallbackQuery):
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="₹100", callback_data="amt_100"), types.InlineKeyboardButton(text="₹200", callback_data="amt_200"))
    b.row(types.InlineKeyboardButton(text="₹500", callback_data="amt_500"), types.InlineKeyboardButton(text="₹1000", callback_data="amt_1000"))
    b.row(types.InlineKeyboardButton(text="₹2000", callback_data="amt_2000"), types.InlineKeyboardButton(text="₹5000", callback_data="amt_5000"))
    b.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    await callback.message.edit_text("💳 **Add Funds / डिपॉजिट Fund:**\n\nकोई एक अमाउंट चुनें:", reply_markup=b.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data.startswith("amt_"))
async def handle_amount_selection(callback: types.CallbackQuery):
    parts = callback.data.split("_")
    amount_inr = int(parts[-1])
    amount_usd = amount_inr / USD_TO_INR_RATE
    b = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="✅ मैंने पेमेंट कर दी है", callback_data=f"paid_{amount_usd}")).row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_add_funds"))
    await callback.message.edit_text(f"📲 Pay: ₹{amount_inr} (~${round(amount_usd, 2)} USD)\n📌 UPI ID: `{UPI_ID}`\n📌 USDT Address: `{USDT_ADDRESS}`\n\nPay karke screenshot support par bhejein.", reply_markup=b.as_markup())

@dp.callback_query(F.data.startswith("paid_"))
async def process_paid_click(callback: types.CallbackQuery):
    parts = callback.data.split("_")
    amount_usd = float(parts[-1])
    user = get_or_create_user(callback.from_user.id)
    user["history"].append({"amount_usd": amount_usd, "status": "Pending ⏳"})
    b = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="⬅️ Menu", callback_data="back_to_menu"))
    await callback.message.edit_text("✅ **Request Sent!**\n\nTeam verify karke balance add karegi. Screenshot support par bhejein.", reply_markup=b.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data == "main_channels")
async def process_channels(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    bot_info = await bot.get_me()
    promote_url = f"https://t.me{bot_info.username}?startchannel=true&admin=post_messages+edit_messages+delete_messages+invite_users"
    b = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="➕ Promote Bot as Admin", url=promote_url)).row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    text = "📢 **My Channels:**\n\n"
    if not user["channels"]: text += "❌ Koi channel linked nahi hai.\n"
    else:
        for idx, ch in enumerate(user["channels"], start=1): text += f"🔹 {idx}. `{ch}` (Active ✅)\n"
    await callback.message.edit_text(text, reply_markup=b.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data == "main_services")
async def process_services_platforms(callback: types.CallbackQuery):
    b = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="🔹 TELEGRAM", callback_data="platform_telegram"), types.InlineKeyboardButton(text="📸 INSTAGRAM", callback_data="platform_instagram")).row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    await callback.message.edit_text("🛠️ **Select Platform / प्लेटफॉर्म चुनें:**\n\nAap kiski services dekhna chahte hain?", reply_markup=b.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data == "platform_telegram")
async def show_telegram_services_chart(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    pref = user["currency"]
    def r(usd): return f"₹{round(usd * USD_TO_INR_RATE, 2)}" if pref == "INR" else f"${usd}"
    text = f"📊 **Select your service ID [Current Currency: {pref}]**\n\n"
    text += f"🔥 **TELEGRAM REACTIONS**\n"
    text += f"/5153 - telegram like (👍) [ instant] - {r(0.12)} per 1000\n"
    text += f"/5160 - telegram like (👍🤩🔥♥️🥰🎉) [ instant] - {r(0.15)} per 1000\n"
    text += f"/5161 - telegram like (👎😁🥲💩🤮🤔🤯😡) [ instant] - {r(0.10)} per 1000\n"
    text += f"/5162 - telegram like (♥️) [ instant] - {r(0.15)} per 1000\n"
    text += f"/5163 - telegram like (🔥) [ instant] - {r(0.15)} per 1000\n"
    text += f"/5164 - telegram like (🎉) [ instant] - {r(0.15)} per 1000\n"
    text += f"/5165 - telegram like (🤩) [ instant] - {r(0.15)} per 1000\n\n"
    text += f"👀 **TELEGRAM POST VIEWS**\n"
    text += f"/1512 - telegram post views [Last 1 post] [SUPERFAST] - {r(0.11)} per 1000\n"
    text += f"/6855 - telegram post views [1 post] [CHEAPEST] - {r(0.09)} per 1000\n\n"
    text += f"👥 **TELEGRAM MEMBER**\n"
    text += f"/7153 - Telegram Members - [ Refill:- 3 Days ] - {r(0.52)} PER 1000\n"
    text += f"/6787 - Telegram Members - [ Mixed, Cheap ] - {r(0.38)} PER 1000\n"
    text += f"/3274 - Telegram Channel Member - [ Mixed, Cheap ] - {r(0.52)} PER 1000\n\n"
    text += "ℹ️ *Tip:* Order ke liye blue link (e.g. /5160) par tap karein."
    b = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_services"))
    await callback.message.edit_text(text, reply_markup=b.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data == "platform_instagram")
async def show_instagram_services_chart(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    pref = user["currency"]
    def r(usd): return f"₹{round(usd * USD_TO_INR_RATE, 2)}" if pref == "INR" else f"${usd}"
    text = f"📸 **INSTAGRAM SERVICES [Currency: {pref}]**\n\n👍 **LIKES**\n/7802 - Likes [Speed 20k/Hr] - {r(0.21)}\n/7526 - Likes [HQ Instant] - {r(0.26)}\n/7374 - Likes [Indian Mixed] - {r(0.19)}\n\n👥 **FOLLOWERS & VIEWS**\n/3602 - Followers [30 Days Refill] - {r(3.12)}\n/1658 - Followers [Max 200k] - {r(1.82)}\n/1961 - Followers [Max 10k] - {r(2.48)}\n/8810 - Followers [No Refill] - {r(1.77)}\n/8782 - Followers [Real Look] - {r(1.97)}\n/2968 - Views [Unlimited] - {r(0.40)}\n/6634 - Views [Super Cheap] - {r(0.30)}\n/7386 - Emergency Views - {r(0.10)}\n\nℹ️ Tap code to order."
    b = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_services"))
    await callback.message.edit_text(text, reply_markup=b.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data == "platform_facebook")
async def coming_soon_fb(callback: types.CallbackQuery):
    await callback.answer("⏳ Facebook updates soon!", show_alert=True)

@dp.callback_query(F.data == "platform_youtube")
async def coming_soon_yt(callback: types.CallbackQuery):
    await callback.answer("⏳ YouTube updates soon!", show_alert=True)

@dp.message(F.text.startswith("/"))
async def process_service_id_command(message: types.Message):
    service_id = message.text.replace("/", "").strip()
    if service_id not in SERVICES_MASTER_DATA: return
    service_info = SERVICES_MASTER_DATA[service_id]
    b = InlineKeyboardBuilder()
    b.row(types.InlineKeyboardButton(text="1000", callback_data=f"buy_{service_id}_1000"), types.InlineKeyboardButton(text="2000", callback_data=f"buy_{service_id}_2000"))
    b.row(types.InlineKeyboardButton(text="5000", callback_data=f"buy_{service_id}_5000"), types.InlineKeyboardButton(text="10000", callback_data=f"buy_{service_id}_10000"))
