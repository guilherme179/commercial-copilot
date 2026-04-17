import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { MySqlTransactionService } from './mysql-transaction.service';
import type { Pool } from 'mysql2';

@Injectable()
class MySqlPoolLifecycle implements OnApplicationShutdown {
  private readonly logger = new Logger(MySqlPoolLifecycle.name);
  private hasEnded = false;

  constructor(@Inject('MYSQL_POOL') private readonly pool: Pool) {}

  async onApplicationShutdown(signal?: string) {
    if (this.hasEnded) return;

    this.hasEnded = true;

    try {
      const isSignal = signal ? ` (signal: ${signal})` : '';
      this.logger.log(`Encerrando pool MySQL${isSignal}`);
      await this.pool.end();
      this.logger.log('Pool MySQL encerrado com sucesso');
    } catch (error) {
      this.logger.error(
        'Falha ao encerrar pool MySQL',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: 'MYSQL_POOL',
      useFactory: async () => {
        const connectionLimit = Number(process.env.MYSQL_POOL_MAX ?? 10);
        const connectTimeout = Number(process.env.MYSQL_CONNECTION_TIMEOUT_MS ?? 5000);
        const idleTimeout = Number(process.env.MYSQL_IDLE_TIMEOUT_MS ?? 30000);

        const pool = mysql.createPool({
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT) || 3306,
          user: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_DATABASE,
          connectionLimit,
          connectTimeout,
          idleTimeout,          // mysql2 >= 3.x
          timezone: '-03:00',   // América/São Paulo sem depender do SO
          waitForConnections: true,
          multipleStatements: false, // segurança: bloqueia SQL injection via ;
        });

        const logger = new Logger('MYSQL_POOL');

        pool.on('connection', () => {
          logger.debug('Nova conexão criada no pool MySQL');
        });

        // Teste de conexão — aqui relança se falhar
        try {
          const conn = await pool.getConnection();
          conn.release();
          logger.log(
            `Pool MySQL inicializado | max=${connectionLimit} connectTimeoutMs=${connectTimeout} idleTimeoutMs=${idleTimeout}`,
          );
        } catch (err) {
          logger.error(
            'Erro ao conectar ao banco MySQL na inicialização',
            err instanceof Error ? err.stack : String(err),
          );
          // Derruba a app se o banco não responder na subida
          process.exit(1);
        }

        return pool;
      },
    },
    MySqlTransactionService,
    MySqlPoolLifecycle,
  ],
  exports: ['MYSQL_POOL', MySqlTransactionService],
})
export class DatabaseModule {}