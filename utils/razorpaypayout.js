const axios = require("axios");

function getAuth() {
    const keyId     = process.env.RAZORPAY_X_KEY_ID;
    const keySecret = process.env.RAZORPAY_X_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error("RAZORPAY_X_KEY_ID and RAZORPAY_X_KEY_SECRET must be set in .env");
    return { username: keyId, password: keySecret };
}

const BASE = "https://api.razorpay.com/v1";

/**
 * Ensure a Razorpay contact + fund account exists for this professional.
 * Supports both UPI (vpa) and bank account (bank_account) payout methods.
 * If already stored on the professional record, reuse them.
 * Returns { contactId, fundAccountId }
 */
exports.ensureFundAccount = async (professional) => {
    if (professional.razorpay_fund_account_id) {
        return {
            contactId:     professional.razorpay_contact_id,
            fundAccountId: professional.razorpay_fund_account_id,
        };
    }

    const auth   = getAuth();
    const name   = professional.users?.full_name ?? "Professional";
    const mobile = professional.users?.mobile    ?? null;
    const email  = professional.users?.email     ?? null;

    // 1. Create Razorpay contact
    const contactRes = await axios.post(`${BASE}/contacts`, {
        name,
        ...(mobile && { contact: mobile }),
        ...(email  && { email }),
        type: "employee",
    }, { auth });

    const contactId = contactRes.data.id;

    // 2. Create fund account — UPI or bank account
    let fundAccountPayload;

    if (professional.payout_method === "bank") {
        fundAccountPayload = {
            contact_id:   contactId,
            account_type: "bank_account",
            bank_account: {
                name:           professional.bank_account_name,
                ifsc:           professional.bank_ifsc,
                account_number: professional.bank_account_number,
            },
        };
    } else {
        // default: UPI
        fundAccountPayload = {
            contact_id:   contactId,
            account_type: "vpa",
            vpa:          { address: professional.upi_id },
        };
    }

    const faRes = await axios.post(`${BASE}/fund_accounts`, fundAccountPayload, { auth });

    return { contactId, fundAccountId: faRes.data.id };
};

/**
 * Trigger a Razorpay payout to the professional's fund account.
 * amount is in INR (converted to paise internally).
 * Returns the Razorpay payout object.
 */
exports.createPayout = async (fundAccountId, amountINR, referenceId, payoutMethod = "upi") => {
    const auth = getAuth();
    const mode = payoutMethod === "bank" ? "NEFT" : "UPI";
    const res  = await axios.post(`${BASE}/payouts`, {
        account_number:       process.env.RAZORPAY_X_ACCOUNT_NUMBER,
        fund_account_id:      fundAccountId,
        amount:               Math.round(amountINR * 100),
        currency:             "INR",
        mode,
        purpose:              "payout",
        queue_if_low_balance: true,
        reference_id:         referenceId,
        narration:            "Fitnesta earnings payout",
    }, { auth });

    return res.data;
};
