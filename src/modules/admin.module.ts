import { Module } from '@nestjs/common';
import { AdminService } from '../application/admin/admin.service';
import { AdminController } from '../presentation/admin/admin.controller';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
