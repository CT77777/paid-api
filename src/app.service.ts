import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
  timestamp: string;
}

export interface ReadyStatus extends HealthStatus {
  checks: {
    config: 'ok';
  };
}

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getHealth(): HealthStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  getReadiness(): ReadyStatus {
    return {
      ...this.getHealth(),
      checks: {
        config: 'ok',
      },
    };
  }
}
