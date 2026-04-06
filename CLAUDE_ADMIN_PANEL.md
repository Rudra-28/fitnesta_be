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
http://localhost:5000/api/v1
```

All requests to the admin section are prefixed: `http://localhost:5000/api/v1/admin/...`

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

### Approved Professionals List

```
GET /api/v1/admin/professionals                            # all 4 types
GET /api/v1/admin/professionals?type=trainer
GET /api/v1/admin/professionals?type=teacher
GET /api/v1/admin/professionals?type=marketing_executive
GET /api/v1/admin/professionals?type=vendor
```

**Response shape:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "professional_id": 1,
      "profession_type": "marketing_executive",
      "referral_code": "FIT-ABC12345",
      "place": "Pune",
      "date": "2026-03-31",
      "own_two_wheeler": true,
      "communication_languages": "[\"Hindi\",\"Marathi\"]",
      "pan_card": "https://res.cloudinary.com/.../pan.pdf",
      "adhar_card": "https://res.cloudinary.com/.../adhar.pdf",
      "relative_name": "Suresh Mehta",
      "relative_contact": "9123456780",
      "wallet_balance": "960.00",
      "user": {
        "id": 17,
        "full_name": "Rahul Mehta",
        "mobile": "9876543210",
        "email": "rahul@example.com",
        "address": "Flat 12, Shree Apartments, Pune",
        "photo": "https://res.cloudinary.com/.../photo.jpg",
        "created_at": "2026-03-31T10:00:00Z"
      },
      "details": {
        "dob": "1995-08-15",
        "education_qualification": "B.Com",
        "previous_experience": "2 years sales executive",
        "activity_agreement_pdf": "https://res.cloudinary.com/.../agreement.pdf"
      }
    }
  ]
}
```

**`details` field contains type-specific data:**

| profession_type | details fields |
|---|---|
| `trainer` | `player_level`, `category`, `specified_game` (array), `specified_skills` (array), `experience_details`, `qualification_docs`, `documents` |
| `teacher` | `subject`, `experience_details`, `ded_doc`, `bed_doc`, `other_doc` |
| `marketing_executive` | `dob`, `education_qualification`, `previous_experience`, `activity_agreement_pdf` |
| `vendor` | `store_name`, `store_address`, `store_location`, `gst_certificate` |

---

### All Students List (with Assignment Status)

```
GET /api/v1/admin/students?type=personal_tutor
GET /api/v1/admin/students?type=individual_coaching
```

**This is different from `/students/unassigned` — it returns ALL students (assigned + unassigned) so the admin panel can show a full list with assignment badges.**

**Response for `?type=personal_tutor`:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "personal_tutor_id": 10,
      "student_name": "Arjun Sharma",
      "student_mobile": "9876543210",
      "standard": "8th",
      "batch": "Morning",
      "teacher_for": "Mathematics",
      "dob": "2012-05-10",
      "assigned": true,
      "assigned_teacher": {
        "professional_id": 2,
        "name": "Sunita Verma",
        "mobile": "9988776655",
        "subject": "Mathematics"
      }
    },
    {
      "personal_tutor_id": 11,
      "student_name": "Priya Joshi",
      "student_mobile": "9123456789",
      "standard": "6th",
      "batch": "Evening",
      "teacher_for": "Science",
      "dob": "2014-02-20",
      "assigned": false,
      "assigned_teacher": null
    }
  ]
}
```

**Response for `?type=individual_coaching`:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "individual_participant_id": 7,
      "student_name": "Riya Patel",
      "student_mobile": "9123456780",
      "activity": "Cricket",
      "flat_no": "B-204",
      "society": "Green Valley CHS",
      "dob": "2010-08-15",
      "age": 15,
      "kits": "Cricket Kit",
      "assigned": true,
      "assigned_trainer": {
        "professional_id": 3,
        "name": "Rahul Nair",
        "mobile": "9876541230",
        "category": "Sports",
        "specified_game": ["Cricket", "Football"]
      }
    },
    {
      "individual_participant_id": 8,
      "student_name": "Amit Sharma",
      "student_mobile": "9988001122",
      "activity": "Football",
      "flat_no": "A-101",
      "society": "Sunrise Apartments",
      "dob": "2012-06-10",
      "age": 13,
      "kits": null,
      "assigned": false,
      "assigned_trainer": null
    }
  ]
}
```

**Error codes:**
- `400` → `INVALID_TYPE` (type param missing or not personal_tutor/individual_coaching)

**Assignment endpoints (unchanged):**
```
POST /api/v1/admin/assign/teacher
     body: { personal_tutor_id: number, teacher_professional_id: number }

POST /api/v1/admin/assign/trainer
     body: { individual_participant_id: number, trainer_professional_id: number }
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

### Students Page (Phase 4)

**Two tabs: "Individual Coaching" | "Personal Tutor"**

Each tab shows ALL students (assigned + unassigned) from:
- `GET /api/v1/admin/students?type=individual_coaching`
- `GET /api/v1/admin/students?type=personal_tutor`

**Individual Coaching tab columns:** Name | Mobile | Activity | Society | Flat No | Age | Kits | Status badge | Assigned Trainer

**Personal Tutor tab columns:** Name | Mobile | Standard | Batch | Subject Needed | DOB | Status badge | Assigned Teacher

**Status badge logic:**
- `assigned: true` → green "Assigned" badge + show professional name
- `assigned: false` → amber "Unassigned" badge

---

### Assignments Page (Phase 2) — Read-only overview

**Purpose:** Show which students are assigned and which are pending. No assign button here — sessions are created in the Sessions section.

**Two tabs: "Personal Tutor" | "Individual Coaching"**

**API:** `GET /admin/student-assignments?service=personal_tutor` and `GET /admin/student-assignments?service=individual_coaching`

**Personal Tutor tab columns:** Name | Mobile | Standard | Teacher For | Assigned? (green/amber badge) | Assigned Teacher

**Individual Coaching tab columns:** Name | Mobile | Activity | Society | Assigned? (green/amber badge) | Assigned Trainer

**Status badge:** `assigned: true` → green "Assigned" | `assigned: false` → amber "Unassigned — needs session"

Unassigned students should be highlighted/sorted to the top to guide admin to create sessions for them.

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

## Session Management (New Module)

