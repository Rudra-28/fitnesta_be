/**
 * Structured logger — no external dependencies.
 *
 * Outputs JSON lines to stdout/stderr so log aggregators (CloudWatch, Datadog, etc.)
 * can parse them without extra config. Falls back to a human-readable format when
 * NODE_ENV is "development".
 *
 * Usage:
 *   const log = require("../../utils/logger");
 *   log.info("[auth] login success", { userId: 5, role: "student" });
 *   log.warn("[payment] signature mismatch", { temp_uuid });
 *   log.error("[payment] webhook crashed", err);
 */

const IS_DEV = process.env.NODE_ENV !== "production";

function write(level, message, meta) {
    const ts = new Date().toISOString();

    // In dev, print a readable line so the console isn't overwhelming
    if (IS_DEV) {
        const prefix = level === "error" ? "✗" : level === "warn" ? "⚠" : "›";
        const extras = meta
            ? (meta instanceof Error
                ? `  ${meta.stack || meta.message}`
                : `  ${JSON.stringify(meta)}`)
            : "";
        const line = `${ts} ${prefix} ${message}${extras}`;
        level === "error" ? console.error(line) : console.log(line);
        return;
    }

    // In production, emit a JSON line for log aggregators
    const entry = { ts, level, msg: message };
    if (meta) {
        if (meta instanceof Error) {
            entry.err = { message: meta.message, stack: meta.stack };
        } else {
            entry.meta = meta;
        }
    }
    const line = JSON.stringify(entry);
    level === "error" ? process.stderr.write(line + "\n") : process.stdout.write(line + "\n");
}

module.exports = {
    info:  (msg, meta) => write("info",  msg, meta),
    warn:  (msg, meta) => write("warn",  msg, meta),
    error: (msg, meta) => write("error", msg, meta),
};
