import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE) === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // (Opcional) te deja una pista en logs si faltan envs
  private assertConfig() {
    const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
      this.logger.warn(
        `Faltan variables de entorno para MailService: ${missing.join(', ')}`,
      );
    }
  }

  async verify() {
    this.assertConfig();
    await this.transporter.verify();
    return true;
  }

  async sendMail(opts: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: { filename: string; content: Buffer; contentType?: string }[];
  }) {
    this.assertConfig();

    const fromName = process.env.MAIL_FROM_NAME || 'Notificaciones';
    const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;

    const info = await this.transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: opts.attachments,
    });

    this.logger.log(`Email enviado a ${opts.to}. messageId=${info.messageId}`);
    return info;
  }

  // ✅ NUEVO: para recordatorios sin PDF
  async sendHtml(opts: { to: string; subject: string; html: string; text?: string }) {
    return this.sendMail({
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
  }

  async sendWithPdf(opts: {
    to: string;
    subject: string;
    html: string;
    filename: string;
    pdfBuffer: Buffer;
  }) {
    return this.sendMail({
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      attachments: [
        {
          filename: opts.filename,
          content: opts.pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }
}