This is the scheduling system the admin uses to create batches, generate sessions, and assign students. It covers all 4 student types. The system has two parts: **Batch Module** (for group_coaching + school_student) and **Session Module** (for personal_tutor + individual_coaching).

---

### 10. Batch Module

#### What a Batch is

A batch is a recurring group schedule. It belongs to either a society (group_coaching) or a school (school_student), has one activity, one assigned professional (trainer or teacher), a weekly schedule (days + start/end time), and a date range. Sessions are generated from the batch schedule.

#### New DB Models

**`batches`**
- `id`, `batch_type` (group_coaching | school_student), `society_id` (null for school), `school_id` (null for society)
- `activity_id`, `professional_id`, `professional_type` (trainer | teacher)
- `batch_name` (optional label), `days_of_week` (JSON array e.g. `["Monday","Wednesday","Friday"]`)
- `start_time`, `end_time`, `start_date`, `end_date`, `is_active` (true/false), `created_at`, `updated_at`

**`batch_students`** — which students belong to a batch
- `id`, `batch_id`, `student_id`, `joined_at`
- Unique: `(batch_id, student_id)`

**`sessions`**
- `id`, `session_type` (group_coaching | school_student | personal_tutor | individual_coaching)
- `batch_id` (null for individual sessions), `student_id` (null for batch sessions)
- `professional_id`, `scheduled_date`, `start_time`, `end_time`
- `status` (scheduled | ongoing | completed | cancelled), `cancel_reason`
- `created_at`, `updated_at`

**`session_participants`** — which students are in a batch session
- `id`, `session_id`, `student_id`, `attended` (boolean, default false), `created_at`
- Unique: `(session_id, student_id)`

---

#### Batch API Endpoints

```
POST   /api/v1/admin/batches                                    # create batch
GET    /api/v1/admin/batches                                    # list batches
GET    /api/v1/admin/batches/:batchId                           # single batch with students
PUT    /api/v1/admin/batches/:batchId                           # update batch (future sessions auto-updated)
DELETE /api/v1/admin/batches/:batchId                           # soft-delete (future sessions cancelled)
POST   /api/v1/admin/batches/:batchId/students                  # bulk assign students to batch
DELETE /api/v1/admin/batches/:batchId/students/:studentId       # remove student from batch
POST   /api/v1/admin/batches/:batchId/generate-sessions         # auto-generate sessions for a date range
```

---

**POST /api/v1/admin/batches** — Create batch

Request body:
```json
{
  "batch_type": "group_coaching",
  "society_id": 3,
  "school_id": null,
  "activity_id": 1,
  "professional_id": 5,
  "professional_type": "trainer",
  "batch_name": "Morning Cricket A",
  "days_of_week": ["Monday", "Wednesday", "Friday"],
  "start_time": "07:00",
  "end_time": "08:00",
  "start_date": "2026-04-07",
  "end_date": "2026-06-30"
}
```

Rules:
- `batch_type = group_coaching` → `society_id` required
- `batch_type = school_student` → `school_id` required
- `end_date` must be after `start_date`
- `days_of_week` must produce at least one session date in range
- Professional must be approved and not already booked at that time on any session date (conflict check runs on create)

**Success:** `201` → `{ "success": true, "data": { ...batch } }`

**Error codes:**
| code | HTTP | Meaning |
|---|---|---|
| `SOCIETY_OR_SCHOOL_REQUIRED` | 400 | batch_type mismatch |
| `DATE_RANGE_INVALID` | 400 | end_date before start_date |
| `NO_DAYS_IN_RANGE` | 400 | schedule produces 0 sessions |
| `ACTIVITY_NOT_FOUND` | 404 | activity_id invalid |
| `PROFESSIONAL_NOT_FOUND` | 404 | professional_id invalid or not approved |
| `PROFESSIONAL_CONFLICT` | 409 | professional already booked at that time on a session date |

---

**GET /api/v1/admin/batches** — List batches

