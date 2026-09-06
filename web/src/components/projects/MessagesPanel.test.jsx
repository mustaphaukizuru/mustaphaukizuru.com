/**
 * MessagesPanel — one composer over three models (T5-20).
 *
 * The risk in this change is not the markup. It is that a client picks
 * "a problem" and their message quietly becomes a comment, or picks "extra
 * work" and no quote is ever raised. Three buttons that all look the same
 * and post to the wrong place is a worse failure than the three separate
 * boxes this replaces, because nothing on screen says it went wrong.
 *
 * So every test here is about routing: which service each choice calls, with
 * what, and what the merged list does with the answers.
 */
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach } from "vitest"

import mergeMessages from "../../lib/mergeMessages"

vi.mock("react-i18next", () => ({
  // Key-echo: the assertions below are about which endpoint ran, not about
  // copy, and a real bundle would make them fail on any wording change.
  useTranslation: () => ({ t: (k) => k, i18n: { language: "en" } }),
}))
vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}))
vi.mock("../../hooks/useLocalizedNavigate", () => ({ default: () => vi.fn() }))
vi.mock("../../services/clientProjectService", () => ({
  fetchMyProjectTickets: vi.fn(async () => []),
  fetchMyProjectTicket: vi.fn(async () => ({ id: "t1", subject: "s", messages: [] })),
  createMyProjectTicket: vi.fn(async () => ({ id: "t9" })),
  replyMyProjectTicket: vi.fn(async () => ({})),
  projectFileDownloadUrl: () => "/x",
  fetchMyChangeRequests: vi.fn(async () => []),
  createMyChangeRequest: vi.fn(async () => ({ id: "r9" })),
  acceptMyChangeRequest: vi.fn(async () => ({})),
  declineMyChangeRequest: vi.fn(async () => ({})),
}))

const svc = await import("../../services/clientProjectService")
const { default: MessagesPanel } = await import("./MessagesPanel")

/* ── the merge ───────────────────────────────────────────────────────── */

describe("the merged list", () => {
  const comments = [{ id: "1", createdAt: "2026-09-01T10:00:00Z" }]
  const tickets = [{ id: "1", createdAt: "2026-08-01T10:00:00Z", updatedAt: "2026-09-03T10:00:00Z" }]
  const requests = [{ id: "1", createdAt: "2026-09-02T10:00:00Z" }]

  it("orders every kind together, newest first", () => {
    expect(mergeMessages(comments, tickets, requests).map((x) => x.kind))
      .toEqual(["problem", "extra", "question"])
  })

  it("dates a ticket by its last activity, not by when it was opened", () => {
    // A two-week-old ticket answered this morning is the thing being waited
    // on; sorting it by createdAt buries it.
    const [first] = mergeMessages([], tickets, [])
    expect(first.at).toBe("2026-09-03T10:00:00Z")
  })

  it("keys never collide across the three models", () => {
    // Independent id spaces: all three rows above are id "1". Without the
    // per-kind prefix React reuses one row's DOM for another.
    const keys = mergeMessages(comments, tickets, requests).map((x) => x.key)
    expect(new Set(keys).size).toBe(3)
  })

  it("a row with no usable date sorts last instead of scrambling the rest", () => {
    const out = mergeMessages([{ id: "a" }, { id: "b", createdAt: "2026-09-01T10:00:00Z" }], [], [])
    expect(out.map((x) => x.data.id)).toEqual(["b", "a"])
  })

  it("survives every list being missing", () => {
    expect(mergeMessages()).toEqual([])
  })
})

/* ── the composer ────────────────────────────────────────────────────── */

const mount = (props = {}) => render(
  <MessagesPanel projectId="p1" comments={[]} onComment={vi.fn()} {...props} />,
)

const openComposer = async (user) => {
  await user.click(await screen.findByRole("button", { name: "projects.messages.new" }))
}
const pick = async (user, kind) => {
  await user.click(screen.getByRole("radio", { name: `projects.messages.compose.${kind}` }))
}

describe("each choice posts to its own model", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("a question becomes a comment", async () => {
    const user = userEvent.setup()
    const onComment = vi.fn(async () => {})
    mount({ onComment })

    await openComposer(user)
    await user.type(screen.getByLabelText(/projects.support.form.message/), "Is the staging link still live?")
    await user.click(screen.getByRole("button", { name: "projects.support.form.submit" }))

    await waitFor(() => expect(onComment).toHaveBeenCalledWith({ body: "Is the staging link still live?" }))
    expect(svc.createMyProjectTicket).not.toHaveBeenCalled()
    expect(svc.createMyChangeRequest).not.toHaveBeenCalled()
  })

  it("a problem becomes a numbered ticket, carrying its priority", async () => {
    const user = userEvent.setup()
    const onComment = vi.fn()
    mount({ onComment })

    await openComposer(user)
    await pick(user, "problem")
    await user.type(screen.getByLabelText(/projects.support.form.subject/), "Login loops")
    await user.type(screen.getByLabelText(/projects.support.form.message/), "It bounces back to the form.")
    await user.click(screen.getByRole("button", { name: "projects.support.form.submit" }))

    await waitFor(() => expect(svc.createMyProjectTicket).toHaveBeenCalledTimes(1))
    expect(svc.createMyProjectTicket.mock.calls[0][1]).toMatchObject({
      subject: "Login loops", message: "It bounces back to the form.", priority: "medium",
    })
    expect(onComment).not.toHaveBeenCalled()
  })

  it("extra work becomes a change request, so it can be quoted before anything starts", async () => {
    const user = userEvent.setup()
    const onComment = vi.fn()
    mount({ onComment })

    await openComposer(user)
    await pick(user, "extra")
    await user.type(screen.getByLabelText(/projects.changeRequests.form.title/), "A second language")
    await user.type(screen.getByLabelText(/projects.changeRequests.form.description/), "We also need the site in English.")
    await user.click(screen.getByRole("button", { name: "projects.support.form.submit" }))

    await waitFor(() => expect(svc.createMyChangeRequest).toHaveBeenCalledTimes(1))
    expect(svc.createMyChangeRequest.mock.calls[0][1]).toMatchObject({ title: "A second language" })
    expect(onComment).not.toHaveBeenCalled()
    expect(svc.createMyProjectTicket).not.toHaveBeenCalled()
  })

  it("says what each choice will do BEFORE the client types", async () => {
    // The whole reason the selector is worth having: the three-box version
    // made them guess where an answer would arrive.
    const user = userEvent.setup()
    mount()
    await openComposer(user)

    expect(screen.getByText("projects.messages.compose.questionHint")).toBeInTheDocument()
    await pick(user, "problem")
    expect(screen.getByText("projects.messages.compose.problemHint")).toBeInTheDocument()
    await pick(user, "extra")
    expect(screen.getByText("projects.messages.compose.extraHint")).toBeInTheDocument()
  })

  it("a ticket needs a subject; a question does not", async () => {
    // Different bars on purpose. A question can be one line; something we
    // have to act on cannot be untitled.
    const user = userEvent.setup()
    mount()
    await openComposer(user)

    await user.type(screen.getByLabelText(/projects.support.form.message/), "Quick one?")
    expect(screen.getByRole("button", { name: "projects.support.form.submit" })).toBeEnabled()

    await pick(user, "problem")
    expect(screen.getByRole("button", { name: "projects.support.form.submit" })).toBeDisabled()
  })
})

describe("a closed project", () => {
  it("offers no composer at all", async () => {
    mount({ readOnly: true })
    expect(await screen.findByText("projects.messages.readOnly")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "projects.messages.new" })).toBeNull()
  })
})
