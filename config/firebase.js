const admin = require("firebase-admin");

const serviceAccount = require("./fitnesta-2cf66-firebase-adminsdk-fbsvc-7721329073.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
module.exports = admin;