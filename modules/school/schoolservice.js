const db = require("../../config/db"); 
const repo = require("./schoolrepo");

exports.registerSchool = async (data) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const userId   = await repo.insertUser(conn, data);
    const schoolId = await repo.insertSchool(conn, data, userId);

    await conn.commit();
    return { schoolId, userId };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.getSchools = async () => {
  try {
    const schools = await repo.getAllSchools();
    return schools;
  } catch (error) {
    throw error;
  }
};
