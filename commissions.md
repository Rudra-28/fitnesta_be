# Fitnesta — Commission System Documentation

## Overview

The commission system manages earnings for three professional types: **Marketing Executives (ME)**, **Trainers**, and **Teachers**. Each has a distinct earning model driven by configurable rules stored in the `commission_rules` table.

---

## 1. Marketing Executive (ME) — Admission-Based Commissions

MEs earn a **one-time percentage or flat amount** when students enroll through a society/school they registered.

### Percentage-Based (Per Admission)

| Trigger | Rule Key | Default Rate | Condition |
|---------|----------|--------------|-----------|
| Group coaching admission (society) | `me_group_admission_rate` | 5% | Student selects a registered society |
| Individual coaching admission | `me_personal_coaching_admission_rate` | 2% | Student selects a registered society |
| Personal tutor admission | `me_personal_tutor_admission_rate` | 2% | Student selects a registered society |
| School student admission | `me_group_admission_rate` | 5% | Student enrolls in a registered school |

### Flat-Based (One-Time on Entity Registration)

| Trigger | Rule Key | Default Amount | Condition |
|---------|----------|----------------|-----------|
| Society registration (100+ flats) | `me_society_above_100_flats` | ₹1111 | Admin approves society |
| Society registration (50–100 flats) | `me_society_50_to_100_flats` | ₹500 | Admin approves society |
| Society registration (<50 flats) | `me_society_below_50_flats` | ₹300 | Admin approves society |
| School registration | `me_school_registration` | ₹1111 | Admin approves school |

### Threshold & Hold Mechanism

- Group coaching (society) and school commissions start as **`on_hold`** status
- They are released to `pending` only when the entity reaches a **20-student threshold** (`me_group_admission_min_students`)
- Individual coaching and personal tutor commissions go directly to `pending` (no hold)
- ME only earns if the student selected a **registered society/school** that has an ME linked (`me_professional_id`)

### Eligibility

- `me_min_live_activities` = 2 → Platform must have at least 2 globally active activities for ME commissions to be eligible

---

## 2. Trainer — Session-Based (Cycle Settlement)

Trainers earn based on **sessions actually conducted**, calculated per monthly cycle. Commission is NOT created at assignment time — it's created at **settlement time**.

### Three Settlement Tracks

#### A. Individual Coaching (1-on-1 Sports)

| Rule Key | Default | Formula |
|----------|---------|---------|
| `trainer_personal_coaching_rate` | 80% | `(effective_monthly × 80%) ÷ sessions_allocated × sessions_completed` |

- One cycle row per (student × activity × month) in `ic_cycle_settlements`
- Pre-created when bulk sessions are generated
- Pending cycles are live-synced from sessions table on every GET

#### B. Group Coaching — Society

| Rule Key | Default | Formula |
|----------|---------|---------|
| `trainer_group_society_rate` | 50% | `(sum of all students' effective_monthly × 50%) ÷ sessions_allocated × sessions_completed` |

**Flat rate fallback:**

| Rule Key | Default | Condition |
|----------|---------|-----------|
| `trainer_group_society_min_students` | 10 | If batch has fewer than this many students... |
| `trainer_group_society_flat_amount` | ₹300 | ...trainer gets this flat amount per session instead of % |

- Cycle rows stored in `batch_cycle_settlements`
- Grouped by entity (society) → activity → batch → cycles

#### C. Group Coaching — School

| Rule Key | Default | Formula |
|----------|---------|---------|
| `trainer_group_school_rate` | 45% | `(sum of all students' effective_monthly × 45%) ÷ sessions_allocated × sessions_completed` |

- Same structure as society batches but no flat-rate fallback
- Cycle rows stored in `batch_cycle_settlements`

### Settlement Cycle Lifecycle

```
Pre-created (pending) → Live-synced on GET → Settled (by admin/trainer) → Paid (by admin)
```

1. **Pre-created**: Cycle rows are created when sessions are generated (one row per month)
2. **Live-synced**: Every GET request recounts completed/absent/upcoming sessions from DB
3. **Settled**: Admin or trainer confirms settlement → commission record created → wallet credited
4. **Paid**: Admin marks the commission as paid → actual payout

