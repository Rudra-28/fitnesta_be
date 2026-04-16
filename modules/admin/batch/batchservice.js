const prisma = require("../../../config/prisma");
const repo   = require("./batchrepo");
const notify = require("../../../utils/notifications");

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ── Standard session cap lookup ───────────────────────────────────────────────
// Returns the standard monthly session count for a given batch type + activity category.
// This is the denominator used in commission calculations AND the session count used
// when auto-generating sessions for a cycle.
async function resolveStandardCap(batchType, activityId) {
    const activity = await prisma.activities.findUnique({
        where:  { id: activityId },
        select: { activity_category: true },
    });
    const cat = activity?.activity_category ?? "sports";

    const ruleKeyMap = {
        group_coaching: {
            sports:     "group_society_sports_sessions_cap",
            non_sports: "group_society_non_sports_sessions_cap",
        },
        school_student: {
            sports:     "group_school_sports_sessions_cap",
            non_sports: "group_school_non_sports_sessions_cap",
        },
    };

    const ruleKey = ruleKeyMap[batchType]?.[cat];
    if (!ruleKey) return 18; // fallback

    const rule = await prisma.commission_rules.findUnique({ where: { rule_key: ruleKey } });
    return rule ? parseFloat(rule.value) : 18;
}

// Generate exactly `sessionCount` session dates starting from startDate
// on the given daysOfWeek, skipping already-existing dates.
function computeSessionDatesByCap(daysOfWeek, startDate, sessionCount, existingDatesSet) {
    const result  = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    while (result.length < sessionCount) {
        const dayName = DAY_NAMES[current.getDay()];
        const dateStr = current.toISOString().slice(0, 10);
        if (daysOfWeek.includes(dayName) && !existingDatesSet.has(dateStr)) {
            result.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
        // Safety: stop after scanning 180 days to avoid infinite loop
        if (current > new Date(startDate.getTime() + 180 * 86400000)) break;
    }
    return result;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function checkProfessionalConflictOnDates(professionalId, sessionDates, startTime, endTime, excludeBatchId = null) {
  // Build a set of conflicting sessions for the professional across the given dates
  const conflicts = await prisma.sessions.findMany({
    where: {
      professional_id: professionalId,
      scheduled_date: { in: sessionDates },
      status: { notIn: ["cancelled"] },
      batch_id: excludeBatchId ? { not: excludeBatchId } : undefined,
      AND: [{ start_time: { lt: endTime } }, { end_time: { gt: startTime } }],
    },
    select: { scheduled_date: true, batch_id: true, session_type: true },
    take: 1,
  });
  return conflicts.length > 0 ? conflicts[0] : null;
}

async function checkStudentConflict(studentId, date, startTime, endTime, excludeSessionId = null) {
  const directConflict = await prisma.sessions.findFirst({
    where: {
      student_id: studentId,
      scheduled_date: date,
      status: { notIn: ["cancelled"] },
      id: excludeSessionId ? { not: excludeSessionId } : undefined,
      AND: [{ start_time: { lt: endTime } }, { end_time: { gt: startTime } }],
    },
  });
  if (directConflict) return true;

  const batchConflict = await prisma.session_participants.findFirst({
    where: {
      student_id: studentId,
      sessions: {
        scheduled_date: date,
        status: { notIn: ["cancelled"] },
        id: excludeSessionId ? { not: excludeSessionId } : undefined,
        AND: [{ start_time: { lt: endTime } }, { end_time: { gt: startTime } }],
      },
    },
  });
  return batchConflict !== null;
}

function computeSessionDates(daysOfWeek, startDate, endDate, existingDatesSet) {
  const result = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const current = new Date(start);
  while (current <= end) {
    const dayName = DAY_NAMES[current.getDay()];
    const dateStr = current.toISOString().slice(0, 10);
    if (daysOfWeek.includes(dayName) && !existingDatesSet.has(dateStr)) {
      result.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return result;
}

// ── Service methods ──────────────────────────────────────────────────────────

async function createBatch({
  batch_type,
  society_id,
  school_id,
  activity_id,
  professional_id,
  professional_type,
  batch_name,
  days_of_week,
  start_time,
  end_time,
  start_date,
  end_date,
  session_cap,
}) {
  // school_student batches must use a trainer
  if (batch_type === "school_student") {
    const pro = await prisma.professionals.findUnique({
      where: { id: Number(professional_id) },
      select: { profession_type: true },
    });
    if (pro && pro.profession_type !== "trainer") {
      throw Object.assign(new Error("School batches require a trainer, not a teacher"), { code: "INVALID_PROFESSIONAL_TYPE" });
    }
  }

  // Validate: group_coaching requires society_id, school_student requires school_id
  if (batch_type === "group_coaching" && !society_id) {
    throw Object.assign(new Error("society_id is required for group_coaching batch"), { code: "SOCIETY_OR_SCHOOL_REQUIRED" });
  }
  if (batch_type === "school_student" && !school_id) {
    throw Object.assign(new Error("school_id is required for school_student batch"), { code: "SOCIETY_OR_SCHOOL_REQUIRED" });
  }

  if (!start_date || !end_date) {
    throw Object.assign(new Error("start_date and end_date are required"), { code: "DATE_RANGE_INVALID" });
  }
  const startDt = new Date(start_date);
  const endDt = new Date(end_date);
  if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
    throw Object.assign(new Error("start_date and end_date must be valid dates"), { code: "DATE_RANGE_INVALID" });
  }
  if (endDt < startDt) {
    throw Object.assign(new Error("end_date must be after start_date"), { code: "DATE_RANGE_INVALID" });
  }

  // Validate activity exists
  const activity = await prisma.activities.findUnique({ where: { id: Number(activity_id) } });
  if (!activity) throw Object.assign(new Error("Activity not found"), { code: "ACTIVITY_NOT_FOUND" });

  // Validate professional exists and is approved
  const professional = await prisma.professionals.findUnique({
    where: { id: Number(professional_id) },
    include: { users: { select: { approval_status: true } } },
  });
  if (!professional || professional.users?.approval_status !== "approved") {
    throw Object.assign(new Error("Professional not found or not approved"), { code: "PROFESSIONAL_NOT_FOUND" });
  }

  // Pre-conflict check: compute what dates would be generated and check the professional
  const existingDates = await repo.getExistingSessionDatesForBatch(-1, startDt, endDt); // -1 = no batch yet
  const sessionDates = computeSessionDates(days_of_week, startDt, endDt, existingDates);
  if (sessionDates.length === 0) {
    throw Object.assign(new Error("The selected days_of_week produce no sessions in the given date range"), { code: "NO_DAYS_IN_RANGE" });
  }

  // Parse time strings to Date objects for comparison (use a fixed base date)
  const startTimeDate = parseTimeString(start_time);
  const endTimeDate = parseTimeString(end_time);

  const conflict = await checkProfessionalConflictOnDates(Number(professional_id), sessionDates, startTimeDate, endTimeDate);
  if (conflict) {
    throw Object.assign(
      new Error(`Professional is already booked on ${conflict.scheduled_date.toISOString().slice(0, 10)} at this time`),
      { code: "PROFESSIONAL_CONFLICT" }
    );
  }

  // Resolve session_cap: admin-supplied or fallback to commission_rules
  let resolvedCap = session_cap ? Math.min(parseInt(session_cap), 99) : null;
  if (!resolvedCap) {
    resolvedCap = await resolveStandardCap(batch_type, Number(activity_id));
  }

  // Cycle end is derived after session generation — set a wide placeholder for now
  const batch = await repo.createBatch({
    batch_type,
    society_id: society_id ? Number(society_id) : null,
    school_id: school_id ? Number(school_id) : null,
    activity_id: Number(activity_id),
    professional_id: Number(professional_id),
    professional_type,
    batch_name: batch_name || null,
    days_of_week,
    start_time: startTimeDate,
    end_time: endTimeDate,
    start_date: startDt,
    end_date: endDt,
    cycle_start_date: startDt,
    cycle_end_date:   startDt, // will be updated when sessions are generated
    session_cap:      resolvedCap,
  });

  return {
    ...batch,
    _note: "The session count cannot be changed once sessions are created.",
  };
}

async function getBatch(batchId) {
  const batch = await repo.getBatchById(Number(batchId));
  if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });
  return batch;
}

async function listBatches(filters) {
  return repo.listBatches(filters);
}

async function updateBatch(batchId, updates) {
  const batch = await repo.getBatchById(Number(batchId));
  if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });
  if (!batch.is_active) throw Object.assign(new Error("Batch is inactive"), { code: "BATCH_INACTIVE" });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sessionUpdates = {};

  // If professional changed, conflict-check on all future session dates
  if (updates.professional_id && updates.professional_id !== batch.professional_id) {
    const futureSessions = await prisma.sessions.findMany({
      where: { batch_id: batch.id, scheduled_date: { gt: today }, status: "scheduled" },
      select: { scheduled_date: true },
    });
    const futureDates = futureSessions.map((s) => s.scheduled_date);
    if (futureDates.length > 0) {
      const newStartTime = updates.start_time ? parseTimeString(updates.start_time) : batch.start_time;
      const newEndTime = updates.end_time ? parseTimeString(updates.end_time) : batch.end_time;
      const conflict = await checkProfessionalConflictOnDates(
        Number(updates.professional_id),
        futureDates,
        newStartTime,
        newEndTime,
        batch.id
      );
      if (conflict) {
        throw Object.assign(
          new Error(`New professional is already booked on ${conflict.scheduled_date.toISOString().slice(0, 10)}`),
          { code: "PROFESSIONAL_CONFLICT" }
        );
      }
    }
    sessionUpdates.professional_id = Number(updates.professional_id);
  }

  if (updates.start_time) {
    const parsed = parseTimeString(updates.start_time);
    updates.start_time = parsed;
    sessionUpdates.start_time = parsed;
  }
  if (updates.end_time) {
    const parsed = parseTimeString(updates.end_time);
    updates.end_time = parsed;
    sessionUpdates.end_time = parsed;
  }

  // Handle days_of_week change: cancel sessions on removed days
  let dayNamesToCancel = [];
  if (updates.days_of_week) {
    const oldDays = Array.isArray(batch.days_of_week) ? batch.days_of_week : JSON.parse(batch.days_of_week);
    const newDays = updates.days_of_week;
    dayNamesToCancel = oldDays.filter((d) => !newDays.includes(d));
  }

  // Lock session_cap once sessions exist for this batch
  if (updates.session_cap !== undefined) {
    const sessionCount = await prisma.sessions.count({ where: { batch_id: batch.id } });
    if (sessionCount > 0) {
      throw Object.assign(
        new Error("The session count cannot be changed once sessions are created."),
        { code: "SESSION_CAP_LOCKED" }
      );
    }
  }

  const batchUpdateData = { updated_at: new Date() };
  if (updates.professional_id) batchUpdateData.professional_id = Number(updates.professional_id);
  if (updates.professional_type) batchUpdateData.professional_type = updates.professional_type;
  if (updates.start_time) batchUpdateData.start_time = updates.start_time;
  if (updates.end_time) batchUpdateData.end_time = updates.end_time;
  if (updates.days_of_week) batchUpdateData.days_of_week = updates.days_of_week;
  if (updates.end_date) batchUpdateData.end_date = new Date(updates.end_date);
  if (updates.batch_name !== undefined) batchUpdateData.batch_name = updates.batch_name;
  if (updates.session_cap !== undefined) batchUpdateData.session_cap = Math.min(parseInt(updates.session_cap), 99);

  await repo.updateBatch(batch.id, batchUpdateData);

  if (Object.keys(sessionUpdates).length > 0) {
    await repo.updateFutureSessionsProfessionalAndTime(batch.id, { ...sessionUpdates, updated_at: new Date() });
  }

  if (dayNamesToCancel.length > 0) {
    await repo.cancelSessionsOnRemovedDays(batch.id, dayNamesToCancel);
  }

  notify.notifyBatchUpdated(batch, updates).catch(() => {});

  return repo.getBatchById(batch.id);
}

