/**
 * mergeMessages · the one merged, dated list behind MessagesPanel (T5-20).
 *
 * Its own module because it is the only real logic in that component and the
 * rest is markup — and because a hook or helper exported beside components
 * breaks Fast Refresh.
 *
 * Newest first: a mixed list is an inbox, not a conversation, and the thing
 * that changed most recently is the thing somebody is waiting on. A ticket's
 * date is its last activity for the same reason — a two-week-old ticket
 * answered this morning belongs at the top.
 *
 * Keys are prefixed per kind. The three models have independent id spaces,
 * so a comment and a ticket can genuinely collide, and React would then
 * reuse one row's DOM for the other.
 */
export default function mergeMessages(comments, tickets, requests) {
  return [
    ...(comments || []).map((c) => ({ key: `c${c.id}`, kind: "question", at: c.createdAt, data: c })),
    ...(tickets  || []).map((tk) => ({ key: `t${tk.id}`, kind: "problem", at: tk.updatedAt || tk.createdAt, data: tk })),
    ...(requests || []).map((cr) => ({ key: `r${cr.id}`, kind: "extra", at: cr.createdAt, data: cr })),
    // A row with no usable date sorts last rather than throwing NaN through
    // the comparator and scrambling the order around it.
  ].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0))
}
