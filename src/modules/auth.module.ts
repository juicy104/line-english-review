import { Module } from '@nestjs/common';
import { AuthService } from '../application/auth/auth.service';
import { AuthController } from '../presentation/auth/auth.controller';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
