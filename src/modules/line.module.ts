import { Module } from '@nestjs/common';
import { HandleLineWebhookUseCase } from '../application/line/use-cases/handle-line-webhook.use-case';
import { LineSignatureVerifierService } from '../infrastructure/line/line-signature-verifier.service';
import { LineWebhookController } from '../presentation/line/line-webhook.controller';

@Module({
  controllers: [LineWebhookController],
  providers: [HandleLineWebhookUseCase, LineSignatureVerifierService],
})
export class LineModule {}
