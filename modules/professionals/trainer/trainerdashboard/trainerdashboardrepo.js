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
      activities: { select: { id: true, name: true, image_url: true } },
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
      activities: { select: { id: true, name: true, image_url: true } },
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
      activities: { select: { id: true, name: true, image_url: true } },
      societies:  { select: { id: true, society_name: true } },
      schools:    { select: { id: true, school_name: true } },
      _count:     { select: { batch_students: true, sessions: true } },
      sessions:   { select: { status: true } },
      batch_students: {
        select: {
          students: {
            select: {
              id: true,
              student_type: true,
              users: { select: { full_name: true, mobile: true, email: true, photo: true, address: true } },
            },
          },
        },
      },
    },
  });

  // Group by activity
  const activityMap = {};
  for (const b of batches) {
    const actId   = b.activity_id;
    const actName = b.activities?.name ?? "Unknown";
    if (!activityMap[actId]) {
      activityMap[actId] = { 
        activity_id: actId, 
        activity_name: actName, 
        total_batches: 0, 
        total_sessions: 0, 
        completed_sessions: 0, 
        pending_sessions: 0, 
        batches: [],
        students: []
      };
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

    // Add students from this batch to the activity level students array
    if (b.batch_students) {
      for (const bs of b.batch_students) {
        if (bs.students) {
          const studentInfo = {
            student_id: bs.students.id,
            student_type: bs.students.student_type,
            full_name: bs.students.users?.full_name ?? null,
            mobile: bs.students.users?.mobile ?? null,
            email: bs.students.users?.email ?? null,
            photo: bs.students.users?.photo ?? null,
            address: bs.students.users?.address ?? null,
            batch_id: b.id,
            batch_name: b.batch_name
          };
          
          // Avoid duplicate students if they are in multiple batches of the same activity
          if (!activityMap[actId].students.some(s => s.student_id === studentInfo.student_id)) {
             activityMap[actId].students.push(studentInfo);
          }
        }
      }
    }
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
          activities: { select: { id: true, name: true, image_url: true } },
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
      batches:  { select: { id: true, batch_name: true, batch_type: true, activities: { select: { id: true, name: true, image_url: true } }, societies: { select: { id: true, society_name: true } }, schools: { select: { id: true, school_name: true } } } },
      _count:   { select: { session_participants: true } },
    },
    orderBy: [{ scheduled_date: "desc" }, { start_time: "desc" }],
  });
}

async function getBatchSessions(batchId, professionalId, status) {
  const where = {
    batch_id:        Number(batchId),
    professional_id: Number(professionalId),
  };
  if (status) where.status = status;

  return prisma.sessions.findMany({
    where,
    include: {
      _count: { select: { session_participants: true } },
    },
    orderBy: [{ scheduled_date: "asc" }, { start_time: "asc" }],
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
      activities: { select: { id: true, name: true, image_url: true } },
      batches: {
        select: {
          id: true, batch_name: true, batch_type: true,
          activities: { select: { id: true, name: true, image_url: true } },
          societies:  { select: { id: true, society_name: true } },
          schools:    { select: { id: true, school_name: true } },
          _count:     { select: { batch_students: true } },
        },
      },
      students: {
        select: {
          id: true,
          student_type: true,
          users: { select: { full_name: true, mobile: true, email: true, photo: true, address: true } },
          parent_consents: { select: { parent_name: true, emergency_contact_no: true }, orderBy: { id: "desc" }, take: 1 },
          personal_tutors: { select: { teacher_for: true }, take: 1 },
        },
      },
      session_participants: {
        select: {
          attended: true,
          students: {
            select: {
              id: true,
              student_type: true,
              users: { select: { full_name: true, mobile: true, email: true, photo: true, address: true } },
              parent_consents: { select: { parent_name: true, emergency_contact_no: true }, orderBy: { id: "desc" }, take: 1 },
            },
          },
        },
      },
      session_feedback: {
        select: { rating: true, comment: true, students: { select: { id: true, users: { select: { full_name: true } } } } },
      },
      _count: { select: { session_participants: true } },
    },
  });
}

// ── Sports / Activity section ────────────────────────────────────────────────

