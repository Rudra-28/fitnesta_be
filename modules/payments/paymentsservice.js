const paymentsRepo    = require("./paymentsrepo");
const activitiesRepo  = require("../activities/activitiesrepository");

/**
 * Shape a raw payment+form_data row into a clean receipt object.
 */
async function buildReceipt(row) {
    const formData = typeof row.form_data === "string"
        ? JSON.parse(row.form_data)
        : row.form_data;

    const userInfo    = formData?.user_info || {};
    const activityIds = (formData?.payment?.activity_ids || []).map(Number);

    // Resolve society_category for group_coaching (needed to match correct fee row)
    let societyCategory = null;
    if (row.service_type === "group_coaching") {
        const societyId = formData?.individualcoaching?.society_id;
        if (societyId) {
            const prisma = require("../../config/prisma");
            const society = await prisma.societies.findUnique({
                where: { id: parseInt(societyId) },
                select: { society_category: true },
            });
            societyCategory = society?.society_category ?? null;
        }
    }

    // Resolve standard for personal_tutor / school_student
    const standard = formData?.payment?.standard ?? formData?.personaltutor?.standard ?? null;

    // Fetch activity names + per-activity fees in parallel
    const [activities, feeRecords] = await Promise.all([
        activitiesRepo.getActivitiesByIds(activityIds),
        activityIds.length > 0
            ? activitiesRepo.getFeesForActivities(
                activityIds,
                row.service_type,
                Number(row.term_months),
                societyCategory,
                standard
              )
            : [],
    ]);

    const feeMap = {};
    for (const f of feeRecords) feeMap[f.activity_id] = parseFloat(f.total_fee);

    const activityLines = activities.map((a) => ({
        id:   a.id,
        name: a.name,
        fee:  feeMap[a.id] ?? null,
    }));

    return {
        temp_uuid:            row.temp_uuid,
        razorpay_payment_id:  row.razorpay_payment_id,
        service_type:         row.service_type,
        amount:               parseFloat(row.amount),
        term_months:          Number(row.term_months),
        paid_at:              row.paid_at,
        student: {
            name:  userInfo.fullName  || userInfo.name  || null,
            email: userInfo.email                       || null,
            phone: userInfo.contactNumber || userInfo.phone || null,
        },
        activities: activityLines,
    };
}

/**
 * Get a single receipt. Throws 404 if not found or not owned by the student.
 */
exports.getReceipt = async (tempUuid, studentUserId) => {
    const row = await paymentsRepo.getReceiptData(tempUuid, studentUserId);
    if (!row) {
        const err = new Error("Receipt not found");
        err.status = 404;
        throw err;
    }
    return buildReceipt(row);
};

/**
 * List all receipts for a student (summary — no per-activity breakdown).
 */
exports.listReceipts = async (studentUserId) => {
    const rows = await paymentsRepo.getStudentReceipts(studentUserId);
    return Promise.all(rows.map(buildReceipt));
};
