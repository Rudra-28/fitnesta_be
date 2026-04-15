-- Seed all ME commission rules that were previously only hardcoded as fallbacks in commissionservice.js

INSERT IGNORE INTO commission_rules (rule_key, professional_type, description, rule_type, value)
VALUES
    -- Admission commission rates
    ('me_group_admission_rate',               'marketing_executive', 'ME earns this % on group coaching admission fee',                          'percentage', 5),
    ('me_personal_coaching_admission_rate',   'marketing_executive', 'ME earns this % on individual coaching admission fee',                     'percentage', 2),
    ('me_personal_tutor_admission_rate',      'marketing_executive', 'ME earns this % on personal tutor admission fee',                          'percentage', 2),

    -- Group coaching on_hold release threshold
    ('me_group_admission_min_students',       'marketing_executive', 'Min group coaching students in a society before on_hold commissions release', 'integer',   20),

    -- Society onboarding flat commissions (based on no. of flats)
    ('me_society_above_100_flats',            'marketing_executive', 'ME one-time commission for society with more than 100 flats',              'flat',       1111),
    ('me_society_50_to_100_flats',            'marketing_executive', 'ME one-time commission for society with 50 to 100 flats',                 'flat',       500),
    ('me_society_below_50_flats',             'marketing_executive', 'ME one-time commission for society with fewer than 50 flats',             'flat',       300),

    -- School onboarding flat commission
    ('me_school_registration',                'marketing_executive', 'ME one-time commission when a school is onboarded',                       'flat',       1111);
