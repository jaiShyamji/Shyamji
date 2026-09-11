module.exports = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    SMM_API_URL: process.env.SMM_API_URL || "https://smmlite.com",
    SMM_API_KEY: process.env.SMM_API_KEY,
    SUPPORT_USERNAME: process.env.SUPPORT_USERNAME || "YourSupportUsername",
    
    // 👑 ADMIN SETTINGS
    ADMIN_ID: 7991401218, 
    USD_TO_INR_RATE: 95.0,

    // 🇮🇳 UPI MANUAL PAYMENT SETTINGS
    UPI_ID: "prince2026gupta@okicici", // Yahan apni UPI ID dalo bhai
    MERCHANT_NAME: "HAPPY REACTION", 
    // Is link se bot automatically har baar tumhari UPI ID ka QR bana lega:
    UPI_QR_LINK: "https://googleapis.com" + encodeURIComponent("upi://pay?pa=prince2026gupta@okicici&pn=HAPPY%20REACTION"),

    // 🪙 USDT MANUAL PAYMENT SETTINGS
    USDT_ADDRESS: "TYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", // Yahan apna USDT address dalo bhai
    // Is link se bot automatically tumhare USDT address ka QR bana lega:
    USDT_QR_LINK: "https://googleapis.com" + encodeURIComponent("TYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
};

