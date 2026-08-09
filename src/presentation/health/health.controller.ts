import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  getRootHealth(): { status: 'ok' } {
    return this.getHealth();
  }

  @Get('health')
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