### Mid-Cycle Reassignment

When a trainer is reassigned mid-month:
- The cycle is **split** at the reassignment date
- Old trainer keeps credit for sessions they already completed
- New trainer gets a partial cycle from reassignment date → cycle end
- Both share the **same `sessions_allocated` denominator** (ensures fair per-session rate)

---

## 3. Teacher — Session-Based (PT Cycle Settlement)

Identical pattern to trainer individual coaching, but for personal tutoring.

| Rule Key | Default | Formula |
|----------|---------|---------|
| `teacher_personal_tutor_rate` | 80% | `(effective_monthly × 80%) ÷ sessions_allocated × sessions_completed` |

- One cycle row per (student × activity × month) in `pt_cycle_settlements`
- A student can have multiple activities (subjects) in `teacher_for` — each gets its own cycle track
- Same live-sync, settlement, and mid-cycle reassignment logic as trainers

---

## 4. Travelling Allowance (Trainer Only)

A separate daily flat payment for trainers conducting group coaching batches.

| Batches Conducted/Day | Rule Key | Default Amount |
|-----------------------|----------|----------------|
| Exactly 1 batch | `ta_1_batch_amount` | ₹50 |
| 2 or more batches | `ta_2_plus_batches_amount` | ₹100 (flat cap) |

- Recorded automatically when a batch session is logged
- One record per trainer per day (unique constraint: `trainer_professional_id + allowance_date`)
- Admin marks as `paid` separately from commissions
- Stored in `travelling_allowances` table

---

## Commission Statuses

```
ME (group/school):     on_hold → pending → paid
ME (individual/tutor): pending → paid
Trainer/Teacher:       pending → settled → paid
Travelling Allowance:  pending → paid
```

| Status | Meaning |
|--------|---------|
| `on_hold` | ME commission waiting for student threshold to be met |
| `pending` | Commission created, awaiting admin action |
| `settled` | Cycle confirmed by trainer/teacher, commission record created |
| `approved` | Admin approved (ME flow) |
| `paid` | Admin marked as paid, payout completed |

---

## Effective Monthly Fee Resolution

The base amount for all commission calculations is the **effective monthly fee** — the per-month portion of what the student paid.

### Resolution Logic

| Scenario | Calculation |
|----------|-------------|
| `term_months = 1` | Use `total_fee` directly (it IS the monthly fee) |
| `term_months = 3 or 6` | Use `effective_monthly` from `fee_structures` table |
| `school_student` | `total_fee ÷ 9` (school term is 9 months) |
| Fallback | Latest captured payment amount ÷ `term_months` |

### Lookup Order (IC/PT cycles)

1. Exact match in `fee_structures`: activity + coaching_type + term_months → use `effective_monthly` or `total_fee ÷ term_months`
2. Any row for this activity + coaching_type → divide `total_fee` by student's actual term_months
3. Latest successful payment for this user ÷ term_months

---

## Wallet System

Each professional has **one wallet** (`wallets` table, unique on `professional_id`).

### When Wallet is Credited

| Professional | Credit Trigger |
|--------------|----------------|
| Trainer/Teacher | When a cycle is **settled** (not when marked paid) |
| ME | Wallet is NOT auto-credited — balance is informational from commission sums |

### Wallet Buckets (Dashboard View)

| Bucket | Includes |
|--------|----------|
| **Pending** | `on_hold` + `pending` commissions + pending travelling allowances |
| **Approved** | `approved` commissions (ME only) |
| **Paid** | `paid` commissions + paid travelling allowances |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `commission_rules` | 16 configurable rules (rates, thresholds, flat amounts) |
| `commissions` | All commission records for all professional types |
| `batch_cycle_settlements` | Monthly cycles for group coaching (society + school) |
| `ic_cycle_settlements` | Monthly cycles for individual coaching (trainer) |
| `pt_cycle_settlements` | Monthly cycles for personal tutor (teacher) |
| `travelling_allowances` | Daily trainer travel allowance records |
| `wallets` | Professional wallet balances |
| `trainer_assignments` | Links professionals to their coaching assignments |

