const validator =require("./validate");
const db = require("../../../config/db");
const repo = require("./teacherepository");

exports.createTeacher = async (data) => {
  // Normalise types coming from multipart form body (all strings)
  data.ownTwoWheeler = (data.ownTwoWheeler === true || data.ownTwoWheeler === 'true') ? true : false;

  // Handle all ways a client can send an array in multipart/form-data:
  // 1. Already an array (multer collected multiple fields with the same key)
  // 2. A JSON string like '["English","Hindi"]'
  // 3. A comma-separated plain string like 'English,Hindi,Gujarati'
  if (Array.isArray(data.communicationLanguages)) {
    // already good — multer parsed multiple values with the same key
  } else if (typeof data.communicationLanguages === 'string') {
    const trimmed = data.communicationLanguages.trim();
    if (trimmed.startsWith('[')) {
      try {
        data.communicationLanguages = JSON.parse(trimmed);
      } catch (_) {
        data.communicationLanguages = [];
      }
    } else {
      // treat as comma-separated
      data.communicationLanguages = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }
  } else {
    data.communicationLanguages = [];
  }

  // Convert DD/MM/YYYY → YYYY-MM-DD for MySQL
  if (data.date && data.date.includes("/")) {
    const [day, month, year] = data.date.split("/");
    data.date = `${year}-${month}-${day}`;
  }

  const errors = validator.validateTeacher(data);
  if (errors.length) {
    throw new Error(`Validation Failed: ${errors.join(", ")}`);
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Log the steps to see how far the code gets before crashing
    console.log("Step 1: Inserting User...");
    const userId = await repo.insertUser(conn, data);

    console.log("Step 2: Inserting Professional...");
    const professionalId = await repo.insertProfessional(conn, data, userId, "teacher");

    console.log("Step 3: Inserting Teacher...");
    await repo.insertTeacher(conn, data, professionalId);

    await conn.commit();
    console.log("Success: Transaction Committed");
    return { message: "Teacher created successfully. Redirecting to login screen.", id: userId };

  } catch (err) {
    if (conn) await conn.rollback();
    
    // Customize the error message based on common MySQL issues
    if (err.code === 'ER_DUP_ENTRY') {
       err.message = "This mobile number or email is already registered.";
    } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
       err.message = "Linking error: One of the IDs provided does not exist.";
    }

    throw err; // Pass it to the controller's console.error
  } finally {
    if (conn) conn.release();
  }
};

exports.getAllTeachers = async () => {
  const teachers = await repo.getAllTeachers();
  return teachers;
};