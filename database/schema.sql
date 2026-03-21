CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role ENUM('professional','student'),
    full_name VARCHAR(100),
    mobile VARCHAR(15) UNIQUE,
    email VARCHAR(100),
    address TEXT,
    photo VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE professionals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    profession_type ENUM('trainer','teacher','marketing_executive','vendor'),
    pan_card VARCHAR(255),
    adhar_card VARCHAR(255),
    relative_name VARCHAR(100),
    relative_contact VARCHAR(15),
    own_two_wheeler BOOLEAN,
    communication_languages TEXT,
    place VARCHAR(100),
    date DATE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE trainers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    professional_id INT,
    player_level VARCHAR(50),
    category VARCHAR(100),
    specified_game VARCHAR(100),
    specified_skills VARCHAR(100),
    experience_details TEXT,
    qualification_docs VARCHAR(255),
    documents VARCHAR(255),
    FOREIGN KEY (professional_id) REFERENCES professionals(id)
);

CREATE TABLE teachers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    professional_id INT,
    subject VARCHAR(100),
    experience_details TEXT,
    ded_doc VARCHAR(255),
    bed_doc VARCHAR(255),
    other_doc VARCHAR(255),
    FOREIGN KEY (professional_id) REFERENCES professionals(id)
);

CREATE TABLE marketing_executives (
    id INT PRIMARY KEY AUTO_INCREMENT,
    professional_id INT,
    dob DATE,
    education_qualification VARCHAR(200),
    previous_experience TEXT,
    activity_agreement_pdf VARCHAR(255),
    FOREIGN KEY (professional_id) REFERENCES professionals(id)
);

CREATE TABLE vendors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    professional_id INT,
    store_name VARCHAR(150),
    store_address TEXT,
    store_location VARCHAR(150),
    gst_certificate VARCHAR(255),
    FOREIGN KEY (professional_id) REFERENCES professionals(id)
);

CREATE TABLE students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    student_type ENUM(
        'group_coaching',
        'individual_coaching',
        'personal_tutor',
        'school_student'
    ),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE individual_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT,
    participant_name VARCHAR(100),
    mobile VARCHAR(15),
    flat_no VARCHAR(50),
    dob DATE,
    age INT,
    society_name VARCHAR(150),
    activity VARCHAR(100),
    kits TEXT,
    FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE societies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT,
    society_name VARCHAR(150),
    society_category VARCHAR(100),
    address TEXT,
    pin_code VARCHAR(10),
    total_participants INT,
    proposed_wing VARCHAR(50),
    authority_role VARCHAR(50),
    authority_person_name VARCHAR(100),
    authority_contact VARCHAR(15),
    playground_available BOOLEAN,
    coordinator_name VARCHAR(100),
    coordinator_number VARCHAR(15),
    FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE schools (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT,
    school_name VARCHAR(150),
    address TEXT,
    pin_code VARCHAR(10),
    state VARCHAR(100),
    language_medium VARCHAR(100),
    landline_no VARCHAR(20),
    principal_name VARCHAR(100),
    principal_contact VARCHAR(15),
    activity_coordinator VARCHAR(100),
    FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE other_areas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT,
    sponsor_name VARCHAR(100),
    coordinator_name VARCHAR(100),
    address TEXT,
    mobile VARCHAR(15),
    marketing_incharge VARCHAR(100),
    activity_agreement_pdf VARCHAR(255),
    FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE personal_tutors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT,
    participant_name VARCHAR(100),
    address TEXT,
    dob DATE,
    standard VARCHAR(50),
    batch VARCHAR(50),
    contact_number VARCHAR(15),
    teacher_for VARCHAR(100),
    FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE parent_consents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT,
    participant_name VARCHAR(100),
    dob DATE,
    age INT,
    society_name VARCHAR(150),
    activity_enrolled VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE kit_payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    participant_id INT, -- Links to individual_participants
    amount DECIMAL(10, 2),
    payment_status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    transaction_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES individual_participants(id)
);