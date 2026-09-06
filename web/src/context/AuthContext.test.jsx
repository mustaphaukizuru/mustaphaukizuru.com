/**
 * AuthContext — what the browser is allowed to believe about the session
 * (T3-4).
 *
 * Since the httpOnly cookie migration the client holds display data only.
 * `isAuthenticated` is derived from a cached user, the cookie is invisible,
 * and the only proofs are a request succeeding or a 401 arriving. That
 * makes three behaviours load-bearing and all three fail quietly:
 *
 *   · logout must reach the server FIRST — clearing localStorage alone
 *     looks signed out while the session stays valid until the server bumps
 *     the revocation watermark;
 *   · local state must clear even when that call fails, or a user on a
 *     dropped connection stays "signed in" on a shared machine;
 *   · a 401 from any request must tear the session down through the
 *     auth:session-expired event.
 */
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = {
  fetchMe: vi.fn(),
  signOut: vi.fn(),
  clearStoredAuth: vi.fn(),
  getStoredUser: vi.fn(),
  hasStoredSession: vi.fn(),
}

vi.mock("../services/authService", () => ({
  fetchMe: (...a) => mocks.fetchMe(...a),
  signOut: (...a) => mocks.signOut(...a),
  clearStoredAuth: (...a) => mocks.clearStoredAuth(...a),
  getStoredUser: (...a) => mocks.getStoredUser(...a),
  hasStoredSession: (...a) => mocks.hasStoredSession(...a),
  login: vi.fn(),
  signup: vi.fn(),
  storeAuth: vi.fn(),
  verifyLoginTwoFactor: vi.fn(),
}))

const { AuthProvider, useAuth } = await import("./AuthContext")

function Probe() {
  const { user, loading, isAuthenticated, logout } = useAuth()
  return (
    <div>
      <span data-testid="state">{loading ? "loading" : isAuthenticated ? "in" : "out"}</span>
      <span data-testid="name">{user?.fullName || ""}</span>
      <button onClick={logout}>Sign out</button>
    </div>
  )
}

const mount = () => render(<AuthProvider><Probe /></AuthProvider>)

beforeEach(() => {
  mocks.fetchMe.mockReset()
  mocks.signOut.mockReset().mockResolvedValue(undefined)
  mocks.clearStoredAuth.mockReset()
  mocks.getStoredUser.mockReset().mockReturnValue(null)
  mocks.hasStoredSession.mockReset().mockReturnValue(false)
})

describe("boot", () => {
  it("skips the guaranteed 401 when there is no local trace of a session", async () => {
    mount()
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("out"))
    expect(mocks.fetchMe).not.toHaveBeenCalled()
  })

  it("shows the cached user immediately, then replaces it with the server's copy", async () => {
    mocks.hasStoredSession.mockReturnValue(true)
    mocks.getStoredUser.mockReturnValue({ id: "u1", fullName: "Cached Name" })
    mocks.fetchMe.mockResolvedValue({ id: "u1", fullName: "Server Name", email: "a@b.c" })

    mount()
    expect(screen.getByTestId("name")).toHaveTextContent("Cached Name")
    await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("Server Name"))
    expect(screen.getByTestId("state")).toHaveTextContent("in")
  })
})

describe("logout", () => {
  beforeEach(() => {
    mocks.hasStoredSession.mockReturnValue(true)
    mocks.getStoredUser.mockReturnValue({ id: "u1", fullName: "Signed In" })
    mocks.fetchMe.mockResolvedValue({ id: "u1", fullName: "Signed In" })
  })

  it("calls the server, then clears the cached user", async () => {
    mount()
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("in"))

    await userEvent.click(screen.getByRole("button", { name: /sign out/i }))

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("out"))
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    expect(mocks.clearStoredAuth).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("name")).toHaveTextContent("")
  })

  it("still clears local state when the network call fails", async () => {
    mocks.signOut.mockRejectedValue(new Error("offline"))
    mount()
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("in"))

    await userEvent.click(screen.getByRole("button", { name: /sign out/i }))

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("out"))
    expect(mocks.clearStoredAuth).toHaveBeenCalledTimes(1)
  })
})

describe("session expiry", () => {
  it("drops the user when any request reports the session gone", async () => {
    mocks.hasStoredSession.mockReturnValue(true)
    mocks.getStoredUser.mockReturnValue({ id: "u1", fullName: "Signed In" })
    mocks.fetchMe.mockResolvedValue({ id: "u1", fullName: "Signed In" })

    mount()
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("in"))

    act(() => {
      window.dispatchEvent(new CustomEvent("auth:session-expired", { detail: { code: "AUTH_EXPIRED" } }))
    })

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("out"))
  })

  it("keeps the cached user through a network error, so a flaky connection is not a sign-out", async () => {
    mocks.hasStoredSession.mockReturnValue(true)
    mocks.getStoredUser.mockReturnValue({ id: "u1", fullName: "Signed In" })
    mocks.fetchMe.mockRejectedValue(Object.assign(new Error("Failed to fetch"), { code: "NETWORK_ERROR" }))

    mount()
    await waitFor(() => expect(screen.getByTestId("state")).not.toHaveTextContent("loading"))
    expect(screen.getByTestId("name")).toHaveTextContent("Signed In")
  })
})
