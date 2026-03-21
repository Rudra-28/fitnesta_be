const db = require("../../../config/db");

exports.insertUser = async (conn,data)=>{

const [result] = await conn.execute(

`INSERT INTO users 
(role, subrole, full_name,mobile,email,address,photo)
VALUES (?,?,?,?,?,?,?)`,

[
'professional',
'trainer',
data.fullName,
data.contactNumber,
data.email,
data.address,
data.photo
]  
);
return result.insertId;
};

exports.insertProfessional = async (conn, data, userId, type) => {
  const [result] = await conn.execute(
    `INSERT INTO professionals
     (user_id, profession_type, pan_card, adhar_card, relative_name, relative_contact, own_two_wheeler, communication_languages, place, date)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      userId,
      type,
      data.panCard                ?? null,
      data.adharCard              ?? null,
      data.relativeName           ?? null,
      data.relativeContact        ?? null,
      data.ownTwoWheeler          ?? null,
      data.communicationLanguages ? JSON.stringify(data.communicationLanguages) : null,
      data.place                  ?? null,
      data.date                   ?? null,
    ]
  );
  return result.insertId;
};

exports.insertTrainer = async (conn,data,professionalId)=>{

const [result]= await conn.execute(

`INSERT INTO trainers
(professional_id,player_level,category,specified_game,specified_skills,experience_details,qualification_docs, documents)
VALUES (?,?,?,?,?,?,?,?)`,

[
professionalId,
data.playerLevel,
data.category,
JSON.stringify(data.specifiedGame),      
JSON.stringify(data.specifiedSkills),  
data.experienceDetails,
data.qualificationDocs,
data.documents          ?? null, 
]
);
return result.insertId;
};
