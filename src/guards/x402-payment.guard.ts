import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

@Injectable()
export class X402PaymentGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    console.log('🔍 X402PaymentGuard: 正在檢查支付狀態...');
    // 從執行上下文中取得 HTTP 請求和回應物件
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // 從請求頭中取得支付簽章
    const rawSignature = request.headers['payment-signature'];
    const signature = Array.isArray(rawSignature)
      ? rawSignature[0]
      : rawSignature;

    // 如果沒有簽章，返回 402 Payment Required
    if (!signature) {
      // 構造支付資訊，告知客戶端需要支付的金額和方式
      const paymentRequiredHeader = {
        amount: this.configService.get<string>('AMOUNT', '100000'),
        asset: this.configService.get<string>('ASSET', ''),
        facilitator: this.configService.get<string>('FACILITATOR_URL', ''),
        recipient: this.configService.get<string>(
          'RECIPIENT_WALLET_ADDRESS',
          '0x123',
        ),
      };

      // 設定 payment-required 標頭
      response.setHeader(
        'payment-required',
        JSON.stringify(paymentRequiredHeader),
      );

      throw new HttpException('Payment Required', HttpStatus.PAYMENT_REQUIRED);
    }

    // 驗證簽章的有效性
    const isValid = await this.verifyPayment(signature);
    if (!isValid) {
      throw new HttpException(
        'Invalid Payment Signature',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }

  /**
   * 向 Facilitator 驗證支付簽章
   * @param signature 支付簽章
   */
  private async verifyPayment(signature: string): Promise<boolean> {
    try {
      // TODO: 實作與 Coinbase Facilitator API 的通訊
      // 應該 POST 到 facilitator 端點來驗證簽章
      // const response = await fetch(
      //   this.configService.get<string>('FACILITATOR_URL', ''),
      //   {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({ signature }),
      //   },
      // );
      // return response.ok;

      return true; // 暫時模擬驗證成功
    } catch (error) {
      console.error('Payment verification failed:', error);
      return false;
    }
  }
}
