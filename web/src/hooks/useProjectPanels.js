import { useCallback, useEffect, useState } from "react"

import {
  fetchPortalEvents, fetchPortalFileRequests, fetchPortalInvoices, uploadPortalRequestFiles,
  payPortalInvoice,
  fetchProjectEvents, fetchProjectFileRequests, fetchProjectInvoices, uploadAgainstRequest,
  fetchPortalSecrets, createPortalSecret, revealPortalSecret,
  fetchProjectSecrets, createProjectSecret, revealProjectSecret,
} from "../services/trackingService"

/**
 * useProjectPanels · the data behind the three shared project panels (T5-5).
 *
 * ProjectTimeline, FileRequestPanel and ProjectInvoices are each rendered on
 * two surfaces — the signed-in project page and the PIN portal — and the ONLY
 * difference between them is which endpoint answers. A portal holder has no
 * session, so the member gate has nothing to read and the portal has its own.
 *
 * That difference lives here and nowhere else. Without this hook the same
 * three fetches, the same reload-after-upload and the same failure handling
 * would exist twice, and the second copy is the one that quietly stops
 * matching.
 *
 * @param {"member"|"portal"} source
 * @param {string} [projectId]  required for "member", ignored for "portal"
 */
export default function useProjectPanels(source, projectId) {
  const portal = source === "portal"
  const ready = portal || Boolean(projectId)

  const [state, setState] = useState({
    events: [],
    requests: [],
    invoices: [],
    secrets: [],
    billing: null,
    loading: true,
    error: null,
  })

  const load = useCallback(async () => {
    if (!ready) return
    try {
      // In parallel and settled rather than raced: one panel failing (an
      // expired portal cookie mid-session, say) should not blank the other
      // two. Each falls back to empty and the page still renders.
      const [events, requests, invoices, secrets] = await Promise.all([
        (portal ? fetchPortalEvents() : fetchProjectEvents(projectId)).catch(() => []),
        (portal ? fetchPortalFileRequests() : fetchProjectFileRequests(projectId)).catch(() => []),
        (portal ? fetchPortalInvoices() : fetchProjectInvoices(projectId))
          .catch(() => ({ invoices: [], billing: null })),
        // T5-13 · metadata only; a value only ever comes back from reveal.
        (portal ? fetchPortalSecrets() : fetchProjectSecrets(projectId)).catch(() => []),
      ])
      setState({
        events,
        requests,
        invoices: invoices.invoices,
        secrets,
        billing: invoices.billing,
        loading: false,
        error: null,
      })
    } catch (e) {
      setState((prev) => ({ ...prev, loading: false, error: e?.message || "load failed" }))
    }
  }, [portal, projectId, ready])

  useEffect(() => {
    let alive = true
    // The call is made inside the effect rather than the state being set from
    // its body, so nothing cascades a render before the data lands.
    ;(async () => {
      await load()
      if (!alive) return
    })()
    return () => { alive = false }
  }, [load])

  /** Upload against one request, then reload so the row's status is honest. */
  const upload = useCallback(
    (requestId, files) => (portal
      ? uploadPortalRequestFiles(requestId, files)
      : uploadAgainstRequest(projectId, requestId, files)),
    [portal, projectId],
  )

  /**
   * T5-9 · start a payment for one invoice.
   *
   * Only the portal needs a call here: a member is sent to the order page,
   * which already has the pay card, the due date and the late fee, so there
   * is no second implementation of "charge this person". The server says
   * which of the two applies in `invoice.pay.mode`, for the same reason it
   * says which download URL to use.
   */
  const pay = useCallback(
    (invoiceId) => (portal ? payPortalInvoice(invoiceId) : Promise.resolve(null)),
    [portal],
  )

  /** T5-13 · send us a credential, and read one, once. */
  const sendSecret = useCallback(
    (body) => (portal ? createPortalSecret(body) : createProjectSecret(projectId, body)),
    [portal, projectId],
  )
  const revealSecret = useCallback(
    (secretId) => (portal ? revealPortalSecret(secretId) : revealProjectSecret(projectId, secretId)),
    [portal, projectId],
  )

  return { ...state, reload: load, upload, pay, sendSecret, revealSecret }
}
