const prisma = require("../../../config/prisma");
const repo = require("./batchrepo");

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
}) {
  // Validate: group_coaching requires society_id, school_student requires school_id
  if (batch_type === "group_coaching" && !society_id) {
    throw Object.assign(new Error("society_id is required for group_coaching batch"), { code: "SOCIETY_OR_SCHOOL_REQUIRED" });
  }
  if (batch_type === "school_student" && !school_id) {
    throw Object.assign(new Error("school_id is required for school_student batch"), { code: "SOCIETY_OR_SCHOOL_REQUIRED" });
  }

  const startDt = new Date(start_date);
  const endDt = new Date(end_date);
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

  return repo.createBatch({
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
  });
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

  const batchUpdateData = { updated_at: new Date() };
  if (updates.professional_id) batchUpdateData.professional_id = Number(updates.professional_id);
  if (updates.professional_type) batchUpdateData.professional_type = updates.professional_type;
  if (updates.start_time) batchUpdateData.start_time = updates.start_time;
  if (updates.end_time) batchUpdateData.end_time = updates.end_time;
  if (updates.days_of_week) batchUpdateData.days_of_week = updates.days_of_week;
  if (updates.end_date) batchUpdateData.end_date = new Date(updates.end_date);
  if (updates.batch_name !== undefined) batchUpdateData.batch_name = updates.batch_name;

  await repo.updateBatch(batch.id, batchUpdateData);

  if (Object.keys(sessionUpdates).length > 0) {
    await repo.updateFutureSessionsProfessionalAndTime(batch.id, { ...sessionUpdates, updated_at: new Date() });
  }

  if (dayNamesToCancel.length > 0) {
    await repo.cancelSessionsOnRemovedDays(batch.id, dayNamesToCancel);
  }

  return repo.getBatchById(batch.id);
}

async function deleteBatch(batchId) {
  const batch = await repo.getBatchById(Number(batchId));
  if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });

  await repo.cancelFutureBatchSessions(batch.id);
  await repo.softDeleteBatch(batch.id);
  return { success: true };
}

async function generateSessions(batchId, startDate, endDate) {
  const batch = await repo.getBatchById(Number(batchId));
  if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });
  if (!batch.is_active) throw Object.assign(new Error("Batch is inactive"), { code: "BATCH_INACTIVE" });

  const startDt = new Date(startDate);
  const endDt = new Date(endDate);
  if (endDt < startDt) {
    throw Object.assign(new Error("end_date must be after start_date"), { code: "DATE_RANGE_INVALID" });
  }

  const daysOfWeek = Array.isArray(batch.days_of_week) ? batch.days_of_week : JSON.parse(batch.days_of_week);
  const existingDates = await repo.getExistingSessionDatesForBatch(batch.id, startDt, endDt);
  const sessionDates = computeSessionDates(daysOfWeek, startDt, endDt, existingDates);

  if (sessionDates.length === 0) {
    return { generated: 0, message: "No new session dates to generate in this range." };
  }

  // Get current batch students
  const batchStudents = await repo.getBatchStudents(batch.id);
  const studentIds = batchStudents.map((bs) => bs.student_id);

  let generatedCount = 0;
  for (const date of sessionDates) {
    await repo.createSessionWithParticipants(
      {
        session_type: batch.batch_type,
        batch_id: batch.id,
        student_id: null,
        professional_id: batch.professional_id,
        scheduled_date: date,
        start_time: batch.start_time,
        end_time: batch.end_time,
        status: "scheduled",
      },
      studentIds
    );
    generatedCount++;
  }

  return { generated: generatedCount };
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

// ── Utility ──────────────────────────────────────────────────────────────────

function parseTimeString(timeStr) {
  if (timeStr instanceof Date) return timeStr;
  // Accepts "HH:MM" or "HH:MM:SS"
  const [h, m, s = "0"] = String(timeStr).split(":");
  const d = new Date(1970, 0, 1, Number(h), Number(m), Number(s));
  return d;
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
};
