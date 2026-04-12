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
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/;
    const ext  = allowed.test(file.originalname.split(".").pop().toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error("Only JPG, PNG, and PDF files are allowed"));
  },
});

module.exports = upload;

// ── Activity images (jpg/png only, stored in fitnesta/activities) ─────────
const activityImageStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:           "fitnesta/activities",
    resource_type:    "image",
    allowed_formats:  ["jpg", "jpeg", "png"],
    public_id:        `activity-${Date.now()}-${file.originalname.replace(/\s+/g, "_").replace(/[^\w.-]/g, "")}`,
  }),
});

const activityImageFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png/;
  if (allowed.test(file.originalname.split(".").pop().toLowerCase()) && allowed.test(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error("Only JPG and PNG files are allowed for activity images"));
};

module.exports.uploadActivityImage = multer({
  storage:    activityImageStorage,
  limits:     { fileSize: 2 * 1024 * 1024 },
  fileFilter: activityImageFilter,
});
