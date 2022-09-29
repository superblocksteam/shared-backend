import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { IntegrationError } from '@superblocksteam/shared';
import { BasePlugin } from './BasePlugin';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function CreateConnection(target: DatabasePlugin, name: string, descriptor: PropertyDescriptor) {
  const fn = descriptor.value;
  descriptor.value = async function (...args) {
    return this.tracer.startActiveSpan(
      `databasePlugin.createConnection`,
      {
        attributes: this.getTraceTags(),
        kind: SpanKind.SERVER
      },
      async (span) => {
        try {
          const result = await fn.apply(this, args);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (err) {
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw new IntegrationError(`failed to create ${this.name} connection: ${err}`);
        } finally {
          span.end();
        }
      }
    );
  };
  return descriptor;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function DestroyConnection(target: DatabasePlugin, name: string, descriptor: PropertyDescriptor) {
  const fn = descriptor.value;
  descriptor.value = async function (...args) {
    return this.tracer.startActiveSpan(
      `databasePlugin.destroyConnection`,
      {
        attributes: this.getTraceTags(),
        kind: SpanKind.SERVER
      },
      async (span) => {
        try {
          const result = await fn.apply(this, args);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (err) {
          span.setStatus({ code: SpanStatusCode.ERROR });
          this.logger.warn(`failed to destroy ${this.name} connection: ${err}`);
        } finally {
          span.end();
        }
      }
    );
  };
  return descriptor;
}

// Wrapper class for tracing db plugins
export abstract class DatabasePlugin extends BasePlugin {
  /**
   * Wraps Queries for tracing
   * @param queryFunc code to trace
   * @param additionalTraceTags any additional tags for the span
   * @returns anything returned by queryFunc
   */
  protected executeQuery<T>(queryFunc: () => Promise<T>, additionalTraceTags: Record<string, string> = {}): Promise<T> {
    return this.tracer.startActiveSpan(
      'databasePlugin.executeQuery',
      {
        attributes: {
          ...this.getTraceTags(),
          ...additionalTraceTags
        },
        kind: SpanKind.SERVER
      },
      async (span) => {
        try {
          const result = await queryFunc();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (err) {
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw new IntegrationError(`${this.name} query failed to execute: ${err}`);
        } finally {
          span.end();
        }
      }
    );
  }
}