async function deleteBatch(batchId) {
  const batch = await repo.getBatchById(Number(batchId));
  if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });

  notify.notifyBatchDeleted(batch).catch(() => {});
  await repo.cancelFutureBatchSessions(batch.id);
  await repo.softDeleteBatch(batch.id);
  return { success: true };
}

/**
 * Generate sessions for the current (or next) cycle of a batch.
 *
 * Uses the standard session cap (from commission_rules via activity_category)
 * to determine exactly how many sessions to generate — NOT a fixed 30-day window.
 *
 * e.g. Society Sports (cap=20, 5 days/week) → generates 20 sessions forward from cycle_start.
 *      Society Dance  (cap=15, 3 days/week) → generates 15 sessions forward from cycle_start.
 *
 * The cycle_end_date is set to the date of the LAST generated session.
 * Existing session dates are skipped (deduplication).
 */
async function generateSessions(batchId, { session_cap_override, start_date_override } = {}) {
    const batch = await repo.getBatchById(Number(batchId));
    if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });
    if (!batch.is_active) throw Object.assign(new Error("Batch is inactive"), { code: "BATCH_INACTIVE" });

    const standardCap = session_cap_override
        ? Number(session_cap_override)
        : (batch.session_cap ?? await resolveStandardCap(batch.batch_type, batch.activity_id));

    // Cycle starts from the admin-supplied start_date_override, or the stored cycle_start_date, or batch start_date
    const cycleStart = start_date_override
        ? new Date(start_date_override)
        : new Date(batch.cycle_start_date ?? batch.start_date);
    cycleStart.setHours(0, 0, 0, 0);

    const daysOfWeek = Array.isArray(batch.days_of_week)
        ? batch.days_of_week
        : JSON.parse(batch.days_of_week);

    // Use a wide look-ahead window to find enough dates (180 days max)
    const lookAheadEnd = new Date(cycleStart.getTime() + 180 * 86400000);
    const existingDates = await repo.getExistingSessionDatesForBatch(batch.id, cycleStart, lookAheadEnd);

    const sessionDates = computeSessionDatesByCap(daysOfWeek, cycleStart, standardCap, existingDates);

    if (sessionDates.length === 0) {
        return { generated: 0, message: "No new session dates to generate in this cycle." };
    }

    // cycle_end = last generated session date
    const cycleEnd = new Date(sessionDates[sessionDates.length - 1]);

    // Get current batch students for session_participants
    const batchStudents = await repo.getBatchStudents(batch.id);
    const studentIds    = batchStudents.map((bs) => bs.student_id);

    let generatedCount = 0;
    for (const date of sessionDates) {
        await repo.createSessionWithParticipants(
            {
                session_type:    batch.batch_type === "school_student" ? "school_student" : "group_coaching",
                batch_id:        batch.id,
                student_id:      null,
                professional_id: batch.professional_id,
                activity_id:     batch.activity_id,
                scheduled_date:  date,
                start_time:      batch.start_time,
                end_time:        batch.end_time,
                status:          "scheduled",
            },
            studentIds
        );
        generatedCount++;
    }

    // Update cycle window on the batch
    await prisma.batches.update({
        where: { id: batch.id },
        data: {
            cycle_start_date: cycleStart,
            cycle_end_date:   cycleEnd,
            updated_at:       new Date(),
        },
    });

    return {
        generated:   generatedCount,
        standard_cap: standardCap,
        cycle_start: cycleStart,
        cycle_end:   cycleEnd,
    };
}

