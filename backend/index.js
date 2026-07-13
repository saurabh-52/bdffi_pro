require('dotenv').config();
const express = require('express');
const { ensureAllTables } = require('./db/database');
const apiRoutes = require('./routes');

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json({ limit: '10mb' }));

// Mount modular routes
app.use('/api', apiRoutes);

// Verify DB tables and start server
ensureAllTables()
  .then(() => {
    console.log('Database tables successfully verified and seeded.');
    app.listen(port, () => {
      console.log(`BDFFI backend listening on port ${port}`);
    });
  })
  .catch(err => {
    console.error('Database migration/seed check failed on startup:', err);
    // Best-effort startup fallback
    app.listen(port, () => {
      console.log(`BDFFI backend listening on port ${port} (DB Offline)`);
    });
  });