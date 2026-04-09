/**
 * Activity Purchase Service
 *
 * Allows an already-logged-in student to buy additional sport activities.
 *
 * Three coaching types supported:
 *  - activity_purchase_individual  → individual_coaching fees, society name is free-text
 *  - activity_purchase_group       → group_coaching fees, society selected from dropdown (society_category resolved)
 *  - activity_purchase_school      → school_student fees, school selected from dropdown
 *
 * Two-phase flow (same pattern as every other service):
 *  Phase 1: initiateActivityPurchase  → park in pending_registrations + create Razorpay order
 *  Phase 2: finalizeRegistration      → called by paymentscontroller on verify/webhook
 */

const crypto          = require("crypto");
const prisma          = require("../../../config/prisma");
const repo            = require("./activitypurchaserepo");
const activitiesRepo  = require("../../activities/activitiesrepository");
const razorpay        = require("../../../utils/razorpay");
const paymentsRepo    = require("../../payments/paymentsrepo");
const commissionSvc   = require("../../commissions/commissionservice");

// Map our service_type strings to fee_structures.coaching_type values
const COACHING_TYPE_MAP = {
    activity_purchase_individual: "individual_coaching",
    activity_purchase_group:      "group_coaching",
    activity_purchase_school:     "school_student",
};

// ── Lookup helpers (called by controller for dropdowns / fee preview) ─────

exports.getApprovedSocieties = () => repo.getApprovedSocieties();
exports.getApprovedSchools   = () => repo.getApprovedSchools();

/**
 * Returns activities + fee options for the given purchase type.
 *
 * Query params:
 *  type        = "individual" | "group" | "school"
 *  society_id  = (required for group)
 *  school_id   = (required for school — unused for fee lookup but validated)
 *  term_months = optional filter; omit to return all term options
 */
exports.getAvailableActivities = async ({ type, society_id, school_id, term_months }) => {
    if (!type) throw Object.assign(new Error("type is required"), { status: 400 });

    const serviceType = `activity_purchase_${type}`;
    const coachingType = COACHING_TYPE_MAP[serviceType];
    if (!coachingType) throw Object.assign(new Error("Invalid type. Must be individual, group, or school"), { status: 400 });

    let societyCategory = null;

    if (type === "group") {
        if (!society_id) throw Object.assign(new Error("society_id is required for group type"), { status: 400 });
        const society = await repo.getSocietyById(parseInt(society_id));
        if (!society) throw Object.assign(new Error("Society not found"), { status: 404 });
        societyCategory = society.society_category;
    }

    if (type === "school") {
        if (!school_id) throw Object.assign(new Error("school_id is required for school type"), { status: 400 });
        const school = await repo.getSchoolById(parseInt(school_id));
        if (!school) throw Object.assign(new Error("School not found"), { status: 404 });
    }

    const activities = await activitiesRepo.getActivitiesByCoachingType(
        coachingType,
        societyCategory,
        null,  // standard — not applicable here
        term_months ? parseInt(term_months) : null
    );

    return activities;
};

// ── Phase 1: Initiate ──────────────────────────────────────────────────────

/**
 * @param {number} userId        - from JWT (logged-in student)
 * @param {object} body          - request body from Flutter
 *   body.type                   - "individual" | "group" | "school"
 *   body.activity_ids           - number[]
 *   body.term_months            - number
 *   body.society_id             - required for group
 *   body.society_name           - free-text for individual, auto-filled for group
 *   body.school_id              - required for school
 *   body.flat_no                - optional
 *   body.preferred_batch        - optional
 *   body.student_name           - optional (school only)
 *   body.standard               - optional (school only)
 *   body.kit_type               - optional
 */
