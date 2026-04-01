# Fitnesta Admin Panel — Claude Context File

Copy this file into your React project root as `CLAUDE.md` before starting development.

---

## What Is This Project?

This is the **web-based admin panel** for the Fitnesta app — a sports/fitness platform in India. The backend is Node.js + Express + Prisma + MySQL. The Flutter mobile app handles student/professional registrations. This admin panel is where an admin reviews/approves/rejects registrations, assigns teachers/trainers to students, and monitors the platform.

**Backend repo:** `c:\src\fitnesta`
**This panel:** Separate React frontend calling the Fitnesta backend REST API.

---

## Backend Base URL

```
http://localhost:5000/api/v1
```

All admin routes: `http://localhost:5000/api/v1/admin/...`
Every request needs: `Authorization: Bearer <token>` header.

---

## Auth

### Login
```
POST /api/v1/auth/login
Body: { "mobile": "9876543210", "role": "admin" }
```

**There is NO password.** Login is mobile + role only. Backend checks:
1. Mobile exists in `users` table
2. `approval_status` is `approved`
3. `role` matches
4. User exists in `admins` table

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

**Error codes:**
| error_code | HTTP | Meaning |
|---|---|---|
| `USER_NOT_FOUND` | 404 | Mobile not in DB |
| `ROLE_MISMATCH` | 403 | Mobile exists but wrong role |
| `APPROVAL_PENDING` | 403 | Admin not yet approved |
| `REGISTRATION_REJECTED` | 403 | Admin rejected |

**Login page:** Single mobile number input only. Role is hardcoded `"admin"` — no dropdown.

**Token storage:** Store JWT as `adminToken` in `localStorage` + Zustand. Expires in 7 days.

---

## Axios Setup

```js
// src/api/axios.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api/v1',
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

## All Admin API Endpoints

### 1. Pending Registrations

**Who appears here — IMPORTANT:**

| Type | Needs admin approval? | Reason |
|---|---|---|
| `trainer` | YES | Professional — admin verifies documents |
| `teacher` | YES | Professional — admin verifies documents |
| `vendor` | YES | Professional — admin verifies documents |
| `marketing_executive` | YES | Professional — admin verifies documents |
| `society_request` | YES | Society registration request — admin assigns an ME for a visit |
| `personal_tutor` | NO | Student pays Razorpay → registered automatically |
| `individual_coaching` | NO | Student pays Razorpay → registered automatically |

**Students never appear in Pending Approvals.** After payment they go directly into the Students list.

```
GET  /api/v1/admin/pending                           # all (professionals only — society requests have their own endpoints)
GET  /api/v1/admin/pending?type=trainer
GET  /api/v1/admin/pending?type=teacher
GET  /api/v1/admin/pending?type=vendor
GET  /api/v1/admin/pending?type=marketing_executive
GET  /api/v1/admin/pending/:id

POST /api/v1/admin/approve/:id    body: { note?: string }
POST /api/v1/admin/reject/:id     body: { note?: string }
```

**GET /pending response:**
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
      "formData": { }
    }
  ]
}
```

**formData fields per type (camelCase as Flutter sends them):**

| service_type | Key fields in formData |
|---|---|
| `trainer` | `fullName`, `contactNumber`, `dob`, `category`, `specifiedGame`, `place`, `experienceDetails`, `panCard`, `adharCard` |
| `teacher` | `fullName`, `contactNumber`, `dob`, `subject`, `experienceDetails`, `panCard`, `adharCard` |
| `vendor` | `fullName`, `contactNumber`, `storeName`, `storeAddress`, `storeLocation`, `GSTCertificate` |
| `marketing_executive` | `fullName`, `contactNumber`, `dob`, `educationQualification`, `previousExperience`, `panCard`, `adharCard` |

**Error codes for approve/reject:**
- `404` → `PENDING_NOT_FOUND`
- `409` → `ALREADY_REVIEWED`

---

### 2. Society Requests (Separate from Professional Pending)

When a user submits a society registration from the Flutter app, it creates a `society_request`. The admin reviews it and **assigns a Marketing Executive** to visit the society.

**Flow:**
1. User submits society form → `society_request` created in DB
2. Admin views pending society requests
3. Admin fetches ME list and picks one
4. Admin assigns the ME → request records `assigned_me_id` + `assigned_me_at` (status stays `pending`)
5. Admin can then approve or reject after ME visits

