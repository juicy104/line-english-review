import { Body, Controller, Post } from '@nestjs/common';
import { DeliverDueCardsService } from '../../application/internal/deliver-due-cards.service';

@Controller('internal/rich-messages')
export class InternalRichMessagesController {
  constructor(
    private readonly deliverDueCardsService: DeliverDueCardsService,
  ) {}

  @Post('deliver-due-cards')
  deliverDueCards(@Body() body: { dryRun?: boolean } = {}) {
    return this.deliverDueCardsService.execute({ dryRun: body.dryRun });
  }

  @Post('garagara-pon')
  garagaraPon(@Body() body: { dryRun?: boolean } = {}) {
    return this.deliverDueCards(body);
  }
}
