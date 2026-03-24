require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Only versioned routes
const v1Routes = require('./routes/v1');
app.use('/api/v1', v1Routes);

app.listen(5000, () => {
  console.log("Server running on port 5000");
});