const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:        "fitnesta/documents",
    resource_type: "auto",          // handles both images and PDFs
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
    public_id: `${Date.now()}-${file.originalname.replace(/\s+/g, "_").replace(/[^\w.-]/g, "")}`,
  }),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/;
    const ext  = allowed.test(file.originalname.split(".").pop().toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error("Only JPG, PNG, and PDF files are allowed"));
  },
});

module.exports = upload;
