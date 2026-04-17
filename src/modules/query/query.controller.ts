import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { Body, Controller, Query, Sse } from '@nestjs/common';
import type { QuestionDto } from './dto/post-question.dto';
import { QuestionZodDto } from './dto/post-question.dto';
import { QueryService } from './query.service';
import { Observable, map } from 'rxjs';

@Controller('query')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Sse('question')
  async question(@Query(new ZodValidationPipe(QuestionZodDto.schema)) query: QuestionDto): Promise<Observable<MessageEvent>> {
    const stream = (await this.queryService.processQuestion(query)) as Observable<  string>;

    return stream.pipe(
      map((token) => ({
        data: token,
      } as MessageEvent)),
    );
  }
}
