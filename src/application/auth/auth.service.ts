import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider } from '@prisma/client';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type LineIdTokenProfile = {
  sub: string;
  name?: string;
  picture?: string;
};

@Injectable()
export class AuthService {
  private readonly sessionCookie = 'line_english_session';
  private readonly stateCookie = 'line_oauth_state';

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  createAdminLoginStartUrl(returnTo = '/admin') {
    const baseUrl = this.requiredConfig('APP_BASE_URL');
    const startUrl = new URL('/auth/line/start', baseUrl);
    startUrl.searchParams.set('returnTo', returnTo);
    return startUrl.toString();
  }

  createLineLoginUrl(response: Response, returnTo = '/admin') {
    const channelId = this.requiredConfig('LINE_LOGIN_CHANNEL_ID');
    const baseUrl = this.requiredConfig('APP_BASE_URL');
    const state = randomBytes(24).toString('hex');
    const nonce = randomBytes(24).toString('hex');
    const redirectUri = new URL('/auth/line/callback', baseUrl).toString();
    const loginUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');

    loginUrl.searchParams.set('response_type', 'code');
    loginUrl.searchParams.set('client_id', channelId);
    loginUrl.searchParams.set('redirect_uri', redirectUri);
    loginUrl.searchParams.set('state', state);
    loginUrl.searchParams.set('scope', 'profile openid');
    loginUrl.searchParams.set('nonce', nonce);

    this.setCookie(
      response,
      this.stateCookie,
      this.signJson({ state, nonce, returnTo }),
      600,
    );

    return loginUrl.toString();
  }

  async completeLineLogin(
    request: Request,
    response: Response,
    code: string,
    state: string,
  ) {
    const savedState = this.verifyJsonCookie<{
      state: string;
      nonce: string;
      returnTo?: string;
    }>(request, this.stateCookie);

    if (!savedState || savedState.state !== state) {
      throw new ServiceUnavailableException('Invalid LINE login state');
    }

    const tokenResponse = await this.issueLineToken(code);
    const profile = await this.verifyLineIdToken(
      tokenResponse.id_token,
      savedState.nonce,
    );
    const account = await this.prisma.authAccount.upsert({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.LINE,
          providerUserId: profile.sub,
        },
      },
      update: {
        user: {
          update: {
            displayName: profile.name ?? null,
          },
        },
      },
      create: {
        provider: AuthProvider.LINE,
        providerUserId: profile.sub,
        user: {
          create: {
            displayName: profile.name ?? null,
          },
        },
      },
    });

    this.setCookie(
      response,
      this.sessionCookie,
      this.signJson({ userId: account.userId }),
      60 * 60 * 24 * 30,
    );
    this.clearCookie(response, this.stateCookie);

    return savedState.returnTo || '/admin';
  }

  getSessionUserId(request: Request) {
    return this.verifyJsonCookie<{ userId: string }>(
      request,
      this.sessionCookie,
    )?.userId;
  }

  clearSession(response: Response) {
    this.clearCookie(response, this.sessionCookie);
  }

  private async issueLineToken(code: string) {
    const channelId = this.requiredConfig('LINE_LOGIN_CHANNEL_ID');
    const channelSecret = this.requiredConfig('LINE_LOGIN_CHANNEL_SECRET');
    const baseUrl = this.requiredConfig('APP_BASE_URL');
    const redirectUri = new URL('/auth/line/callback', baseUrl).toString();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: channelId,
      client_secret: channelSecret,
    });

    const response = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Failed to issue LINE access token',
      );
    }

    return response.json() as Promise<{ id_token: string }>;
  }

  private async verifyLineIdToken(idToken: string, nonce: string) {
    const channelId = this.requiredConfig('LINE_LOGIN_CHANNEL_ID');
    const body = new URLSearchParams({
      id_token: idToken,
      client_id: channelId,
      nonce,
    });

    const response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      throw new ServiceUnavailableException('Failed to verify LINE ID token');
    }

    return response.json() as Promise<LineIdTokenProfile>;
  }

  private requiredConfig(name: string) {
    const value = this.configService.get<string>(name);
    if (!value) {
      throw new ServiceUnavailableException(`${name} is not configured`);
    }
    return value;
  }

  private signJson(value: unknown) {
    const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
    const signature = createHmac('sha256', this.sessionSecret())
      .update(payload)
      .digest('base64url');
    return `${payload}.${signature}`;
  }

  private verifyJsonCookie<T>(request: Request, name: string) {
    const value = this.readCookie(request, name);
    if (!value) return undefined;

    const [payload, signature] = value.split('.');
    if (!payload || !signature) return undefined;

    const expected = createHmac('sha256', this.sessionSecret())
      .update(payload)
      .digest('base64url');
    if (!safeEqual(signature, expected)) return undefined;

    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T;
  }

  private readCookie(request: Request, name: string) {
    const cookies = request.headers.cookie?.split(';') ?? [];
    const prefix = `${name}=`;
    return cookies
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(prefix))
      ?.slice(prefix.length);
  }

  private setCookie(
    response: Response,
    name: string,
    value: string,
    maxAgeSeconds: number,
  ) {
    response.append(
      'Set-Cookie',
      `${name}=${value}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Lax${this.secureCookieSuffix()}`,
    );
  }

  private clearCookie(response: Response, name: string) {
    response.append(
      'Set-Cookie',
      `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${this.secureCookieSuffix()}`,
    );
  }

  private secureCookieSuffix() {
    const baseUrl = this.configService.get<string>('APP_BASE_URL') ?? '';
    return baseUrl.startsWith('https://') ? '; Secure' : '';
  }

  private sessionSecret() {
    return this.requiredConfig('SESSION_SECRET');
  }
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
