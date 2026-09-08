import os
import logging
import asyncio
import requests
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import StatesGroup, State
from aiogram.utils.keyboard import InlineKeyboardBuilder

# ==========================================
# 🛠️ 1. CONFIGURATION & VARIABLES (RAILWAY DASHBOARD)
# ==========================================
BOT_TOKEN = os.getenv("BOT_TOKEN")
SMM_API_URL = os.getenv("SMM_API_URL", "https://your-smm-panel.com")
SMM_API_KEY = os.getenv("SMM_API_KEY")
SUPPORT_USERNAME = os.getenv("SUPPORT_USERNAME", "YourSupportUsername")
UPI_ID = os.getenv("UPI_ID", "your-vpa@ybl")
USDT_ADDRESS = os.getenv("USDT_ADDRESS", "TYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")

# User ko $1 = ₹95 INR ke conversion markup par rate dikhane ke liye
USD_TO_INR_RATE = 95.0 

logging.basicConfig(level=logging.INFO)

if not BOT_TOKEN:
    raise ValueError("ERROR: BOT_TOKEN is missing! Railway dashboard me set karein.")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# Main Database - Baseline storage strictly in USD to match script integration requirements
USER_DATABASE = {}

class BotStates(StatesGroup):
    waiting_for_amount = State()      
    waiting_for_channel_id = State()  
    waiting_for_smm_link = State()    
    waiting_for_quantity = State()    

# Base engine price rates strictly configured in USD ($)
SERVICES_MASTER_DATA = {
    # --- TELEGRAM SERVICES ---
    "5153": {"name": "telegram like (👍) reaction + views [ instant]", "rate": 0.12, "type": "tg_post"},
    "5160": {"name": "telegram like (👍🤩🔥♥️🥰🎉) reaction + views [ instant]", "rate": 0.15, "type": "tg_post"},
    "5161": {"name": "telegram like (👎😁🥲💩🤮🤔🤯😡) reaction + views [ instant]", "rate": 0.10, "type": "tg_post"},
    "5162": {"name": "telegram like (♥️) reaction + views [ instant]", "rate": 0.15, "type": "tg_post"},
    "5163": {"name": "telegram like (🔥) reaction + views [ instant]", "rate": 0.15, "type": "tg_post"},
    "5164": {"name": "telegram like (🎉) reaction + views [ instant]", "rate": 0.15, "type": "tg_post"},
    "5165": {"name": "telegram like (🤩) reaction + views [ instant]", "rate": 0.15, "type": "tg_post"},
    "1512": {"name": "telegram post views [Last 1 post] [REAL SUPERFAST] INSTANT", "rate": 0.11, "type": "tg_post"},
    "6855": {"name": "telegram post views [1 post] [REAL AND CHEAPEST] INSTANT 30MINS", "rate": 0.09, "type": "tg_post"},
    "7153": {"name": "Telegram Members - [ Refill:- 3 Days ] [ 50k/day ] SUPER INSTANT", "rate": 0.52, "type": "tg_channel"},
    "6787": {"name": "Telegram Members - [ Mixed, Cheap ] [ 20k/day ] SUPER INSTANT", "rate": 0.38, "type": "tg_channel"},
    "3274": {"name": "Telegram Channel Member - [ Mixed, Cheap ] [ 50k/day ] SUPER INSTANT", "rate": 0.52, "type": "tg_channel"},
    
    # --- INSTAGRAM SERVICES ---
    "7802": {"name": "Instagram Likes [ Real Mixed User ] [ Speed: 20k/Hr ] [ No Refill ] INSTANT", "rate": 0.21, "type": "ig_post"},
    "7526": {"name": "Instagram Likes [ Speed: 20k/Per Hour ] [ HQ ] INSTANT", "rate": 0.26, "type": "ig_post"},
    "7374": {"name": "Instagram Likes [ Max - 200k ] [ Indian Mixed , Real Looking ] INSTANT", "rate": 0.19, "type": "ig_post"},
    "3602": {"name": "Instagram Followers [ Max 300k ] [ Real Users - ww ] [ 30 Days Refill ]", "rate": 3.12, "type": "ig_profile"},
    "1658": {"name": "Instagram Followers [ Max 200k ] [ 30 Days Refill ] INSTANT", "rate": 1.82, "type": "ig_profile"},
    "1961": {"name": "NEW - Instagram Followers [ Max 10k ] [ 30 Days Refill ] INSTANT", "rate": 2.48, "type": "ig_profile"},
    "8810": {"name": "NEW - Instagram Followers [ Max 10k ] [ 10-30% Drop No Refill ] INSTANT", "rate": 1.77, "type": "ig_profile"},
    "8782": {"name": "Instagram Followers [ Real Looking ] [ NO REFILL ] Max - 500k ]", "rate": 1.97, "type": "ig_profile"},
    "2968": {"name": "Instagram Views [ For All Link ] [ Max - Unlimited ] SUPER INSTANT", "rate": 0.40, "type": "ig_post"},
    "6634": {"name": "Instagram Views [ Super Cheap ] SUPER INSTANT", "rate": 0.30, "type": "ig_post"},
    "7386": {"name": "Emergency Instagram Views [ Super Cheap ] SUPER INSTANT", "rate": 0.10, "type": "ig_post"}
}

