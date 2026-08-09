import { Injectable, Logger } from '@nestjs/common';
import { LineWebhookPayloadDto } from '../dto/line-webhook-payload.dto';

@Injectable()
export class HandleLineWebhookUseCase {
  private readonly logger = new Logger(HandleLineWebhookUseCase.name);

  execute(payload: LineWebhookPayloadDto): void {
    this.logger.log({
      message: 'Received LINE webhook events',
      eventCount: payload.events?.length ?? 0,
      events: payload.events ?? [],
    });
  }
}
