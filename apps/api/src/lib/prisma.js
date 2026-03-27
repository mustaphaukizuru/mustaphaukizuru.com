const { PrismaClient } = require("@prisma/client");

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Prisma client with connection retry and graceful error handling
// ─────────────────────────────────────────────────────────────────────────────

let prisma;

const DB_CONNECT_RETRIES = 3;
const DB_RETRY_DELAY_MS  = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["warn", "error"]
      : ["error"],
    errorFormat: "pretty",
  });
}

if (process.env.NODE_ENV === "production") {
  prisma = createPrismaClient();
} else {
  // Prevent multiple instances in development (hot-reload)
  if (!global.__prisma) {
    global.__prisma = createPrismaClient();
  }
  prisma = global.__prisma;
}

/**
 * Attempt to connect to the database with retries.
 * Logs a clear message if the DB is unreachable — does NOT crash the server.
 */
async function connectWithRetry(retries = DB_CONNECT_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await prisma.$connect();
      console.log("✓ Database connected successfully");
      return true;
    } catch (err) {
      const isLastAttempt = attempt === retries;
      const reason = err?.message || String(err);

      if (reason.includes("Can't reach database")) {
        console.error(
          `✗ Database unreachable (attempt ${attempt}/${retries}): ${reason}`
        );
        console.error(
          "  → Check that your MySQL server is running at the configured host/port."
        );
        console.error(`  → DATABASE_URL: ${process.env.DATABASE_URL ? "(set)" : "(missing!)"}`);
      } else {
        console.error(`✗ Database connection error (attempt ${attempt}/${retries}):`, reason);
      }

      if (!isLastAttempt) {
        console.log(`  Retrying in ${DB_RETRY_DELAY_MS / 1000}s…`);
        await sleep(DB_RETRY_DELAY_MS);
      }
    }
  }

  console.error(
    "\n⚠  All database connection attempts failed.\n" +
    "   The API server will start but database operations will return 503 errors.\n" +
    "   Please check your DATABASE_URL environment variable and database server.\n"
  );
  return false;
}

// Connect on startup — non-blocking
connectWithRetry();

module.exports = prisma;