Query params (all optional):
| Param | Values |
|---|---|
| `batch_type` | `group_coaching` \| `school_student` |
| `society_id` | number |
| `school_id` | number |
| `activity_id` | number |

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "batch_type": "group_coaching",
      "batch_name": "Morning Cricket A",
      "days_of_week": ["Monday", "Wednesday", "Friday"],
      "start_time": "1970-01-01T01:30:00.000Z",
      "end_time": "1970-01-01T02:30:00.000Z",
      "start_date": "2026-04-07",
      "end_date": "2026-06-30",
      "is_active": true,
      "activities": { "id": 1, "name": "Cricket" },
      "societies": { "id": 3, "society_name": "Green Valley CHS" },
      "schools": null,
      "professionals": {
        "id": 5,
        "profession_type": "trainer",
        "users": { "full_name": "Rahul Nair" }
      },
      "_count": { "batch_students": 12, "sessions": 36 }
    }
  ]
}
```

**Note on time fields:** `start_time` and `end_time` are stored as MySQL `TIME` and returned as ISO datetime strings with epoch date `1970-01-01`. Extract just the time portion for display: `new Date(row.start_time).toTimeString().slice(0,5)` → `"07:30"`.

---

**GET /api/v1/admin/batches/:batchId** — Single batch

Returns same shape as list item, plus:
- `batch_students[]` — array of students enrolled, each with `student_id`, `student_type`, and `users.full_name`, `users.mobile`

---

**PUT /api/v1/admin/batches/:batchId** — Update batch

Updatable fields (all optional — send only what changed):
```json
{
  "professional_id": 7,
  "professional_type": "trainer",
  "start_time": "08:00",
  "end_time": "09:00",
  "days_of_week": ["Tuesday", "Thursday"],
  "end_date": "2026-09-30",
  "batch_name": "New Name"
}
```

**What happens automatically:**
- If `professional_id` changed → new professional is conflict-checked on all future session dates. If clear, all future `scheduled` sessions are updated to new professional.
- If `start_time` / `end_time` changed → all future `scheduled` sessions updated.
- If `days_of_week` changed → sessions on days **removed** from the schedule are cancelled (`cancel_reason: "Batch schedule updated"`). Sessions on newly added days are NOT auto-generated — admin must call `/generate-sessions` manually after.

**Error codes:** same as create, plus `BATCH_NOT_FOUND` (404), `BATCH_INACTIVE` (409).

---

**DELETE /api/v1/admin/batches/:batchId** — Soft-delete batch

Sets `is_active = false`. All future `scheduled` sessions are cancelled with `cancel_reason: "Batch deactivated"`.

Response: `{ "success": true }`

---

**POST /api/v1/admin/batches/:batchId/generate-sessions** — Generate sessions

Request body:
```json
{ "start_date": "2026-04-07", "end_date": "2026-06-30" }
```

The system walks the date range, picks dates that match `days_of_week`, skips already-existing session dates, and creates one `sessions` row per new date. Each new session also gets a `session_participants` row for every current `batch_students` member.

Response:
```json
{ "success": true, "generated": 36 }
```
If all dates already exist: `{ "success": true, "generated": 0, "message": "No new session dates to generate in this range." }`

**Error codes:** `BATCH_NOT_FOUND` (404), `BATCH_INACTIVE` (409), `DATE_RANGE_INVALID` (400).

---

**POST /api/v1/admin/batches/:batchId/students** — Bulk assign students

Request body:
```json
{ "student_ids": [10, 11, 14, 15] }
```

The system:
1. Validates all student IDs exist and match the batch's `batch_type`
2. Checks each student for scheduling conflicts on all future batch session dates
3. Assigns conflict-free students, adds them as `session_participants` on all future sessions

Response (partial success is possible — conflicted students are skipped, not hard-failed):
```json
{
  "success": true,
  "assigned": 3,
  "skipped_conflicts": [
    { "student_id": 14, "name": "Priya Joshi", "date": "2026-04-09T00:00:00.000Z" }
  ]
}
```

**Error codes:** `BATCH_NOT_FOUND` (404), `BATCH_INACTIVE` (409), `STUDENT_NOT_FOUND` (404), `INVALID_BATCH_TYPE` (400).

---

**DELETE /api/v1/admin/batches/:batchId/students/:studentId** — Remove student

Removes from `batch_students` and removes the student from all future `session_participants` records.

Response: `{ "success": true }`

---

### 11. Session Module

Used for both individual sessions (personal_tutor, individual_coaching) and viewing/managing all session records.

#### Session API Endpoints

```
POST   /api/v1/admin/sessions                         # create individual session
GET    /api/v1/admin/sessions                         # list sessions (with filters)
GET    /api/v1/admin/sessions/:sessionId              # single session with participants
PUT    /api/v1/admin/sessions/:sessionId/status       # update status
DELETE /api/v1/admin/sessions/:sessionId              # cancel session
```

---

**POST /api/v1/admin/sessions** — Create individual session

Only valid for `session_type: personal_tutor` or `individual_coaching`. Batch sessions are generated via the Batch module.

Request body:
```json
{
  "session_type": "personal_tutor",
  "student_id": 12,
  "professional_id": 4,
  "scheduled_date": "2026-04-10",
  "start_time": "10:00",
  "end_time": "11:00"
}
```

Conflict checks run on both the professional and the student before creating.

**Success:** `201` → `{ "success": true, "data": { ...session } }`

**Error codes:**
| code | HTTP | Meaning |
|---|---|---|
| `INVALID_SESSION_TYPE` | 400 | Only personal_tutor / individual_coaching allowed |
| `MISSING_FIELDS` | 400 | Required fields absent |
| `STUDENT_NOT_FOUND` | 404 | student_id invalid |
| `PROFESSIONAL_NOT_FOUND` | 404 | professional_id invalid or not approved |
| `PROFESSIONAL_CONFLICT` | 409 | Professional already booked at that time |
| `STUDENT_CONFLICT` | 409 | Student already has a session at that time |

---

**GET /api/v1/admin/sessions** — List sessions

Query params (all optional):
| Param | Values |
|---|---|
| `student_id` | number |
| `professional_id` | number |
| `from` | ISO date string e.g. `2026-04-01` |
| `to` | ISO date string e.g. `2026-06-30` |
| `status` | `scheduled` \| `ongoing` \| `completed` \| `cancelled` |
| `session_type` | `group_coaching` \| `school_student` \| `personal_tutor` \| `individual_coaching` |

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "session_type": "personal_tutor",
      "batch_id": null,
      "student_id": 12,
      "professional_id": 4,
      "scheduled_date": "2026-04-10T00:00:00.000Z",
      "start_time": "1970-01-01T04:30:00.000Z",
      "end_time": "1970-01-01T05:30:00.000Z",
      "status": "scheduled",
      "cancel_reason": null,
      "batches": null,
      "students": { "id": 12, "users": { "full_name": "Arjun Sharma" } },
      "professionals": {
        "id": 4,
        "profession_type": "teacher",
        "users": { "full_name": "Sunita Verma" }
      },
      "_count": { "session_participants": 0 }
    }
  ]
}
```

---

**GET /api/v1/admin/sessions/:sessionId** — Single session

Same shape as list item, plus:
- `session_participants[]` — each with `student_id`, `attended`, and `students.users.full_name`

---

**PUT /api/v1/admin/sessions/:sessionId/status** — Update status

Request body:
```json
{ "status": "completed" }
```
Or when cancelling:
```json
{ "status": "cancelled", "cancel_reason": "Trainer unavailable" }
```

Valid status transitions: `scheduled → ongoing → completed` or any `→ cancelled`.
Cannot update a session that is already `completed` or `cancelled`.

**Error codes:**
| code | HTTP | Meaning |
|---|---|---|
| `SESSION_NOT_FOUND` | 404 | sessionId invalid |
| `SESSION_ALREADY_FINAL` | 409 | Session is completed or already cancelled |
| `MISSING_FIELDS` | 400 | cancel_reason missing when cancelling |

---

**DELETE /api/v1/admin/sessions/:sessionId** — Cancel session

Request body:
```json
{ "cancel_reason": "Trainer unavailable" }
```

`cancel_reason` is **required**. Sets `status = cancelled`.

**Error codes:** `SESSION_NOT_FOUND` (404), `SESSION_ALREADY_FINAL` (409), `MISSING_FIELDS` (400 — no cancel_reason).

---

### 12. Updated: Professional Availability Endpoint

The existing endpoint now accepts optional time-based conflict filtering:

