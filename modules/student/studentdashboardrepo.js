const prisma = require("../../config/prisma");

async function getStudentIdByUserId(userId) {
  const student = await prisma.students.findFirst({
    where: { user_id: Number(userId) },
    select: { id: true, student_type: true },
  });
  return student || null;
}

// ── Toggle check ──────────────────────────────────────────────────────────

async function getToggleState(studentId) {
  const [subjects, activities] = await Promise.all([
    prisma.personal_tutors.count({ where: { student_id: studentId } }),
    prisma.sessions.count({
      where: {
        activity_id: { not: null },
        OR: [
          { student_id: studentId, session_type: { in: ["individual_coaching", "group_coaching", "school_student"] } },
          { session_participants: { some: { student_id: studentId } }, session_type: { in: ["group_coaching", "school_student"] } },
        ],
      },
    }),
  ]);
  return { has_subjects: subjects > 0, has_activities: activities > 0 };
}

// ── Dashboard stats — subjects (personal_tutor only) ──────────────────────

async function getSubjectsDashboardStats(studentId) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const [tutors, upcoming, done, ongoing] = await Promise.all([
    prisma.personal_tutors.findMany({ where: { student_id: studentId }, select: { teacher_for: true } }),
    prisma.sessions.count({ where: { student_id: studentId, session_type: "personal_tutor", status: "scheduled", scheduled_date: { gte: now } } }),
    prisma.sessions.count({ where: { student_id: studentId, session_type: "personal_tutor", status: "completed" } }),
    prisma.sessions.count({ where: { student_id: studentId, session_type: "personal_tutor", status: "ongoing" } }),
  ]);

  const subjects = [...new Set(tutors.flatMap((t) => (t.teacher_for ? t.teacher_for.split(",").map((s) => s.trim()).filter(Boolean) : [])))];
  return { total_subjects: subjects.length, upcoming_sessions: upcoming, sessions_done: done, sessions_ongoing: ongoing };
}

// ── Dashboard stats — activities (individual_coaching / group_coaching) ───

async function getActivitiesDashboardStats(studentId) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const actTypes = { in: ["individual_coaching", "group_coaching"] };

  const [distinctActivities, upcomingInd, upcomingBatch, doneInd, doneBatch, pendingInd, pendingBatch] =
    await Promise.all([
      prisma.sessions.findMany({
        where: {
          OR: [
            { student_id: studentId, session_type: actTypes },
            { session_participants: { some: { student_id: studentId } }, session_type: actTypes },
          ],
          activity_id: { not: null },
        },
        select: { activity_id: true },
        distinct: ["activity_id"],
      }),
      prisma.sessions.count({ where: { student_id: studentId, session_type: actTypes, status: "scheduled", scheduled_date: { gte: now } } }),
      prisma.session_participants.count({ where: { student_id: studentId, sessions: { session_type: actTypes, status: "scheduled", scheduled_date: { gte: now } } } }),
      prisma.sessions.count({ where: { student_id: studentId, session_type: actTypes, status: "completed" } }),
      prisma.session_participants.count({ where: { student_id: studentId, sessions: { session_type: actTypes, status: "completed" } } }),
      prisma.sessions.count({ where: { student_id: studentId, session_type: actTypes, status: "ongoing" } }),
      prisma.session_participants.count({ where: { student_id: studentId, sessions: { session_type: actTypes, status: "ongoing" } } }),
    ]);

  return {
    total_activities: distinctActivities.length,
    upcoming_activities: upcomingInd + upcomingBatch,
    activities_done: doneInd + doneBatch,
    activities_ongoing: pendingInd + pendingBatch,
  };
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function _statusWhere(status) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return {
    upcoming:  { status: { in: ["scheduled"] }, scheduled_date: { gte: now } },
    ongoing:   { status: "ongoing" },
    completed: { status: "completed" },
    absent:    { status: "absent" },
    cancelled: { status: "cancelled" },
  }[status] ?? {};
}

