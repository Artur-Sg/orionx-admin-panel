import { AuthProvider } from "@refinedev/core";

const COOKIE_NAME = "orionx_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

type DemoUser = {
  name: string;
  email: string;
  avatar?: string;
  provider: "google";
};

type GoogleProfile = {
  name?: string;
  email?: string;
  picture?: string;
};

type GoogleCredentialResponse = {
  credential?: string;
};

const readCookie = () => {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`),
  );
  return match ? match[1] : null;
};

const writeCookie = (value: string) => {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    value,
  )}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
};

const clearCookie = () => {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
};

const encodeUser = (user: DemoUser) => btoa(JSON.stringify(user));

const decodeUser = (value: string) => {
  try {
    return JSON.parse(atob(value)) as DemoUser;
  } catch {
    return null;
  }
};

const getUser = () => {
  const raw = readCookie();
  if (!raw) return null;
  return decodeUser(decodeURIComponent(raw));
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
      const payload = credential.split(".")[1];
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, "=");
      const decoded = JSON.parse(atob(padded)) as GoogleProfile;

      const user: DemoUser = {
        name: decoded.name ?? "Google User",
        email: decoded.email ?? "unknown@email",
        avatar: decoded.picture,
        provider: "google",
      };
      writeCookie(encodeUser(user));
      return {
        success: true,
        redirectTo: "/",
      };
    } catch {
      return {
        success: false,
        error: {
          name: "AuthError",
          message: "Invalid Google credential.",
        },
      };
    }
  },
  logout: async () => {
    clearCookie();
    return {
      success: true,
      redirectTo: "/login",
    };
  },
  check: async () => {
    const user = getUser();
    if (user) {
      return {
        authenticated: true,
      };
    }
    return {
      authenticated: false,
      redirectTo: "/login",
    };
  },
  getIdentity: async () => {
    return getUser();
  },
  onError: async (error) => {
    return { error };
  },
  getPermissions: async () => null,
};
