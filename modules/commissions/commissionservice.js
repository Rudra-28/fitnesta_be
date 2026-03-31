/**
 * Commission Service
 *
 * Contains all commission calculation logic. Each function is called from a specific
 * trigger point in the application flow:
 *
 *  calculateMEAdmissionCommission   → called from finalizeRegistration (after payment)
 *  calculateTrainerCommission       → called from adminService.assignTrainer
 *  calculateTeacherCommission       → called from adminService.assignTeacher
 *  calculateMEOnboardingCommission  → called from adminService.approveRegistration (society/school)
 *  upsertTravellingAllowance        → called when a trainer batch is recorded
 *
 * All functions are fire-and-forget safe — errors are logged but never thrown to callers,
 * so a commission failure never breaks the primary registration or approval flow.
 */

const prisma = require("../../config/prisma");
const repo   = require("./commissionrepo");

// ── ME Admission Commission ────────────────────────────────────────────────

/**
 * Calculate and record the ME's admission commission after a student payment is finalized.
 *
 * Eligibility:
 *  - society_id must be present in form data (student chose from dropdown, not typed manually)
 *  - The platform must have at least `me_min_live_activities` globally active activities
 *  - The society must have a linked ME (me_professional_id)
 *
 * Commission rates (from commission_rules):
 *  - group_coaching:      5%  (me_group_admission_rate)
 *  - individual_coaching: 2%  (me_personal_coaching_admission_rate)
 *  - personal_tutor:      2%  (me_personal_tutor_admission_rate)
 *  - school_student:      no commission
 *
 * @param {string} serviceType   — 'individual_coaching' | 'group_coaching' | 'personal_tutor' | 'school_student'
 * @param {object} formData      — raw form_data from the pending registration
 * @param {number} studentUserId — users.id of the newly created student (used as sourceId)
 * @param {number} amount        — payment amount in INR
 */
exports.calculateMEAdmissionCommission = async (serviceType, formData, studentUserId, amount) => {
    try {
        // School student admissions never generate a per-student ME commission
        if (serviceType === "school_student") return;

        // Extract society_id from form data — path varies by service type
        // individual_coaching / group_coaching: formData.individualcoaching.society_id
        // personal_tutor:                       formData.tutorDetails.society_id (or root level)
        let societyId = null;
        if (serviceType === "individual_coaching" || serviceType === "group_coaching") {
            societyId = formData.individualcoaching?.society_id ?? null;
        } else if (serviceType === "personal_tutor") {
            societyId = formData.tutorDetails?.society_id
                     ?? formData.society_id
                     ?? null;
        }

        // No registered society selected → ME gets no commission
        if (!societyId) return;

        const rules = await repo.getAllRules();

        // Check ME eligibility: need at least `me_min_live_activities` active activities
        const minActivities    = parseFloat(rules.me_min_live_activities?.value ?? 2);
        const activeActivities = await repo.countGlobalActiveActivities();
        if (activeActivities < minActivities) return;

        // Look up the ME linked to this society
        const society = await repo.getSocietyById(parseInt(societyId));
        if (!society?.me_professional_id) return;

        // Pick the right rule key for this service type
        const ruleKeyMap = {
            group_coaching:      "me_group_admission_rate",
            individual_coaching: "me_personal_coaching_admission_rate",
            personal_tutor:      "me_personal_tutor_admission_rate",
        };
        const rule = rules[ruleKeyMap[serviceType]];
        if (!rule) return;

        const rate             = parseFloat(rule.value);
        const commissionAmount = parseFloat(((amount * rate) / 100).toFixed(2));

        // Map to commissions table source_type
        const sourceTypeMap = {
            group_coaching:      "group_coaching_society",
            individual_coaching: "individual_coaching",
            personal_tutor:      "personal_tutor",
        };

        await repo.recordCommission({
            professionalId:   society.me_professional_id,
            professionalType: "marketing_executive",
            sourceType:       sourceTypeMap[serviceType],
            sourceId:         studentUserId,
            baseAmount:       amount,
            commissionRate:   rate,
            commissionAmount,
        });
    } catch (err) {
        // Commission failure must never break the registration flow
        console.error("[CommissionService] calculateMEAdmissionCommission error:", err.message);
    }
};

// ── Trainer Commission ─────────────────────────────────────────────────────

