const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../lib/prisma');

const getHealth = asyncHandler(async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;

  res.status(200).json({
    success: true,
    message: 'API is running',
    database: 'connected',
    timestamp: new Date().toISOString(),
  });
});

module.exports = {
  getHealth,
};