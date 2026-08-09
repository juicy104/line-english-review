import { Module } from '@nestjs/common';
import { AdminService } from '../application/admin/admin.service';
import { AdminController } from '../presentation/admin/admin.controller';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
