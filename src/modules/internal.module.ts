import { Module } from '@nestjs/common';
import { DeliverDueCardsService } from '../application/internal/deliver-due-cards.service';
import { LineMessagingClientService } from '../infrastructure/line/line-messaging-client.service';
import { InternalJobsController } from '../presentation/internal/internal-jobs.controller';

@Module({
  controllers: [InternalJobsController],
  providers: [DeliverDueCardsService, LineMessagingClientService],
})
export class InternalModule {}
