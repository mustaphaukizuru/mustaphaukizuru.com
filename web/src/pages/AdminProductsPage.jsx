import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Pencil, Plus, Trash2, File as FileIcon, Package, CheckCircle2,
  Star, Files, AlertCircle,
} from "lucide-react"
import { deleteAdminProduct, fetchAdminProducts } from "../services/adminProductService"
import { useToast } from "../context/ToastContext"
import { getFileTypeStyles } from "../lib/fileTypeIcons"
import { MetricCard } from "../components/ui/index"
import DataTable from "../components/admin/DataTable"
import StatusPill from "../components/admin/StatusPill"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminProductsPage · Batch 6B-2
 *
 *  Refactored to use the shared <DataTable /> + <StatusPill /> primitives.
 *
 *  What changed:
 *    - Bespoke <table> markup replaced with <DataTable />
 *    - Local StatusBadge replaced with shared StatusPill (active/inactive)
 *    - Bespoke metric tile divs replaced with shared <MetricCard />
 *    - Bulk delete via DataTable's selection + bulkActions API
 *    - Search filters by title, slug, category
 *    - Sortable: title, category, price, status, files count
 *    - Mono numerics on price + file count
 *    - Toast for success/failure on delete (preserved from prior version)
 *
 *  Preserved verbatim:
 *    - fetchAdminProducts + deleteAdminProduct API contracts
 *    - FilesCell component (F04 file-type chip strip)
 *    - "/store/{slug}" preview path
 *    - Edit link to /admin/products/:id/edit
 *  ──────────────────────────────────────────────────────────────────── */

