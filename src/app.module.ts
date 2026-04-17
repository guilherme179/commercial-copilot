import { QueryValidatorModule } from './modules/query-validator/query-validator.module';
import { InterpreterModule } from './modules/interpreter/interpreter.module';
import { MonitoringModule } from './common/monitoring/monitoring.module';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ComposerModule } from './modules/composer/composer.module';
import { DatabaseModule } from './common/database/database.module';
import { QueryModule } from './modules/query/query.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    QueryValidatorModule,
    InterpreterModule,
    MonitoringModule,
    ComposerModule,
    DatabaseModule,
    QueryModule,
  ],
})

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
  }
}