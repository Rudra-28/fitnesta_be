const db = require("../../config/db");

exports.insertUser = async (conn, data) => {
    const [result] = await conn.execute(
        `INSERT INTO users (role, full_name, mobile) VALUES (?, ?, ?)`,
        ['student', data.principalName, data.principalContact]
    );
    return result.insertId;
};

exports.insertSchool = async (conn, data, userId) => {  // 👈 accept userId
  const [result] = await conn.execute(
    `INSERT INTO schools 
      (user_id, school_name, address, pin_code, state, language_medium, landline_no, activity_coordinator, agreement_signed_by_authority) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,  // 👈 added user_id column
    [
      userId,                              // 👈 link to users table
      data.schoolName,
      data.address,
      data.pinCode,
      data.state,
      data.languageMedium,
      data.landlineNo,
      data.activityCoordinator,
      data.agreementSigned ? 1 : 0
    ]
  );
  return result.insertId;
};

exports.getSchoolByName = async (schoolName) => {
  const [rows] = await db.query(
    `SELECT id FROM schools WHERE LOWER(school_name) = LOWER(?) LIMIT 1`,
    [schoolName]
  );
  return rows.length ? rows[0] : null;
};

exports.getAllSchools = async () => {
  const [rows] = await db.query(
    `SELECT id, school_name, address, pin_code, state FROM schools ORDER BY school_name ASC`
  );
  return rows;
};