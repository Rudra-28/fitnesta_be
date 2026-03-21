const db = require("../../../config/db");
const repo = require("./otherarearepo");

exports.registerOtherarea = async (data) => {

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // NEW: Validation check for Marketing Executive
    const executiveId = await repo.findExecutiveByName(conn, data.marketingIncharge);
        
    if (!executiveId) {
        throw new Error(`Marketing Executive '${data.marketingIncharge}' does not exist.`);
    }
    // 1. Create user
    const userId = await repo.insertUser(conn, data, "student");
    // 2. Create student
    const studentId = await repo.insertStudent(
      conn,
      userId,
      "group_coaching"
    );
    // 3. Create society
    const areaId = await repo.insertOtherarea(
      conn,
      data,
      studentId
    );
    await conn.commit();
    return {
      success: true,
      message: "Area registered successfully",
      data: {
        userId,
        studentId,
        areaId,
      }
    };

  } catch (error) {
    await conn.rollback();
    throw error; // Let the controller handle the error and log it
  } finally {
    conn.release();
  }
};