**Endpoints:**

```
GET  /api/v1/society/admin/requests/pending          # list all pending society_request entries
GET  /api/v1/society/admin/me-list                   # list all approved MEs to pick from

POST /api/v1/society/admin/requests/:id/assign-me    body: { me_professional_id: number }
POST /api/v1/society/admin/requests/approve/:id      body: { note?: string }
POST /api/v1/society/admin/requests/reject/:id       body: { note?: string }
```

**GET /society/admin/requests/pending response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 12,
      "tempUuid": "uuid-xxx",
      "serviceType": "society_request",
      "submittedAt": "2026-04-01T10:00:00Z",
      "assignedMeId": null,
      "assignedMeAt": null,
      "formData": {
        "societyUniqueId": "SOC001",
        "societyName": "Green Valley Society",
        "societyCategory": "A",
        "address": "123 Main Road, Andheri West",
        "pinCode": "400053",
        "totalParticipants": 150,
        "noOfFlats": 80,
        "proposedWing": "A",
        "authorityRole": "Secretary",
        "authorityPersonName": "Rajesh Kumar",
        "contactNumber": "9876543210",
        "playgroundAvailable": true
      }
    }
  ]
}
```

**GET /society/admin/me-list response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "professional_id": 4,
      "name": "Rahul Mehta",
      "mobile": "9876543210",
      "referral_code": "FIT-ABC12345"
    }
  ]
}
```

**POST assign-me** — assigns an ME to the request (does NOT change `status`):
```json
{ "me_professional_id": 4 }
```
Response: `{ "success": true, "message": "ME assigned to society request successfully." }`

After assignment, `assignedMeId` will be set when you re-fetch the list. ME goes for a visit. Once visit is done, admin calls approve/reject.

**Error codes:**
- `400` → `me_professional_id` missing or request is not a `society_request`
- `404` → request not found or ME not found
- `409` → request already approved/rejected

---

### 3. Approved Professionals List

```
GET /api/v1/admin/professionals                           # all 4 types
GET /api/v1/admin/professionals?type=trainer
GET /api/v1/admin/professionals?type=teacher
GET /api/v1/admin/professionals?type=marketing_executive
GET /api/v1/admin/professionals?type=vendor
```

**Response:**
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
        "address": "Flat 12, Pune",
        "photo": "https://res.cloudinary.com/.../photo.jpg",
        "created_at": "2026-03-31T10:00:00Z"
      },
      "details": {
        "dob": "1995-08-15",
        "education_qualification": "B.Com",
        "previous_experience": "2 years sales",
        "activity_agreement_pdf": "https://res.cloudinary.com/.../agreement.pdf"
      }
    }
  ]
}
```

**`details` field per type:**

| profession_type | details fields |
|---|---|
| `trainer` | `player_level`, `category`, `specified_game` (array), `specified_skills` (array), `experience_details`, `qualification_docs`, `documents` |
| `teacher` | `subject`, `experience_details`, `ded_doc`, `bed_doc`, `other_doc` |
| `marketing_executive` | `dob`, `education_qualification`, `previous_experience`, `activity_agreement_pdf` |
| `vendor` | `store_name`, `store_address`, `store_location`, `gst_certificate` |

---

### 4. Students List (All — Assigned + Unassigned)

```
GET /api/v1/admin/students?type=personal_tutor
GET /api/v1/admin/students?type=individual_coaching
```

Returns ALL students with their current assignment status. Use this for both the Students page (full list) and the Assignments page (filter client-side where `assigned === false`).

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

**Error:** `400` → `INVALID_TYPE`

---

### 5. Assignment Endpoints

```
GET  /api/v1/admin/professionals/available?type=teacher
GET  /api/v1/admin/professionals/available?type=trainer

POST /api/v1/admin/assign/teacher
     body: { personal_tutor_id: number, teacher_professional_id: number }

POST /api/v1/admin/assign/trainer
     body: { individual_participant_id: number, trainer_professional_id: number }
