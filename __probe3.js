require("dotenv").config()
const request = require("supertest")
const app = require("./src/app")
;(async () => {
  const gets = [
    "/api/blog", "/api/v1/blog",
    "/api/products", "/api/v1/products",
    "/api/services", "/api/v1/services",
    "/api/portfolio", "/api/v1/portfolio",
  ]
  for (const p of gets) {
    const r = await request(app).get(p)
    console.log(`${r.status === 200 ? "  " : "!!"} GET  ${String(r.status).padEnd(4)} ${p}`)
  }
  for (const p of ["/api/contact", "/api/v1/contact"]) {
    const r = await request(app).post(p).send({})
    console.log(`${[200,400,422,429].includes(r.status) ? "  " : "!!"} POST ${String(r.status).padEnd(4)} ${p}  ${(r.body?.error?.code || r.body?.message || "").toString().slice(0,50)}`)
  }
  process.exit(0)
})().catch((e) => { console.error("FATAL", e.message); process.exit(1) })
