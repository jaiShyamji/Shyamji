module.exports = {
    // टेलीग्राम बॉट टोकन
    BOT_TOKEN: process.env.BOT_TOKEN,
    
    // SMM API क्रेडेंशियल्स 
    SMM_API_URL: process.env.SMM_API_URL || "https://smmlite.com",
    SMM_API_KEY: process.env.SMM_API_KEY,
    SUPPORT_USERNAME: process.env.SUPPORT_USERNAME || "YourSupportUsername",
    
    // 💳 ADD FUNDS SETTINGS (ऑटोमेटिक क्यूआर जनरेशन के लिए)
    UPI_ID: "prince2026gupta@okicici", // अपनी असली UPI ID यहाँ डालें
    MERCHANT_NAME: "SMM Panel", // अपना या पैनल का नाम यहाँ लिखें
    USDT_ADDRESS: "TYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", // अपना TRC20 एड्रेस यहाँ डालें
    USD_TO_INR_RATE: 95.0
};

