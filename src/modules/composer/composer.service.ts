import { MetricsService } from 'src/common/metrics/metrics.service';
import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { PipelineError } from 'src/common/errors/pipeline-error';

@Injectable()
export class ComposerService {
  private readonly baseUrl = process.env.LLM_BASE_URL;
  private readonly model = process.env.LLM_MODEL;
  constructor(
    private readonly metricsService: MetricsService,
  ) {}

  compose(question: string, data: unknown[], requestId: string): Observable<string> {
    const subject = new Subject<string>();

    const prompt = `
        You are a commercial assistant helping a portfolio manager.
        Answer in Portuguese, in a clear and professional way.
        Base your answer ONLY on the data provided below.
        Do not invent information that is not in the data.
        Be concise and direct.

        Data:
        ${JSON.stringify(data, null, 2)}
    `;

    const compositionTimer = this.metricsService.time();
    fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: question },
        ],
        temperature: 0.3,
        stream: true,
      }),
    }).then(async (response) => {
      this.metricsService.write({ requestId, event: 'composition_response_received', durationMs: compositionTimer() });
      if (!response.ok) {
        const errorText = await response.text();
        throw new PipelineError('llm_composition', new Error(`LLM composition failed: ${response.status} ${response.statusText} - ${errorText}`));
      }
      
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          subject.complete();
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk
          .split('\n')
          .filter((line) => line.startsWith('data: '));

        for (const line of lines) {
          const json = line.replace('data: ', '').trim();

          if (json === '[DONE]') {
            subject.complete();
            this.metricsService.write({ requestId, event: 'composition_completed', durationMs: compositionTimer() });
            return;
          }

          try {
            const parsed = JSON.parse(json);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) subject.next(token);
          } catch {
            // ignora chunks incompletos
          }
        }
      }
    }).catch((err) => subject.error(err));

    return subject.asObservable();
  }
}