// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt'); // ✅ Correct import
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => {
  const now = new Date().toISOString();
  console.log(`[${now}] ${req.method} ${req.originalUrl}`);
  next(); 
});

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// Mongoose Schema
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  age: Number,
  password: String,
});

const User = mongoose.model('User', UserSchema);

// REGISTER route
app.post('/register', async (req, res) => {
  try {
    const { name, email, age, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10); 

    const user = new User({
      name,
      email,
      age,
      password: hashedPassword,
    });

    await user.save();
    res.status(200).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
});


app.post('/authenticate', async (req, res) => {
  const { name, email, age, password } = req.body;

  try {
    const user = await User.findOne({ name, email, age });

    if (!user) {
      return res.status(404).json({ exists: false, message: "No user found" });
    }

    const isMatch = await bcrypt.compare(password, user.password); 
    if (!isMatch) {
      return res.status(401).json({ exists: false, message: "Invalid password" });
    }

    res.status(200).json({ exists: true, user });
  } catch (err) {
    console.error('Error during authentication:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