function _todayRange() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  return { today, tomorrow };
}

// ── Subjects — reminder, sessions, session detail ─────────────────────────

async function getSubjectsReminder(studentId) {
  const { today, tomorrow } = _todayRange();
  const sessions = await prisma.sessions.findMany({
    where: { student_id: studentId, session_type: "personal_tutor", scheduled_date: { gte: today, lt: tomorrow }, status: { in: ["scheduled", "ongoing"] } },
    include: {
      activities: { select: { id: true, name: true, image_url: true } },
      professionals: { select: { profession_type: true, users: { select: { full_name: true } } } },
    },
    orderBy: { start_time: "asc" },
  });
  return sessions;
}

async function getSubjectsSessions(studentId, status) {
  const where = _statusWhere(status);
  const descOrder = ["completed", "cancelled"].includes(status);
  const orderDir = descOrder ? "desc" : "asc";
  return prisma.sessions.findMany({
    where: { student_id: studentId, session_type: "personal_tutor", ...where },
    include: {
      activities: { select: { id: true, name: true, image_url: true } },
      professionals: { select: { id: true, profession_type: true, users: { select: { full_name: true, mobile: true } } } },
    },
    orderBy: [{ scheduled_date: orderDir }, { start_time: orderDir }],
  });
}

async function getSubjectsSessionById(studentId, sessionId) {
  return prisma.sessions.findFirst({
    where: { id: sessionId, student_id: studentId, session_type: "personal_tutor" },
    include: {
      activities: { select: { id: true, name: true, image_url: true } },
      professionals: { select: { id: true, profession_type: true, users: { select: { full_name: true, mobile: true } } } },
      session_feedback: { where: { student_id: studentId }, select: { rating: true, comment: true } },
    },
  });
}

// ── Activities — reminder, sessions, session detail ────────────────────────

