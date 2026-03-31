const prisma = require("../../config/prisma");

// ── Approved professionals list ───────────────────────────────────────────

exports.getApprovedProfessionals = async (type) => {
    return await prisma.professionals.findMany({
        where: {
            ...(type && { profession_type: type }),
            users: { approval_status: "approved" },
        },
        select: {
            id: true,
            profession_type: true,
            referral_code: true,
            place: true,
            date: true,
            own_two_wheeler: true,
            communication_languages: true,
            pan_card: true,
            adhar_card: true,
            relative_name: true,
            relative_contact: true,
            users: {
                select: {
                    id: true,
                    full_name: true,
                    mobile: true,
                    email: true,
                    address: true,
                    photo: true,
                    created_at: true,
                },
            },
            trainers: {
                select: {
                    player_level: true,
                    category: true,
                    specified_game: true,
                    specified_skills: true,
                    experience_details: true,
                    qualification_docs: true,
                    documents: true,
                },
            },
            teachers: {
                select: {
                    subject: true,
                    experience_details: true,
                    ded_doc: true,
                    bed_doc: true,
                    other_doc: true,
                },
            },
            marketing_executives: {
                select: {
                    dob: true,
                    education_qualification: true,
                    previous_experience: true,
                    activity_agreement_pdf: true,
                },
            },
            vendors: {
                select: {
                    store_name: true,
                    store_address: true,
                    store_location: true,
                    gst_certificate: true,
                },
            },
            wallets: {
                select: { balance: true },
            },
        },
        orderBy: { id: "desc" },
    });
};

// ── Unassigned students ────────────────────────────────────────────────────

exports.getUnassignedPersonalTutors = async () => {
    return await prisma.personal_tutors.findMany({
        where: { teacher_professional_id: null },
        select: {
            id: true,
            standard: true,
            batch: true,
            teacher_for: true,
            dob: true,
            students: {
                select: {
                    id: true,
                    users: { select: { full_name: true, mobile: true } },
                },
            },
        },
        orderBy: { id: "desc" },
    });
};

exports.getUnassignedIndividualParticipants = async () => {
    return await prisma.individual_participants.findMany({
        where: { trainer_professional_id: null },
        select: {
            id: true,
            activity: true,
            flat_no: true,
            society_name: true,
            dob: true,
            students: {
                select: {
                    id: true,
                    users: { select: { full_name: true, mobile: true } },
                },
            },
        },
        orderBy: { id: "desc" },
    });
};

// ── Available professionals ────────────────────────────────────────────────

exports.getAvailableTeachers = async () => {
    return await prisma.professionals.findMany({
        where: {
            profession_type: "teacher",
            users: { approval_status: "approved" },
        },
        select: {
            id: true,
            users: { select: { full_name: true, mobile: true } },
            teachers: { select: { subject: true, experience_details: true } },
        },
    });
};

exports.getAvailableTrainers = async () => {
    return await prisma.professionals.findMany({
        where: {
            profession_type: "trainer",
            users: { approval_status: "approved" },
        },
        select: {
            id: true,
            users: { select: { full_name: true, mobile: true } },
            trainers: { select: { category: true, specified_game: true, experience_details: true } },
        },
    });
};

// ── Assign professional ────────────────────────────────────────────────────

exports.assignTeacherToStudent = async (personalTutorId, teacherProfessionalId) => {
    return await prisma.personal_tutors.update({
        where: { id: personalTutorId },
        data: { teacher_professional_id: teacherProfessionalId },
    });
};

exports.assignTrainerToStudent = async (individualParticipantId, trainerProfessionalId) => {
    return await prisma.individual_participants.update({
        where: { id: individualParticipantId },
        data: { trainer_professional_id: trainerProfessionalId },
    });
};

// ── Validation helpers ─────────────────────────────────────────────────────

exports.findPersonalTutorById = async (id) => {
    return await prisma.personal_tutors.findUnique({ where: { id } });
};

exports.findIndividualParticipantById = async (id) => {
    return await prisma.individual_participants.findUnique({ where: { id } });
};

exports.findProfessionalById = async (id, type) => {
    return await prisma.professionals.findFirst({
        where: { id, profession_type: type },
        select: { id: true, profession_type: true },
    });
};

exports.getAllPending = async (serviceType) => {
    return await prisma.pending_registrations.findMany({
        where: {
            status: "pending",
            ...(serviceType && { service_type: serviceType }),
        },
        select: {
            id: true,
            temp_uuid: true,
            service_type: true,
            form_data: true,
            created_at: true,
        },
        orderBy: { created_at: "desc" },
    });
};

exports.getById = async (id) => {
    return await prisma.pending_registrations.findFirst({
        where: { id: Number(id) },
    });
};

// ── Commission rules ───────────────────────────────────────────────────────

exports.getAllCommissionRules = async () => {
    return await prisma.commission_rules.findMany({ orderBy: [{ professional_type: "asc" }, { rule_key: "asc" }] });
};

exports.getCommissionRuleByKey = async (ruleKey) => {
    return await prisma.commission_rules.findUnique({ where: { rule_key: ruleKey } });
};

exports.updateCommissionRule = async (ruleKey, newValue) => {
    return await prisma.commission_rules.update({
        where: { rule_key: ruleKey },
        data:  { value: newValue, updated_at: new Date() },
    });
};

// ── Commissions ────────────────────────────────────────────────────────────

exports.listCommissions = async ({ professionalType, status, professionalId } = {}) => {
    return await prisma.commissions.findMany({
        where: {
            ...(professionalType && { professional_type: professionalType }),
            ...(status           && { status }),
            ...(professionalId   && { professional_id: Number(professionalId) }),
        },
        include: {
            professionals: {
                select: {
                    id:    true,
                    users: { select: { full_name: true, mobile: true } },
                },
            },
        },
        orderBy: { created_at: "desc" },
    });
};

exports.getCommissionById = async (id) => {
    return await prisma.commissions.findUnique({ where: { id: Number(id) } });
};

exports.markCommissionPaid = async (id) => {
    return await prisma.commissions.update({
        where: { id: Number(id) },
        data:  { status: "paid" },
    });
};

// ── Travelling allowances ──────────────────────────────────────────────────

exports.listTravellingAllowances = async ({ trainerProfessionalId, status } = {}) => {
    return await prisma.travelling_allowances.findMany({
        where: {
            ...(trainerProfessionalId && { trainer_professional_id: Number(trainerProfessionalId) }),
            ...(status                && { status }),
        },
        include: {
            professionals: {
                select: {
                    id:    true,
                    users: { select: { full_name: true, mobile: true } },
                },
            },
        },
        orderBy: { allowance_date: "desc" },
    });
};

exports.getTravellingAllowanceById = async (id) => {
    return await prisma.travelling_allowances.findUnique({ where: { id: Number(id) } });
};

exports.markTravellingAllowancePaid = async (id) => {
    return await prisma.travelling_allowances.update({
        where: { id: Number(id) },
        data:  { status: "paid", updated_at: new Date() },
    });
};

// ── Mark reviewed ──────────────────────────────────────────────────────────

// tx is a Prisma transaction client when called inside $transaction,
// or null when called outside (rejection path) — falls back to prisma directly.
exports.markReviewed = async (tx, id, status, reviewedBy, note) => {
    const client = tx ?? prisma;
    await client.pending_registrations.update({
        where: { id: Number(id) },
        data: {
            status,
            reviewed_by: reviewedBy,
            review_note: note ?? null,
            reviewed_at: new Date(),
        },
    });
};