async function bulkAssignStudents(batchId, studentIds) {
  const batch = await repo.getBatchById(Number(batchId));
  if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });
  if (!batch.is_active) throw Object.assign(new Error("Batch is inactive"), { code: "BATCH_INACTIVE" });

  // Validate students exist and have compatible type
  const students = await prisma.students.findMany({
    where: { id: { in: studentIds.map(Number) } },
    select: { id: true, student_type: true, users: { select: { full_name: true } } },
  });

  const foundIds = new Set(students.map((s) => s.id));
  const notFound = studentIds.filter((id) => !foundIds.has(Number(id)));
  if (notFound.length > 0) {
    throw Object.assign(new Error(`Students not found: ${notFound.join(", ")}`), { code: "STUDENT_NOT_FOUND" });
  }

  const incompatible = students.filter((s) => s.student_type !== batch.batch_type);
  if (incompatible.length > 0) {
    throw Object.assign(
      new Error(
        `Students incompatible with batch type '${batch.batch_type}': ${incompatible.map((s) => s.users?.full_name || s.id).join(", ")}`
      ),
      { code: "INVALID_BATCH_TYPE" }
    );
  }

  // Check for conflicts on future batch sessions
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureSessions = await prisma.sessions.findMany({
    where: { batch_id: batch.id, scheduled_date: { gte: today }, status: { in: ["scheduled", "ongoing"] } },
    select: { id: true, scheduled_date: true, start_time: true, end_time: true },
  });

  const conflicted = [];
  const assignable = [];

  for (const student of students) {
    let hasConflict = false;
    for (const session of futureSessions) {
      const conflict = await checkStudentConflict(
        student.id,
        session.scheduled_date,
        session.start_time,
        session.end_time
      );
      if (conflict) {
        conflicted.push({ student_id: student.id, name: student.users?.full_name, date: session.scheduled_date });
        hasConflict = true;
        break;
      }
    }
    if (!hasConflict) assignable.push(student.id);
  }

  if (assignable.length > 0) {
    await repo.bulkCreateBatchStudents(assignable.map((id) => ({ batch_id: batch.id, student_id: id })));
    await repo.addParticipantsToFutureBatchSessions(batch.id, assignable);

    // Auto-set membership_start_date and membership_end_date for each enrolled student
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const studentId of assignable) {
      const student = students.find((s) => s.id === studentId);
      if (!student) continue;

      if (batch.batch_type === "group_coaching") {
        // individual_participants
        const ip = await prisma.individual_participants.findFirst({
          where: { student_id: studentId },
          select: { id: true, term_months: true, membership_start_date: true },
        });
        if (ip && !ip.membership_start_date) {
          const endDate = new Date(today);
          endDate.setMonth(endDate.getMonth() + (ip.term_months || 1));
          await prisma.individual_participants.update({
            where: { id: ip.id },
            data: {
              membership_start_date: today,
              membership_end_date:   endDate,
              batch_id:              batch.id,
            },
          });
        }
      } else if (batch.batch_type === "school_student") {
        // school_students
        const ss = await prisma.school_students.findFirst({
          where: { student_id: studentId },
          select: { id: true, term_months: true, membership_start_date: true },
        });
        if (ss && !ss.membership_start_date) {
          const endDate = new Date(today);
          endDate.setMonth(endDate.getMonth() + (ss.term_months || 9));
          await prisma.school_students.update({
            where: { id: ss.id },
            data: {
              membership_start_date: today,
              membership_end_date:   endDate,
            },
          });
        }
      }
    }
  }

  return { assigned: assignable.length, skipped_conflicts: conflicted };
}

