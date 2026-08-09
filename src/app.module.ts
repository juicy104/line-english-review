import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './modules/admin.module';
import { HealthModule } from './modules/health.module';
import { LineModule } from './modules/line.module';
import { PrismaModule } from './modules/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AdminModule,
    HealthModule,
    LineModule,
  ],
})
export class AppModule {}
