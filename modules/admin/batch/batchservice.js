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

  // Set initial cycle window starting from start_date
  const cycleEndDt = new Date(startDt);
  cycleEndDt.setDate(cycleEndDt.getDate() + 30);

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
    cycle_start_date: startDt,
    cycle_end_date:   cycleEndDt,
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

/**
 * Generate sessions for the next 30-day cycle of a batch.
 * The cycle window is determined as follows:
 *   - If the batch has no cycle_start_date yet (first generation), cycle starts today.
 *   - If a cycle is already active (cycle_end_date >= today), sessions are added to it.
 *   - After a settlement the batch's cycle_start_date is already advanced; this handles new cycle too.
 * Sessions are created for every matching day-of-week within [cycleStart, cycleEnd].
 * Existing sessions on those dates are skipped (deduped).
 * The batch's cycle_start_date and cycle_end_date are updated after generation.
 */
async function generateSessions(batchId) {
  const batch = await repo.getBatchById(Number(batchId));
  if (!batch) throw Object.assign(new Error("Batch not found"), { code: "BATCH_NOT_FOUND" });
  if (!batch.is_active) throw Object.assign(new Error("Batch is inactive"), { code: "BATCH_INACTIVE" });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Determine cycle window
  let cycleStart;
  if (batch.cycle_start_date) {
    cycleStart = new Date(batch.cycle_start_date);
    cycleStart.setHours(0, 0, 0, 0);
  } else {
    cycleStart = new Date(today);
  }

  const cycleEnd = new Date(cycleStart);
  cycleEnd.setDate(cycleEnd.getDate() + 30);

  const daysOfWeek = Array.isArray(batch.days_of_week) ? batch.days_of_week : JSON.parse(batch.days_of_week);
  const existingDates = await repo.getExistingSessionDatesForBatch(batch.id, cycleStart, cycleEnd);
  const sessionDates = computeSessionDates(daysOfWeek, cycleStart, cycleEnd, existingDates);

  if (sessionDates.length === 0) {
    return { generated: 0, message: "No new session dates to generate in this cycle." };
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

  // Update the cycle window on the batch
  await prisma.batches.update({
    where: { id: batch.id },
    data: {
      cycle_start_date: cycleStart,
      cycle_end_date:   cycleEnd,
      updated_at:       new Date(),
    },
  });

  return { generated: generatedCount, cycle_start: cycleStart, cycle_end: cycleEnd };
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

// ── Unassigned students ──────────────────────────────────────────────────────

/**
 * Returns group_coaching students for a given society+activity who have no batch assignment.
 * Admin uses this to manually fill a new batch.
 */
async function getUnassignedGroupStudents(societyId, activityId) {
  // individual_participants with matching society_id, no batch_id, and student_type = group_coaching
  const rows = await prisma.individual_participants.findMany({
    where: {
      society_id: Number(societyId),
      batch_id:   null,
      students:   { student_type: "group_coaching" },
    },
    include: {
      students: {
        select: {
          id:   true,
          users: { select: { full_name: true, mobile: true } },
        },
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

  // Past sessions (completed or cancelled) with participant attendance
  const pastSessions = await prisma.sessions.findMany({
    where: {
      batch_id:       batch.id,
      scheduled_date: { lt: today },
    },
    include: {
      session_participants: {
        select: {
          attended:   true,
          student_id: true,
          students:   { select: { users: { select: { full_name: true } } } },
        },
      },
    },
    orderBy: { scheduled_date: "desc" },
    take: 50,
  });

  // Upcoming sessions
  const upcomingSessions = await prisma.sessions.findMany({
    where: {
      batch_id:       batch.id,
      scheduled_date: { gte: today },
      status:         { in: ["scheduled", "ongoing"] },
    },
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

  // Sessions in this cycle
  const sessions = await prisma.sessions.findMany({
    where: {
      batch_id:       batch.id,
      scheduled_date: { gte: cycleStart, lte: cycleEnd },
      status:         { not: "cancelled" },
    },
    select: { id: true, status: true },
  });

  const sessionsAllocated = sessions.length;
  const completedIds      = sessions.filter(s => s.status === "completed").map(s => s.id);
  const sessionsAttended  = completedIds.length; // trainer attended = session completed via punch-out

  // Sum effective_monthly_fees of all current batch students via their individual_participant records
  const batchStudentIds = batch.batch_students.map(bs => bs.student_id);

  let baseAmount = 0;
  if (batchStudentIds.length > 0) {
    // Get activity + society for each student to look up fee
    const participants = await prisma.individual_participants.findMany({
      where: { student_id: { in: batchStudentIds }, batch_id: batch.id },
      select: { student_id: true },
    });

    if (participants.length > 0) {
      // Look up fee structure for this batch's activity and society category
      const society = batch.societies;
      const feeRecord = await prisma.fee_structures.findFirst({
        where: {
          activity_id:    batch.activity_id,
          coaching_type:  "group_coaching",
          society_category: society?.society_category ?? undefined,
        },
        select: { effective_monthly: true },
      });

      const effectiveMonthly = feeRecord?.effective_monthly ? parseFloat(feeRecord.effective_monthly) : 0;
      baseAmount = effectiveMonthly * participants.length;
    }
  }

  // Get trainer commission rate from commission_rules
  const commissionRule = await prisma.commission_rules.findFirst({
    where: { rule_key: "trainer_group_society_rate" },
    select: { value: true },
  });
  const commissionRate = commissionRule ? parseFloat(commissionRule.value) : 0;

  // Prorate: base * rate * (attended / allocated)
  const proration       = sessionsAllocated > 0 ? sessionsAttended / sessionsAllocated : 0;
  const commissionAmount = parseFloat((baseAmount * (commissionRate / 100) * proration).toFixed(2));

  const today        = new Date();
  today.setHours(0, 0, 0, 0);
  const cycleComplete = today > cycleEnd;

  return {
    cycle_start:        cycleStart,
    cycle_end:          cycleEnd,
    cycle_complete:     cycleComplete,
    sessions_allocated: sessionsAllocated,
    sessions_attended:  sessionsAttended,
    base_amount:        parseFloat(baseAmount.toFixed(2)),
    commission_rate:    commissionRate,
    commission_amount:  commissionAmount,
    settlement_locked:  !cycleComplete,
  };
}

/**
 * Settle the current cycle for a batch.
 * Locked until cycle_end_date has passed.
 * Creates a batch_cycle_settlements record, credits the trainer's wallet,
 * then auto-starts the next 30-day cycle.
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

  // Write settlement record + credit wallet in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.batch_cycle_settlements.create({
      data: {
        batch_id:          batch.id,
        cycle_start:       new Date(batch.cycle_start_date),
        cycle_end:         new Date(batch.cycle_end_date),
        sessions_allocated: preview.sessions_allocated,
        sessions_attended:  preview.sessions_attended,
        base_amount:        preview.base_amount,
        commission_rate:    preview.commission_rate,
        commission_amount:  preview.commission_amount,
        status:             "settled",
        settled_at:         new Date(),
      },
    });

    if (preview.commission_amount > 0) {
      // Credit trainer wallet
      await tx.wallets.upsert({
        where:  { professional_id: batch.professional_id },
        create: { professional_id: batch.professional_id, balance: preview.commission_amount },
        update: { balance: { increment: preview.commission_amount }, updated_at: new Date() },
      });
    }

    // Advance cycle: new cycle starts the day after current cycle_end
    const newCycleStart = new Date(batch.cycle_end_date);
    newCycleStart.setDate(newCycleStart.getDate() + 1);
    const newCycleEnd = new Date(newCycleStart);
    newCycleEnd.setDate(newCycleEnd.getDate() + 30);

    await tx.batches.update({
      where: { id: batch.id },
      data: {
        cycle_start_date: newCycleStart,
        cycle_end_date:   newCycleEnd,
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
  getUnassignedGroupStudents,
  getBatchDetail,
  getSettlementPreview,
  settleBatchCycle,
  markSettlementPaid,
  listSettlements,
};
