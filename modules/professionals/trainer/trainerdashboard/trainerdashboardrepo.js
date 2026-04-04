const prisma = require("../../../../config/prisma");

async function getTrainerProfessionalId(userId) {
  const professional = await prisma.professionals.findFirst({
    where: { user_id: Number(userId) },
    select: { id: true },
  });
  return professional?.id || null;
}

async function getSessions(professionalId, status) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const whereMap = {
    upcoming:  { scheduled_date: { gte: today }, status: { in: ["scheduled", "ongoing"] } },
    ongoing:   { status: "ongoing" },
    completed: { status: "completed" },
    cancelled: { status: "cancelled" },
  };

  const where = { professional_id: Number(professionalId), ...(whereMap[status] ?? whereMap.upcoming) };
  const descOrder = ["completed", "cancelled"].includes(status);

  return prisma.sessions.findMany({
    where,
    include: {
      batches: { select: { id: true, batch_name: true, batch_type: true, societies: { select: { id: true, society_name: true } }, schools: { select: { id: true, school_name: true } } } },
      students: { select: { id: true, users: { select: { full_name: true, mobile: true } } } },
      _count: { select: { session_participants: true } },
    },
    orderBy: descOrder
      ? [{ scheduled_date: "desc" }, { start_time: "desc" }]
      : [{ scheduled_date: "asc"  }, { start_time: "asc"  }],
  });
}

async function getTrainerBatches(professionalId) {
  return prisma.batches.findMany({
    where: { professional_id: Number(professionalId), is_active: true },
    include: {
      activities: { select: { id: true, name: true } },
      societies: { select: { id: true, society_name: true } },
      schools: { select: { id: true, school_name: true } },
      _count: { select: { batch_students: true, sessions: true } },
    },
    orderBy: { created_at: "desc" },
  });
}

async function getBatchesByLocation(professionalId, location) {
  const where = {
    professional_id: Number(professionalId),
    is_active: true,
    ...(location === "society" ? { society_id: { not: null } } : { school_id: { not: null } }),
  };

  return prisma.batches.findMany({
    where,
    include: {
      activities: { select: { id: true, name: true } },
      societies:  { select: { id: true, society_name: true, address: true } },
      schools:    { select: { id: true, school_name: true, address: true } },
      _count:     { select: { batch_students: true, sessions: true } },
      sessions:   { select: { status: true } },
    },
    orderBy: { created_at: "desc" },
  });
}

// ── Activities & Batches (Total Activities screen) ───────────────────────────

async function getActivitiesWithBatchStats(professionalId) {
  // All active batches for this trainer
  const batches = await prisma.batches.findMany({
    where: { professional_id: Number(professionalId), is_active: true },
    include: {
      activities: { select: { id: true, name: true } },
      societies:  { select: { id: true, society_name: true } },
      schools:    { select: { id: true, school_name: true } },
      _count:     { select: { batch_students: true, sessions: true } },
      sessions:   { select: { status: true } },
    },
  });

  // Group by activity
  const activityMap = {};
  for (const b of batches) {
    const actId   = b.activity_id;
    const actName = b.activities?.name ?? "Unknown";
    if (!activityMap[actId]) {
      activityMap[actId] = { activity_id: actId, activity_name: actName, total_batches: 0, total_sessions: 0, completed_sessions: 0, pending_sessions: 0, batches: [] };
    }
    const completed = b.sessions.filter((s) => s.status === "completed").length;
    const pending   = b.sessions.filter((s) => s.status === "scheduled").length;
    const ongoing   = b.sessions.filter((s) => s.status === "ongoing").length;
    activityMap[actId].total_batches++;
    activityMap[actId].total_sessions   += b._count.sessions;
    activityMap[actId].completed_sessions += completed;
    activityMap[actId].pending_sessions   += pending + ongoing;
    activityMap[actId].batches.push({
      batch_id:       b.id,
      batch_name:     b.batch_name,
      society:        b.societies ?? null,
      school:         b.schools   ?? null,
      total_students: b._count.batch_students,
      total_sessions: b._count.sessions,
      completed_sessions: completed,
      pending_sessions:   pending + ongoing,
    });
  }
  return Object.values(activityMap);
}

