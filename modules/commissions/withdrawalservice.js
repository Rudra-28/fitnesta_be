/**
 * Shared withdrawal logic for all professional types.
 * Called from each dashboard service with the resolved professionalId.
 *
 * Flow:
 *  1. Fetch all approved commissions → bail if none
 *  2. Ensure professional has UPI saved
 *  3. Ensure Razorpay contact + fund account exist (create once, reuse)
 *  4. Trigger Razorpay payout
 *  5. Move commissions approved → requested, store payout_id on wallet
 */

const prisma         = require("../../config/prisma");
const commissionRepo = require("./commissionrepo");
const payoutUtil     = require("../../utils/razorpaypayout");

exports.requestWithdrawal = async (professionalId) => {
    // 1. Check approved balance
    const approved = await prisma.commissions.findMany({
        where:  { professional_id: professionalId, status: "approved" },
        select: { id: true, commission_amount: true },
    });

    if (approved.length === 0)
        throw Object.assign(new Error("No approved balance available for withdrawal"), { statusCode: 400 });

    const totalAmount = parseFloat(
        approved.reduce((sum, c) => sum + parseFloat(c.commission_amount), 0).toFixed(2)
    );

    // 2. Load professional with UPI + user info
    const professional = await prisma.professionals.findUnique({
        where:  { id: professionalId },
        select: {
            id:                       true,
            upi_id:                   true,
            razorpay_contact_id:      true,
            razorpay_fund_account_id: true,
            users: { select: { full_name: true, mobile: true, email: true } },
        },
    });

    if (!professional?.upi_id)
        throw Object.assign(new Error("UPI ID not saved. Please add your UPI ID before withdrawing."), { statusCode: 400 });

    // 3. Ensure Razorpay contact + fund account (creates once, reuses after)
    const { contactId, fundAccountId } = await payoutUtil.ensureFundAccount(professional);

    if (!professional.razorpay_fund_account_id) {
        await commissionRepo.storeFundAccount(professionalId, contactId, fundAccountId);
    }

    // 4. Trigger Razorpay payout
    const referenceId = `fitnesta_${professionalId}_${Date.now()}`;
    const payout      = await payoutUtil.createPayout(fundAccountId, totalAmount, referenceId);

    // 5. Move commissions to requested + store payout_id
    const ids = approved.map((c) => c.id);
    await prisma.$transaction(async (tx) => {
        await tx.commissions.updateMany({
            where: { id: { in: ids } },
            data:  { status: "requested" },
        });
    });
    await commissionRepo.storePayout(professionalId, payout.id);

    return {
        payout_id:    payout.id,
        payout_status: payout.status,
        total_amount: totalAmount,
        count:        approved.length,
    };
};

/** Save or update UPI ID for a professional. */
exports.saveUpiId = async (professionalId, upiId) => {
    if (!upiId || !upiId.includes("@"))
        throw Object.assign(new Error("Invalid UPI ID format"), { statusCode: 400 });

    // If UPI changed, clear stored fund account so it gets recreated on next withdrawal
    await prisma.professionals.update({
        where: { id: professionalId },
        data:  {
            upi_id:                   upiId,
            razorpay_contact_id:      null,
            razorpay_fund_account_id: null,
        },
    });
};
