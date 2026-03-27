const db = require("../../../config/db");
const repo = require("./otherarearepo");

// ── helpers ────────────────────────────────────────────────────────────────
const mapPending = (rows) => rows.map(r => ({
  id: r.id,
  tempUuid: r.temp_uuid,
  serviceType: r.service_type,
  submittedAt: r.created_at,
  formData: r.form_data
}));

const assertPending = async (pendingId, expectedType) => {
  const pending = await repo.getPendingById(pendingId);
  if (!pending) { const err = new Error("PENDING_NOT_FOUND"); err.statusCode = 404; throw err; }
  if (pending.status !== 'pending') { const err = new Error("ALREADY_REVIEWED"); err.statusCode = 409; throw err; }
  if (pending.service_type !== expectedType) {
    const err = new Error(`Expected a ${expectedType} entry, got ${pending.service_type}.`);
    err.statusCode = 400;
    throw err;
  }
  return pending;
};

const getMeProfessional = async (meUserId) => {
  const professional = await repo.findProfessionalByUserId(meUserId);
  if (!professional) {
    const err = new Error("Marketing Executive profile not found.");
    err.statusCode = 403;
    throw err;
  }
  return professional;
};

// ── Submit (public) ────────────────────────────────────────────────────────
exports.registerOtherArea = async (data) => {
  const serviceType = data.hasSignedAgreement ? 'other_area_enrollment' : 'other_area_request';

  const duplicate = await repo.findByMobile(data.mobile);

  if (duplicate.exists) {
    if (duplicate.where === 'approved') {
      const err = new Error("An other area with this mobile is already registered.");
      err.statusCode = 409;
      throw err;
    }
    if (duplicate.serviceType === 'other_area_enrollment') {
      const err = new Error("An enrollment for this mobile is already pending approval.");
      err.statusCode = 409;
      throw err;
    }
    if (duplicate.serviceType === 'other_area_request' && !data.hasSignedAgreement) {
      const err = new Error("A registration request for this mobile is already pending approval.");
      err.statusCode = 409;
      throw err;
    }
    // pending request + enrollment submitted → allow, old request will be cancelled below
  }
   

  if (data.hasSignedAgreement) {
    const conn = await db.getConnection();
    try {
      const professional = await repo.findProfessionalByReferralCode(conn, data.referralCode);
      if (!professional) {
        const err = new Error("Invalid referral code. No Fitness Coordinator found with this code.");
        err.statusCode = 400;
        throw err;
      }
    } finally {
      conn.release();
    }
    await repo.cancelPendingRequest(data.mobile);
  }

  const tempUuid = await repo.insertPending(data, serviceType);

  return {
    success: true,
    tempUuid,
    message: data.hasSignedAgreement
      ? "Other area enrollment submitted. Awaiting approval."
      : "Other area registration request submitted. Awaiting admin approval."
  };
};

// ── Admin: other_area_request ──────────────────────────────────────────────
exports.listPendingRequests = async () => mapPending(await repo.getPendingRequests());

exports.approveRequestByAdmin = async (pendingId, adminUserId, note) => {
  await assertPending(pendingId, 'other_area_request');
  await repo.markPendingReviewed(pendingId, 'approved', adminUserId, note);
  return { message: "Other area request acknowledged. An ME will be assigned to visit." };
};

exports.rejectRequestByAdmin = async (pendingId, adminUserId, note) => {
  await assertPending(pendingId, 'other_area_request');
  await repo.markPendingReviewed(pendingId, 'rejected', adminUserId, note);
  return { message: "Other area request rejected." };
};

// ── Admin: other_area_enrollment ───────────────────────────────────────────
exports.listPendingEnrollments = async () => mapPending(await repo.getPendingEnrollments());

exports.approveEnrollmentByAdmin = async (pendingId, adminUserId, note) => {
  const pending = await assertPending(pendingId, 'other_area_enrollment');
  const data = pending.form_data;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const professional = await repo.findProfessionalByReferralCode(conn, data.referralCode);
    if (!professional) throw new Error("Referral code is no longer valid.");
    const userId = await repo.insertUser(conn, data);
    const studentId = await repo.insertStudent(conn, userId);
    await repo.insertOtherArea(conn, data, studentId, professional.id);
    await repo.markPendingReviewed(pendingId, 'approved', adminUserId, note);
    await conn.commit();
    return { message: "Other area enrollment approved successfully." };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

exports.rejectEnrollmentByAdmin = async (pendingId, adminUserId, note) => {
  await assertPending(pendingId, 'other_area_enrollment');
  await repo.markPendingReviewed(pendingId, 'rejected', adminUserId, note);
  return { message: "Other area enrollment rejected." };
};

// ── ME: other_area_enrollment ──────────────────────────────────────────────
exports.listPendingEnrollmentsForMe = async (meUserId) => {
  const professional = await getMeProfessional(meUserId);
  return mapPending(await repo.getPendingEnrollmentsForMe(professional.referral_code));
};

exports.approveEnrollmentByMe = async (pendingId, meUserId, note) => {
  const pending = await assertPending(pendingId, 'other_area_enrollment');
  const professional = await getMeProfessional(meUserId);

  if (pending.form_data.referralCode !== professional.referral_code) {
    const err = new Error("You are not authorized to approve this enrollment.");
    err.statusCode = 403;
    throw err;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const userId = await repo.insertUser(conn, pending.form_data);
    const studentId = await repo.insertStudent(conn, userId);
    await repo.insertOtherArea(conn, pending.form_data, studentId, professional.id);
    await repo.markPendingReviewed(pendingId, 'approved', meUserId, note);
    await conn.commit();
    return { message: "Other area enrollment approved successfully." };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

exports.rejectEnrollmentByMe = async (pendingId, meUserId, note) => {
  const pending = await assertPending(pendingId, 'other_area_enrollment');
  const professional = await getMeProfessional(meUserId);

  if (pending.form_data.referralCode !== professional.referral_code) {
    const err = new Error("You are not authorized to reject this enrollment.");
    err.statusCode = 403;
    throw err;
  }

  await repo.markPendingReviewed(pendingId, 'rejected', meUserId, note);
  return { message: "Other area enrollment rejected." };
};