async function removeBatchStudent(batchId, studentId) {
  const batch = await repo.getBatchById(Number(batchId));
  if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });

  await repo.removeParticipantFromFutureBatchSessions(batch.id, Number(studentId));
  await repo.removeBatchStudent(batch.id, Number(studentId));
  return { success: true };
}

// ── Unassigned students ──────────────────────────────────────────────────────

/**
 * Returns group_coaching students for a given society+activity who have no batch assignment.
 * Admin uses this to manually fill a new batch.
 */
async function getUnassignedGroupStudents(societyId, activityId) {
  // All group_coaching students in this society (regardless of existing batch assignment)
  const rows = await prisma.individual_participants.findMany({
    where: {
      society_id: Number(societyId),
      students:   { student_type: "group_coaching" },
    },
    include: {
      students: {
        select: {
          id:   true,
          users: { select: { full_name: true, mobile: true } },
        },
      },
      batches: {
        select: { id: true, batch_name: true },
      },
    },
  });

  // Filter by activity name if activityId given (individual_participants stores activity as string name)
  if (activityId) {
    const activity = await prisma.activities.findUnique({
      where: { id: Number(activityId) },
      select: { name: true },
    });
    if (activity) {
      return rows.filter(r => r.activity === activity.name);
    }
  }
  return rows;
}

// ── Batch Detail (admin card view) ───────────────────────────────────────────

async function getBatchDetail(batchId) {
  const batch = await repo.getBatchById(Number(batchId));
  if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sessionInclude = {
    professionals: {
      select: {
        id: true,
        profession_type: true,
        users: { select: { full_name: true, mobile: true } },
      },
    },
    session_participants: {
      select: {
        attended:   true,
        student_id: true,
        students:   { select: { users: { select: { full_name: true } } } },
      },
    },
  };

  // Past sessions with participant attendance + who handled it
  const pastSessions = await prisma.sessions.findMany({
    where: {
      batch_id:       batch.id,
      scheduled_date: { lt: today },
    },
    include: sessionInclude,
    orderBy: { scheduled_date: "desc" },
    take: 100,
  });

  // Upcoming sessions with professional info
  const upcomingSessions = await prisma.sessions.findMany({
    where: {
      batch_id:       batch.id,
      scheduled_date: { gte: today },
      status:         { in: ["scheduled", "ongoing"] },
    },
    include: sessionInclude,
    orderBy: { scheduled_date: "asc" },
  });

  // Current cycle settlement preview (read-only)
  const preview = batch.cycle_start_date
    ? await computeSettlementPreview(batch)
    : null;

  return {
    batch,
    students:          batch.batch_students,
    past_sessions:     pastSessions,
    upcoming_sessions: upcomingSessions,
    settlement_preview: preview,
  };
}

// ── Settlement ───────────────────────────────────────────────────────────────

/**
 * Returns the commission calculation for the current cycle of a batch.
 * Does NOT write anything to the DB.
 */
async function getSettlementPreview(batchId) {
  const batch = await repo.getBatchById(Number(batchId));
  if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });
  if (!batch.cycle_start_date) {
    throw Object.assign(new Error("No active cycle found. Generate sessions first."), { code: "NO_CYCLE" });
  }
  return computeSettlementPreview(batch);
}

