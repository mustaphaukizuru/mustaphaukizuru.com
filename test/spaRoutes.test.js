const { matchesSpaRoute } = require("../src/utils/spaRoutes")

describe("matchesSpaRoute", () => {
  test.each([
    "/", "/about", "/blog", "/store/my-product", "/blog/hello-world", "/services/web-design",
    "/projects/school-portal", "/recommendations/laptop", "/book/consulting",
    "/checkout/success/ord_123", "/login", "/reset-password/abc123",
    "/dashboard", "/dashboard/orders/42", "/admin", "/admin/products/9/edit",
    "/es", "/es/about", "/es/store/producto", "/es/blog/hola", "/about?utm=x", "/about/",
  ])("matches %s", (p) => expect(matchesSpaRoute(p)).toBe(true))

  test.each([
    "/nope", "/store/a/b", "/blogs/x", "/es/admin", "/es/dashboard",
    "/services/x/y", "/checkout/success", "/api/anything", "/wp-admin.php", "/es/self-audit",
  ])("rejects %s", (p) => expect(matchesSpaRoute(p)).toBe(false))
})
