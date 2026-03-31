const { PrismaClient } = require("@prisma/client")

let prisma

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    errorFormat: "pretty",
  })
}

if (process.env.NODE_ENV === "production") {
  prisma = createClient()
} else {
  if (!global.__prisma) {
    global.__prisma = createClient()
  }
  prisma = global.__prisma
}

// Non-blocking connect with retries
;(async () => {
  for (let i = 1; i <= 5; i++) {
    try {
      await prisma.$connect()
      console.log("Database connected")
      return
    } catch (e) {
      console.error(`DB attempt ${i}/5: ${e.message}`)
      if (i < 5) {
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }
  }
  console.warn("DB unavailable — server running, DB operations will retry")
})()

module.exports = prisma