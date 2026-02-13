import { Body, Controller, Post } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('debug/mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Post('verify')
  async verify() {
    await this.mail.verify();
    return { ok: true };
  }

  @Post('test')
  async test(@Body() body: { to: string }) {
    await this.mail.sendMail({
      to: body.to,
      subject: 'Prueba de email - GL Motors',
      html: `<h3>OK</h3><p>Este es un correo de prueba del sistema.</p>`,
      text: 'OK - Este es un correo de prueba del sistema.',
    });
    return { ok: true };
  }
}
