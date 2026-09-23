export function isApiUrl(requestUrl: string, apiBase: string): boolean {
  try {
    const base = new URL(apiBase);
    const url = new URL(requestUrl);
    const prefix = base.pathname.replace(/\/$/, "");
    return (
      url.origin === base.origin &&
      (url.pathname === prefix || url.pathname.startsWith(prefix + "/"))
    );
  } catch {
    return false;
  }
}

export function safeReturnUrl(value: string | null): string {
  return value && /^\/projects(?:\/[1-9]\d*\/tasks)?$/.test(value)
    ? value
    : "/projects";
}

export function loginValidation(username: string, password: string): string {
  if (
    !username.trim() ||
    [...username.trim()].length > 100 ||
    username.includes("\u0000")
  )
    return "Enter your username (up to 100 characters).";
  if (!password || new TextEncoder().encode(password).length > 1024)
    return "Enter your password (up to 1024 bytes).";
  return "";
}
