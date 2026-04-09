const cron = require("node-cron");
const prisma = require("../config/prisma");

/**
 * Every minute: find sessions that are still "scheduled" but whose start_time
 * passed more than 15 minutes ago (on today's date), and mark them "absent".
 *
 * This applies to all session types — the professional (trainer/teacher) did
 * not punch in, so the session is marked absent from their perspective.
 */
function startMarkAbsentJob() {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      // Build a cutoff time: 15 minutes ago, expressed as a Time-only Date
      // (same epoch base Prisma uses for @db.Time — 1970-01-01)
      const cutoff = new Date(1970, 0, 1, now.getHours(), now.getMinutes() - 15, now.getSeconds());

      // Today's date (midnight) for date comparison
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd   = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const result = await prisma.sessions.updateMany({
        where: {
          status:         "scheduled",
          scheduled_date: { gte: todayStart, lt: todayEnd },
          start_time:     { lt: cutoff },
        },
        data: {
          status:     "absent",
          updated_at: now,
        },
      });

      if (result.count > 0) {
        console.log(`[absent-job] Marked ${result.count} session(s) as absent`);
      }
    } catch (err) {
      console.error("[absent-job] Error:", err.message);
    }
  });

  console.log("[absent-job] Started — checks every minute for unpunched sessions");
}

module.exports = { startMarkAbsentJob };
