const prisma = require("../../config/prisma");

async function getStudentIdByUserId(userId) {
  const student = await prisma.students.findFirst({
    where: { user_id: Number(userId) },
    select: { id: true },
  });
  return student?.id || null;
}

async function getUpcomingSessions(studentId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Individual sessions (personal_tutor / individual_coaching)
  const individualSessions = await prisma.sessions.findMany({
    where: {
      student_id: Number(studentId),
      scheduled_date: { gte: today },
      status: { in: ["scheduled", "ongoing"] },
    },
    include: {
      professionals: {
        select: {
          id: true,
          profession_type: true,
          users: { select: { full_name: true, mobile: true } },
        },
      },
    },
    orderBy: [{ scheduled_date: "asc" }, { start_time: "asc" }],
  });

  // Batch sessions via session_participants (group_coaching / school_student)
  const batchParticipations = await prisma.session_participants.findMany({
    where: {
      student_id: Number(studentId),
      sessions: {
        scheduled_date: { gte: today },
        status: { in: ["scheduled", "ongoing"] },
      },
    },
    include: {
      sessions: {
        include: {
          batches: {
            select: {
              id: true,
              batch_name: true,
              batch_type: true,
              societies: { select: { id: true, society_name: true } },
              schools: { select: { id: true, school_name: true } },
              activities: { select: { id: true, name: true } },
            },
          },
          professionals: {
            select: {
              id: true,
              profession_type: true,
              users: { select: { full_name: true, mobile: true } },
            },
          },
        },
      },
    },
    orderBy: [
      { sessions: { scheduled_date: "asc" } },
      { sessions: { start_time: "asc" } },
    ],
  });

  return {
    individual: individualSessions,
    batch: batchParticipations.map((p) => p.sessions),
  };
}

async function getSessionHistory(studentId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const individualHistory = await prisma.sessions.findMany({
    where: {
      student_id: Number(studentId),
      OR: [{ scheduled_date: { lt: today } }, { status: { in: ["completed", "cancelled"] } }],
    },
    include: {
      professionals: {
        select: {
          id: true,
          profession_type: true,
          users: { select: { full_name: true } },
        },
      },
    },
    orderBy: [{ scheduled_date: "desc" }, { start_time: "desc" }],
  });

  const batchHistory = await prisma.session_participants.findMany({
    where: {
      student_id: Number(studentId),
      sessions: {
        OR: [{ scheduled_date: { lt: today } }, { status: { in: ["completed", "cancelled"] } }],
      },
    },
    include: {
      sessions: {
        include: {
          batches: {
            select: {
              id: true,
              batch_name: true,
              batch_type: true,
              activities: { select: { id: true, name: true } },
            },
          },
          professionals: {
            select: {
              id: true,
              profession_type: true,
              users: { select: { full_name: true } },
            },
          },
        },
      },
    },
    orderBy: [
      { sessions: { scheduled_date: "desc" } },
      { sessions: { start_time: "desc" } },
    ],
  });

  return {
    individual: individualHistory,
    batch: batchHistory.map((p) => ({ ...p.sessions, attended: p.attended })),
  };
}

module.exports = { getStudentIdByUserId, getUpcomingSessions, getSessionHistory };
