# Fitnesta Admin Panel — Claude Context File

Copy this file into your React project root as `CLAUDE.md` before starting development.

---

## What Is This Project?

This is the **web-based admin panel** for the Fitnesta app — a sports/fitness platform in India. The backend is a Node.js + Express + Prisma + MySQL API. The Flutter mobile app handles student/professional registrations, and this admin panel is where an admin reviews, approves/rejects those registrations, assigns teachers/trainers to students, and monitors the platform.

**The backend repo is at `c:\src\fitnesta`.**
This admin panel is a separate React frontend that calls the Fitnesta backend REST API.

---

## Backend Base URL

```
http://localhost:3000/api/v1
```

All requests to the admin section are prefixed: `http://localhost:3000/api/v1/admin/...`

Every admin request requires a JWT in the `Authorization: Bearer <token>` header.

---

## All Admin API Endpoints

### Pending Registrations
```
GET  /api/v1/admin/pending                          # all pending (all types)
GET  /api/v1/admin/pending?type=trainer             # filter by service_type
GET  /api/v1/admin/pending?type=teacher
GET  /api/v1/admin/pending?type=vendor
GET  /api/v1/admin/pending?type=marketing_executive
GET  /api/v1/admin/pending?type=society_request
GET  /api/v1/admin/pending?type=society_enrollment
GET  /api/v1/admin/pending/:id                      # single pending record

POST /api/v1/admin/approve/:id                      # body: { note?: string }
POST /api/v1/admin/reject/:id                       # body: { note?: string }
```

**Response shape for GET /pending:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 5,
      "tempUuid": "abc-123",
      "serviceType": "trainer",
      "submittedAt": "2026-03-28T10:00:00Z",
      "formData": { /* full registration form fields as JSON */ }
    }
  ]
}
```

**Error codes for approve/reject:**
- `404` → `PENDING_NOT_FOUND`
- `409` → `ALREADY_REVIEWED` (already approved or rejected)
- `500` → server error

---

### Student Assignment
```
GET  /api/v1/admin/students/unassigned?service=personal_tutor
GET  /api/v1/admin/students/unassigned?service=individual_coaching

GET  /api/v1/admin/professionals/available?type=teacher
GET  /api/v1/admin/professionals/available?type=trainer

POST /api/v1/admin/assign/teacher
     body: { personal_tutor_id: number, teacher_professional_id: number }

POST /api/v1/admin/assign/trainer
     body: { individual_participant_id: number, trainer_professional_id: number }
```

**Response for GET /students/unassigned?service=personal_tutor:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "personal_tutor_id": 10,
      "student_id": 4,
      "full_name": "Arjun Sharma",
      "mobile": "9876543210",
      "standard": "8th",
      "batch": "Morning",
      "teacher_for": "Mathematics",
      "dob": "2012-05-10"
    }
  ]
}
```

**Response for GET /students/unassigned?service=individual_coaching:**
```json
{
  "data": [
    {
      "individual_participant_id": 7,
      "student_id": 3,
      "full_name": "Riya Patel",
      "mobile": "9123456789",
      "activity": "Cricket",
      "flat_no": "B-204",
      "society": "Green Valley CHS",
      "dob": "2010-08-15"
    }
  ]
}
```

**Response for GET /professionals/available?type=teacher:**
```json
{
  "data": [
    {
      "professional_id": 2,
      "full_name": "Sunita Verma",
      "mobile": "9988776655",
      "subject": "Mathematics",
      "experience": "5 years teaching school students"
    }
  ]
}
```

**Response for GET /professionals/available?type=trainer:**
```json
{
  "data": [
    {
      "professional_id": 3,
      "full_name": "Rahul Nair",
      "mobile": "9876541230",
      "category": "Sports",
      "specified_game": ["Cricket", "Football"],
      "experience": "3 years professional coaching"
    }
  ]
}
```

---

## Database Models (Prisma Schema Summary)

### Core entities you'll interact with:

**`pending_registrations`** — all registrations waiting for approval
- `id`, `temp_uuid`, `form_data` (JSON), `service_type`, `status` (pending/approved/rejected)
- `reviewed_by`, `review_note`, `reviewed_at`, `created_at`

