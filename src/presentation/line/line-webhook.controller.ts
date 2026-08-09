import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { LineWebhookPayloadDto } from '../../application/line/dto/line-webhook-payload.dto';
import { HandleLineWebhookUseCase } from '../../application/line/use-cases/handle-line-webhook.use-case';
import { LineSignatureVerifierService } from '../../infrastructure/line/line-signature-verifier.service';

type RawBodyRequest = Request & {
  rawBody?: Buffer;
};

@Controller('line')
export class LineWebhookController {
  constructor(
    private readonly handleLineWebhookUseCase: HandleLineWebhookUseCase,
    private readonly signatureVerifier: LineSignatureVerifierService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  handleWebhook(
    @Headers('x-line-signature') signature: string | undefined,
    @Req() request: RawBodyRequest,
    @Body() payload: LineWebhookPayloadDto,
  ): { status: 'ok' } {
    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(payload));

    if (!this.signatureVerifier.verify(rawBody, signature)) {
      throw new UnauthorizedException('Invalid LINE signature');
    }

    this.handleLineWebhookUseCase.execute(payload);

    return { status: 'ok' };
  }
}
