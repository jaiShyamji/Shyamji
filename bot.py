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
    "5153": {"name": "telegram like (👍) reaction + views [ instant]", "rate": 0.12},
    "5160": {"name": "telegram like (👍🤩🔥♥️🥰🎉) reaction + views [ instant]", "rate": 0.15},
    "5161": {"name": "telegram like (👎😁🥲💩🤮🤔🤯😡) reaction + views [ instant]", "rate": 0.10},
    "5162": {"name": "telegram like (♥️) reaction + views [ instant]", "rate": 0.15},
    "5163": {"name": "telegram like (🔥) reaction + views [ instant]", "rate": 0.15},
    "5164": {"name": "telegram like (🎉) reaction + views [ instant]", "rate": 0.15},
    "5165": {"name": "telegram like (🤩) reaction + views [ instant]", "rate": 0.15},
    "1512": {"name": "telegram post views [Last 1 post] [SUPERFAST] INSTANT", "rate": 0.11},
    "6855": {"name": "telegram post views [1 post] [REAL AND CHEAPEST] INSTANT 30MINS", "rate": 0.09},
    "7153": {"name": "Telegram Members - [ Refill:- 3 Days ] [ 50k/day ] SUPER INSTANT", "rate": 0.52},
    "6787": {"name": "Telegram Members - [ Mixed, Cheap ] [ 20k/day ] SUPER INSTANT", "rate": 0.38},
    "3274": {"name": "Telegram Channel Member - [ Mixed, Cheap ] [ 50k/day ] SUPER INSTANT", "rate": 0.52},
    "7802": {"name": "Instagram Likes [ Real Mixed User ] [ Speed: 20k/Hr ] [ No Refill ] INSTANT", "rate": 0.21},
    "7526": {"name": "Instagram Likes [ Speed: 20k/Per Hour ] [ HQ ] INSTANT", "rate": 0.26},
    "7374": {"name": "Instagram Likes [ Max - 200k ] [ Indian Mixed , Real Looking ] INSTANT", "rate": 0.19},
    "3602": {"name": "Instagram Followers [ Max 300k ] [ Real Users - ww ] [ 30 Days Refill ]", "rate": 3.12},
    "1658": {"name": "Instagram Followers [ Max 200k ] [ 30 Days Refill ] INSTANT", "rate": 1.82},
    "1961": {"name": "NEW - Instagram Followers [ Max 10k ] [ 30 Days Refill ] INSTANT", "rate": 2.48},
    "8810": {"name": "NEW - Instagram Followers [ Max 10k ] [ 10-30% Drop No Refill ] INSTANT", "rate": 1.77},
    "8782": {"name": "Instagram Followers [ Real Looking ] [ NO REFILL ] Max - 500k ]", "rate": 1.97},
    "2968": {"name": "Instagram Views [ For All Link ] [ Max - Unlimited ] SUPER INSTANT", "rate": 0.40},
    "6634": {"name": "Instagram Views [ Super Cheap ] SUPER INSTANT", "rate": 0.30},
    "7386": {"name": "Emergency Instagram Views [ Super Cheap ] SUPER INSTANT", "rate": 0.10}
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
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="✅ मैंने पेमेंट कर दी है", callback_data=f"paid_{amount_usd}")).row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_add_funds"))
    await callback.message.edit_text(f"📲 Pay: ₹{amount_inr} (~${round(amount_usd, 2)} USD)\n📌 UPI ID: `{UPI_ID}`\n📌 USDT Address: `{USDT_ADDRESS}`\n\nPay karke screenshot support par bhejein.", reply_markup=builder.as_markup())

@dp.callback_query(F.data.startswith("paid_"))
async def process_paid_click(callback: types.CallbackQuery):
    parts = callback.data.split("_")
    amount_usd = float(parts[-1])
    user = get_or_create_user(callback.from_user.id)
    user["history"].append({"amount_usd": amount_usd, "status": "Pending ⏳"})
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="⬅️ Menu", callback_data="back_to_menu"))
    await callback.message.edit_text("✅ **Request Sent!**\n\nTeam verify karke balance add karegi. Screenshot support par bhejein.", reply_markup=builder.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data == "main_channels")
