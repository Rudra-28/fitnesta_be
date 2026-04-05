/**
 * Withdrawal Service — shared across all professional dashboards.
 *
 * Status flow:
 *   pending   → professional calls withdrawRequest  → requested
 *   requested → admin calls approveWithdrawal       → approved  (+ push notification to professional)
 *   approved  → professional calls withdrawNow      → paid (processing via Razorpay)
 *   paid      ← Razorpay webhook payout.processed confirms
 *              ← payout.failed reverts back to approved
 */

const prisma         = require("../../config/prisma");
const commissionRepo = require("./commissionrepo");
const payoutUtil     = require("../../utils/razorpaypayout");

// ── Helper ─────────────────────────────────────────────────────────────────

const getAmounts = async (professionalId, status) => {
    const rows = await prisma.commissions.findMany({
        where:  { professional_id: professionalId, status },
        select: { id: true, commission_amount: true },
    });
    const total = parseFloat(rows.reduce((s, c) => s + parseFloat(c.commission_amount), 0).toFixed(2));
    return { rows, ids: rows.map((c) => c.id), total };
};

// ── Step 1: Professional requests withdrawal ───────────────────────────────

exports.withdrawRequest = async (professionalId) => {
    // Guard: no active request or approval already pending
    const active = await prisma.commissions.count({
        where: { professional_id: professionalId, status: { in: ["requested", "approved"] } },
    });
    if (active > 0)
        throw Object.assign(new Error("A withdrawal request is already in progress"), { statusCode: 400 });

    const { rows, ids, total } = await getAmounts(professionalId, "pending");
    if (rows.length === 0)
        throw Object.assign(new Error("No pending balance available to request withdrawal"), { statusCode: 400 });

    await prisma.commissions.updateMany({ where: { id: { in: ids } }, data: { status: "requested" } });

    return { count: rows.length, total_amount: total };
};

// ── Step 2: Admin approves withdrawal (called from admin service) ──────────

exports.approveWithdrawal = async (professionalId) => {
    const { rows, ids, total } = await getAmounts(professionalId, "requested");
    if (rows.length === 0)
        throw Object.assign(new Error("No requested withdrawal found for this professional"), { statusCode: 404 });

    await prisma.commissions.updateMany({ where: { id: { in: ids } }, data: { status: "approved" } });

    // TODO: send push notification to professional — "Your withdrawal of ₹X is approved. Tap to withdraw."

    return { count: rows.length, total_amount: total };
};

// ── Step 3: Professional withdraws (Razorpay Payout triggered) ────────────

exports.withdrawNow = async (professionalId) => {
    const { rows, ids, total } = await getAmounts(professionalId, "approved");
    if (rows.length === 0)
        throw Object.assign(new Error("No approved balance to withdraw"), { statusCode: 400 });

    // Load professional UPI + Razorpay account info
    const professional = await prisma.professionals.findUnique({
        where:  { id: professionalId },
        select: {
            id:                       true,
            upi_id:                   true,
            bank_account_number:      true,
            bank_ifsc:                true,
            bank_account_name:        true,
            payout_method:            true,
            razorpay_contact_id:      true,
            razorpay_fund_account_id: true,
            users: { select: { full_name: true, mobile: true, email: true } },
        },
    });

    const method = professional?.payout_method;
    if (!method)
        throw Object.assign(new Error("Payout details not saved. Please add your UPI or bank details before withdrawing."), { statusCode: 400 });
    if (method === "upi" && !professional.upi_id)
        throw Object.assign(new Error("UPI ID missing. Please update your payout details."), { statusCode: 400 });
    if (method === "bank" && (!professional.bank_account_number || !professional.bank_ifsc || !professional.bank_account_name))
        throw Object.assign(new Error("Bank details incomplete. Please update your payout details."), { statusCode: 400 });

    // Ensure Razorpay contact + fund account (created once, reused)
    const { contactId, fundAccountId } = await payoutUtil.ensureFundAccount(professional);
    if (!professional.razorpay_fund_account_id)
        await commissionRepo.storeFundAccount(professionalId, contactId, fundAccountId);

    // Trigger Razorpay payout
    const payout = await payoutUtil.createPayout(fundAccountId, total, `fitnesta_${professionalId}_${Date.now()}`, professional.payout_method);

    // Move approved → requested (in-flight) and store payout_id
    await prisma.commissions.updateMany({ where: { id: { in: ids } }, data: { status: "requested" } });
    await commissionRepo.storePayout(professionalId, payout.id);

    // TODO: send push notification — "Transfer of ₹X is in progress"

    return { payout_id: payout.id, payout_status: payout.status, total_amount: total, count: rows.length };
};

// ── Save payout details ────────────────────────────────────────────────────

/**
 * Save UPI or bank details for a professional.
 * Clears cached Razorpay fund account so it gets recreated on next withdrawal.
 *
 * For UPI:  { payout_method: "upi",  upi_id: "name@upi" }
 * For bank: { payout_method: "bank", bank_account_name, bank_account_number, bank_ifsc }
 */
exports.savePayoutDetails = async (professionalId, body) => {
    const { payout_method } = body;

    if (!["upi", "bank"].includes(payout_method))
        throw Object.assign(new Error("payout_method must be 'upi' or 'bank'"), { statusCode: 400 });

    let data = { payout_method, razorpay_contact_id: null, razorpay_fund_account_id: null };

    if (payout_method === "upi") {
        if (!body.upi_id || !body.upi_id.includes("@"))
            throw Object.assign(new Error("Invalid UPI ID format"), { statusCode: 400 });
        data.upi_id = body.upi_id;
        // clear bank fields
        data.bank_account_number = null;
        data.bank_ifsc           = null;
        data.bank_account_name   = null;
    } else {
        if (!body.bank_account_name || !body.bank_account_number || !body.bank_ifsc)
            throw Object.assign(new Error("bank_account_name, bank_account_number and bank_ifsc are required"), { statusCode: 400 });
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(body.bank_ifsc))
            throw Object.assign(new Error("Invalid IFSC code format"), { statusCode: 400 });
        data.bank_account_name   = body.bank_account_name;
        data.bank_account_number = body.bank_account_number;
        data.bank_ifsc           = body.bank_ifsc;
        // clear UPI field
        data.upi_id = null;
    }

    await prisma.professionals.update({ where: { id: professionalId }, data });
};
