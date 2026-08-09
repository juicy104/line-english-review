import type { LineWebhookEvent } from '../../../domain/line/entities/line-webhook-event.entity';

export class LineWebhookPayloadDto {
  destination?: string;
  events: LineWebhookEvent[] = [];
}