**service_type values:** `trainer` | `teacher` | `vendor` | `marketing_executive` | `society_request` | `society_enrollment`

---

**`users`** — all users (students, professionals, admins)
- `id`, `uuid`, `role`, `subrole`, `full_name`, `mobile`, `email`, `address`, `photo`
- `approval_status` (pending/approved/rejected), `is_verified`, `created_at`

---

**`professionals`** — trainers, teachers, MEs, vendors
- `id`, `user_id`, `profession_type` (trainer/teacher/marketing_executive/vendor)
- `referral_code` (unique, used by MEs), `pan_card`, `adhar_card`
- `relative_name`, `relative_contact`, `own_two_wheeler`, `communication_languages`, `place`

---

**`trainers`** — extends professionals for trainers
- `professional_id`, `player_level`, `category`, `specified_game` (JSON), `specified_skills` (JSON)
- `experience_details`, `qualification_docs`, `documents`

**`teachers`** — extends professionals for teachers
- `professional_id`, `subject`, `experience_details`, `ded_doc`, `bed_doc`, `other_doc`

**`marketing_executives`** — extends professionals for MEs
- `professional_id`, `dob`, `education_qualification`, `previous_experience`, `activity_agreement_pdf`

**`vendors`** — extends professionals for vendors
- `professional_id`, `store_name`, `store_address`, `store_location`, `gst_certificate`

---

**`students`** — all students
- `id`, `user_id`, `student_type` (group_coaching/individual_coaching/personal_tutor/school_student)

**`personal_tutors`** — personal tutor service students
- `id`, `student_id`, `dob`, `standard`, `batch`, `teacher_for`, `teacher_professional_id` (null = unassigned)

**`individual_participants`** — individual coaching students
- `id`, `student_id`, `participant_name`, `mobile`, `flat_no`, `dob`, `age`
- `society_id`, `society_name`, `activity`, `kits`, `trainer_professional_id` (null = unassigned)

**`school_students`** — school program students
- `id`, `student_id`, `school_id`, `student_name`, `standard`, `activities`, `kit_type`

---

**`societies`** — housing societies
- `id`, `society_unique_id`, `society_name`, `society_category` (A+/A/B)
- `address`, `pin_code`, `total_participants`, `no_of_flats`
- `authority_person_name`, `contact_number`, `coordinator_name`
- `me_professional_id` (ME who registered it), `approval_status` (pending/approved/rejected)
- `playground_available`, `agreement_signed_by_authority`

**`schools`** — schools
- `id`, `school_name`, `address`, `pin_code`, `state`, `language_medium`
- `principal_name`, `principal_contact`, `activity_coordinator`
- `me_professional_id`, `approval_status` (pending/approved/rejected)

---

**`payments`** — Razorpay payment records
- `id`, `temp_uuid`, `razorpay_order_id`, `razorpay_payment_id`
- `service_type`, `amount`, `currency` (default INR), `term_months` (1/3/6/9)
- `status` (captured/refunded/failed), `student_user_id`, `captured_at`

**`commissions`** — commissions owed to professionals
- `id`, `professional_id`, `professional_type` (marketing_executive/trainer/teacher)
- `source_type` (group_coaching_society/group_coaching_school/group_coaching_other/individual_coaching/personal_tutor/event_ticket/school_registration)
- `base_amount`, `commission_rate`, `commission_amount`, `status` (pending/paid), `created_at`

**`wallets`** — professional wallet balances
- `professional_id` (unique), `balance`, `updated_at`

**`travelling_allowances`** — trainer daily travel allowances
- `trainer_professional_id`, `allowance_date`, `batches_count`, `amount`
- `status` (pending/paid), `created_at`, `updated_at`

**`activities`** — sports/coaching activities
- `id`, `name`, `notes`, `is_active`

**`fee_structures`** — pricing per activity/type/standard
- `activity_id`, `coaching_type` (group_coaching/individual_coaching/personal_tutor/school_student)
- `society_category` (A+/A/B, nullable), `standard` (nullable, for personal_tutor)
- `term_months`, `total_fee`, `effective_monthly`

---

## Tech Stack for This Admin Panel

