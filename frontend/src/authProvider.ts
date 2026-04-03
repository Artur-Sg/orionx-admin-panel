import { AuthProvider } from "@refinedev/core";

const ACCESS_TOKEN_KEY = "orionx_access";
const REFRESH_TOKEN_KEY = "orionx_refresh";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type GoogleCredentialResponse = {
  credential?: string;
};

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

type UserIdentity = {
  id: string;
  email: string;
  is_active: boolean;
};

const readToken = (key: string) => localStorage.getItem(key);

const writeTokens = (tokens: TokenResponse) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
};

const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

const apiPost = async <T>(path: string, body: unknown, token?: string): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Request failed");
  }

  return (await res.json()) as T;
};

const apiGet = async <T>(path: string, token: string): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Request failed");
  }

  return (await res.json()) as T;
};

const tryRefresh = async (): Promise<TokenResponse | null> => {
  const refreshToken = readToken(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const tokens = await apiPost<TokenResponse>("/auth/refresh", {
      refresh_token: refreshToken,
    });
    writeTokens(tokens);
    return tokens;
  } catch {
    clearTokens();
    return null;
  }
};

export const authProvider: AuthProvider = {
  login: async (params) => {
    const credential = (params as GoogleCredentialResponse | undefined)
      ?.credential;

    if (!credential) {
      return {
        success: false,
        error: {
          name: "AuthError",
          message: "Missing Google credential.",
        },
      };
    }

    try {
      const tokens = await apiPost<TokenResponse>("/auth/google", {
        credential,
      });
      writeTokens(tokens);
      return {
        success: true,
        redirectTo: "/",
      };
    } catch {
      return {
        success: false,
        error: {
          name: "AuthError",
          message: "Google auth failed.",
        },
      };
    }
  },
  logout: async () => {
    clearTokens();
    return {
      success: true,
      redirectTo: "/login",
    };
  },
  check: async () => {
    const accessToken = readToken(ACCESS_TOKEN_KEY);
    if (!accessToken) {
      return {
        authenticated: false,
        redirectTo: "/login",
      };
    }

    try {
      await apiGet<UserIdentity>("/users/me", accessToken);
      return { authenticated: true };
    } catch {
      const refreshed = await tryRefresh();
      if (refreshed) {
        return { authenticated: true };
      }
      return {
        authenticated: false,
        redirectTo: "/login",
      };
    }
  },
  getIdentity: async () => {
    const accessToken = readToken(ACCESS_TOKEN_KEY);
    if (!accessToken) return null;

    try {
      return await apiGet<UserIdentity>("/users/me", accessToken);
    } catch {
      return null;
    }
  },
  onError: async (error) => {
    return { error };
  },
  getPermissions: async () => null,
};
