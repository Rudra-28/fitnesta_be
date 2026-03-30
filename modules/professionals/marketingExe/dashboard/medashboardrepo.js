const prisma = require("../../../../config/prisma");

// ── Bool normalizers ──────────────────────────────────────────────────────────
// Prisma returns Boolean columns as true/false; Flutter models expect 0/1.
const normSchool = (s) => ({
    ...s,
    agreement_signed_by_authority: s.agreement_signed_by_authority ? 1 : 0,
});

const normSociety = (s) => ({
    ...s,
    playground_available:          s.playground_available          ? 1 : 0,
    agreement_signed_by_authority: s.agreement_signed_by_authority ? 1 : 0,
});

// ── Shared ────────────────────────────────────────────────────────────────────
exports.findProfessionalByUserId = async (userId) => {
    return await prisma.professionals.findFirst({
        where: { user_id: userId },
        select: { id: true, referral_code: true },
    });
};

// ── Society ───────────────────────────────────────────────────────────────────
exports.societyUniqueIdExists = async (societyUniqueId) => {
    const row = await prisma.societies.findFirst({
        where: { society_unique_id: societyUniqueId },
        select: { id: true },
    });
    return !!row;
};

exports.insertSociety = async (data, meUserId, meProfessionalId) => {
    const society = await prisma.societies.create({
        data: {
            society_unique_id: data.societyUniqueId,
            registered_by_user_id: meUserId,
            me_professional_id: meProfessionalId,
            society_name: data.societyName,
            society_category: data.societyCategory === "A+" ? "A_" : (data.societyCategory ?? null),
            address: data.address,
            pin_code: data.pinCode,
            total_participants: Number(data.totalParticipants),
            no_of_flats: Number(data.noOfFlats),
            proposed_wing: data.proposedWing,
            authority_role: data.authorityRole,
            authority_person_name: data.authorityPersonName,
            contact_number: data.contactNumber,
            playground_available: data.playgroundAvailable ? true : false,
            coordinator_name: data.coordinatorName || null,
            coordinator_number: data.coordinatorNumber || null,
            agreement_signed_by_authority: data.agreementSignedByAuthority ? true : false,
            activity_agreement_pdf: data.activityAgreementPdf || null,
            approval_status: "approved",
        },
    });
    return society.id;
};

exports.getSocietiesByMe = async (meProfessionalId) => {
    const rows = await prisma.societies.findMany({
        where: { me_professional_id: meProfessionalId },
        orderBy: { created_at: "desc" },
    });
    return rows.map(normSociety);
};

exports.getSocietyById = async (societyId, meProfessionalId) => {
    const row = await prisma.societies.findFirst({
        where: { id: societyId, me_professional_id: meProfessionalId },
    });
    return row ? normSociety(row) : null;
};

// ── Dashboard Summary ─────────────────────────────────────────────────────────
exports.getSummary = async (meProfessionalId) => {
    const [societiesCount, schoolsCount] = await Promise.all([
        prisma.societies.count({ where: { me_professional_id: meProfessionalId } }),
        prisma.schools.count({ where: { me_professional_id: meProfessionalId } }),
    ]);
    return { societiesCount, schoolsCount };
};

// ── School ────────────────────────────────────────────────────────────────────
exports.schoolNameExists = async (schoolName) => {
    const row = await prisma.schools.findFirst({
        where: { school_name: schoolName },
        select: { id: true },
    });
    return !!row;
};

exports.insertPrincipalUser = async (tx, data) => {
    const user = await tx.users.create({
        data: {
            role: "student",
            full_name: data.principalName,
            mobile: data.principalContact,
        },
    });
    return user.id;
};

exports.insertSchool = async (tx, data, userId, meProfessionalId) => {
    const school = await tx.schools.create({
        data: {
            user_id: userId,
            me_professional_id: meProfessionalId,
            school_name: data.schoolName,
            address: data.address,
            pin_code: data.pinCode,
            state: data.state,
            language_medium: data.languageMedium || null,
            landline_no: data.landlineNo || null,
            principal_name: data.principalName,
            principal_contact: data.principalContact,
            activity_coordinator: data.activityCoordinator || null,
            agreement_signed_by_authority: data.agreementSignedByAuthority ? true : false,
            activity_agreement_pdf: data.activityAgreementPdf || null,
            approval_status: "approved",
        },
    });
    return school.id;
};

exports.getSchoolsByMe = async (meProfessionalId) => {
    const rows = await prisma.schools.findMany({
        where: { me_professional_id: meProfessionalId },
        orderBy: { created_at: "desc" },
    });
    return rows.map(normSchool);
};

exports.getSchoolById = async (schoolId, meProfessionalId) => {
    const row = await prisma.schools.findFirst({
        where: { id: schoolId, me_professional_id: meProfessionalId },
    });
    return row ? normSchool(row) : null;
};

