import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { KairosWhatsappService } from './kairos-whatsapp.service';
import { IncomingWhatsappMessageDto } from './dto/incoming-whatsapp-message.dto';

@Controller('kairos-whatsapp')
export class KairosWhatsappController {
  constructor(private readonly kairosWhatsappService: KairosWhatsappService) {}

  @Post('message')
  receiveMessage(@Body() dto: IncomingWhatsappMessageDto) {
    return this.kairosWhatsappService.receiveMessage(dto);
  }

  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  }

  @Post('webhook')
  @HttpCode(200)
  async receiveWebhook(@Body() body: any) {
    await this.kairosWhatsappService.receiveMetaWebhook(body);

    return { success: true };
  }

  @Post('test-flow')
  async testFlow(
    @Body()
    body: {
      from: string;
      campaign?: string;
      adName?: string;
      messages: string[];
    },
  ) {
    const responses: Array<{
      sent: string;
      reply: string;
      leadId: number | null;
      currentStep: string | undefined;
      completed: boolean | undefined;
    }> = [];

    for (const text of body.messages) {
      const result = await this.kairosWhatsappService.receiveMessage({
        from: body.from,
        text,
        campaign: body.campaign,
        adName: body.adName,
      });

      responses.push({
        sent: text,
        reply: result.reply,
        leadId: result.lead?.id || result.session?.leadId || null,
        currentStep: result.session?.currentStep,
        completed: result.session?.completed,
      });
    }

    return {
      success: true,
      responses,
    };
  }
}