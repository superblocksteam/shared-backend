import { SpanKind, SpanStatusCode, Tracer } from '@opentelemetry/api';
import { IntegrationError, PlaceholdersInfo, ResolvedActionConfigurationProperty } from '@superblocksteam/shared';
import { ActionConfigurationResolutionContext, showBoundValue } from '../../utils';
import { extractMustacheStrings, renderValueWithLoc, resolveAllBindings } from '../execution';
import { BasePlugin, ResolveActionConfigurationProperty } from './BasePlugin';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function CreateConnection(target: DatabasePlugin, name: string, descriptor: PropertyDescriptor) {
  const fn = descriptor.value;
  descriptor.value = async function (...args) {
    return (this.tracer as Tracer).startActiveSpan(
      'databasePlugin.createConnection',
      {
        attributes: this.getTraceTags(),
        kind: SpanKind.SERVER
      },
      async (span) => {
        try {
          const result = await fn?.apply(this, args);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (err) {
          span.setStatus({ code: SpanStatusCode.ERROR });
          span.recordException(err);
          throw new IntegrationError(`failed to create ${this.name()} connection: ${err}`);
        } finally {
          span.end();
        }
      }
    );
  };
  return descriptor;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function DestroyConnection(
  target: DatabasePlugin,
  name: string,
  descriptor: TypedPropertyDescriptor<(connection: unknown) => Promise<void>>
) {
  const fn = descriptor.value;
  descriptor.value = function (...args) {
    return (this.tracer as Tracer).startActiveSpan(
      'databasePlugin.destroyConnection',
      {
        attributes: this.getTraceTags(),
        kind: SpanKind.SERVER
      },
      async (span) => {
        try {
          const result = await fn?.apply(this, args);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (err) {
          span.setStatus({ code: SpanStatusCode.ERROR });
          span.recordException(err);
          this.logger.warn(`failed to destroy ${this.name()} connection: ${err}`);
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
  protected readonly useOrderedParameters: boolean = true;

  @ResolveActionConfigurationProperty
  public async resolveActionConfigurationProperty({
    context,
    actionConfiguration,
    files,
    property,
    escapeStrings
  }: // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ActionConfigurationResolutionContext): Promise<ResolvedActionConfigurationProperty> {
    return this._resolveActionConfigurationProperty(
      {
        context,
        actionConfiguration,
        files,
        property,
        escapeStrings
      },
      this.useOrderedParameters
    );
  }

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
          span.recordException(err);
          throw new IntegrationError(`${this.name()} query failed to execute: ${err}`);
        } finally {
          span.end();
        }
      }
    );
  }

  private async _resolveActionConfigurationProperty(
    resolutionContext: ActionConfigurationResolutionContext,
    useOrderedParameters = true
  ): Promise<ResolvedActionConfigurationProperty> {
    if (!resolutionContext.actionConfiguration.usePreparedSql || resolutionContext.property !== 'body') {
      return super.resolveActionConfigurationProperty({
        context: resolutionContext.context,
        actionConfiguration: resolutionContext.actionConfiguration,
        files: resolutionContext.files,
        property: resolutionContext.property,
        escapeStrings: resolutionContext.escapeStrings
      });
    }
    const propertyToResolve = resolutionContext.actionConfiguration[resolutionContext.property] ?? '';
    const bindingResolution: Record<string, string> = {};
    const bindingResolutions = await resolveAllBindings(
      propertyToResolve,
      resolutionContext.context,
      resolutionContext.files ?? {},
      resolutionContext.escapeStrings
    );
    resolutionContext.context.preparedStatementContext = [];
    let bindingCount = 1;
    for (const toEval of extractMustacheStrings(propertyToResolve)) {
      // if this binding has been handled already, keep the value assigned to it the first time
      if (!Object.prototype.hasOwnProperty.call(bindingResolution, toEval)) {
        bindingResolution[toEval] = useOrderedParameters ? `$${bindingCount++}` : '?';
        resolutionContext.context.preparedStatementContext.push(bindingResolutions[toEval]);
      }
    }
    const { renderedStr: resolved, bindingLocations } = renderValueWithLoc(propertyToResolve, bindingResolution);
    const placeholdersInfo: PlaceholdersInfo = {};
    for (const [bindingName, bindingValue] of Object.entries(bindingResolutions)) {
      const bindingNumeric = bindingResolution[bindingName];
      const locations = bindingLocations[bindingName];
      if (bindingNumeric !== undefined && locations !== undefined) {
        placeholdersInfo[bindingNumeric] = {
          locations,
          value: showBoundValue(bindingValue)
        };
      }
    }
    return { resolved, placeholdersInfo };
  }
}
