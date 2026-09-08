import os
import logging
import asyncio
import requests
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiohttp import web

# ==========================================
# 🛠️ 1. CONFIGURATION & VARIABLES (RAILWAY DASHBOARD)
# ==========================================
BOT_TOKEN = os.getenv("BOT_TOKEN",  "8835337863:AAGpIPr3SpG-jDR8dzjSvd0fJkhLEtjCe8k")
SMM_API_URL = os.getenv("SMM_API_URL", "https://smmlite.com/api/v2")
SMM_API_KEY = os.getenv("SMM_API_KEY")
SUPPORT_USERNAME = os.getenv("SUPPORT_USERNAME", "YourSupportUsername")
UPI_ID = os.getenv("UPI_ID", "your-vpa@ybl")
USDT_ADDRESS = os.getenv("USDT_ADDRESS", "TYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")

USD_TO_INR_RATE = 95.0 

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

if not BOT_TOKEN:
    raise ValueError("ERROR: BOT_TOKEN is missing! Railway dashboard me set karein.")

# ⭐ AIOGRAM v3 STRICT INITIALIZATION
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# Simple In-Memory Database
USER_DATABASE = {}

SERVICES_MASTER_DATA = {
    "5153": {"name": "telegram like (👍) reaction + views", "rate": 0.12},
    "5160": {"name": "telegram like (👍🤩🔥♥️🥰🎉) reaction + views", "rate": 0.15},
    "5161": {"name": "telegram like (👎😁🥲💩🤮🤔🤯😡) reaction + views", "rate": 0.10},
    "5162": {"name": "telegram like (♥️) reaction + views", "rate": 0.15},
    "5163": {"name": "telegram like (🔥) reaction + views", "rate": 0.15},
    "5164": {"name": "telegram like (🎉) reaction + views", "rate": 0.15},
    "5165": {"name": "telegram like (🤩) reaction + views", "rate": 0.15},
    "1512": {"name": "telegram post views [Last 1 post]", "rate": 0.11},
    "6855": {"name": "telegram post views [1 post]", "rate": 0.09},
    "7153": {"name": "Telegram Members - [ Refill:- 3 Days ]", "rate": 0.52},
    "6787": {"name": "Telegram Members - [ Mixed, Cheap ]", "rate": 0.38},
    "3274": {"name": "Telegram Channel Member - [ Mixed, Cheap ]", "rate": 0.52},
    "7802": {"name": "Instagram Likes [ Real Mixed User ]", "rate": 0.21},
    "7526": {"name": "Instagram Likes [ Speed: 20k/Hr ]", "rate": 0.26},
    "7374": {"name": "Instagram Likes [ Indian Mixed ]", "rate": 0.19},
    "3602": {"name": "Instagram Followers [ Real Users ]", "rate": 3.12},
    "1658": {"name": "Instagram Followers [ 30 Days Refill ]", "rate": 1.82},
    "1961": {"name": "NEW - Instagram Followers [ Max 10k ]", "rate": 2.48},
    "8810": {"name": "NEW - Instagram Followers [ No Refill ]", "rate": 1.77},
    "8782": {"name": "Instagram Followers [ Real Looking ]", "rate": 1.97},
    "2968": {"name": "Instagram Views [ Unlimited ]", "rate": 0.40},
    "6634": {"name": "Instagram Views [ Super Cheap ]", "rate": 0.30},
    "7386": {"name": "Emergency Instagram Views", "rate": 0.10}
}

def get_or_create_user(user_id):
    if user_id not in USER_DATABASE:
        USER_DATABASE[user_id] = {
            "balance_usd": 0.0, "spent_usd": 0.0, "orders_count": 0, "channels": [], "history": [], "order_details": {}, "currency": "INR"
        }
    return USER_DATABASE[user_id]

def format_money(amount_usd, currency_pref):
    if currency_pref == "INR": return f"₹{round(amount_usd * USD_TO_INR_RATE, 2)}"
    return f"${round(amount_usd, 2)}"

# ==========================================
# 🏠 2. START COMMAND (MAIN MENU)
# ==========================================
@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    get_or_create_user(message.from_user.id)
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="💰 Balance", callback_data="main_balance"), types.InlineKeyboardButton(text="➕ Add Funds", callback_data="main_add_funds"))
    builder.row(types.InlineKeyboardButton(text="📢 My Channels", callback_data="main_channels"), types.InlineKeyboardButton(text="🛠️ Services", callback_data="main_services"))
    builder.row(types.InlineKeyboardButton(text="📦 My Orders", callback_data="main_orders"), types.InlineKeyboardButton(text="👤 My Profile", callback_data="main_profile"))
    builder.row(types.InlineKeyboardButton(text="🎁 Promotions", callback_data="main_promo"), types.InlineKeyboardButton(text="💬 Support", callback_data="main_support"))
    
    welcome_text = "WELCOME TO HAPPY REACTION 🎉 \n\nYOUR ACCOUNT IS READY ✅\n\nChoose an option below:👇"
    await message.answer(welcome_text, reply_markup=builder.as_markup())

