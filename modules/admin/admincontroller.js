const service = require("./adminservice");

exports.listFeeStructures = async (req, res) => {
    try {
        const { section } = req.query; // optional: school | society | individual_coaching | personal_tutor
        const data = await service.listFeeStructures(section);
        res.json({ success: true, data });
    } catch (err) {
        const status = err.message === "INVALID_SECTION" ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.listCustomFeeCategories = async (req, res) => {
    try {
        const { type } = req.query; // "society" or "school"
        const data = await service.listCustomFeeCategories(type);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.listStudents = async (req, res) => {
    try {
        const { type } = req.query; // personal_tutor | individual_coaching | school_student | group_coaching
        if (!type) {
            return res.status(400).json({ success: false, error: "Query param 'type' is required (personal_tutor | individual_coaching | school_student | group_coaching)" });
        }
        const data = await service.listStudents(type);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        const status = err.message === "INVALID_TYPE" ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.listProfessionals = async (req, res) => {
    try {
        const { type } = req.query; // optional: ?type=trainer|teacher|marketing_executive|vendor
        const data = await service.listProfessionals(type);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        console.error("List professionals error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.listPending = async (req, res) => {
    try {
        const { type } = req.query; // optional: ?type=trainer
        const data = await service.listPending(type);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        console.error("List pending error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.approve = async (req, res) => {
    try {
        const result = await service.approveRegistration(
            req.params.id,
            req.admin.userId,
            req.body?.note
        );
        res.json({ success: true, ...result });
    } catch (err) {
        console.error("Approve error:", err.message);
        const status = err.message === "PENDING_NOT_FOUND" ? 404
                     : err.message === "ALREADY_REVIEWED"  ? 409
                     : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.getUnassignedStudents = async (req, res) => {
    try {
        const serviceType = req.query.service; // personal_tutor | individual_coaching
        if (!serviceType) {
            return res.status(400).json({ success: false, error: "Query param 'service' is required (personal_tutor | individual_coaching)" });
        }
        const data = await service.getUnassignedStudents(serviceType);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        const status = err.message === "INVALID_SERVICE" ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.getSchoolStudentsForBatch = async (req, res) => {
    try {
        const { batch_id, school_id, activity_id } = req.query;
        if (!batch_id || !school_id) {
            return res.status(400).json({ success: false, error: "batch_id and school_id are required" });
        }
        const data = await service.getSchoolStudentsForBatch(batch_id, school_id, activity_id);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.getGroupCoachingStudentsForBatch = async (req, res) => {
    try {
        const { batch_id, society_id, activity_id } = req.query;
        if (!batch_id || !society_id) {
            return res.status(400).json({ success: false, error: "batch_id and society_id are required" });
        }
        const data = await service.getGroupCoachingStudentsForBatch(batch_id, society_id, activity_id);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.getAvailableProfessionals = async (req, res) => {
    try {
        const { type, date, start_time, end_time } = req.query; // teacher | trainer
        if (!type) {
            return res.status(400).json({ success: false, error: "Query param 'type' is required (teacher | trainer)" });
        }
        const data = await service.getAvailableProfessionals(type, { date, startTime: start_time, endTime: end_time });
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        const status = err.message === "INVALID_TYPE" ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.getApprovedSocieties = async (req, res) => {
    try {
        const data = await service.getAllSocietiesAdmin();
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getApprovedSchools = async (req, res) => {
    try {
        const data = await service.getAllSchoolsAdmin();
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getAllSocietiesAdmin = exports.getApprovedSocieties;

exports.getSocietyAdminById = async (req, res) => {
    try {
        const data = await service.getSocietyAdminById(req.params.id);
        res.json({ success: true, data });
    } catch (err) {
        const status = err.message === "SOCIETY_NOT_FOUND" ? 404 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.adminRegisterSociety = async (req, res) => {
    try {
        const data = { ...req.body };
        if (req.files?.activityAgreementPdf?.[0]) {
            data.activityAgreementPdf = req.files.activityAgreementPdf[0].path;
        }
        const result = await service.adminRegisterSociety(data, req.admin.userId);
        res.status(201).json({ success: true, ...result });
    } catch (err) {
        const status = err.message === "ME_NOT_FOUND" ? 404 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.getAllSchoolsAdmin = exports.getApprovedSchools;

exports.getSchoolAdminById = async (req, res) => {
    try {
        const data = await service.getSchoolAdminById(req.params.id);
        res.json({ success: true, data });
    } catch (err) {
        const status = err.message === "SCHOOL_NOT_FOUND" ? 404 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.adminRegisterSchool = async (req, res) => {
    try {
        const data = { ...req.body };
        if (req.files?.activityAgreementPdf?.[0]) {
            data.activityAgreementPdf = req.files.activityAgreementPdf[0].path;
        }
        const result = await service.adminRegisterSchool(data, req.admin.userId);
        res.status(201).json({ success: true, ...result });
    } catch (err) {
        const status = err.message === "ME_NOT_FOUND" ? 404 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.upsertFeeStructure = async (req, res) => {
    try {
        const data = await service.upsertFeeStructure(req.body, req.admin.userId, req.params.id ?? null);
        res.json({ success: true, data });
    } catch (err) {
        const status = err.message === "INVALID_COACHING_TYPE"         ? 400
                     : err.message === "CUSTOM_CATEGORY_NAME_REQUIRED"  ? 400
                     : err.message === "FEE_STRUCTURE_NOT_FOUND"         ? 404
                     : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.getMEList = async (req, res) => {
    try {
        const data = await service.getMEList();
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.assignTeacher = async (req, res) => {
    try {
        const { personal_tutor_id, teacher_professional_id } = req.body;
        if (!personal_tutor_id || !teacher_professional_id) {
            return res.status(400).json({ success: false, error: "personal_tutor_id and teacher_professional_id are required" });
        }
        const result = await service.assignTeacher(
            Number(personal_tutor_id),
            Number(teacher_professional_id)
        );
        res.json({ success: true, ...result });
    } catch (err) {
        const status = err.message === "PERSONAL_TUTOR_NOT_FOUND" ? 404
                     : err.message === "TEACHER_NOT_FOUND"        ? 404
                     : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.assignTrainer = async (req, res) => {
    try {
        const { individual_participant_id, trainer_professional_id } = req.body;
        if (!individual_participant_id || !trainer_professional_id) {
            return res.status(400).json({ success: false, error: "individual_participant_id and trainer_professional_id are required" });
        }
        const result = await service.assignTrainer(
            Number(individual_participant_id),
            Number(trainer_professional_id)
        );
        res.json({ success: true, ...result });
    } catch (err) {
        const status = err.message === "INDIVIDUAL_PARTICIPANT_NOT_FOUND" ? 404
                     : err.message === "TRAINER_NOT_FOUND"                ? 404
                     : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

// ── Settlement ─────────────────────────────────────────────────────────────

exports.getSettlementPreview = async (req, res) => {
    try {
        const professionalId = req.query.professional_id ? Number(req.query.professional_id) : null;
        const data = await service.getSettlementPreview(professionalId);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.confirmSettlement = async (req, res) => {
    try {
        // assignment_ids: optional array — if omitted, settles all active assignments
        const assignmentIds = Array.isArray(req.body.assignment_ids)
            ? req.body.assignment_ids.map(Number)
            : null;
        const data = await service.confirmSettlement(assignmentIds);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getUnsettledCount = async (req, res) => {
    try {
        const data = await service.getUnsettledCount();
        res.json({ success: true, ...data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.listTrainerAssignments = async (req, res) => {
    try {
        const { professional_id, is_active } = req.query;
        const isActive = is_active === undefined ? undefined : is_active === "true";
        const data = await service.listTrainerAssignments({
            professionalId: professional_id ? Number(professional_id) : undefined,
            isActive,
        });
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.updateAssignmentSessionsCap = async (req, res) => {
    try {
        const { sessions_allocated } = req.body;
        if (!sessions_allocated) return res.status(400).json({ success: false, error: "sessions_allocated is required" });
        const data = await service.updateAssignmentSessionsCap(req.params.id, Number(sessions_allocated));
        res.json({ success: true, data });
    } catch (err) {
        const status = err.message === "INVALID_SESSIONS_ALLOCATED" ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.deactivateAssignment = async (req, res) => {
    try {
        const data = await service.deactivateAssignment(req.params.id);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// ── Commission rules ───────────────────────────────────────────────────────

exports.listCommissionRules = async (req, res) => {
    try {
        const data = await service.listCommissionRules();
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.updateCommissionRule = async (req, res) => {
    try {
        const { ruleKey } = req.params;
        const { value } = req.body;
        if (value === undefined || value === null) {
            return res.status(400).json({ success: false, error: "'value' is required in the request body" });
        }
        const updated = await service.updateCommissionRule(ruleKey, Number(value));
        res.json({ success: true, data: updated });
    } catch (err) {
        const status = err.message === "RULE_NOT_FOUND" ? 404 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

// ── Commissions ────────────────────────────────────────────────────────────

exports.listCommissions = async (req, res) => {
    try {
        const { professional_type, status, professional_id } = req.query;
        const data = await service.listCommissions({ professionalType: professional_type, status, professionalId: professional_id });
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.approveCommission = async (req, res) => {
    try {
        const result = await service.approveCommission(req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        const status = err.message === "COMMISSION_NOT_FOUND"      ? 404
                     : err.message === "COMMISSION_NOT_APPROVABLE" ? 409
                     : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.markCommissionPaid = async (req, res) => {
    try {
        const result = await service.markCommissionPaid(req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        const status = err.message === "COMMISSION_NOT_FOUND"    ? 404
                     : err.message === "ALREADY_PAID"            ? 409
                     : err.message === "COMMISSION_NOT_APPROVED" ? 422
                     : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

// ── Withdrawal requests ────────────────────────────────────────────────────

exports.listWithdrawalRequests = async (req, res) => {
    try {
        const data = await service.listWithdrawalRequests();
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.approveWithdrawal = async (req, res) => {
    try {
        const result = await service.approveWithdrawal(req.params.professionalId);
        res.json({ success: true, message: "Withdrawal approved. Professional can now withdraw.", data: result });
    } catch (err) {
        const status = err.statusCode || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

// ── Travelling allowances ──────────────────────────────────────────────────

exports.listTravellingAllowances = async (req, res) => {
    try {
        const { trainer_professional_id, status } = req.query;
        const data = await service.listTravellingAllowances({ trainerProfessionalId: trainer_professional_id, status });
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.markTravellingAllowancePaid = async (req, res) => {
    try {
        const result = await service.markTravellingAllowancePaid(req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        const status = err.message === "TA_NOT_FOUND"  ? 404
                     : err.message === "ALREADY_PAID"  ? 409
                     : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

// ── Reject ─────────────────────────────────────────────────────────────────

// ── Activities dropdown ────────────────────────────────────────────────────

// ── Payments ──────────────────────────────────────────────────────────────

exports.listPayments = async (req, res) => {
    try {
        const { service_type, status, user_id, from, to } = req.query;
        const data = await service.listPayments({ serviceType: service_type, status, userId: user_id, from, to });
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// ── Student assignment overview ────────────────────────────────────────────

exports.listStudentAssignments = async (req, res) => {
    try {
        const data = await service.listStudentAssignments(req.query.service);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// ── Sessions ──────────────────────────────────────────────────────────────

exports.listSessions = async (req, res) => {
    try {
        const { type, from, to, professional_id, status } = req.query;
        const data = await service.listSessions({ type, from, to, professionalId: professional_id, status });
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.createSession = async (req, res) => {
    try {
        const data = await service.createSession(req.body);
        res.status(201).json({ success: true, data });
    } catch (err) {
        const status = err.message === "MISSING_REQUIRED_FIELDS" ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.getSessionStudentInfo = async (req, res) => {
    try {
        const { type, id } = req.query;
        if (!type || !id) return res.status(400).json({ success: false, error: "type and id are required" });
        const data = await service.getSessionStudentInfo(type, id);
        res.json({ success: true, data });
    } catch (err) {
        const status = err.message === "NOT_FOUND" ? 404 : err.message === "INVALID_TYPE" ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.getProfessionalsForSession = async (req, res) => {
    try {
        const { type, date, start_time, end_time, subject, activity } = req.query;
        if (!type) return res.status(400).json({ success: false, error: "type is required (teacher | trainer)" });
        const data = await service.getProfessionalsForSession(type, { date, startTime: start_time, endTime: end_time, subject, activity });
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        const status = err.message === "INVALID_TYPE" ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.getStudentActivities = async (req, res) => {
    try {
        const { studentId } = req.params;
        const data = await service.getStudentActivities(studentId);
        res.json({ success: true, data });
    } catch (err) {
        const status = err.message === "NOT_FOUND" ? 404 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.getTrainersForActivity = async (req, res) => {
    try {
        const { activityId } = req.params;
        const { date, start_time, end_time } = req.query;
        const data = await service.getTrainersForActivity(activityId, { date, startTime: start_time, endTime: end_time });
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        const status = err.message === "NOT_FOUND" ? 404 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.getStudentSubjects = async (req, res) => {
    try {
        const { studentId } = req.params;
        const data = await service.getStudentSubjects(studentId);
        res.json({ success: true, data });
    } catch (err) {
        const status = err.message === "NOT_FOUND" ? 404 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.getTeachersForSubject = async (req, res) => {
    try {
        const { activityId } = req.params;
        const { date, start_time, end_time } = req.query;
        const data = await service.getTeachersForSubject(activityId, { date, startTime: start_time, endTime: end_time });
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        const status = err.message === "NOT_FOUND" ? 404 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

// ── Batches per society/school ────────────────────────────────────────────

exports.getSocietyBatches = async (req, res) => {
    try {
        const data = await service.getSocietyBatches(req.params.id);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getSchoolBatches = async (req, res) => {
    try {
        const data = await service.getSchoolBatches(req.params.id);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.listActivities = async (req, res) => {
    try {
        const data = await service.listActivities(req.query.coaching_type);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.reject = async (req, res) => {
    try {
        const result = await service.rejectRegistration(
            req.params.id,
            req.admin.userId,
            req.body?.note
        );
        res.json({ success: true, ...result });
    } catch (err) {
        console.error("Reject error:", err.message);
        const status = err.message === "PENDING_NOT_FOUND" ? 404
                     : err.message === "ALREADY_REVIEWED"  ? 409
                     : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};
