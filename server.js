require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key';

app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB error:', err));

// User Schema
const UserSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  email: String,
  age: Number,
  password: String,
  image: String
});
const User = mongoose.model('User', UserSchema);

// ✅ Message Schema
const MessageSchema = new mongoose.Schema({
  from: String,
  to: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// Auth Routes
app.post('/register', async (req, res) => {
  try {
    const { name, email, age, image ,  password } = req.body;
    console.log(req.body);

    const existing = await User.findOne({ name });
    if (existing) return res.status(400).json({ message: 'Name already taken' });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, age, image ,  password: hashed });
    await user.save();

    res.status(200).json({ message: 'User registered' });
  } catch {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/authenticate', async (req, res) => {
  const { name, password } = req.body;
  try {
    const user = await User.findOne({ name });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Wrong password' });

    const token = jwt.sign({ id: user._id, name: user.name }, SECRET_KEY, { expiresIn: '1h' });
    res.status(200).json({ message: 'Login successful', token });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});


app.get('/username/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const user = await User.findOne({ name }).select('-password'); // Exclude password

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(user); // Will include: name, email, age, image
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


app.get('/verify-token', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET_KEY, (err) => {
    if (err) return res.sendStatus(403);
    res.status(200).json({ valid: true });
  });
});

// ✅ Get message history between two users
app.get('/messages/:user1/:user2', async (req, res) => {
  const { user1, user2 } = req.params;
  try {
    const messages = await Message.find({
      $or: [
        { from: user1, to: user2 },
        { from: user2, to: user1 }
      ]
    }).sort({ timestamp: 1 });

    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Socket.IO logic
const userMap = new Map();

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('register-name', (name) => {
    userMap.set(name, socket.id);
    console.log(`Registered: ${name} -> ${socket.id}`);
    emitOnlineUsers();
  });

  socket.on('private-message', async ({ targetName, message }) => {
    const fromName = [...userMap.entries()].find(([_, id]) => id === socket.id)?.[0] || 'unknown';
    const targetSocketId = userMap.get(targetName);

    if (targetSocketId) {
      socket.to(targetSocketId).emit('private-message', { from: fromName, message });
    }

    // ✅ Save message to MongoDB
    try {
      await Message.create({ from: fromName, to: targetName, message });
    } catch (err) {
      console.error('Failed to save message:', err);
    }
  });

  socket.on('disconnect', () => {
    for (const [name, id] of userMap.entries()) {
      if (id === socket.id) {
        userMap.delete(name);
        break;
      }
    }
    emitOnlineUsers();
    console.log(`Disconnected: ${socket.id}`);
  });

  function emitOnlineUsers() {
    io.emit('online-users', Array.from(userMap.keys()));
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