# ==========================================
# 💰 3. BALANCE BUTTON
# ==========================================
@dp.callback_query(F.data == "main_balance")
async def process_balance(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    formatted_bal = format_money(user['balance_usd'], user['currency'])
    builder = InlineKeyboardBuilder()
    builder.add(types.InlineKeyboardButton(text="⬅️ Back to Menu", callback_data="back_to_menu"))
    await callback.message.edit_text(f"💰 **Your Current Balance:** {formatted_bal}\n\nपैसे जोड़ने के लिए 'Add Funds' का उपयोग करें।", reply_markup=builder.as_markup(), parse_mode="Markdown")

# ==========================================
# 💳 4. ADD FUNDS SYSTEM
# ==========================================
@dp.callback_query(F.data == "main_add_funds")
async def process_add_funds(callback: types.CallbackQuery):
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="₹100", callback_data="amt_100"), types.InlineKeyboardButton(text="₹200", callback_data="amt_200"))
    builder.row(types.InlineKeyboardButton(text="₹500", callback_data="amt_500"), types.InlineKeyboardButton(text="₹1000", callback_data="amt_1000"))
    builder.row(types.InlineKeyboardButton(text="₹2000", callback_data="amt_2000"), types.InlineKeyboardButton(text="₹5000", callback_data="amt_5000"))
    builder.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    await callback.message.edit_text("💳 **Add Funds / डिपॉजिट फंड:**\n\nकोई एक अमाउंट चुनें:", reply_markup=builder.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data.startswith("amt_"))
async def handle_amount_selection(callback: types.CallbackQuery):
    parts = callback.data.split("_")
    amount_inr = int(parts[-1])
    amount_usd = amount_inr / USD_TO_INR_RATE
    
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="✅ मैंने पेमेंट कर दी है", callback_data=f"paid_{amount_usd}"))
    builder.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_add_funds"))
    
    text = f"📲 **Payment Details**\n\n💰 **Amount:** ₹{amount_inr} (~${round(amount_usd, 2)} USD)\n📌 **UPI ID:** `{UPI_ID}`\n📌 **USDT Wallet:** `{USDT_ADDRESS}`\n\nPay karke screenshot support par bhejein."
    await callback.message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data.startswith("paid_"))
async def process_paid_click(callback: types.CallbackQuery):
    parts = callback.data.split("_")
    amount_usd = float(parts[-1])
    user = get_or_create_user(callback.from_user.id)
    user["history"].append({"amount_usd": amount_usd, "status": "Pending ⏳"})
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="💬 Contact Support", url=f"https://t.me{SUPPORT_USERNAME}"))
    builder.row(types.InlineKeyboardButton(text="⬅️ Main Menu", callback_data="back_to_menu"))
    await callback.message.edit_text(f"✅ **Request Sent!**\n\nTeam verify karke balance add karegi. Screenshot support par bhejein.", reply_markup=builder.as_markup(), parse_mode="Markdown")

# ==========================================
# 📢 5. MY CHANNELS SYSTEM
# ==========================================
@dp.callback_query(F.data == "main_channels")
async def process_channels(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    bot_info = await bot.get_me()
    promote_url = f"https://t.me{bot_info.username}?startchannel=true&admin=post_messages+edit_messages+delete_messages+invite_users"
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="➕ Promote Bot as Admin", url=promote_url))
    builder.row(types.InlineKeyboardButton(text="⬅️ Back to Menu", callback_data="back_to_menu"))
    text = "📢 **My Channels:**\n\n"
    if not user["channels"]: text += "❌ Koi channel linked nahi hai.\n\n"
    else:
        for idx, ch in enumerate(user["channels"], start=1): text += f"🔹 {idx}. `{ch}` (Active ✅)\n"
    await callback.message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="Markdown")

# ==========================================
# 🛠️ 6. SERVICES PLATFORMS MENU & CHARTS
# ==========================================
@dp.callback_query(F.data == "main_services")
async def process_services_platforms(callback: types.CallbackQuery):
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="🔹 TELEGRAM", callback_data="platform_telegram"), types.InlineKeyboardButton(text="📸 INSTAGRAM", callback_data="platform_instagram"))
    builder.row(types.InlineKeyboardButton(text="⬅️ Back to Menu", callback_data="back_to_menu"))
    await callback.message.edit_text("🛠️ **Select Platform / प्लेटफॉर्म चुनें:**\n\nAap kiski services dekhna chahte hain?", reply_markup=builder.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data == "platform_telegram")
async def show_telegram_services_chart(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    pref = user["currency"]
    def r(usd): return f"₹{round(usd * USD_TO_INR_RATE, 2)}" if pref == "INR" else f"${usd}"

    chart_text = "📊 **Select your service | Select your service ID [Current Currency: " + str(pref) + "]**\n\n"
    chart_text += "🔥 **TELEGRAM REACTIONS SERVICE**\n"
    chart_text += f"/5153 - telegram like (👍) - {r(0.12)} per 1000\n"
