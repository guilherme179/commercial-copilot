import { writeMetricLog } from './metrics-logger';

export function TrackStage(stage: string): MethodDecorator {
  return (descriptor: PropertyDescriptor) => {
    const original = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const start = Date.now();

      try {
        const result = await original.apply(this, args);

        writeMetricLog({
          stage,
          status: 'success',
          durationMs: Date.now() - start,
        });

        return result;
      } catch (err) {
        writeMetricLog({
          stage,
          status: 'error',
          durationMs: Date.now() - start,
          errorType: err instanceof Error ? err.constructor.name : typeof err,
        });

        throw err;
      }
    };

    return descriptor;
  };
}