// Returns all distinct activities (by id+name) that this trainer has sessions for,
// with a total session count per activity.
// Split a comma-separated activity string into individual trimmed names
function splitActivityString(raw) {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

async function getSportsActivities(professionalId) {
  // Load all activities from the master table for name→id resolution
  const allActivities = await prisma.activities.findMany({ select: { id: true, name: true } });
  const activityByName = {};
  for (const a of allActivities) activityByName[a.name.toLowerCase().trim()] = a;

  // 1. Batch-based sessions (group_coaching, school_student)
  const batches = await prisma.batches.findMany({
    where: { professional_id: Number(professionalId), is_active: true },
    select: {
      activity_id: true,
      activities: { select: { id: true, name: true, image_url: true } },
      _count: { select: { sessions: true } },
    },
  });

  // 2. Individual coaching — activity stored as comma-separated string in individual_participants
  const indivParticipants = await prisma.individual_participants.findMany({
    where: { trainer_professional_id: Number(professionalId) },
    select: { activity: true, student_id: true },
  });

  const activityMap = {};

  for (const b of batches) {
    const id   = b.activity_id;
    const name = b.activities?.name ?? "Unknown";
    if (!activityMap[id]) activityMap[id] = { activity_id: id, activity_name: name, session_count: 0 };
    activityMap[id].session_count += b._count.sessions;
  }

  // Split comma-separated activity strings and count per individual activity name
  const indivCountMap = {};
  for (const p of indivParticipants) {
    const parts = splitActivityString(p.activity);
    for (const part of parts) {
      indivCountMap[part] = (indivCountMap[part] ?? 0) + 1;
    }
  }

  for (const [rawName, cnt] of Object.entries(indivCountMap)) {
    const matched    = activityByName[rawName.toLowerCase()];
    const resolvedId = matched?.id ?? null;
    const resolvedName = matched?.name ?? rawName;

    if (resolvedId !== null && activityMap[resolvedId]) {
      activityMap[resolvedId].session_count += cnt;
    } else if (resolvedId !== null) {
      activityMap[resolvedId] = { activity_id: resolvedId, activity_name: resolvedName, session_count: cnt };
    } else {
      const key = `unresolved_${rawName}`;
      activityMap[key] = { activity_id: null, activity_name: rawName, session_count: cnt };
    }
  }

  return Object.values(activityMap).sort((a, b) => a.activity_name.localeCompare(b.activity_name));
}

// Returns all sessions for this trainer filtered by activity.
// activity_id filters batch-based sessions; activity_name filters individual_coaching sessions.
// Both are OR'd together when the activity name matches a batch activity.
// Map logical status names to Prisma-valid status filters
function resolveStatusFilter(status) {
  if (!status) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (status === "upcoming") return { scheduled_date: { gte: today }, status: { in: ["scheduled", "ongoing"] } };
  return { status };
}

async function getSessionsByActivity(professionalId, activityId, activityName, status) {
  const sessions = [];
  const statusFilter = resolveStatusFilter(status);

  // ── 1. Batch-based sessions (group_coaching + school_student) ────────────
  if (activityId) {
    const batchWhere = {
      professional_id: Number(professionalId),
      batches: { activity_id: Number(activityId) },
      ...(statusFilter ?? {}),
    };

    const batchSessions = await prisma.sessions.findMany({
      where: batchWhere,
      include: {
        batches: {
          select: {
            id: true, batch_name: true, batch_type: true,
            activities: { select: { id: true, name: true, image_url: true } },
            societies:  { select: { id: true, society_name: true } },
            schools:    { select: { id: true, school_name: true } },
            _count:     { select: { batch_students: true } },
          },
        },
        students: { select: { id: true, users: { select: { full_name: true, mobile: true } } } },
        _count: { select: { session_participants: true } },
      },
      orderBy: [{ scheduled_date: "desc" }, { start_time: "asc" }],
    });
    sessions.push(...batchSessions.map((s) => ({ ...s, coaching_type: s.session_type })));
  }

  // ── 2. Individual coaching sessions (batch_id IS NULL) ──────────────────
  // New sessions have activity_id set directly on the session row.
  // Legacy sessions (activity_id IS NULL) fall back to name-matching via individual_participants.
  const indivBaseWhere = {
    professional_id: Number(professionalId),
    session_type: "individual_coaching",
    ...(statusFilter ?? {}),
  };

  // Resolve activity name for legacy fallback
  let resolvedActivityName = activityName;
  if (activityId && !resolvedActivityName) {
    const act = await prisma.activities.findUnique({ where: { id: Number(activityId) }, select: { name: true } });
    resolvedActivityName = act?.name ?? null;
  }

  // Legacy: find student_ids via individual_participants name-match (only for null activity_id sessions)
  const allParticipants = await prisma.individual_participants.findMany({
    where: { trainer_professional_id: Number(professionalId) },
    select: { student_id: true, activity: true },
  });
  const legacyStudentIds = resolvedActivityName
    ? [...new Set(
        allParticipants
          .filter((p) => splitActivityString(p.activity).some((part) => part.toLowerCase() === resolvedActivityName.toLowerCase()))
          .map((p) => p.student_id).filter(Boolean)
      )]
    : [];

  const orClauses = [];
  if (activityId) orClauses.push({ activity_id: Number(activityId) });
  if (legacyStudentIds.length > 0) orClauses.push({ activity_id: null, student_id: { in: legacyStudentIds } });

  if (orClauses.length > 0) {
    const indivSessionWhere = { ...indivBaseWhere, OR: orClauses };

    const indivSessions = await prisma.sessions.findMany({
      where: indivSessionWhere,
      include: {
        students: {
          select: {
            id: true,
            users: { select: { full_name: true, mobile: true, photo: true } },
            individual_participants: {
              where: { trainer_professional_id: Number(professionalId) },
              select: { activity: true },
            },
          },
        },
        activities: { select: { id: true, name: true, image_url: true } },
        _count: { select: { session_participants: true } },
      },
      orderBy: [{ scheduled_date: "desc" }, { start_time: "asc" }],
    });
    sessions.push(...indivSessions.map((s) => ({ ...s, coaching_type: "individual_coaching" })));
  }

  return sessions;
}

async function punchIn(sessionId) {
  return prisma.sessions.update({
    where: { id: Number(sessionId) },
    data: { status: "ongoing", in_time: new Date(), updated_at: new Date() },
  });
}

async function punchOut(sessionId) {
  const sid = Number(sessionId);
  return prisma.$transaction(async (tx) => {
    const session = await tx.sessions.update({
      where: { id: sid },
      data: { status: "completed", out_time: new Date(), updated_at: new Date() },
    });

    // For batch sessions (group_coaching / school_student), mark all participants as attended
    if (session.batch_id) {
      await tx.session_participants.updateMany({
        where: { session_id: sid },
        data:  { attended: true },
      });
    }

    return session;
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
  getBatchSessions,
  punchIn,
  punchOut,
  getSportsActivities,
  getSessionsByActivity,
};
