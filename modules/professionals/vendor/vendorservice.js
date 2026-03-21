const db = require("../../../config/db");
const repo = require("./vendorrepository");
const validator = require("./vendorvalidate");

exports.createVendors = async (data)=>{
console.log(validator);

console.time("DB");

const errors = validator.validateVendors(data);


if(errors.length){
throw new Error(errors.join(", "));
}
const conn = await db.getConnection();
try{
await conn.beginTransaction();
const userId = await repo.insertUser(conn,data);
const professionalId = await repo.insertProfessional(conn,data,userId, "vendor");
await repo.insertVendors(conn,data,professionalId);

console.timeEnd("DB");

await conn.commit();
return {message:"Vendor registration done, now login to verify your account.", id: userId };
}
catch(err){
await conn.rollback();
throw err;
}
finally{
conn.release();
}
};
exports.getAllVendors = async () => {
  const vendors = await repo.getAllVendors();
  return vendors;
};
