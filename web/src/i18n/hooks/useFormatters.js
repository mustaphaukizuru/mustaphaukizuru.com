import { useMemo } from "react"
import { useLanguage } from "./useLanguage"
import * as F from "../utils/formatters"

/**
 * useFormatters() · I18N04
 *
 * Reactive bridge between the active language and the pure formatter
 * functions. Memoised so re-renders don't reallocate the helper bag.
 *
 *   const fmt = useFormatters()
 *   <span>{fmt.currency(product.price, product.currency)}</span>
 *   <span>{fmt.dateShort(order.createdAt)}</span>
 *   <span>{fmt.fileSize(file.fileSize)}</span>
 *
 * Currency defaults to MXN (Mexican Peso) — pass an explicit currency code
 * when a product is priced in USD or another currency.
 */
export function useFormatters() {
  const { lang } = useLanguage()
  return useMemo(
    () => ({
      currency: (amount, currency = "MXN") => F.formatCurrency(amount, currency, lang),
      date:     (d, opts) => F.formatDate(d, lang, opts),
      dateShort:(d) => F.formatDateShort(d, lang),
      relative: (d) => F.formatRelativeTime(d, lang),
      number:   (n) => F.formatNumber(n, lang),
      fileSize: (b) => F.formatFileSize(b, lang),
      percent:  (n, frac) => F.formatPercent(n, lang, frac),
      lang,
    }),
    [lang],
  )
}

export default useFormatters