// ── Shared helper ──────────────────────────────────────────────────────────────
// Computes enrollment_status and expiry_date from a payment record in JS,
// since Prisma does not support computed/conditional columns.
function enrollmentStatus(payment) {
    if (!payment) return { enrollment_status: 'no_payment', expiry_date: null, fee_paid: null, captured_at: null };
    const expiry = new Date(payment.captured_at);
    expiry.setMonth(expiry.getMonth() + payment.term_months);
    return {
        enrollment_status: expiry > new Date() ? 'active' : 'expired',
        expiry_date:        expiry,
        fee_paid:           Number(payment.amount),
        captured_at:        payment.captured_at,
    };
}

// ── Students Overview (list screen) ───────────────────────────────────────────
/**
 * All schools under this ME with student count + address.
 * Powers the "School" tab in the Total Students list screen.
 */
exports.getSchoolsStudentSummaryByMe = async (meProfessionalId) => {
    const schools = await prisma.schools.findMany({
        where: { me_professional_id: meProfessionalId },
        select: {
            id:          true,
            school_name: true,
            address:     true,
            pin_code:    true,
            _count: { select: { school_students: true } },
        },
        orderBy: { created_at: 'desc' },
    });
    return schools.map(s => ({
        school_id:     s.id,
        school_name:   s.school_name,
        address:       s.address,
        pin_code:      s.pin_code,
        student_count: s._count.school_students,
    }));
};

/**
 * All societies under this ME with student count + address.
 * Powers the "Society" tab in the Total Students list screen.
 */
exports.getSocietiesStudentSummaryByMe = async (meProfessionalId) => {
    const societies = await prisma.societies.findMany({
        where: { me_professional_id: meProfessionalId },
        select: {
            id:           true,
            society_name: true,
            address:      true,
            pin_code:     true,
            _count: { select: { individual_participants: true } },
        },
        orderBy: { created_at: 'desc' },
    });
    return societies.map(s => ({
        society_id:    s.id,
        society_name:  s.society_name,
        address:       s.address,
        pin_code:      s.pin_code,
        student_count: s._count.individual_participants,
    }));
};

/**
 * All students enrolled in a specific school (the "View" detail screen).
 * Verifies the school belongs to this ME before returning data.
 * enrollment_status and expiry_date are computed in JS from payment data.
 */
