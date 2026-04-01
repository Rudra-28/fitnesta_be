# Fitnesta — Payment & Registration Workflow

## Overview

Every student registration follows the same 3-phase pattern:

```
Phase 1 — Submit form  →  backend parks data + creates Razorpay order
Phase 2 — Pay          →  Razorpay SDK opens in Flutter; user pays
Phase 3 — Verify       →  Flutter POSTs signature; backend finalizes + returns JWT
```

Flutter then polls the status endpoint until `isCompleted: true` comes back with the JWT.

> **Current status:** Razorpay test keys are configured. Webhook URL is not yet registered on the Razorpay Dashboard.
> While testing locally, use the `DEV_SKIP_PAYMENT` bypass flow (see [Dev Testing](#dev-testing--bypass-razorpay) below) to verify the full DB flow without going through the Razorpay SDK.

---

## Base URL

```
https://<host>/api/v1
```

---

## Phase 1 — Registration Endpoints

### Flow 1 & 2 — Individual Coaching (Group Coaching / Personal Sports)

```
POST /api/v1/individual-coaching/send-IC
Content-Type: multipart/form-data
```

Both flows (society group coaching and personal sports 1-on-1) hit this same endpoint.
The `coaching_type` field differentiates them for fee lookup.

**Required fields:**

| Field | Type | Notes |
|-------|------|-------|
| `fullName` or `participantName` | string | Either is accepted |
| `contactNumber` or `mobileNo` | string | 10-digit mobile |
| `flat_no` | string | |
| `dob` | string | YYYY-MM-DD or DD/MM/YYYY |
| `age` | int | Auto-calculated on Flutter side |
| `society_name` | string | From dropdown or typed |
| `society_id` | int | Only if selecting a registered society |
| `activity_ids` | int[] | Array even if single activity |
| `activity_id` | int | First/primary activity ID |
| `activity_enrolled` | string | Comma-separated activity names |
| `term_months` | int | 1, 3, or 6 |
| `coaching_type` | string | **`"group_coaching"` for Flow 1, `"individual_coaching"` for Flow 2** |

**Consent fields (only if age < 18):**

| Field | Type | Notes |
|-------|------|-------|
| `parentName` | string | Guardian name |
| `emergencyContactNo` | string | 10-digit |
| `consent_date` | string | YYYY-MM-DD |
| `signatureUrl` | file | PDF — multipart file upload |

**Response:**

```json
{
  "success": true,
  "message": "Registration parked. Complete payment to confirm.",
  "temp_uuid": "uuid-string",
  "order_id": "order_xxx",
  "amount": 5000,
  "currency": "INR",
  "key_id": "rzp_live_xxx"
}
```

---

### Flow 3 — School Student

```
POST /api/v1/school-student/submit
Content-Type: application/json
```

No consent screen. Term is always 9 months (fixed). Middleware checks mobile is not already registered.

**Required fields:**

| Field | Type | Notes |
|-------|------|-------|
| `mobile` | string | 10-digit |
| `fullName` | string | |
| `schoolName` | string | Must match a school in the system |
| `standard` | string | e.g. "5th", "6th" |
| `address` | string | |
| `activity_ids` | int[] | Array of activity IDs |

**Response:** Same shape as above — `temp_uuid`, `order_id`, `amount`, `currency`, `key_id`.

---

### Flow 4 — Personal Tutor

```
POST /api/v1/personal-tutor/send-PT
Content-Type: multipart/form-data  (if age < 18, contains signature PDF)
             application/json       (if age >= 18)
```

**Required fields:**

| Field | Type | Notes |
|-------|------|-------|
| `fullName` | string | |
| `contactNumber` or `mobile` | string | 10-digit |
| `address` | string | |
| `dob` | string | YYYY-MM-DD |
| `standard` | string | Grade bracket — used for fee lookup |
| `batch` | string | Morning / Afternoon / Evening / Weekend |
| `teacherFor` | string | Subject name |
| `activity_ids` | int[] | Array of activity IDs (one per subject) |
| `term_months` | int | 1 or 3 |

**Consent fields (only if age < 18):**

| Field | Type | Notes |
|-------|------|-------|
| `parentName` | string | |
| `emergencyContactNo` | string | |
| `society_name` | string | |
| `activity_enrolled` | string | |
| `consent_date` | string | YYYY-MM-DD |
| `signatureUrl` | file | PDF — multipart file upload |

**Response:** Same shape — `temp_uuid`, `order_id`, `amount`, `currency`, `key_id`.

---

## Phase 2 — Razorpay Checkout

> **Not active yet** — webhook URL not registered on Razorpay Dashboard.
> Use the [dev bypass](#dev-testing--bypass-razorpay) during local testing instead.

Flutter opens the Razorpay SDK with:

```dart
{
  "key": key_id,          // from Phase 1 response
  "order_id": order_id,   // from Phase 1 response
  "amount": amount * 100, // paise
  "name": "Fitnesta",
  "prefill": { "contact": mobile }
}
```

The Razorpay SDK returns three strings on success:
- `razorpay_order_id`
- `razorpay_payment_id`
- `razorpay_signature`

---

## Phase 3 — Verify Payment

```
POST /api/v1/payments/verify
Content-Type: application/json
```

**Request body:**

```json
{
  "temp_uuid": "uuid-string",
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "hex_string"
}
```

**What the backend does:**
1. Validates all 4 fields are present.
2. Recomputes `HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)` and compares with the provided signature using `timingSafeEqual`.
3. Looks up `pending_registrations` by `temp_uuid` to get `service_type`.
4. Reads `calculated_amount` stored during Phase 1 (used for payment record + commission).
5. Calls `finalizeRegistration` for the correct service — creates user, student, and payment rows inside a transaction.
6. Marks `pending_registrations.status = "approved"`.

**Response (success):**

```json
{
  "success": true,
  "message": "Payment verified and registration finalized"
}
```

**Response (invalid signature):**

```json
{
  "success": false,
  "message": "Invalid payment signature"
}
```

---

## Phase 3 (backup) — Razorpay Webhook

```
POST /api/v1/payments/webhook
```

> **Pending setup** — code is ready. Once live Razorpay keys arrive, register this URL in the Razorpay Dashboard under Webhooks with the `RAZORPAY_WEBHOOK_SECRET` from `.env`. Select the `payment.captured` event only.

Razorpay calls this server-side for every `payment.captured` event.
Configure once in the Razorpay Dashboard — no Flutter interaction needed.

- Validates `x-razorpay-signature` header against `req.rawBody`.
- Reads `temp_uuid` and `service_type` from `entity.notes` (embedded at order creation time).
- Calls the same `finalizeRegistration` path with the real amount from `entity.amount / 100`.
- Always returns HTTP 200 so Razorpay stops retrying.

The webhook is a safety net — if Flutter's `/verify` call already finalized the registration, `getPendingByUuid` returns null (status is no longer `"pending"`) and the webhook is a no-op.

---

## Phase 4 — Status Poll (Flutter polls until JWT)

Flutter polls every 2 seconds, up to 10 attempts.

### Individual Coaching / Group Coaching
```
GET /api/v1/individual-coaching/status/:temp_uuid
```

### School Student
```
GET /api/v1/school-student/status/:temp_uuid
```

### Personal Tutor
```
GET /api/v1/personal-tutor/status/:temp_uuid
```

**Response when still pending:**
```json
{
  "success": true,
  "isCompleted": false,
  "status": "pending"
}
```

**Response when finalized:**
```json
{
  "success": true,
  "isCompleted": true,
  "token": "jwt_xxx",
  "userId": 42,
  "user": {
    "id": 42,
    "full_name": "Riya Sharma",
    "mobile": "9876543210"
  }
}
```

JWT is signed with `JWT_ACCESS_SECRET`, role `"student"`, expires in 7 days.
Flutter stores the token and navigates to the dashboard.

---

## Fee Calculation Logic

Fees are looked up from the `fee_structures` table via `activity_id`, `service_type`, and `term_months` (and `standard` for personal tutor).

| Service | Fee lookup | Term |
|---------|-----------|------|
| Individual / Group Coaching | Single `activity_id` × `term_months` | 1, 3, or 6 months |
| Personal Tutor | Sum of all `activity_ids` × `term_months` × `standard` | 1 or 3 months |
| School Student | Sum of all `activity_ids` (fixed 9-month term) | Always 9 months |

The computed amount is stored as `calculated_amount` in `pending_registrations.form_data` and is what gets written to the `payments` table after verify.

---

## Payment Record

Every successful registration writes one row to the `payments` table:

| Column | Value |
|--------|-------|
| `temp_uuid` | Links back to `pending_registrations` |
| `razorpay_order_id` | From Razorpay order creation |
| `razorpay_payment_id` | From verify / webhook |
| `service_type` | `individual_coaching` / `group_coaching` / `school_student` / `personal_tutor` |
| `amount` | INR (from `calculated_amount`) |
| `term_months` | Duration purchased |
| `student_user_id` | `users.id` of the newly created student |

---

## Dev Testing — Bypass Razorpay

When `DEV_SKIP_PAYMENT=true` is set in `.env`, a test endpoint is registered that finalizes any pending registration without going through the Razorpay SDK. Use this to verify the full DB flow (pending → users → students → payments tables) locally.

```
POST /api/v1/payments/dev-finalize/:temp_uuid
```

No request body needed. Returns:

```json
{
  "success": true,
  "message": "[DEV] Registration finalized for service_type: school_student",
  "temp_uuid": "uuid-string"
}
```

**Full test sequence (Postman):**

```
1.  POST /api/v1/school-student/submit          → { temp_uuid, order_id, amount }
2.  POST /api/v1/payments/dev-finalize/:temp_uuid  → { success: true }
3.  GET  /api/v1/school-student/status/:temp_uuid  → { isCompleted: true, token, user }
```

Works for all 4 flows — replace the registration endpoint and status endpoint accordingly.

> **Before going live:** delete `DEV_SKIP_PAYMENT` from `.env`. The route is never registered when the variable is absent, so no code changes are needed.

---

## Environment Variables Required

| Variable | Used For |
|----------|----------|
| `RAZORPAY_KEY_ID` | Sent to Flutter to open checkout |
| `RAZORPAY_KEY_SECRET` | HMAC signature verification |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature verification (register on Razorpay Dashboard when live) |
| `JWT_ACCESS_SECRET` | Signing the student JWT |
| `DEV_SKIP_PAYMENT` | `"true"` enables `POST /payments/dev-finalize/:temp_uuid` — **remove before production** |

---

## Summary Table

| Flow | Register Endpoint | Content-Type | Status Poll |
|------|------------------|-------------|-------------|
| Group Coaching (Society) | `POST /individual-coaching/send-IC` | multipart/form-data | `GET /individual-coaching/status/:uuid` |
| Personal Sports & Skills | `POST /individual-coaching/send-IC` | multipart/form-data | `GET /individual-coaching/status/:uuid` |
| School Student | `POST /school-student/submit` | application/json | `GET /school-student/status/:uuid` |
| Personal Tutor | `POST /personal-tutor/send-PT` | multipart (if <18) / json | `GET /personal-tutor/status/:uuid` |
| Payment Verify | `POST /payments/verify` | application/json | — |
| Razorpay Webhook | `POST /payments/webhook` | application/json | — |
| **Dev bypass** | `POST /payments/dev-finalize/:uuid` | — | DEV_SKIP_PAYMENT=true only |
