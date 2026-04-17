import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MonitoringModule } from './common/monitoring/monitoring.module';
import { DatabaseModule } from './common/database/database.module';
import { QueryModule } from './modules/query/query.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    MonitoringModule,
    DatabaseModule,
    QueryModule,
  ],
})

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
  }
}