async def process_channels(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    bot_info = await bot.get_me()
    promote_url = f"https://t.me{bot_info.username}?startchannel=true&admin=post_messages+edit_messages+delete_messages+invite_users"
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="➕ Promote Bot as Admin", url=promote_url)).row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    text = "📢 **My Channels:**\n\n"
    if not user["channels"]: text += "❌ Koi channel linked nahi hai.\n"
    else:
        for idx, ch in enumerate(user["channels"], start=1): text += f"🔹 {idx}. `{ch}` (Active ✅)\n"
    await callback.message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data == "main_services")
async def process_services_platforms(callback: types.CallbackQuery):
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="🔹 TELEGRAM", callback_data="platform_telegram"), types.InlineKeyboardButton(text="📸 INSTAGRAM", callback_data="platform_instagram")).row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="back_to_menu"))
    await callback.message.edit_text("🛠️ **Select Platform / प्लेटफॉर्म चुनें:**\n\nAap kiski services dekhna chahte hain?", reply_markup=builder.as_markup(), parse_mode="Markdown")

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
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_services"))
    await callback.message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="Markdown")
@dp.callback_query(F.data == "platform_instagram")
async def show_instagram_services_chart(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    pref = user["currency"]
    def r(usd): return f"₹{round(usd * USD_TO_INR_RATE, 2)}" if pref == "INR" else f"${usd}"
    text = f"✨ **WELCOME TO INSTAGRAM SERVICE [Current Currency: {pref}]** ✨\n\n"
    text += f"👍 **INSTAGRAM REELS - LIKES**\n"
    text += f"/7802 - Instagram Likes [ Real Mixed User ] [ Speed: 20k/Hr ] - {r(0.21)} PER 1000\n"
    text += f"/7526 - Instagram Likes [ Speed: 20k/Per Hour ] [ HQ ] - {r(0.26)} PER 1000\n"
    text += f"/7374 - Instagram Likes [ Indian Mixed , Real Looking ] - {r(0.19)} PER 1000\n\n"
    text += f"👥 **INSTAGRAM FOLLOWERS**\n"
    text += f"/3602 - Instagram Followers [ Real Users - ww ] [ 30 Days Refill ] - {r(3.12)} Per 1000\n"
    text += f"/1658 - Instagram Followers [ Max 200k ] [ 30 Days Refill ] - {r(1.82)} Per 1000\n"
    text += f"/1961 - NEW - Instagram Followers [ Max 10k ] [ 30 Days Refill ] - {r(2.48)} Per 1000\n"
    text += f"/8810 - NEW - Instagram Followers [ Max 10k ] [ 10-30% Drop No Refill ] - {r(1.77)} Per 1000\n"
    text += f"/8782 - Instagram Followers [ Real Looking ] [ NO REFILL ] Max - 500k ] - {r(1.97)} Per 1000\n\n"
    text += f"🎬 **INSTAGRAM REELS VIEW**\n"
    text += f"/2968 - Instagram Views [ For All Link ] [ Max - Unlimited ] - {r(0.40)} Per 1000\n"
    text += f"/6634 - Instagram Views [ Super Cheap ] [ INSTANT ] - {r(0.30)} Per 1000\n"
    text += f"/7386 - Emergency Instagram Views [ Super Cheap ] [ INSTANT ] - {r(0.10)} Per 1000\n\n"
    text += "ℹ️ *Tip:* Order ke liye blue link (e.g. /7802) par tap karein."
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="main_services"))
    await callback.message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data == "platform_facebook")
async def coming_soon_fb(callback: types.CallbackQuery):
    await callback.answer("⏳ Facebook updates jald hi active honge!", show_alert=True)

@dp.callback_query(F.data == "platform_youtube")
async def coming_soon_yt(callback: types.CallbackQuery):
    await callback.answer("⏳ YouTube updates jald hi active honge!", show_alert=True)