/**
 * Calculate and record the trainer's commission when admin assigns them to a student.
 *
 * Rules:
 *  - individual_coaching:             80% of fee (trainer_personal_coaching_rate)
 *  - group_coaching in society
 *      10+ students per session:      50% of fee (trainer_group_society_rate)
 *      < 10 students per session:     ₹300 flat  (trainer_group_society_flat_amount)
 *
 * Note: Group coaching at schools (trainer_group_school_rate = 45%) is handled
 * separately when a school trainer assignment endpoint is added, because school_students
 * are in a different table and don't go through individual_participants.
 *
 * @param {number} individualParticipantId
 * @param {number} trainerProfessionalId
 */
exports.calculateTrainerCommission = async (individualParticipantId, trainerProfessionalId) => {
    try {
        const rules = await repo.getAllRules();
        const ip    = await repo.getIndividualParticipantWithStudent(individualParticipantId);
        if (!ip) return;

        const studentType   = ip.students?.student_type;
        const studentUserId = ip.students?.user_id;
        if (!studentUserId) return;

        // Look up the payment for this student
        const serviceType = studentType === "group_coaching" ? "group_coaching" : "individual_coaching";
        const payment     = await repo.getPaymentForStudent(studentUserId, serviceType);
        if (!payment) return;

        const paymentAmount = parseFloat(payment.amount);
        let commissionRate;
        let commissionAmount;
        let sourceType;

        if (studentType === "individual_coaching") {
            // ── Personal game coaching — 80% ────────────────────────────────
            commissionRate   = parseFloat(rules.trainer_personal_coaching_rate?.value ?? 80);
            commissionAmount = parseFloat(((paymentAmount * commissionRate) / 100).toFixed(2));
            sourceType       = "individual_coaching";

        } else if (studentType === "group_coaching" && ip.society_id) {
            // ── Group coaching in a society ──────────────────────────────────
            sourceType = "group_coaching_society";

            const minStudents  = parseFloat(rules.trainer_group_society_min_students?.value ?? 10);
            const studentCount = await repo.countSocietyStudentsForActivity(ip.society_id, ip.activity);

            if (studentCount < minStudents) {
                // Special case: fewer than 10 students → flat ₹300 per session
                // We record the flat amount; session-level granularity is tracked via trainer_batches
                commissionRate   = 0;
                commissionAmount = parseFloat(rules.trainer_group_society_flat_amount?.value ?? 300);
            } else {
                commissionRate   = parseFloat(rules.trainer_group_society_rate?.value ?? 50);
                commissionAmount = parseFloat(((paymentAmount * commissionRate) / 100).toFixed(2));
            }

        } else {
            // group_coaching without a society_id should not reach here
            return;
        }

        await repo.recordCommission({
            professionalId:   trainerProfessionalId,
            professionalType: "trainer",
            sourceType,
            sourceId:         individualParticipantId,
            baseAmount:       paymentAmount,
            commissionRate,
            commissionAmount,
        });
    } catch (err) {
        console.error("[CommissionService] calculateTrainerCommission error:", err.message);
    }
};

// ── Teacher Commission ─────────────────────────────────────────────────────

/**
 * Calculate and record the teacher's commission when admin assigns them to a personal tutor student.
 *
 * Rule: teacher earns 80% of the fee (teacher_personal_tutor_rate).
 *
 * @param {number} personalTutorId
 * @param {number} teacherProfessionalId
 */
exports.calculateTeacherCommission = async (personalTutorId, teacherProfessionalId) => {
    try {
        const rules = await repo.getAllRules();
        const pt    = await repo.getPersonalTutorWithStudent(personalTutorId);
        if (!pt) return;

        const studentUserId = pt.students?.user_id;
        if (!studentUserId) return;

        const payment = await repo.getPaymentForStudent(studentUserId, "personal_tutor");
        if (!payment) return;

        const paymentAmount  = parseFloat(payment.amount);
        const commissionRate = parseFloat(rules.teacher_personal_tutor_rate?.value ?? 80);
        const commissionAmount = parseFloat(((paymentAmount * commissionRate) / 100).toFixed(2));

        await repo.recordCommission({
            professionalId:   teacherProfessionalId,
            professionalType: "teacher",
            sourceType:       "personal_tutor",
            sourceId:         personalTutorId,
            baseAmount:       paymentAmount,
            commissionRate,
            commissionAmount,
        });
    } catch (err) {
        console.error("[CommissionService] calculateTeacherCommission error:", err.message);
    }
};

