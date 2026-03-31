const productService = require("../services/productService");

async function listProducts(req, res, next) {
  try {
    const products = await productService.getAllProducts({
      category: req.query.category || "",
      featured: req.query.featured || "",
      new: req.query.new || "",
      search: req.query.search || "",
    });

    // Cache public product listings for 30 seconds (CDN + browser)
    // Invalidated on next publish/update cycle
    if (!req.query.search) {
      res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60")
    }
    res.json({ data: products });
  } catch (error) {
    next(error);
  }
}

async function getProduct(req, res, next) {
  try {
    const product = await productService.getProductBySlug(req.params.slug);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ data: product });
  } catch (error) {
    next(error);
  }
}

async function listCategories(req, res, next) {
  try {
    const categories = await productService.getCategories();
    res.json({ data: categories });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listProducts,
  getProduct,
  listCategories,
};