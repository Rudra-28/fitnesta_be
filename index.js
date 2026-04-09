require('dotenv').config();
const express = require('express');
const { startMarkAbsentJob } = require('./jobs/markAbsentSessions');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({
    verify: (req, _res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: true }));

// ✅ Only versioned routes
const v1Routes = require('./routes/v1');
app.use('/api/v1', v1Routes);

// ✅ Fallback for frontend Dio trailing slash bug
app.use('/auth', require('./modules/auth/authroute'));

// ✅ Global error handler
app.use((err, req, res, next) => {
    console.error("Global error handler caught:", err.message);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
});

app.listen(PORT, () => {
  console.log("Server running on port 5000");
  startMarkAbsentJob();
});