async function computeSettlementPreview(batch) {
    const cycleStart = new Date(batch.cycle_start_date);
    const cycleEnd   = new Date(batch.cycle_end_date);

    // Standard cap = denominator for per-session rate.
    // If the batch has a session_cap set, use it. Otherwise fall back to commission_rules.
    // Dynamic override: if actual sessions in this cycle differ from cap, use actual count.
    const standardCap = batch.session_cap
      ? batch.session_cap
      : await resolveStandardCap(batch.batch_type, batch.activity_id);

    // Sessions generated in this cycle
    const sessions = await prisma.sessions.findMany({
        where: {
            batch_id:       batch.id,
            scheduled_date: { gte: cycleStart, lte: cycleEnd },
            status:         { not: "cancelled" },
        },
        select: { id: true, status: true, professional_id: true },
    });

    const sessionsGenerated = sessions.length;
    const sessionsAttended  = sessions.filter(s => s.status === "completed").length;

    // Sum effective monthly fees per student in the batch (using their term_months)
    const batchStudentIds = (batch.batch_students ?? []).map(bs => bs.student_id);
    let baseAmount = 0;

    if (batchStudentIds.length > 0) {
        const isSchool = batch.batch_type === "school_student";

        if (isSchool) {
            // School students: look up their fee from payments (school_student service)
            for (const studentId of batchStudentIds) {
                const student = await prisma.students.findUnique({
                    where:  { id: studentId },
                    select: {
                        school_students: { select: { term_months: true } },
                        users:           { select: { id: true } },
                    },
                });
                const userId     = student?.users?.id;
                const termMonths = student?.school_students?.[0]?.term_months ?? 9;
                if (!userId) continue;
                const payment = await prisma.payments.findFirst({
                    where:   { student_user_id: userId, service_type: "school_student", status: "captured" },
                    orderBy: { captured_at: "desc" },
                    select:  { amount: true },
                });
                if (payment) baseAmount += parseFloat((parseFloat(payment.amount) / termMonths).toFixed(2));
            }
        } else {
            // Society group coaching: look up individual_participants for term_months + fee_structure
            const society = batch.societies;
            for (const studentId of batchStudentIds) {
                const ip = await prisma.individual_participants.findFirst({
                    where:  { student_id: studentId, batch_id: batch.id },
                    select: { term_months: true },
                });
                const termMonths = ip?.term_months ?? 1;
                const fs = await prisma.fee_structures.findFirst({
                    where: {
                        activity_id:      batch.activity_id,
                        coaching_type:    "group_coaching",
                        term_months:      termMonths,
                        society_category: society?.society_category ?? undefined,
                    },
                    select: { effective_monthly: true, total_fee: true },
                });
                if (fs) {
                    baseAmount += fs.effective_monthly
                        ? parseFloat(fs.effective_monthly)
                        : parseFloat(fs.total_fee);
                }
            }
        }
    }

    // Commission rate: check student count vs min threshold for society batches
    const isSchoolBatch   = batch.batch_type === "school_student";
    const ruleKey         = isSchoolBatch ? "trainer_group_school_rate" : "trainer_group_society_rate";
    const minStudentsRule = isSchoolBatch ? null : "trainer_group_society_min_students";
    const flatRule        = isSchoolBatch ? null : "trainer_group_society_flat_amount";

    const commissionRule  = await prisma.commission_rules.findUnique({ where: { rule_key: ruleKey } });
    const commissionRate  = commissionRule ? parseFloat(commissionRule.value) : (isSchoolBatch ? 45 : 50);

    let commissionAmount = 0;
    let isFlat = false;
    let flatPerSession = 0;

    if (!isSchoolBatch && minStudentsRule) {
        const minRule = await prisma.commission_rules.findUnique({ where: { rule_key: minStudentsRule } });
        const minStudents = minRule ? parseFloat(minRule.value) : 10;

        if (batchStudentIds.length < minStudents) {
            isFlat = true;
            const flatRuleRow = await prisma.commission_rules.findUnique({ where: { rule_key: flatRule } });
            flatPerSession    = flatRuleRow ? parseFloat(flatRuleRow.value) : 300;
            commissionAmount  = parseFloat((sessionsAttended * flatPerSession).toFixed(2));
        }
    }

    if (!isFlat) {
        const totalPool = parseFloat(((baseAmount * commissionRate) / 100).toFixed(2));
        // Dynamic override: if actual sessions in cycle differ from cap, use actual count as cap
        const effectiveCap = sessionsGenerated !== standardCap && sessionsGenerated > 0
          ? sessionsGenerated
          : standardCap;
        const perSessionRate = effectiveCap > 0 ? parseFloat((totalPool / effectiveCap).toFixed(2)) : 0;
        commissionAmount     = parseFloat((sessionsAttended * perSessionRate).toFixed(2));
    }

    const today        = new Date();
    today.setHours(0, 0, 0, 0);
    const cycleComplete = today > cycleEnd;

    const effectiveCap = sessionsGenerated !== standardCap && sessionsGenerated > 0
      ? sessionsGenerated
      : standardCap;

    return {
        cycle_start:         cycleStart,
        cycle_end:           cycleEnd,
        cycle_complete:      cycleComplete,
        settlement_locked:   !cycleComplete,
        standard_cap:        standardCap,
        effective_cap:       effectiveCap,
        cap_overridden:      effectiveCap !== standardCap,
        sessions_generated:  sessionsGenerated,
        sessions_attended:   sessionsAttended,
        student_count:       batchStudentIds.length,
        base_amount:         parseFloat(baseAmount.toFixed(2)),
        commission_rate:     isFlat ? 0 : commissionRate,
        is_flat_rate:        isFlat,
        flat_per_session:    isFlat ? flatPerSession : null,
        commission_amount:   commissionAmount,
    };
}

/**
 * Settle the current cycle for a batch.
 * Locked until cycle_end_date has passed.
 * Creates a batch_cycle_settlements record, credits the trainer's wallet,
 * then advances the cycle start to the day after cycle_end_date.
 */