async function getBatchStudents(batchId, professionalId) {
  return prisma.batches.findFirst({
    where: { id: Number(batchId), professional_id: Number(professionalId) },
    select: {
      id:          true,
      batch_name:  true,
      activities:  { select: { id: true, name: true } },
      societies:   { select: { id: true, society_name: true } },
      schools:     { select: { id: true, school_name: true } },
      _count:      { select: { batch_students: true } },
      batch_students: {
        select: {
          joined_at: true,
          students: {
            select: {
              id: true,
              student_type: true,
              users: { select: { full_name: true, mobile: true, email: true, photo: true } },
            },
          },
        },
      },
    },
  });
}

// All students across all batches of this trainer with session progress
async function getAllStudentsWithProgress(professionalId) {
  const batchStudents = await prisma.batch_students.findMany({
    where: { batches: { professional_id: Number(professionalId) } },
    select: {
      joined_at: true,
      batches: {
        select: {
          id: true, batch_name: true,
          activities: { select: { id: true, name: true } },
          societies:  { select: { id: true, society_name: true } },
          schools:    { select: { id: true, school_name: true } },
        },
      },
      students: {
        select: {
          id: true,
          student_type: true,
          users: { select: { full_name: true, mobile: true, email: true, photo: true } },
          sessions: {
            where: { professional_id: Number(professionalId) },
            select: { status: true },
          },
        },
      },
    },
  });
  return batchStudents;
}

// All sessions between this trainer and a specific student
async function getStudentSessions(professionalId, studentId, status) {
  const where = {
    professional_id: Number(professionalId),
    OR: [
      { student_id: Number(studentId) },
      { session_participants: { some: { student_id: Number(studentId) } } },
    ],
  };

  if (status) where.status = status;

  return prisma.sessions.findMany({
    where,
    include: {
      batches:  { select: { id: true, batch_name: true, batch_type: true, activities: { select: { id: true, name: true } }, societies: { select: { id: true, society_name: true } }, schools: { select: { id: true, school_name: true } } } },
      _count:   { select: { session_participants: true } },
    },
    orderBy: [{ scheduled_date: "desc" }, { start_time: "desc" }],
  });
}

async function getSessionForTrainer(sessionId, professionalId) {
  return prisma.sessions.findFirst({
    where: { id: Number(sessionId), professional_id: Number(professionalId) },
  });
}

async function getSessionById(sessionId, professionalId) {
  return prisma.sessions.findFirst({
    where: { id: Number(sessionId), professional_id: Number(professionalId) },
    include: {
      batches: {
        select: {
          id: true, batch_name: true, batch_type: true,
          activities: { select: { id: true, name: true } },
          societies:  { select: { id: true, society_name: true } },
          schools:    { select: { id: true, school_name: true } },
          _count:     { select: { batch_students: true } },
        },
      },
      students: {
        select: { id: true, users: { select: { full_name: true, mobile: true, email: true, photo: true } } },
      },
      session_participants: {
        select: {
          attended: true,
          students: { select: { id: true, users: { select: { full_name: true, photo: true } } } },
        },
      },
      session_feedback: {
        select: { rating: true, comment: true, students: { select: { id: true, users: { select: { full_name: true } } } } },
      },
      _count: { select: { session_participants: true } },
    },
  });
}

async function punchIn(sessionId) {
  return prisma.sessions.update({
    where: { id: Number(sessionId) },
    data: { status: "ongoing", in_time: new Date(), updated_at: new Date() },
  });
}

async function punchOut(sessionId) {
  return prisma.sessions.update({
    where: { id: Number(sessionId) },
    data: { status: "completed", out_time: new Date(), updated_at: new Date() },
  });
}

module.exports = {
  getTrainerProfessionalId,
  getSessions,
  getTrainerBatches,
  getActivitiesWithBatchStats,
  getBatchStudents,
  getSessionById,
  getSessionForTrainer,
  getBatchesByLocation,
  getAllStudentsWithProgress,
  getStudentSessions,
  punchIn,
  punchOut,
};
