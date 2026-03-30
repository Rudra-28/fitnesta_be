const Razorpay = require("razorpay");
const crypto = require("crypto");

let instance = null;

function getInstance() {
    if (!instance) {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env");
        }
        instance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
    return instance;
}

/**
 * Create a Razorpay order.
 * @param {number} amount      - Total amount in INR (converted to paise internally)
 * @param {string} receipt     - Short unique identifier (max 40 chars) — we use temp_uuid slice
 * @param {object} notes       - Key-value pairs embedded in the order; temp_uuid goes here
 *                               so the webhook can identify which registration to finalize.
 * @returns {object}           - Razorpay order object { id, amount, currency, ... }
 */
exports.createOrder = async (amount, receipt, notes = {}) => {
    if (process.env.DEV_SKIP_PAYMENT === "true") {
        return {
            id: "dev_order_" + receipt.slice(0, 16),
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: receipt.slice(0, 40),
            notes,
        };
    }
    const order = await getInstance().orders.create({
        amount: Math.round(amount * 100), // paise
        currency: "INR",
        receipt: receipt.slice(0, 40),
        notes,
    });
    return order;
};

/**
 * Verify the X-Razorpay-Signature header from an incoming webhook POST.
 *
 * Razorpay signs the raw request body with HMAC-SHA256 using the webhook secret.
 * We must compare against req.rawBody (the unmodified Buffer captured in index.js),
 * NOT the re-stringified JSON — whitespace differences would break the comparison.
 *
 * @param {Buffer|string} rawBody  - req.rawBody set by the express.json verify callback
 * @param {string}        signature - req.headers['x-razorpay-signature']
 * @returns {boolean}
 */
exports.verifyWebhookSignature = (rawBody, signature) => {
    if (!rawBody || !signature) return false;
    const expected = crypto
        .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");
    try {
        return crypto.timingSafeEqual(
            Buffer.from(expected, "hex"),
            Buffer.from(signature, "hex")
        );
    } catch {
        return false;
    }
};