async function settleBatchCycle(batchId) {
  const batch = await repo.getBatchById(Number(batchId));
  if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });
  if (!batch.cycle_start_date) {
    throw Object.assign(new Error("No active cycle to settle. Generate sessions first."), { code: "NO_CYCLE" });
  }

  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const cycleEnd = new Date(batch.cycle_end_date);

  if (today <= cycleEnd) {
    throw Object.assign(new Error("Cycle is not yet complete. Settlement is locked until " + cycleEnd.toISOString().slice(0, 10)), { code: "CYCLE_INCOMPLETE" });
  }

  // Check not already settled for this cycle
  const existing = await prisma.batch_cycle_settlements.findFirst({
    where: { batch_id: batch.id, cycle_start: new Date(batch.cycle_start_date) },
  });
  if (existing) {
    throw Object.assign(new Error("This cycle has already been settled"), { code: "ALREADY_SETTLED" });
  }

  const preview = await computeSettlementPreview(batch);

  // Write settlement record + commission record in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.batch_cycle_settlements.create({
      data: {
        batch_id:           batch.id,
        cycle_start:        new Date(batch.cycle_start_date),
        cycle_end:          new Date(batch.cycle_end_date),
        sessions_allocated: preview.sessions_generated,
        sessions_attended:  preview.sessions_attended,
        base_amount:        preview.base_amount,
        commission_rate:    preview.commission_rate,
        commission_amount:  preview.commission_amount,
        status:             "settled",
        settled_at:         new Date(),
      },
    });

    if (preview.commission_amount > 0) {
      // Credit trainer/teacher commissions wallet (status: pending → admin approves → marks paid)
      const sourceType = batch.batch_type === "school_student"
          ? "group_coaching_school"
          : "group_coaching_society";

      await tx.commissions.create({
        data: {
          professional_id:   batch.professional_id,
          professional_type: "trainer",
          source_type:       sourceType,
          source_id:         batch.id,
          entity_id:         batch.society_id ?? batch.school_id ?? null,
          base_amount:       preview.base_amount,
          commission_rate:   preview.commission_rate,
          commission_amount: preview.commission_amount,
          status:            "pending",
        },
      });
    }

    // Advance cycle: new cycle starts the day after current cycle_end
    const newCycleStart = new Date(batch.cycle_end_date);
    newCycleStart.setDate(newCycleStart.getDate() + 1);

    await tx.batches.update({
      where: { id: batch.id },
      data: {
        cycle_start_date: newCycleStart,
        cycle_end_date:   newCycleStart, // will be updated by generateSessions
        last_settled_at:  new Date(),
        updated_at:       new Date(),
      },
    });
  });

  // Auto-generate sessions for the next cycle (outside transaction — non-fatal if it fails)
  try {
    await generateSessions(batch.id);
  } catch (err) {
    console.error(`[Settlement] Auto-generate sessions for next cycle failed on batch ${batch.id}:`, err.message);
  }

  return { success: true, commission_amount: preview.commission_amount };
}

/**
 * Mark a settled cycle as paid. Moves the status to 'paid' in batch_cycle_settlements.
 */
async function markSettlementPaid(settlementId) {
  const settlement = await prisma.batch_cycle_settlements.findUnique({
    where: { id: Number(settlementId) },
  });
  if (!settlement) throw Object.assign(new Error("Settlement not found"), { code: "NOT_FOUND" });
  if (settlement.status !== "settled") {
    throw Object.assign(new Error("Only 'settled' records can be marked as paid"), { code: "INVALID_STATUS" });
  }

  return prisma.batch_cycle_settlements.update({
    where: { id: settlement.id },
    data:  { status: "paid", paid_at: new Date() },
  });
}

/**
 * List all settlement records for a batch.
 */
async function listSettlements(batchId) {
  return prisma.batch_cycle_settlements.findMany({
    where:   { batch_id: Number(batchId) },
    orderBy: { cycle_start: "desc" },
  });
}

// ── Utility ──────────────────────────────────────────────────────────────────

function parseTimeString(timeStr) {
  if (timeStr instanceof Date) return timeStr;
  const str = String(timeStr).trim();

  // Full ISO datetime string (e.g. "1970-01-01T05:00:00.000Z" from Prisma DateTime fields)
  if (str.includes('T') || (str.includes('-') && str.includes(':'))) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }

  // 12-hour format with AM/PM (e.g. "4:30 PM" from toLocaleTimeString)
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = Number(ampmMatch[1]);
    const m = Number(ampmMatch[2]);
    const s = Number(ampmMatch[3] ?? 0);
    const meridiem = ampmMatch[4].toUpperCase();
    if (meridiem === 'PM' && h < 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return new Date(1970, 0, 1, h, m, s);
  }

  // HH:MM or HH:MM:SS (24-hour, the expected format from <input type="time">)
  const [h, m, s = '0'] = str.split(':');
  const d = new Date(1970, 0, 1, Number(h), Number(m), Number(s));
  return d;
}

/**
 * Reassign a single batch session to a different professional.
 * - Session must belong to the batch and be scheduled/ongoing.
 * - Conflict-checks the new professional at that slot (excludes the session itself).
 * - No trainer_assignments impact — only the individual session record changes.
 */
