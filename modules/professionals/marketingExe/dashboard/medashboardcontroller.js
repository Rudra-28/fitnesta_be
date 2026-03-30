const service = require("./medashboardservice");
const { validateMeSociety, validateMeSchool } = require("./medashboardvalidate");

const handleErr = (err, res) => {
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Internal server error"
    });
};

// ── Dashboard Summary ────────────────────────────────────────────────────────

exports.getSummary = async (req, res) => {
    try {
        const data = await service.getSummary(req.me.userId);
        res.json({ success: true, data });
    } catch (err) { handleErr(err, res); }
};

// ── Society ──────────────────────────────────────────────────────────────────

exports.registerSociety = async (req, res) => {
    try {
        const data = { ...req.body };

        if (req.files?.activityAgreementPdf?.[0]) {
            data.activityAgreementPdf = req.files.activityAgreementPdf[0].path;
        }

        data.playgroundAvailable       = data.playgroundAvailable       === 'true' || data.playgroundAvailable       === true;
        data.agreementSignedByAuthority = data.agreementSignedByAuthority === 'true' || data.agreementSignedByAuthority === true;

        const errors = validateMeSociety(data);
        if (errors.length > 0)
            return res.status(400).json({ success: false, errors });

        const result = await service.registerSociety(data, req.me.userId);
        return res.status(201).json(result);

    } catch (err) { handleErr(err, res); }
};

exports.getMySocieties = async (req, res) => {
    try {
        const data = await service.getMySocieties(req.me.userId);
        res.json({ success: true, count: data.length, data });
    } catch (err) { handleErr(err, res); }
};

exports.getSocietyById = async (req, res) => {
    try {
        const data = await service.getSocietyById(Number(req.params.id), req.me.userId);
        res.json({ success: true, data });
    } catch (err) { handleErr(err, res); }
};

// ── School ───────────────────────────────────────────────────────────────────

exports.registerSchool = async (req, res) => {
    try {
        const data = { ...req.body };

        if (req.files?.activityAgreementPdf?.[0]) {
            data.activityAgreementPdf = req.files.activityAgreementPdf[0].path;
        }

        data.agreementSignedByAuthority = data.agreementSignedByAuthority === 'true' || data.agreementSignedByAuthority === true;

        const errors = validateMeSchool(data);
        if (errors.length > 0)
            return res.status(400).json({ success: false, errors });

        const result = await service.registerSchool(data, req.me.userId);
        return res.status(201).json(result);

    } catch (err) { handleErr(err, res); }
};

exports.getMySchools = async (req, res) => {
    try {
        const data = await service.getMySchools(req.me.userId);
        res.json({ success: true, count: data.length, data });
    } catch (err) { handleErr(err, res); }
};

exports.getMySchoolsEnrollment = async (req, res) => {
    try {
        const data = await service.getMySchoolsEnrollment(req.me.userId);
        res.json({ success: true, data });
    } catch (err) { handleErr(err, res); }
};

// ── Students ──────────────────────────────────────────────────────────────────

exports.getSchoolStudents = async (req, res) => {
    try {
        const data = await service.getSchoolStudents(req.me.userId);
        res.json({ success: true, data });
    } catch (err) { handleErr(err, res); }
};

exports.getSocietyStudents = async (req, res) => {
    try {
        const data = await service.getSocietyStudents(req.me.userId);
        res.json({ success: true, data });
    } catch (err) { handleErr(err, res); }
};

exports.getStudentsBySchool = async (req, res) => {
    try {
        const data = await service.getStudentsBySchool(Number(req.params.schoolId), req.me.userId);
        res.json({ success: true, data });
    } catch (err) { handleErr(err, res); }
};

exports.getSchoolStudentById = async (req, res) => {
    try {
        const data = await service.getSchoolStudentById(Number(req.params.id), req.me.userId);
        res.json({ success: true, data });
    } catch (err) { handleErr(err, res); }
};

exports.getStudentsBySociety = async (req, res) => {
    try {
        const data = await service.getStudentsBySociety(Number(req.params.societyId), req.me.userId);
        res.json({ success: true, data });
    } catch (err) { handleErr(err, res); }
};

exports.getSchoolById = async (req, res) => {
    try {
        const data = await service.getSchoolById(Number(req.params.id), req.me.userId);
        res.json({ success: true, data });
    } catch (err) { handleErr(err, res); }
};
