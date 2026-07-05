const DEFAULT_REDIRECT_PATH = "/dashboard";
const REDIRECT_ORIGIN = "https://duepilot.local";

const ALLOWED_REDIRECT_ROOTS = ["/dashboard", "/deadlines", "/settings", "/team/invitations", "/reset-password"];

function isAllowedRedirectPath(pathname: string) {
  return ALLOWED_REDIRECT_ROOTS.some(
    (allowedPath) =>
      pathname === allowedPath || pathname.startsWith(`${allowedPath}/`)
  );
}

export function getSafeRedirectPath(
  redirectPath: string | null | undefined,
  fallback = DEFAULT_REDIRECT_PATH
) {
  const trimmedPath = redirectPath?.trim();

  if (!trimmedPath) {
    return fallback;
  }

  if (
    !trimmedPath.startsWith("/") ||
    trimmedPath.startsWith("//") ||
    trimmedPath.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(trimmedPath)
  ) {
    return fallback;
  }

  try {
    const parsedUrl = new URL(trimmedPath, REDIRECT_ORIGIN);

    if (parsedUrl.origin !== REDIRECT_ORIGIN) {
      return fallback;
    }

    if (!isAllowedRedirectPath(parsedUrl.pathname)) {
      return fallback;
    }

    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return fallback;
  }
}
