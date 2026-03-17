import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { X402PaymentGuard } from './guards/x402-payment.guard';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        X402PaymentGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health checks', () => {
    it('should return health status', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
      });
    });

    it('should return readiness status', () => {
      expect(appController.getReady()).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        checks: {
          config: 'ok',
        },
      });
    });
  });
});
