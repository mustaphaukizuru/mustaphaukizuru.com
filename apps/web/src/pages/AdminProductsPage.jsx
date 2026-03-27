import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { deleteAdminProduct, fetchAdminProducts } from "../services/adminProductService"
import { useToast } from "../context/ToastContext"
function StatusBadge({ active }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[12px] font-medium ${
        active ? "bg-[#e5f4e8] text-[#3b8f47]" : "bg-[#f2f2f2] text-[#666]"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  )
}

function FlagText({ featured, isNew }) {
  if (featured && isNew) return "Featured • New"
  if (featured) return "Featured"
  if (isNew) return "New"
  return "—"
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const { showSuccess, showError } = useToast()
  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    try {
      setLoading(true)
      setErrorMessage("")
      const data = await fetchAdminProducts()
      setProducts(Array.isArray(data) ? data : [])
    } catch (error) {
      setErrorMessage(error.message || "Failed to load products.")
    } finally {
      setLoading(false)
    }
  }

  const metrics = useMemo(() => {
    return {
      total: products.length,
      active: products.filter((p) => p.isActive).length,
      featured: products.filter((p) => p.isFeatured).length,
      files: products.reduce((sum, p) => sum + (p.files?.length || 0), 0),
    }
  }, [products])

async function handleDelete(id) {
  const confirmed = window.confirm("Delete this product?")
  if (!confirmed) return

  try {
    setErrorMessage("")
    await deleteAdminProduct(id)
    await loadProducts()
    showSuccess("Product deleted successfully.")
  } catch (error) {
    setErrorMessage(error.message || "Failed to delete product.")
    showError(error.message || "Failed to delete product.")
  }
}

  return (
    <section className="space-y-5">
  <div className="flex items-center justify-between">
  <div>
    <h2 className="text-[18px] font-semibold text-[#420060]">Product Catalog</h2>
    <p className="mt-1 text-[12px] text-[#634F40]/70">
      Create, edit, delete, and manage products, files, and media.
    </p>
  </div>

  <Link
    to="/admin/products/new"
    className="inline-flex items-center gap-2 rounded-xl bg-[#420060] px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-[#2d003f]"
  >
    New Product
  </Link>
</div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
          <div className="text-[12px] text-[#634F40]/70">Total Products</div>
          <div className="mt-3 text-[28px] font-bold text-[#420060]">{metrics.total}</div>
        </div>
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
          <div className="text-[12px] text-[#634F40]/70">Active</div>
          <div className="mt-3 text-[28px] font-bold text-[#3b8f47]">{metrics.active}</div>
        </div>
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
          <div className="text-[12px] text-[#634F40]/70">Featured</div>
          <div className="mt-3 text-[28px] font-bold text-[#420060]">{metrics.featured}</div>
        </div>
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
          <div className="text-[12px] text-[#634F40]/70">Files Attached</div>
          <div className="mt-3 text-[28px] font-bold text-[#420060]">{metrics.files}</div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-700">
          {successMessage}
        </div>
      ) : null}

      <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-semibold text-[#420060]">Product Catalog</h2>
            <p className="mt-1 text-[12px] text-[#634F40]/70">
              Manage your digital catalog, attached files, and publication status.
            </p>
          </div>
          <div className="rounded-xl bg-[#fbf8fb] px-4 py-2 text-[12px] text-[#634F40]/70">
            {products.length} products
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-dashed border-[#d9ccd9] bg-[#fbf9fb] px-4 py-12 text-center text-[13px] text-[#634F40]/70">
            Loading products...
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d9ccd9] bg-[#fbf9fb] px-4 py-12 text-center text-[13px] text-[#634F40]/70">
            No products found.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#634F40]/10">
            <div className="grid grid-cols-[1.4fr_1fr_0.6fr_0.65fr_0.65fr_1fr_0.9fr] gap-3 border-b border-[#634F40]/10 bg-[#fbf8fb] px-4 py-3 text-[12px] font-semibold text-[#634F40]/75">
              <div>Product</div>
              <div>Category</div>
              <div>Price</div>
              <div>Status</div>
              <div>Files</div>
              <div>Flags</div>
              <div>Actions</div>
            </div>

            {products.map((product) => (
              <div
                key={product.id}
                className="grid grid-cols-[1.4fr_1fr_0.6fr_0.65fr_0.65fr_1fr_0.9fr] gap-3 border-b border-[#634F40]/8 px-4 py-4 text-[13px] last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[#420060]">{product.title}</div>
                  <div className="mt-1 truncate text-[12px] text-[#634F40]/70">
                    /store/{product.slug}
                  </div>
                </div>

                <div className="text-[#634F40]">{product.category || "—"}</div>

                <div className="font-semibold text-[#420060]">
                  ${Number(product.price || 0).toFixed(2)}
                </div>

                <div>
                  <StatusBadge active={product.isActive} />
                </div>

                <div className="text-[#634F40]">{product.files?.length || 0}</div>

                <div className="text-[#634F40]">
                  <FlagText featured={product.isFeatured} isNew={product.isNew} />
                </div>

                <div className="flex gap-2">
                  <Link
                    to={`/admin/products/${product.id}/edit`}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#420060]/15 px-4 py-2.5 text-[13px] font-medium text-[#420060] transition hover:bg-[#420060]/5"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleDelete(product.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-[13px] font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}