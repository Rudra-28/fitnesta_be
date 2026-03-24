const db = require("../../../config/db");

exports.insertUser = async(conn, data)=>{
    const[result]=await conn.execute(
        `INSERT INTO users (mobile, role) VALUES (?,?)`,
        [
            data.mobile,
            "student"  
        ]
    );
    return result.insertId;
}

exports.insertStudent = async(conn, userId, type)=>{
    const[result]=await conn.execute(
        `INSERT INTO students (user_id, student_type) VALUES (?,?)`,
        [
            userId,
            type
        ]
    );
    return result.insertId;
}

exports.insertOtherarea = async (conn, data, studentId) => {

  const [result] = await conn.execute(
    `INSERT INTO other_areas
    (student_id, sponsor_name, coordinator_name, address, marketing_incharge, activity_agreement_pdf)
     VALUES (?,?,?,?,?,?)`,
    [
      studentId,
      data.sponsorName,
      data.coordinatorName,
      data.address,
      data.marketingIncharge,
      data.activityAgreementPdf
    ]
  );

  return result.insertId;
};

// Add this to otherarearepo.js
exports.findExecutiveByName = async (conn, name) => {
  const [rows] = await conn.execute(
      `SELECT me.id
       FROM marketing_executives me
       JOIN professionals p ON me.professional_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE u.full_name = ?`,
      [name]
  );
  return rows.length > 0 ? rows[0].id : null;
};
