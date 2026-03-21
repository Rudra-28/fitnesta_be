const db = require("../../../config/db");

exports.insertUser = async (conn,data)=>{

const [result] = await conn.execute(

`INSERT INTO users 
(role, subrole, full_name,mobile,email,address)
VALUES (?,?,?,?,?,?)`,

[
'professional',
'vendor',
data.fullName,
data.contactNumber,
data.email,
data.address,
]
);
return result.insertId;
};

exports.insertProfessional = async (conn,data,userId,type)=>{

const [result] = await conn.execute(

`INSERT INTO professionals
(user_id, profession_type, pan_card,adhar_card)
VALUES (?,?,?,?)`,

[
userId,
type,
data.panCard,
data.adharCard,
]
);

return result.insertId;
};

exports.insertVendors = async (conn,data,professionalId)=>{
await conn.execute(
`INSERT INTO vendors
(professional_id, store_name, store_address, store_location, gst_certificate)
VALUES (?,?,?,?,?)`,
[
professionalId,
data.storeName,
data.storeAddress,
data.storeLocation,
data.GSTCertificate
]
);  
};
exports.getAllVendors = async () => {
  const [rows] = await db.execute(
    `SELECT 
      u.id AS user_id,
      u.full_name,
      u.mobile,
      u.email,
      u.address,

      p.id AS professional_id,
      p.pan_card,
      p.adhar_card,

      v.id AS vendor_id,
      v.store_name,
      v.store_address,
      v.store_location,
      v.gst_certificate

     FROM vendors v

     JOIN professionals p 
     ON v.professional_id = p.id

     JOIN users u 
     ON p.user_id = u.id`
  );
  return rows;
};