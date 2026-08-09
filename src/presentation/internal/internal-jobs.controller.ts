import { Body, Controller, Post } from '@nestjs/common';
import { DeliverDueCardsService } from '../../application/internal/deliver-due-cards.service';

@Controller('internal/jobs')
export class InternalJobsController {
  constructor(
    private readonly deliverDueCardsService: DeliverDueCardsService,
  ) {}

  @Post('deliver-due-cards')
  deliverDueCards(@Body() body: { dryRun?: boolean } = {}) {
    return this.deliverDueCardsService.execute({ dryRun: body.dryRun });
  }
}
