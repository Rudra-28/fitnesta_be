const cron = require("node-cron");
const prisma = require("../config/prisma");

/**
 * Every 5 minutes: find sessions that are still "ongoing" but whose end_time
 * passed more than 20 minutes ago, and mark them "completed".
 *
 * This handles the case where a professional checks in (sets status = ongoing)
 * but never checks out — the session would stay ongoing forever otherwise.
 */
function startAutoCompleteJob() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const now = new Date();

      // Cutoff: end_time must be at least 20 minutes in the past
      // end_time is stored as a Time-only Date on the 1970-01-01 epoch base
      const cutoff = new Date(1970, 0, 1, now.getHours(), now.getMinutes() - 20, now.getSeconds());

      // Today's date (midnight) — sessions on past dates are handled below separately
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Auto-complete any ongoing session from a past date (entire day has passed)
      const pastResult = await prisma.sessions.updateMany({
        where: {
          status:         "ongoing",
          scheduled_date: { lt: todayStart },
        },
        data: { status: "completed", updated_at: now },
      });
      if (pastResult.count > 0) {
        console.log(`[autocomplete-job] Marked ${pastResult.count} past-date ongoing session(s) as completed`);
      }

      // Auto-complete today's ongoing sessions where end_time + 20 min has passed
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const result = await prisma.sessions.updateMany({
        where: {
          status:         "ongoing",
          scheduled_date: { gte: todayStart, lt: todayEnd },
          end_time:       { lt: cutoff },
        },
        data: { status: "completed", updated_at: now },
      });

      if (result.count > 0) {
        console.log(`[autocomplete-job] Marked ${result.count} ongoing session(s) as completed`);
      }
    } catch (err) {
      console.error("[autocomplete-job] Error:", err.message);
    }
  });

  console.log("[autocomplete-job] Started — checks every 5 minutes for unchecked-out sessions");
}

module.exports = { startAutoCompleteJob };
