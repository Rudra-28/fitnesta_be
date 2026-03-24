const db = require("../../config/db");

const findUserByMobile = async (mobile) => {
  const [rows] = await db.query(
    `SELECT 
        id, 
        mobile, 
        role, 
        email, 
        full_name, 
        is_verified
     FROM users
     WHERE mobile = ?
     LIMIT 1`,
    [mobile]
  );
  return rows.length ? rows[0] : null;
};

const findProfessionalByUserIdAndType = async (userId, professionType) => {
  const [rows] = await db.query(
    `SELECT id FROM professionals WHERE user_id = ? AND profession_type = ? LIMIT 1`,
    [userId, professionType]
  );
  return rows.length ? rows[0] : null;
};

const findStudentByUserIdAndType = async (userId, studentType) => {
  const [rows] = await db.query(
    `SELECT id FROM students WHERE user_id = ? AND student_type = ? LIMIT 1`,
    [userId, studentType]
  );
  return rows.length ? rows[0] : null;
};

const findProfessionalsByUserId = async (userId) => {
  const [rows] = await db.query(
    `SELECT profession_type FROM professionals WHERE user_id = ?`,
    [userId]
  );
  return rows;
};

const findStudentsByUserId = async (userId) => {
  const [rows] = await db.query(
    `SELECT student_type FROM students WHERE user_id = ?`,
    [userId]
  );
  return rows;
};

const markUserVerified = async (userId) => {
  await db.query(
    `UPDATE users 
     SET is_verified = 1 
     WHERE id = ?`,
    [userId]
  );
};

module.exports = {
  findUserByMobile,
  findProfessionalByUserIdAndType,
  findStudentByUserIdAndType,
  findProfessionalsByUserId,
  findStudentsByUserId,
  markUserVerified
};