export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
export const JWT_ISSUER = 'client-project-tracker';
export const JWT_AUDIENCE = 'client-project-tracker-api';
export const TOKEN_LIFETIME_SECONDS = 900;

export interface AuthConfig { secret: string }

export function readAuthConfig(): AuthConfig {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim() || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 bytes of random secret material.');
  }
  return { secret };
}
