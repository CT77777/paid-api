import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService, HealthStatus, ReadyStatus } from './app.service';
import { X402PaymentGuard } from './guards/x402-payment.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/health')
  getHealth(): HealthStatus {
    return this.appService.getHealth();
  }

  @Get('/ready')
  getReady(): ReadyStatus {
    return this.appService.getReadiness();
  }

  @Get('/secret-data')
  @UseGuards(X402PaymentGuard)
  getSecretData(): number {
    console.log('🔐 已驗證支付，正在提供付費資源...');
    return 220;
  }
}
