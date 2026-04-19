import { QueryValidatorService } from '../query-validator/query-validator.service';
import { InterpreterService } from '../interpreter/interpreter.service';
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

  async processQuestion(data: QuestionDto): Promise<unknown> {
    const { question, employeeId } = data;

    const cachedSql = await this.cacheService.get(question, employeeId).catch((err) => {
      throw new PipelineError('cache_read', err); 
    });

    if(cachedSql) {
      // validação dupla — defesa em profundidade
      this.validateSQL(cachedSql);

      const results = await this.dao.executeQuery(cachedSql).catch((err) => {
        throw new PipelineError('database_execution', err);
      });

      return this.composerService.compose(question, results);
    }

    const sql = await this.interpreterService.generateSQL({ question, employeeId }).catch((err) => {
      throw new PipelineError('sql_generation', err);
    });

    this.validateSQL(sql);

    await this.cacheService.set(question, employeeId, sql).catch((err) => {
      throw new PipelineError('cache_write', err);
    });

    const results = await this.dao.executeQuery(sql).catch((err) => {
      throw new PipelineError('database_execution', err);
    });

    return this.composerService.compose(question, results);
  }
}
