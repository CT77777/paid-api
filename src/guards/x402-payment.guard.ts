import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

interface x402VerifyResponse {
  isValid: boolean; // true 表示簽章無效，false 表示有效
  payer: string; // 付款人地址
  invalidReason?: string; // 如果簽章無效，提供失敗原因
  invalidMessage?: string; // 如果簽章無效，提供失敗訊息
}

interface x402SettleResponse {
  success: boolean; // true 表示處理成功，false 表示失敗
  payer: string; // 付款人地址
  transaction?: string; // 交易哈希
  network?: string; // 網路名稱
  errorReason?: string; // 如果失敗，提供錯誤代碼
  errorMessage?: string; // 如果失敗，提供錯誤訊息
}

interface paymentAuthorization {
  from: string; // 付款人 (Agent)
  to: string; // 收款人 (Server)
  value: string; // 金額
  validAfter: number;
  validBefore: number;
  nonce: string;
}

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
    const rawAuthorization = request.headers['payment-authorization']!;
    let authorization: any = null;
    if (rawAuthorization) {
      try {
        const authString = Array.isArray(rawAuthorization)
          ? rawAuthorization[0]
          : rawAuthorization;
        console.log(authString);
        authorization = JSON.parse(authString) as paymentAuthorization;
        console.log('📋 解析後的 authorization:', authorization);
      } catch (error) {
        console.error('❌ 無法解析 payment-authorization:', error);
        throw new HttpException(
          'Invalid Payment Authorization Format',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

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
    const isValid = await this.verifyPayment(signature, authorization);
    if (!isValid) {
      throw new HttpException(
        'Invalid Payment Signature',
        HttpStatus.FORBIDDEN,
      );
    }
    // 送出處理簽章的鏈上交易，並等待交易完成
    const paymentProcessedResult = await this.processPayment(
      signature,
      authorization,
    );
    if (!paymentProcessedResult) {
      throw new HttpException(
        'Payment Processing Failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return paymentProcessedResult;
  }

  /**
   * 向 Facilitator 驗證支付簽章
   * @param signature 支付簽章
   * @param authorization 支付授權資訊
   */
  private async verifyPayment(
    signature: string,
    authorization: paymentAuthorization,
  ): Promise<boolean> {
    try {
      // TODO: 實作與 Coinbase Facilitator API 的通訊
      // 應該 POST 到 facilitator 端點來驗證簽章
      const facilitatorUrl = this.configService.get<string>(
        'FACILITATOR_URL',
        '',
      );
      const assetAddress = this.configService
        .get<string>('ASSET', '')
        .split(':')
        .pop() as string;

      const response = await fetch(`${facilitatorUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // 1. paymentPayload: 來自 Client 端回傳的證明
          paymentPayload: {
            x402Version: 1,
            scheme: 'exact',
            network: 'base-sepolia',
            payload: {
              signature, // Client 產生的 EIP-712 簽名
              authorization,
            },
          },
          // 2. paymentRequirements: 你(Server)當初在 402 Header 中定義的要求
          paymentRequirements: {
            scheme: 'exact',
            network: 'base-sepolia',
            maxAmountRequired: '200000',
            resource: 'http://localhost:3000/secret-data',
            description: 'Premium API access for data analysis',
            mimeType: 'application/json',
            payTo: authorization.to,
            maxTimeoutSeconds: 300,
            asset: assetAddress,
            outputSchema: { data: 'string' },
            extra: { name: 'USDC', version: '2' },
          },
        }),
      });
      console.log('Facilitator 回應:', response);

      const result = (await response.json()) as x402VerifyResponse;
      console.log('Facilitator 驗證結果:', result);

      return result.isValid;
    } catch (error) {
      console.error('Payment verification failed:', error);
      return false;
    }
  }

  /**
   * 向 Facilitator 處理支付簽章
   * @param signature 支付簽章
   * @param authorization 支付授權資訊
   */
  private async processPayment(
    signature: string,
    authorization: paymentAuthorization,
  ): Promise<boolean> {
    try {
      // 取得 facilitator URL
      const facilitatorUrl = this.configService.get<string>(
        'FACILITATOR_URL',
        '',
      );
      const assetAddress = this.configService
        .get<string>('ASSET', '')
        .split(':')
        .pop() as string;

      // 向 facilitator 的 /settle 端點發送請求，請求處理支付簽章並完成交易
      const response = await fetch(`${facilitatorUrl}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          x402Version: 1,
          paymentPayload: {
            x402Version: 1,
            scheme: 'exact',
            network: 'base-sepolia',
            payload: {
              signature,
              authorization,
            },
          },
          paymentRequirements: {
            scheme: 'exact',
            network: 'base-sepolia',
            maxAmountRequired: '200000',
            resource: 'http://localhost:3000/secret-data',
            description: 'Premium API access for data analysis',
            mimeType: 'application/json',
            payTo: authorization.to,
            maxTimeoutSeconds: 300,
            asset: assetAddress,
            outputSchema: { data: 'string' },
            extra: { name: 'USDC', version: '2' },
          },
        }),
      });
      console.log('Facilitator 處理回應:', response);

      const result = (await response.json()) as x402SettleResponse;
      console.log('Facilitator 處理結果:', result);

      if (!result.success) {
        console.error('Payment processing failed:', result.errorReason);
        return false;
      }

      return result.success;
    } catch (error) {
      console.error('Payment processing failed:', error);
      return false;
    }
  }
}
