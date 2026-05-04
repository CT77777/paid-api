import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { X402PaymentGuard } from './guards/x402-payment.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/secret-data')
  @UseGuards(X402PaymentGuard)
  getSecretData(): number {
    console.log('🔐 已驗證支付，正在提供付費資源...');
    return 220;
  }
}
