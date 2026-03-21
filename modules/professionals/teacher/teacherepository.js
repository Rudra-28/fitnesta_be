const db = require("../../../config/db");

exports.insertUser = async (conn, data) => {
  const [result] = await conn.execute(
    `INSERT INTO users 
    (role, subrole, full_name, mobile, email, address)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'professional',
      'teacher',
      data.fullName,
      data.contactNumber,
      data.email,
      data.address
    ]
  );
  return result.insertId;
};

exports.insertProfessional = async (conn, data, userId, type) => {
  const [result] = await conn.execute(
    `INSERT INTO professionals
    (user_id, profession_type, pan_card, adhar_card, relative_name, relative_contact, own_two_wheeler, communication_languages, place, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      type,
      data.panCard,
      data.adharCard,
      data.relativeName,
      data.relativeContact,
      data.ownTwoWheeler ? 1 : 0,
      JSON.stringify(data.communicationLanguages || []),
      data.place,
      data.date
    ]
  );
  return result.insertId;
};

exports.insertTeacher = async (conn, data, professionalId) => {
  await conn.execute(
    `INSERT INTO teachers
    (professional_id, subject, experience_details, ded_doc, bed_doc, other_doc)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      professionalId,
      data.subject,
      data.experienceDetails,
      data.dedDoc,
      data.bedDoc,
      data.otherDoc,
    ]
  );
};

exports.getAllTeachers = async () => {

    const [rows] = await db.execute(
      `SELECT 
        u.id AS user_id,
        u.full_name,
        u.mobile,
        u.email,
        u.address,
  
        p.id AS professional_id,
        p.pan_card,
        p.adhar_card,
        p.relative_name,
        p.relative_contact,
        p.own_two_wheeler,
        p.communication_languages,
        p.place,
        p.date,
  
        t.id AS teacher_id,
        t.subject,
        t.experience_details,
        t.ded_doc,
        t.bed_doc,
        t.other_doc
  
       FROM teachers t
  
       JOIN professionals p 
       ON t.professional_id = p.id
  
       JOIN users u 
       ON p.user_id = u.id`
    );
  
    return rows;
  };