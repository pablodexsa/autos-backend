import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  KairosWhatsappSession,
  KairosWhatsappStep,
} from './kairos-whatsapp-session.entity';
import { IncomingWhatsappMessageDto } from './dto/incoming-whatsapp-message.dto';
import { KairosLeadsService } from '../kairos-leads/kairos-leads.service';

@Injectable()
export class KairosWhatsappService {
  constructor(
    @InjectRepository(KairosWhatsappSession)
    private readonly sessionRepo: Repository<KairosWhatsappSession>,
    private readonly kairosLeadsService: KairosLeadsService,
  ) {}

  private normalizePhone(value: string): string {
    return String(value || '').replace(/\D/g, '');
  }

  private normalizeAmount(value: string): number {
    const cleaned = String(value || '')
      .replace(/\$/g, '')
      .replace(/\./g, '')
      .replace(/,/g, '.')
      .replace(/[^\d.]/g, '');

    return Number(cleaned);
  }

  private normalizeCuitCuil(value: string): string {
    return String(value || '').replace(/\D/g, '');
  }

  private buildSummary(data: any): string {
    return [
      'Perfecto. Estos son los datos que registré:',
      '',
      `Nombre: ${data.fullName || '-'}`,
      `CUIT/CUIL: ${data.cuitCuil || '-'}`,
      `Teléfono: ${data.phone || '-'}`,
      `Dirección del comercio: ${data.businessAddress || '-'}`,
      `Rubro: ${data.businessType || '-'}`,
      `Antigüedad: ${data.businessAge || '-'}`,
      `Monto solicitado: $${Number(data.requestedAmount || 0).toLocaleString('es-AR')}`,
      '',
      '¿Son correctos?',
      'Respondé 1 para confirmar o 2 para volver a empezar.',
    ].join('\n');
  }

  private getQuestion(step: KairosWhatsappStep): string {
    switch (step) {
      case KairosWhatsappStep.FULL_NAME:
        return '¡Hola! Soy el asistente de Kairos. Para iniciar tu solicitud, escribí tu nombre y apellido.';
      case KairosWhatsappStep.CUIT_CUIL:
        return 'Gracias. Ahora escribí tu CUIT/CUIL, solo números o con guiones.';
      case KairosWhatsappStep.PHONE:
        return 'Perfecto. Indicame tu teléfono de contacto.';
      case KairosWhatsappStep.BUSINESS_ADDRESS:
        return 'Ahora escribí la dirección de tu comercio.';
      case KairosWhatsappStep.BUSINESS_TYPE:
        return '¿Cuál es el rubro de tu comercio? Ejemplo: kiosco, ferretería, taller, almacén.';
      case KairosWhatsappStep.BUSINESS_AGE:
        return '¿Hace cuánto tiempo funciona el comercio? Ejemplo: 6 meses, 2 años, más de 3 años.';
      case KairosWhatsappStep.REQUESTED_AMOUNT:
        return '¿Qué monto de préstamo querés solicitar? Ejemplo: 2000000.';
      default:
        return 'No pude interpretar el paso actual.';
    }
  }

