/**
 * Withdrawal Service — Admin manually pays professionals.
 *
 * Status flow:
 *   on_hold  → threshold met (auto)  → pending
 *   pending  → admin marks paid      → paid  (+wallet credited)
 *
 * There is no professional-initiated withdrawal.
 * No Razorpay payout integration — admin pays manually via UPI/bank transfer.
 */

// This file is intentionally minimal.
// All commission state transitions are handled in:
//   commissionservice.js  — on_hold → pending (threshold release)
//   adminservice.js       — pending → paid     (admin marks paid)
