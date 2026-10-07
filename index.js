const TelegramBot = require('node-telegram-bot-api');

console.log('Bot Initialization Started...');

// ENV CONFIGURATION
const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('CRITICAL: BOT_TOKEN is missing in environment variables');
    process.exit(1);
}

// SMMULITE PANEL CONFIG
const ACTIVE_PANEL = {
    name: "SMMILITE",
    url: "https://smmlite.com/api/v2", 
    key: process.env.API_KEY,
    service: "5160"
};

if (!ACTIVE_PANEL.key) {
    console.warn('WARNING: API_KEY is missing in environment variables. Orders will fail.');
}

const bot = new TelegramBot(token, { polling: true });
console.log('Bot Started Successfully and Polling...');

// YOUR CHANNELS
const CHANNELS = [
    '@TRICKVIP',
    '@GROW_MASTER',
    '@Raja_Game_bunny',
    '@VIPGODGAMER',
    '@TradingGyaannnnnnn6',
    '@upseducationnnnnnn',
    '@Raja_Game_bunny'
];

// MEMORY-SAFE DUPLICATE PROTECTION
let processedLogs = [];

// SEND ORDER FUNCTION
async function sendOrder(link, quantity) {
    try {
        console.log("Sending | Link: " + link + " | Qty: " + quantity);
        
        const params = new URLSearchParams();
        params.append("key", ACTIVE_PANEL.key || "");
        params.append("action", "add");
        params.append("service", ACTIVE_PANEL.service);
        params.append("link", link);
        params.append("quantity", quantity.toString());
        
        const response = await fetch(ACTIVE_PANEL.url, {
            method: 'POST',
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString()
        });

        const responseText = await response.text();
        console.log("Raw API Response:", responseText);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.log("Parse Error: Panel returned text. Checking if key/link issue.");
            return false;
        }
        
        if (data && data.order) {
            console.log("Order Success ID: " + data.order + " [Qty Selected: " + quantity + "]");
            return true;
        } else if (data && data.error) {
            console.log("Panel Error: " + data.error);
            return false;
        } else {
            console.log("Order Failed: Unknown response structure");
            return false;
        }
    } catch (err) {
        console.log("Network/Panel Connection Error: " + err.message);
        return false;
    }
}

// BOT CHANNEL POST HANDLER
bot.on('channel_post', async (msg) => {
    try {
        const username = msg.sender_chat?.username || msg.chat?.username;
        const measure_id = msg.message_id;
        
        if (!username || !measure_id) return;

        // Unique Key Protection
        const uniqKey = username.toLowerCase() + "_" + measure_id;
        if (processedLogs.includes(uniqKey)) {
            console.log("Duplicate Post Skipped: " + uniqKey);
            return;
        }
        processedLogs.push(uniqKey);
        if (processedLogs.length > 100) processedLogs.shift();

        const cleanUsername = username.replace("@", "");
        
        // 🔗 टेलीग्राम शेयर लिंक फ़ॉर्मेट (As It Is ओरिजिनल लिंक जो सीधे पैनल को जाएगा)
        const link = "https://t.me/" + cleanUsername + "/" + measure_id;
        console.log("New Post Detected:", link);

        // Channel Authorization
        const channelUsername = "@" + cleanUsername;
        const isAllowed = CHANNELS.some(ch => ch.toLowerCase() === channelUsername.toLowerCase());

        if (!isAllowed) {
            console.log("Channel " + channelUsername + " not in allowed list");
            return;
        }

        // 📊 [नया फीचर]: हर अलग पोस्ट के लिए अलग क्वांटिटी सेट करने का लॉजिक
        // आप नीचे दी गई लिस्ट में अपनी पसंद की क्वांटिटीज बदल सकते हैं

        const availableQuantities = [10, 20, 30, 40, 50, 60, 70, 80, 100];
        
        // यह लाइन ऊपर की लिस्ट में से कोई भी एक क्वांटिटी अपने आप रैंडम चुन लेगी
        const randomQty = availableQuantities[Math.floor(Math.random() * availableQuantities.length)];
        
        console.log("Selected Random Quantity " + randomQty + " for post: " + link);
