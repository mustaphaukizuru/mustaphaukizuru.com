const app = require('./app');
const prisma = require('./lib/prisma');
const { port } = require('./config/env');

async function startServer() {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');

    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();