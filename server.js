// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());


mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});


const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  
});

const User = mongoose.model('User', UserSchema);


app.post('/register', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(200).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed', details: err });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
