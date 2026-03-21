const db = require("../../config/db");

exports.insertSchool = async (data) => {
  const [result] = await db.execute(
    `INSERT INTO schools 
      (school_name, address, pin_code, state, language_medium, landline_no, principal_name, principal_contact, activity_coordinator, agreement_signed_by_authority) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.schoolName,
      data.address,
      data.pinCode,
      data.state,
      data.languageMedium,
      data.landlineNo,
      data.principalName,
      data.principalContact,
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