async function getActivitiesReminder(studentId) {
  const { today, tomorrow } = _todayRange();
  const actTypes = { in: ["individual_coaching", "group_coaching"] };

  const [individual, batch] = await Promise.all([
    prisma.sessions.findMany({
      where: { student_id: studentId, session_type: actTypes, scheduled_date: { gte: today, lt: tomorrow }, status: { in: ["scheduled", "ongoing"] } },
      include: {
        activities: { select: { id: true, name: true, image_url: true } },
        professionals: { select: { profession_type: true, users: { select: { full_name: true } } } },
      },
      orderBy: { start_time: "asc" },
    }),
    prisma.session_participants.findMany({
      where: { student_id: studentId, sessions: { session_type: actTypes, scheduled_date: { gte: today, lt: tomorrow }, status: { in: ["scheduled", "ongoing"] } } },
      include: {
        sessions: {
          include: {
            activities: { select: { id: true, name: true, image_url: true } },
            professionals: { select: { profession_type: true, users: { select: { full_name: true } } } },
            batches: { select: { id: true, batch_name: true, batch_type: true } },
          },
        },
      },
      orderBy: { sessions: { start_time: "asc" } },
    }),
  ]);

  return [
    ...individual.map((s) => ({ ...s, source: "individual" })),
    ...batch.map((p) => ({ ...p.sessions, source: "batch" })),
  ].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

async function getActivitiesSessions(studentId, status) {
  const where = _statusWhere(status);
  const actTypes = { in: ["individual_coaching", "group_coaching"] };
  const descOrder = ["completed", "cancelled"].includes(status);
  const orderDir = descOrder ? "desc" : "asc";

  const [individual, batch] = await Promise.all([
    prisma.sessions.findMany({
      where: { student_id: studentId, session_type: actTypes, ...where },
      include: {
        activities: { select: { id: true, name: true, image_url: true } },
        professionals: { select: { id: true, profession_type: true, users: { select: { full_name: true, mobile: true } } } },
      },
      orderBy: [{ scheduled_date: orderDir }, { start_time: orderDir }],
    }),
    prisma.session_participants.findMany({
      where: { student_id: studentId, sessions: { session_type: actTypes, ...where } },
      include: {
        sessions: {
          include: {
            activities: { select: { id: true, name: true, image_url: true } },
            professionals: { select: { id: true, profession_type: true, users: { select: { full_name: true, mobile: true } } } },
            batches: { select: { id: true, batch_name: true, batch_type: true, societies: { select: { id: true, society_name: true } }, schools: { select: { id: true, school_name: true } } } },
          },
        },
      },
      orderBy: [{ sessions: { scheduled_date: orderDir } }, { sessions: { start_time: orderDir } }],
    }),
  ]);

  return [
    ...individual.map((s) => ({ ...s, source: "individual" })),
    ...batch.map((p) => ({ ...p.sessions, source: "batch", attended: p.attended })),
  ].sort((a, b) => descOrder ? new Date(b.scheduled_date) - new Date(a.scheduled_date) : new Date(a.scheduled_date) - new Date(b.scheduled_date));
}

async function getActivitiesSessionById(studentId, sessionId) {
  const actTypes = { in: ["individual_coaching", "group_coaching"] };

  const individual = await prisma.sessions.findFirst({
    where: { id: sessionId, student_id: studentId, session_type: actTypes },
    include: {
      activities: { select: { id: true, name: true, image_url: true } },
      professionals: { select: { id: true, profession_type: true, users: { select: { full_name: true, mobile: true } } } },
      session_feedback: { where: { student_id: studentId }, select: { rating: true, comment: true } },
    },
  });
  if (individual) return { ...individual, source: "individual" };

  const participant = await prisma.session_participants.findFirst({
    where: { session_id: sessionId, student_id: studentId, sessions: { session_type: actTypes } },
    include: {
      sessions: {
        include: {
          activities: { select: { id: true, name: true, image_url: true } },
          professionals: { select: { id: true, profession_type: true, users: { select: { full_name: true, mobile: true } } } },
          batches: { select: { id: true, batch_name: true, batch_type: true, societies: { select: { id: true, society_name: true } }, schools: { select: { id: true, school_name: true } } } },
          session_feedback: { where: { student_id: studentId }, select: { rating: true, comment: true } },
        },
      },
    },
  });
  if (participant) return { ...participant.sessions, attended: participant.attended, source: "batch" };

  return null;
}

// ── Subjects with sessions (personal_tutor only, grouped by activity_id) ──

async function getSubjectsWithSessions(studentId) {
  // 1. Get the student's personal_tutor enrollment(s)
  const tutors = await prisma.personal_tutors.findMany({
    where: { student_id: studentId },
    select: { teacher_for: true, standard: true },
  });

  if (!tutors.length) return [];

  // 2. Resolve enrolled activities, tracking whether student is "All Subjects"
  let enrolledActivityIds = [];
  let hasAllSubjects = false;

  for (const tutor of tutors) {
    const subjects = (tutor.teacher_for || "").split(",").map((s) => s.trim()).filter(Boolean);

    for (const subject of subjects) {
      // Flutter may send "All Subjects 3RD-4TH" — detect by prefix
      const isAllSubjects = /^All Subjects/i.test(subject);
      if (isAllSubjects) {
        hasAllSubjects = true;
        const standard = tutor.standard || null;
        const feeActivities = await prisma.fee_structures.findMany({
          where: {
            coaching_type: "personal_tutor",
            ...(standard ? { standard } : {}),
          },
          select: { activity_id: true },
          distinct: ["activity_id"],
        });
        enrolledActivityIds.push(...feeActivities.map((f) => f.activity_id));
      } else {
        const matched = await prisma.activities.findMany({
          where: { name: subject },
          select: { id: true },
        });
        enrolledActivityIds.push(...matched.map((a) => a.id));
      }
    }
  }

  // Deduplicate
  enrolledActivityIds = [...new Set(enrolledActivityIds)];
  if (!enrolledActivityIds.length) return [];

  // 3. Fetch activities and sessions
  // For "All Subjects" students, sessions are stored with activity_id = null,
  // so we fetch all personal_tutor sessions without an activity_id filter.
  const [activities, sessions] = await Promise.all([
    prisma.activities.findMany({
      where: { id: { in: enrolledActivityIds } },
      select: { id: true, name: true },
    }),
    prisma.sessions.findMany({
      where: {
        student_id: studentId,
        session_type: "personal_tutor",
        ...(hasAllSubjects ? {} : { activity_id: { in: enrolledActivityIds } }),
      },
      include: {
        professionals: { select: { id: true, profession_type: true, users: { select: { full_name: true } } } },
      },
      orderBy: [{ scheduled_date: "asc" }, { start_time: "asc" }],
    }),
  ]);

  // 4. Group sessions by activity_id.
  // For "All Subjects", sessions have activity_id = null — bucket them under the
  // "All Subjects" activity ID (first one found in enrolledActivityIds from fee_structures).
  const allSubjectsActivityId = hasAllSubjects
    ? activities.find((a) => /^All Subjects/i.test(a.name))?.id ?? enrolledActivityIds[0]
    : null;

  const sessionsByActivity = {};
  for (const s of sessions) {
    const bucket = s.activity_id ?? allSubjectsActivityId;
    if (bucket == null) continue;
    if (!sessionsByActivity[bucket]) sessionsByActivity[bucket] = [];
    sessionsByActivity[bucket].push(s);
  }

  // 5. Build result — one entry per enrolled activity, even if no sessions yet
  const result = activities.map((act) => ({
    activity_id: act.id,
    subject_name: act.name,
    sessions: sessionsByActivity[act.id] || [],
  }));

  return result.map(_withCounts);
}

// ── Activities with sessions (individual_coaching / group_coaching) ────────

async function getActivitiesWithSessions(studentId) {
  const actTypes = { in: ["individual_coaching", "group_coaching"] };

  const [individualSessions, batchParticipations] = await Promise.all([
    prisma.sessions.findMany({
      where: { student_id: studentId, session_type: actTypes, activity_id: { not: null } },
      include: {
        activities: { select: { id: true, name: true, image_url: true } },
        professionals: { select: { id: true, profession_type: true, users: { select: { full_name: true } } } },
      },
      orderBy: [{ scheduled_date: "asc" }, { start_time: "asc" }],
    }),
    prisma.session_participants.findMany({
      where: { student_id: studentId, sessions: { session_type: actTypes, activity_id: { not: null } } },
      include: {
        sessions: {
          include: {
            activities: { select: { id: true, name: true, image_url: true } },
            professionals: { select: { id: true, profession_type: true, users: { select: { full_name: true } } } },
            batches: { select: { id: true, batch_name: true, batch_type: true } },
          },
        },
      },
      orderBy: [{ sessions: { scheduled_date: "asc" } }, { sessions: { start_time: "asc" } }],
    }),
  ]);

  const activityMap = {};
  for (const s of individualSessions) {
    const id = s.activity_id;
    if (!activityMap[id]) activityMap[id] = { activity_id: id, activity_name: s.activities?.name, sessions: [] };
    activityMap[id].sessions.push({ ...s, source: "individual" });
  }
  for (const p of batchParticipations) {
    const id = p.sessions.activity_id;
    if (!activityMap[id]) activityMap[id] = { activity_id: id, activity_name: p.sessions.activities?.name, sessions: [] };
    activityMap[id].sessions.push({ ...p.sessions, source: "batch" });
  }

  return Object.values(activityMap).map(_withCounts);
}

// ── Count + percentage helper ──────────────────────────────────────────────

function _withCounts(entry) {
  const sessions = entry.sessions;
  const total = sessions.length;
  const completed = sessions.filter((s) => s.status === "completed").length;
  const absent = sessions.filter((s) => s.status === "absent").length;
  const pending = sessions.filter((s) => s.status === "scheduled").length;
  const ongoing = sessions.filter((s) => s.status === "ongoing").length;
  const completion_percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { ...entry, total_sessions: total, completed_sessions: completed, absent_sessions: absent, pending_sessions: pending, ongoing_sessions: ongoing, completion_percentage };
}

// ── Session detail ─────────────────────────────────────────────────────────

// ── Edit profile ──────────────────────────────────────────────────────────

/**
 * Single transaction: update users row + whichever type-specific row the
 * student has (individual_participants | personal_tutors | school_students |
 * batch_students for group_coaching).
 *
 * Only keys present in typeData are written — nothing is nulled out.
 */
async function editProfile(userId, studentType, userData, typeData) {
  return prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length > 0) {
      await tx.users.update({ where: { id: userId }, data: userData });
    }

    if (Object.keys(typeData).length === 0) return;

    // Re-fetch the student id inside the transaction
    const user = await tx.users.findUnique({
      where: { id: userId },
      select: { students: { select: { id: true } } },
    });
    const studentId = user?.students?.[0]?.id;
    if (!studentId) throw new Error("Student record not found");

    if (studentType === "individual_coaching" || studentType === "group_coaching") {
      const ip = await tx.individual_participants.findFirst({ where: { student_id: studentId }, select: { id: true } });
      if (!ip) throw new Error("Individual participant record not found");
      await tx.individual_participants.update({ where: { id: ip.id }, data: typeData });

    } else if (studentType === "personal_tutor") {
      const pt = await tx.personal_tutors.findFirst({ where: { student_id: studentId }, select: { id: true } });
      if (!pt) throw new Error("Personal tutor record not found");
      await tx.personal_tutors.update({ where: { id: pt.id }, data: typeData });

    } else if (studentType === "school_student") {
      const ss = await tx.school_students.findFirst({ where: { student_id: studentId }, select: { id: true } });
      if (!ss) throw new Error("School student record not found");
      await tx.school_students.update({ where: { id: ss.id }, data: typeData });
    }
  });
}

