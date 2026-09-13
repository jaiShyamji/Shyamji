// ==========================================================
// 👑 CENTRAL ADMIN ENGINE - ADDED POWERS (paymentHandlers.js)
// ==========================================================

module.exports.handleAdminAddBal = async (ctx) => {
    const args = ctx.match ? ctx.match.split(" ") : [];
    if (args.length < 2) return ctx.reply("⚠️ **Format:** `/addbal [UserID] [Amount]`");
    const targetId = args[0];
    const amt = parseFloat(args[1]);
    if (isNaN(amt) || amt <= 0) return ctx.reply("❌ Galat amount enter kiya hai, bhai!");
    
    if (!DYNAMIC_USER_DB[targetId]) {
        DYNAMIC_USER_DB[targetId] = { username: "Unknown", balance_usd: 0.0, total_deposit_usd: 0.0, spent_usd: 0.0, history: [] };
    }
    
    DYNAMIC_USER_DB[targetId].balance_usd += amt;
    forceSaveDatabase();
    
    ctx.reply(`✅ **Successfully Added!**\n👤 User: \`${targetId}\`\n💰 Amount: $${amt} (₹${(amt * config.USD_TO_INR_RATE).toFixed(2)})`);
    try {
        await ctx.api.sendMessage(targetId, `🎉 **Wallet Credited!**\nAdmin ne aapke account mein $${amt} credit kar diye hain. Bindaas orders lagao!`);
    } catch(e) {
        ctx.reply("⚠️ User ko notify nahi kiya jaa saka, par wallet credit safe hai.");
    }
};

module.exports.handleAdminDeductBal = async (ctx) => {
    const args = ctx.match ? ctx.match.split(" ") : [];
    if (args.length < 2) return ctx.reply("⚠️ **Format:** `/deductbal [UserID] [Amount]`");
    const targetId = args[0];
    const amt = parseFloat(args[1]);
    if (isNaN(amt) || amt <= 0) return ctx.reply("❌ Invalid amount!");
    
    if (DYNAMIC_USER_DB[targetId]) {
        DYNAMIC_USER_DB[targetId].balance_usd = Math.max(0, DYNAMIC_USER_DB[targetId].balance_usd - amt);
        forceSaveDatabase();
        ctx.reply(`📉 **Balance Deducted!**\n👤 User ID: \`${targetId}\`\n🔻 Deducted: $${amt}`);
    } else {
        ctx.reply("❌ Ye User ID database mein nahi mili.");
    }
};

module.exports.handleAdminUserCheck = async (ctx) => {
    const targetId = ctx.match ? ctx.match.trim() : "";
    if (!targetId) return ctx.reply("⚠️ **Format:** `/user [UserID]`");
    
    const u = DYNAMIC_USER_DB[targetId];
    if (!u) return ctx.reply("❌ Ye user kabhi bot par register nahi hua.");
    
    ctx.reply(`📊 **USER PROFILE REPORT (\`${targetId}\`)**\n\n💰 **Current Balance:** $${u.balance_usd.toFixed(2)}\n📥 **Total Deposited:** $${u.total_deposit_usd.toFixed(2)}\n🛒 **Total Spent:** $${u.spent_usd.toFixed(2)}\n🛑 **Status:** ${u.isBanned ? "❌ BANNED" : "✅ ACTIVE"}`);
};

module.exports.handleAdminBan = async (ctx) => {
    const targetId = ctx.match ? ctx.match.trim() : "";
    if (!targetId) return ctx.reply("⚠️ **Format:** `/ban [UserID]`");
    
    if (!DYNAMIC_USER_DB[targetId]) {
        DYNAMIC_USER_DB[targetId] = { username: "Unknown", balance_usd: 0.0, total_deposit_usd: 0.0, spent_usd: 0.0, history: [] };
    }
    DYNAMIC_USER_DB[targetId].isBanned = true;
    forceSaveDatabase();
    ctx.reply(`🚫 User \`${targetId}\` ko bot se **Permanently Ban** kar diya gaya hai!`);
};

module.exports.handleAdminUnban = async (ctx) => {
    const targetId = ctx.match ? ctx.match.trim() : "";
    if (!targetId) return ctx.reply("⚠️ **Format:** `/unban [UserID]`");
    
    if (DYNAMIC_USER_DB[targetId]) {
        DYNAMIC_USER_DB[targetId].isBanned = false;
        forceSaveDatabase();
    }
    ctx.reply(`✅ User \`${targetId}\` ko dobara **Unban** kar diya gaya.`);
};

module.exports.handleAdminBroadcast = async (ctx) => {
    const msg = ctx.match ? ctx.match.trim() : "";
    if (!msg) return ctx.reply("⚠️ **Format:** `/broadcast [Aapka text message]`");
    
    ctx.reply("📢 **Broadcast sequence initiated...** Saare active users ko delivery jaa rahi hai.");
    let successCount = 0;
    
    for (const targetId of Object.keys(DYNAMIC_USER_DB)) {
        try {
            await ctx.api.sendMessage(targetId, `📢 **NOTIFICATION FROM ADMIN**\n\n${msg}`);
            successCount++;
        } catch(e) {}
    }
    ctx.reply(`✅ **Broadcast Complete!** Total ${successCount} users ko message mil gaya.`);
};
