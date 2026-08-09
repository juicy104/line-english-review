import { Controller, Get, Query, Redirect, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../../application/auth/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('line/start')
  @Redirect()
  startLineLogin(
    @Res({ passthrough: true }) response: Response,
    @Query('returnTo') returnTo?: string,
  ) {
    return {
      url: this.authService.createLineLoginUrl(response, returnTo || '/admin'),
    };
  }

  @Get('line/callback')
  @Redirect()
  async completeLineLogin(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    return {
      url: await this.authService.completeLineLogin(
        request,
        response,
        code,
        state,
      ),
    };
  }

  @Get('logout')
  @Redirect('/admin')
  logout(@Res({ passthrough: true }) response: Response) {
    this.authService.clearSession(response);
  }
}
