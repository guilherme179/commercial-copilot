import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ErrorLoggingInterceptor } from './common/interceptors/error.interceptor';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(),
    new ErrorLoggingInterceptor(),
  );
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
