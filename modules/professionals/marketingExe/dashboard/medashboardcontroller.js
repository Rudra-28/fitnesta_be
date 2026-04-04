const service = require("./medashboardservice");
const { validateMeSociety, validateMeSchool } = require("./medashboardvalidate");

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

exports.getWalletBreakdown = async (req, res) => {
    try {
        const data = await service.getWalletBreakdown(req.me.userId, req.params.status);
        res.json({ success: true, data });
    } catch (err) {
        handleErr(err, res);
    }
};

// ── Dashboard Summary ────────────────────────────────────────────────────────

exports.getSummary = async (req, res) => {
    try {
        console.log(`[ME] getSummary — userId: ${req.me.userId}`);
        const data = await service.getSummary(req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        console.error(`[ME] getSummary error: ${err.message}`);
        handleErr(err, res);
    }
};

// ── Society ──────────────────────────────────────────────────────────────────

exports.registerSociety = async (req, res) => {
    try {
        console.log(`[ME] registerSociety called — userId: ${req.me.userId}`);
        const data = { ...req.body };

        if (req.files?.activityAgreementPdf?.[0]) {
            data.activityAgreementPdf = req.files.activityAgreementPdf[0].path;
        }

        data.playgroundAvailable       = data.playgroundAvailable       === 'true' || data.playgroundAvailable       === true;
        data.agreementSignedByAuthority = data.agreementSignedByAuthority === 'true' || data.agreementSignedByAuthority === true;

        const errors = validateMeSociety(data);
        if (errors.length > 0) {
            console.warn(`[ME] registerSociety validation failed — userId: ${req.me.userId}:`, errors);
            return res.status(400).json({ success: false, errors });
        }

        const result = await service.registerSociety(data, req.me.userId);
        console.log(`[ME] Society registered — userId: ${req.me.userId}, society: ${data.societyName || data.name}`);
        return res.status(201).json(result);

    } catch (err) {
        console.error(`[ME] registerSociety error — userId: ${req.me.userId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getMySocieties = async (req, res) => {
    try {
        console.log(`[ME] getMySocieties — userId: ${req.me.userId}`);
        const data = await service.getMySocieties(req.me.userId);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        console.error(`[ME] getMySocieties error — userId: ${req.me.userId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getSocietyById = async (req, res) => {
    try {
        console.log(`[ME] getSocietyById — userId: ${req.me.userId}, societyId: ${req.params.id}`);
        const data = await service.getSocietyById(Number(req.params.id), req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        console.error(`[ME] getSocietyById error — userId: ${req.me.userId}, societyId: ${req.params.id}: ${err.message}`);
        handleErr(err, res);
    }
};

// ── School ───────────────────────────────────────────────────────────────────

exports.registerSchool = async (req, res) => {
    try {
        console.log(`[ME] registerSchool called — userId: ${req.me.userId}`);
        const data = { ...req.body };

        if (req.files?.activityAgreementPdf?.[0]) {
            data.activityAgreementPdf = req.files.activityAgreementPdf[0].path;
        }

        data.agreementSignedByAuthority = data.agreementSignedByAuthority === 'true' || data.agreementSignedByAuthority === true;

        const errors = validateMeSchool(data);
        if (errors.length > 0) {
            console.warn(`[ME] registerSchool validation failed — userId: ${req.me.userId}:`, errors);
            return res.status(400).json({ success: false, errors });
        }

        const result = await service.registerSchool(data, req.me.userId);
        console.log(`[ME] School registered — userId: ${req.me.userId}, school: ${data.schoolName || data.name}`);
        return res.status(201).json(result);

    } catch (err) {
        console.error(`[ME] registerSchool error — userId: ${req.me.userId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getMySchools = async (req, res) => {
    try {
        console.log(`[ME] getMySchools — userId: ${req.me.userId}`);
        const data = await service.getMySchools(req.me.userId);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        console.error(`[ME] getMySchools error — userId: ${req.me.userId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getMySchoolsEnrollment = async (req, res) => {
    try {
        console.log(`[ME] getMySchoolsEnrollment — userId: ${req.me.userId}`);
        const data = await service.getMySchoolsEnrollment(req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        console.error(`[ME] getMySchoolsEnrollment error — userId: ${req.me.userId}: ${err.message}`);
        handleErr(err, res);
    }
};

// ── Students ──────────────────────────────────────────────────────────────────

exports.getSchoolStudents = async (req, res) => {
    try {
        console.log(`[ME] getSchoolStudents — userId: ${req.me.userId}`);
        const data = await service.getSchoolStudents(req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        console.error(`[ME] getSchoolStudents error — userId: ${req.me.userId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getSocietyStudents = async (req, res) => {
    try {
        console.log(`[ME] getSocietyStudents — userId: ${req.me.userId}`);
        const data = await service.getSocietyStudents(req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        console.error(`[ME] getSocietyStudents error — userId: ${req.me.userId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getStudentsBySchool = async (req, res) => {
    try {
        console.log(`[ME] getStudentsBySchool — userId: ${req.me.userId}, schoolId: ${req.params.schoolId}`);
        const data = await service.getStudentsBySchool(Number(req.params.schoolId), req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        console.error(`[ME] getStudentsBySchool error — userId: ${req.me.userId}, schoolId: ${req.params.schoolId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getSchoolStudentById = async (req, res) => {
    try {
        console.log(`[ME] getSchoolStudentById — userId: ${req.me.userId}, studentId: ${req.params.id}`);
        const data = await service.getSchoolStudentById(Number(req.params.id), req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        console.error(`[ME] getSchoolStudentById error — userId: ${req.me.userId}, studentId: ${req.params.id}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getStudentsBySociety = async (req, res) => {
    try {
        console.log(`[ME] getStudentsBySociety — userId: ${req.me.userId}, societyId: ${req.params.societyId}`);
        const data = await service.getStudentsBySociety(Number(req.params.societyId), req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        console.error(`[ME] getStudentsBySociety error — userId: ${req.me.userId}, societyId: ${req.params.societyId}: ${err.message}`);
        handleErr(err, res);
    }
};

exports.getSchoolById = async (req, res) => {
    try {
        console.log(`[ME] getSchoolById — userId: ${req.me.userId}, schoolId: ${req.params.id}`);
        const data = await service.getSchoolById(Number(req.params.id), req.me.userId);
        res.json({ success: true, data });
    } catch (err) {
        console.error(`[ME] getSchoolById error — userId: ${req.me.userId}, schoolId: ${req.params.id}: ${err.message}`);
        handleErr(err, res);
    }
};
