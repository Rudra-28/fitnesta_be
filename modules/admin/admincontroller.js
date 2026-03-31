const service = require("./adminservice");

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

exports.getAvailableProfessionals = async (req, res) => {
    try {
        const { type } = req.query; // teacher | trainer
        if (!type) {
            return res.status(400).json({ success: false, error: "Query param 'type' is required (teacher | trainer)" });
        }
        const data = await service.getAvailableProfessionals(type);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        const status = err.message === "INVALID_TYPE" ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
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

exports.markCommissionPaid = async (req, res) => {
    try {
        const result = await service.markCommissionPaid(req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        const status = err.message === "COMMISSION_NOT_FOUND" ? 404
                     : err.message === "ALREADY_PAID"         ? 409
                     : 500;
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
