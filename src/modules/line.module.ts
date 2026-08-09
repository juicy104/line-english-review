import { Module } from '@nestjs/common';
import { HandleLineWebhookUseCase } from '../application/line/use-cases/handle-line-webhook.use-case';
import { LineMessagingClientService } from '../infrastructure/line/line-messaging-client.service';
import { LineSignatureVerifierService } from '../infrastructure/line/line-signature-verifier.service';
import { LineWebhookController } from '../presentation/line/line-webhook.controller';

@Module({
  controllers: [LineWebhookController],
  providers: [
    HandleLineWebhookUseCase,
    LineMessagingClientService,
    LineSignatureVerifierService,
  ],
})
export class LineModule {}
