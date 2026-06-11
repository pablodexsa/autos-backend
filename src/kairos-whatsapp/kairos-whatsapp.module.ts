import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KairosWhatsappSession } from './kairos-whatsapp-session.entity';
import { KairosWhatsappService } from './kairos-whatsapp.service';
import { KairosWhatsappController } from './kairos-whatsapp.controller';
import { KairosLeadsModule } from '../kairos-leads/kairos-leads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KairosWhatsappSession]),
    KairosLeadsModule,
  ],
  controllers: [KairosWhatsappController],
  providers: [KairosWhatsappService],
})
export class KairosWhatsappModule {}