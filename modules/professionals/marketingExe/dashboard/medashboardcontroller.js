const service = require("./medashboardservice");
const { validateMeSociety, validateMeSchool, validateVisitingForm } = require("./medashboardvalidate");
const cloudinary = require("../../../../config/cloudinary");
const prisma = require("../../../../config/prisma");
const fs = require("fs");
const log = require("../../../../utils/logger");

const handleErr = (err, res) => {
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Internal server error"
    });
};

// ── Earnings ─────────────────────────────────────────────────────────────────

exports.getEarnings = async (req, res) => {
    try {
        const data = await service.getEarnings(req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        handleErr(err, res);
    }
};

exports.getWalletSummary = async (req, res) => {
    try {
        const data = await service.getWalletSummary(req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        handleErr(err, res);
    }
};

exports.getWalletBreakdown = async (req, res) => {
    try {
        const data = await service.getWalletBreakdown(req.me.userId, req.params.status);
        res.json({ success: true, data });
    } catch (err) {
        handleErr(err, res);
    }
};

exports.getTransactionHistory = async (req, res) => {
    try {
        const { status, source_type, page, limit } = req.query;
        const data = await service.getTransactionHistory(req.me.userId, {
            status, source_type,
            page:  page  ? Number(page)  : 1,
            limit: limit ? Number(limit) : 20,
        });
        res.json({ success: true, ...data });
    } catch (err) {
        handleErr(err, res);
    }
};


// ── Dashboard Summary ────────────────────────────────────────────────────────

exports.getSummary = async (req, res) => {
    try {
        log.info(`[ME] getSummary — userId: ${req.me.userId}`);
        const data = await service.getSummary(req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        log.error(`[ME] getSummary error: ${err.message}`);
        handleErr(err, res);
    }
};

// ── Society ──────────────────────────────────────────────────────────────────

exports.registerSociety = async (req, res) => {
    try {
        log.info(`[ME] registerSociety called — userId: ${req.me.userId}`);
        const data = { ...req.body };

        let localFilePath = null;
        if (req.files?.activityAgreementPdf?.[0]) {
            localFilePath = req.files.activityAgreementPdf[0].path;
            // Temporarily set to null; will be updated in background
            data.activityAgreementPdf = null;
        }

        data.playgroundAvailable       = data.playgroundAvailable       === 'true' || data.playgroundAvailable       === true;
        data.agreementSignedByAuthority = data.agreementSignedByAuthority === 'true' || data.agreementSignedByAuthority === true;

        const errors = validateMeSociety(data);
        if (errors.length > 0) {
            log.warn(`[ME] registerSociety validation failed — userId: ${req.me.userId}:`, errors);
            return res.status(400).json({ success: false, errors });
        }

        const result = await service.registerSociety(data, req.me.userId);
        log.info(`[ME] Society registered — userId: ${req.me.userId}, society: ${data.societyName || data.name}`);
        
        // Respond to user right away to prevent timeout
        res.status(201).json(result);

        // Upload to Cloudinary in background
        if (localFilePath) {
            (async () => {
                try {
                    log.info(`[ME] Uploading society document to Cloudinary in background for societyId: ${result.societyId}`);
                    const uploadResult = await cloudinary.uploader.upload(localFilePath, {
                        folder: "fitnesta/documents",
                        resource_type: "auto",
                    });
                    await prisma.societies.update({
                        where: { id: result.societyId },
                        data: { activity_agreement_pdf: uploadResult.secure_url }
                    });
                    log.info(`[ME] Cloudinary upload successful for societyId: ${result.societyId}`);
                    if (fs.existsSync(localFilePath)) {
                        fs.unlinkSync(localFilePath);
                    }
                } catch (bgErr) {
                    log.error(`[ME] Background upload error for societyId: ${result.societyId}:`, bgErr.message);
                }
            })();
        }

    } catch (err) {
        log.error(`[ME] registerSociety error — userId: ${req.me.userId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getMySocieties = async (req, res) => {
    try {
        log.info(`[ME] getMySocieties — userId: ${req.me.userId}`);
        const data = await service.getMySocieties(req.me.userId);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        log.error(`[ME] getMySocieties error — userId: ${req.me.userId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getSocietyById = async (req, res) => {
    try {
        log.info(`[ME] getSocietyById — userId: ${req.me.userId}, societyId: ${req.params.id}`);
        const data = await service.getSocietyById(Number(req.params.id), req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        log.error(`[ME] getSocietyById error — userId: ${req.me.userId}, societyId: ${req.params.id}: ${err.message}`);
        handleErr(err, res);
    }
};

// ── School ───────────────────────────────────────────────────────────────────

exports.registerSchool = async (req, res) => {
    try {
        log.info(`[ME] registerSchool called — userId: ${req.me.userId}`);
        const data = { ...req.body };

        let localFilePath = null;
        if (req.files?.activityAgreementPdf?.[0]) {
            localFilePath = req.files.activityAgreementPdf[0].path;
            // Temporarily set to null; will be updated in background
            data.activityAgreementPdf = null;
        }

        data.agreementSignedByAuthority = data.agreementSignedByAuthority === 'true' || data.agreementSignedByAuthority === true;

        const errors = validateMeSchool(data);
        if (errors.length > 0) {
            log.warn(`[ME] registerSchool validation failed — userId: ${req.me.userId}:`, errors);
            return res.status(400).json({ success: false, errors });
        }

        const result = await service.registerSchool(data, req.me.userId);
        log.info(`[ME] School registered — userId: ${req.me.userId}, school: ${data.schoolName || data.name}`);
        res.status(201).json(result);

        // Upload to Cloudinary in background
        if (localFilePath) {
            (async () => {
                try {
                    log.info(`[ME] Uploading school document to Cloudinary in background for schoolId: ${result.schoolId}`);
                    const uploadResult = await cloudinary.uploader.upload(localFilePath, {
                        folder: "fitnesta/documents",
                        resource_type: "auto",
                    });
                    await prisma.schools.update({
                        where: { id: result.schoolId },
                        data: { activity_agreement_pdf: uploadResult.secure_url }
                    });
                    log.info(`[ME] Cloudinary upload successful for schoolId: ${result.schoolId}`);
                    if (fs.existsSync(localFilePath)) {
                        fs.unlinkSync(localFilePath);
                    }
                } catch (bgErr) {
                    log.error(`[ME] Background upload error for schoolId: ${result.schoolId}:`, bgErr.message);
                }
            })();
        }

    } catch (err) {
        log.error(`[ME] registerSchool error — userId: ${req.me.userId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getMySchools = async (req, res) => {
    try {
        log.info(`[ME] getMySchools — userId: ${req.me.userId}`);
        const data = await service.getMySchools(req.me.userId);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        log.error(`[ME] getMySchools error — userId: ${req.me.userId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getMySchoolsEnrollment = async (req, res) => {
    try {
        log.info(`[ME] getMySchoolsEnrollment — userId: ${req.me.userId}`);
        const data = await service.getMySchoolsEnrollment(req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        log.error(`[ME] getMySchoolsEnrollment error — userId: ${req.me.userId}: ${err.message}`);
        handleErr(err, res);
    }
};

// ── Students ──────────────────────────────────────────────────────────────────

exports.getSchoolStudents = async (req, res) => {
    try {
        log.info(`[ME] getSchoolStudents — userId: ${req.me.userId}`);
        const data = await service.getSchoolStudents(req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        log.error(`[ME] getSchoolStudents error — userId: ${req.me.userId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getSocietyStudents = async (req, res) => {
    try {
        log.info(`[ME] getSocietyStudents — userId: ${req.me.userId}`);
        const data = await service.getSocietyStudents(req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        log.error(`[ME] getSocietyStudents error — userId: ${req.me.userId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getStudentsBySchool = async (req, res) => {
    try {
        log.info(`[ME] getStudentsBySchool — userId: ${req.me.userId}, schoolId: ${req.params.schoolId}`);
        const data = await service.getStudentsBySchool(Number(req.params.schoolId), req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        log.error(`[ME] getStudentsBySchool error — userId: ${req.me.userId}, schoolId: ${req.params.schoolId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getSchoolStudentById = async (req, res) => {
    try {
        log.info(`[ME] getSchoolStudentById — userId: ${req.me.userId}, studentId: ${req.params.id}`);
        const data = await service.getSchoolStudentById(Number(req.params.id), req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        log.error(`[ME] getSchoolStudentById error — userId: ${req.me.userId}, studentId: ${req.params.id}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getStudentsBySociety = async (req, res) => {
    try {
        log.info(`[ME] getStudentsBySociety — userId: ${req.me.userId}, societyId: ${req.params.societyId}`);
        const data = await service.getStudentsBySociety(Number(req.params.societyId), req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        log.error(`[ME] getStudentsBySociety error — userId: ${req.me.userId}, societyId: ${req.params.societyId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getSchoolById = async (req, res) => {
    try {
        log.info(`[ME] getSchoolById — userId: ${req.me.userId}, schoolId: ${req.params.id}`);
        const data = await service.getSchoolById(Number(req.params.id), req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        log.error(`[ME] getSchoolById error — userId: ${req.me.userId}, schoolId: ${req.params.id}: ${err.message}`);
        handleErr(err, res);
    }
};

// ── Visiting Form ─────────────────────────────────────────────────────────────

exports.getMeReferralCodes = async (req, res) => {
    try {
        const data = await service.getMeReferralCodes();
        res.json({ success: true, data });
    } catch (err) {
        handleErr(err, res);
    }
};

exports.submitVisitingForm = async (req, res) => {
    try {
        log.info(`[ME] submitVisitingForm — userId: ${req.me.userId}`);
        const data = { ...req.body };

        const errors = validateVisitingForm(data);
        if (errors.length > 0) {
            log.warn(`[ME] submitVisitingForm validation failed — userId: ${req.me.userId}:`, errors);
            return res.status(400).json({ success: false, errors });
        }

        const result = await service.submitVisitingForm(data, req.me.userId);
        log.info(`[ME] Visiting form submitted — userId: ${req.me.userId}, formId: ${result.formId}`);
        res.status(201).json(result);
    } catch (err) {
        log.error(`[ME] submitVisitingForm error — userId: ${req.me.userId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getMyVisitingForms = async (req, res) => {
    try {
        log.info(`[ME] getMyVisitingForms — userId: ${req.me.userId}`);
        const data = await service.getMyVisitingForms(req.me.userId);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        log.error(`[ME] getMyVisitingForms error — userId: ${req.me.userId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getVisitingFormById = async (req, res) => {
    try {
        log.info(`[ME] getVisitingFormById — userId: ${req.me.userId}, formId: ${req.params.id}`);
        const data = await service.getVisitingFormById(Number(req.params.id), req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        log.error(`[ME] getVisitingFormById error — userId: ${req.me.userId}, formId: ${req.params.id}: ${err.message}`);
        handleErr(err, res);
    }
};
