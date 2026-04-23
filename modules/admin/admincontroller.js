const service = require("./adminservice");
const { sendNotification } = require("../../utils/fcm");
const prisma = require("../../config/prisma");
const auditLog = require("../../utils/auditLog");
const axios = require("axios");
const log = require("../../utils/logger");

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

exports.getStudentDetail = async (req, res) => {
    try {
        const data = await service.getStudentDetail(req.params.studentId);
        res.json({ success: true, data });
    } catch (err) {
        res.status(err.status || 500).json({ success: false, error: err.message });
    }
};

exports.updateStudentDetail = async (req, res) => {
    try {
        const data = await service.updateStudentDetail(req.params.studentId, req.body);

        auditLog(req, "edit_student", {
            entity_type: "student",
            entity_id:   Number(req.params.studentId),
            details:     { updated_sections: Object.keys(req.body) },
        });

        res.json({ success: true, data });
    } catch (err) {
        res.status(err.status || 500).json({ success: false, error: err.message });
    }
};

exports.getProfessional = async (req, res) => {
    try {
        const data = await service.getProfessional(req.params.professionalId);
        res.json({ success: true, data });
    } catch (err) {
        res.status(err.status || 500).json({ success: false, error: err.message });
    }
};

exports.proxyDocument = async (req, res) => {
    const { url, token } = req.query;
    if (!url) return res.status(400).json({ success: false, error: "url query param required" });

    // Allow token via query param so the browser can open the URL directly in a
    // new tab (window.open cannot set custom headers). Validate it here the same
    // way the middleware does, but only when the Authorization header is absent.
    if (token && !req.headers.authorization) {
        const jwt = require("jsonwebtoken");
        try {
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            if (decoded.role !== "admin") {
                return res.status(403).json({ success: false, error: "Access denied." });
            }
        } catch {
            return res.status(401).json({ success: false, error: "Invalid or expired token." });
        }
    }

    // Only allow proxying Cloudinary URLs to prevent SSRF abuse
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return res.status(400).json({ success: false, error: "Invalid URL" });
    }
    if (!parsed.hostname.endsWith("cloudinary.com") && !parsed.hostname.endsWith("res.cloudinary.com")) {
        return res.status(403).json({ success: false, error: "Only Cloudinary URLs are allowed" });
    }

    try {
        // Use the URL exactly as stored in the DB — Cloudinary's public_id includes
        // the extension (e.g. file.jpg.jpg), so deduping breaks the lookup.
        // New uploads (post resource_type fix) will have clean URLs.
        //
        // For PDFs uploaded before the resource_type fix: they were stored under
        // /image/upload/ but Cloudinary silently failed to store them as raw.
        // Those are dead records — they must be re-uploaded.
        // New PDFs are stored under /raw/upload/ and work correctly.
        const fetchUrl = url;

        // Derive Content-Type from the file extension in the URL.
        // Do NOT trust Cloudinary's upstream Content-Type — for raw resources
        // it returns "image/gif" as a placeholder regardless of actual file type.
        //
        // Raw PDFs uploaded via our app have no extension in the URL (the upload
        // code strips it), so we fall back based on the Cloudinary resource type
        // segment in the path (/raw/upload/ → PDF, /image/upload/ → check ext).
        const MIME = {
            pdf:  "application/pdf",
            jpg:  "image/jpeg",
            jpeg: "image/jpeg",
            png:  "image/png",
        };
        const urlPath = fetchUrl.split("?")[0];
        const ext = urlPath.split(".").pop().toLowerCase();
        let contentType = MIME[ext];
        if (!contentType) {
            // No recognised extension — infer from Cloudinary path segment
            contentType = urlPath.includes("/raw/upload/") ? "application/pdf" : "application/octet-stream";
        }

        log.info("[document-proxy] fetching", { url: fetchUrl, contentType });
        const upstream = await axios.get(fetchUrl, { responseType: "stream" });

        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", "inline");
        res.setHeader("Cache-Control", "private, max-age=3600");
        upstream.data.pipe(res);
    } catch (err) {
        const status = err?.response?.status ?? 502;
        log.error("[document-proxy] upstream fetch failed", { status, error: err?.response?.data ?? err?.message });
        res.status(502).json({ success: false, error: `Upstream ${status}: failed to fetch document` });
    }
};

