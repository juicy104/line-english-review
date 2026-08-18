import { Module } from '@nestjs/common';
import { DeliverDueCardsService } from '../application/internal/deliver-due-cards.service';
import { LineMessagingClientService } from '../infrastructure/line/line-messaging-client.service';
import { InternalJobsController } from '../presentation/internal/internal-jobs.controller';
import { InternalRichMessagesController } from '../presentation/internal/internal-rich-messages.controller';

@Module({
  controllers: [InternalJobsController, InternalRichMessagesController],
  providers: [DeliverDueCardsService, LineMessagingClientService],
})
export class InternalModule {}