```

**GET /professionals/available?type=teacher response:**
```json
{
  "data": [
    {
      "professional_id": 2,
      "full_name": "Sunita Verma",
      "mobile": "9988776655",
      "subject": "Mathematics",
      "experience": "5 years teaching"
    }
  ]
}
```

**GET /professionals/available?type=trainer response:**
```json
{
  "data": [
    {
      "professional_id": 3,
      "full_name": "Rahul Nair",
      "mobile": "9876541230",
      "category": "Sports",
      "specified_game": ["Cricket", "Football"],
      "experience": "3 years coaching"
    }
  ]
}
```

**POST assign errors:**
- `404` → `PERSONAL_TUTOR_NOT_FOUND` / `INDIVIDUAL_PARTICIPANT_NOT_FOUND` / `TEACHER_NOT_FOUND` / `TRAINER_NOT_FOUND`

---

### 6. Fee Structures

```
GET /api/v1/admin/fee-structures                               # all sections in one response
GET /api/v1/admin/fee-structures?section=school
GET /api/v1/admin/fee-structures?section=society
GET /api/v1/admin/fee-structures?section=individual_coaching
GET /api/v1/admin/fee-structures?section=personal_tutor
```

**Error:** `400` → `INVALID_SECTION`

**Response `?section=school`** — flat per activity:
```json
{
  "success": true,
  "data": [
    {
      "activity_id": 1,
      "activity_name": "Cricket",
      "fees": [
        { "coaching_type": "school_student", "society_category": null, "standard": null, "term_months": 1, "total_fee": 800, "effective_monthly": 800 },
        { "coaching_type": "school_student", "society_category": null, "standard": null, "term_months": 3, "total_fee": 2200, "effective_monthly": 733.33 }
      ]
    }
  ]
}
```

**Response `?section=society`** — grouped by activity → by society category (A+/A/B):
```json
{
  "success": true,
  "data": [
    {
      "activity_id": 1,
      "activity_name": "Cricket",
      "by_category": {
        "A+": [
          { "term_months": 1, "total_fee": 1200, "effective_monthly": 1200 },
          { "term_months": 3, "total_fee": 3300, "effective_monthly": 1100 }
        ],
        "A": [ { "term_months": 1, "total_fee": 1000, "effective_monthly": 1000 } ],
        "B": [ { "term_months": 1, "total_fee": 800, "effective_monthly": 800 } ]
      }
    }
  ]
}
```

**Response `?section=individual_coaching`** — flat per activity (same shape as school):
```json
{
  "success": true,
  "data": [
    {
      "activity_id": 1,
      "activity_name": "Cricket",
      "fees": [
        { "coaching_type": "individual_coaching", "society_category": null, "standard": null, "term_months": 1, "total_fee": 1500, "effective_monthly": 1500 }
      ]
    }
  ]
}
```

**Response `?section=personal_tutor`** — grouped by activity → by standard:
```json
{
  "success": true,
  "data": [
    {
      "activity_id": 2,
      "activity_name": "Mathematics",
      "by_standard": {
        "1ST-2ND": [ { "term_months": 1, "total_fee": 600, "effective_monthly": 600 } ],
        "3RD-4TH": [ { "term_months": 1, "total_fee": 700, "effective_monthly": 700 } ],
        "5TH-6TH": [ { "term_months": 1, "total_fee": 800, "effective_monthly": 800 } ],
        "7TH-8TH": [ { "term_months": 1, "total_fee": 900, "effective_monthly": 900 } ],
        "8TH-10TH": [ { "term_months": 1, "total_fee": 1000, "effective_monthly": 1000 } ]
      }
    }
  ]
}
```

**Valid standard values:** `1ST-2ND` | `3RD-4TH` | `5TH-6TH` | `7TH-8TH` | `8TH-10TH` | `ANY`

**Response — no section param** — all four sections in one object:
```json
{
  "success": true,
  "data": {
    "school": [ { "activity_id": 1, "activity_name": "Cricket", "fees": [...] } ],
    "society": [ { "activity_id": 1, "activity_name": "Cricket", "by_category": { "A+": [...] } } ],
    "individual_coaching": [ { "activity_id": 1, "activity_name": "Cricket", "fees": [...] } ],
    "personal_tutor": [ { "activity_id": 2, "activity_name": "Mathematics", "by_standard": { "1ST-2ND": [...] } } ]
  }
}
```

---

### 7. Commission Rules

```
GET /api/v1/admin/commission-rules
PUT /api/v1/admin/commission-rules/:ruleKey    body: { value: 80 }
```

**GET response:**
```json
{
  "success": true,
  "count": 16,
  "data": [
    {
      "id": 1,
      "rule_key": "trainer_personal_coaching_rate",
      "professional_type": "trainer",
      "description": "Trainer earns this % of the fee for Personal Game Coaching",
      "rule_type": "percentage",
      "value": "80.00",
      "updated_at": "2026-03-31T10:00:00Z"
    }
  ]
}
```

**PUT error:** `404` → `RULE_NOT_FOUND`

**All 16 rule keys:**

| rule_key | professional_type | rule_type | Default | Meaning |
|---|---|---|---|---|
| `trainer_personal_coaching_rate` | trainer | percentage | 80 | % of fee for individual coaching |
| `trainer_group_society_rate` | trainer | percentage | 50 | % of fee for group coaching in society (10+ students) |
| `trainer_group_society_min_students` | trainer | flat | 10 | Student threshold below which flat rate applies |
| `trainer_group_society_flat_amount` | trainer | flat | 300 | Flat ₹ per session when below min students |
| `trainer_group_school_rate` | trainer | percentage | 45 | % of fee for group coaching in school |
| `teacher_personal_tutor_rate` | teacher | percentage | 80 | % of fee for personal tutor service |
| `me_group_admission_rate` | marketing_executive | percentage | 5 | % per group coaching admission |
| `me_personal_coaching_admission_rate` | marketing_executive | percentage | 2 | % per individual coaching admission |
| `me_personal_tutor_admission_rate` | marketing_executive | percentage | 2 | % per personal tutor admission |
| `me_society_above_100_flats` | marketing_executive | flat | 1111 | One-time ₹ for society with 100+ flats |
| `me_society_50_to_100_flats` | marketing_executive | flat | 500 | One-time ₹ for society with 50–100 flats |
| `me_society_below_50_flats` | marketing_executive | flat | 300 | One-time ₹ for society with <50 flats |
| `me_school_registration` | marketing_executive | flat | 1111 | One-time ₹ for registering a school |
| `me_min_live_activities` | marketing_executive | flat | 2 | Min active activities for ME to be eligible |
| `ta_1_batch_amount` | trainer | flat | 50 | Daily TA for trainer with exactly 1 group batch |
| `ta_2_plus_batches_amount` | trainer | flat | 100 | Daily TA cap for trainer with 2+ batches |

**UI note:** `rule_type: percentage` → show `%` suffix. `rule_type: flat` → show `₹` prefix.

---

### 8. Commissions

```
GET   /api/v1/admin/commissions
PATCH /api/v1/admin/commissions/:id/mark-paid
```

**GET query params (all optional):**
| Param | Values |
|---|---|
| `professional_type` | `trainer` \| `teacher` \| `marketing_executive` |
| `status` | `pending` \| `paid` |
| `professional_id` | number |

**GET response:**
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

**source_type values:**
| source_type | Who gets it | What triggered it |
|---|---|---|
| `individual_coaching` | trainer or ME | Personal game coaching payment |
| `group_coaching_society` | trainer or ME | Group coaching in a society |
| `group_coaching_school` | trainer | Group coaching in a school |
| `personal_tutor` | teacher or ME | Personal tutor payment |
| `school_registration` | marketing_executive | Admin approved a school |

**PATCH mark-paid** — no body needed. Response: `{ "success": true, "data": { ...updated row } }`

**PATCH errors:** `404` → `COMMISSION_NOT_FOUND` | `409` → `ALREADY_PAID`

---

### 9. Travelling Allowances

```
GET   /api/v1/admin/travelling-allowances
PATCH /api/v1/admin/travelling-allowances/:id/mark-paid
```

**GET query params (all optional):**
| Param | Values |
|---|---|
| `trainer_professional_id` | number |
| `status` | `pending` \| `paid` |

**GET response:**
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

**PATCH mark-paid** — no body needed.

**PATCH errors:** `404` → `TA_NOT_FOUND` | `409` → `ALREADY_PAID`

---

## Database Models

**`pending_registrations`** — registrations awaiting admin action
- `id`, `temp_uuid`, `form_data` (JSON), `service_type`, `status` (pending/approved/rejected)
- `reviewed_by`, `review_note`, `reviewed_at`, `created_at`

**`users`** — all users
- `id`, `uuid`, `role`, `subrole`, `full_name`, `mobile`, `email`, `address`, `photo`
- `approval_status` (pending/approved/rejected), `is_verified`, `created_at`

**`professionals`** — trainers, teachers, MEs, vendors
- `id`, `user_id`, `profession_type` (trainer/teacher/marketing_executive/vendor)
- `referral_code`, `pan_card`, `adhar_card`, `relative_name`, `relative_contact`
- `own_two_wheeler`, `communication_languages`, `place`, `date`

**`trainers`** — `professional_id`, `player_level`, `category`, `specified_game` (JSON), `specified_skills` (JSON), `experience_details`, `qualification_docs`, `documents`

**`teachers`** — `professional_id`, `subject`, `experience_details`, `ded_doc`, `bed_doc`, `other_doc`

**`marketing_executives`** — `professional_id`, `dob`, `education_qualification`, `previous_experience`, `activity_agreement_pdf`

**`vendors`** — `professional_id`, `store_name`, `store_address`, `store_location`, `gst_certificate`

**`students`** — `id`, `user_id`, `student_type` (group_coaching/individual_coaching/personal_tutor/school_student)

**`personal_tutors`** — `id`, `student_id`, `dob`, `standard`, `batch`, `teacher_for`, `teacher_professional_id` (null = unassigned)

**`individual_participants`** — `id`, `student_id`, `mobile`, `flat_no`, `dob`, `age`, `society_id`, `society_name`, `activity`, `kits`, `trainer_professional_id` (null = unassigned)

**`school_students`** — `id`, `student_id`, `school_id`, `student_name`, `standard`, `activities`, `kit_type`

**`societies`** — `id`, `society_unique_id`, `society_name`, `society_category` (A+/A/B), `address`, `pin_code`, `total_participants`, `no_of_flats`, `authority_person_name`, `contact_number`, `coordinator_name`, `me_professional_id`, `approval_status`, `playground_available`

**`schools`** — `id`, `school_name`, `address`, `pin_code`, `state`, `language_medium`, `principal_name`, `principal_contact`, `activity_coordinator`, `me_professional_id`, `approval_status`

**`payments`** — `id`, `temp_uuid`, `razorpay_order_id`, `razorpay_payment_id`, `service_type`, `amount`, `currency`, `term_months` (1/3/6/9), `status` (captured/refunded/failed), `student_user_id`, `captured_at`

**`commissions`** — `id`, `professional_id`, `professional_type`, `source_type`, `base_amount`, `commission_rate`, `commission_amount`, `status` (pending/paid), `created_at`

**`wallets`** — `professional_id` (unique), `balance`, `updated_at`

**`travelling_allowances`** — `trainer_professional_id`, `allowance_date`, `batches_count`, `amount`, `status` (pending/paid)

**`activities`** — `id`, `name`, `notes`, `is_active`

**`fee_structures`** — `activity_id`, `coaching_type`, `society_category` (A+/A/B, nullable), `standard` (nullable), `term_months`, `total_fee`, `effective_monthly`

**`commission_rules`** — `id`, `rule_key` (unique), `professional_type`, `description`, `rule_type`, `value`, `updated_at`

---

## Tech Stack

- **React 18** + **Vite**
- **TailwindCSS** + **shadcn/ui**
- **TanStack Query v5** for data fetching, caching, mutations
- **React Router v6**
- **Axios** with auth interceptor
- **React Hook Form**
- **Zustand** for auth state
- **Sonner** for toast notifications (NOT the deprecated `toast` component)

---

## Project Folder Structure

```
src/
├── api/
│   ├── axios.js          # axios instance with base URL + auth interceptor
│   └── admin.js          # all admin API call functions
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── Layout.jsx        # sidebar + topbar wrapper
│   ├── Sidebar.jsx
│   └── StatusBadge.jsx   # reusable pending/approved/rejected/paid badge
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── PendingApprovals.jsx
│   ├── Assignments.jsx
│   ├── Professionals.jsx
│   ├── Students.jsx
│   ├── FeeStructures.jsx
│   ├── Societies.jsx
│   ├── Schools.jsx
│   ├── Payments.jsx
│   └── Commissions.jsx      # tabs: Commission Rules | Commissions | Travelling Allowances
├── store/
│   └── authStore.js
├── hooks/
│   └── useAdmin.js
└── App.jsx
```

---

## Sidebar Navigation

```
Fitnesta Admin
├── Dashboard
├── Pending Approvals      ← red badge with count (professionals only)
├── Society Requests       ← separate badge with pending count
├── Assignments
├── Professionals
│   ├── Trainers
│   ├── Teachers
│   ├── Marketing Executives
│   └── Vendors
├── Students
│   ├── Individual Coaching
│   └── Personal Tutor
├── Fee Structures
├── Commissions            ← tabs: Rules | Commissions | Travelling Allowances
├── Societies
├── Schools
└── Payments
```

---

## Build Order

| Phase | Pages | API used |
|---|---|---|
| 1 | Login + Pending Approvals | `/auth/login`, `/admin/pending`, `/admin/approve`, `/admin/reject` |
| 2 | Society Requests | `/society/admin/requests/pending`, `/society/admin/me-list`, `/society/admin/requests/:id/assign-me`, approve, reject |
| 3 | Assignments | `/admin/students?type=...`, `/admin/professionals/available`, `/admin/assign/teacher`, `/admin/assign/trainer` |
| 4 | Dashboard | counts from existing endpoints |
| 5 | Professionals | `/admin/professionals?type=...` |
| 6 | Students | `/admin/students?type=...` |
| 7 | Fee Structures | `/admin/fee-structures?section=...` |
| 8 | Commissions | `/admin/commission-rules`, `/admin/commissions`, `/admin/travelling-allowances` |
| 9 | Societies, Schools, Payments | (read-only views from DB) |

---

## Page Specs

### Pending Approvals (Phase 1)

**Filter tabs:** All | Trainer | Teacher | Vendor | Marketing Executive

**Do NOT add Society Request, Personal Tutor, or Individual Coaching tabs here.** Society requests have their own dedicated page (see Society Requests page spec below).

**Table:** ID | Type badge | Name | Mobile | Submitted date | Actions (View / Approve / Reject)

**"View" button** → right-side drawer with all `formData` fields rendered as clean key-value pairs — NOT raw JSON.

**"Approve" / "Reject"** → confirmation modal with optional note input → POST to approve/reject endpoint → row disappears with sonner toast.

---

### Society Requests (Phase 2)

Separate page — **not** part of Pending Approvals.

**Page layout:**
- Table: ID | Society Name | Category | Authority | Contact | Flats | Submitted At | Assigned ME | Status badge | Actions
- "View" → right drawer showing all `formData` fields as key-value pairs
- "Assign ME" button (always visible while status is `pending`) → opens a modal:
  - Fetches `GET /society/admin/me-list` and shows a dropdown of ME names + mobile
  - Confirm → `POST /society/admin/requests/:id/assign-me` with `{ me_professional_id }`
  - On success: row updates to show the assigned ME name + assigned time (re-fetch list)
- "Approve" / "Reject" → confirmation modal with optional note → `POST /society/admin/requests/approve/:id` or `reject/:id`
- Rows where `assignedMeId !== null` → show the ME name in the "Assigned ME" column (you can look up the name from the already-fetched ME list)

**Data source for ME name in table:** After fetching `me-list`, build a `Map<professional_id, name>` and use it to resolve `assignedMeId` → name.

---

### Assignments (Phase 3)

**Two tabs: "Assign Teacher" | "Assign Trainer"**

**Assign Teacher tab:**
- Call `GET /admin/students?type=personal_tutor` and filter client-side where `assigned === false`
- Left panel: unassigned students table (Name, Mobile, Standard, Batch, Teacher For, DOB) — click to select
- Right panel: call `GET /admin/professionals/available?type=teacher` (Name, Mobile, Subject, Experience) — click to select
- "Assign" button enabled only when both selected → `POST /admin/assign/teacher` with `{ personal_tutor_id, teacher_professional_id }`

**Assign Trainer tab:**
- Call `GET /admin/students?type=individual_coaching` filtered where `assigned === false`
- Left: students (Name, Mobile, Activity, Society, DOB) — click to select
- Right: `GET /admin/professionals/available?type=trainer` (Name, Mobile, Category, Game) — click to select
- → `POST /admin/assign/trainer` with `{ individual_participant_id, trainer_professional_id }`

---

### Students (Phase 6)

**Two tabs: "Individual Coaching" | "Personal Tutor"**

Uses `GET /admin/students?type=...` for each tab.

**Individual Coaching columns:** Name | Mobile | Activity | Society | Flat No | Age | Kits | Assigned badge | Trainer name

**Personal Tutor columns:** Name | Mobile | Standard | Batch | Subject Needed | DOB | Assigned badge | Teacher name

**Badge:** `assigned: true` → green "Assigned" | `assigned: false` → amber "Unassigned"

---

### Professionals (Phase 5)

**Four tabs: Trainers | Teachers | Marketing Executives | Vendors**

Uses `GET /admin/professionals?type=...` for each tab.

Each row: photo, name, mobile, type-specific detail (subject for teacher, category for trainer, store for vendor), wallet balance.

"View" → detail drawer with all fields + document links (Aadhar, PAN as clickable links).

---

### Fee Structures (Phase 6)

**Four tabs: School | Society | Individual Coaching | Personal Tutor**

Uses `GET /admin/fee-structures?section=...` per tab.

- **School tab:** One card per activity → table: Term | Total Fee | Monthly Effective
- **Society tab:** One card per activity → sub-sections for A+, A, B → table per category
- **Individual Coaching tab:** Same as school — one card per activity with fee table
- **Personal Tutor tab:** One card per activity (subject) → sub-sections per standard range

**Read-only** — no editing for now.

---

### Commissions (Phase 7)

**Three tabs: "Commission Rules" | "Commissions" | "Travelling Allowances"**

**Commission Rules tab:**
- Table of all 16 rules grouped by professional_type
- `rule_type: percentage` → show `%` suffix | `rule_type: flat` → show `₹` prefix
- Inline editable value per row → "Save" button → `PUT /admin/commission-rules/:ruleKey`

**Commissions tab:**
- Filters: Professional Type dropdown, Status dropdown
- Columns: ID | Professional | Type | Source | Base ₹ | Rate | Commission ₹ | Status | Date | Action
- "Mark Paid" button only on `status === 'pending'` rows → `PATCH /admin/commissions/:id/mark-paid`

**Travelling Allowances tab:**
- Filters: Status dropdown, Trainer ID input
- Columns: ID | Trainer | Date | Batches | Amount ₹ | Status | Action
- "Mark Paid" only on pending → `PATCH /admin/travelling-allowances/:id/mark-paid`

---

## Status Badge Colors

| Status | Color |
|---|---|
| `pending` | Amber |
| `approved` / `captured` / `paid` | Green |
| `rejected` / `failed` | Red |
| `refunded` | Blue |

## Service Type Badge Colors

| Type | Color |
|---|---|
| `trainer` | Blue |
| `teacher` | Purple |
| `vendor` | Orange |
| `marketing_executive` | Teal |
| `society_request` | Pink |

---

## Key Business Logic

1. **Approving a pending registration** creates actual DB records — it is irreversible. Always show a confirmation dialog before approving.

2. **Student registrations (personal_tutor, individual_coaching)** are NOT in Pending Approvals. They pay via Razorpay first and are registered automatically. They appear only in the Students page waiting for trainer/teacher assignment.

3. **Available professionals** (`/professionals/available`) only returns those with `users.approval_status = 'approved'` — safe to display directly.

4. **Society category** (A+/A/B) affects group coaching fees. A+ is the highest fee tier.

5. **ME referral code** — each ME has a unique `referral_code` (e.g. `FIT-ABC12345`). This is shown in the ME list when assigning an ME to a society request.

6. **Payments** are recorded BEFORE admin approval. Student pays → payment recorded → admin approves registration. Payment records are permanent.

7. **Commissions** are created automatically when a payment is captured. Admin marks them `paid` manually.

8. **Wallet balance** on a professional is the lifetime total of all commissions ever earned — it does NOT decrease when a commission is marked paid.

9. **`communication_languages`** comes from the DB as a JSON string `"[\"Hindi\",\"Marathi\"]"` — parse it with `JSON.parse()` before displaying.

---

## Out of Scope (Do Not Build Yet)

- Vendor product management (`vendor_products` table)
- Parent consent forms
- Trainer batch scheduling (`trainer_batches`)
- Other areas module
- School students view
- Any fee editing
