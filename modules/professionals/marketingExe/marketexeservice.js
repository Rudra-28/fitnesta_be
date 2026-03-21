const db = require("../../../config/db");
const repo = require("./marketexerepository");
const validator = require("./marketexevalidate");

exports.createMarketExe = async (data) => {
  // Normalise types from multipart form body (all strings)
  data.ownTwoWheeler = (data.ownTwoWheeler === true || data.ownTwoWheeler === 'true') ? 1 : 0;

  // communicationLanguages: handle array, JSON string, or comma-separated
  if (Array.isArray(data.communicationLanguages)) {
    // already good — multer parsed multiple values with the same key
  } else if (typeof data.communicationLanguages === 'string') {
    const trimmed = data.communicationLanguages.trim();
    if (trimmed.startsWith('[')) {
      try { data.communicationLanguages = JSON.parse(trimmed); }
      catch (_) { data.communicationLanguages = []; }
    } else {
      data.communicationLanguages = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }
  } else {
    data.communicationLanguages = [];
  }

  // Convert DD/MM/YYYY → YYYY-MM-DD for MySQL (for both date and dob)
  const convertDate = (d) => {
    if (d && typeof d === 'string' && d.includes('/')) {
      const [day, month, year] = d.split('/');
      return `${year}-${month}-${day}`;
    }
    return d;
  };
  data.date = convertDate(data.date);
  data.dob  = convertDate(data.dob);

  const errors = validator.validateMarketexe(data);
  if (errors.length) {
      throw new Error(errors.join(", "));
  }

  const conn = await db.getConnection();
  try {
      await conn.beginTransaction();

      const userId = await repo.insertUser(conn, data, "professional");
      const professionalId = await repo.insertProfessional(conn, data, userId, "marketing_executive");
      await repo.insertMarketexe(conn, data, professionalId);

      await conn.commit();
      return { message: "Marketing Executive created successfully", id: userId };
  } catch (err) {
      await conn.rollback();
      throw err;
  } finally {
      conn.release();
  }
};

exports.getAllMarketexe = async () => {
  const marketexe = await repo.getAllMarketexe();
  return marketexe;
};