- **React 18** + **Vite**
- **TailwindCSS** + **shadcn/ui** (component library)
- **TanStack Query (React Query v5)** for data fetching, caching, mutations
- **React Router v6** for routing
- **Axios** for HTTP (with interceptor to attach JWT)
- **React Hook Form** for forms
- **Zustand** for auth state (store JWT token)

---

## Project Folder Structure

```
src/
├── api/
│   ├── axios.js          # axios instance with base URL + auth interceptor
│   └── admin.js          # all admin API functions
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── Layout.jsx        # sidebar + topbar wrapper
│   ├── Sidebar.jsx
│   └── StatusBadge.jsx   # reusable pending/approved/rejected badge
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── PendingApprovals.jsx   ← BUILD THIS FIRST
│   ├── Assignments.jsx        ← BUILD THIS SECOND
│   ├── Professionals.jsx
│   ├── Students.jsx
│   ├── Societies.jsx
│   ├── Schools.jsx
│   ├── Payments.jsx
│   ├── Commissions.jsx
│   ├── TravellingAllowances.jsx
│   └── ActivitiesFees.jsx
├── store/
│   └── authStore.js      # zustand: token, admin user
├── hooks/
│   └── useAdmin.js       # react-query hooks for admin API
└── App.jsx
```

---

## Sidebar Navigation

```
Fitnesta Admin
├── Dashboard
├── Pending Approvals   (show count badge of pending items)
├── Assignments
├── Professionals
│   ├── Trainers
│   ├── Teachers
│   ├── Marketing Executives
│   └── Vendors
├── Students
│   ├── Individual Coaching
│   ├── Personal Tutor
│   ├── Group Coaching
│   └── School Students
├── Societies
├── Schools
├── Payments
├── Commissions
├── Travelling Allowances
└── Activities & Fees
```

---

## Build Order (Priority)

### Phase 1 — Eliminates all Postman usage
1. **Login page** — POST `/api/v1/auth/login`, store JWT in zustand + localStorage
2. **Pending Approvals page** — the most critical page

### Phase 2 — Second biggest pain point
3. **Assignments page** — assign teachers to personal tutor students, trainers to individual coaching students

### Phase 3 — Data visibility
4. **Dashboard** — stat cards + recent activity

### Phase 4 — Reference/lookup
5. **Professionals pages** (Trainers, Teachers, MEs, Vendors)
6. **Students pages** (all 4 types)

### Phase 5 — Financial
7. **Payments**
8. **Commissions** (with mark-as-paid)
9. **Travelling Allowances** (with mark-as-paid)

### Phase 6 — Management
10. **Societies**, **Schools**, **Activities & Fees**

---

## Page Specs

### Pending Approvals Page (Phase 1 — most important)

**Filter tabs:** All | Trainer | Teacher | Vendor | Marketing Executive | Society Request | Society Enrollment

**Table columns:** ID | Type (colored badge) | Name (from formData) | Mobile (from formData) | Submitted | Actions

**Per row actions:**
- "View" button → opens a right-side drawer showing all `formData` fields as clean key-value pairs (NOT raw JSON)
- "Approve" → shows a small modal asking for optional note → calls `POST /admin/approve/:id`
- "Reject" → same modal → calls `POST /admin/reject/:id`
- After action: row disappears with toast notification "Approved successfully" / "Rejected"

**formData key fields to display per type:**

| service_type | Key fields in formData to show prominently |
|---|---|
| trainer | full_name, mobile, dob, category, specified_game, place |
| teacher | full_name, mobile, dob, subject, experience_details |
| vendor | full_name, mobile, store_name, store_address, store_location |
| marketing_executive | full_name, mobile, dob, education_qualification |
| society_request | full_name, mobile, society_name, society_category, address, total_participants |
| society_enrollment | full_name, mobile, society_name, referralCode |

---

### Assignments Page (Phase 2)

**Two tabs: "Assign Teacher" | "Assign Trainer"**

**Assign Teacher tab:**
- Left panel: unassigned personal tutor students from `GET /admin/students/unassigned?service=personal_tutor`
  - Columns: Name, Mobile, Standard, Batch, Teacher For, DOB
  - Clicking a row selects/highlights it
