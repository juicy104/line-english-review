import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LineSignatureVerifierService {
  private readonly logger = new Logger(LineSignatureVerifierService.name);

  constructor(private readonly configService: ConfigService) {}

  verify(rawBody: Buffer, signature: string | undefined): boolean {
    const channelSecret =
      this.configService.get<string>('LINE_MESSAGING_CHANNEL_SECRET') ||
      this.configService.get<string>('LINE_CHANNEL_SECRET');

    if (!channelSecret) {
      this.logger.warn(
        'LINE_MESSAGING_CHANNEL_SECRET is not set. Skipping LINE signature verification.',
      );
      return true;
    }

    if (!signature) {
      return false;
    }

    const expected = createHmac('sha256', channelSecret)
      .update(rawBody)
      .digest('base64');

    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  }
}
