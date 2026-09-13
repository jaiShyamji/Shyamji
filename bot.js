// ==========================================
// 🔐 STRICT ADMIN AUTH CHECK & COMMANDS ROUTING
// ==========================================
const isAdmin = (ctx, next) => {
    if (String(ctx.from?.id) !== String(config.ADMIN_ID)) {
        return ctx.reply("❌ **Access Denied!** Ye command sirf Bot Owner/Admin ke liye reserved hai. 😎");
    }
    return next();
};

// 💰 Money & User Management Commands
bot.command("addbal", isAdmin, p.handleAdminAddBal);
bot.command("deductbal", isAdmin, p.handleAdminDeductBal);
bot.command("user", isAdmin, p.handleAdminUserCheck);
bot.command("broadcast", isAdmin, p.handleAdminBroadcast);
bot.command("ban", isAdmin, p.handleAdminBan);
bot.command("unban", isAdmin, p.handleAdminUnban);

// 🛒 Service Management Redirection (Directing commands to order handlers text flow)
bot.command("addservice", isAdmin, async (ctx) => { await o.handleTextMessages(ctx); });
bot.command("updateservice", isAdmin, async (ctx) => { await o.handleTextMessages(ctx); });
bot.command("delservice", isAdmin, async (ctx) => { await o.handleTextMessages(ctx); });