- Right panel: available teachers from `GET /admin/professionals/available?type=teacher`
  - Columns: Name, Mobile, Subject, Experience
  - Clicking a row selects/highlights it
- "Assign" button (disabled until both selected) → `POST /admin/assign/teacher`
- On success: both lists refresh, toast "Teacher assigned successfully"

**Assign Trainer tab:** Same layout for individual coaching students + trainers.

---

### Dashboard Page (Phase 3)

**Top stat cards:**
- Pending Approvals (count, links to Pending page)
- Total Professionals (count)
- Total Students (count)
- Total Revenue (sum of payments.amount in INR)

**Below:**
- "Needs Action" — latest 5 pending registrations with inline Approve/Reject
- Recent Payments — last 10 payments with amount, service type, date

---

## Axios Setup

```js
// src/api/axios.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
```

---

## Status Badge Colors

| Status | Color |
|--------|-------|
| pending | Yellow / amber |
| approved | Green |
| rejected | Red |
| captured (payment) | Green |
| refunded | Blue |
| failed | Red |
| paid (commission/TA) | Green |

---

## Service Type Badge Colors

| Type | Color |
|------|-------|
| trainer | Blue |
| teacher | Purple |
| vendor | Orange |
| marketing_executive | Teal |
| society_request | Pink |
| society_enrollment | Indigo |

---

## Key Business Logic Notes

1. **Approving a pending registration** creates actual DB records (user, professional/student/society). It is irreversible. Always show a confirmation before approving.

2. **Assigning a teacher/trainer** only works if the professional's `users.approval_status = 'approved'`. The available professionals endpoint already filters this — only approved professionals appear.

3. **Unassigned students** are those where `teacher_professional_id = null` (personal tutor) or `trainer_professional_id = null` (individual coaching). These show up orange in lists to signal they need action.

4. **Society category** (A+/A/B) affects pricing — A+ societies pay more per term than B societies. This is in `fee_structures`.

5. **ME referral code** — marketing executives have a unique `referral_code`. When a society registers via `society_enrollment`, they submit an ME's referral code. If the referral code is invalid at approval time, the approval fails.

6. **Payments** are recorded before admin approval. A student pays first (Razorpay), then admin approves the registration. Payment records are permanent regardless of approval status.

7. **Commissions** are for three professional types: `marketing_executive`, `trainer`, `teacher`. They are created when a payment is captured and need to be manually marked as `paid` by admin.

8. **Travelling allowances** are daily records for trainers. Admin marks them paid.

---

## Auth Notes

### Login Endpoint
```
POST /api/v1/auth/login
Body: { "mobile": "9876543210", "role": "admin" }
```

**There is NO password.** Login is mobile number + role only. The backend checks:
1. Mobile exists in the `users` table
2. `approval_status` is `approved`
3. `role` matches what was sent
4. User exists in `admins` table

**Request body:**
```json
{ "mobile": "9876543210", "role": "admin" }
```

