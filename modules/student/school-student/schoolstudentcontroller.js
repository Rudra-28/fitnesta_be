const service = require("./schoolstudentservice");
const jwt = require("jsonwebtoken");
const { validateSchoolStudent } = require("./schoolstudentvalidation");
const schoolRepo = require("../../school/schoolrepo");
const log = require("../../../utils/logger");

/**
 * PHASE 1 — Flutter submits the school student enrollment form.
 *
 * Extra field required (on top of existing form fields):
 *   activity_id  {number}  — selected activity's ID from the activities list
 *                            (term is always 9 months, no need to send term_months)
 *
 * Response: { success, temp_uuid, order_id, amount, currency, key_id }
 */
exports.submitRegistration = async (req, res) => {
    try {
        log.info("[SS] submitRegistration called");
        const formData = req.body;
        const serviceType = "school_student";

        const errors = validateSchoolStudent(formData);
        if (errors.length > 0) {
            log.warn("[SS] Validation failed", { errors });
            return res.status(400).json({ success: false, errors });
        }

        const school = await schoolRepo.getSchoolByName(formData.schoolName);
        if (!school) {
            log.warn("[SS] School not found", { schoolName: formData.schoolName });
            return res.status(404).json({ success: false, message: "Selected school does not exist in our system." });
        }
        formData.school_id = school.id;
        log.info("[SS] school resolved", { schoolName: formData.schoolName, schoolId: school.id });

        const rawActivityIds = formData.activity_ids;
        const activityIdList = Array.isArray(rawActivityIds)
            ? rawActivityIds.map(Number)
            : rawActivityIds
                ? String(rawActivityIds).split(",").map((a) => Number(a.trim())).filter(Boolean)
                : [];
        log.info("[SS] activity resolution", { activity_ids: activityIdList, count: activityIdList.length });
        // ────────────────────────────────────────────────────────────────────

        // Attach payment info so the service can look up the fee
        formData.payment = {
            activity_ids: activityIdList,
        };

        const result = await service.initiateRegistration(formData, serviceType);
        log.info("[SS] registration parked — awaiting payment", { temp_uuid: result.tempUuid, order_id: result.orderId, amount: result.amount });

        return res.status(200).json({
            success: true,
            message: "Registration parked. Complete payment to confirm.",
            temp_uuid: result.tempUuid,
            order_id: result.orderId,
            amount: result.amount,
            currency: result.currency,
            key_id: result.keyId,
        });
    } catch (error) {
        log.error("[SS] submitRegistration failed", error);
        return res.status(error.status ?? 500).json({ success: false, message: error.message });
    }
};

/**
 * PHASE 3 — Flutter polls this after the Razorpay SDK closes.
 */
exports.devFinalize = async (req, res) => {
    if (process.env.DEV_SKIP_PAYMENT !== "true") {
        return res.status(403).json({ success: false, message: "Only available in DEV_SKIP_PAYMENT mode" });
    }
    try {
        const { temp_uuid } = req.params;
        log.warn("[SS] devFinalize — DEV skip payment invoked", { temp_uuid });
        await service.finalizeRegistration(temp_uuid, "dev_payment_" + Date.now(), 0);
        log.info("[SS] devFinalize successful", { temp_uuid });
        return res.status(200).json({ success: true, message: "Registration finalized (dev mode)" });
    } catch (error) {
        log.error("[SS] devFinalize failed", error);
        return res.status(error.status ?? 500).json({ success: false, message: error.message });
    }
};

exports.checkRegistrationStatus = async (req, res) => {
    try {
        const { temp_uuid } = req.params;
        log.info("[SS] checkRegistrationStatus", { temp_uuid });
        const registration = await service.getRegistrationStatus(temp_uuid);

        if (registration.status === "approved") {
            log.info("[SS] registration approved — issuing JWT", { userId: registration.userId });
            const token = jwt.sign(
                { userId: registration.userId, mobile: registration.user?.mobile ?? null, role: "student", student_type: "school_student" },
                process.env.JWT_ACCESS_SECRET,
                { expiresIn: "7d" }
            );
            return res.status(200).json({
                success: true,
                isCompleted: true,
                token,
                userId: registration.userId,
                user: registration.user,
            });
        }

        log.info("[SS] registration status polled", { temp_uuid, status: registration.status });
        return res.status(200).json({ success: true, isCompleted: false, status: registration.status });
    } catch (error) {
        log.error("[SS] checkRegistrationStatus failed", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
