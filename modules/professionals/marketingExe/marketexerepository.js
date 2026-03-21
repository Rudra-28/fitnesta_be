const db = require("../../../config/db");

exports.insertUser = async (conn, data, type) => {

  const mobileNumber = data.contactNumber || data.mobile || null;
  const [result] = await conn.execute(
    `INSERT INTO users (role, subrole, full_name, photo, mobile, address) VALUES (?,?,?,?,?,?)`,
    [
      type, // 'professional'
      'marketing_executive',
      data.fullName ?? null,
      data.photo ?? null, 
      data.contactNumber,
      data.address ?? null
    ]
  );
  return result.insertId;
};

exports.insertProfessional = async (conn, data, userId, type) => {
  const [result] = await conn.execute(
    `INSERT INTO professionals (user_id, profession_type, pan_card, adhar_card, relative_name, relative_contact, own_two_wheeler, communication_languages, place, date)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      userId ?? null,
      type ?? null,
      data.panCard ?? null,
      data.adharCard ?? null,
      data.relativeName ?? null,
      data.relativeContact ?? null,
      data.ownTwoWheeler ? 1 : 0,
      data.communicationLanguages ? JSON.stringify(data.communicationLanguages) : null,
      data.place ?? null,
      data.date ?? null
    ]
  );
  return result.insertId;
};

exports.insertMarketexe = async (conn, data, professionalId) => {
  const [result] = await conn.execute(
    `INSERT INTO marketing_executives (professional_id, dob, education_qualification, previous_experience, activity_agreement_pdf)
     VALUES (?,?,?,?,?)`,
    [
      professionalId ?? null,
      data.dob ?? null,
      data.educationQualification ?? null,
      data.previousExperience ?? null,
      data.activityAgreementsPdf ?? null
    ]
  );
  return result.insertId; 
};

exports.getAllMarketexe = async () => {
  const [rows] = await db.execute(
    `SELECT 
      u.id          AS user_id,
      u.full_name,
      u.mobile,
      u.address,
      u.photo,

      p.id          AS professional_id,
      p.pan_card,
      p.adhar_card,
      p.relative_name,
      p.relative_contact,
      p.own_two_wheeler,
      p.communication_languages,
      p.place,
      p.date,

      m.id          AS market_exe_id,
      m.dob,
      m.education_qualification,
      m.previous_experience,
      m.activity_agreement_pdf

     FROM marketing_executives m

     JOIN professionals p
     ON m.professional_id = p.id

     JOIN users u
     ON p.user_id = u.id`
  );
  return rows;
};