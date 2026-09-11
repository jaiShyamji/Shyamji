module.exports = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    SMM_API_URL: process.env.SMM_API_URL || "https://smmlite.com",
    SMM_API_KEY: process.env.SMM_API_KEY,
    SUPPORT_USERNAME: process.env.SUPPORT_USERNAME || "YourSupportUsername",
    
    // 👑 ADMIN & PAYMENT PANEL SETTINGS
    ADMIN_ID: 7991401218, 
    UPI_ID: "shyamji@ybl", 
    MERCHANT_NAME: "HAPPY REACTION", 
    USDT_ADDRESS: "TYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", 
    USD_TO_INR_RATE: 95.0,

    // 🌐 RAILWAY PORT SETTING
    PORT: process.env.PORT || 3000,
    RAILWAY_URL: process.env.RAILWAY_PUBLIC_DOMAIN || "" // Railway public URL automatically utha lega
};
