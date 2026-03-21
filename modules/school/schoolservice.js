const repo = require("./schoolrepo");

exports.registerSchool = async (data) => {
  try {
    const schoolId = await repo.insertSchool(data);
    return schoolId;
  } catch (error) {
    throw error;
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