```
GET /api/v1/admin/professionals/available?type=teacher
GET /api/v1/admin/professionals/available?type=teacher&date=2026-04-10&start_time=10:00&end_time=11:00
GET /api/v1/admin/professionals/available?type=trainer&date=2026-04-10&start_time=07:00&end_time=08:00
```

When `date + start_time + end_time` are provided, professionals with a conflicting `scheduled` or `ongoing` session at that slot are excluded. Use this when the admin is about to assign a session or create a batch — pass the intended time to see only free professionals.

Without the time params, behaviour is unchanged (returns all approved professionals of that type).

---

### Session Management UI Pages

#### New Sidebar Items

```
Fitnesta Admin
├── Dashboard
├── Pending Approvals
├── Society Requests
├── Assignments
├── Professionals
├── Students
├── Fee Structures
├── Commissions
├── Societies
├── Schools
├── Payments
├── Batches                ← NEW
│   ├── Group Coaching     ← batch_type = group_coaching
│   └── School             ← batch_type = school_student
└── Sessions               ← NEW (all session types, unified view)
```

---

#### Batches Page

**Two tabs: "Group Coaching Batches" | "School Batches"**

Each tab:
- Filters: society/school dropdown, activity dropdown
- Table: Batch Name | Society/School | Activity | Professional | Days | Time | Date Range | Students | Sessions | Status | Actions
- "View" → detail drawer: shows enrolled students list, upcoming sessions (next 5)
- "Create Batch" button → slide-over form:
  - `batch_type` pre-set by tab
  - Society/School picker (dropdown filtered by type)
  - Activity picker
  - Professional picker — calls `GET /admin/professionals/available?type=trainer` or `?type=teacher`
  - Days of week multi-select (Mon–Sun checkboxes)
  - Start time / End time pickers
  - Start date / End date pickers
  - Batch name (optional)
  - Submit → `POST /admin/batches`
- "Generate Sessions" button → modal with date range inputs → `POST /admin/batches/:id/generate-sessions`
- "Assign Students" button → modal: multi-select from `GET /admin/students?type=group_coaching` or `?type=school_student` → `POST /admin/batches/:id/students`
- "Edit" button → same form as create, pre-filled → `PUT /admin/batches/:id`
- "Deactivate" button → confirmation → `DELETE /admin/batches/:id`

**Student count badge** on each row: `_count.batch_students` → e.g. "12 students".

**Sessions count badge**: `_count.sessions` → e.g. "36 sessions".

---

#### Sessions Page

**Unified view of all sessions across all types.**

Filters:
- Session type dropdown (All | Group Coaching | School | Personal Tutor | Individual Coaching)
- Status dropdown (All | Scheduled | Ongoing | Completed | Cancelled)
- Professional picker (optional)
- Student search (optional)
- Date range picker (from/to)

Table columns: ID | Type badge | Date | Time | Professional | Student/Batch | Status badge | Actions

**Type badge colors:**
| session_type | Color |
|---|---|
| `group_coaching` | Blue |
| `school_student` | Indigo |
| `personal_tutor` | Purple |
| `individual_coaching` | Orange |

**Status badge colors:**
| status | Color |
|---|---|
| `scheduled` | Amber |
| `ongoing` | Blue |
| `completed` | Green |
| `cancelled` | Red |

**"View" button** → right drawer showing:
- Session details (date, time, professional, status)
- For batch sessions: batch name, society/school
- For individual sessions: student name + mobile
- `session_participants[]` list (for batch sessions): student name + attended badge

**"Create Session" button** (for personal_tutor / individual_coaching only):
- Form fields: session_type (dropdown, only personal_tutor/individual_coaching), student picker, professional picker (calls availability endpoint with the selected date+time), date, start_time, end_time
- Submit → `POST /admin/sessions`
- If `PROFESSIONAL_CONFLICT` or `STUDENT_CONFLICT` → show inline error message, do not close form

**"Update Status" button** (only on `scheduled` / `ongoing` rows):
- Dropdown: mark as ongoing / completed / cancelled (with cancel_reason input if cancelled)
- → `PUT /admin/sessions/:id/status`

**"Cancel" button** (only on `scheduled` rows — same as delete):
- Modal asking for cancel_reason (required) → `DELETE /admin/sessions/:id`

---

### Session Management Build Order

| Phase | Feature | API used |
|---|---|---|
| 10 | Batches page (Group Coaching tab) | `POST/GET/PUT/DELETE /admin/batches`, `/admin/batches/:id/generate-sessions`, `/admin/batches/:id/students` |
| 11 | Batches page (School tab) | Same endpoints, `batch_type=school_student` |
| 12 | Sessions page — list + filters | `GET /admin/sessions` |
| 13 | Sessions page — create individual session | `POST /admin/sessions`, `GET /admin/professionals/available` with time params |
| 14 | Sessions page — update/cancel | `PUT /admin/sessions/:id/status`, `DELETE /admin/sessions/:id` |

---

### Session Management Key Business Logic

1. **Time display:** `start_time` and `end_time` come back as ISO strings with epoch date `1970-01-01`. Use `new Date(val).toTimeString().slice(0,5)` or `new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })` to display them cleanly.

2. **Conflict errors on batch create/update:** If the backend returns `PROFESSIONAL_CONFLICT`, show the error message inline — it includes which date caused the conflict. Do not close the form.

3. **Partial success on bulk student assign:** The endpoint returns `{ assigned: N, skipped_conflicts: [...] }`. If `skipped_conflicts.length > 0`, show a warning toast listing the conflicted students — do not treat it as a failure.

4. **Batch update → day schedule change:** After updating `days_of_week`, if new days were added, remind the admin to call "Generate Sessions" again to create sessions for the new days. The backend cancels removed days but does NOT auto-generate added ones.

5. **`batch_id` vs `student_id` in sessions:** Batch sessions have `batch_id` set and `student_id = null`. Individual sessions have `student_id` set and `batch_id = null`. Use this to differentiate rendering in the table.

6. **Session participants vs direct student:** For batch sessions, the actual students are in `session_participants[]`. For individual sessions, the single student is in the `students` relation. Handle both cases in the "View" drawer.

7. **Professional availability with time filter:** Always pass `date + start_time + end_time` to `/professionals/available` when the admin is creating a new individual session. This ensures only free professionals are shown. For batch creation, the conflict check is done server-side — no need to pre-filter on the frontend.

