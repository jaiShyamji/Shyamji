import os
import logging
import asyncio
import requests
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiohttp import web

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

SERVICES_MASTER_DATA = {
    "5153": {"name": "Telegram Like 👍", "rate": 0.12},
    "5160": {"name": "Telegram Fast Like 🎉", "rate": 0.15},
    "5161": {"name": "Telegram Mix Like 🤩", "rate": 0.10},
    "7802": {"name": "Instagram Likes 🔥", "rate": 0.21},
    "3602": {"name": "Instagram Followers 👥", "rate": 3.12}
}

def get_or_create_user(user_id):
    if user_id not in USER_DATABASE:
        USER_DATABASE[user_id] = {"balance_usd": 0.0, "spent_usd": 0.0, "orders_count": 0, "channels": [], "history": [], "order_details": {}, "currency": "INR"}
    return USER_DATABASE[user_id]

def format_money(amount_usd, currency_pref):
    if currency_pref == "INR": return f"₹{round(amount_usd * USD_TO_INR_RATE, 2)}"
    return f"${round(amount_usd, 2)}"

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    get_or_create_user(message.from_user.id)
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="💰 Balance", callback_data="main_balance"), types.InlineKeyboardButton(text="➕ Add Funds", callback_data="main_add_funds"))
    builder.row(types.InlineKeyboardButton(text="📢 My Channels", callback_data="main_channels"), types.InlineKeyboardButton(text="🛠️ Services", callback_data="main_services"))
    builder.row(types.InlineKeyboardButton(text="📦 My Orders", callback_data="main_orders"), types.InlineKeyboardButton(text="👤 My Profile", callback_data="main_profile"))
    builder.row(types.InlineKeyboardButton(text="🎁 Promotions", callback_data="main_promo"), types.InlineKeyboardButton(text="💬 Support", callback_data="main_support"))
    await message.answer("WELCOME TO HAPPY REACTION 🎉\n\nYOUR ACCOUNT IS READY ✅\n\nChoose an option below:👇", reply_markup=builder.as_markup())

@dp.callback_query(F.data == "main_balance")
async def process_balance(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    builder = InlineKeyboardBuilder().add(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    await callback.message.edit_text(f"💰 Balance: {format_money(user['balance_usd'], user['currency'])}", reply_markup=builder.as_markup())

@dp.callback_query(F.data == "main_add_funds")
async def process_add_funds(callback: types.CallbackQuery):
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="₹100", callback_data="amt_100"), types.InlineKeyboardButton(text="₹500", callback_data="amt_500"))
    builder.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    await callback.message.edit_text("💳 Choose deposit amount:", reply_markup=builder.as_markup())

@dp.callback_query(F.data.startswith("amt_"))
async def handle_amount_selection(callback: types.CallbackQuery):
    parts = callback.data.split("_")
    amount_inr = int(parts[-1])
    amount_usd = amount_inr / USD_TO_INR_RATE
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="✅ Done", callback_data=f"paid_{amount_usd}")).row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_add_funds"))
    await callback.message.edit_text(f"📲 Pay: ₹{amount_inr}\n📌 UPI: `{UPI_ID}`\n📌 USDT: `{USDT_ADDRESS}`", reply_markup=builder.as_markup())

@dp.callback_query(F.data.startswith("paid_"))
async def process_paid_click(callback: types.CallbackQuery):
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="⬅️ Menu", callback_data="back_to_menu"))
    await callback.message.edit_text("✅ Request Sent! Admin will verify soon.", reply_markup=builder.as_markup())

@dp.callback_query(F.data == "main_channels")
async def process_channels(callback: types.CallbackQuery):
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    await callback.message.edit_text("📢 Linked Channels list active.", reply_markup=builder.as_markup())

@dp.callback_query(F.data == "main_services")
async def process_services_platforms(callback: types.CallbackQuery):
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="🔹 TELEGRAM", callback_data="platform_telegram"), types.InlineKeyboardButton(text="📸 INSTAGRAM", callback_data="platform_instagram")).row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    await callback.message.edit_text("🛠️ Select Platform:", reply_markup=builder.as_markup())

