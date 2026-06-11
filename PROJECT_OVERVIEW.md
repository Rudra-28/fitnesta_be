# Fitnesta — Project Overview (Quick Reference)

## What Is Fitnesta?

A **sports & fitness coaching platform** based in India. It connects students with coaching professionals and manages the entire lifecycle: registration, approval, assignment, sessions, payments, and commissions.

---

## User Roles

| Role | Description |
|------|-------------|
| **Student** | Enrolls in coaching services (group, individual, personal tutor, school) |
| **Trainer** | Coaches sports/fitness activities (Cricket, Karate, Yoga, etc.) |
| **Teacher** | Provides personal tutoring (Maths, Science, English, etc.) |
| **Vendor** | Sells sports kits/equipment through the platform |
| **Marketing Executive (ME)** | Registers societies/schools, earns referral commissions |
| **Admin / Sub-Admin** | Approves registrations, assigns professionals, manages platform |

---

## Coaching Types (Student Services)

| Type | Description | Assigned To |
|------|-------------|-------------|
| **Group Coaching** | Group sessions at a society, school, or other area | Trainer |
| **Individual Coaching** | 1-on-1 personal game coaching (sports) | Trainer |
| **Personal Tutor** | 1-on-1 academic tutoring | Teacher |
| **School Student** | Coaching within a registered school | Trainer |

---

## Core Business Flow

1. **Registration** — Professional/Student/Society/School submits a form → goes to `pending_registrations`
2. **Payment** — Student pays via Razorpay (before approval)
3. **Admin Approval** — Admin reviews and approves/rejects the registration
4. **Assignment** — Admin assigns a trainer/teacher to the student
5. **Batches & Sessions** — Admin creates batches, sessions are scheduled
6. **Commissions** — Auto-calculated on payment capture; admin marks as paid
7. **Travelling Allowances** — Daily ₹ for trainers doing group batches

---

## Tech Stack

- **Runtime:** Node.js + Express 5
- **Database:** MySQL via Prisma ORM
- **Auth:** JWT (mobile + role login, no password)
- **Payments:** Razorpay
- **File Storage:** Cloudinary
- **Push Notifications:** Firebase (FCM)
- **Scheduling:** node-cron (auto-complete sessions, mark absent)
- **Validation:** Joi
- **PDF Generation:** PDFKit (receipts)

---

## Project Structure

```
fitnesta/
├── index.js                    # Express app entry point (port 5000)
├── routes/v1/index.js          # All v1 API route mounting
├── config/                     # Prisma, Cloudinary, Firebase configs
├── middleware/                  # Auth middleware, duplicate checks
├── modules/
│   ├── auth/                   # Login/auth (JWT)
│   ├── admin/                  # Admin panel APIs (approve, assign, batches, sessions)
│   ├── professionals/
│   │   ├── trainer/            # Trainer registration + dashboard
│   │   ├── teacher/            # Teacher registration + dashboard
│   │   ├── marketingExe/       # ME registration + dashboard
│   │   └── vendor/             # Vendor registration + dashboard
│   ├── student/                # All student types (individual, personal tutor, school, society)
│   ├── activities/             # Activities CRUD
│   ├── payments/               # Razorpay integration
│   ├── commissions/            # Commission calculation (batch/IC/PT cycles)
│   ├── notifications/          # FCM push notifications
│   └── support/                # Support tickets
├── jobs/                       # Cron jobs (mark absent, auto-complete sessions)
├── database/                   # Raw SQL schema
└── generated/prisma/           # Prisma client output
```

---

## Key Database Tables

| Table | Purpose |
|-------|---------|
| `users` | All users (role: student/professional/admin) |
| `professionals` | Shared profile for all professional types |
| `trainers` / `teachers` / `marketing_executives` / `vendors` | Type-specific details |
| `students` | Student record with `student_type` |
| `individual_participants` | Individual coaching enrollments |
| `personal_tutors` | Personal tutor enrollments |
| `school_students` | School program enrollments |
| `societies` | Registered housing societies |
| `schools` | Registered schools |
| `pending_registrations` | All pending approval requests |
| `payments` | Razorpay payment records |
| `commissions` | Earned commissions (pending/paid) |
| `commission_rules` | Configurable commission rates |
| `travelling_allowances` | Daily trainer travel allowances |
| `wallets` | Professional wallet balances |
| `activities` | Master list of coaching activities |
| `fee_structures` | Pricing matrix (activity × coaching type × term) |
| `batches` / `sessions` | Scheduled coaching batches and sessions |
| `notifications` | Push notification records |

---

## API Base

```
http://localhost:5000/api/v1
```

All admin routes: `/api/v1/admin/...` (JWT required)

---

## Key Business Rules

- **No password auth** — Login is mobile number + role only
- **Payment before approval** — Student pays first, then admin approves registration
- **Society categories (A+/A/B)** affect group coaching pricing
- **ME referral codes** — MEs earn commissions when their referral code is used
- **Commission types:** ME gets % on admissions, Trainer gets 50-80% of fee, Teacher gets 80%
- **Travelling Allowance:** ₹50 for 1 batch/day, ₹100 for 2+ batches/day
- **Approval is irreversible** — creates real DB records (user, professional, student)
- **Term options:** 1, 3, or 6 months (school = 9 months)

---

## Mobile App

- Built with **Flutter** (Dart)
- Handles student/professional registration flows
- Separate **React admin panel** for web-based admin operations
