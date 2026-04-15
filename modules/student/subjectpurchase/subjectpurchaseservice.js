/**
 * Subject Purchase Service
 *
 * Allows a logged-in student (currently in activities — individual/group/school coaching)
 * to enroll into Personal Tutor for the first time, directly from their dashboard.
 *
 * Flow:
 *  GET  /standards                → list available standards (for the standard picker)
 *  GET  /subjects?standard=X      → list subjects + fee tiers for that standard
 *  POST /initiate                 → Phase 1: create Razorpay order + park in pending_registrations
 *  [Razorpay verify / webhook]    → Phase 2: finalizeRegistration creates personal_tutors row
 *
 * service_type stored in pending_registrations: "subject_purchase"
 */

const crypto         = require("crypto");
const prisma         = require("../../../config/prisma");
const repo           = require("./subjectpurchaserepo");
const activitiesRepo = require("../../activities/activitiesrepository");
const razorpay       = require("../../../utils/razorpay");
const paymentsRepo   = require("../../payments/paymentsrepo");
const commissionSvc  = require("../../commissions/commissionservice");

const SERVICE_TYPE = "subject_purchase";

// ── Lookup helpers ─────────────────────────────────────────────────────────

exports.getStandards = () => repo.getPersonalTutorStandards();

/**
 * Returns subjects available for a standard, grouped by activity.
 * Skips "All Subjects" — that is only available via the original registration flow.
 *
 * @param {string} standard  e.g. "3RD-4TH"
 */
exports.getSubjectsForStandard = async (standard) => {
    if (!standard) throw Object.assign(new Error("standard is required"), { status: 400 });

    const feeRows = await repo.getSubjectsForStandard(standard);

    const activityMap = {};
    for (const row of feeRows) {
        const { id, name } = row.activities;

        // "All Subjects" is only for fresh registration — hide it here
        if (/^All Subjects$/i.test(name)) continue;

        if (!activityMap[id]) {
            activityMap[id] = { activity_id: id, activity_name: name, standard, terms: [] };
        }
        activityMap[id].terms.push({
            term_months:       row.term_months,
            total_fee:         parseFloat(row.total_fee),
            effective_monthly: row.effective_monthly ? parseFloat(row.effective_monthly) : null,
        });
    }

    return Object.values(activityMap);
};

// ── Phase 1: Initiate ──────────────────────────────────────────────────────

/**
 * @param {number} userId   - from JWT
 * @param {object} body
 *   body.standard          - required  e.g. "3RD-4TH"
 *   body.activity_ids      - required  number[]  subjects being purchased
 *   body.term_months       - required  number
 *   body.preferred_time    - optional
 *   body.batch             - optional
 */
exports.initiateSubjectPurchase = async (userId, body) => {
    const { standard, activity_ids, term_months, preferred_time, batch } = body;

    if (!standard)     throw Object.assign(new Error("standard is required"), { status: 400 });
    if (!activity_ids || !Array.isArray(activity_ids) || activity_ids.length === 0) {
        throw Object.assign(new Error("activity_ids (array) is required"), { status: 400 });
    }
    if (!term_months)  throw Object.assign(new Error("term_months is required"), { status: 400 });

    // Verify student exists
    const student = await repo.getStudentByUserId(userId);
    if (!student) throw Object.assign(new Error("Student profile not found"), { status: 404 });

    // Block if they already have an active personal_tutors enrollment
    const existing = await repo.getActivePersonalTutor(student.id);
    if (existing) {
        throw Object.assign(
            new Error("You are already enrolled in an active personal tutor plan. Use 'Buy Subjects' to add more subjects."),
            { status: 409 }
        );
    }

    const ids = activity_ids.map((id) => parseInt(id));

    // Look up fees — personal_tutor fees use standard OR "ANY" (e.g. German is ANY)
    const feeRecords = await prisma.fee_structures.findMany({
        where: {
            activity_id:   { in: ids },
            coaching_type: "personal_tutor",
            term_months:   parseInt(term_months),
            standard:      { in: [standard, "ANY"].filter(Boolean) },
        },
        select: { activity_id: true, total_fee: true },
    });

    if (feeRecords.length === 0) {
        throw Object.assign(
            new Error("No fee found for the selected subjects at this standard and term. Check activity_ids and term_months."),
            { status: 400 }
        );
    }

    // Resolve activity names to store as teacher_for string
    const activityRecords = await activitiesRepo.getActivitiesByIds(ids);
    const teacherFor = activityRecords.map((a) => a.name).join(", ");

    const amount   = feeRecords.reduce((sum, r) => sum + parseFloat(r.total_fee), 0);
    const tempUuid = crypto.randomUUID();

    const order = await razorpay.createOrder(amount, tempUuid, {
        temp_uuid:    tempUuid,
        service_type: SERVICE_TYPE,
    });

    const formData = {
        student_user_id: userId,
        student_id:      student.id,
        activity_ids:    ids,
        standard,
        teacher_for:     teacherFor,
        term_months:     parseInt(term_months),
        preferred_time:  preferred_time || null,
        batch:           batch          || null,
        razorpay_order_id:  order.id,
        calculated_amount:  amount,
    };

    await repo.insertPendingRegistration(tempUuid, formData, SERVICE_TYPE);

    return {
        temp_uuid:         tempUuid,
        razorpay_order_id: order.id,
        amount,
        currency:          "INR",
        key_id:            process.env.RAZORPAY_KEY_ID,
    };
};

// ── Phase 2: Finalize ──────────────────────────────────────────────────────

exports.finalizeRegistration = async (tempUuid, razorpayPaymentId, amount) => {
    const pending = await repo.getPendingByUuid(tempUuid);
    if (!pending) throw new Error("Subject purchase record not found or already processed");

    const data = typeof pending.form_data === "string"
        ? JSON.parse(pending.form_data)
        : pending.form_data;

    const termMonths = data.term_months || 1;
    const userId     = data.student_user_id;
    const studentId  = data.student_id;

    await prisma.$transaction(async (tx) => {
        // Guard: check again inside transaction in case of race condition
        const alreadyActive = await tx.personal_tutors.findFirst({
            where:  { student_id: studentId, is_active: true },
            select: { id: true },
        });
        if (!alreadyActive) {
            await repo.insertPersonalTutor(tx, studentId, {
                standard:       data.standard,
                teacher_for:    data.teacher_for,
                batch:          data.batch,
                preferred_time: data.preferred_time,
            }, termMonths);
        }
    });

    await repo.updatePendingStatus(pending.id, "approved");

    await paymentsRepo.recordPayment({
        tempUuid,
        razorpayOrderId:   data.razorpay_order_id,
        razorpayPaymentId,
        serviceType:       SERVICE_TYPE,
        amount,
        termMonths,
        studentUserId:     userId,
    });

    // Fire ME admission commission — same path as personal_tutor registration
    // commissionService expects formData.tutorDetails.society_id for PT
    // Subject purchase is direct (no society) so ME commission won't fire — that's correct,
    // there is no ME who brought this student in via society for a self-serve purchase.

    return { userId, success: true };
};

// ── DEV only ───────────────────────────────────────────────────────────────

exports.devFinalize = async (tempUuid) => {
    const pending = await paymentsRepo.getPendingRegistration(tempUuid);
    if (!pending) throw new Error("Pending record not found");
    if (pending.status === "approved") return { alreadyPaid: true };
    await exports.finalizeRegistration(tempUuid, `dev_pay_${Date.now()}`, 0);
    return { alreadyPaid: false };
};
