import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Award, ExternalLink, FileText, ShieldCheck, ZoomIn } from "lucide-react"

import { CoverflowCarousel } from "./ui/CoverflowCarousel"
import { CertificateModal } from "./CertificatePreview"
import { isRenderablePdf } from "../lib/certificates"
import { formatDate } from "../lib/format"

/**
 * CertificateCoverflow · the Credentials wall as a 3-D cover-flow rail
 *
 * Replaces the 3-column grid of <CertificatePreview> tiles. The tiles
 * themselves are gone, but nothing else about the behaviour changed:
 *
 *   • hosted PDF  → tapping the centre card opens the same <CertificateModal>
 *   • external credential → tapping opens the issuer's verify page in a tab
 *
 * The card face is the sibling PNG pre-render (`thumbnail`); certificates
 * with no hosted PDF get the branded credential face instead of a broken
 * image — same degradation rule <CertificatePreview> already applied.
 */
export default function CertificateCoverflow({ certs = [] }) {
  const { t } = useTranslation("about")
  const [openCert, setOpenCert] = useState(null)

  if (certs.length === 0) return null

  const slides = certs.map((c, i) => {
    const canPreview = isRenderablePdf(c.pdfUrl)
    let issued = null
    if (c.issueDate) {
      try {
        issued = formatDate(c.issueDate, undefined, { year: "numeric", month: "short" })
      } catch { issued = null }
    }
    return {
      id: c.pdfUrl || c.credentialUrl || `${c.title}-${i}`,
      src: c.thumbnail || null,
      alt: c.title,
      title: c.title,
      subtitle: [c.issuer, issued].filter(Boolean).join(" · ") || null,
      canPreview,
      pdfUrl: c.pdfUrl,
      credentialUrl: c.credentialUrl,
      issuerLogo: c.issuerLogo,
      issuer: c.issuer,
    }
  })

  const activate = (slide) => {
    if (slide.canPreview) {
      setOpenCert(slide)
      return
    }
    const href = slide.credentialUrl || slide.pdfUrl
    if (href) window.open(href, "_blank", "noopener,noreferrer")
  }

  return (
    <>
      <CoverflowCarousel
        slides={slides}
        onActivate={activate}
        aspect={1.414}
        cardWidth="clamp(230px, 30vw, 460px)"
        label={t("credentials.title")}
        cardClassName="bg-slate-50"
        renderSlide={(slide, { active }) => (
          <div className="relative h-full w-full overflow-hidden bg-slate-50">
            {slide.src ? (
              <img
                src={slide.src}
                alt=""
                aria-hidden="true"
                draggable={false}
                loading="lazy"
                className="h-full w-full select-none object-cover"
              />
            ) : (
              <CredentialFace slide={slide} />
            )}

            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-charcoal/5" aria-hidden="true" />

            <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-mint/95 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow">
              <ShieldCheck className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
              {t("certificate.verifiedBadge", { defaultValue: "Verified" })}
            </span>
            <span
              className={`pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white ${
                slide.canPreview ? "bg-charcoal/85" : "bg-white/15 ring-1 ring-white/20"
              }`}
            >
              {slide.canPreview ? <FileText className="h-3 w-3" aria-hidden="true" /> : <Award className="h-3 w-3" aria-hidden="true" />}
              {slide.canPreview ? "PDF" : t("certificate.credentialBadge", { defaultValue: "Credential" })}
            </span>

            {/* Only the centre card advertises its action — the neighbours
                are tilted away and a hover strip on them reads as noise. */}
            {active && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-charcoal/70 to-transparent p-3 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/90">
                  {slide.canPreview ? t("certificate.clickToOpen") : t("certificate.verify")}
                </span>
                {slide.canPreview ? (
                  <ZoomIn className="h-4 w-4 text-white" aria-hidden="true" />
                ) : (
                  <ExternalLink className="h-4 w-4 text-white" aria-hidden="true" />
                )}
              </div>
            )}
          </div>
        )}
      />

      <CertificateModal
        open={Boolean(openCert)}
        src={openCert?.pdfUrl}
        title={openCert?.title || ""}
        issuer={openCert?.issuer}
        onClose={() => setOpenCert(null)}
      />
    </>
  )
}

/* Branded face for credentials with no hosted PDF — mirrors the gradient
   the credential-mode tile used, so the rail stays visually uniform. */
function CredentialFace({ slide }) {
  const initial = (slide.issuer || slide.title || "?").trim().charAt(0).toUpperCase()
  return (
    <div className="relative h-full w-full">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(at 20% 0%, rgb(var(--color-violet-rgb)/0.92), transparent 60%), " +
            "radial-gradient(at 100% 100%, rgba(53,0,80,0.95), transparent 55%), " +
            "linear-gradient(180deg, var(--color-action-primary-active) 0%, var(--color-charcoal) 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.10] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/[0.10] ring-1 ring-white/15 backdrop-blur-sm">
          {slide.issuerLogo ? (
            <img src={slide.issuerLogo} alt="" className="h-12 w-12 object-contain" loading="lazy" />
          ) : (
            <span className="font-mono text-[28px] font-bold tracking-tight text-white">{initial}</span>
          )}
        </div>
      </div>
    </div>
  )
}