async function getSessionForAttendance(sessionId) {
  return prisma.sessions.findUnique({
    where: { id: Number(sessionId) },
    select: { scheduled_date: true, start_time: true, status: true },
  });
}

async function updateStudentAttendance(sessionId, studentId) {
  return prisma.session_participants.upsert({
    where: {
      session_id_student_id: {
        session_id: Number(sessionId),
        student_id: Number(studentId),
      },
    },
    update: { attended: true },
    create: {
      session_id: Number(sessionId),
      student_id: Number(studentId),
      attended: true,
    },
  });
}

module.exports = {
  getStudentIdByUserId,
  getToggleState,
  getSubjectsDashboardStats,
  getActivitiesDashboardStats,
  getSubjectsReminder,
  getSubjectsSessions,
  getSubjectsSessionById,
  getActivitiesReminder,
  getActivitiesSessions,
  getActivitiesSessionById,
  getSubjectsWithSessions,
  getActivitiesWithSessions,
  submitFeedback,
  editProfile,
  getSessionForAttendance,
  updateStudentAttendance,
};

async function submitFeedback(studentId, sessionId, rating, comment) {
  const session = await prisma.sessions.findFirst({
    where: {
      id: sessionId,
      status: "completed",
      OR: [
        { student_id: studentId },
        { session_participants: { some: { student_id: studentId } } },
      ],
    },
    select: { id: true },
  });
  if (!session) throw Object.assign(new Error("Session not found, not completed, or not yours"), { code: "NOT_FOUND" });

  return prisma.session_feedback.upsert({
    where: { uq_session_feedback: { session_id: sessionId, student_id: studentId } },
    create: { session_id: sessionId, student_id: studentId, rating, comment: comment ?? null },
    update: { rating, comment: comment ?? null },
  });
}