8. **Status flow:** `scheduled → ongoing → completed` (forward only). Either `scheduled` or `ongoing` can move to `cancelled`. `completed` and `cancelled` are terminal — no further updates allowed.

---

## Undocumented Backend Features (Discovered from Source)

These exist in the backend but were not yet written into this file. Build them as needed.

---

### 13. Trainer Assignments (`trainer_assignments` table)

This is a **separate concept from personal-tutor/individual-coaching assignments.** It tracks which trainer/teacher is formally assigned to a society or school for group coaching — i.e., a contractual group engagement record with a sessions cap and settlement tracking.

**DB Model:**
```
trainer_assignments
  id, professional_id, professional_type ("trainer"|"teacher")
  assignment_type ("group_coaching_society"|"group_coaching_school"|"individual_coaching"|"personal_tutor")
  society_id?, school_id?, activity_id?
  sessions_allocated (optional cap — TinyInt)
  assigned_from (Date), is_active (Boolean, default true)
  last_settled_at (Timestamp — set when commission settlement runs)
```

**API Endpoints:**
```
GET   /api/v1/admin/assignments
      ?professional_id=5   (optional)
      ?is_active=true|false (optional)

PATCH /api/v1/admin/assignments/:id/sessions-cap
      body: { sessions_allocated: 20 }
      error: 400 INVALID_SESSIONS_ALLOCATED

PATCH /api/v1/admin/assignments/:id/deactivate
```

**Response shape for GET /assignments:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 3,
      "professional_id": 5,
      "professional_type": "trainer",
      "assignment_type": "group_coaching_society",
      "society_id": 2,
      "school_id": null,
      "activity_id": 1,
      "sessions_allocated": 20,
      "assigned_from": "2026-04-01",
      "is_active": true,
      "last_settled_at": null,
      "professionals": { "id": 5, "profession_type": "trainer", "users": { "full_name": "Rahul Nair", "mobile": "9876541230" } },
      "societies": { "id": 2, "society_name": "Green Valley CHS" },
      "schools": null,
      "activities": { "id": 1, "name": "Cricket" }
    }
  ]
}
```

**Dashboard badge:** `GET /api/v1/admin/settlement/unsettled-count` returns `{ unsettled_count: N }` — count of active assignments not settled in the last 30 days. Use this as a warning badge on the Assignments page.

---

### 14. Settlement Module

Settlement is the process by which the admin calculates and confirms how much is owed to each professional based on their active `trainer_assignments`. It uses the `commission_rules` rates to compute amounts. It does NOT directly pay — it sets `last_settled_at` on assignment records and creates `commissions` rows.

**API Endpoints:**
```
GET  /api/v1/admin/settlement/preview
     ?professional_id=5  (optional — omit to preview all)

POST /api/v1/admin/settlement/confirm
     body: { assignment_ids: [1, 2, 3] }  (optional — omit to settle all active assignments)
```

**GET preview response shape:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "assignment_id": 3,
      "professional_id": 5,
      "professional_name": "Rahul Nair",
      "assignment_type": "group_coaching_society",
      "society_name": "Green Valley CHS",
      "activity": "Cricket",
      "sessions_allocated": 20,
      "commission_amount": 960.00
    }
  ]
}
```

**POST confirm** runs the same calculation and:
1. Creates `commissions` rows for each assignment
2. Sets `last_settled_at = NOW()` on each assignment

Response: `{ "success": true, "count": N, "data": [...confirmed commissions] }`

**UI suggestion:** Add a "Settlement" section within the Commissions page (new tab or separate page). Show the preview table with total owed, then a "Confirm Settlement" button. Display `unsettled_count` as an amber badge in the sidebar/dashboard.

---

### 15. Commission Approval Flow (Multi-step)

Commissions in the DB now have a richer `status` enum: `on_hold | pending | approved | requested | paid`

The flow is:
1. Commission is created → `on_hold` or `pending`
2. Admin approves → `approved` (`PATCH /api/v1/admin/commissions/:id/approve`)
3. Professional requests withdrawal → `requested`
4. Admin marks paid → `paid` (`PATCH /api/v1/admin/commissions/:id/mark-paid`)

**Error code for mark-paid if not yet approved:** `422 COMMISSION_NOT_APPROVED`
**Error code for approve if already in wrong state:** `409 COMMISSION_NOT_APPROVABLE`

Update the Commissions tab UI to show the full status flow and enable the "Approve" button when status is `on_hold` or `pending`, and "Mark Paid" only when status is `approved`.

---

### 16. Withdrawal Requests

When a professional requests to withdraw their earnings, a `requested` status is set on their commissions. Admin can see all professionals with pending withdrawal requests and approve them (which triggers a Razorpay payout).

**API Endpoints:**
```
GET   /api/v1/admin/withdrawals
PATCH /api/v1/admin/withdrawals/:professionalId/approve
```

**GET response shape:**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "professional_id": 3,
      "full_name": "Rahul Nair",
      "mobile": "9876541230",
      "wallet_balance": "960.00",
      "payout_method": "upi",
      "upi_id": "rahul@upi",
      "bank_account_number": null,
      "bank_ifsc": null,
      "bank_account_name": null,
      "razorpay_contact_id": "cont_xxx",
      "razorpay_fund_account_id": "fa_xxx",
      "requested_amount": 960.00
    }
  ]
}
```

**PATCH approve** — triggers Razorpay payout via `razorpay_fund_account_id`. Marks relevant commissions as `paid` and updates `wallets.last_payout_id` and `last_payout_status`.

**Professionals now have these payout fields** (not previously documented):
- `upi_id`, `bank_account_number`, `bank_ifsc`, `bank_account_name`
- `payout_method` ("upi" | "bank")
- `razorpay_contact_id`, `razorpay_fund_account_id`

Display these on the Professional detail view when relevant.

**Add "Withdrawals" as a new sidebar item** (under Commissions or as its own entry).

---

### 17. Fee Structures API (Full CRUD)

See the **Fee Structures (editable)** section in the UI breakdown above for full details, UX flow, and response shapes.

```
GET  /api/v1/admin/fee-structures?section=school|society|individual_coaching|personal_tutor
GET  /api/v1/admin/fee-structures/custom-categories?type=society|school
POST /api/v1/admin/fee-structures   body: { activity_id, coaching_type, society_category?, custom_category_name?, standard?, term_months, total_fee, effective_monthly? }
PUT  /api/v1/admin/fee-structures/:id   body: { total_fee, effective_monthly? }
```

`society_category` values: `"A+"`, `"A"`, `"B"`, `"custom"`. When `"custom"`, `custom_category_name` is required.

---

### 18. Admin-side Society & School Registration

Admin can directly register a new society or school (bypassing the ME/Flutter flow).

```
POST /api/v1/admin/societies
     body: { society_name, society_category, address, pin_code, total_participants, no_of_flats,
             authority_person_name, contact_number, coordinator_name, me_professional_id? }

