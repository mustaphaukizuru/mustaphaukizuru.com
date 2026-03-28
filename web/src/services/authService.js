import { apiRequest, API_BASE_URL } from "../lib/api";

const TOKEN_KEY = "auth-token";
const USER_KEY = "auth-user";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function storeAuth(data) {
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

export async function signup(payload) {
  const response = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function login(payload) {
  const response = await apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function loginWithGoogleCredential(credential) {
  const response = await apiRequest("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });

  return response.data;
}

export async function fetchMe() {
  const token = getStoredToken();

  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch profile");
  }

  return data.data;
}