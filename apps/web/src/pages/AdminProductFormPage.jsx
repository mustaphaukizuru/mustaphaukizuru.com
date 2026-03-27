import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useToast } from "../context/ToastContext"
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

const buildDefaultImages = () =>
  Array.from({ length: 6 }, (_, index) => ({
    url: "",
    altText: "",
    sortOrder: index,
  }))

const mergeImages = (images = []) =>
  Array.from({ length: 6 }, (_, index) => {
    const existing = images[index]
    return {
      id: existing?.id || null,
      url: existing?.url || "",
      altText: existing?.altText || "",
      sortOrder: index,
    }
  })

export default function AdminProductFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = useMemo(() => Boolean(id), [id])
  const { showSuccess, showError } = useToast()
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    price: "",
    category: "",
    isActive: true,
    isFeatured: false,
    isNew: false,
    images: buildDefaultImages(),
    files: [],
  })

  const [fileUpload, setFileUpload] = useState(null)
  const [fileVersion, setFileVersion] = useState("")
  const [fileLabel, setFileLabel] = useState("")
  const [uploadingFile, setUploadingFile] = useState(false)

  const [imageUpload, setImageUpload] = useState(null)
  const [imageAltText, setImageAltText] = useState("")
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    async function loadProduct() {
      if (!isEdit) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setErrorMessage("")

        const product = await fetchAdminProductById(id)

        setForm({
          title: product.title || "",
          slug: product.slug || "",
          description: product.description || "",
          price: product.price ?? "",
          category: product.category || "",
          isActive: !!product.isActive,
          isFeatured: !!product.isFeatured,
          isNew: !!product.isNew,
          images: mergeImages(product.images || []),
          files: product.files || [],
        })
      } catch (error) {
        setErrorMessage(error.message || "Failed to load product.")
      } finally {
        setLoading(false)
      }
    }



    loadProduct()
  }, [id, isEdit])

  const refreshProduct = async () => {
    if (!isEdit) return

    const product = await fetchAdminProductById(id)

    setForm({
      title: product.title || "",
      slug: product.slug || "",
      description: product.description || "",
      price: product.price ?? "",
      category: product.category || "",
      isActive: !!product.isActive,
      isFeatured: !!product.isFeatured,
      isNew: !!product.isNew,
      images: mergeImages(product.images || []),
      files: product.files || [],
    })
  }

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const updateImageField = (index, key, value) => {
    setForm((current) => {
      const nextImages = [...current.images]
      nextImages[index] = {
        ...nextImages[index],
        [key]: value,
      }

      return {
        ...current,
        images: nextImages,
      }
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    setErrorMessage("")
    setSuccessMessage("")

    try {
      setSaving(true)

      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        price: form.price,
        category: form.category,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        isNew: form.isNew,
        images: form.images
          .filter((image) => image.url.trim() !== "")
          .map((image, index) => ({
            url: image.url.trim(),
            altText: image.altText.trim(),
            sortOrder: index,
          })),
      }

      if (isEdit) {
        await updateAdminProduct(id, payload)
        setSuccessMessage("Product updated successfully.")
        await refreshProduct()
      } else {
        await createAdminProduct(payload)
        navigate("/admin/products")
        return
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to save product.")
    } finally {
      setSaving(false)
    }
  }

  const handleUploadFile = async () => {
    try {
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

      if (!(form.files || []).length) {
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

  const handleUploadImage = async () => {
    try {
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

  const handleDeleteImage = async (imageId) => {
    try {
      setErrorMessage("")
      setSuccessMessage("")
      await deleteAdminProductImage(id, imageId)
      await refreshProduct()
      setSuccessMessage("Product image deleted successfully.")
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete image.")
    }
  }

  const handleMakePrimary = async (fileId) => {
    try {
      setErrorMessage("")
      setSuccessMessage("")
      await setAdminPrimaryProductFile(id, fileId)
      await refreshProduct()
      setSuccessMessage("Primary file updated successfully.")
    } catch (error) {
      setErrorMessage(error.message || "Failed to update primary file.")
    }
  }

  const handleDeleteFile = async (fileId) => {
    try {
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
          <h1 className="text-4xl font-bold text-[#420060]">
            {isEdit ? "Edit Product" : "Create Product"}
          </h1>

          <form onSubmit={submit} className="mt-8 space-y-8">
            <div className="grid gap-5 md:grid-cols-2">
              <input
                type="text"
                placeholder="Title"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none"
              />

              <input
                type="text"
                placeholder="Slug"
                value={form.slug}
                onChange={(e) => updateField("slug", e.target.value)}
                className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none"
              />

              <input
                type="number"
                step="0.01"
                placeholder="Price"
                value={form.price}
                onChange={(e) => updateField("price", e.target.value)}
                className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none"
              />

              <select
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none"
              >
                <option value="">Select category</option>
                {PRODUCT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows="5"
              placeholder="Description"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none"
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex items-center gap-3 rounded-xl bg-[#fafafa] px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => updateField("isActive", e.target.checked)}
                />
                <span>Active</span>
              </label>

              <label className="flex items-center gap-3 rounded-xl bg-[#fafafa] px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(e) => updateField("isFeatured", e.target.checked)}
                />
                <span>Featured</span>
              </label>

              <label className="flex items-center gap-3 rounded-xl bg-[#fafafa] px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.isNew}
                  onChange={(e) => updateField("isNew", e.target.checked)}
                />
                <span>New</span>
              </label>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-[#420060]">Product Files</h2>
              <p className="mt-2 text-sm text-[#634F40]/70">
                Upload ZIP or downloadable files for this product. Mark one as primary.
              </p>

              {!isEdit ? (
                <div className="mt-4 rounded-xl border border-[#e7dce8] bg-[#fafafa] px-4 py-3 text-sm text-[#634F40]/70">
                  Save the product first, then upload files.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Display file name (optional)"
                      value={fileLabel}
                      onChange={(e) => setFileLabel(e.target.value)}
                      className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none"
                    />

                    <input
                      type="text"
                      placeholder="Version (optional)"
                      value={fileVersion}
                      onChange={(e) => setFileVersion(e.target.value)}
                      className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none"
                    />

                    <input
                      type="file"
                      onChange={(e) => setFileUpload(e.target.files?.[0] || null)}
                      className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={!fileUpload || uploadingFile}
                    onClick={handleUploadFile}
                    className="rounded-xl bg-[#420060] px-6 py-3 font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-70"
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
                              Path: {file.filePath}
                              {file.version ? ` • Version: ${file.version}` : ""}
                              {file.fileSize ? ` • Size: ${String(file.fileSize)}` : ""}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {!file.isPrimary ? (
                              <button
                                type="button"
                                onClick={() => handleMakePrimary(file.id)}
                                className="rounded-xl border border-[#420060]/15 px-4 py-2 text-sm font-medium text-[#420060]"
                              >
                                Make Primary
                              </button>
                            ) : (
                              <span className="rounded-xl bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
                                Primary
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteFile(file.id)}
                              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600"
                            >
                              Delete File
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <h2 className="text-2xl font-bold text-[#420060]">Product Images</h2>
              <p className="mt-2 text-sm text-[#634F40]/70">
                Upload product images directly. You can also edit alt text for SEO and accessibility.
              </p>

              {!isEdit ? (
                <div className="mt-4 rounded-xl border border-[#e7dce8] bg-[#fafafa] px-4 py-3 text-sm text-[#634F40]/70">
                  Save the product first, then upload images.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Image alt text (optional)"
                      value={imageAltText}
                      onChange={(e) => setImageAltText(e.target.value)}
                      className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none"
                    />

                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageUpload(e.target.files?.[0] || null)}
                      className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={!imageUpload || uploadingImage}
                    onClick={handleUploadImage}
                    className="rounded-xl bg-[#420060] px-6 py-3 font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-70"
                  >
                    {uploadingImage ? "Uploading..." : "Upload Product Image"}
                  </button>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {form.images.filter((image) => image.url).length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#d9ccd9] bg-[#fafafa] px-4 py-3 text-sm text-[#634F40]/70">
                        No product images uploaded yet.
                      </div>
                    ) : (
                      form.images
                        .filter((image) => image.url)
                        .map((image) => (
                          <div
                            key={image.id || image.url}
                            className="overflow-hidden rounded-xl border border-[#634F40]/10 bg-[#fafafa]"
                          >
                            <div className="aspect-[4/3] bg-white">
                              <img
                                src={`http://localhost:5000${image.url}`}
                                alt={image.altText || form.title}
                                className="h-full w-full object-cover"
                              />
                            </div>

                            <div className="space-y-3 p-4">
                              <div className="text-sm text-[#634F40]/70">
                                {image.altText || "No alt text"}
                              </div>

                              {image.id ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteImage(image.id)}
                                  className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600"
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

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#420060] px-6 py-4 font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-70"
            >
              {saving ? "Saving..." : isEdit ? "Update Product" : "Create Product"}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}