---

## All 16 Commission Rules

| # | Rule Key | Professional | Type | Default | Description |
|---|----------|-------------|------|---------|-------------|
| 1 | `trainer_personal_coaching_rate` | Trainer | % | 80 | % of fee for individual coaching |
| 2 | `trainer_group_society_rate` | Trainer | % | 50 | % of fee for group coaching in society (10+ students) |
| 3 | `trainer_group_society_min_students` | Trainer | flat | 10 | Student threshold — below this, flat rate applies |
| 4 | `trainer_group_society_flat_amount` | Trainer | flat | 300 | ₹ per session when below min students |
| 5 | `trainer_group_school_rate` | Trainer | % | 45 | % of fee for group coaching in school |
| 6 | `teacher_personal_tutor_rate` | Teacher | % | 80 | % of fee for personal tutor service |
| 7 | `me_group_admission_rate` | ME | % | 5 | % per group coaching admission |
| 8 | `me_personal_coaching_admission_rate` | ME | % | 2 | % per individual coaching admission |
| 9 | `me_personal_tutor_admission_rate` | ME | % | 2 | % per personal tutor admission |
| 10 | `me_society_above_100_flats` | ME | flat | 1111 | One-time ₹ for society with 100+ flats |
| 11 | `me_society_50_to_100_flats` | ME | flat | 500 | One-time ₹ for society with 50–100 flats |
| 12 | `me_society_below_50_flats` | ME | flat | 300 | One-time ₹ for society with <50 flats |
| 13 | `me_school_registration` | ME | flat | 1111 | One-time ₹ for registering a school |
| 14 | `me_min_live_activities` | ME | flat | 2 | Min active activities for ME eligibility |
| 15 | `ta_1_batch_amount` | Trainer | flat | 50 | Daily TA for 1 batch |
| 16 | `ta_2_plus_batches_amount` | Trainer | flat | 100 | Daily TA for 2+ batches |

---

## API Endpoints (Admin)

```
GET    /api/v1/admin/commission-rules                    # List all 16 rules
PUT    /api/v1/admin/commission-rules/:ruleKey           # Update rule value

GET    /api/v1/admin/commissions                         # List commissions (filters: professional_type, status, professional_id)
PATCH  /api/v1/admin/commissions/:id/mark-paid           # Mark commission as paid

GET    /api/v1/admin/travelling-allowances               # List TAs (filters: trainer_professional_id, status)
PATCH  /api/v1/admin/travelling-allowances/:id/mark-paid # Mark TA as paid
```

## API Endpoints (Professional Dashboard)

```
GET    /api/v1/trainer-dashboard/:id/society-settlement  # Trainer group coaching (society) cycles
GET    /api/v1/trainer-dashboard/:id/school-settlement   # Trainer group coaching (school) cycles
GET    /api/v1/trainer-dashboard/:id/ic-settlement       # Trainer individual coaching cycles
POST   /api/v1/trainer-dashboard/:id/ic-settlement/:cycleId/settle  # Settle an IC cycle

GET    /api/v1/teacher-dashboard/:id/pt-settlement       # Teacher personal tutor cycles
POST   /api/v1/teacher-dashboard/:id/pt-settlement/:cycleId/settle  # Settle a PT cycle
```

---

## Trigger Points Summary

| Event | What Happens |
|-------|--------------|
| Student pays (Razorpay captured) | ME admission commission calculated |
| Admin approves society/school | ME onboarding flat commission created |
| Admin assigns trainer | `trainer_assignments` record created (no commission yet) |
| Admin assigns teacher | `trainer_assignments` record created (no commission yet) |
| Bulk sessions generated | Cycle rows pre-created in settlement tables |
| Session marked completed | Cycle amounts recalculated on next GET |
| Trainer/teacher settles cycle | Commission record created + wallet credited |
| Admin marks commission paid | Status → paid (actual payout) |
| Trainer conducts batch | Travelling allowance upserted for that day |
