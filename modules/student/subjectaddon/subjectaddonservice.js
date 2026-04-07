const prisma = require("../../../config/prisma");
const crypto = require("crypto");
const razorpay = require("../../../utils/razorpay");
const paymentsRepo = require("../../payments/paymentsrepo");

const SERVICE_TYPE = "personal_tutor_addon";

// ── Phase 1: Get available activities the student can add ──────────────────

exports.getAvailableSubjects = async (studentId) => {
  // Get student's existing personal_tutor record for standard
  const tutor = await prisma.personal_tutors.findFirst({
    where: { student_id: studentId },
    select: { standard: true, teacher_for: true },
  });

  if (!tutor) throw Object.assign(new Error("No personal tutor enrollment found"), { code: "NOT_FOUND" });

  const standard = tutor.standard;

  // Parse already-enrolled subjects from teacher_for
  // "All Subjects 3RD-4TH" → treat as "All Subjects" (standard suffix is noise from Flutter)
  const rawSubjects = (tutor.teacher_for || "").split(",").map((s) => s.trim()).filter(Boolean);
  const enrolledNames = rawSubjects.map((s) => /^All Subjects/i.test(s) ? "All Subjects" : s);
  const hasAllSubjects = enrolledNames.includes("All Subjects");

  // Also check pending addon registrations for this student to avoid duplicates
  // Only consider pending records created in the last 30 minutes (Razorpay order TTL)
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const pendingAddons = await prisma.pending_registrations.findMany({
    where: { status: "pending", service_type: SERVICE_TYPE, created_at: { gte: cutoff } },
    select: { form_data: true },
  });
  // Note: rejected records are ignored automatically since we filter by status: "pending"

  const pendingActivityIds = pendingAddons
    .map((p) => {
      try {
        const fd = typeof p.form_data === "string" ? JSON.parse(p.form_data) : p.form_data;
        return fd?.student_id === studentId ? fd?.activity_id : null;
      } catch { return null; }
    })
    .filter(Boolean);

  // Get all fee_structures for personal_tutor matching this standard OR 'ANY'
  const feeRows = await prisma.fee_structures.findMany({
    where: {
      coaching_type: "personal_tutor",
      standard: { in: [standard, "ANY"].filter(Boolean) },
    },
    include: { activities: { select: { id: true, name: true } } },
    orderBy: [{ activity_id: "asc" }, { term_months: "asc" }],
  });

  // Group by activity
  const activityMap = {};
  for (const row of feeRows) {
    const { id, name } = row.activities;

    // Skip "All Subjects" activity itself as an addon option
    if (/^All Subjects$/i.test(name)) continue;

    // Skip if student already has All Subjects — but only for their standard, not ANY
    if (hasAllSubjects && row.standard !== "ANY") continue;

    // Skip already enrolled by name
    if (enrolledNames.includes(name)) continue;

    // Skip pending addon
    if (pendingActivityIds.includes(id)) continue;

    if (!activityMap[id]) {
      activityMap[id] = { activity_id: id, activity_name: name, standard, terms: [] };
    }
    activityMap[id].terms.push({
      term_months: row.term_months,
      total_fee: parseFloat(row.total_fee),
      effective_monthly: row.effective_monthly ? parseFloat(row.effective_monthly) : null,
    });
  }

  return Object.values(activityMap);
};

// ── Phase 2: Initiate purchase — create Razorpay order + park in pending ──

exports.initiateAddon = async (studentId, userId, activityId, termMonths) => {
  const tutor = await prisma.personal_tutors.findFirst({
    where: { student_id: studentId },
    select: { standard: true, teacher_for: true },
  });

  if (!tutor) throw Object.assign(new Error("No personal tutor enrollment found"), { code: "NOT_FOUND" });

  const standard = tutor.standard;

  const fee = await prisma.fee_structures.findFirst({
    where: {
      activity_id: activityId,
      coaching_type: "personal_tutor",
      term_months: termMonths,
      standard: { in: [standard, "ANY"].filter(Boolean) },
    },
    select: { total_fee: true },
  });

  if (!fee) throw Object.assign(
    new Error(`No fee found for this activity at standard ${standard} for ${termMonths} month(s)`),
    { code: "NOT_FOUND" }
  );

  // Cancel any previous pending addon for same student + activity so it doesn't block availability
  const existingPending = await prisma.pending_registrations.findMany({
    where: { status: "pending", service_type: SERVICE_TYPE, created_at: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
    select: { id: true, form_data: true },
  });
  for (const p of existingPending) {
    const fd = typeof p.form_data === "string" ? JSON.parse(p.form_data) : p.form_data;
    if (fd?.student_id === studentId && fd?.activity_id === activityId) {
      await prisma.pending_registrations.update({ where: { id: p.id }, data: { status: "rejected" } });
    }
  }

  const amount = parseFloat(fee.total_fee);
  const tempUuid = crypto.randomUUID();

  const order = await razorpay.createOrder(amount, tempUuid, {
    temp_uuid: tempUuid,
    service_type: SERVICE_TYPE,
  });

  const formData = {
    student_id: studentId,
    user_id: userId,
    activity_id: activityId,
    term_months: termMonths,
    standard,
    razorpay_order_id: order.id,
    calculated_amount: amount,
  };

  await prisma.pending_registrations.create({
    data: {
      temp_uuid: tempUuid,
      form_data: formData,
      service_type: SERVICE_TYPE,
      status: "pending",
    },
  });

  return { tempUuid, orderId: order.id, amount, currency: "INR", keyId: process.env.RAZORPAY_KEY_ID };
};

// ── Phase 3: Finalize — called by payment verify/webhook ──────────────────

exports.finalizeRegistration = async (tempUuid, razorpayPaymentId, amount) => {
  const pending = await paymentsRepo.getPendingRegistration(tempUuid);
  if (!pending) throw new Error("Pending registration not found");
  if (pending.status === "approved") return { success: true, alreadyDone: true };

  const data = typeof pending.form_data === "string"
    ? JSON.parse(pending.form_data)
    : pending.form_data;

  const { student_id, user_id, activity_id } = data;

  // Get activity name to append to teacher_for
  const activity = await prisma.activities.findUnique({
    where: { id: activity_id },
    select: { name: true },
  });

  if (!activity) throw new Error(`Activity ${activity_id} not found`);

  await prisma.$transaction(async (tx) => {
    // Append the new subject to existing teacher_for (comma-separated)
    const existing = await tx.personal_tutors.findFirst({
      where: { student_id },
      select: { id: true, teacher_for: true },
    });

    if (existing) {
      const current = (existing.teacher_for || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (!current.includes(activity.name)) {
        current.push(activity.name);
      }
      await tx.personal_tutors.update({
        where: { id: existing.id },
        data: { teacher_for: current.join(", ") },
      });
    } else {
      // Fallback: create a new personal_tutors row if somehow missing
      await tx.personal_tutors.create({
        data: { student_id, teacher_for: activity.name },
      });
    }

    await tx.pending_registrations.update({
      where: { id: pending.id },
      data: { status: "approved" },
    });
  });

  await paymentsRepo.recordPayment({
    tempUuid,
    razorpayOrderId: data.razorpay_order_id,
    razorpayPaymentId,
    serviceType: SERVICE_TYPE,
    amount,
    termMonths: data.term_months,
    studentUserId: user_id,
  });

  return { success: true };
};

// ── Phase 3 poll: status check ─────────────────────────────────────────────

exports.getAddonStatus = async (tempUuid) => {
  const pending = await paymentsRepo.getPendingRegistration(tempUuid);
  if (!pending) return { status: "not_found" };
  return { status: pending.status };
};