async function reassignBatchSession(batchId, sessionId, newProfessionalId) {
  const batch = await repo.getBatchById(batchId);
  if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });

  const session = await prisma.sessions.findUnique({ where: { id: sessionId } });
  if (!session || session.batch_id !== batchId) {
    throw Object.assign(new Error("Session not found in this batch"), { code: "BATCH_NOT_FOUND" });
  }
  if (["completed", "cancelled", "absent"].includes(session.status)) {
    throw Object.assign(new Error(`Cannot reassign a ${session.status} session`), { code: "INVALID_STATUS" });
  }

  const professional = await prisma.professionals.findUnique({
    where: { id: newProfessionalId },
    include: { users: { select: { approval_status: true } } },
  });
  if (!professional || professional.users?.approval_status !== "approved") {
    throw Object.assign(new Error("Professional not found or not approved"), { code: "PROFESSIONAL_NOT_FOUND" });
  }

  // Conflict check — exclude this session
  const conflict = await prisma.sessions.findFirst({
    where: {
      id:              { not: sessionId },
      professional_id: newProfessionalId,
      scheduled_date:  session.scheduled_date,
      status:          { in: ["scheduled", "ongoing"] },
      AND: [
        { start_time: { lt: session.end_time } },
        { end_time:   { gt: session.start_time } },
      ],
    },
  });
  if (conflict) {
    throw Object.assign(new Error("New professional is already booked at this date and time"), { code: "PROFESSIONAL_CONFLICT" });
  }

  const updated = await prisma.sessions.update({
    where: { id: sessionId },
    data:  { professional_id: newProfessionalId, updated_at: new Date() },
  });

  notify.notifyBatchSessionReassigned(batch, session, newProfessionalId).catch(() => {});

  const commissionService = require("../../commissions/commissionservice");
  await commissionService.ensureBatchProfessionalAssignment({
    professionalId:   newProfessionalId,
    professionalType: professional.profession_type,
    batchType:        batch.batch_type,
    societyId:        batch.society_id ?? null,
    schoolId:         batch.school_id ?? null,
    activityId:       batch.activity_id ?? null,
    assignedFrom:     session.scheduled_date ?? new Date(),
  });

  return updated;
}

/**
 * Reassign all future scheduled sessions of a batch to a different professional.
 * Also updates the batch's own professional_id so new generated sessions use the new pro.
 * Creates a new trainer_assignments record for the new professional.
 */
async function reassignAllFutureBatchSessions(batchId, newProfessionalId) {
  const batch = await repo.getBatchById(batchId);
  if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });
  if (!batch.is_active) throw Object.assign(new Error("Batch is inactive"), { code: "BATCH_INACTIVE" });

  const professional = await prisma.professionals.findUnique({
    where: { id: newProfessionalId },
    include: { users: { select: { approval_status: true } } },
  });
  if (!professional || professional.users?.approval_status !== "approved") {
    throw Object.assign(new Error("Professional not found or not approved"), { code: "PROFESSIONAL_NOT_FOUND" });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await prisma.sessions.updateMany({
    where: {
      batch_id:       batchId,
      status:         "scheduled",
      scheduled_date: { gte: today },
    },
    data: { professional_id: newProfessionalId, updated_at: new Date() },
  });

  // Update batch's own professional so future generate-sessions uses new pro
  await prisma.batches.update({
    where: { id: batchId },
    data:  { professional_id: newProfessionalId },
  });

  // Deactivate old trainer_assignment for this batch
  if (batch.professional_id !== newProfessionalId) {
    await prisma.trainer_assignments.updateMany({
      where: {
        professional_id: batch.professional_id,
        assignment_type: batch.batch_type === "group_coaching" ? "group_coaching_society" : "group_coaching_school",
        society_id:      batch.society_id ?? null,
        school_id:       batch.school_id  ?? null,
        activity_id:     batch.activity_id ?? null,
        is_active:       true,
      },
      data: { is_active: false },
    });

    // Create new trainer_assignment for new professional
    const commissionService = require("../../commissions/commissionservice");
    if (batch.batch_type === "group_coaching" && batch.school_id == null) {
      await commissionService.recordSchoolTrainerAssignment(newProfessionalId, batch.school_id, batch.activity_id);
    }
    // For group_coaching_society a direct create is simpler
    const existingAssignment = await prisma.trainer_assignments.findFirst({
      where: {
        professional_id: newProfessionalId,
        assignment_type: batch.batch_type === "group_coaching" ? "group_coaching_society" : "group_coaching_school",
        society_id:      batch.society_id ?? null,
        school_id:       batch.school_id  ?? null,
        activity_id:     batch.activity_id ?? null,
        is_active:       true,
      },
    });
    if (!existingAssignment) {
      await prisma.trainer_assignments.create({
        data: {
          professional_id:    newProfessionalId,
          professional_type:  professional.profession_type,
          assignment_type:    batch.batch_type === "group_coaching" ? "group_coaching_society" : "group_coaching_school",
          society_id:         batch.society_id ?? null,
          school_id:          batch.school_id  ?? null,
          activity_id:        batch.activity_id ?? null,
          sessions_allocated: null,
          assigned_from:      new Date(),
          is_active:          true,
        },
      });
    }
  }

  notify.notifyAllBatchSessionsReassigned(batch, newProfessionalId).catch(() => {});

  return { updated_sessions: count, new_professional_id: newProfessionalId };
}

/**
 * Extend a student's membership term inside a batch.
 * Adds `term_months` (or a custom number) to the existing membership_end_date.
 * If no membership_end_date exists yet, sets start = today and end = today + months.
 */
