const prisma = require("../../../config/prisma");

// ── Batch CRUD ──────────────────────────────────────────────────────────────

async function createBatch(data) {
  return prisma.batches.create({ data });
}

async function getBatchById(id) {
  return prisma.batches.findUnique({
    where: { id },
    include: {
      activities: { select: { id: true, name: true } },
      societies: { select: { id: true, society_name: true } },
      schools: { select: { id: true, school_name: true } },
      professionals: {
        select: {
          id: true,
          profession_type: true,
          users: { select: { full_name: true, mobile: true } },
        },
      },
      batch_students: {
        include: {
          students: {
            select: {
              id: true,
              student_type: true,
              users: { select: { full_name: true, mobile: true } },
            },
          },
        },
      },
    },
  });
}



async function listBatches({ batch_type, society_id, school_id, activity_id } = {}) {
  const where = { is_active: true };
  if (batch_type) where.batch_type = batch_type;
  if (society_id) where.society_id = Number(society_id);
  if (school_id) where.school_id = Number(school_id);
  if (activity_id) where.activity_id = Number(activity_id);

  return prisma.batches.findMany({
    where,
    include: {
      activities: { select: { id: true, name: true } },
      societies: { select: { id: true, society_name: true } },
      schools: { select: { id: true, school_name: true } },
      professionals: {
        select: {
          id: true,
          profession_type: true,
          users: { select: { full_name: true } },
        },
      },
      _count: { select: { batch_students: true, sessions: true } },
    },
    orderBy: { created_at: "desc" },
  });
}

async function updateBatch(id, data) {
  return prisma.batches.update({ where: { id }, data });
}

async function softDeleteBatch(id) {
  return prisma.batches.update({ where: { id }, data: { is_active: false } });
}

// ── Batch students ──────────────────────────────────────────────────────────

async function getBatchStudents(batchId) {
  return prisma.batch_students.findMany({
    where: { batch_id: batchId },
    include: {
      students: {
        select: {
          id: true,
          student_type: true,
          users: { select: { id: true, full_name: true, mobile: true } },
        },
      },
    },
  });
}

async function getExistingBatchStudentIds(batchId) {
  const rows = await prisma.batch_students.findMany({
    where: { batch_id: batchId },
    select: { student_id: true },
  });
  return rows.map((r) => r.student_id);
}

async function bulkCreateBatchStudents(records) {
  return prisma.batch_students.createMany({ data: records, skipDuplicates: true });
}

async function removeBatchStudent(batchId, studentId) {
  return prisma.batch_students.deleteMany({
    where: { batch_id: batchId, student_id: studentId },
  });
}

// ── Session generation helpers ──────────────────────────────────────────────

async function getExistingSessionDatesForBatch(batchId, startDate, endDate) {
  const rows = await prisma.sessions.findMany({
    where: {
      batch_id: batchId,
      scheduled_date: { gte: startDate, lte: endDate },
      status: { not: "cancelled" },
    },
    select: { scheduled_date: true },
  });
  // Return as set of ISO date strings "YYYY-MM-DD"
  return new Set(rows.map((r) => r.scheduled_date.toISOString().slice(0, 10)));
}

async function createSessionWithParticipants(sessionData, studentIds) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.sessions.create({ data: sessionData });
    if (studentIds.length > 0) {
      await tx.session_participants.createMany({
        data: studentIds.map((sid) => ({
          session_id: session.id,
          student_id: sid,
          attended: false,
        })),
        skipDuplicates: true,
      });
    }
    return session;
  });
}

async function addParticipantsToFutureBatchSessions(batchId, studentIds) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureSessions = await prisma.sessions.findMany({
    where: {
      batch_id: batchId,
      scheduled_date: { gte: today },
      status: { in: ["scheduled", "ongoing"] },
    },
    select: { id: true },
  });

  if (futureSessions.length === 0 || studentIds.length === 0) return;

  const records = [];
  for (const session of futureSessions) {
    for (const studentId of studentIds) {
      records.push({ session_id: session.id, student_id: studentId, attended: false });
    }
  }

  return prisma.session_participants.createMany({ data: records, skipDuplicates: true });
}

async function removeParticipantFromFutureBatchSessions(batchId, studentId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureSessions = await prisma.sessions.findMany({
    where: {
      batch_id: batchId,
      scheduled_date: { gte: today },
      status: { in: ["scheduled", "ongoing"] },
    },
    select: { id: true },
  });

  if (futureSessions.length === 0) return;

  return prisma.session_participants.deleteMany({
    where: {
      session_id: { in: futureSessions.map((s) => s.id) },
      student_id: studentId,
    },
  });
}

// Cancel all future scheduled sessions for a batch
async function cancelFutureBatchSessions(batchId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.sessions.updateMany({
    where: {
      batch_id: batchId,
      scheduled_date: { gt: today },
      status: "scheduled",
    },
    data: { status: "cancelled", cancel_reason: "Batch deactivated" },
  });
}

// Cancel sessions on days no longer in the schedule after a batch update
async function cancelSessionsOnRemovedDays(batchId, dayNamesToCancel) {
  if (dayNamesToCancel.length === 0) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Use raw query because Prisma doesn't expose DAYNAME() in where
  const placeholders = dayNamesToCancel.map(() => "?").join(", ");
  return prisma.$executeRawUnsafe(
    `UPDATE sessions
     SET status = 'cancelled', cancel_reason = 'Batch schedule updated'
     WHERE batch_id = ? AND scheduled_date > ? AND status = 'scheduled'
       AND DAYNAME(scheduled_date) IN (${placeholders})`,
    batchId,
    today,
    ...dayNamesToCancel
  );
}

// Update professional and/or timing on all future scheduled sessions of a batch
async function updateFutureSessionsProfessionalAndTime(batchId, updates) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.sessions.updateMany({
    where: {
      batch_id: batchId,
      scheduled_date: { gt: today },
      status: "scheduled",
    },
    data: updates,
  });
}

module.exports = {
  createBatch,
  getBatchById,
  listBatches,
  updateBatch,
  softDeleteBatch,
  getBatchStudents,
  getExistingBatchStudentIds,
  bulkCreateBatchStudents,
  removeBatchStudent,
  getExistingSessionDatesForBatch,
  createSessionWithParticipants,
  addParticipantsToFutureBatchSessions,
  removeParticipantFromFutureBatchSessions,
  cancelFutureBatchSessions,
  cancelSessionsOnRemovedDays,
  updateFutureSessionsProfessionalAndTime,
};
