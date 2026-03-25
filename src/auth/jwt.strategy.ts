import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'k12-super-secret-key-for-dev',
    });
  }

  async validate(payload: any) {
    // Decoded token payload mapping to request.user
    return { id: payload.sub, username: payload.username, role: payload.role, orgId: payload.orgId };
  }
}