POST /api/v1/admin/schools
     body: { school_name, address, pin_code, state, language_medium, principal_name,
             principal_contact, activity_coordinator, me_professional_id? }
```

Both default `approval_status` to `approved` when created by admin.

Existing GET endpoints return ALL societies/schools (not just approved):
```
GET /api/v1/admin/societies          → all societies (any approval_status)
GET /api/v1/admin/societies/:id      → single society with full detail
GET /api/v1/admin/schools            → all schools
GET /api/v1/admin/schools/:id        → single school with full detail
```

Add "Create" buttons to the Societies and Schools pages.

---

### 19. Activities Endpoint (for Dropdowns)

```
GET /api/v1/admin/activities
    ?coaching_type=group_coaching|individual_coaching|personal_tutor|school_student  (optional)
```

Returns activities filtered by coaching type (uses `fee_structures` join to check which activities have fees defined for that type). Use this when populating the activity dropdown in the Batch create form.

---

### 20. ME List Endpoint (for Dropdowns)

```
GET /api/v1/admin/me-list
```

Returns all approved marketing executives with `{ professional_id, full_name, mobile, referral_code }`. Use when assigning an ME to a society or school during admin registration.

---

### 21. New DB Models (Not Previously Documented)

**`trainer_assignments`** — see Section 13 above.

**`fitnesta_profit_logs`** — internal profit tracking per payment event. Admin read-only (no admin API endpoint yet).
- `id`, `source_type` (kit_order/individual_coaching/group_coaching_society/group_coaching_school/personal_tutor)
- `source_id`, `total_collected`, `commissions_paid`, `fitnesta_profit`, `notes`, `created_at`

**`kit_orders`** — student kit purchase orders via Razorpay. Admin read-only for now (no admin API endpoint yet).
- `id`, `student_user_id`, `product_id`, `vendor_id`, `quantity`, `unit_price`, `delivery_charge`
- `delivery_zone` (within_city/within_state/outside_state)
- `total_amount`, `payment_status` (pending/paid/failed), `order_status` (new_order→completed/rejected)
- `razorpay_order_id`, `razorpay_payment_id`
- Delivery address fields: `delivery_name`, `delivery_phone`, `delivery_address`, `delivery_city`, `delivery_state`, `delivery_pincode`
- `age_group`

**`vendor_products`** — products listed by vendors.
- `id`, `vendor_id`, `product_image`, `product_name`, `sports_category`
- `price`, `selling_price`, `stock`, `description`
- `within_city_charge`, `within_state_charge`, `outside_state_charge`
- `age_groups` (JSON), `created_at`

**`session_feedback`** — post-session ratings from students (written by Flutter app).
- `id`, `session_id`, `student_id`, `rating` (1–5), `comment`, `created_at`
- Unique per `(session_id, student_id)`

**`sessions`** now has extra fields:
- `activity_id` (nullable — links to activities)
- `in_time`, `out_time` (Timestamps — professional check-in/out, set by Flutter app)

**`wallets`** now has extra fields:
- `last_payout_id` (Razorpay payout ID)
- `last_payout_status` (e.g. "processed", "failed")

**`pending_registrations`** now has:
- `assigned_me_id` (nullable FK to professionals) — ME assigned to this pending registration
- `assigned_me_at` (Timestamp)

**`admins`** now has:
- `scope` enum: `super_admin | sub_admin` (default `sub_admin`)

---

### 22. Updated Sidebar (Reflects All Features)

```
Fitnesta Admin
├── Dashboard                (unsettled_count badge from /settlement/unsettled-count)
├── Pending Approvals        (count badge)
├── Assignments              (personal tutor + individual coaching)
├── Trainer Assignments      ← NEW (group coaching assignment records)
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
├── Batches
│   ├── Group Coaching
│   └── School
├── Sessions
├── Fee Structures           ← full CRUD (was Activities & Fees)
├── Payments
├── Commissions
│   ├── Commission Rules
│   ├── Commissions          (multi-step: on_hold → approved → paid)
│   ├── Travelling Allowances
│   └── Settlement           ← NEW
└── Withdrawals              ← NEW
```

---

## New Endpoints (Sessions, Assignments Overview, Batches per Society/School, Payments)

### Payments

```
GET /api/v1/admin/payments
GET /api/v1/admin/payments?service_type=personal_tutor|individual_coaching|group_coaching|school_student
GET /api/v1/admin/payments?status=captured|refunded|failed
GET /api/v1/admin/payments?user_id=5
GET /api/v1/admin/payments?from=2026-04-01&to=2026-04-30
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 10,
      "razorpay_order_id": "order_ABC123",
      "razorpay_payment_id": "pay_XYZ789",
      "service_type": "individual_coaching",
      "amount": 2500.00,
      "currency": "INR",
      "term_months": 3,
      "status": "captured",
      "captured_at": "2026-04-05T10:30:00Z",
      "user": { "id": 4, "full_name": "Arjun Sharma", "mobile": "9876543210" }
    }
  ]
}
```

**Payments page columns:** ID | User | Mobile | Service Type | Amount | Term | Status (badge) | Date

**Status badge colors:** `captured` → Green | `refunded` → Blue | `failed` → Red

---

### Students — Group Coaching & School Students

These are already served by the existing `/students` endpoint:

```
GET /api/v1/admin/students?type=group_coaching
GET /api/v1/admin/students?type=school_student
```

**Group Coaching response fields:** `individual_participant_id`, `student_name`, `mobile`, `activity`, `flat_no`, `dob`, `age`, `kits`, `society_id`, `society_name`

**School Students response fields:** `school_student_id`, `student_name`, `mobile`, `standard`, `activities`, `kit_type`, `school_id`, `school_name`, `created_at`

---

### Societies & Schools (registered list)

Already served by existing endpoints:

```
GET /api/v1/admin/societies          # all societies (approved + pending)
GET /api/v1/admin/societies/:id      # single society with all its students
GET /api/v1/admin/schools            # all schools
GET /api/v1/admin/schools/:id        # single school with all its students
```

**Societies page columns:** Name | Category (A+/A/B) | Address | Pin Code | Flats | Students | ME | Status | Created

**Schools page columns:** Name | Address | State | Principal | Contact | Students | ME | Status | Created

---

### Fee Structures (editable)

```
GET  /api/v1/admin/fee-structures?section=school|society|individual_coaching|personal_tutor
GET  /api/v1/admin/fee-structures/custom-categories?type=society|school   ← dropdown for society/school registration
POST /api/v1/admin/fee-structures                           # create new fee row (JSON)
PUT  /api/v1/admin/fee-structures/:id                       # edit existing fee row (JSON)
```

---

#### Fee Structures Page UX

Show tabs: **Society | School | Individual Coaching | Personal Tutor**

**Society & School tabs** — show an **activity card** for each activity. Inside each card, show fee rows grouped by category (A+, A, B, and any custom names). Each row = one term_months entry with total_fee and effective_monthly. Admin can **inline-edit** any existing row (PUT) and **add new rows** per category.

**"Add Custom Category" button** on Society and School tabs:
- Admin types a new category name (e.g. `"Green Acres Special"`)
- Then fills fees per term_month for each activity
- POST body:
```json
{
  "activity_id": 2,
  "coaching_type": "group_coaching",
  "society_category": "custom",
  "custom_category_name": "Green Acres Special",
  "term_months": 3,
  "total_fee": 4500,
  "effective_monthly": 1500
}
```
- For school: use `"coaching_type": "school_student"` instead
- `custom_category_name` is **required** when `society_category = "custom"` → 400 error otherwise

**GET response shape — `?section=society`:**
```json
[{
  "activity_id": 2,
  "activity_name": "Cricket",
  "by_category": {
    "A+": [{ "id": 10, "term_months": 3, "total_fee": 6000, "effective_monthly": 2000 }],
    "A":  [{ "id": 11, "term_months": 3, "total_fee": 5000, "effective_monthly": 1667 }],
    "B":  [{ "id": 12, "term_months": 3, "total_fee": 4000, "effective_monthly": 1333 }],
    "Green Acres Special": [{ "id": 31, "term_months": 3, "total_fee": 4500, "effective_monthly": 1500 }]
  }
}]
```

**GET response shape — `?section=school`:**
```json
[{
  "activity_id": 1,
  "activity_name": "Football",
  "by_category": {
    "default": [{ "id": 20, "term_months": 3, "total_fee": 7500, "effective_monthly": 2500 }],
    "Vidya Niketan Package": [{ "id": 35, "term_months": 6, "total_fee": 9000, "effective_monthly": 1500 }]
  }
}]
```
School fees without a custom category appear under key `"default"`.

**Custom categories dropdown** (used in society/school registration form):
```
GET /api/v1/admin/fee-structures/custom-categories?type=society
GET /api/v1/admin/fee-structures/custom-categories?type=school
```
Response:
```json
{ "success": true, "data": ["Green Acres Special", "Orchid Heights Deal"] }
```
Use this to populate the society_category dropdown in the Register Society / Register School forms. When admin selects one of these, set `societyCategory: "custom"` and pass the name separately (display only — stored in fee_structures, not in the society record itself).

**PUT body (edit existing row):**
```json
{ "total_fee": 3000, "effective_monthly": 1000 }
```

---

### Assignments Overview (read-only — no assign button here)

```
GET /api/v1/admin/student-assignments                              # both types
GET /api/v1/admin/student-assignments?service=personal_tutor
GET /api/v1/admin/student-assignments?service=individual_coaching
```

**Purpose:** Show all students with assigned/unassigned status. Admin uses this for visibility only. Actual session creation is done in Sessions section.

**Response (personal_tutor):**
```json
{
  "success": true,
  "data": [
    {
      "personal_tutor_id": 10,
      "student_id": 4,
      "student_name": "Arjun Sharma",
      "student_mobile": "9876543210",
      "standard": "8th",
      "batch": "Morning",
      "teacher_for": "Mathematics",
      "assigned": true,
      "assigned_teacher": {
        "professional_id": 2,
        "name": "Sunita Verma",
        "subject": "Mathematics"
      }
    }
  ]
}
```

---

### Sessions

```
GET  /api/v1/admin/sessions
GET  /api/v1/admin/sessions?type=personal_tutor|individual_coaching|group_coaching|school
GET  /api/v1/admin/sessions?status=scheduled|completed|cancelled
GET  /api/v1/admin/sessions?professional_id=5&from=2026-04-01&to=2026-04-30