@dp.message(F.text.startswith("/"))
async def process_service_id_command(message: types.Message):
    service_id = message.text.replace("/", "").strip()
    if service_id not in SERVICES_MASTER_DATA: return
    service_info = SERVICES_MASTER_DATA[service_id]
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="1000", callback_data=f"buy_{service_id}_1000"), types.InlineKeyboardButton(text="2000", callback_data=f"buy_{service_id}_2000"))
    builder.row(types.InlineKeyboardButton(text="5000", callback_data=f"buy_{service_id}_5000"), types.InlineKeyboardButton(text="10000", callback_data=f"buy_{service_id}_10000"))
    builder.row(types.InlineKeyboardButton(text="⬅️ BACK", callback_data="main_services"))
    await message.answer(f"🔢 **You select your quantity:**\n\nService: {service_info['name']}\nRate: ${service_info['rate']} per 1000\n\nNeeche diye gaye sequence buttons me se select karein:", reply_markup=builder.as_markup())

@dp.callback_query(F.data.startswith("buy_"))
async def execute_order_callback(callback: types.CallbackQuery):
    parts = callback.data.split("_")
    service_id = str(parts[1])
    quantity = int(parts[2])
    service_info = SERVICES_MASTER_DATA[service_id]
    user = get_or_create_user(callback.from_user.id)
    total_cost_usd = service_info["rate"] * (quantity / 1000.0)
    
    if user["balance_usd"] < total_cost_usd:
        await callback.message.answer(f"❌ **In-sufficient Balance!**\nCost: {format_money(total_cost_usd, user['currency'])} | Your Balance: {format_money(user['balance_usd'], user['currency'])}\nKripya recharge karein.")
        await callback.answer()
        return

    if not SMM_API_KEY or "your-smm-panel" in SMM_API_URL:
        user["balance_usd"] -= total_cost_usd
        user["spent_usd"] += total_cost_usd
        user["orders_count"] += 1
        order_id = f"MOCK_{quantity}_{service_id}"
        user["order_details"][order_id] = {"cost_usd": total_cost_usd, "service": service_info["name"], "quantity": quantity, "status": "Pending ⏳", "refunded": False}
        await callback.message.answer(f"🎉 **Order Placed Successfully!**\n\n🆔 **Order ID:** `{order_id}`\n🛠️ **Service:** {service_info['name']}\n🔢 **Quantity:** {quantity}\n💰 **Deducted Amount:** {format_money(total_cost_usd, user['currency'])}")
        await callback.answer()
        return

    try:
        res = requests.post(SMM_API_URL, data={'key': SMM_API_KEY, 'action': 'add', 'service': service_id, 'link': 'https://t.me', 'quantity': quantity}, timeout=10).json()
        if "order" in res:
            smm_order_id = str(res["order"])
            user["balance_usd"] -= total_cost_usd
            user["spent_usd"] += total_cost_usd
            user["orders_count"] += 1
            user["order_details"][smm_order_id] = {"cost_usd": total_cost_usd, "service": service_info["name"], "quantity": quantity, "status": "Pending ⏳", "refunded": False}
            success_text = f"🎉 **Order Placed Successfully!**\n\n🆔 **Order ID:** `{smm_order_id}`\n🛠️ **Service:** {service_info['name']}\n🔢 **Quantity:** {quantity}\n💰 **Deducted Amount:** {format_money(total_cost_usd, user['currency'])}"
        else: success_text = f"❌ Order rejected: `{res.get('error', 'Unknown Error')}`"
    except Exception: success_text = "❌ Network connection issue. Kripya baad me try karein."
    await callback.message.answer(success_text)
    await callback.answer()

