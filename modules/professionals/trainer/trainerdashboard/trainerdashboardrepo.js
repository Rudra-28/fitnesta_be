const prisma = require("../../../../config/prisma");

async function getTrainerProfessionalId(userId) {
  const professional = await prisma.professionals.findFirst({
    where: { user_id: Number(userId) },
    select: { id: true },
  });
  return professional?.id || null;
}

async function getUpcomingSessions(professionalId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.sessions.findMany({
    where: {
      professional_id: Number(professionalId),
      scheduled_date: { gte: today },
      status: { in: ["scheduled", "ongoing"] },
    },
    include: {
      batches: {
        select: {
          id: true,
          batch_name: true,
          batch_type: true,
          societies: { select: { id: true, society_name: true } },
          schools: { select: { id: true, school_name: true } },
        },
      },
      students: {
        select: { id: true, users: { select: { full_name: true, mobile: true } } },
      },
      _count: { select: { session_participants: true } },
    },
    orderBy: [{ scheduled_date: "asc" }, { start_time: "asc" }],
  });
}

async function getSessionHistory(professionalId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.sessions.findMany({
    where: {
      professional_id: Number(professionalId),
      OR: [
        { scheduled_date: { lt: today } },
        { status: { in: ["completed", "cancelled"] } },
      ],
    },
    include: {
      batches: { select: { id: true, batch_name: true, batch_type: true } },
      students: {
        select: { id: true, users: { select: { full_name: true } } },
      },
      _count: { select: { session_participants: true } },
    },
    orderBy: [{ scheduled_date: "desc" }, { start_time: "desc" }],
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

module.exports = {
  getTrainerProfessionalId,
  getUpcomingSessions,
  getSessionHistory,
  getTrainerBatches,
};
