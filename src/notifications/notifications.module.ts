import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Installment } from '../installments/installment.entity';
import { MailModule } from '../mail/mail.module';
import { NotificationLog } from './notification-log.entity';
import { InstallmentRemindersService } from './installment-reminders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Installment, NotificationLog]),
    MailModule,
  ],
  providers: [InstallmentRemindersService],
})
export class NotificationsModule {}