@dp.callback_query(F.data == "main_orders")
async def process_orders(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="🔄 Refresh Orders Status", callback_data="refresh_orders")).row(types.InlineKeyboardButton(text="⬅️ Menu", callback_data="back_to_menu"))
    if not user["order_details"]:
        await callback.message.edit_text("📦 **Your Orders History:**\n\n❌ Koi order history nahi mili.", reply_markup=builder.as_markup())
        return
    text = "📦 **Your Live Orders Status:**\n\n"
    for order_id, meta in list(user["order_details"].items())[-5:]:
        if "MOCK_" in order_id:
            text += f"🆔 **Order:** `{order_id}`\n📊 **Status:** ⏳ Testing Active\n💰 **Cost:** {format_money(meta['cost_usd'], user['currency'])}\n━━━━━━━━━━━━━━━━━━━━\n"
            continue
        try:
            res = requests.post(SMM_API_URL, data={'key': SMM_API_KEY, 'action': 'status', 'order': order_id}, timeout=5.0).json()
            if "status" in res:
                meta["status"] = res["status"]
                st = res["status"]
                em = "⏳"
                if st.lower() in ["canceled", "cancelled", "rejected"]:
                    em = "❌"
                    if not meta.get("refunded", False):
                        user["balance_usd"] += meta["cost_usd"]
                        user["spent_usd"] -= meta["cost_usd"]
                        meta["refunded"] = True
                        meta["status"] = "Canceled (Refunded ✅)"
                elif st.lower() == "completed": em = "✅"
                elif st.lower() == "in progress": em = "⚡"
                text += f"🆔 **Order:** `{order_id}`\n📊 **Status:** {em} {meta['status']}\n💰 **Cost:** {format_money(meta['cost_usd'], user['currency'])}\n━━━━━━━━━━━━━━━━━━━━\n"
        except Exception: text += f"🆔 **Order:** `{order_id}` | Status: Timeout ⚠️\n━━━━━━━━━━━━━━━━━━━━\n"
    await callback.message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data == "refresh_orders")
async def refresh_orders_handler(callback: types.CallbackQuery):
    await process_orders(callback)

@dp.callback_query(F.data == "main_profile")
async def process_profile(callback: types.CallbackQuery):
    user = get_or_create_user(callback.from_user.id)
    text = f"👤 **USER PROFILE**\n━━━━━━━━━━━━\n📛 Name: {callback.from_user.full_name}\n🔑 ID: `{callback.from_user.id}`\n🌐 Currency Preference: **{user['currency']}**\n━━━━━━━━━━━━\n💰 Balance: {format_money(user['balance_usd'], user['currency'])}\n💸 Total Spend: {format_money(user['spent_usd'], user['currency'])}\n📦 Total Orders: {user['orders_count']}\n\n👉 **Change Currency:** Display badalne ke liye button chunein:"
    builder = InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="🇮🇳 Switch to INR (₹)", callback_data="set_curr_INR"), types.InlineKeyboardButton(text="🇺🇸 Switch to USD ($)", callback_data="set_curr_USD")).row(types.InlineKeyboardButton(text="⬅️ Menu", callback_data="back_to_menu"))
    await callback.message.edit_text(text, reply_markup=builder.as_markup(), parse_mode="Markdown")

@dp.callback_query(F.data.startswith("set_curr_"))
async def handle_currency_switch(callback: types.CallbackQuery):
    # ⭐ MANDATORY INDENTATION BLOCK RESTORED SUCCESSFULLY (LINE 157-158 ERROR FIXED)
    parts = callback.data.split("_")
    user = get_or_create_user(callback.from_user.id)
    user["currency"] = str(parts[-1])
    await callback.answer("✅ Currency Preferred Updated!", show_alert=True)
    await process_profile(callback)

@dp.callback_query(F.data == "main_promo")
async def process_promo(callback: types.CallbackQuery):
    builder = InlineKeyboardBuilder().add(types.InlineKeyboardButton(text="⬅️ Menu", callback_data="back_to_menu"))
    await callback.message.edit_text("🎁 **Promotions:** Vartaman me koi promo code active nahi hai.", reply_markup=builder.as_markup())

@dp.callback_query(F.data == "main_support")
async def process_support(callback: types.CallbackQuery):