POST /api/v1/admin/sessions
```

**POST body (personal_tutor session):**
```json
{
  "session_type": "personal_tutor",
  "date": "2026-04-10",
  "start_time": "10:00",
  "end_time": "11:00",
  "professional_id": 2,
  "student_id": 4,
  "activity_id": 3
}
```

**POST body (individual_coaching session):**
```json
{
  "session_type": "individual_coaching",
  "date": "2026-04-10",
  "start_time": "07:00",
  "end_time": "08:00",
  "professional_id": 5,
  "student_id": 7,
  "activity_id": 1
}
```

**POST body (group_coaching / school — batch-based):**
```json
{
  "session_type": "group_coaching",
  "date": "2026-04-10",
  "start_time": "06:00",
  "end_time": "07:00",
  "professional_id": 3,
  "batch_id": 1
}
```

**Error codes:**
- `400` → `MISSING_REQUIRED_FIELDS`

---

### Student Info for Session Creation Form

```
GET /api/v1/admin/sessions/student-info?type=personal_tutor&id=10
GET /api/v1/admin/sessions/student-info?type=individual_coaching&id=7
```

**Purpose:** When admin selects a student in the Create Session form, fetch their full details so the form can populate subject/activity dropdown and show student address.

**Response (personal_tutor):**
```json
{
  "success": true,
  "data": {
    "type": "personal_tutor",
    "personal_tutor_id": 10,
    "student_id": 4,
    "student_name": "Arjun Sharma",
    "student_mobile": "9876543210",
    "student_address": "B-204, Green Valley CHS, Pune",
    "standard": "8th",
    "subject": "Mathematics",
    "already_assigned_professional_id": 2
  }
}
```

**Response (individual_coaching):**
```json
{
  "success": true,
  "data": {
    "type": "individual_coaching",
    "individual_participant_id": 7,
    "student_id": 3,
    "student_name": "Riya Patel",
    "student_mobile": "9123456789",
    "student_address": "A-101, Meghratna CHS, Pune",
    "activity": "Cricket",
    "society_name": "Meghratna Residency",
    "society_address": "Survey No 45, Hadapsar, Pune",
    "already_assigned_professional_id": null
  }
}
```

**Errors:** `400` `type and id are required` | `404` `NOT_FOUND` | `400` `INVALID_TYPE`

---

### Professionals for Session Creation (with availability)

```
GET /api/v1/admin/professionals/for-session?type=teacher
GET /api/v1/admin/professionals/for-session?type=trainer
GET /api/v1/admin/professionals/for-session?type=teacher&date=2026-04-10&start_time=10:00&end_time=11:00&subject=Mathematics
GET /api/v1/admin/professionals/for-session?type=trainer&date=2026-04-10&start_time=07:00&end_time=08:00&activity=Cricket
```

**Purpose:** Dropdown list of teachers/trainers with `is_available` flag (green = available, red = busy at that slot). Optionally filter by subject (teachers) or activity (trainers).

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 2,
      "place": "Pune",
      "is_available": true,
      "users": { "full_name": "Sunita Verma", "mobile": "9988776655", "address": "Flat 3, ABC Society, Pune" },
      "teachers": [{ "subject": "Mathematics", "experience_details": "5 years" }],
      "trainers": []
    }
  ]
}
```

