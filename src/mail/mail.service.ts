import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private isConfigured(): boolean {
    const required = [
      'GMAIL_CLIENT_ID',
      'GMAIL_CLIENT_SECRET',
      'GMAIL_REFRESH_TOKEN',
      'GMAIL_SENDER',
    ];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
      this.logger.warn(
        `Gmail API deshabilitado. Faltan variables: ${missing.join(', ')}`,
      );
      return false;
    }
    return true;
  }

  private getGmailClient() {
    const oauth2 = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI,
    );

    oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
    return google.gmail({ version: 'v1', auth: oauth2 });
  }

  private base64UrlEncode(input: Buffer | string) {
    const b = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
    return b
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private foldBase64(b64: string) {
    return b64.replace(/(.{76})/g, '$1\r\n');
  }

  private buildRawEmail(opts: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: { filename: string; contentType: string; content: Buffer }[];
  }) {
    const boundary = `----=_Part_${Date.now()}`;
    const headers = [
      `From: ${opts.from}`,
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      `MIME-Version: 1.0`,
    ];

    // Sin adjuntos: HTML simple
    if (!opts.attachments?.length) {
      headers.push(`Content-Type: text/html; charset="UTF-8"`);
      return `${headers.join('\r\n')}\r\n\r\n${opts.html}`;
    }

    // Con adjuntos: multipart/mixed
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

    const parts: string[] = [];

    // Parte HTML
    parts.push(
      `--${boundary}\r\n` +
        `Content-Type: text/html; charset="UTF-8"\r\n` +
        `Content-Transfer-Encoding: 7bit\r\n\r\n` +
        `${opts.html}\r\n`,
    );

    // Adjuntos
    for (const a of opts.attachments) {
      parts.push(
        `--${boundary}\r\n` +
          `Content-Type: ${a.contentType}; name="${a.filename}"\r\n` +
          `Content-Disposition: attachment; filename="${a.filename}"\r\n` +
          `Content-Transfer-Encoding: base64\r\n\r\n` +
          `${this.foldBase64(a.content.toString('base64'))}\r\n`,
      );
    }

    parts.push(`--${boundary}--\r\n`);

    return `${headers.join('\r\n')}\r\n\r\n${parts.join('')}`;
  }

  async verify() {
    // No hay verify SMTP: validamos configuración y un token refresh usable
    if (!this.isConfigured()) return false;
    // Forzamos a crear cliente; si el refresh token es inválido va a fallar al enviar.
    this.getGmailClient();
    return true;
  }

  async sendMail(opts: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: { filename: string; content: Buffer; contentType?: string }[];
  }) {
    if (!this.isConfigured()) {
      this.logger.warn(
        `Email NO enviado (Gmail API no configurado) → ${opts.to} / ${opts.subject}`,
      );
      return { skipped: true };
    }

    const gmail = this.getGmailClient();

    const fromName = process.env.MAIL_FROM_NAME || 'Notificaciones';
    const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.GMAIL_SENDER!;
    const from = `"${fromName}" <${fromEmail}>`;

    const raw = this.buildRawEmail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        contentType: a.contentType || 'application/octet-stream',
        content: a.content,
      })),
    });

    try {
      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: this.base64UrlEncode(raw) },
      });

      this.logger.log(`Gmail API send OK: id=${res.data.id}`);
      return res.data;
    } catch (err: any) {
      this.logger.error(
        `Gmail API error enviando a ${opts.to}: ${err?.message || err}`,
      );
      if (err?.response?.data) {
        this.logger.error(JSON.stringify(err.response.data));
      }
      throw err;
    }
  }

  async sendHtml(opts: { to: string; subject: string; html: string; text?: string }) {
    return this.sendMail(opts);
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