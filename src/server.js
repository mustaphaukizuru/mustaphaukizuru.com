const app      = require("./app")
const { port } = require("./config/env")

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`)
})

process.on("unhandledRejection", (reason) => {
  console.error("[UnhandledRejection]", reason)
})

process.on("uncaughtException", (err) => {
  console.error("[UncaughtException]", err.message)
})
