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

async function rescheduleSession(id, { scheduled_date, start_time, end_time }) {
  return prisma.sessions.update({
    where: { id: Number(id) },
    data:  { scheduled_date, start_time, end_time, updated_at: new Date() },
  });
}

/**
 * Get all IC/PT sessions for a student, grouped by professional_id + activity_id.
 * Each group represents a logical "batch" (auto-generated session block).
 */
async function getStudentSessionBatches(studentId) {
  const sid = Number(studentId);

  const [sessions, icRecord, ptRecord] = await Promise.all([
    prisma.sessions.findMany({
      where: {
        student_id:   sid,
        session_type: { in: ["individual_coaching", "personal_tutor"] },
      },
      include: {
        professionals: { select: { id: true, profession_type: true, users: { select: { full_name: true, mobile: true } } } },
        activities:    { select: { id: true, name: true } },
      },
      orderBy: [{ scheduled_date: "asc" }, { start_time: "asc" }],
    }),
    prisma.individual_participants.findFirst({
      where: { student_id: sid },
      select: {
        trainer_professional_id: true,
        activity: true,
        membership_start_date: true,
        membership_end_date: true,
        session_cap: true,
        session_days_of_week: true,
        session_start_time: true,
        session_end_time: true,
        is_active: true,
      },
    }),
    prisma.personal_tutors.findFirst({
      where: { student_id: sid },
      select: {
        teacher_professional_id: true,
        membership_start_date: true,
        membership_end_date: true,
        session_cap: true,
        session_days_of_week: true,
        session_start_time: true,
        session_end_time: true,
        is_active: true,
      },
    }),
  ]);

  // Group by professional_id + activity_id + session_type
  const groupMap = new Map();
  for (const s of sessions) {
    const key = `${s.session_type}__${s.professional_id}__${s.activity_id ?? "none"}`;
    if (!groupMap.has(key)) {
      // Attach membership metadata for the matching record
      let membership = null;
      if (s.session_type === "individual_coaching" && icRecord) {
        membership = {
          membership_start_date: icRecord.membership_start_date,
          membership_end_date:   icRecord.membership_end_date,
          session_cap:           icRecord.session_cap,
          session_days_of_week:  icRecord.session_days_of_week,
          session_start_time:    icRecord.session_start_time,
          session_end_time:      icRecord.session_end_time,
          is_active:             icRecord.is_active,
        };
      } else if (s.session_type === "personal_tutor" && ptRecord) {
        membership = {
          membership_start_date: ptRecord.membership_start_date,
          membership_end_date:   ptRecord.membership_end_date,
          session_cap:           ptRecord.session_cap,
          session_days_of_week:  ptRecord.session_days_of_week,
          session_start_time:    ptRecord.session_start_time,
          session_end_time:      ptRecord.session_end_time,
          is_active:             ptRecord.is_active,
        };
      }

      groupMap.set(key, {
        batch_label:         `${s.professionals?.users?.full_name ?? "Unknown"} — ${s.activities?.name ?? (s.session_type === "personal_tutor" ? "Personal Tutor" : "Coaching")}`,
        session_type:        s.session_type,
        professional_id:     s.professional_id,
        professional_name:   s.professionals?.users?.full_name ?? null,
        professional_mobile: s.professionals?.users?.mobile ?? null,
        activity_id:         s.activity_id,
        activity_name:       s.activities?.name ?? null,
        membership,
        sessions:            [],
      });
    }
    groupMap.get(key).sessions.push({
      id:             s.id,
      scheduled_date: s.scheduled_date,
      start_time:     s.start_time,
      end_time:       s.end_time,
      status:         s.status,
      cancel_reason:  s.cancel_reason,
    });
  }

  // Attach session counts summary to each group
  return Array.from(groupMap.values()).map((group) => {
    const total     = group.sessions.length;
    const completed = group.sessions.filter((s) => s.status === "completed").length;
    const cancelled = group.sessions.filter((s) => s.status === "cancelled").length;
    const upcoming  = group.sessions.filter((s) => s.status === "scheduled").length;
    return { ...group, summary: { total, completed, cancelled, upcoming } };
  });
}

async function getSessionFeedback(sessionId) {
  return prisma.session_feedback.findMany({
    where: { session_id: Number(sessionId) },
    include: {
      students: { select: { id: true, users: { select: { full_name: true } } } },
    },
  });
}

/**
 * Hard-delete a single session by ID.
 * Cascades to session_participants and session_feedback automatically.
 */
async function deleteSession(id) {
  return prisma.sessions.delete({ where: { id: Number(id) } });
}

/**
 * Bulk hard-delete all SCHEDULED (upcoming) sessions for a student
 * of the given session_type, optionally only those on or after `from_date`.
 * Returns the count of deleted rows.
 */
async function bulkDeleteFutureSessions({ student_id, session_type, from_date }) {
  const where = {
    student_id:   Number(student_id),
    session_type,
    status:       "scheduled",
  };
  if (from_date) {
    where.scheduled_date = { gte: new Date(from_date) };
  }
  const { count } = await prisma.sessions.deleteMany({ where });
  return count;
}

/**
 * Reassign a single session to a different professional.
 */
async function reassignSingleSession(sessionId, newProfessionalId) {
  return prisma.sessions.update({
    where: { id: Number(sessionId) },
    data:  { professional_id: Number(newProfessionalId), updated_at: new Date() },
  });
}

/**
 * Bulk-reassign all future scheduled sessions for a student to a new professional.
 * Returns count of updated sessions.
 */
async function reassignFutureSessions({ student_id, session_type, new_professional_id, from_date }) {
  const where = {
    student_id:   Number(student_id),
    session_type,
    status:       "scheduled",
    scheduled_date: { gte: new Date(from_date) },
  };
  const { count } = await prisma.sessions.updateMany({
    where,
    data: { professional_id: Number(new_professional_id), updated_at: new Date() },
  });
  return count;
}

module.exports = {
  checkProfessionalConflict,
  checkStudentConflict,
  getBusyProfessionalIds,
  createSession,
  getSessionById,
  listSessions,
  updateSessionStatus,
  rescheduleSession,
  getStudentSessionBatches,
  getSessionFeedback,
  deleteSession,
  bulkDeleteFutureSessions,
  reassignSingleSession,
  reassignFutureSessions,
};
