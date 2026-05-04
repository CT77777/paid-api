import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { X402PaymentGuard } from './x402-payment.guard';

describe('X402PaymentGuard', () => {
  const getExecutionContext = (headers: Record<string, string>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
        getResponse: () => ({
          setHeader: jest.fn(),
        }),
      }),
    }) as ExecutionContext;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('blocks blacklisted payer addresses before verification', async () => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'BLACKLISTED_ADDRESSES') {
          return '0xabc,0xdef';
        }

        return defaultValue ?? '';
      }),
    } as unknown as ConfigService;

    const guard = new X402PaymentGuard(configService);
    const fetchSpy = jest.spyOn(global, 'fetch');

    const context = getExecutionContext({
      'payment-signature': 'signed',
      'payment-authorization': JSON.stringify({
        from: '0xAbC',
        to: '0x123',
        value: '1000',
        validAfter: 0,
        validBefore: 9999999999,
        nonce: '1',
      }),
    });

    try {
      await guard.canActivate(context);
      fail('Expected blacklisted address to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect((error as HttpException).message).toBe(
        'Address is blocked from payment or access',
      );
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