exports.getStudentsBySchoolId = async (schoolId, meProfessionalId) => {
    const school = await prisma.schools.findFirst({
        where: { id: schoolId, me_professional_id: meProfessionalId },
        select: {
            id:          true,
            school_name: true,
            address:     true,
            school_students: {
                orderBy: { created_at: 'desc' },
                select: {
                    id:           true,
                    student_name: true,
                    standard:     true,
                    address:      true,
                    activities:   true,
                    kit_type:     true,
                    students: {
                        select: {
                            users: {
                                select: {
                                    mobile:   true,
                                    payments: {
                                        where:   { service_type: 'school_student' },
                                        select:  { captured_at: true, term_months: true, amount: true },
                                        orderBy: { captured_at: 'desc' },
                                        take:    1,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!school) return null;

    return {
        school_id:   school.id,
        school_name: school.school_name,
        address:     school.address,
        students: school.school_students.map(ss => {
            const payment = ss.students?.users?.payments?.[0] ?? null;
            return {
                school_student_id: ss.id,
                student_name:      ss.student_name,
                standard:          ss.standard,
                address:           ss.address,
                activities:        ss.activities,
                kit_type:          ss.kit_type,
                mobile:            ss.students?.users?.mobile ?? null,
                ...enrollmentStatus(payment),
            };
        }),
    };
};

/**
 * All students enrolled in a specific society via individual coaching (the "View" detail screen).
 * Verifies the society belongs to this ME before returning data.
 */
exports.getStudentsBySocietyId = async (societyId, meProfessionalId) => {
    const society = await prisma.societies.findFirst({
        where: { id: societyId, me_professional_id: meProfessionalId },
        select: {
            id:               true,
            society_name:     true,
            address:          true,
            society_category: true,
            individual_participants: {
                orderBy: { id: 'desc' },
                select: {
                    id:       true,
                    flat_no:  true,
                    dob:      true,
                    age:      true,
                    activity: true,
                    kits:     true,
                    students: {
                        select: {
                            users: {
                                select: {
                                    full_name: true,
                                    mobile:    true,
                                    payments:  {
                                        where:   { service_type: 'individual_coaching' },
                                        select:  { captured_at: true, term_months: true, amount: true },
                                        orderBy: { captured_at: 'desc' },
                                        take:    1,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!society) return null;

    return {
        society_id:       society.id,
        society_name:     society.society_name,
        address:          society.address,
        society_category: society.society_category,
        students: society.individual_participants.map(ip => {
            const payment = ip.students?.users?.payments?.[0] ?? null;
            return {
                participant_id: ip.id,
                full_name:      ip.students?.users?.full_name ?? null,
                mobile:         ip.students?.users?.mobile ?? null,
                flat_no:        ip.flat_no,
                dob:            ip.dob,
                age:            ip.age,
                activity:       ip.activity,
                kits:           ip.kits,
                ...enrollmentStatus(payment),
            };
        }),
    };
};

// ── Single School Student Detail ───────────────────────────────────────────────
/**
 * Fetches full detail for one school_student row.
 * Verifies the parent school belongs to this ME before returning data.
 */
exports.getSchoolStudentById = async (schoolStudentId, meProfessionalId) => {
    const row = await prisma.school_students.findFirst({
        where: { id: schoolStudentId },
        select: {
            id:           true,
            student_name: true,
            standard:     true,
            address:      true,
            activities:   true,
            kit_type:     true,
            created_at:   true,
            schools: {
                select: {
                    id:          true,
                    school_name: true,
                    me_professional_id: true,
                },
            },
            students: {
                select: {
                    users: {
                        select: {
                            mobile: true,
                            payments: {
                                where:   { service_type: 'school_student' },
                                select:  { amount: true, term_months: true, captured_at: true },
                                orderBy: { captured_at: 'desc' },
                                take:    1,
                            },
                        },
                    },
                },
            },
        },
    });

    if (!row || row.schools?.me_professional_id !== meProfessionalId) return null;

    const payment = row.students?.users?.payments?.[0] ?? null;

    return {
        school_student_id:  row.id,
        student_name:       row.student_name,
        standard:           row.standard,
        address:            row.address,
        activities:         row.activities,
        kit_type:           row.kit_type,
        registered_at:      row.created_at,
        contact_number:     row.students?.users?.mobile ?? null,
        school_id:          row.schools?.id ?? null,
        school_name:        row.schools?.school_name ?? null,
        ...enrollmentStatus(payment),
    };
};

// ── School Enrollment Stats ────────────────────────────────────────────────────
/**
 * For each school managed by this ME, compute per-school enrollment stats:
 *   total_students  — all school_students rows for that school
 *   enrolled        — students whose payment term has NOT yet expired
 *                     (captured_at + term_months MONTH > NOW())
 *   non_enrolled    — students whose term HAS expired
 *   fee_collected   — SUM of all payment amounts for students in that school
 *
 * Join chain:
 *   schools → school_students → students → users → payments (service_type = 'school_student')
 */
exports.getSchoolsWithEnrollmentByMe = async (meProfessionalId) => {
    const now = new Date();

    const [schoolData, societyData] = await Promise.all([
        prisma.schools.findMany({
            where:   { me_professional_id: meProfessionalId },
            orderBy: { created_at: 'desc' },
            select: {
                id:          true,
                school_name: true,
                address:     true,
                created_at:  true,
                school_students: {
                    select: {
                        students: {
                            select: {
                                users: {
                                    select: {
                                        payments: {
                                            where:   { service_type: 'school_student' },
                                            select:  { captured_at: true, term_months: true, amount: true },
                                            orderBy: { captured_at: 'desc' },
                                            take:    1,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        }),
        prisma.societies.findMany({
            where:   { me_professional_id: meProfessionalId },
            orderBy: { created_at: 'desc' },
            select: {
                id:           true,
                society_name: true,
                address:      true,
                created_at:   true,
                individual_participants: {
                    select: {
                        students: {
                            select: {
                                users: {
                                    select: {
                                        payments: {
                                            where:   { service_type: 'individual_coaching' },
                                            select:  { captured_at: true, term_months: true, amount: true },
                                            orderBy: { captured_at: 'desc' },
                                            take:    1,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        }),
    ]);

    const schools = schoolData.map(s => {
        let enrolled = 0, non_enrolled = 0, fee_collected = 0;
        for (const ss of s.school_students) {
            const payment = ss.students?.users?.payments?.[0] ?? null;
            if (!payment) { non_enrolled++; continue; }
            const expiry = new Date(payment.captured_at);
            expiry.setMonth(expiry.getMonth() + payment.term_months);
            if (expiry > now) enrolled++;
            else non_enrolled++;
            fee_collected += Number(payment.amount);
        }
        return {
            school_id:      s.id,
            school_name:    s.school_name,
            address:        s.address,
            created_at:     s.created_at,
            total_students: s.school_students.length,
            enrolled,
            non_enrolled,
            fee_collected,
        };
    });

    const societies = societyData.map(soc => {
        let enrolled = 0, non_enrolled = 0, fee_collected = 0;
        for (const ip of soc.individual_participants) {
            const payment = ip.students?.users?.payments?.[0] ?? null;
            if (!payment) { non_enrolled++; continue; }
            const expiry = new Date(payment.captured_at);
            expiry.setMonth(expiry.getMonth() + payment.term_months);
            if (expiry > now) enrolled++;
            else non_enrolled++;
            fee_collected += Number(payment.amount);
        }
        return {
            society_id:     soc.id,
            society_name:   soc.society_name,
            address:        soc.address,
            created_at:     soc.created_at,
            total_students: soc.individual_participants.length,
            enrolled,
            non_enrolled,
            fee_collected,
        };
    });

    const total_students =
        schools.reduce((s, r) => s + r.total_students, 0) +
        societies.reduce((s, r) => s + r.total_students, 0);

    return { total_students, schools, societies };
};