**Success response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJ...",
    "user": {
      "id": 1,
      "name": "Admin Name",
      "mobile": "9876543210",
      "role": "admin",
      "subrole": null
    }
  }
}
```

**Error responses:**
| error_code | HTTP | Meaning |
|---|---|---|
| `USER_NOT_FOUND` | 404 | Mobile not in DB |
| `ROLE_MISMATCH` | 403 | Mobile exists but role is wrong |
| `APPROVAL_PENDING` | 403 | Admin not yet approved |
| `REGISTRATION_REJECTED` | 403 | Admin rejected |

**Login page fields:**
- Mobile number input (strip `+91` prefix if entered)
- Role is hardcoded as `"admin"` — do not show a role dropdown on the admin panel login page

**Token storage:**
- Store JWT as `adminToken` in `localStorage`
- Also store `user` object in Zustand
- JWT expires in 7 days

**Axios interceptor behavior:**
- Attach `Authorization: Bearer <token>` to every request
- On 401 response → clear `adminToken` from localStorage → redirect to `/login`

---

## Do Not Build Yet (Out of Scope for Now)

- Vendor product management (vendor_products table)
- Parent consent forms
- Trainer batch scheduling (trainer_batches)
- Other areas module
- Any write operations beyond approve/reject/assign

---

## Commission Rules & Commissions (Phase 5)

### Overview

The platform has three types of earnings that admin manages:
1. **Commissions** — amounts earned by trainers, teachers, and marketing executives on each payment/admission
2. **Commission Rules** — the configurable rates/flat amounts that drive commission calculation (admin can edit these)
3. **Travelling Allowances** — daily ₹ allowances for trainers based on group batches conducted

All three are in `status: pending` when created and need to be manually marked as `paid` by admin.

---

### Commission Rules API

```
GET /api/v1/admin/commission-rules
PUT /api/v1/admin/commission-rules/:ruleKey        body: { value: 80 }
```

**GET response shape:**
```json
{
  "success": true,
  "count": 16,
  "data": [
    {
      "id": 1,
      "rule_key": "trainer_personal_coaching_rate",
      "professional_type": "trainer",
      "description": "Trainer earns this % of the fee for Personal Game Coaching (individual coaching)",
      "rule_type": "percentage",
      "value": "80.00",
      "updated_at": "2026-03-31T10:00:00Z"
    }
  ]
}
```

**PUT body:**
```json
{ "value": 75 }
```

**PUT error codes:**
- `404` → `RULE_NOT_FOUND`

---

### All Rule Keys (for the edit form)

These are the 16 keys in `commission_rules`. The admin panel should list them all and allow editing `value` only.

| rule_key | professional_type | rule_type | Default value | Meaning |
|---|---|---|---|---|
| `trainer_personal_coaching_rate` | trainer | percentage | 80 | % of fee for individual (personal game) coaching |
| `trainer_group_society_rate` | trainer | percentage | 50 | % of fee for group coaching in a society (10+ students) |
| `trainer_group_society_min_students` | trainer | flat | 10 | Student threshold — below this, flat rate applies instead of % |
| `trainer_group_society_flat_amount` | trainer | flat | 300 | Flat ₹ per session when society has fewer than min students |
| `trainer_group_school_rate` | trainer | percentage | 45 | % of fee for group coaching in a school |
| `teacher_personal_tutor_rate` | teacher | percentage | 80 | % of fee for personal tutor service |
| `me_group_admission_rate` | marketing_executive | percentage | 5 | % per group coaching admission |
| `me_personal_coaching_admission_rate` | marketing_executive | percentage | 2 | % per individual coaching admission (society selected) |
| `me_personal_tutor_admission_rate` | marketing_executive | percentage | 2 | % per personal tutor admission (society selected) |
| `me_society_above_100_flats` | marketing_executive | flat | 1111 | One-time ₹ for registering a society with 100+ flats |
| `me_society_50_to_100_flats` | marketing_executive | flat | 500 | One-time ₹ for registering a society with 50–100 flats |
| `me_society_below_50_flats` | marketing_executive | flat | 300 | One-time ₹ for registering a society with < 50 flats |
| `me_school_registration` | marketing_executive | flat | 1111 | One-time ₹ for registering a school |
| `me_min_live_activities` | marketing_executive | flat | 2 | Min globally active activities for ME to be eligible |
| `ta_1_batch_amount` | trainer | flat | 50 | Daily TA for a trainer who conducts exactly 1 group batch |
| `ta_2_plus_batches_amount` | trainer | flat | 100 | Daily TA (flat cap) for a trainer who conducts 2+ group batches |

**UI note:** Group `rule_type: percentage` rows differently from `rule_type: flat` — percentage rows show a `%` suffix, flat rows show a `₹` prefix.

---

### Commissions API

```
GET   /api/v1/admin/commissions
PATCH /api/v1/admin/commissions/:id/mark-paid
```

**GET query params (all optional):**
| Param | Values | Effect |
|---|---|---|
| `professional_type` | `trainer` \| `teacher` \| `marketing_executive` | Filter by pro type |
| `status` | `pending` \| `paid` | Filter by payment status |
| `professional_id` | number | Filter to a single professional |

**GET response shape:**
```json
{
  "success": true,
  "count": 4,
  "data": [
    {
      "id": 1,
      "professional_id": 3,
      "professional_type": "trainer",
      "source_type": "individual_coaching",
      "source_id": 7,
      "base_amount": "1200.00",
      "commission_rate": "80.00",
      "commission_amount": "960.00",
      "status": "pending",
      "created_at": "2026-03-31T10:00:00Z",
      "professionals": {
        "id": 3,
        "users": { "full_name": "Rahul Nair", "mobile": "9876541230" }
      }
    }
  ]
}
```

**source_type values and their meaning:**

| source_type | Who gets it | What triggered it |
|---|---|---|
| `individual_coaching` | trainer or ME | Personal game coaching payment |
| `group_coaching_society` | trainer or ME | Group coaching in a society |
| `group_coaching_school` | trainer | Group coaching in a school |
| `personal_tutor` | teacher or ME | Personal tutor payment |
| `school_registration` | marketing_executive | Admin approved a school registration |

**PATCH mark-paid — no body needed:**
```
PATCH /api/v1/admin/commissions/3/mark-paid
```
Response: `{ "success": true, "data": { ...updated commission row } }`

**Error codes:**
- `404` → `COMMISSION_NOT_FOUND`
- `409` → `ALREADY_PAID`

---

### Travelling Allowances API

```
GET   /api/v1/admin/travelling-allowances
PATCH /api/v1/admin/travelling-allowances/:id/mark-paid
```

**GET query params (all optional):**
| Param | Values | Effect |
|---|---|---|
| `trainer_professional_id` | number | Filter to one trainer |
| `status` | `pending` \| `paid` | Filter by payment status |

**GET response shape:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 1,
      "trainer_professional_id": 3,
      "allowance_date": "2026-03-31",
      "batches_count": 2,
      "amount": "100.00",
      "status": "pending",
      "created_at": "2026-03-31T10:00:00Z",
      "professionals": {
        "id": 3,
        "users": { "full_name": "Rahul Nair", "mobile": "9876541230" }
      }
    }
  ]
}
```

