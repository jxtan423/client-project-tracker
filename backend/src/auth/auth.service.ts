import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './validation/login.dto';
import { verifyPassword } from './security/password';
import { TokenService } from './token.service';
import { TOKEN_LIFETIME_SECONDS } from './auth.config';

interface LoginUser { id: number; name: string; username: string; password_hash: string }

@Injectable()
export class AuthService {
  private activeLogins = 0;
  constructor(private readonly database: DatabaseService, private readonly tokens: TokenService) {}

  async login(input: LoginDto) {
    // Each existing scrypt hash needs ~128 MiB. Bound concurrent work per server process.
    if (this.activeLogins >= 2) throw new HttpException('Login is busy. Please try again shortly.', HttpStatus.TOO_MANY_REQUESTS);
    this.activeLogins++;
    try {
      const result = await this.database.query<LoginUser>(
        'SELECT id, name, username, password_hash FROM users WHERE lower(username) = lower($1)', [input.username],
      );
      const user = result.rows[0];
      const valid = await verifyPassword(input.password, user?.password_hash ?? null);
      if (!user || !valid) throw new UnauthorizedException('Invalid username or password.');
      return {
        accessToken: this.tokens.issue(user.id), tokenType: 'Bearer', expiresIn: TOKEN_LIFETIME_SECONDS,
        user: { id: user.id, name: user.name, username: user.username },
      };
    } finally {
      this.activeLogins--;
    }
  }
}
