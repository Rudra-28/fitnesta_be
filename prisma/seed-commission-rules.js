/**
 * Seed initial commission rules into the commission_rules table.
 *
 * Run once after the migration:
 *   node prisma/seed-commission-rules.js
 *
 * Safe to re-run — uses INSERT IGNORE so existing rows are not overwritten.
 * To update a value, use the admin panel or UPDATE the row directly.
 */

const prisma = require("../config/prisma");

const RULES = [
    // ── Trainer commissions ──────────────────────────────────────────────────
    {
        rule_key:          "trainer_personal_coaching_rate",
        professional_type: "trainer",
        description:       "Trainer earns this % of the fee for Personal Game Coaching (individual coaching)",
        rule_type:         "percentage",
        value:             80.00,
    },
    {
        rule_key:          "trainer_group_society_rate",
        professional_type: "trainer",
        description:       "Trainer earns this % of the fee for Group Coaching conducted in a society (when 10+ students)",
        rule_type:         "percentage",
        value:             50.00,
    },
    {
        rule_key:          "trainer_group_society_min_students",
        professional_type: "trainer",
        description:       "Minimum students per session in a society for the percentage rate to apply. Below this, the flat rate applies.",
        rule_type:         "flat",
        value:             10.00,
    },
    {
        rule_key:          "trainer_group_society_flat_amount",
        professional_type: "trainer",
        description:       "Flat ₹ amount paid to trainer per session when society has fewer than the minimum students threshold",
        rule_type:         "flat",
        value:             300.00,
    },
    {
        rule_key:          "trainer_group_school_rate",
        professional_type: "trainer",
        description:       "Trainer earns this % of the fee for Group Coaching conducted in a school",
        rule_type:         "percentage",
        value:             45.00,
    },

    // ── Teacher commissions ──────────────────────────────────────────────────
    {
        rule_key:          "teacher_personal_tutor_rate",
        professional_type: "teacher",
        description:       "Teacher earns this % of the fee for Personal Tutor / Teacher at Home service",
        rule_type:         "percentage",
        value:             80.00,
    },

    // ── Marketing Executive — admission commissions ──────────────────────────
    {
        rule_key:          "me_group_admission_rate",
        professional_type: "marketing_executive",
        description:       "ME earns this % per individual participant admitted under Group Game Coaching",
        rule_type:         "percentage",
        value:             5.00,
    },
    {
        rule_key:          "me_personal_coaching_admission_rate",
        professional_type: "marketing_executive",
        description:       "ME earns this % when a student registers for Personal Game Coaching (only if society selected from dropdown)",
        rule_type:         "percentage",
        value:             2.00,
    },
    {
        rule_key:          "me_personal_tutor_admission_rate",
        professional_type: "marketing_executive",
        description:       "ME earns this % when a student registers for Personal Tutor (only if society selected from dropdown)",
        rule_type:         "percentage",
        value:             2.00,
    },

    // ── Marketing Executive — onboarding commissions ─────────────────────────
    {
        rule_key:          "me_society_above_100_flats",
        professional_type: "marketing_executive",
        description:       "One-time flat commission for ME when registering a society with more than 100 flats",
        rule_type:         "flat",
        value:             1111.00,
    },
    {
        rule_key:          "me_society_50_to_100_flats",
        professional_type: "marketing_executive",
        description:       "One-time flat commission for ME when registering a society with 50–100 flats",
        rule_type:         "flat",
        value:             500.00,
    },
    {
        rule_key:          "me_society_below_50_flats",
        professional_type: "marketing_executive",
        description:       "One-time flat commission for ME when registering a society with fewer than 50 flats",
        rule_type:         "flat",
        value:             300.00,
    },
    {
        rule_key:          "me_school_registration",
        professional_type: "marketing_executive",
        description:       "One-time flat commission for ME when registering a school",
        rule_type:         "flat",
        value:             1111.00,
    },

    // ── ME general eligibility ───────────────────────────────────────────────
    {
        rule_key:          "me_min_live_activities",
        professional_type: "marketing_executive",
        description:       "Minimum number of globally active activities required for ME to be eligible for any commission",
        rule_type:         "flat",
        value:             2.00,
    },

    // ── Trainer travelling allowance ─────────────────────────────────────────
    {
        rule_key:          "ta_1_batch_amount",
        professional_type: "trainer",
        description:       "Travelling allowance for a trainer who conducts exactly 1 group batch in a day",
        rule_type:         "flat",
        value:             50.00,
    },
    {
        rule_key:          "ta_2_plus_batches_amount",
        professional_type: "trainer",
        description:       "Travelling allowance for a trainer who conducts 2 or more group batches in a day (flat cap)",
        rule_type:         "flat",
        value:             100.00,
    },
];

async function seed() {
    let inserted = 0;
    let skipped  = 0;

    for (const rule of RULES) {
        const existing = await prisma.commission_rules.findUnique({
            where: { rule_key: rule.rule_key },
        });

        if (existing) {
            console.log(`  SKIP  ${rule.rule_key} (already exists)`);
            skipped++;
        } else {
            await prisma.commission_rules.create({ data: rule });
            console.log(`  INSERT ${rule.rule_key}`);
            inserted++;
        }
    }

    console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
}

seed()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