async function extendStudentTerm(batchId, studentId, extraMonths) {
  const batch = await repo.getBatchById(Number(batchId));
  if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });

  // Verify student is actually in this batch
  const enrollment = await prisma.batch_students.findFirst({
    where: { batch_id: Number(batchId), student_id: Number(studentId) },
  });
  if (!enrollment) throw Object.assign(new Error("Student not found in this batch"), { code: "STUDENT_NOT_FOUND" });

  const months = Number(extraMonths);
  if (!months || months < 1 || months > 12) {
    throw Object.assign(new Error("extra_months must be between 1 and 12"), { code: "INVALID_EXTEND_MONTHS" });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (batch.batch_type === "group_coaching") {
    const ip = await prisma.individual_participants.findFirst({
      where: { student_id: Number(studentId) },
      select: { id: true, term_months: true, membership_start_date: true, membership_end_date: true },
    });
    if (!ip) throw Object.assign(new Error("Student record not found"), { code: "STUDENT_NOT_FOUND" });

    const base  = ip.membership_end_date ? new Date(ip.membership_end_date) : today;
    const newEnd = new Date(base);
    newEnd.setMonth(newEnd.getMonth() + months);

    await prisma.individual_participants.update({
      where: { id: ip.id },
      data: {
        membership_start_date: ip.membership_start_date ?? today,
        membership_end_date:   newEnd,
        term_months:           (ip.term_months || 0) + months,
        is_active:             true,
      },
    });
    return { student_id: Number(studentId), new_membership_end_date: newEnd };
  } else {
    // school_student
    const ss = await prisma.school_students.findFirst({
      where: { student_id: Number(studentId) },
      select: { id: true, term_months: true, membership_start_date: true, membership_end_date: true },
    });
    if (!ss) throw Object.assign(new Error("Student record not found"), { code: "STUDENT_NOT_FOUND" });

    const base  = ss.membership_end_date ? new Date(ss.membership_end_date) : today;
    const newEnd = new Date(base);
    newEnd.setMonth(newEnd.getMonth() + months);

    await prisma.school_students.update({
      where: { id: ss.id },
      data: {
        membership_start_date: ss.membership_start_date ?? today,
        membership_end_date:   newEnd,
        term_months:           (ss.term_months || 0) + months,
        is_active:             true,
      },
    });
    return { student_id: Number(studentId), new_membership_end_date: newEnd };
  }
}

/**
 * Create a single extra session inside an existing batch on a specific date.
 * Admin uses this to add an ad-hoc session (e.g. makeup class, extra practice).
 * Adds all current batch_students as session_participants automatically.
 */
async function createBatchSession(batchId, { scheduled_date, start_time, end_time, professional_id }) {
  const batch = await repo.getBatchById(Number(batchId));
  if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });
  if (!batch.is_active) throw Object.assign(new Error("Batch is inactive"), { code: "BATCH_INACTIVE" });

  if (!scheduled_date) throw Object.assign(new Error("scheduled_date is required"), { code: "MISSING_FIELDS" });

  const date = new Date(scheduled_date);
  if (isNaN(date.getTime())) throw Object.assign(new Error("Invalid scheduled_date"), { code: "DATE_RANGE_INVALID" });

  const startT = start_time ? parseTimeString(start_time) : batch.start_time;
  const endT   = end_time   ? parseTimeString(end_time)   : batch.end_time;

  const proId = professional_id ? Number(professional_id) : batch.professional_id;

  // Validate professional if overridden
  if (professional_id) {
    const pro = await prisma.professionals.findUnique({
      where: { id: proId },
      include: { users: { select: { approval_status: true } } },
    });
    if (!pro || pro.users?.approval_status !== "approved") {
      throw Object.assign(new Error("Professional not found or not approved"), { code: "PROFESSIONAL_NOT_FOUND" });
    }
  }

  // Conflict check for professional
  const conflict = await prisma.sessions.findFirst({
    where: {
      professional_id: proId,
      scheduled_date:  date,
      status: { notIn: ["cancelled"] },
      AND: [{ start_time: { lt: endT } }, { end_time: { gt: startT } }],
    },
  });
  if (conflict) {
    throw Object.assign(new Error(`Professional is already booked on ${scheduled_date} at this time`), { code: "PROFESSIONAL_CONFLICT" });
  }

  // Get current batch students to add as participants
  const batchStudents = await repo.getBatchStudents(batch.id);
  const studentIds = batchStudents.map((bs) => bs.student_id);

  const session = await repo.createSessionWithParticipants(
    {
      session_type:    batch.batch_type === "school_student" ? "school_student" : "group_coaching",
      batch_id:        batch.id,
      student_id:      null,
      professional_id: proId,
      activity_id:     batch.activity_id,
      scheduled_date:  date,
      start_time:      startT,
      end_time:        endT,
      status:          "scheduled",
    },
    studentIds
  );

  return session;
}

/**
 * Returns approved professionals eligible to be assigned/reassigned for a batch.
 * - school_student batches: trainers only
 * - group_coaching batches: use the batch's professional_type (trainer/teacher)
 * - If batchId is not provided, type param is used directly.
 */
async function getAvailableProfessionalsForBatch(batchId, type) {
  let professionalType = type;
  if (batchId) {
    const batch = await repo.getBatchById(Number(batchId));
    if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });
    professionalType = batch.batch_type === "school_student" ? "trainer" : batch.professional_type;
  }

  if (!professionalType) throw Object.assign(new Error("type is required"), { code: "MISSING_FIELDS" });

  const rows = await prisma.professionals.findMany({
    where: {
      profession_type: professionalType,
      users: { approval_status: "approved" },
    },
    select: {
      id: true,
      profession_type: true,
      users: { select: { full_name: true, mobile: true } },
      trainers: { select: { category: true, specified_game: true } },
      teachers: { select: { subject: true } },
    },
    orderBy: { id: "desc" },
  });

  return rows.map((r) => ({
    professional_id:  r.id,
    profession_type:  r.profession_type,
    full_name:        r.users?.full_name ?? null,
    mobile:           r.users?.mobile ?? null,
    details:          r.trainers?.[0] ?? r.teachers?.[0] ?? null,
  }));
}

module.exports = {
  createBatch,
  getBatch,
  listBatches,
  updateBatch,
  deleteBatch,
  generateSessions,
  bulkAssignStudents,
  removeBatchStudent,
  getUnassignedGroupStudents,
  getBatchDetail,
  getSettlementPreview,
  settleBatchCycle,
  markSettlementPaid,
  listSettlements,
  reassignBatchSession,
  reassignAllFutureBatchSessions,
  extendStudentTerm,
  createBatchSession,
  getAvailableProfessionalsForBatch,
};
