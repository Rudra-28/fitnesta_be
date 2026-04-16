const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");
const path = require("path");

// Strip extension from filename for use as Cloudinary public_id.
// Cloudinary appends the extension itself, so including it causes double-extension (e.g. file.pdf.pdf).
const publicId = (originalname) =>
    `${Date.now()}-${originalname.replace(/\s+/g, "_").replace(/[^\w.-]/g, "").replace(/\.[^.]+$/, "")}`;

const isPdf = (file) =>
    path.extname(file.originalname).toLowerCase() === ".pdf" ||
    file.mimetype === "application/pdf";

// PDFs must use resource_type "raw" — using "auto" or "image" stores them
// under the wrong resource type, causing 404s when fetching via /raw/upload/.
// Images must use resource_type "image".
// We use two separate storage instances and select at upload time.
const imageStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
        folder:           "fitnesta/documents",
        resource_type:    "image",
        allowed_formats:  ["jpg", "jpeg", "png"],
        public_id:        publicId(file.originalname),
    }),
});

const rawStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
        folder:           "fitnesta/documents",
        resource_type:    "raw",
        allowed_formats:  ["pdf"],
        public_id:        publicId(file.originalname),
    }),
});

// Custom multer storage that routes PDFs → rawStorage, images → imageStorage
const documentStorage = {
    _handleFile(req, file, cb) {
        const delegate = isPdf(file) ? rawStorage : imageStorage;
        delegate._handleFile(req, file, cb);
    },
    _removeFile(req, file, cb) {
        const delegate = isPdf(file) ? rawStorage : imageStorage;
        delegate._removeFile(req, file, cb);
    },
};

const upload = multer({
    storage: documentStorage,
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
