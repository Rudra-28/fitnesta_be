const prisma = require("../../../config/prisma");

// ── Conflict helpers ─────────────────────────────────────────────────────────

async function checkProfessionalConflict(professionalId, date, startTime, endTime, excludeSessionId = null) {
  const conflict = await prisma.sessions.findFirst({
    where: {
      professional_id: Number(professionalId),
      scheduled_date: date,
      status: { notIn: ["cancelled"] },
      id: excludeSessionId ? { not: Number(excludeSessionId) } : undefined,
      AND: [{ start_time: { lt: endTime } }, { end_time: { gt: startTime } }],
    },
    select: { id: true, session_type: true, scheduled_date: true },
  });
  return conflict;
}

async function checkStudentConflict(studentId, date, startTime, endTime, excludeSessionId = null) {
  const directConflict = await prisma.sessions.findFirst({
    where: {
      student_id: Number(studentId),
      scheduled_date: date,
      status: { notIn: ["cancelled"] },
      id: excludeSessionId ? { not: Number(excludeSessionId) } : undefined,
      AND: [{ start_time: { lt: endTime } }, { end_time: { gt: startTime } }],
    },
  });
  if (directConflict) return directConflict;

  const batchConflict = await prisma.session_participants.findFirst({
    where: {
      student_id: Number(studentId),
      sessions: {
        scheduled_date: date,
        status: { notIn: ["cancelled"] },
        id: excludeSessionId ? { not: Number(excludeSessionId) } : undefined,
        AND: [{ start_time: { lt: endTime } }, { end_time: { gt: startTime } }],
      },
    },
    include: { sessions: { select: { id: true, scheduled_date: true } } },
  });
  return batchConflict ? batchConflict.sessions : null;
}

// Get conflicting professional IDs for an availability bulk check
async function getBusyProfessionalIds(date, startTime, endTime) {
  const rows = await prisma.sessions.findMany({
    where: {
      scheduled_date: date,
      status: { notIn: ["cancelled"] },
      AND: [{ start_time: { lt: endTime } }, { end_time: { gt: startTime } }],
    },
    select: { professional_id: true },
    distinct: ["professional_id"],
  });
  return new Set(rows.map((r) => r.professional_id));
}

// ── Session CRUD ─────────────────────────────────────────────────────────────

async function createSession(data) {
  return prisma.sessions.create({ data });
}

async function getSessionById(id) {
  return prisma.sessions.findUnique({
    where: { id: Number(id) },
    include: {
      batches: { select: { id: true, batch_name: true, batch_type: true } },
      students: {
        select: {
          id: true,
          student_type: true,
          users: { select: { full_name: true, mobile: true } },
        },
      },
      professionals: {
        select: {
          id: true,
          profession_type: true,
          users: { select: { full_name: true, mobile: true } },
        },
      },
      session_participants: {
        include: {
          students: {
            select: {
              id: true,
              users: { select: { full_name: true } },
            },
          },
        },
      },
    },
  });
}

async function listSessions({ student_id, professional_id, from, to, status, session_type } = {}) {
  const where = {};
  if (student_id) where.student_id = Number(student_id);
  if (professional_id) where.professional_id = Number(professional_id);
  if (status) where.status = status;
  if (session_type) where.session_type = session_type;
  if (from || to) {
    where.scheduled_date = {};
    if (from) where.scheduled_date.gte = new Date(from);
    if (to) where.scheduled_date.lte = new Date(to);
  }

  return prisma.sessions.findMany({
    where,
    include: {
      batches: { select: { id: true, batch_name: true } },
      students: {
        select: {
          id: true,
          users: { select: { full_name: true } },
        },
      },
      professionals: {
        select: {
          id: true,
          profession_type: true,
          users: { select: { full_name: true } },
        },
      },
      _count: { select: { session_participants: true } },
    },
    orderBy: [{ scheduled_date: "asc" }, { start_time: "asc" }],
  });
}

async function updateSessionStatus(id, status, cancel_reason = null) {
  const data = { status, updated_at: new Date() };
  if (cancel_reason) data.cancel_reason = cancel_reason;
  return prisma.sessions.update({ where: { id: Number(id) }, data });
}

module.exports = {
  checkProfessionalConflict,
  checkStudentConflict,
  getBusyProfessionalIds,
  createSession,
  getSessionById,
  listSessions,
  updateSessionStatus,
};
