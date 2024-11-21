const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcryptjs');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');

const salt = bcrypt.genSaltSync(10);
const secret = 'asdfe45we45w345wegw345werjktjwertkj';

const upload = multer({ dest: 'uploads/' });

app.use(cors({ credentials: true, origin: 'http://localhost:3001' }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

mongoose.connect('mongodb+srv://wannabepirateluffy:WOpXhAkJ3hdSjHs6@cluster0.xjdbj.mongodb.net/?retryWrites=true&w=majority');

// Register Route
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (e) {
    console.log(e);
    res.status(400).json(e);
  }
});

// Login Route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  if (!userDoc) {
    return res.status(400).json('User not found');
  }

  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    // logged in
    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
      if (err) return res.status(500).json('Failed to generate token');
      res.cookie('token', token).json({
        id: userDoc._id,
        username,
      });
    });
  } else {
    res.status(400).json('Wrong credentials');
  }
});

// Profile Route
app.get('/profile', (req, res) => {
  const { token } = req.cookies;
  if (!token) return res.status(401).json('No token provided');

  jwt.verify(token, secret, {}, (err, info) => {
    if (err) return res.status(401).json('Invalid token');
    res.json(info);
  });
});

// Logout Route
app.post('/logout', (req, res) => {
  res.cookie('token', '', { expires: new Date(0) }).json('ok');
});

// Post Creation Route
app.post('/post', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json('No file uploaded');
  }

  const { originalname, path } = req.file;
  const parts = originalname.split('.');
  const ext = parts[parts.length - 1];
  const newPath = path + '.' + ext;
  fs.renameSync(path, newPath);

  const { token } = req.cookies;
  if (!token) return res.status(401).json('No token provided');

  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) return res.status(401).json('Invalid token');
    
    const { title, summary, content } = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: newPath,
      author: info.id,
    });
    res.json(postDoc);
  });
});

// Update Post Route
app.put('/post', upload.single('file'), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    newPath = path + '.' + ext;
    fs.renameSync(path, newPath);
  }

  const { token } = req.cookies;
  if (!token) return res.status(401).json('No token provided');

  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) return res.status(401).json('Invalid token');
    
    const { id, title, summary, content } = req.body;
    const postDoc = await Post.findById(id);
    if (!postDoc) {
      return res.status(404).json('Post not found');
    }

    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json('You are not the author');
    }

    await postDoc.updateOne({
      title,
      summary,
      content,
      cover: newPath ? newPath : postDoc.cover,
    });

    res.json(postDoc);
  });
});

// Get All Posts Route
app.get('/post', async (req, res) => {
  res.json(
    await Post.find()
      .populate('author', ['username'])
      .sort({ createdAt: -1 })
      .limit(20)
  );
});

// Get Single Post Route
app.get('/post/:id', async (req, res) => {
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate('author', ['username']);
  if (!postDoc) {
    return res.status(404).json('Post not found');
  }
  res.json(postDoc);
});

app.listen(4000, () => console.log('Server started on http://localhost:4000'));
