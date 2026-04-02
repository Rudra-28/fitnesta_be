const repo = require("./trainerdashboardrepo");

async function getUpcomingSessions(userId) {
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  return repo.getUpcomingSessions(professionalId);
}

async function getSessionHistory(userId) {
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  return repo.getSessionHistory(professionalId);
}

async function getTrainerBatches(userId) {
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  return repo.getTrainerBatches(professionalId);
}

module.exports = { getUpcomingSessions, getSessionHistory, getTrainerBatches };
