const db = require("../../../config/db");
const repo = require("./societyrepo");

exports.registerSociety = async (data) => {

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Create user
    const userId = await repo.insertUser(conn, data, "student");

    // 2. Create student
    const studentId = await repo.insertStudent(
      conn,
      userId,
      "group_coaching"
    );

    // 3. Create society
    const societyId = await repo.insertSociety(
      conn,
      data,
      studentId
    );

    await conn.commit();

    return {
      success: true,
      message: "Society registered successfully",
      data: {
        userId,
        studentId,
        societyId
      }
    };

  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.getSocieties = async () => {
    try {
        return await repo.getAllSocieties();
    } catch (error) {
        throw error;
    }
};
