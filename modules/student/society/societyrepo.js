const db = require("../../../config/db");

exports.insertUser = async (conn, data) => {
  const [result] = await conn.execute(
    `INSERT INTO users (mobile, role) VALUES (?,?)`,
    [
      data.mobile,
      "student"
    ]
  );
  return result.insertId;
}

exports.insertStudent = async (conn, userId, type) => {
  const [result] = await conn.execute(
    `INSERT INTO students (user_id, student_type) VALUES (?,?)`,
    [
      userId,
      type
    ]
  );
  return result.insertId;
}

exports.insertSociety = async (conn, data, studentId) => {

  const isAgreementSigned = data.isAgreementSigned ? 1 : 0;

  const [result] = await conn.execute(
    `INSERT INTO societies
    (student_id, society_name, society_category, address, pin_code,
     total_participants, proposed_wing, authority_role,
     authority_person_name, authority_contact,
     playground_available, coordinator_name, coordinator_number,
     agreement_signed_by_authority)
     
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      studentId,
      data.societyName,
      data.societyCategory,
      data.address,
      data.pinCode,
      data.totalParticipants,
      data.proposedWing,
      data.authorityRole,
      data.authorityPersonName,
      data.authorityContact,
      data.playgroundAvailable,
      data.coordinatorName,
      data.coordinatorNumber,
      isAgreementSigned
    ]
  );

  return result.insertId;
};

exports.getAllSocieties = async () => {
    const [rows] = await db.query(
      `SELECT id, society_name, address, pin_code, society_category FROM societies ORDER BY society_name ASC`
    );
    return rows;
};