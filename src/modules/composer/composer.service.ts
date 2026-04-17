// src/modules/composer/composer.service.ts
import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class ComposerService {
  private readonly baseUrl = process.env.LLM_BASE_URL;
  private readonly model = process.env.LLM_MODEL;

  compose(question: string, data: unknown[]): Observable<string> {
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