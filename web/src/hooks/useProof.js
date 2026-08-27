import useApiQuery from "./useApiQuery"
import { fetchProof } from "../services/bioService"

/**
 * useProof · live social-proof counters from GET /api/v1/bio/proof.
 *
 * `data` is undefined until the first response — callers render their
 * static fallback numbers meanwhile. The API caches for 10 minutes, so the
 * client keeps the entry fresh for the same window.
 */
export const PROOF_QUERY_KEY = "bio:proof"

export default function useProof() {
  return useApiQuery(PROOF_QUERY_KEY, ({ signal }) => fetchProof({ signal }), {
    staleTime: 10 * 60_000,
  })
}