  private async getOrCreateSession(phone: string) {
    const normalized = this.normalizePhone(phone);

    let session = await this.sessionRepo.findOne({
      where: {
        whatsappPhone: normalized,
        completed: false,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!session) {
      session = this.sessionRepo.create({
        whatsappPhone: normalized,
        currentStep: KairosWhatsappStep.FULL_NAME,
        data: {},
        completed: false,
      });

      session = await this.sessionRepo.save(session);
    }

    return session;
  }

  async receiveMessage(dto: IncomingWhatsappMessageDto) {
    const text = String(dto.text || '').trim();
    const phone = this.normalizePhone(dto.from);

    let session = await this.getOrCreateSession(phone);
    const data = session.data || {};

    if (['reiniciar', 'reset', 'volver a empezar'].includes(text.toLowerCase())) {
      session.currentStep = KairosWhatsappStep.FULL_NAME;
      session.data = {};
      session.completed = false;
      session.leadId = null;
      await this.sessionRepo.save(session);

      return {
        reply: this.getQuestion(KairosWhatsappStep.FULL_NAME),
        session,
      };
    }

    switch (session.currentStep) {
      case KairosWhatsappStep.FULL_NAME: {
        const normalizedText = text.toLowerCase();

        const greetings = [
          'hola',
          'buenas',
          'buen dia',
          'buen día',
          'buenas tardes',
          'buenas noches',
          'info',
          'quiero info',
          'informacion',
          'información',
        ];

        if (greetings.includes(normalizedText)) {
          return {
            reply: this.getQuestion(KairosWhatsappStep.FULL_NAME),
            session,
          };
        }

        if (text.length < 5 || !text.includes(' ')) {
          return {
            reply: 'Por favor escribí tu nombre y apellido. Ejemplo: Juan Pérez.',
            session,
          };
        }

        data.fullName = text;
        session.currentStep = KairosWhatsappStep.CUIT_CUIL;
        break;
      }

      case KairosWhatsappStep.CUIT_CUIL: {
        const cuitCuil = this.normalizeCuitCuil(text);

        if (!/^\d{11}$/.test(cuitCuil)) {
          return {
            reply: 'El CUIT/CUIL debe tener 11 dígitos. Probá nuevamente.',
            session,
          };
        }

        data.cuitCuil = cuitCuil;
        session.currentStep = KairosWhatsappStep.PHONE;
        break;
      }

      case KairosWhatsappStep.PHONE:
        data.phone = text;
        session.currentStep = KairosWhatsappStep.BUSINESS_ADDRESS;
        break;

      case KairosWhatsappStep.BUSINESS_ADDRESS:
        data.businessAddress = text;
        session.currentStep = KairosWhatsappStep.BUSINESS_TYPE;
        break;

      case KairosWhatsappStep.BUSINESS_TYPE:
        data.businessType = text;
        session.currentStep = KairosWhatsappStep.BUSINESS_AGE;
        break;

      case KairosWhatsappStep.BUSINESS_AGE:
        data.businessAge = text;
        session.currentStep = KairosWhatsappStep.REQUESTED_AMOUNT;
        break;

      case KairosWhatsappStep.REQUESTED_AMOUNT: {
        const amount = this.normalizeAmount(text);

        if (!amount || amount <= 0) {
          return {
            reply: 'Ingresá un monto válido. Ejemplo: 2000000.',
            session,
          };
        }

        data.requestedAmount = amount;
        session.currentStep = KairosWhatsappStep.CONFIRMATION;
        session.data = data;
        session = await this.sessionRepo.save(session);

        return {
          reply: this.buildSummary(data),
          session,
        };
      }

      case KairosWhatsappStep.CONFIRMATION:
        if (
          text === '1' ||
          text.toLowerCase() === 'si' ||
          text.toLowerCase() === 'sí'
        ) {
          const lead = await this.kairosLeadsService.createPublic({
            fullName: data.fullName,
            cuitCuil: data.cuitCuil,
            phone: data.phone,
            businessAddress: data.businessAddress,
            businessType: data.businessType,
            businessAge: data.businessAge,
            requestedAmount: Number(data.requestedAmount),
            campaign: dto.campaign,
            adName: dto.adName,
            utmSource: 'whatsapp',
            utmCampaign: dto.campaign,
          });

          session.completed = true;
          session.currentStep = KairosWhatsappStep.COMPLETED;
          session.leadId = lead.id;
          session.data = data;

          await this.sessionRepo.save(session);

          return {
            reply:
              'Gracias. Tu solicitud fue registrada correctamente. Un asesor de Kairos analizará la información y se comunicará con vos.',
            session,
            lead,
          };
        }

        if (text === '2' || text.toLowerCase().includes('no')) {
          session.currentStep = KairosWhatsappStep.FULL_NAME;
          session.data = {};
          session.completed = false;
          await this.sessionRepo.save(session);

          return {
            reply:
              'No hay problema. Volvamos a empezar.\n\n' +
              this.getQuestion(KairosWhatsappStep.FULL_NAME),
            session,
          };
        }

        return {
          reply: 'Respondé 1 para confirmar o 2 para volver a empezar.',
          session,
        };

      default:
        session.currentStep = KairosWhatsappStep.FULL_NAME;
        session.data = {};
        await this.sessionRepo.save(session);

        return {
          reply: this.getQuestion(KairosWhatsappStep.FULL_NAME),
          session,
        };
    }

    session.data = data;
    session = await this.sessionRepo.save(session);

    return {
      reply: this.getQuestion(session.currentStep),
      session,
    };
  }

  async receiveMetaWebhook(body: any) {
    const entries = body?.entry || [];

    for (const entry of entries) {
      const changes = entry?.changes || [];

      for (const change of changes) {
        const value = change?.value;
        const messages = value?.messages || [];

        for (const message of messages) {
          const from = message?.from;
          let text = '';

          if (message?.type === 'text') {
            text = message?.text?.body || '';
          }

          if (message?.type === 'button') {
            text = message?.button?.text || message?.button?.payload || '';
          }

          if (message?.type === 'interactive') {
            text =
              message?.interactive?.button_reply?.title ||
              message?.interactive?.button_reply?.id ||
              message?.interactive?.list_reply?.title ||
              message?.interactive?.list_reply?.id ||
              '';
          }

          if (!from || !text) continue;

          await this.receiveMessage({
            from,
            text,
            campaign: 'WhatsApp Cloud API',
            adName: value?.metadata?.display_phone_number || undefined,
          });
        }
      }
    }

    return { success: true };
  }
}