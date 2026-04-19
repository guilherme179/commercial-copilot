import { QueryValidatorService } from '../query-validator/query-validator.service';
import { InterpreterService } from '../interpreter/interpreter.service';
import { MetricsService } from 'src/common/metrics/metrics.service';
import { PipelineError } from 'src/common/errors/pipeline-error';
import { ComposerService } from '../composer/composer.service';
import { CacheService } from '../cache/cache.service';
import { QuestionDto } from './dto/post-question.dto';
import { Injectable } from '@nestjs/common';
import { QueryDao } from './query.dao';

@Injectable()
export class QueryService {
  constructor(
    private readonly queryValidatorService: QueryValidatorService,
    private readonly interpreterService: InterpreterService,
    private readonly composerService: ComposerService,
    private readonly metricsService: MetricsService,
    private readonly cacheService: CacheService,
    private readonly dao: QueryDao,
  ) {}

  private validateSQL(sql: string): void {
    try {
      this.queryValidatorService.validate(sql);
    } catch (err) {
      throw new PipelineError('sql_validation', err);
    }
  }

  async processQuestion(data: QuestionDto, requestId: string): Promise<unknown> {
    const { question, employeeId } = data;

    const cacheTimer = this.metricsService.time();
    const cachedSql = await this.cacheService.get(question, employeeId).catch((err) => {
      throw new PipelineError('cache_read', err); 
    });
    this.metricsService.write({
      requestId,
      event: cachedSql ? 'cache_hit' : 'cache_miss',
      durationMs: cacheTimer(),
    });

    if(cachedSql) {
      // validação dupla — defesa em profundidade
      this.validateSQL(cachedSql);

      const executionTimer = this.metricsService.time();
      const results = await this.dao.executeQuery(cachedSql).catch((err) => {
        throw new PipelineError('database_execution', err);
      });
      this.metricsService.write({ requestId, event: 'cached_sql_execution', durationMs: executionTimer() });

      return this.composerService.compose(question, results, requestId);
    }

    const generationTimer = this.metricsService.time();
    const sql = await this.interpreterService.generateSQL({ question, employeeId }).catch((err) => {
      throw new PipelineError('sql_generation', err);
    });
    this.metricsService.write({ requestId, event: 'sql_generation', durationMs: generationTimer() });

    this.validateSQL(sql);

    const cacheWriteTimer = this.metricsService.time();
    await this.cacheService.set(question, employeeId, sql).catch((err) => {
      throw new PipelineError('cache_write', err);
    });
    this.metricsService.write({ requestId, event: 'cache_write', durationMs: cacheWriteTimer() });

    const executionTimer = this.metricsService.time();
    const results = await this.dao.executeQuery(sql).catch((err) => {
      throw new PipelineError('database_execution', err);
    });
    this.metricsService.write({ requestId, event: 'sql_execution', durationMs: executionTimer() });

    return this.composerService.compose(question, results, requestId);
  }
}