/* ── FilesCell · preserved verbatim from prior version (F04 strip) ────── */
function FilesCell({ files = [] }) {
  if (!Array.isArray(files) || files.length === 0) {
    return <span className="text-charcoal-80/40">-</span>
  }

  const grouped = new Map()
  for (const f of files) {
    const styles = getFileTypeStyles(f.fileType || f.fileName || "")
    const existing = grouped.get(styles.label)
    if (existing) existing.count += 1
    else grouped.set(styles.label, { ...styles, count: 1 })
  }
  const distinct = Array.from(grouped.values())

  if (distinct.length > 3) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-violet-pale px-2 py-0.5 text-micro font-bold text-violet">
        <FileIcon className="h-3 w-3" aria-hidden="true" />
        <span className="font-mono tabular-nums">{files.length}</span>
        <span className="font-mono opacity-70">files</span>
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {distinct.map(({ icon: Icon, label, chip, count }) => (
        <span
          key={label}
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${chip}`}
          title={count > 1 ? `${count} ${label} files` : `1 ${label} file`}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
          {count > 1 && <span className="font-mono tabular-nums opacity-80">{count}</span>}
        </span>
      ))}
    </div>
  )
}

/* ── FlagsCell · combines featured + new into a clean inline display ──── */
function FlagsCell({ featured, isNew }) {
  if (!featured && !isNew) return <span className="text-charcoal-80/40">-</span>
  return (
    <div className="flex items-center gap-1">
      {featured && (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
          <Star className="h-2.5 w-2.5" aria-hidden="true" />
          Featured
        </span>
      )}
      {isNew && (
        <span className="rounded-md bg-mint/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-mint">
          New
        </span>
      )}
    </div>
  )
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setError] = useState("")
  const { showSuccess, showError } = useToast()

  async function loadProducts() {
    try {
      setLoading(true); setError("")
      const data = await fetchAdminProducts()
      setProducts(Array.isArray(data) ? data : [])
    } catch (error) {
      setError(error.message || "Failed to load products.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProducts() }, [])

  const metrics = useMemo(() => ({
    total: products.length,
    active: products.filter((p) => p.isActive).length,
    featured: products.filter((p) => p.isFeatured).length,
    files: products.reduce((sum, p) => sum + (p.files?.length || 0), 0),
  }), [products])

  async function handleDelete(id) {
    if (!window.confirm("Delete this product?")) return
    try {
      setError("")
      await deleteAdminProduct(id)
      await loadProducts()
      showSuccess("Product deleted successfully.")
    } catch (error) {
      setError(error.message || "Failed to delete product.")
      showError(error.message || "Failed to delete product.")
    }
  }

  async function handleBulkDelete(rows) {
    if (!window.confirm(`Delete ${rows.length} product${rows.length === 1 ? "" : "s"}?`)) return
    try {
      setError("")
      // Sequential delete keeps it predictable; can be parallelized later
      for (const row of rows) {
        await deleteAdminProduct(row.id)
      }
      await loadProducts()
      showSuccess(`${rows.length} product${rows.length === 1 ? "" : "s"} deleted.`)
    } catch (error) {
      setError(error.message || "Bulk delete failed.")
      showError(error.message || "Bulk delete failed.")
    }
  }

  const columns = useMemo(() => [
    {
      key: "title",
      label: "Product",
      sortable: true,
      searchable: true,
      width: "1.6fr",
      getValue: (row) => row.title || "",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-meta font-semibold text-violet">{row.title}</div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-charcoal-80/55">
            /store/{row.slug}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      searchable: true,
      width: "0.9fr",
      getValue: (row) => row.category || "",
      render: (row) => row.category
        ? <span className="text-meta text-charcoal-80/85">{row.category}</span>
        : <span className="text-charcoal-80/40">-</span>,
    },
    {
      key: "price",
      label: "Price",
      sortable: true,
      width: "0.7fr",
      align: "right",
      getValue: (row) => Number(row.price || 0),
      render: (row) => (
        <span className="font-mono text-meta font-bold tabular-nums text-violet">
          ${Number(row.price || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      sortable: true,
      width: "0.7fr",
      getValue: (row) => row.isActive ? "active" : "inactive",
      render: (row) => <StatusPill status={row.isActive ? "active" : "inactive"} />,
    },
    {
      key: "files",
      label: "Files",
      sortable: true,
      width: "0.8fr",
      getValue: (row) => row.files?.length || 0,
      render: (row) => <FilesCell files={row.files} />,
    },
    {
      key: "flags",
      label: "Flags",
      width: "0.9fr",
      render: (row) => <FlagsCell featured={row.isFeatured} isNew={row.isNew} />,
    },
    {
      key: "actions",
      label: "",
      width: "1.0fr",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Link
            to={`/admin/products/${row.id}/edit`}
            aria-label={`Edit ${row.title}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-violet/15 bg-white text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDelete(row.id) }}
            aria-label={`Delete ${row.title}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-300/40 focus-visible:ring-offset-2"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ], [])

  return (
    <section className="space-y-5">
      {/* Page action bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-meta text-charcoal-80/70">
            Create, edit, delete, and manage products, files, and media.
          </p>
        </div>
        <Link
          to="/admin/products/new"
          className="inline-flex items-center gap-2 rounded-lg bg-violet px-4 py-2.5 text-micro font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-deep hover:shadow-[0_8px_18px_rgba(93,63,211,0.22)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Product
        </Link>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {errorMessage}
        </div>
      )}

      {/* Metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Products" value={metrics.total} icon={Package} tone="purple" />
        <MetricCard title="Active" value={metrics.active} icon={CheckCircle2} tone="green" />
        <MetricCard title="Featured" value={metrics.featured} icon={Star} tone="amber" />
        <MetricCard title="Files Attached" value={metrics.files} icon={Files} tone="blue" />
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        rows={products}
        rowKey={(row) => row.id}
        loading={loading}
        onRefresh={loadProducts}
        initialSort={{ key: "title", dir: "asc" }}
        searchPlaceholder="Search by title, slug, category…"
        selectable
        bulkActions={[
          { label: "Delete selected", icon: Trash2, onClick: handleBulkDelete, variant: "danger" },
        ]}
        emptyState={{
          icon: Package,
          title: "No products yet",
          description: "Create your first digital product to start selling.",
          action: (
            <Link
              to="/admin/products/new"
              className="inline-flex items-center gap-2 rounded-lg bg-violet px-4 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              New Product
            </Link>
          ),
        }}
      />
    </section>
  )
}