def get_or_create_user(user_id):
    if user_id not in USER_DATABASE:
        USER_DATABASE[user_id] = {
            "balance_usd": 0.0, 
            "spent_usd": 0.0, 
            "orders_count": 0, 
            "channels": [], 
            "history": [], 
            "order_details": {},  
            "currency": "INR" 
        }
    return USER_DATABASE[user_id]

def format_money(amount_usd, currency_pref):
    """Automatically converts and appends proper symbols based on preference settings"""
    if currency_pref == "INR":
        return f"₹{round(amount_usd * USD_TO_INR_RATE, 2)}"
    return f"${round(amount_usd, 2)}"

# ==========================================
# 🏠 2. START COMMAND (MAIN MENU WITH NEW BRANDING)
# ==========================================
@dp.message(Command("start"))
async def cmd_start(message: types.Message, state: FSMContext):
    await state.clear() 
    get_or_create_user(message.from_user.id)
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="💰 Balance", callback_data="main_balance"), types.InlineKeyboardButton(text="➕ Add Funds", callback_data="main_add_funds"))
    builder.row(types.InlineKeyboardButton(text="📢 My Channels", callback_data="main_channels"), types.InlineKeyboardButton(text="🛠️ Services", callback_data="main_services"))
    builder.row(types.InlineKeyboardButton(text="📦 My Orders", callback_data="main_orders"), types.InlineKeyboardButton(text="👤 My Profile", callback_data="main_profile"))
    builder.row(types.InlineKeyboardButton(text="🎁 Promotions", callback_data="main_promo"), types.InlineKeyboardButton(text="💬 Support", callback_data="main_support"))
    
    welcome_text = (
        "WELCOME TO HAPPY REACTION 🎉\n\n"
        "YOUR ACCOUNT IS READY ✅\n\n"
        "Choose an option below:👇"
    )
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
async def process_add_funds(callback: types.CallbackQuery, state: FSMContext):
    await state.clear()
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="₹100", callback_data="amt_100"), types.InlineKeyboardButton(text="₹200", callback_data="amt_200"))
    builder.row(types.InlineKeyboardButton(text="₹500", callback_data="amt_500"), types.InlineKeyboardButton(text="₹1000", callback_data="amt_1000"))
    builder.row(types.InlineKeyboardButton(text="₹2000", callback_data="amt_2000"), types.InlineKeyboardButton(text="₹5000", callback_data="amt_5000"))
    builder.row(types.InlineKeyboardButton(text="✏️ Custom Amount (INR)", callback_data="amt_custom"))
    builder.row(types.InlineKeyboardButton(text="📜 Deposit History", callback_data="fund_history"), types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    await callback.message.edit_text("💳 **Add Funds / डिपॉजिट फंड:**\n\nकोई एक अमाउंट चुनें या 'Custom Amount' पर क्लिक करें (INR value):", reply_markup=builder.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data.startswith("amt_"))
async def handle_amount_selection(callback: types.CallbackQuery, state: FSMContext):
    action = callback.data.split("_")[-1]
    if action == "custom":
        await callback.message.edit_text("📝 **Kripya woh rashi (INR me) type karke bhejein:**")
        await state.set_state(BotStates.waiting_for_amount)
    else:
        await ask_payment_method(callback.message, int(action), state)

@dp.message(BotStates.waiting_for_amount)
async def process_custom_amount_input(message: types.Message, state: FSMContext):
    if not message.text.isdigit() or int(message.text) <= 0:
        await message.answer("❌ Kripya sahi number dalein (e.g., 500):")
        return
    await ask_payment_method(message, int(message.text), state)

async def ask_payment_method(target_message: types.Message, amount_inr: int, state: FSMContext):
    amount_usd = amount_inr / USD_TO_INR_RATE
    await state.update_data(deposit_amount_usd=amount_usd, deposit_amount_inr=amount_inr)
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="📲 UPI (⚡ Auto)", callback_data="pay_method_upi"), types.InlineKeyboardButton(text="🪙 USDT (Crypto)", callback_data="pay_method_usdt"))
    builder.row(types.InlineKeyboardButton(text="❌ Cancel", callback_data="main_add_funds"))
    text = f"🛒 **Selected Amount:** ₹{amount_inr} (~${round(amount_usd, 2)} USD)\n\nAap kis माध्यम se pay karna chahte hain?"
    if hasattr(target_message, 'edit_text'): await target_message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="Markdown")
    else: await target_message.answer(text, reply_markup=builder.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data.startswith("pay_method_"))
async def show_payment_details(callback: types.CallbackQuery, state: FSMContext):
    data = await state.get_data()
    amount_inr = data.get("deposit_amount_inr", 0)