exports.listProfessionals = async (req, res) => {
    try {
        const { type } = req.query;
        log.info("[admin] listProfessionals", { type: type ?? "all" });
        const data = await service.listProfessionals(type);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        log.error("[admin] listProfessionals — failed", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.listPending = async (req, res) => {
    try {
        const { type } = req.query;
        log.info("[admin] listPending", { type: type ?? "all" });
        const data = await service.listPending(type);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        log.error("[admin] listPending — failed", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.approve = async (req, res) => {
    try {
        log.info("[admin] approve registration", { pendingId: req.params.id, adminId: req.admin?.userId });
        const result = await service.approveRegistration(
            req.params.id,
            req.admin.userId,
            req.body?.note
        );
        log.info("[admin] registration approved", { pendingId: req.params.id });

        auditLog(req, "approve_registration", {
            entity_type: "pending_registration",
            entity_id:   Number(req.params.id),
            details:     { note: req.body?.note ?? null },
        });

        // Notify the registrant — using fcmToken or userId
        try {
            const pending = await prisma.pending_registrations.findUnique({
                where:  { id: Number(req.params.id) },
                select: { form_data: true, service_type: true },
            });
            const formData = typeof pending?.form_data === "string"
                ? JSON.parse(pending.form_data)
                : pending?.form_data;
            
            const userId = formData?.user_id ?? formData?.userId ?? null;
            const fcmToken = formData?.fcm_token ?? formData?.fcmToken ?? null;
            
            const title = "Registration Approved";
            let body = "Your registration has been approved. You can now log in.";
            if (pending?.service_type === "society_request") {
                body = "Your society request has been acknowledged and approved by the admin.";
            }

            if (userId) {
                sendNotification(userId, title, body, { type: "registration_approved" });
            } else if (fcmToken) {
                const { sendNotificationToToken } = require("../../utils/fcm");
                sendNotificationToToken(fcmToken, title, body, { type: "registration_approved" });
            }
        } catch (_) {}

        res.json({ success: true, ...result });
    } catch (err) {
        log.error("[admin] approve registration — failed", { pendingId: req.params.id, error: err.message });
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

// controller.js

// 1. Existing List Handler
exports.getApprovedSocieties = async (req, res) => {
    try {
        const data = await service.getApprovedSocieties();
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 2. New Detail Handler (Triggered on click)
exports.getSocietyDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await service.getSocietyDetails(id);
        
        if (!data) {
            return res.status(404).json({ success: false, message: "Society not found" });
        }
        
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getAllSocietiesAdmin = async (req, res) => {
    try {
        const data = await service.getAllSocietiesAdmin();
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getApprovedSchools = async (req, res) => {
    try {
        const data = await service.getApprovedSchools();
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getAllSchoolsAdmin = async (req, res) => {
    try {
        const data = await service.getAllSchoolsAdmin();
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

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

        auditLog(req, "register_society", {
            entity_type: "society",
            entity_id:   result.society_id ?? null,
            details:     { society_name: data.societyName ?? data.society_name ?? null },
        });

        res.status(201).json({ success: true, ...result });
    } catch (err) {
        const status = err.message === "ME_NOT_FOUND" ? 404 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

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

        auditLog(req, "register_school", {
            entity_type: "school",
            entity_id:   result.school_id ?? null,
            details:     { school_name: data.schoolName ?? data.school_name ?? null },
        });

        res.status(201).json({ success: true, ...result });
    } catch (err) {
        const status = err.message === "ME_NOT_FOUND" ? 404 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.upsertFeeStructure = async (req, res) => {
    try {
        const feeId = req.params.id ?? null;
        const data = await service.upsertFeeStructure(req.body, req.admin.userId, feeId);

        auditLog(req, "upsert_fee_structure", {
            entity_type: "fee_structure",
            entity_id:   data.id ?? (feeId ? Number(feeId) : null),
            details:     {
                action:        feeId ? "update" : "create",
                coaching_type: req.body.coaching_type ?? null,
                total_fee:     req.body.total_fee ?? null,
            },
        });

        res.json({ success: true, data });
    } catch (err) {
        const status = err.message === "INVALID_COACHING_TYPE"         ? 400
                     : err.message === "CUSTOM_CATEGORY_NAME_REQUIRED"  ? 400
                     : err.message === "FEE_STRUCTURE_NOT_FOUND"         ? 404
                     : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.deleteFeeStructure = async (req, res) => {
    try {
        await service.deleteFeeStructure(Number(req.params.id));
        res.json({ success: true });
    } catch (err) {
        const status = err.message === "FEE_STRUCTURE_NOT_FOUND" ? 404 : 500;
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
        log.info("[admin] assignTeacher", { personal_tutor_id, teacher_professional_id, adminId: req.admin?.userId });
        const result = await service.assignTeacher(
            Number(personal_tutor_id),
            Number(teacher_professional_id)
        );

        // Notify student and teacher
        try {
            const [tutor, teacher] = await Promise.all([
                prisma.personal_tutors.findUnique({
                    where:   { id: Number(personal_tutor_id) },
                    include: { students: { select: { user_id: true } } },
                }),
                prisma.professionals.findUnique({
                    where:  { id: Number(teacher_professional_id) },
                    select: { user_id: true },
                }),
            ]);
            if (tutor?.students?.user_id) {
                sendNotification(tutor.students.user_id, "Teacher Assigned", "A teacher has been assigned to you.", { type: "teacher_assigned" });
            }
            if (teacher?.user_id) {
                sendNotification(teacher.user_id, "New Student Assigned", "A new student has been assigned to you.", { type: "student_assigned" });
            }
        } catch (_) {}

        auditLog(req, "assign_teacher", {
            entity_type: "personal_tutor",
            entity_id:   Number(req.body.personal_tutor_id),
            details:     { teacher_professional_id: Number(req.body.teacher_professional_id) },
        });

        log.info("[admin] teacher assigned", { personal_tutor_id, teacher_professional_id });
        res.json({ success: true, ...result });
    } catch (err) {
        log.error("[admin] assignTeacher — failed", { personal_tutor_id: req.body?.personal_tutor_id, error: err.message });
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
        log.info("[admin] assignTrainer", { individual_participant_id, trainer_professional_id, adminId: req.admin?.userId });
        const result = await service.assignTrainer(
            Number(individual_participant_id),
            Number(trainer_professional_id)
        );

        // Notify student and trainer
        try {
            const [participant, trainer] = await Promise.all([
                prisma.individual_participants.findUnique({
                    where:   { id: Number(individual_participant_id) },
                    include: { students: { select: { user_id: true } } },
                }),
                prisma.professionals.findUnique({
                    where:  { id: Number(trainer_professional_id) },
                    select: { user_id: true },
                }),
            ]);
            if (participant?.students?.user_id) {
                sendNotification(participant.students.user_id, "Trainer Assigned", "A trainer has been assigned to you.", { type: "trainer_assigned" });
            }
            if (trainer?.user_id) {
                sendNotification(trainer.user_id, "New Student Assigned", "A new student has been assigned to you.", { type: "student_assigned" });
            }
        } catch (_) {}

        auditLog(req, "assign_trainer", {
            entity_type: "individual_participant",
            entity_id:   Number(req.body.individual_participant_id),
            details:     { trainer_professional_id: Number(req.body.trainer_professional_id) },
        });

        log.info("[admin] trainer assigned", { individual_participant_id, trainer_professional_id });
        res.json({ success: true, ...result });
    } catch (err) {
        log.error("[admin] assignTrainer — failed", { individual_participant_id: req.body?.individual_participant_id, error: err.message });
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
        log.info("[admin] confirmSettlement", { assignment_ids: req.body.assignment_ids ?? "all", adminId: req.admin?.userId });
        // assignment_ids: optional array — if omitted, settles all active assignments
        const assignmentIds = Array.isArray(req.body.assignment_ids)
            ? req.body.assignment_ids.map(Number)
            : null;
        // cap_overrides: optional map { "assignmentId": overrideCap }
        // e.g. { "5": 15 } — admin confirmed to use 15 sessions instead of standard 20
        const rawOverrides  = req.body.cap_overrides ?? {};
        const capOverrides  = Object.fromEntries(
            Object.entries(rawOverrides).map(([k, v]) => [Number(k), Number(v)])
        );
        const data = await service.confirmSettlement(assignmentIds, capOverrides);

        auditLog(req, "confirm_settlement", {
            entity_type: "settlement",
            details:     {
                assignment_ids:  assignmentIds ?? "all",
                settled_count:   data.length,
            },
        });

        log.info("[admin] settlement confirmed", { settled_count: data.length });
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        log.error("[admin] confirmSettlement — failed", err);
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

/**
 * GET /api/v1/admin/professionals/:professionalId/settlement-preview
 *
 * Returns the "Sessions & Settle" tab data for one professional.
 * Each item represents one assignment (group-coaching batch or individual/tutor student)
 * with the computed trainer_earns ready to be settled.
 */
exports.getSessionsAndSettlePreview = async (req, res) => {
    try {
        const { professionalId } = req.params;
        if (!professionalId) {
            return res.status(400).json({ success: false, error: "professionalId is required" });
        }
        const data = await service.getSessionsAndSettlePreview(Number(professionalId));
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

/**
 * POST /api/v1/admin/professionals/:professionalId/settle
 *
 * "Settle Amount" button.
 * Settles all (or specified) active assignments for this professional.
 * Creates commissions records at status = "pending" → visible in trainer Payouts tab.
 *
 * Body (optional):
 *   {
 *     assignment_ids: [1, 2],      // omit to settle all active assignments
 *     cap_overrides:  { "5": 15 }  // override session denominator for specific assignments
 *   }
 */
exports.settleAmountForProfessional = async (req, res) => {
    try {
        const { professionalId } = req.params;
        if (!professionalId) {
            return res.status(400).json({ success: false, error: "professionalId is required" });
        }

        const assignmentIds = Array.isArray(req.body.assignment_ids)
            ? req.body.assignment_ids.map(Number)
            : null;

        const rawOverrides = req.body.cap_overrides ?? {};
        const capOverrides = Object.fromEntries(
            Object.entries(rawOverrides).map(([k, v]) => [Number(k), Number(v)])
        );

        const result = await service.settleAmountForProfessional(
            Number(professionalId),
            assignmentIds,
            capOverrides
        );

        auditLog(req, "settle_amount_professional", {
            entity_type: "settlement",
            entity_id:   Number(professionalId),
            details:     {
                professional_id:  Number(professionalId),
                assignment_ids:   assignmentIds ?? "all",
                settled_count:    result.settled_count,
                skipped_count:    result.skipped_count,
            },
        });

        res.json({ success: true, ...result });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
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

        auditLog(req, "update_sessions_cap", {
            entity_type: "trainer_assignment",
            entity_id:   Number(req.params.id),
            details:     { sessions_allocated: Number(sessions_allocated) },
        });

        res.json({ success: true, data });
    } catch (err) {
        const status = err.message === "INVALID_SESSIONS_ALLOCATED" ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.deactivateAssignment = async (req, res) => {
    try {
        const data = await service.deactivateAssignment(req.params.id);

        auditLog(req, "deactivate_assignment", {
            entity_type: "trainer_assignment",
            entity_id:   Number(req.params.id),
        });

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

        auditLog(req, "update_commission_rule", {
            entity_type: "commission_rule",
            details:     { rule_key: ruleKey, new_value: Number(value) },
        });

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
        log.info("[admin] approveCommission", { commissionId: req.params.id, adminId: req.admin?.userId });
        const result = await service.approveCommission(req.params.id);

        // Notify the professional
        try {
            const commission = await prisma.commissions.findUnique({
                where:   { id: Number(req.params.id) },
                include: { professionals: { select: { user_id: true } } },
            });
            if (commission?.professionals?.user_id) {
                const amount = parseFloat(commission.commission_amount).toFixed(2);
                sendNotification(commission.professionals.user_id, "Commission Approved", `Your commission of ₹${amount} has been approved.`, { type: "commission_approved", commission_id: String(commission.id) });
            }
        } catch (_) {}

        auditLog(req, "approve_commission", {
            entity_type: "commission",
            entity_id:   Number(req.params.id),
        });

        log.info("[admin] commission approved", { commissionId: req.params.id });
        res.json({ success: true, data: result });
    } catch (err) {
        log.error("[admin] approveCommission — failed", { commissionId: req.params.id, error: err.message });
        const status = err.message === "COMMISSION_NOT_FOUND"      ? 404
                     : err.message === "COMMISSION_NOT_APPROVABLE" ? 409
                     : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.markCommissionPaid = async (req, res) => {
    try {
        log.info("[admin] markCommissionPaid", { commissionId: req.params.id, adminId: req.admin?.userId });
        const result = await service.markCommissionPaid(req.params.id);

        // Notify the professional
        try {
            const commission = await prisma.commissions.findUnique({
                where:   { id: Number(req.params.id) },
                include: { professionals: { select: { user_id: true } } },
            });
            if (commission?.professionals?.user_id) {
                const amount = parseFloat(commission.commission_amount).toFixed(2);
                sendNotification(commission.professionals.user_id, "Payment Credited", `₹${amount} has been credited to your wallet.`, { type: "commission_paid", commission_id: String(commission.id) });
            }
        } catch (_) {}

        auditLog(req, "mark_commission_paid", {
            entity_type: "commission",
            entity_id:   Number(req.params.id),
        });

        log.info("[admin] commission marked paid", { commissionId: req.params.id });
        res.json({ success: true, data: result });
    } catch (err) {
        log.error("[admin] markCommissionPaid — failed", { commissionId: req.params.id, error: err.message });
        const status = err.message === "COMMISSION_NOT_FOUND"    ? 404
                     : err.message === "ALREADY_PAID"            ? 409
                     : err.message === "COMMISSION_NOT_APPROVED" ? 422
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

        auditLog(req, "mark_travelling_allowance_paid", {
            entity_type: "travelling_allowance",
            entity_id:   Number(req.params.id),
        });

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
        log.info("[admin] reject registration", { pendingId: req.params.id, adminId: req.admin?.userId });
        const result = await service.rejectRegistration(
            req.params.id,
            req.admin.userId,
            req.body?.note
        );
        log.info("[admin] registration rejected", { pendingId: req.params.id });

        auditLog(req, "reject_registration", {
            entity_type: "pending_registration",
            entity_id:   Number(req.params.id),
            details:     { note: req.body?.note ?? null },
        });

        // Notify the registrant of rejection
        try {
            const pending = await prisma.pending_registrations.findUnique({
                where:  { id: Number(req.params.id) },
                select: { form_data: true },
            });
            const formData = typeof pending?.form_data === "string"
                ? JSON.parse(pending.form_data)
                : pending?.form_data;
                
            const userId = formData?.user_id ?? formData?.userId ?? null;
            const fcmToken = formData?.fcm_token ?? formData?.fcmToken ?? null;
            
            const title = "Registration Rejected";
            const body = "Your registration has been rejected by the admin.";

            if (userId) {
                sendNotification(userId, title, body, { type: "registration_rejected" });
            } else if (fcmToken) {
                const { sendNotificationToToken } = require("../../utils/fcm");
                sendNotificationToToken(fcmToken, title, body, { type: "registration_rejected" });
            }
        } catch (_) {}

        res.json({ success: true, ...result });
    } catch (err) {
        log.error("[admin] reject registration — failed", { pendingId: req.params.id, error: err.message });
        const status = err.message === "PENDING_NOT_FOUND" ? 404
                     : err.message === "ALREADY_REVIEWED"  ? 409
                     : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};


// ── Payments ──────────────────────────────────────────────────────────────

// ── Admin Profit Stats ─────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/dashboard/profit-stats
 * Optional query params: ?from=2025-01-01&to=2025-12-31
 *
 * Returns:
 *  - gross_revenue           : total captured payments (what students paid)
 *  - total_base_amount       : sum of base_amount across all commission rows
 *  - total_commission_paid_out: sum of commission_amount (what professionals earned)
 *  - total_admin_profit      : base_amount - commission_amount (admin's share)
 *  - realised_profit         : same calculation but only for STATUS = 'paid' rows
 *  - by_status               : per-status breakdown (on_hold / pending / approved / paid)
 *    └ by_professional_type  : further split by trainer / teacher / marketing_executive
 */
exports.getAdminProfitStats = async (req, res) => {
    try {
        const { from, to } = req.query;
        const data = await service.getAdminProfitStats({ from, to });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.listPayments = async (req, res) => {
    try {
        const { service_type, status, user_id, from, to } = req.query;
        const data = await service.listPayments({ serviceType: service_type, status, userId: user_id, from, to });
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.listPayIns = async (req, res) => {
    try {
        const { service_type, from, to } = req.query;
        const data = await service.listPayIns({ serviceType: service_type, from, to });
        res.json({ success: true, ...data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.listPayOuts = async (req, res) => {
    try {
        const { professional_type, commission_status, refund_status, from, to } = req.query;
        const data = await service.listPayOuts({
            professionalType:  professional_type,
            commissionStatus:  commission_status,
            refundStatus:      refund_status,
            from,
            to,
        });
        res.json({ success: true, ...data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.markRefundProcessed = async (req, res) => {
    try {
        await service.markRefundProcessed(req.params.id);

        auditLog(req, "mark_refund_processed", {
            entity_type: "refund",
            entity_id:   Number(req.params.id),
        });

        res.json({ success: true, message: "Refund marked as processed." });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
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

        auditLog(req, "create_session", {
            entity_type: "session",
            entity_id:   data.id ?? null,
            details:     {
                session_type:    req.body.session_type ?? null,
                professional_id: req.body.professional_id ?? null,
                date:            req.body.date ?? null,
            },
        });

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

exports.getProfessionalsAvailability = async (req, res) => {
    try {
        const { type, day_of_week, start_time, end_time } = req.query;
        console.log('[availability] query:', { type, day_of_week, start_time, end_time });
        if (!type) return res.status(400).json({ success: false, error: "type is required (teacher | trainer)" });
        const data = await service.getProfessionalsAvailability(type, { dayOfWeek: day_of_week, startTime: start_time, endTime: end_time });
        console.log('[availability] result count:', data.length, 'busy:', data.filter(d=>!d.is_available).map(d=>d.id));
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

exports.getProfessionalsByActivity = async (req, res) => {
    try {
        const { activityId } = req.params;
        const { type } = req.query;
        if (!type || (type !== "trainer" && type !== "teacher")) {
            return res.status(400).json({ success: false, error: "type is required (trainer | teacher)" });
        }
        const data = type === "trainer"
            ? await service.getTrainersForActivity(activityId)
            : await service.getTeachersForSubject(activityId);
        res.json({ success: true, count: data.length, data });
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

exports.createActivity = async (req, res) => {
    try {
        const image_url = req.file?.path ?? null;
        const adminUserId = req.user?.userId ?? null;
        // fee_structures may arrive as a JSON string from multipart form
        let fee_structures = req.body.fee_structures;
        if (typeof fee_structures === "string") {
            try { fee_structures = JSON.parse(fee_structures); } catch { fee_structures = undefined; }
        }
        const data = await service.createActivity({ ...req.body, image_url, fee_structures, adminUserId });
        auditLog(req, "create_activity", { entity_type: "activity", entity_id: data.id });
        res.status(201).json({ success: true, data });
    } catch (err) {
        const status = ["ACTIVITY_NAME_REQUIRED", "ACTIVITY_CATEGORY_REQUIRED", "INVALID_FEE_STRUCTURE"].includes(err.message) ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.updateActivity = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const image_url = req.file?.path ?? undefined;
        const data = await service.updateActivity(id, { ...req.body, ...(image_url !== undefined && { image_url }) });
        auditLog(req, "update_activity", { entity_type: "activity", entity_id: id });
        res.json({ success: true, data });
    } catch (err) {
        const status = err.message === "ACTIVITY_NOT_FOUND" ? 404 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.deleteActivity = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const force = req.query.force === "true";
        await service.deleteActivity(id, force);
        auditLog(req, "delete_activity", { entity_type: "activity", entity_id: id, details: { force } });
        res.json({ success: true });
    } catch (err) {
        const status = err.message === "ACTIVITY_NOT_FOUND" ? 404
                     : err.message === "ACTIVITY_HAS_HISTORY" ? 409 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.reject = async (req, res) => {
    try {
        const result = await service.rejectRegistration(
            req.params.id,
            req.admin.userId,
            req.body?.note
        );

        // Notify the registrant
        try {
            const pending = await prisma.pending_registrations.findUnique({
                where:  { id: Number(req.params.id) },
                select: { form_data: true },
            });
            const formData = typeof pending?.form_data === "string"
                ? JSON.parse(pending.form_data)
                : pending?.form_data;
            const userId = formData?.user_id ?? formData?.userId ?? null;
            if (userId) {
                sendNotification(userId, "Registration Rejected", "Your registration was not approved. Please contact support.", { type: "registration_rejected" });
            }
        } catch (_) {}

        auditLog(req, "reject_registration", {
            entity_type: "pending_registration",
            entity_id:   Number(req.params.id),
            details:     { note: req.body?.note ?? null },
        });

        res.json({ success: true, ...result });
    } catch (err) {
        log.error("[admin] reject (duplicate handler) — failed", { pendingId: req.params.id, error: err.message });
        const status = err.message === "PENDING_NOT_FOUND" ? 404
                     : err.message === "ALREADY_REVIEWED"  ? 409
                     : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

// ── Legal content ──────────────────────────────────────────────────────────

exports.upsertLegalContent = async (req, res) => {
    try {
        const { dashboard_type, content_type, content } = req.body;
        const data = await service.upsertLegalContent({ dashboard_type, content_type, content }, req.admin.userId);

        auditLog(req, "upsert_legal_content", {
            entity_type: "legal_content",
            entity_id:   data.id ?? null,
            details:     { dashboard_type, content_type },
        });

        res.status(200).json({ success: true, data });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.getLegalContent = async (req, res) => {
    try {
        const { dashboard_type, content_type } = req.query;
        const data = await service.getLegalContent({ dashboard_type, content_type });
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// ── Audit logs ────────────────────────────────────────────────────────────

exports.getAuditLogs = async (req, res) => {
    try {
        const { admin_user_id, action, from, to, limit, offset } = req.query;
        const data = await service.getAuditLogs({ adminUserId: admin_user_id, action, from, to, limit, offset });
        res.json({ success: true, total: data.total, count: data.rows.length, data: data.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// ── Sub-admin management ───────────────────────────────────────────────────

exports.listAdmins = async (req, res) => {
    try {
        const data = await service.listAdmins();
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.createSubAdmin = async (req, res) => {
    try {
        const { full_name, mobile, email } = req.body;
        const data = await service.createSubAdmin({ full_name, mobile, email });

        auditLog(req, "create_sub_admin", {
            entity_type: "user",
            entity_id:   data.user_id,
            details:     { full_name, mobile },
        });

        res.status(201).json({ success: true, data });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.removeSubAdmin = async (req, res) => {
    try {
        await service.removeSubAdmin(req.params.userId);

        auditLog(req, "remove_sub_admin", {
            entity_type: "user",
            entity_id:   Number(req.params.userId),
        });

        res.json({ success: true, message: "Sub-admin removed successfully." });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

// ── Support tickets ────────────────────────────────────────────────────────

exports.listSupportTickets = async (req, res) => {
    try {
        const { status } = req.query; // open | resolved (optional)
        const data = await service.listSupportTickets({ status });
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.resolveSupportTicket = async (req, res) => {
    try {
        const data = await service.resolveSupportTicket(req.params.id, req.admin.userId);

        auditLog(req, "resolve_support_ticket", {
            entity_type: "support_ticket",
            entity_id:   Number(req.params.id),
        });

        res.json({ success: true, data });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

// ── User management (super_admin) ─────────────────────────────────────────

exports.listUsers = async (req, res) => {
    try {
        const { role, subrole, search, limit, offset } = req.query;
        const data = await service.listUsers({ role, subrole, search, limit, offset });
        res.json({ success: true, total: data.total, count: data.rows.length, data: data.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getUser = async (req, res) => {
    try {
        const data = await service.getUserById(req.params.userId);
        res.json({ success: true, data });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.editUser = async (req, res) => {
    try {
        const data = await service.editUser(req.params.userId, req.body, req.admin.userId);

        auditLog(req, "edit_user", {
            entity_type: "user",
            entity_id:   Number(req.params.userId),
            details:     { updated_fields: Object.keys(req.body) },
        });

        res.json({ success: true, data });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.suspendUser = async (req, res) => {
    try {
        log.info("[admin] suspendUser", { targetUserId: req.params.userId, adminId: req.admin?.userId, note: req.body?.note });
        const result = await service.suspendUser(req.params.userId, req.admin.userId, req.body?.note);

        auditLog(req, "suspend_user", {
            entity_type: "user",
            entity_id:   Number(req.params.userId),
            details:     { note: req.body?.note ?? null },
        });

        log.info("[admin] user suspended", { targetUserId: req.params.userId });
        res.json({ success: true, ...result });
    } catch (err) {
        log.error("[admin] suspendUser — failed", { targetUserId: req.params.userId, error: err.message });
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.unsuspendUser = async (req, res) => {
    try {
        log.info("[admin] unsuspendUser", { targetUserId: req.params.userId, adminId: req.admin?.userId });
        const result = await service.unsuspendUser(req.params.userId);

        auditLog(req, "unsuspend_user", {
            entity_type: "user",
            entity_id:   Number(req.params.userId),
        });

        log.info("[admin] user unsuspended", { targetUserId: req.params.userId });
        res.json({ success: true, ...result });
    } catch (err) {
        log.error("[admin] unsuspendUser — failed", { targetUserId: req.params.userId, error: err.message });
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

// ── Visiting Forms ────────────────────────────────────────────────────────────

exports.listVisitingForms = async (req, res) => {
    try {
        const { meId, placeType, permissionStatus, from, to, page, limit } = req.query;
        const result = await service.listVisitingForms({ meId, placeType, permissionStatus, from, to, page, limit });
        res.json({ success: true, ...result });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.getVisitingFormByIdAdmin = async (req, res) => {
    try {
        const data = await service.getVisitingFormByIdAdmin(req.params.id);
        res.json({ success: true, data });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

// ── Enriched Sessions & Settle (trainer / teacher) ─────────────────────────

/**
 * GET /api/v1/admin/professionals/:professionalId/sessions-settle
 *
 * Returns all active assignments with full session breakdown:
 *   batch info, session cycle, completed/upcoming/absent counts,
 *   commission rate, and trainer_earns ready to settle.
 */
exports.getSessionsSettle = async (req, res) => {
    try {
        const { professionalId } = req.params;
        const data = await service.getEnrichedSettlementPreview(Number(professionalId));
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

/**
 * GET /api/v1/admin/professionals/:professionalId/payouts
 *
 * Returns all commission records for a professional (their Payouts tab).
 */
exports.getProfessionalPayouts = async (req, res) => {
    try {
        const { professionalId } = req.params;
        const data = await service.getProfessionalPayouts(Number(professionalId));
        const pending = data.filter((c) => c.status === "pending" || c.status === "approved")
                            .reduce((s, c) => s + c.commission_amount, 0);
        res.json({ success: true, pending_payout: parseFloat(pending.toFixed(2)), count: data.length, data });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

// ── ME settlement ──────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/professionals/:professionalId/me-settlement-preview
 *
 * Returns all societies for the ME with activity count and student count.
 */
exports.getMESettlementPreview = async (req, res) => {
    try {
        const { professionalId } = req.params;
        const data = await service.getMESettlementPreview(Number(professionalId));
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

/**
 * GET /api/v1/admin/professionals/:professionalId/me-societies/:societyId/describe
 *
 * Returns student breakdown for "Describe Settlement" modal:
 *   student name, activity, months, upfront fee, ME earns (5%).
 */
exports.getMESettlementDescribe = async (req, res) => {
    try {
        const { professionalId, societyId } = req.params;
        const data = await service.getMESettlementDescribe(Number(professionalId), Number(societyId));
        res.json({ success: true, data });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

/**
 * POST /api/v1/admin/professionals/:professionalId/me-societies/:societyId/settle
 *
 * Settle ME commission for a society.
 * Validates 20-student threshold, then moves on_hold commissions to pending.
 */
exports.settleMECommission = async (req, res) => {
    try {
        const { professionalId, societyId } = req.params;
        const result = await service.settleMECommission(Number(professionalId), Number(societyId));

        auditLog(req, "settle_me_commission", {
            entity_type: "me_settlement",
            entity_id:   Number(professionalId),
            details:     { society_id: Number(societyId), commissions_released: result.commissions_released },
        });

        res.json({ success: true, ...result });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

// ── Vendor panel ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/professionals/:professionalId/vendor-panel
 *
 * Returns vendor's listed products and recent orders with full commission breakup.
 */
exports.getVendorPanel = async (req, res) => {
    try {
        const { professionalId } = req.params;
        const data = await service.getVendorPanel(Number(professionalId));
        res.json({ success: true, data });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

/**
 * POST /api/v1/admin/professionals/:professionalId/vendor-orders/:orderId/settle
 *
 * Settle a specific kit order commission — moves it to pending for payout processing.
 */
exports.settleVendorOrder = async (req, res) => {
    try {
        const { professionalId, orderId } = req.params;
        const result = await service.settleVendorOrder(Number(professionalId), Number(orderId));

        auditLog(req, "settle_vendor_order", {
            entity_type: "vendor_settlement",
            entity_id:   Number(professionalId),
            details:     { order_id: Number(orderId), commission_id: result.commission_id },
        });

        res.json({ success: true, ...result });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

// ── Bulk session deletion ─────────────────────────────────────────────────

exports.deleteSessionsByStudent = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { activity_id } = req.query;
        const result = await service.deleteSessionsByStudent(studentId, activity_id);
        auditLog(req, "bulk_delete_sessions", { entity_type: "student", entity_id: Number(studentId), details: result });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(err.status || 500).json({ success: false, error: err.message });
    }
};

exports.deleteSessionsByBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const result = await service.deleteSessionsByBatch(batchId);
        auditLog(req, "bulk_delete_sessions", { entity_type: "batch", entity_id: Number(batchId), details: result });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(err.status || 500).json({ success: false, error: err.message });
    }
};

exports.deleteSessionsBySociety = async (req, res) => {
    try {
        const { societyId } = req.params;
        const result = await service.deleteSessionsBySociety(societyId);
        auditLog(req, "bulk_delete_sessions", { entity_type: "society", entity_id: Number(societyId), details: result });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(err.status || 500).json({ success: false, error: err.message });
    }
};

exports.deleteSessionsBySchool = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const result = await service.deleteSessionsBySchool(schoolId);
        auditLog(req, "bulk_delete_sessions", { entity_type: "school", entity_id: Number(schoolId), details: result });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(err.status || 500).json({ success: false, error: err.message });
    }
};