**UI note:** Show green dot next to available professionals, red dot next to busy ones. Also show the professional's address so admin can pick the nearest one to the student.

---

### Batches per Society

```
GET /api/v1/admin/societies/:id/batches
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 1,
      "batch_type": "group_coaching",
      "batch_name": "Rudra Bhai Society Morning",
      "days_of_week": ["Sat", "Sun"],
      "start_time": "...",
      "end_time": "...",
      "start_date": "2026-04-01",
      "end_date": "2026-09-30",
      "is_active": true,
      "activity": { "id": 3, "name": "Fun Games / Play Ground" },
      "professional": { "id": 5, "type": "trainer", "name": "harsh training" },
      "student_count": 12
    }
  ]
}
```

---

### Batches per School

```
GET /api/v1/admin/schools/:id/batches
```

Same response shape as society batches above.

---

## Session Creation UX Logic (for frontend)

### Create Session form flow:

1. Admin selects **Session Type** (personal_tutor | individual_coaching | group_coaching | school)

2. **For personal_tutor:**
   - Student dropdown: fetch from `GET /admin/student-assignments?service=personal_tutor` — only show unassigned students (`assigned: false`) OR all students
   - On student select → call `GET /admin/sessions/student-info?type=personal_tutor&id=X`
   - Show student address below dropdown
   - Subject dropdown auto-populates with the student's `teacher_for` field (only that one subject)
   - Professional dropdown: `GET /admin/professionals/for-session?type=teacher&subject=Mathematics&date=...&start_time=...&end_time=...`
   - Each professional shows green/red availability dot + their address

3. **For individual_coaching:**
   - Student dropdown: `GET /admin/student-assignments?service=individual_coaching` — unassigned
   - On student select → `GET /admin/sessions/student-info?type=individual_coaching&id=X`
   - Show student address + society address
   - Activity is pre-filled from student's `activity` field (read-only)
   - Professional dropdown: `GET /admin/professionals/for-session?type=trainer&activity=Cricket&date=...`
   - Show trainer address + availability dot

4. **For group_coaching / school:**
   - Admin selects a batch (from `GET /admin/societies/:id/batches` or `GET /admin/schools/:id/batches`)
   - Date, time, professional pre-fill from the batch data
   - Submit → `POST /admin/sessions`

---

## Admin Register Society / School

Admin can register societies and schools directly (bypassing the pending approval flow). ME referral code is optional.

### ME dropdown (for referral code picker)
```
GET /api/v1/admin/me-list
```
```json
{
  "success": true,
  "data": [
    { "professional_id": 3, "full_name": "Ravi Sharma", "referral_code": "ME-RS001" },
    { "professional_id": 7, "full_name": "Priya Mehta",  "referral_code": "ME-PM007" }
  ]
}
```
Show as dropdown: `"Ravi Sharma (ME-RS001)"`. Send `referral_code` in the form body.

### Register Society
```
POST /api/v1/admin/societies
Content-Type: multipart/form-data
```
| Field | Type | Notes |
|---|---|---|
| societyUniqueId | text | required |
| societyName | text | required |
| societyCategory | text | `A+`, `A`, `B`, or `custom` |
| address | text | |
| pinCode | text | |
| totalParticipants | text | |
| noOfFlats | text | |
| proposedWing | text | |
| authorityRole | text | |
| authorityPersonName | text | |
| contactNumber | text | |
| playgroundAvailable | text | `true`/`false` |
| coordinatorName | text | optional |
| coordinatorNumber | text | optional |
| agreementSignedByAuthority | text | `true`/`false` |
| activityAgreementPdf | file | PDF/image, max 10 MB |
| referral_code | text | optional — ME referral code from dropdown |

### Register School
```
POST /api/v1/admin/schools
Content-Type: multipart/form-data
```
| Field | Type | Notes |
|---|---|---|
| schoolName | text | required |
| address | text | |
| pinCode | text | |
| state | text | |
| languageMedium | text | optional |
| landlineNo | text | optional |
| principalName | text | required |
| principalContact | text | required |
| activityCoordinator | text | optional |
| agreementSignedByAuthority | text | `true`/`false` |
| activityAgreementPdf | file | PDF/image, max 10 MB |
| referral_code | text | optional — ME referral code from dropdown |

Both endpoints auto-approve the registration (no pending flow) and fire ME onboarding commission if a referral code is provided.

