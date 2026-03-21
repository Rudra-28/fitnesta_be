// const repo = require("./trainerrepository");
// const validator = require("./validate");
// const db = require("../../../config/db");

// exports.createTrainer = async (data) => {
//   const conn = await db.getConnection();
//   try {
//       await conn.beginTransaction();
      
//       const userId = await repo.insertUser(conn, data);
//       const professionalId = await repo.insertProfessional(conn, data, userId, "trainer");
//       await repo.insertTrainer(conn, data, professionalId);
      
//       await conn.commit();
//       return { id: userId, message: "Trainer created successfully" };
//   } catch (err) {
//       await conn.rollback();
//       throw err; 
//   } finally {
//       conn.release();
//   }
// };

// exports.getAllTrainers = async () => {
//   return await repo.getAllTrainers();
// };


const repo = require("./trainerrepository");
const validator = require("./validate");
const db = require("../../../config/db");

exports.createTrainer = async (data) => {
    // 1. Validate the data first (ensure your validator is called)
    const errors = validator.validateTrainer(data);
    if (errors && errors.length > 0) {
        throw new Error(errors.join(", "));
    }

    // 2. FIX: Convert "DD/MM/YYYY" to "YYYY-MM-DD"
    if (data.date && data.date.includes("/")) {
        const [day, month, year] = data.date.split("/");
        // Overwrite data.date with the format MySQL expects
        data.date = `${year}-${month}-${day}`; 
    }

    data.ownTwoWheeler = (data.ownTwoWheeler === true || data.ownTwoWheeler === 'true') ? 1 : 0;
  data.ownFourWheeler = (data.ownFourWheeler === true || data.ownFourWheeler === 'true') ? 1 : 0;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        
        // Now data.date is "2026-03-20", so these repo calls will succeed
        const userId = await repo.insertUser(conn, data);
        const professionalId = await repo.insertProfessional(conn, data, userId, "trainer");
        await repo.insertTrainer(conn, data, professionalId);
        
        await conn.commit();
        return { id: userId, message: "Trainer created successfully" };
    } catch (err) {
        await conn.rollback();
        throw err; 
    } finally {
        conn.release();
    }
};

exports.getAllTrainers = async () => {
    return await repo.getAllTrainers();
};