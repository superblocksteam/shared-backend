import { toMetricLabels } from '@superblocksteam/shared';
import { Histogram } from 'prom-client';

export async function observe<T>(
  histogram: Histogram,
  labels: Record<string, string | number>,
  fn: () => Promise<T>,
  add: (result: T) => Record<string, string | number> = (_: T): Record<string, string | number> => {
    return {};
  }
): Promise<T> {
  const start: number = Date.now();
  const result: T = await fn();
  histogram.observe(
    { ...(toMetricLabels(labels) as Record<string, string | number>), ...(toMetricLabels(add(result)) as Record<string, string | number>) },
    Date.now() - start
  );
  return result;
}