// ── ME Onboarding Commission ───────────────────────────────────────────────

/**
 * Calculate and record the ME's one-time onboarding commission when a society or school
 * is approved by admin.
 *
 * Eligibility:
 *  - A ME must be linked to the society/school (me_professional_id)
 *  - The platform must have at least `me_min_live_activities` globally active activities
 *
 * Society commission (based on no_of_flats):
 *  - > 100 flats:  ₹1111  (me_society_above_100_flats)
 *  - 50–100 flats: ₹500   (me_society_50_to_100_flats)
 *  - < 50 flats:   ₹300   (me_society_below_50_flats)
 *
 * School commission:
 *  - ₹1111 flat   (me_school_registration) — regardless of size
 *
 * @param {'society' | 'school'} entityType
 * @param {object}               entity      — the society or school DB record
 */
exports.calculateMEOnboardingCommission = async (entityType, entity) => {
    try {
        if (!entity.me_professional_id) return;

        const rules = await repo.getAllRules();

        // ME is only eligible if the platform has at least the minimum live activities
        const minActivities    = parseFloat(rules.me_min_live_activities?.value ?? 2);
        const activeActivities = await repo.countGlobalActiveActivities();
        if (activeActivities < minActivities) return;

        let commissionAmount;
        let sourceType;

        if (entityType === "society") {
            sourceType = "group_coaching_society";
            const noOfFlats = entity.no_of_flats ?? 0;

            if (noOfFlats > 100) {
                commissionAmount = parseFloat(rules.me_society_above_100_flats?.value ?? 1111);
            } else if (noOfFlats >= 50) {
                commissionAmount = parseFloat(rules.me_society_50_to_100_flats?.value ?? 500);
            } else {
                commissionAmount = parseFloat(rules.me_society_below_50_flats?.value ?? 300);
            }

        } else if (entityType === "school") {
            sourceType       = "school_registration";
            commissionAmount = parseFloat(rules.me_school_registration?.value ?? 1111);

        } else {
            return;
        }

        await repo.recordCommission({
            professionalId:   entity.me_professional_id,
            professionalType: "marketing_executive",
            sourceType,
            sourceId:         entity.id,
            baseAmount:       0,   // flat commissions have no percentage base
            commissionRate:   0,
            commissionAmount,
        });
    } catch (err) {
        console.error("[CommissionService] calculateMEOnboardingCommission error:", err.message);
    }
};

// ── Trainer Travelling Allowance ───────────────────────────────────────────

/**
 * Upsert a trainer's daily travelling allowance based on the number of group batches
 * they conducted on a given date.
 *
 * Call this every time a trainer_batch record is created or deleted for that trainer+date.
 * It will recalculate the correct amount and update the TA record accordingly.
 *
 * Rules (from commission_rules):
 *  - 1 batch in the day:    ₹50   (ta_1_batch_amount)
 *  - 2+ batches in the day: ₹100  (ta_2_plus_batches_amount)  — flat cap, no matter how many
 *
 * @param {number}      trainerProfessionalId
 * @param {Date|string} date  — the batch date (time component is ignored)
 */
exports.upsertTravellingAllowance = async (trainerProfessionalId, date) => {
    try {
        const rules    = await repo.getAllRules();
        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);

        const batchCount = await prisma.trainer_batches.count({
            where: {
                trainer_professional_id: trainerProfessionalId,
                batch_date:              dateOnly,
            },
        });

        if (batchCount === 0) return;

        const amount = batchCount === 1
            ? parseFloat(rules.ta_1_batch_amount?.value       ?? 50)
            : parseFloat(rules.ta_2_plus_batches_amount?.value ?? 100);

        await prisma.travelling_allowances.upsert({
            where: {
                // Prisma-generated name for the compound unique (trainer_professional_id, allowance_date)
                trainer_professional_id_allowance_date: {
                    trainer_professional_id: trainerProfessionalId,
                    allowance_date:          dateOnly,
                },
            },
            create: {
                trainer_professional_id: trainerProfessionalId,
                allowance_date:          dateOnly,
                batches_count:           batchCount,
                amount,
                status:                  "pending",
            },
            update: {
                batches_count: batchCount,
                amount,
                updated_at:    new Date(),
            },
        });
    } catch (err) {
        console.error("[CommissionService] upsertTravellingAllowance error:", err.message);
    }
};
