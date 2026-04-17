import { QueryValidatorService } from '../query-validator/query-validator.service';
import { InterpreterService } from '../interpreter/interpreter.service';
import { ComposerService } from '../composer/composer.service';
import { QuestionDto } from './dto/post-question.dto';
import { Injectable } from '@nestjs/common';
import { QueryDao } from './query.dao';

@Injectable()
export class QueryService {
  constructor(
    private readonly queryValidatorService: QueryValidatorService,
    private readonly interpreterService: InterpreterService,
    private readonly composerService: ComposerService,
    private readonly dao: QueryDao,
  ) {}

  async processQuestion(data: QuestionDto): Promise<unknown> {
    const { question, employeeId } = data;

    const sql = await this.interpreterService.generateSQL({ question, employeeId });

    this.queryValidatorService.validate(sql);

    const results = await this.dao.executeQuery(sql);

    return this.composerService.compose(question, results);
  }
}
