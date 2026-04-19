import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { Controller, Query, Req, Sse } from '@nestjs/common';
import type { QuestionDto } from './dto/post-question.dto';
import { QuestionZodDto } from './dto/post-question.dto';
import { QueryService } from './query.service';
import { Observable, map } from 'rxjs';

@Controller('query')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Sse('question')
  async question(@Query(new ZodValidationPipe(QuestionZodDto.schema)) query: QuestionDto,  @Req() request: Request & { requestId: string }): Promise<Observable<MessageEvent>> {
    const stream = (await this.queryService.processQuestion(query, request.requestId)) as Observable<  string>;

    return stream.pipe(
      map((token) => ({
        data: token,
      } as MessageEvent)),
    );
  }
}