exports.initiateActivityPurchase = async (userId, body) => {
    const { type, activity_ids, term_months } = body;

    if (!type) throw Object.assign(new Error("type is required (individual | group | school)"), { status: 400 });
    if (!activity_ids || !Array.isArray(activity_ids) || activity_ids.length === 0) {
        throw Object.assign(new Error("activity_ids (array) is required"), { status: 400 });
    }
    if (!term_months) throw Object.assign(new Error("term_months is required"), { status: 400 });

    const serviceType  = `activity_purchase_${type}`;
    const coachingType = COACHING_TYPE_MAP[serviceType];
    if (!coachingType) throw Object.assign(new Error("Invalid type. Must be individual, group, or school"), { status: 400 });

    // Verify student exists
    const student = await repo.getStudentByUserId(userId);
    if (!student) throw Object.assign(new Error("Student profile not found"), { status: 404 });

    let societyCategory = null;
    let societyId       = null;
    let schoolId        = null;

    if (type === "group") {
        if (!body.society_id) throw Object.assign(new Error("society_id is required for group type"), { status: 400 });
        societyId = parseInt(body.society_id);
        const society = await repo.getSocietyById(societyId);
        if (!society) throw Object.assign(new Error("Society not found"), { status: 404 });
        societyCategory = society.society_category;
    }

    if (type === "school") {
        if (!body.school_id) throw Object.assign(new Error("school_id is required for school type"), { status: 400 });
        schoolId = parseInt(body.school_id);
        const school = await repo.getSchoolById(schoolId);
        if (!school) throw Object.assign(new Error("School not found"), { status: 404 });
    }

    // Look up fees
    const ids = activity_ids.map((id) => parseInt(id));
    const feeRecords = await activitiesRepo.getFeesForActivities(
        ids,
        coachingType,
        parseInt(term_months),
        societyCategory ?? undefined
    );

    if (feeRecords.length === 0) {
        throw Object.assign(
            new Error("No fee structure found for the selected activities and term. Check activity_ids and term_months."),
            { status: 400 }
        );
    }

    const amount   = feeRecords.reduce((sum, r) => sum + parseFloat(r.total_fee), 0);
    const tempUuid = crypto.randomUUID();

    const order = await razorpay.createOrder(amount, tempUuid, {
        temp_uuid:    tempUuid,
        service_type: serviceType,
    });

    // Park everything
    const formData = {
        student_user_id: userId,
        student_id:      student.id,
        type,
        activity_ids:    ids,
        term_months:     parseInt(term_months),
        society_id:      societyId,
        society_name:    body.society_name     || null,
        school_id:       schoolId,
        flat_no:         body.flat_no          || null,
        preferred_batch: body.preferred_batch  || null,
        student_name:    body.student_name     || null,
        standard:        body.standard         || null,
        kit_type:        body.kit_type         || null,
        razorpay_order_id:  order.id,
        calculated_amount:  amount,
    };

    await repo.insertPendingRegistration(tempUuid, formData, serviceType);

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
    if (!pending) throw new Error("Activity purchase record not found or already processed");

    const data = typeof pending.form_data === "string"
        ? JSON.parse(pending.form_data)
        : pending.form_data;

    const serviceType  = pending.service_type;               // activity_purchase_individual/group/school
    const coachingType = COACHING_TYPE_MAP[serviceType];
    const termMonths   = data.term_months || 1;
    const userId       = data.student_user_id;
    const studentId    = data.student_id;

    // Resolve activity names for the activity label field
    const activityRecords = await activitiesRepo.getActivitiesByIds(data.activity_ids);
    const activityLabel   = activityRecords.map((a) => a.name).join(", ");

    await prisma.$transaction(async (tx) => {
        if (coachingType === "individual_coaching" || coachingType === "group_coaching") {
            await repo.insertIndividualParticipant(tx, studentId, {
                flat_no:         data.flat_no,
                society_id:      data.society_id,
                society_name:    data.society_name,
                preferred_batch: data.preferred_batch,
                kit_type:        data.kit_type,
                activity_label:  activityLabel,
            }, termMonths);
        } else if (coachingType === "school_student") {
            await repo.insertSchoolParticipant(tx, studentId, data.school_id, {
                student_name:   data.student_name,
                standard:       data.standard,
                activity_label: activityLabel,
            });
        }
    });

    await repo.updatePendingStatus(pending.id, "approved");

    await paymentsRepo.recordPayment({
        tempUuid,
        razorpayOrderId:   data.razorpay_order_id,
        razorpayPaymentId,
        serviceType,
        amount,
        termMonths,
        studentUserId:     userId,
    });

    // ME commission — build a formData shape that commissionService understands
    const commissionFormData = {
        individualcoaching: { society_id: data.society_id },
        school_id:          data.school_id,
    };
    await commissionSvc.calculateMEAdmissionCommission(
        coachingType,   // pass the fee_structures coaching_type string
        commissionFormData,
        userId,
        amount
    );

    // Auto-assign to group batch if applicable
    if (coachingType === "group_coaching" && data.society_id) {
        for (const activityId of data.activity_ids) {
            try {
                const batch = await repo.findAvailableBatch(data.society_id, activityId);
                if (!batch) continue;
                await repo.assignStudentToBatch(batch.id, studentId);
                await repo.addStudentToFutureSessions(batch.id, studentId);
            } catch (err) {
                console.error(`[ActivityPurchase] batch assign failed for activity ${activityId}:`, err.message);
            }
        }
    }

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
