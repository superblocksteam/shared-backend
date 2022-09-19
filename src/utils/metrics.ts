import { toMetricLabels } from '@superblocksteam/shared';
import { Summary } from 'prom-client';

export async function observe<T>(
  summary: Summary,
  labels: Record<string, string | number>,
  fn: () => Promise<T>,
  add: (result: T) => Record<string, string | number> = (_: T): Record<string, string | number> => {
    return {};
  }
): Promise<T> {
  const start: number = Date.now();
  const result: T = await fn();
  summary.observe(
    { ...(toMetricLabels(labels) as Record<string, string | number>), ...(toMetricLabels(add(result)) as Record<string, string | number>) },
    Date.now() - start
  );
  return result;
}