@dp.callback_query(F.data == "platform_telegram")
async def show_telegram_services_chart(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    pref = user["currency"]
    def r(usd): return f"₹{round(usd * USD_TO_INR_RATE, 2)}" if pref == "INR" else f"${usd}"
    text = f"📊 **TELEGRAM SERVICES [Currency: {pref}]**\n\n/5153 - Like 👍 - {r(0.12)}\n/5160 - Fast Like 🎉 - {r(0.15)}\n/5161 - Mix Like 🤩 - {r(0.10)}\n\nℹ️ Tap code to order."
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_services"))
    await callback.message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data == "platform_instagram")
async def show_instagram_services_chart(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    pref = user["currency"]
    def r(usd): return f"₹{round(usd * USD_TO_INR_RATE, 2)}" if pref == "INR" else f"${usd}"
    text = f"📸 **INSTAGRAM SERVICES [Currency: {pref}]**\n\n/7802 - Instagram Likes - {r(0.21)}\n/3602 - Instagram Followers - {r(3.12)}\n\nℹ️ Tap code to order."
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_services"))
    await callback.message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="Markdown")

@dp.message(F.text.startswith("/"))
async def process_service_id_command(message: types.Message):
    service_id = message.text.replace("/", "").strip()
    if service_id not in SERVICES_MASTER_DATA: return
    service_info = SERVICES_MASTER_DATA[service_id]
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="🛒 Buy 1000", callback_data=f"buy_{service_id}_1000")).row(types.InlineKeyboardButton(text="🛒 Buy 2000", callback_data=f"buy_{service_id}_2000")).row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_services"))
    await message.answer(f"⚡ **{service_info['name']}**\nSelect Qty:", reply_markup=builder.as_markup())

@dp.callback_query(F.data.startswith("buy_"))
async def execute_order_callback(callback: types.CallbackQuery):
    parts = callback.data.split("_")
    service_id = parts[1]
    quantity = int(parts[2])
    service_info = SERVICES_MASTER_DATA[service_id]
    user = get_or_create_user(callback.from_user.id)
    total_cost_usd = service_info["rate"] * (quantity / 1000.0)
    if user["balance_usd"] < total_cost_usd:
        await callback.message.answer("❌ In-sufficient Balance!")
        await callback.answer()
        return
    user["balance_usd"] -= total_cost_usd
    user["spent_usd"] += total_cost_usd
    user["orders_count"] += 1
    order_id = f"REC_{quantity}_{service_id}"
    user["order_details"][order_id] = {"cost_usd": total_cost_usd, "service": service_info["name"], "quantity": quantity, "status": "Active ✅"}
    await callback.message.answer(f"🎉 **Order Placed Successfully!**\n\n🆔 **Order ID:** `{order_id}`\n🛠️ **Service:** {service_info['name']}\n🔢 **Quantity:** {quantity}\n💰 **Deducted Amount:** {format_money(total_cost_usd, user['currency'])}")
    await callback.answer()

@dp.callback_query(F.data == "main_orders")
async def process_orders(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="⬅️ Menu", callback_data="back_to_menu"))
    if not user["order_details"]:
        await callback.message.edit_text("📦 No history found.", reply_markup=builder.as_markup())
        return
    text = "📦 **Live Orders:**\n\n"
    for order_id, meta in list(user["order_details"].items())[-5:]:
        text += f"🆔 ID: `{order_id}` | Status: {meta['status']} | Cost: {format_money(meta['cost_usd'], user['currency'])}\n"
    await callback.message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data == "main_profile")
async def process_profile(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    text = f"👤 **USER PROFILE**\n\n🌐 Currency: **{user['currency']}**\n💰 Balance: {format_money(user['balance_usd'], user['currency'])}"
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="🇮🇳 INR (₹)", callback_data="set_curr_INR"), types.InlineKeyboardButton(text="🇺🇸 USD ($)", callback_data="set_curr_USD")).row(types.InlineKeyboardButton(text="⬅️ Menu", callback_data="back_to_menu"))
    await callback.message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data.startswith("set_curr_"))
async def handle_currency_switch(callback: types.CallbackQuery):
