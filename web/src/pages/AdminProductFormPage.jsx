import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { API_BASE_URL } from "../lib/api"
import {
  createAdminProduct,
  updateAdminProduct,
  fetchAdminProductById,
  uploadAdminProductFile,
  deleteAdminProductFile,
  setAdminPrimaryProductFile,
  uploadAdminProductImage,
  deleteAdminProductImage,
} from "../services/adminProductService"

const PRODUCT_CATEGORIES = [
  "Templates",
  "Digital & IT Toolkits",
  "Computer Science Resources",
  "STEM & Robotics Kits",
  "Digital Business Resources",
  "Uncategorized",
]

const EMPTY_FORM = {
  title: "",
  slug: "",
  shortDescription: "",
  description: "",
  fullDescription: "",
  price: "",
  category: "",
  isActive: true,
  isFeatured: false,
  isNew: false,
  images: [],
  files: [],
  features: [],
}

function normalizeProductToForm(product = {}) {
  const features = Array.isArray(product.features)
    ? product.features.map((f) =>
        typeof f === "string" ? f : f?.featureText || f?.label || f?.title || ""
      )
    : []

  return {
    title: product.title || "",
    slug: product.slug || "",
    shortDescription: product.shortDescription || "",
    description: product.description || "",
    fullDescription: product.fullDescription || "",
    price: product.price ?? "",
    category: product.category || "",
    isActive: Boolean(product.isActive),
    isFeatured: Boolean(product.isFeatured),
    isNew: Boolean(product.isNew),
    images: Array.isArray(product.images) ? product.images : [],
    files: Array.isArray(product.files) ? product.files : [],
    features,
  }
}

function buildImageSrc(imageUrl = "") {
  if (!imageUrl) return ""
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl
  return API_BASE_URL ? `${API_BASE_URL}${imageUrl}` : imageUrl
}

