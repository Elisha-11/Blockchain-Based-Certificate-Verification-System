require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/certificates', require('./routes/certificateRoutes'));

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    connection.release(); // Return connection to pool
    res.json({ status: 'OK', database: 'Connected', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error(' DB Connection Failed:', error.message);
    res.status(500).json({ status: 'ERROR', database: 'Disconnected', error: error.message });
  }
});
// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Certificate Verification API', version: '1.0.0' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log(' Cert Verification Backend');
  console.log(`🔗 Server running on http://127.0.0.1:${PORT}`);
  console.log('');
});