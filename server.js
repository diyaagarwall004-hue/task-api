const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const cronRoutes = require('./routes/cronRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/tasks', taskRoutes);
app.use('/api/auth', userRoutes);
app.use('/api/cron', cronRoutes);

app.use(express.static(path.join(__dirname, 'frontend')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));