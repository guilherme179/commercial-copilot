import { QueryValidatorService } from '../query-validator/query-validator.service';
import { InterpreterService } from '../interpreter/interpreter.service';
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

  async processQuestion(data: QuestionDto): Promise<unknown> {
    const { question, employeeId } = data;

    const cachedSql = await this.cacheService.get(question, employeeId);

    if(cachedSql) {
      // validação dupla — defesa em profundidade
      this.queryValidatorService.validate(cachedSql);
      const results = await this.dao.executeQuery(cachedSql);
      return this.composerService.compose(question, results);
    }

    const sql = await this.interpreterService.generateSQL({ question, employeeId });

    this.queryValidatorService.validate(sql);

    await this.cacheService.set(question, employeeId, sql);

    const results = await this.dao.executeQuery(sql);

    return this.composerService.compose(question, results);
  }
}