**PATCH mark-paid — no body needed:**
```
PATCH /api/v1/admin/travelling-allowances/1/mark-paid
```

**Error codes:**
- `404` → `TA_NOT_FOUND`
- `409` → `ALREADY_PAID`

---

### Commissions Page — UI Spec

**Three tabs: "Commission Rules" | "Commissions" | "Travelling Allowances"**

---

#### Tab 1 — Commission Rules

Display a table of all 16 rules grouped by `professional_type` (Trainer / Teacher / Marketing Executive). Each row shows:
- Description (human-readable)
- Rule type badge: `%` (green) or `₹` (blue)
- Current value — inline editable number input
- "Save" button per row (disabled until value changes)

On save: call `PUT /admin/commission-rules/:ruleKey` with `{ value }`. Show a toast on success.

**Do not allow deleting or adding rules** — only editing the `value`.

---

#### Tab 2 — Commissions

**Filter bar** (top): dropdowns for Professional Type, Status. Optional text input for Professional ID.

**Table columns:** ID | Professional | Type badge | Source Type | Base Amount | Rate | Commission ₹ | Status badge | Date | Actions

**Status badge colors:** `pending` → amber, `paid` → green (same as global status colors)

**Actions column:** "Mark Paid" button — only shown when `status === 'pending'`. On click: calls `PATCH /admin/commissions/:id/mark-paid`. On success: row updates to `paid` with a toast.

**Summary row** at the bottom of the table (or a card above): total pending commission amount across the current filter.

---

#### Tab 3 — Travelling Allowances

**Filter bar:** dropdown for Status, optional number input for Trainer Professional ID.

**Table columns:** ID | Trainer Name | Date | Batches | Amount ₹ | Status badge | Actions

**Actions column:** "Mark Paid" button — only shown when `status === 'pending'`. Same pattern as commissions tab.

**Display note:** `batches_count: 1` → show "1 batch · ₹50", `batches_count: 2+` → show "X batches · ₹100".

---

### Wallet Balance (on Professional Detail)

When showing a professional's profile (Trainers / Teachers / ME pages), display their current wallet balance. It is available in the existing `GET /api/v1/admin/professionals` response under `wallet_balance`.

This is the **running total of all commission_amount values** ever credited — it is NOT reduced when a commission is marked paid. Think of it as a lifetime earned amount, not a withdrawable balance.
