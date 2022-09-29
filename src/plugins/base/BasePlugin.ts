import { Tracer, context, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import {
  ActionConfiguration,
  DatasourceConfiguration,
  DatasourceMetadataDto,
  ExecutionContext,
  ExecutionOutput,
  ForwardedCookies,
  PlaceholdersInfo,
  RawRequest,
  ResolvedActionConfigurationProperty,
  IntegrationError
} from '@superblocksteam/shared';
import _ from 'lodash';
import P from 'pino';
import { RelayDelegate } from '../../relay';
import { ActionConfigurationResolutionContext, addErrorSuggestion } from '../../utils';
import { getTraceTagsFromContext } from '../../utils';
import { AgentCredentials } from '../auth';
import { PluginConfiguration } from '../configuration';
import { RecursionContext, resolveActionConfiguration } from '../execution';
import { RequestFiles } from '../files';

export interface PluginExecutionProps<DCType = DatasourceConfiguration, ACType = ActionConfiguration> {
  context: ExecutionContext;
  datasourceConfiguration: DCType;
  actionConfiguration: ACType;
  files: RequestFiles;
  agentCredentials: AgentCredentials;
  recursionContext: RecursionContext;
  environment: string;
  relayDelegate: RelayDelegate;
  forwardedCookies?: ForwardedCookies;
}

// TODO(frank): This could probably use a better name.
export interface PluginProps {
  environment: string;
  context: ExecutionContext;
  redactedContext: ExecutionContext;
  agentCredentials: AgentCredentials;
  redactedDatasourceConfiguration: DatasourceConfiguration;
  datasourceConfiguration: DatasourceConfiguration;
  actionConfiguration: ActionConfiguration;
  files: RequestFiles;
  recursionContext: RecursionContext;
  relayDelegate: RelayDelegate;
  forwardedCookies?: ForwardedCookies;
}

export function Trace(spanName: string, errorMessage?: string, additionalTraceTags?: Record<string, string>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  return function (target: BasePlugin, name: string, descriptor: PropertyDescriptor) {
    const fn = descriptor.value;
    descriptor.value = async function (...args) {
      return this.tracer.startActiveSpan(
        spanName,
        {
          attributes: {
            ...this.getTraceTags(),
            ...additionalTraceTags
          },
          kind: SpanKind.SERVER
        },
        async (span) => {
          try {
            const result = await fn.apply(this, args);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (err) {
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw new IntegrationError(`${errorMessage}: ${err}`);
          } finally {
            span.end();
          }
        }
      );
    };
    return descriptor;
  };
}

export abstract class BasePlugin {
  logger: P.Logger;
  tracer: Tracer;
  pluginConfiguration: PluginConfiguration;

  public attachLogger(logger: P.Logger): void {
    this.logger = logger;
  }

  public attachTracer(tracer: Tracer): void {
    this.tracer = tracer;
  }

  public getTraceTags(): Record<string, string> {
    return getTraceTagsFromContext(context.active());
  }

  public configure(pluginConfiguration: PluginConfiguration): void {
    this.pluginConfiguration = pluginConfiguration;
  }

  public abstract execute(executionProps: PluginExecutionProps): Promise<ExecutionOutput>;

  getRequest(actionConfiguration: ActionConfiguration, datasourceConfiguration: DatasourceConfiguration, files: RequestFiles): RawRequest {
    return undefined;
  }

  // (e.g. API based plugins will have different metadata than database plugins)
  public abstract metadata(
    datasourceConfiguration: DatasourceConfiguration,
    actionConfiguration?: ActionConfiguration
  ): Promise<DatasourceMetadataDto>;

  public abstract test(datasourceConfiguration: DatasourceConfiguration): Promise<void>;

  // method that will be executed before deleting a plugin from database
  public preDelete(datasourceConfiguration: DatasourceConfiguration): Promise<void> {
    // No-op
    return Promise.resolve();
  }

  //TODO for plugin templates to be more declarative, we should consider
  // parsing all action/datasource configurations instead of hardcoding the fields here
  public abstract dynamicProperties(): Array<string>;

  // No-op to be implemented by child class
  public init(): void {
    // No-op
  }

  // No-op to be implemented by child class
  public shutdown(): void {
    // No-op
  }

  // escapeStringProperties specifies the properties whose bindings should be
  // string escaped.
  public escapeStringProperties(): Array<string> {
    return [];
  }

  public name(): string {
    return this.constructor.name;
  }

  public async timedExecute({
    environment,
    context,
    datasourceConfiguration,
    actionConfiguration,
    files,
    agentCredentials,
    recursionContext,
    relayDelegate,
    forwardedCookies
  }: {
    environment: string;
    context: ExecutionContext;
    datasourceConfiguration: DatasourceConfiguration;
    actionConfiguration: ActionConfiguration;
    files: RequestFiles;
    agentCredentials: AgentCredentials;
    recursionContext: RecursionContext;
    relayDelegate: RelayDelegate;
    forwardedCookies?: ForwardedCookies;
  }): Promise<ExecutionOutput> {
    const startTime = new Date();
    const output = await this.execute({
      context,
      datasourceConfiguration,
      actionConfiguration,
      files,
      agentCredentials,
      recursionContext,
      environment,
      relayDelegate,
      forwardedCookies
    });
    output.startTimeUtc = startTime;
    output.executionTime = Date.now() - startTime.getTime();
    return output;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async resolveActionConfigurationProperty(
    resolutionContext: ActionConfigurationResolutionContext
  ): Promise<ResolvedActionConfigurationProperty> {
    return resolveActionConfiguration(
      resolutionContext.context,
      resolutionContext.actionConfiguration,
      resolutionContext.files,
      resolutionContext.property,
      resolutionContext.escapeStrings
    );
  }

  /**
   * Instead of throwing errors to caller, we set the error
   * in the ExecutionOutput and return it to the caller
   */
  public async setupAndExecute({
    environment,
    context,
    redactedContext,
    agentCredentials,
    redactedDatasourceConfiguration,
    datasourceConfiguration,
    actionConfiguration,
    files,
    recursionContext,
    relayDelegate,
    forwardedCookies
  }: PluginProps): Promise<ExecutionOutput> {
    let output = new ExecutionOutput();

    let rawRequest: RawRequest;
    let placeholdersInfo: PlaceholdersInfo | undefined;
    try {
      // resolve dynamic ActionConfiguration properties
      for (const property of this.dynamicProperties()) {
        if (!_.get(actionConfiguration, property, undefined)) {
          // dynamic property has not been set.
          continue;
        }

        const shouldEscapeProperty = this.escapeStringProperties().includes(property);
        const resolvedPropery = await this.resolveActionConfigurationProperty({
          context: redactedContext,
          actionConfiguration,
          files,
          property,
          escapeStrings: shouldEscapeProperty
        });
        _.set(actionConfiguration, property, resolvedPropery.resolved);
        context.preparedStatementContext = redactedContext.preparedStatementContext;
        placeholdersInfo ??= resolvedPropery.placeholdersInfo;
      }
      rawRequest = this.getRequest(actionConfiguration, redactedDatasourceConfiguration, files);
      output.request = rawRequest;
      if (placeholdersInfo) output.placeholdersInfo = placeholdersInfo;
    } catch (err) {
      err.message = addErrorSuggestion(err.message);
      output.logError(`Error evaluating bindings: ${err.message.replace('error evaluating ', '')}`);
      this.logger.info(`Evaluating bindings for API step ${this.name()} failed with error: ${err.message}`);
      return output;
    }

    const localContext = new ExecutionContext(context);

    try {
      output = await this.timedExecute({
        environment,
        context: localContext,
        datasourceConfiguration,
        actionConfiguration,
        files,
        agentCredentials,
        recursionContext,
        relayDelegate,
        forwardedCookies
      });
      output.request = rawRequest;
      if (placeholdersInfo) output.placeholdersInfo = placeholdersInfo;
      this.logger.info(`Executing API step ${this.name()} took ${output.executionTime}ms`);
    } catch (err) {
      output.logError(err.message);
      this.logger.info(`Executing API step ${this.name()} failed with error: ${err.message}`);
    }
    return output;
  }
}