function autoSlug(title = "") {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export default function AdminProductFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = useMemo(() => Boolean(id), [id])

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const [form, setForm] = useState(EMPTY_FORM)

  const [fileUpload, setFileUpload] = useState(null)
  const [fileVersion, setFileVersion] = useState("")
  const [fileLabel, setFileLabel] = useState("")

  const [imageUpload, setImageUpload] = useState(null)
  const [imageAltText, setImageAltText] = useState("")

  const [newFeature, setNewFeature] = useState("")

  useEffect(() => {
    async function loadProduct() {
      if (!isEdit) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setErrorMessage("")
        setSuccessMessage("")

        const product = await fetchAdminProductById(id)
        setForm(normalizeProductToForm(product))
      } catch (error) {
        setErrorMessage(error.message || "Failed to load product.")
      } finally {
        setLoading(false)
      }
    }

    loadProduct()
  }, [id, isEdit])

  async function refreshProduct() {
    if (!isEdit || !id) return
    const product = await fetchAdminProductById(id)
    setForm(normalizeProductToForm(product))
  }

  function updateField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function handleTitleChange(value) {
    setForm((current) => ({
      ...current,
      title: value,
      slug: current.slug || autoSlug(value),
    }))
  }

  function addFeature() {
    if (!newFeature.trim()) return
    setForm((current) => ({
      ...current,
      features: [...current.features, newFeature.trim()],
    }))
    setNewFeature("")
  }

  function removeFeature(index) {
    setForm((current) => ({
      ...current,
      features: current.features.filter((_, i) => i !== index),
    }))
  }

  function moveFeature(index, direction) {
    setForm((current) => {
      const arr = [...current.features]
      const target = index + direction
      if (target < 0 || target >= arr.length) return current
      ;[arr[index], arr[target]] = [arr[target], arr[index]]
      return { ...current, features: arr }
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage("")
    setSuccessMessage("")

    try {
      setSaving(true)

      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || autoSlug(form.title),
        shortDescription: form.shortDescription.trim(),
        description: form.description.trim(),
        fullDescription: form.fullDescription.trim(),
        price: form.price,
        category: form.category,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        isNew: form.isNew,
        features: form.features,
      }

      if (isEdit) {
        await updateAdminProduct(id, payload)
        await refreshProduct()
        setSuccessMessage("Product updated successfully.")
      } else {
        await createAdminProduct(payload)
        navigate("/admin/products")
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to save product.")
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadFile() {
    try {
      if (!isEdit || !id) {
        setErrorMessage("Save the product first before uploading files.")
        return
      }

      if (!fileUpload) {
        setErrorMessage("Please select a file to upload.")
        return
      }

      setUploadingFile(true)
      setErrorMessage("")
      setSuccessMessage("")

      const formData = new FormData()
      formData.append("file", fileUpload)

      if (fileLabel.trim()) {
        formData.append("fileName", fileLabel.trim())
      }

      if (fileVersion.trim()) {
        formData.append("version", fileVersion.trim())
      }

      if (!Array.isArray(form.files) || form.files.length === 0) {
        formData.append("isPrimary", "true")
      }

      await uploadAdminProductFile(id, formData)
      await refreshProduct()

      setFileUpload(null)
      setFileVersion("")
      setFileLabel("")
      setSuccessMessage("Product file uploaded successfully.")
    } catch (error) {
      setErrorMessage(error.message || "Failed to upload file.")
    } finally {
      setUploadingFile(false)
    }
  }

  async function handleUploadImage() {
    try {
      if (!isEdit || !id) {
        setErrorMessage("Save the product first before uploading images.")
        return
      }

      if (!imageUpload) {
        setErrorMessage("Please select an image to upload.")
        return
      }

      setUploadingImage(true)
      setErrorMessage("")
      setSuccessMessage("")

      const formData = new FormData()
      formData.append("image", imageUpload)

      if (imageAltText.trim()) {
        formData.append("altText", imageAltText.trim())
      }

      await uploadAdminProductImage(id, formData)
      await refreshProduct()

      setImageUpload(null)
      setImageAltText("")
      setSuccessMessage("Product image uploaded successfully.")
    } catch (error) {
      setErrorMessage(error.message || "Failed to upload image.")
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleDeleteImage(imageId) {
    try {
      if (!imageId) {
        setErrorMessage("Image ID is required.")
        return
      }

      setErrorMessage("")
      setSuccessMessage("")

      await deleteAdminProductImage(id, imageId)
      await refreshProduct()

      setSuccessMessage("Product image deleted successfully.")
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete image.")
    }
  }

  async function handleMakePrimary(fileId) {
    try {
      if (!fileId) {
        setErrorMessage("File ID is required.")
        return
      }

      setErrorMessage("")
      setSuccessMessage("")

      await setAdminPrimaryProductFile(id, fileId)
      await refreshProduct()

      setSuccessMessage("Primary file updated successfully.")
    } catch (error) {
      setErrorMessage(error.message || "Failed to update primary file.")
    }
  }

  async function handleDeleteFile(fileId) {
    try {
      if (!fileId) {
        setErrorMessage("File ID is required.")
        return
      }

      setErrorMessage("")
      setSuccessMessage("")

      await deleteAdminProductFile(id, fileId)
      await refreshProduct()

      setSuccessMessage("Product file deleted successfully.")
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete file.")
    }
  }

  if (loading) {
    return <div className="p-8">Loading product...</div>
  }

  return (
    <section className="bg-[#F7F9F4]">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-8 shadow-[0_12px_35px_rgba(66,0,96,0.05)]">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-bold text-[#420060]">
              {isEdit ? "Edit Product" : "Create Product"}
            </h1>
            <button
              type="button"
              onClick={() => navigate("/admin/products")}
              className="rounded-xl border border-[#634F40]/15 px-4 py-2 text-sm font-medium text-[#634F40] transition hover:bg-[#fafafa]"
            >
              ← Back to Products
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            {/* ── Basic Info ── */}
            <div>
              <h2 className="text-lg font-bold text-[#420060]">Basic Information</h2>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#634F40]">Title *</label>
                  <input
                    type="text"
                    placeholder="Product title"
                    value={form.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none focus:border-[#420060]/30"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#634F40]">Slug *</label>
                  <input
                    type="text"
                    placeholder="product-slug"
                    value={form.slug}
                    onChange={(e) => updateField("slug", e.target.value)}
                    className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none focus:border-[#420060]/30"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#634F40]">Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.price}
                    onChange={(e) => updateField("price", e.target.value)}
                    className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none focus:border-[#420060]/30"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#634F40]">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => updateField("category", e.target.value)}
                    className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none focus:border-[#420060]/30"
                  >
                    <option value="">Select category</option>
                    {PRODUCT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ── Descriptions ── */}
            <div>
              <h2 className="text-lg font-bold text-[#420060]">Descriptions</h2>

              <div className="mt-4 space-y-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#634F40]">
                    Short Description
                    <span className="ml-2 text-xs font-normal text-[#634F40]/50">
                      Shown on product cards and summaries
                    </span>
                  </label>
                  <textarea
                    rows="2"
                    placeholder="Brief summary of the product (1-2 sentences)"
                    value={form.shortDescription}
                    onChange={(e) => updateField("shortDescription", e.target.value)}
                    className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none focus:border-[#420060]/30"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#634F40]">
                    Description
                    <span className="ml-2 text-xs font-normal text-[#634F40]/50">
                      Main product description shown on the detail page
                    </span>
                  </label>
                  <textarea
                    rows="6"
                    placeholder="Detailed product description — explain what it includes, who it's for, and how it helps"
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none focus:border-[#420060]/30"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#634F40]">
                    Full Description
                    <span className="ml-2 text-xs font-normal text-[#634F40]/50">
                      Extended content, implementation notes, or usage guide (optional)
                    </span>
                  </label>
                  <textarea
                    rows="6"
                    placeholder="Extended description with implementation details, usage instructions, or additional context"
                    value={form.fullDescription}
                    onChange={(e) => updateField("fullDescription", e.target.value)}
                    className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none focus:border-[#420060]/30"
                  />
                </div>
              </div>
            </div>

            {/* ── Product Features / What's Included ── */}
            <div>
              <h2 className="text-lg font-bold text-[#420060]">
                Product Features
              </h2>
              <p className="mt-1 text-sm text-[#634F40]/70">
                These appear as "What's Included" on the product detail page.
              </p>

              <div className="mt-4 space-y-3">
                {form.features.map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-xl border border-[#634F40]/10 bg-[#fafafa] px-4 py-2.5"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#420060]/10 text-xs font-bold text-[#420060]">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-sm text-[#634F40]">{feature}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveFeature(index, -1)}
                        disabled={index === 0}
                        className="rounded-lg px-2 py-1 text-xs text-[#634F40]/50 hover:bg-[#ede4ef] disabled:opacity-30"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveFeature(index, 1)}
                        disabled={index === form.features.length - 1}
                        className="rounded-lg px-2 py-1 text-xs text-[#634F40]/50 hover:bg-[#ede4ef] disabled:opacity-30"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFeature(index)}
                        className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}

                {form.features.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[#d9ccd9] bg-[#fafafa] px-4 py-3 text-sm text-[#634F40]/50">
                    No features added yet. Add features like "Instant digital download", "Ready-to-use template", etc.
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder='Add a feature (e.g. "Instant digital download")'
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addFeature()
                      }
                    }}
                    className="flex-1 rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 text-sm outline-none focus:border-[#420060]/30"
                  />
                  <button
                    type="button"
                    onClick={addFeature}
                    disabled={!newFeature.trim()}
                    className="rounded-xl bg-[#420060] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* ── Flags ── */}
            <div>
              <h2 className="text-lg font-bold text-[#420060]">Status & Visibility</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#fafafa] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => updateField("isActive", e.target.checked)}
                    className="accent-[#420060]"
                  />
                  <span className="text-sm font-medium text-[#634F40]">Active</span>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#fafafa] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) => updateField("isFeatured", e.target.checked)}
                    className="accent-[#420060]"
                  />
                  <span className="text-sm font-medium text-[#634F40]">Featured</span>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#fafafa] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.isNew}
                    onChange={(e) => updateField("isNew", e.target.checked)}
                    className="accent-[#420060]"
                  />
                  <span className="text-sm font-medium text-[#634F40]">New</span>
                </label>
              </div>
            </div>

            {/* ── Product Files ── */}
            <div>
              <h2 className="text-lg font-bold text-[#420060]">Product Files</h2>
              <p className="mt-1 text-sm text-[#634F40]/70">
                Upload ZIP or downloadable files for this product. Mark one as primary for delivery.
              </p>

              {!isEdit ? (
                <div className="mt-4 rounded-xl border border-[#e7dce8] bg-[#fafafa] px-4 py-3 text-sm text-[#634F40]/70">
                  Save the product first, then upload files.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#634F40]/60">Display Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Main Package v1.0"
                        value={fileLabel}
                        onChange={(e) => setFileLabel(e.target.value)}
                        className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 text-sm outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#634F40]/60">Version</label>
                      <input
                        type="text"
                        placeholder="e.g. 1.0"
                        value={fileVersion}
                        onChange={(e) => setFileVersion(e.target.value)}
                        className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 text-sm outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#634F40]/60">File</label>
                      <input
                        type="file"
                        onChange={(e) => setFileUpload(e.target.files?.[0] || null)}
                        className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-2.5 text-sm outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!fileUpload || uploadingFile}
                    onClick={handleUploadFile}
                    className="rounded-xl bg-[#420060] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-70"
                  >
                    {uploadingFile ? "Uploading..." : "Upload Product File"}
                  </button>

                  <div className="space-y-3">
                    {(form.files || []).length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#d9ccd9] bg-[#fafafa] px-4 py-3 text-sm text-[#634F40]/70">
                        No product files uploaded yet.
                      </div>
                    ) : (
                      form.files.map((file) => (
                        <div
                          key={file.id}
                          className="flex flex-col gap-3 rounded-xl border border-[#634F40]/10 bg-[#fafafa] p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <div className="font-semibold text-[#420060]">
                              {file.fileName}
                            </div>
                            <div className="text-sm text-[#634F40]/70">
                              {file.filePath ? `Path: ${file.filePath}` : ""}
                              {file.version ? ` · Version: ${file.version}` : ""}
                              {file.fileSize ? ` · Size: ${(Number(file.fileSize) / 1024 / 1024).toFixed(2)} MB` : ""}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {!file.isPrimary ? (
                              <button
                                type="button"
                                onClick={() => handleMakePrimary(file.id)}
                                className="rounded-xl border border-[#420060]/15 px-4 py-2 text-sm font-medium text-[#420060] transition hover:bg-[#ede4ef]"
                              >
                                Make Primary
                              </button>
                            ) : (
                              <span className="rounded-xl bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
                                ✓ Primary
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteFile(file.id)}
                              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Product Images ── */}
            <div>
              <h2 className="text-lg font-bold text-[#420060]">Product Images</h2>
              <p className="mt-1 text-sm text-[#634F40]/70">
                Upload product images. First image is used as the cover on listing pages.
              </p>

              {!isEdit ? (
                <div className="mt-4 rounded-xl border border-[#e7dce8] bg-[#fafafa] px-4 py-3 text-sm text-[#634F40]/70">
                  Save the product first, then upload images.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#634F40]/60">Alt Text</label>
                      <input
                        type="text"
                        placeholder="Describe the image for accessibility"
                        value={imageAltText}
                        onChange={(e) => setImageAltText(e.target.value)}
                        className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 text-sm outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#634F40]/60">Image File</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setImageUpload(e.target.files?.[0] || null)}
                        className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-2.5 text-sm outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!imageUpload || uploadingImage}
                    onClick={handleUploadImage}
                    className="rounded-xl bg-[#420060] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-70"
                  >
                    {uploadingImage ? "Uploading..." : "Upload Product Image"}
                  </button>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {(form.images || []).length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#d9ccd9] bg-[#fafafa] px-4 py-3 text-sm text-[#634F40]/70">
                        No product images uploaded yet.
                      </div>
                    ) : (
                      form.images
                        .filter((image) => image?.url)
                        .map((image, idx) => (
                          <div
                            key={image.id || image.url}
                            className="overflow-hidden rounded-xl border border-[#634F40]/10 bg-[#fafafa]"
                          >
                            <div className="aspect-[4/3] bg-white">
                              <img
                                src={buildImageSrc(image.url)}
                                alt={image.altText || form.title || "Product image"}
                                className="h-full w-full object-cover"
                              />
                            </div>

                            <div className="space-y-2 p-3">
                              <div className="flex items-center gap-2">
                                {idx === 0 && (
                                  <span className="rounded-full bg-[#420060]/10 px-2 py-0.5 text-[10px] font-bold text-[#420060]">
                                    Cover
                                  </span>
                                )}
                                <span className="truncate text-xs text-[#634F40]/50">
                                  {image.altText || "No alt text"}
                                </span>
                              </div>

                              {image.id ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteImage(image.id)}
                                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                                >
                                  Delete Image
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Messages ── */}
            {errorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {successMessage}
              </div>
            ) : null}

            {/* ── Submit ── */}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-[#420060] px-6 py-4 text-base font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-70"
            >
              {saving ? "Saving..." : isEdit ? "Update Product" : "Create Product"}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
