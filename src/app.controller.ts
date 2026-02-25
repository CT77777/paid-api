import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/secret-data')
  getSecretData(): number {
    console.log('🔐 已驗證支付，正在提供付費資源...');
    return 220;
  }
}
