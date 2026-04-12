-- =============================================================
-- FITNESTA DATABASE SCHEMA
-- Complete schema with all tables, fixes, and new additions
-- =============================================================

-- ---------------------------------------------------------------
-- 1. USERS
-- Central identity table for all roles: professional, student,
-- admin, sub_admin. role is VARCHAR (not ENUM) so future roles
-- can be added without an ALTER TABLE.
-- ---------------------------------------------------------------
CREATE TABLE users (
    id                  INT PRIMARY KEY AUTO_INCREMENT,
    role                VARCHAR(50) NOT NULL DEFAULT 'student',       -- 'professional' | 'student' | 'admin' | 'sub_admin'
    subrole             VARCHAR(50) DEFAULT NULL,                     -- 'trainer' | 'teacher' | 'vendor' | 'marketing_executive'
    full_name           VARCHAR(100),
    mobile              VARCHAR(15) UNIQUE,
    email               VARCHAR(100),
    address             TEXT,
    photo               VARCHAR(255),
    is_verified         TINYINT(1) DEFAULT 0,
    approval_status     ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    approved_by         INT DEFAULT NULL,                             -- FK to users.id (the admin who acted)
    approval_note       TEXT DEFAULT NULL,                            -- rejection reason or admin note
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------
-- 2. ADMINS
-- Extra data for admin and sub_admin users.
-- ---------------------------------------------------------------
CREATE TABLE admins (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    user_id     INT NOT NULL,
    scope       ENUM('super_admin','sub_admin') DEFAULT 'sub_admin',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ---------------------------------------------------------------
-- 3. PROFESSIONALS
-- Shared profile data for all professional types.
-- profession_type is VARCHAR so new professional types (e.g.
-- 'coach', 'physiotherapist') can be added without ALTER TABLE.
-- ---------------------------------------------------------------
CREATE TABLE professionals (
    id                      INT PRIMARY KEY AUTO_INCREMENT,
    uuid                    CHAR(36)    NOT NULL UNIQUE,              -- permanent immutable identity (never changes)
    referral_code           VARCHAR(12) NOT NULL UNIQUE,              -- e.g. 'FIT-550E8400', shown on profile & used in enrollment forms
    user_id                 INT,
    profession_type         VARCHAR(50) NOT NULL,                     -- 'trainer' | 'teacher' | 'marketing_executive' | 'vendor'
    pan_card                VARCHAR(255),
    adhar_card              VARCHAR(255),
    relative_name           VARCHAR(100),
    relative_contact        VARCHAR(15),
    own_two_wheeler         TINYINT(1) DEFAULT 0,
    communication_languages JSON,                                     -- array of languages stored as JSON
    place                   VARCHAR(100),
    date                    DATE,                                     -- date of registration / joining
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ---------------------------------------------------------------
-- 4. TRAINERS
-- Extra details specific to trainers.
-- specified_game and specified_skills are JSON arrays because a
-- trainer can list multiple games and skills.
-- ---------------------------------------------------------------
CREATE TABLE trainers (
    id                  INT PRIMARY KEY AUTO_INCREMENT,
    professional_id     INT,
    player_level        VARCHAR(50),                                  -- e.g. 'beginner', 'intermediate', 'professional'
    category            VARCHAR(100),                                 -- e.g. 'sports', 'fitness'
    specified_game      JSON,                                         -- ["Cricket", "Football"]
    specified_skills    JSON,                                         -- ["Batting", "Bowling"]
    experience_details  TEXT,
    qualification_docs  VARCHAR(255),                                 -- file path / URL
    documents           VARCHAR(255),                                 -- additional docs file path / URL
    FOREIGN KEY (professional_id) REFERENCES professionals(id)
);

-- ---------------------------------------------------------------
-- 5. TEACHERS
-- Extra details specific to teachers / personal tutors.
-- ---------------------------------------------------------------
CREATE TABLE teachers (
    id                  INT PRIMARY KEY AUTO_INCREMENT,
    professional_id     INT,
    subject             VARCHAR(100),
    experience_details  TEXT,
    ded_doc             VARCHAR(255),                                 -- D.Ed certificate
    bed_doc             VARCHAR(255),                                 -- B.Ed certificate
    other_doc           VARCHAR(255),                                 -- any other qualification doc
    FOREIGN KEY (professional_id) REFERENCES professionals(id)
);

-- ---------------------------------------------------------------
-- 6. MARKETING EXECUTIVES
-- Extra details specific to marketing executives.
-- ---------------------------------------------------------------
CREATE TABLE marketing_executives (
    id                          INT PRIMARY KEY AUTO_INCREMENT,
    professional_id             INT,
    dob                         DATE,
    education_qualification     VARCHAR(200),
    previous_experience         TEXT,
    activity_agreement_pdf      VARCHAR(255),                        -- signed agreement between Fitnesta & ME
    FOREIGN KEY (professional_id) REFERENCES professionals(id)
);

-- ---------------------------------------------------------------
-- 7. VENDORS
-- Extra details specific to vendors.
-- ---------------------------------------------------------------
CREATE TABLE vendors (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    professional_id INT,
    store_name      VARCHAR(150),
    store_address   TEXT,
    store_location  VARCHAR(150),
    gst_certificate VARCHAR(255),                                     -- file path / URL
    FOREIGN KEY (professional_id) REFERENCES professionals(id)
);

-- ---------------------------------------------------------------
-- 8. VENDOR PRODUCTS
-- Products (kits, equipment, etc.) listed by a vendor on their
-- dashboard. sports_category is VARCHAR for extensibility.
-- price = MRP, selling_price = discounted/offered price.
-- ---------------------------------------------------------------
CREATE TABLE vendor_products (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    vendor_id       INT NOT NULL,
    product_image   VARCHAR(255) DEFAULT NULL,             -- Cloudinary URL
    product_name    VARCHAR(150) NOT NULL,
    sports_category VARCHAR(100) NOT NULL,                 -- e.g. 'Cricket', 'Football'
    price           DECIMAL(10,2) NOT NULL,                -- MRP
    selling_price   DECIMAL(10,2) NOT NULL,                -- offered price
    stock           INT NOT NULL DEFAULT 0,
    description     TEXT DEFAULT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

-- ---------------------------------------------------------------
-- 9. WALLETS
-- One wallet per professional for commission credits.
-- ---------------------------------------------------------------
CREATE TABLE wallets (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    professional_id INT NOT NULL,
    balance         DECIMAL(10,2) DEFAULT 0.00,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY (professional_id),
    FOREIGN KEY (professional_id) REFERENCES professionals(id)
);

-- ---------------------------------------------------------------
-- 9. STUDENTS
-- Central student record. student_type drives which sub-table
-- holds the details.
-- ---------------------------------------------------------------
CREATE TABLE students (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    user_id         INT,
    student_type    ENUM(
                        'group_coaching',
                        'individual_coaching',
                        'personal_tutor',
                        'school_student'
                    ),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ---------------------------------------------------------------
-- 10. SOCIETIES
-- Registered societies. Submitted by a user (anyone), handled
-- by a marketing executive, approved by admin.
-- registered_by_user_id: who submitted the registration request.
-- me_professional_id: which ME was assigned / signed the deal.
-- agreement_signed_by_authority: whether the society authority
--   has physically signed the Fitnesta agreement.
-- ---------------------------------------------------------------
CREATE TABLE societies (
    id                              INT PRIMARY KEY AUTO_INCREMENT,
    society_unique_id               VARCHAR(50) NOT NULL UNIQUE,     -- user-provided unique identifier for the society
    registered_by_user_id           INT DEFAULT NULL,                -- the user who submitted the request
    me_professional_id              INT DEFAULT NULL,                -- ME who handled & signed
    society_name                    VARCHAR(150),
    society_category                VARCHAR(100),
    address                         TEXT,
    pin_code                        VARCHAR(10),
    total_participants              INT,
    no_of_flats                     INT DEFAULT NULL,
    proposed_wing                   VARCHAR(50),
    authority_role                  VARCHAR(50),
    authority_person_name           VARCHAR(100),
    contact_number                  VARCHAR(15),
    playground_available            TINYINT(1) DEFAULT 0,
    coordinator_name                VARCHAR(100),
    coordinator_number              VARCHAR(15),
    me_name                         VARCHAR(100),                    -- ME name filled during enrollment
    me_contact                      VARCHAR(15),                     -- ME contact filled during enrollment
    agreement_signed_by_authority   TINYINT(1) DEFAULT 0,
    activity_agreement_pdf          VARCHAR(255),                    -- uploaded signed agreement doc
    approval_status                 ENUM('pending','approved','rejected') DEFAULT 'pending',
    created_at                      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (registered_by_user_id) REFERENCES users(id),
    FOREIGN KEY (me_professional_id) REFERENCES professionals(id)
);

-- ---------------------------------------------------------------
-- 11. SCHOOLS
-- Registered schools. Same registration/enrollment flow as
-- societies. user_id = who submitted the request.
-- ---------------------------------------------------------------
CREATE TABLE schools (
    id                              INT PRIMARY KEY AUTO_INCREMENT,
    user_id                         INT DEFAULT NULL,                -- who submitted the request
    me_professional_id              INT DEFAULT NULL,                -- ME who handled & signed
    school_name                     VARCHAR(150),
    address                         TEXT,
    pin_code                        VARCHAR(10),
    state                           VARCHAR(100),
    language_medium                 VARCHAR(100),
    landline_no                     VARCHAR(20),
    principal_name                  VARCHAR(100),
    principal_contact               VARCHAR(15),
    activity_coordinator            VARCHAR(100),
    me_name                         VARCHAR(100),
    me_contact                      VARCHAR(15),
    agreement_signed_by_authority   TINYINT(1) DEFAULT 0,
    activity_agreement_pdf          VARCHAR(255),
    approval_status                 ENUM('pending','approved','rejected') DEFAULT 'pending',
    created_at                      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (me_professional_id) REFERENCES professionals(id)
);

-- ---------------------------------------------------------------
-- 12. INDIVIDUAL PARTICIPANTS (Group Coaching — Individual)
-- Students enrolling in group coaching under a society.
-- society_id: set when the society is a registered one.
-- society_name: free text fallback when society is NOT registered
--   (in this case no ME commission applies).
-- activity: single activity selected from trainer's offerings.
-- ---------------------------------------------------------------
CREATE TABLE individual_participants (
    id                          INT PRIMARY KEY AUTO_INCREMENT,
    student_id                  INT,
    participant_name            VARCHAR(100),
    mobile                      VARCHAR(15),
    flat_no                     VARCHAR(50),
    dob                         DATE,
    age                         INT,
    society_id                  INT DEFAULT NULL,                   -- FK when selected from dropdown
    society_name                VARCHAR(150) DEFAULT NULL,          -- name of the registered society (from dropdown)
    manually_entered_society    VARCHAR(150) DEFAULT NULL,          -- filled only when user types a custom society name not in the list
    activity                    VARCHAR(100),
    kits                        TEXT,
    FOREIGN KEY (student_id)    REFERENCES students(id),
    FOREIGN KEY (society_id)    REFERENCES societies(id)
);

-- ---------------------------------------------------------------
-- 13. SCHOOL STUDENTS (Group Coaching — School)
-- Students enrolled under a registered school.
-- ---------------------------------------------------------------
CREATE TABLE school_students (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    student_id      INT NOT NULL,
    school_id       INT NOT NULL,
    student_name    VARCHAR(150),
    standard        VARCHAR(50),
    address         TEXT,
    activities      TEXT,   -- JSON array of activity IDs e.g. [23, 25]
    kit_type        TEXT,   -- JSON array of vendor product IDs e.g. [3, 7]
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (school_id) REFERENCES schools(id)
);

-- ---------------------------------------------------------------
-- 14. OTHER AREAS (Group Coaching — Other Area)
-- For group coaching locations that are neither a registered
-- society nor a school, and where no ME is present.
-- ---------------------------------------------------------------
CREATE TABLE other_areas (
    id                      INT PRIMARY KEY AUTO_INCREMENT,
    student_id              INT,
    me_professional_id      INT DEFAULT NULL,
    sponsor_name            VARCHAR(100),
    coordinator_name        VARCHAR(100),
    address                 TEXT,
    mobile                  VARCHAR(15),
    marketing_incharge      VARCHAR(100),
    activity_agreement_pdf  VARCHAR(255),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (me_professional_id) REFERENCES professionals(id)
);

-- ---------------------------------------------------------------
-- 15. PERSONAL TUTORS (Student — Personal Tutor/Teacher service)
-- teacher_for stores multiple subjects/needs as JSON since a
-- student CAN select multiple.
-- ---------------------------------------------------------------
CREATE TABLE personal_tutors (
    id                  INT PRIMARY KEY AUTO_INCREMENT,
    student_id          INT,
    participant_name    VARCHAR(100),
    address             TEXT,
    dob                 DATE,
    standard            VARCHAR(50),
    batch               VARCHAR(50),
    contact_number      VARCHAR(15),
    teacher_for         JSON,                                        -- ["Maths", "Science"] (multiple allowed)
    FOREIGN KEY (student_id) REFERENCES students(id)
);

-- ---------------------------------------------------------------
-- 16. PARENT CONSENTS
-- Required for minors. Linked to a student record.
-- parent_signature_doc: uploaded signed consent document.
-- ---------------------------------------------------------------
CREATE TABLE parent_consents (
    id                      INT PRIMARY KEY AUTO_INCREMENT,
    student_id              INT,
    participant_name        VARCHAR(100),
    dob                     DATE,
    age                     INT,
    society_name            VARCHAR(150),
    activity_enrolled       VARCHAR(150),
    parent_name             VARCHAR(255) NOT NULL,
    emergency_contact_no    VARCHAR(20) NOT NULL,
    parent_signature_doc    VARCHAR(500) DEFAULT NULL,              -- uploaded signature / consent doc
    consent_date            DATE NOT NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id)
);

-- ---------------------------------------------------------------
-- 17. COMMISSIONS
-- Records every commission event triggered by an enrollment or
-- registration. Linked to the professional who earned it.
-- source_id references the row in the relevant table that
-- triggered the commission (enrollment id, school id, etc.).
-- ---------------------------------------------------------------
CREATE TABLE commissions (
    id                  INT PRIMARY KEY AUTO_INCREMENT,
    professional_id     INT NOT NULL,
    professional_type   ENUM(
                            'marketing_executive',
                            'trainer',
                            'teacher'
                        ) NOT NULL,
    source_type         ENUM(
                            'group_coaching_society',            -- ME 5% + Trainer 50%
                            'group_coaching_school',             -- ME 5% (one-time) + Trainer 45%
                            'group_coaching_other',              -- Trainer 50%, no ME commission
                            'individual_coaching',               -- ME 2% (only if society registered) + Trainer 80%
                            'personal_tutor',                    -- ME 2% (only if society registered) + Teacher 80%
                            'school_registration',               -- ME 5% one-time
                            'event_ticket'                       -- ME 10%
                        ) NOT NULL,
    source_id           INT NOT NULL,                            -- the enrollment/registration row id
    base_amount         DECIMAL(10,2) NOT NULL,
    commission_rate     DECIMAL(5,2) NOT NULL,                   -- e.g. 5.00 = 5%
    commission_amount   DECIMAL(10,2) NOT NULL,
    status              ENUM('pending','paid') DEFAULT 'pending',
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (professional_id) REFERENCES professionals(id)
);

-- ---------------------------------------------------------------
-- 18. ACTIVITIES
-- Master list of all activities offered across coaching types.
-- The same activity (e.g. Dance Western) can appear in both
-- group_coaching and individual_coaching via fee_structures.
-- ---------------------------------------------------------------
CREATE TABLE activities (
    id                INT PRIMARY KEY AUTO_INCREMENT,
    name              VARCHAR(150) NOT NULL,
    notes             VARCHAR(255) DEFAULT NULL,                        -- 'Age 2–7 only', 'Course-based', etc.
    is_active         TINYINT(1)   DEFAULT 1,
    activity_category ENUM('sports','non_sports') NOT NULL DEFAULT 'sports',
    image_url         VARCHAR(255) DEFAULT NULL,
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------
-- 19. FEE STRUCTURES
-- Single fee matrix covering all three coaching types.
-- society_category  → filled only for group_coaching (A+ / A / B)
-- standard          → filled only for personal_tutor (grade level)
-- Both are NULL for individual_coaching.
-- term_months       → 1 | 3 | 6
-- total_fee         → upfront amount the student pays
-- effective_monthly → the bracket value shown for 3M/6M plans
--                     NULL for 1M rows (total_fee IS the monthly fee)
-- ---------------------------------------------------------------
CREATE TABLE fee_structures (
    id                   INT PRIMARY KEY AUTO_INCREMENT,
    activity_id          INT NOT NULL,
    coaching_type        ENUM(
                             'group_coaching',
                             'individual_coaching',
                             'personal_tutor',
                             'school_student'
                         ) NOT NULL,
    society_category     ENUM('A+','A','B') DEFAULT NULL,
    custom_category_name VARCHAR(100)       DEFAULT NULL,
    standard             VARCHAR(20)        DEFAULT NULL,            -- '1ST-2ND' | '3RD-4TH' | '5TH-6TH' | '7TH-8TH' | '8TH-10TH' | 'ANY'
    term_months          TINYINT            NOT NULL,                -- 1 | 3 | 6
    total_fee            DECIMAL(10,2)      NOT NULL,
    effective_monthly    DECIMAL(10,2)      DEFAULT NULL,
    last_edited_by       INT                DEFAULT NULL,
    last_edited_at       TIMESTAMP          DEFAULT NULL,
    UNIQUE KEY uq_fee (activity_id, coaching_type, society_category, custom_category_name, standard, term_months),
    FOREIGN KEY (activity_id) REFERENCES activities(id)
);

-- ---------------------------------------------------------------
-- SEED: Activities
-- ---------------------------------------------------------------
INSERT INTO activities (id, name, notes, activity_category) VALUES
-- Group Coaching — Sports
(1,  'Fun Games / Play Ground',                    'Age 2-7 only',              'sports'),
(2,  'Fitness + Kho-Kho + Kabaddi + Volleyball',   NULL,                        'sports'),
(3,  'Cricket + Fitness',                          NULL,                        'sports'),
(4,  'Karate + Fitness',                           NULL,                        'sports'),
(5,  'Yoga + Fitness',                             NULL,                        'sports'),
-- Group Coaching — Non-Sports
(6,  'Dance (Western)',                            NULL,                        'non_sports'),  -- shared with individual_coaching
(7,  'Dance (Classical)',                          NULL,                        'non_sports'),  -- shared with individual_coaching
(8,  'Make Up Artist Diploma',                     'Course-based, 3M only',     'non_sports'),
(9,  'Psychometric Test',                          'Assessment, monthly only',  'non_sports'),
-- Individual / Personal Game Coaching — Sports
(10, 'Cricket',                                    NULL,                        'sports'),
(11, 'Karate (Martial Arts)',                      NULL,                        'sports'),
(12, 'Boxing',                                     NULL,                        'sports'),
(13, 'Football',                                   NULL,                        'sports'),
(14, 'Volleyball',                                 NULL,                        'sports'),
(15, 'Skating',                                    NULL,                        'sports'),
-- Individual / Personal Game Coaching — Non-Sports
(16, 'Personal Fitness',                           NULL,                        'non_sports'),
(17, 'Yoga (Personal/Family)',                     NULL,                        'non_sports'),
-- Personal Tutor subjects — Non-Sports
(18, 'All Subjects',                               NULL,                        'non_sports'),
(19, 'Maths',                                      NULL,                        'non_sports'),
(20, 'Science',                                    NULL,                        'non_sports'),
(21, 'English',                                    NULL,                        'non_sports'),
(22, 'German',                                     NULL,                        'non_sports'),
-- School Student specific — Sports
(23, 'Kho-Kho',                                    NULL,                        'sports'),
(24, 'Kabaddi',                                    NULL,                        'sports'),
-- School Student specific — Non-Sports
(25, 'Bollywood Dance',                            NULL,                        'non_sports'),
(26, 'Foreign Languages [German/French]',          NULL,                        'non_sports');

-- ---------------------------------------------------------------
-- SEED: Fee Structures — Group Coaching (A+ / A / B × 1M / 3M / 6M)
-- ---------------------------------------------------------------
INSERT INTO fee_structures (activity_id, coaching_type, society_category, standard, term_months, total_fee, effective_monthly) VALUES
-- Fun Games / Play Ground
(1,'group_coaching','A+',NULL,1, 1500, NULL),
(1,'group_coaching','A+',NULL,3, 3700, 1225),
(1,'group_coaching','A+',NULL,6, 6300, 1050),
(1,'group_coaching','A', NULL,1,  950, NULL),
(1,'group_coaching','A', NULL,3, 2500,  825),
(1,'group_coaching','A', NULL,6, 4200,  700),
(1,'group_coaching','B', NULL,1,  750, NULL),
(1,'group_coaching','B', NULL,3, 1850,  615),
(1,'group_coaching','B', NULL,6, 3200,  525),
-- Fitness + Kho-Kho + Kabaddi + Volleyball
(2,'group_coaching','A+',NULL,1, 2000, NULL),
(2,'group_coaching','A+',NULL,3, 4200, 1400),
(2,'group_coaching','A+',NULL,6, 6900, 1150),
(2,'group_coaching','A', NULL,1, 1500, NULL),
(2,'group_coaching','A', NULL,3, 3900, 1300),
(2,'group_coaching','A', NULL,6, 6200, 1025),
(2,'group_coaching','B', NULL,1, 1200, NULL),
(2,'group_coaching','B', NULL,3, 3150, 1050),
(2,'group_coaching','B', NULL,6, 5600,  925),
-- Cricket + Fitness
(3,'group_coaching','A+',NULL,1, 2800, NULL),
(3,'group_coaching','A+',NULL,3, 6900, 2300),
(3,'group_coaching','A+',NULL,6,12100, 2010),
(3,'group_coaching','A', NULL,1, 1800, NULL),
(3,'group_coaching','A', NULL,3, 4900, 1625),
(3,'group_coaching','A', NULL,6, 8500, 1425),
(3,'group_coaching','B', NULL,1, 1200, NULL),
(3,'group_coaching','B', NULL,3, 3150, 1050),
(3,'group_coaching','B', NULL,6, 5600,  925),
-- Karate + Fitness
(4,'group_coaching','A+',NULL,1, 2800, NULL),
(4,'group_coaching','A+',NULL,3, 6900, 2300),
(4,'group_coaching','A+',NULL,6,12100, 2010),
(4,'group_coaching','A', NULL,1, 1800, NULL),
(4,'group_coaching','A', NULL,3, 4900, 1625),
(4,'group_coaching','A', NULL,6, 8500, 1425),
(4,'group_coaching','B', NULL,1, 1200, NULL),
(4,'group_coaching','B', NULL,3, 3150, 1050),
(4,'group_coaching','B', NULL,6, 5600,  925),
-- Yoga + Fitness
(5,'group_coaching','A+',NULL,1, 1200, NULL),
(5,'group_coaching','A+',NULL,3, 3300, 1100),
(5,'group_coaching','A+',NULL,6, 5600,  925),
(5,'group_coaching','A', NULL,1,  950, NULL),
(5,'group_coaching','A', NULL,3, 2500,  825),
(5,'group_coaching','A', NULL,6, 4500,  750),
(5,'group_coaching','B', NULL,1,  850, NULL),
(5,'group_coaching','B', NULL,3, 2300,  770),
(5,'group_coaching','B', NULL,6, 3800,  625),
-- Dance (Western) — Group
(6,'group_coaching','A+',NULL,1, 1800, NULL),
(6,'group_coaching','A+',NULL,3, 4800, 1600),
(6,'group_coaching','A+',NULL,6, 8200, 1350),
(6,'group_coaching','A', NULL,1, 1600, NULL),
(6,'group_coaching','A', NULL,3, 4200, 1400),
(6,'group_coaching','A', NULL,6, 7300, 1225),
(6,'group_coaching','B', NULL,1, 1400, NULL),
(6,'group_coaching','B', NULL,3, 3800, 1260),
(6,'group_coaching','B', NULL,6, 6500, 1100),
-- Dance (Classical) — Group
(7,'group_coaching','A+',NULL,1, 2200, NULL),
(7,'group_coaching','A+',NULL,3, 5700, 1900),
(7,'group_coaching','A+',NULL,6, 9900, 1650),
(7,'group_coaching','A', NULL,1, 1800, NULL),
(7,'group_coaching','A', NULL,3, 4600, 1525),
(7,'group_coaching','A', NULL,6, 8200, 1375),
(7,'group_coaching','B', NULL,1, 1600, NULL),
(7,'group_coaching','B', NULL,3, 4200, 1400),
(7,'group_coaching','B', NULL,6, 7600, 1275),
-- Make Up Artist Diploma (course-based, no monthly plan)
(8,'group_coaching','A+',NULL,3,35000, NULL),
(8,'group_coaching','A', NULL,3,25000, NULL),
(8,'group_coaching','A', NULL,6,25000, NULL),
-- Psychometric Test (monthly only)
(9,'group_coaching','A+',NULL,1, 650, NULL),
(9,'group_coaching','A', NULL,1, 600, NULL),
(9,'group_coaching','B', NULL,1, 600, NULL);

-- ---------------------------------------------------------------
-- SEED: Fee Structures — Personal Game Coaching (Individual)
-- society_category = NULL (fees are flat, not tied to society tier)
-- ---------------------------------------------------------------
INSERT INTO fee_structures (activity_id, coaching_type, society_category, standard, term_months, total_fee, effective_monthly) VALUES
-- Cricket
(10,'individual_coaching',NULL,NULL,1, 8000, NULL),
(10,'individual_coaching',NULL,NULL,3,21600, 7200),
(10,'individual_coaching',NULL,NULL,6,38400, 6400),
-- Karate (Martial Arts)
(11,'individual_coaching',NULL,NULL,1, 6000, NULL),
(11,'individual_coaching',NULL,NULL,3,16200, 5400),
(11,'individual_coaching',NULL,NULL,6,28800, 4800),
-- Boxing
(12,'individual_coaching',NULL,NULL,1, 6000, NULL),
(12,'individual_coaching',NULL,NULL,3,16200, 5400),
(12,'individual_coaching',NULL,NULL,6,28800, 4800),
-- Football
(13,'individual_coaching',NULL,NULL,1, 6000, NULL),
(13,'individual_coaching',NULL,NULL,3,16200, 5400),
(13,'individual_coaching',NULL,NULL,6,28800, 4800),
-- Volleyball
(14,'individual_coaching',NULL,NULL,1, 6000, NULL),
(14,'individual_coaching',NULL,NULL,3,16200, 5400),
(14,'individual_coaching',NULL,NULL,6,28800, 4800),
-- Skating
(15,'individual_coaching',NULL,NULL,1, 6000, NULL),
(15,'individual_coaching',NULL,NULL,3,16200, 5400),
(15,'individual_coaching',NULL,NULL,6,28800, 4800),
-- Dance (Western) — Individual (reuses activity id 6)
(6,'individual_coaching',NULL,NULL,1, 7000, NULL),
(6,'individual_coaching',NULL,NULL,3,18900, 6300),
(6,'individual_coaching',NULL,NULL,6,33600, 5600),
-- Dance (Classical) — Individual (reuses activity id 7)
(7,'individual_coaching',NULL,NULL,1, 8000, NULL),
(7,'individual_coaching',NULL,NULL,3,21600, 7200),
(7,'individual_coaching',NULL,NULL,6,38400, 6400),
-- Personal Fitness
(16,'individual_coaching',NULL,NULL,1, 6000, NULL),
(16,'individual_coaching',NULL,NULL,3,16200, 5400),
(16,'individual_coaching',NULL,NULL,6,28800, 4800),
-- Yoga (Personal/Family)
(17,'individual_coaching',NULL,NULL,1, 7000, NULL),
(17,'individual_coaching',NULL,NULL,3,18900, 6300),
(17,'individual_coaching',NULL,NULL,6,33600, 5600);

-- ---------------------------------------------------------------
-- SEED: Fee Structures — Personal Tutor (Teacher at Home Scheme)
-- society_category = NULL, standard = grade level
-- ---------------------------------------------------------------
INSERT INTO fee_structures (activity_id, coaching_type, society_category, standard, term_months, total_fee, effective_monthly) VALUES
-- All Subjects
(18,'personal_tutor',NULL,'1ST-2ND', 1, 3900, NULL),
(18,'personal_tutor',NULL,'1ST-2ND', 3, 9500, 3150),
(18,'personal_tutor',NULL,'3RD-4TH', 1, 4500, NULL),
(18,'personal_tutor',NULL,'3RD-4TH', 3,11500, 3850),
(18,'personal_tutor',NULL,'5TH-6TH', 1, 6100, NULL),
(18,'personal_tutor',NULL,'5TH-6TH', 3,15900, 5300),
(18,'personal_tutor',NULL,'7TH-8TH', 1, 7900, NULL),
(18,'personal_tutor',NULL,'7TH-8TH', 3,21500, 7150),
-- Maths (8TH-10TH)
(19,'personal_tutor',NULL,'8TH-10TH',1, 7900, NULL),
(19,'personal_tutor',NULL,'8TH-10TH',3,21500, 7150),
-- Science (8TH-10TH)
(20,'personal_tutor',NULL,'8TH-10TH',1, 7900, NULL),
(20,'personal_tutor',NULL,'8TH-10TH',3,21500, 7150),
-- English (8TH-10TH)
(21,'personal_tutor',NULL,'8TH-10TH',1, 7900, NULL),
(21,'personal_tutor',NULL,'8TH-10TH',3,21500, 7150),
-- German (ANY standard)
(22,'personal_tutor',NULL,'ANY',      1, 8500, NULL),
(22,'personal_tutor',NULL,'ANY',      3,22500, 7500);

-- ---------------------------------------------------------------
-- 20. PENDING REGISTRATIONS
-- (was section 18 before activities & fee_structures were added)
-- Staging table for all registration submissions before admin
-- approval. form_data stores the complete submitted form as JSON.
-- service_type identifies which registration flow it belongs to.
-- On approval, the actual rows are inserted into the target tables.
-- On rejection, status is set to 'rejected' with a review_note.
-- ---------------------------------------------------------------
CREATE TABLE pending_registrations (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    temp_uuid       VARCHAR(255) NOT NULL UNIQUE,
    form_data       JSON NOT NULL,
    service_type    VARCHAR(50) NOT NULL,                         -- 'trainer' | 'teacher' | 'vendor' | 'marketing_executive'
                                                                  -- | 'individual_coaching' | 'personal_tutor'
                                                                  -- | 'group_coaching_individual' | 'society' | 'school'
    status          ENUM('pending','approved','rejected') DEFAULT 'pending',
    reviewed_by     INT DEFAULT NULL,                            -- admin user_id who acted
    review_note     TEXT DEFAULT NULL,
    reviewed_at     TIMESTAMP NULL DEFAULT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------
-- SEED: Fee Structures — School Student (Compulsory Participant Model)
-- Weekly 3 days, 2 hours. Single 9-month term. society_category = NULL.
-- effective_monthly = total_fee / 9
-- ---------------------------------------------------------------
INSERT INTO fee_structures (activity_id, coaching_type, society_category, standard, term_months, total_fee, effective_monthly) VALUES
-- Cricket
(10,'school_student',NULL,NULL,9, 3900, 433.33),
-- Karate (Martial Arts)
(11,'school_student',NULL,NULL,9, 3900, 433.33),
-- Skating
(15,'school_student',NULL,NULL,9, 3900, 433.33),
-- Boxing
(12,'school_student',NULL,NULL,9, 3900, 433.33),
-- Football
(13,'school_student',NULL,NULL,9, 3500, 388.89),
-- Volleyball
(14,'school_student',NULL,NULL,9, 3500, 388.89),
-- Kho-Kho
(23,'school_student',NULL,NULL,9, 3000, 333.33),
-- Kabaddi
(24,'school_student',NULL,NULL,9, 3000, 333.33),
-- Bollywood Dance
(25,'school_student',NULL,NULL,9, 3900, 433.33),
-- Classical Dance (Kathak / Bharat Natyam)
(7,'school_student',NULL,NULL,9,  4500, 500.00),
-- Foreign Languages (German/French)
(26,'school_student',NULL,NULL,9, 4500, 500.00);

-- ---------------------------------------------------------------
-- 21. PAYMENTS
-- One row per successful Razorpay payment.
-- Serves as the foundation for:
--   • Commission calculation  → commissions.source_id = payments.id
--   • Profit analysis on admin panel (SUM amount GROUP BY service_type / date)
--   • Refund tracking         → status = 'refunded'
-- student_user_id is NULL until finalizeRegistration completes,
-- then filled so admin reports can JOIN to the full student profile.
-- ---------------------------------------------------------------
CREATE TABLE payments (
    id                      INT PRIMARY KEY AUTO_INCREMENT,
    temp_uuid               VARCHAR(255)  NOT NULL UNIQUE,
    razorpay_order_id       VARCHAR(100)  NOT NULL,
    razorpay_payment_id     VARCHAR(100)  NOT NULL UNIQUE,
    service_type            VARCHAR(50)   NOT NULL,              -- 'individual_coaching' | 'personal_tutor' | 'school_student'
    amount                  DECIMAL(10,2) NOT NULL,              -- total fee paid in INR
    currency                VARCHAR(10)   DEFAULT 'INR',
    term_months             TINYINT       NOT NULL DEFAULT 1,    -- duration bought: 1 | 3 | 6 | 9 — used to compute expiry_date = captured_at + term_months months
    status                  ENUM('captured','refunded','failed') DEFAULT 'captured',
    student_user_id         INT           DEFAULT NULL,          -- filled after finalization; FK to users
    captured_at             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_user_id) REFERENCES users(id)
);
