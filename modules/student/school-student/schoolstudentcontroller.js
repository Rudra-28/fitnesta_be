const service = require("./schoolstudentservice");
const jwt = require("jsonwebtoken");
const { validateSchoolStudent } = require("./schoolstudentvalidation");
const schoolRepo = require("../../school/schoolrepo");

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
        console.log("[SS] submitRegistration called");
        const formData = req.body;
        const serviceType = "school_student";

        const errors = validateSchoolStudent(formData);
        if (errors.length > 0) {
            console.warn("[SS] Validation failed:", errors);
            return res.status(400).json({ success: false, errors });
        }

        const school = await schoolRepo.getSchoolByName(formData.schoolName);
        if (!school) {
            console.warn(`[SS] School not found: ${formData.schoolName}`);
            return res.status(404).json({ success: false, message: "Selected school does not exist in our system." });
        }
        formData.school_id = school.id;
        console.log(`[SS] School resolved — name: ${formData.schoolName}, id: ${school.id}`);

        // ── Activity debug logs ──────────────────────────────────────────────
        const rawActivityIds = formData.activity_ids;
        const activityIdList = Array.isArray(rawActivityIds)
            ? rawActivityIds.map(Number)
            : rawActivityIds
                ? String(rawActivityIds).split(",").map((a) => Number(a.trim())).filter(Boolean)
                : [];
        console.log("[SS] activity_ids received (raw):", rawActivityIds);
        console.log("[SS] activity_ids count:", activityIdList.length, "| list:", activityIdList);
        // ────────────────────────────────────────────────────────────────────

        // Attach payment info so the service can look up the fee
        formData.payment = {
            activity_ids: activityIdList,
        };

        const result = await service.initiateRegistration(formData, serviceType);
        console.log(`[SS] Registration parked — temp_uuid: ${result.tempUuid}, order_id: ${result.orderId}, amount: ${result.amount}`);

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
        console.error(`[SS] submitRegistration error: ${error.message}`);
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
        console.log(`[SS] devFinalize called — temp_uuid: ${temp_uuid}`);
        await service.finalizeRegistration(temp_uuid, "dev_payment_" + Date.now(), 0);
        console.log(`[SS] devFinalize successful — temp_uuid: ${temp_uuid}`);
        return res.status(200).json({ success: true, message: "Registration finalized (dev mode)" });
    } catch (error) {
        console.error(`[SS] devFinalize error: ${error.message}`);
        return res.status(error.status ?? 500).json({ success: false, message: error.message });
    }
};

exports.checkRegistrationStatus = async (req, res) => {
    try {
        const { temp_uuid } = req.params;
        console.log(`[SS] checkRegistrationStatus — temp_uuid: ${temp_uuid}`);
        const registration = await service.getRegistrationStatus(temp_uuid);

        if (registration.status === "approved") {
            console.log(`[SS] Registration approved — userId: ${registration.userId}, issuing JWT`);
            const token = jwt.sign(
                { id: registration.userId, role: "student" },
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

        console.log(`[SS] Registration status: ${registration.status}`);
        return res.status(200).json({ success: true, isCompleted: false, status: registration.status });
    } catch (error) {
        console.error(`[SS] checkRegistrationStatus error: ${error.message}`);
        return res.status(500).json({ success: false, message: error.message });
    }
};
