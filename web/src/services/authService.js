import {
  apiRequest,
  authFetch,
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
} from "../lib/api"

export function getStoredToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
  } catch {
    // ignore storage errors
  }
}

export function storeAuth(data) {
  if (!data?.token || !data?.user) {
    throw new Error("Invalid authentication payload")
  }

  try {
    localStorage.setItem(AUTH_TOKEN_KEY, data.token)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user))
  } catch {
    throw new Error("Failed to store authentication data")
  }
}

export async function signup(payload) {
  const response = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  return response?.data || response
}

export async function login(payload) {
  const response = await apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  return response?.data || response
}

export async function loginWithGoogleCredential(credential) {
  if (!credential) {
    throw new Error("Google credential is required")
  }

  const response = await apiRequest("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  })

  return response?.data || response
}

export async function fetchMe() {
  const response = await authFetch("/api/auth/me", {
    method: "GET",
  })

  return response?.data || response
}