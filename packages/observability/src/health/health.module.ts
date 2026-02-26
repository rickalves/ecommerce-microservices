import { Module, DynamicModule } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HEALTH_OPTIONS, HealthModuleOptions } from './health.tokens';

export { HEALTH_OPTIONS } from './health.tokens';
export type { HealthModuleOptions } from './health.tokens';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [{ provide: HEALTH_OPTIONS, useValue: { database: false } }],
})
export class HealthModule {
  static forRoot(options: HealthModuleOptions = {}): DynamicModule {
    return {
      module: HealthModule,
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [{ provide: HEALTH_OPTIONS, useValue: options }],
    };
  }
}
