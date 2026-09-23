import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { sign, verify } from 'jsonwebtoken';
import { AUTH_CONFIG, AuthConfig, JWT_AUDIENCE, JWT_ISSUER, TOKEN_LIFETIME_SECONDS } from './auth.config';

export interface AuthPrincipal { id: number }

@Injectable()
export class TokenService {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  issue(userId: number): string {
    return sign({}, this.config.secret, {
      algorithm: 'HS256', subject: String(userId), expiresIn: TOKEN_LIFETIME_SECONDS,
      issuer: JWT_ISSUER, audience: JWT_AUDIENCE,
    });
  }

  authenticate(token: string): AuthPrincipal {
    try {
      const payload = verify(token, this.config.secret, {
        algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE,
      });
      if (typeof payload === 'string' || typeof payload.sub !== 'string' ||
          !/^[1-9]\d*$/.test(payload.sub) || Number(payload.sub) > 2147483647 ||
          !Number.isInteger(payload.exp) || !Number.isInteger(payload.iat) ||
          payload.iat! > Math.floor(Date.now() / 1000) || payload.exp! <= payload.iat!) {
        throw new Error('Invalid claims');
      }
      return { id: Number(payload.sub) };
    } catch {
      throw new UnauthorizedException('A valid Bearer token is required.');
    }
  }
}
