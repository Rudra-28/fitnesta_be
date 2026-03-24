require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3306;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Only versioned routes
const v1Routes = require('./routes/v1');
app.use('/api/v1', v1Routes);

app.listen(PORT, () => {
  console.log("Server running on port 3306");
});