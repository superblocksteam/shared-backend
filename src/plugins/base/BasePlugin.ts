import {
  ActionConfiguration,
  DatasourceConfiguration,
  DatasourceMetadataDto,
  ExecutionContext,
  ExecutionOutput,
  ForwardedCookies,
  RawRequest
} from '@superblocksteam/shared';
import _ from 'lodash';
import P from 'pino';
import { RelayDelegate } from '../../relay';
import { ActionConfigurationResolutionContext, addErrorSuggestion } from '../../utils';
import { AgentCredentials } from '../auth';
import { PluginConfiguration } from '../configuration';
import { RecursionContext, resolveActionConfiguration } from '../execution';
import { RequestFiles } from '../files';
export interface PluginExecutionProps<ConfigurationType = DatasourceConfiguration> {
  context: ExecutionContext;
  datasourceConfiguration: ConfigurationType;
  actionConfiguration: ActionConfiguration;
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

export abstract class BasePlugin {
  logger: P.Logger;
  pluginConfiguration: PluginConfiguration;

  attachLogger(logger: P.Logger): void {
    this.logger = logger;
  }

  configure(pluginConfiguration: PluginConfiguration): void {
    this.pluginConfiguration = pluginConfiguration;
  }

  abstract execute(executionProps: PluginExecutionProps): Promise<ExecutionOutput>;

  getRequest(actionConfiguration: ActionConfiguration, datasourceConfiguration: DatasourceConfiguration, files: RequestFiles): RawRequest {
    return undefined;
  }

  // (e.g. API based plugins will have different metadata than database plugins)
  abstract metadata(
    datasourceConfiguration: DatasourceConfiguration,
    actionConfiguration?: ActionConfiguration
  ): Promise<DatasourceMetadataDto>;

  abstract test(datasourceConfiguration: DatasourceConfiguration): Promise<void>;

  // method that will be executed before deleting a plugin from database
  preDelete(datasourceConfiguration: DatasourceConfiguration): Promise<void> {
    // No-op
    return Promise.resolve();
  }

  //TODO for plugin templates to be more declarative, we should consider
  // parsing all action/datasource configurations instead of hardcoding the fields here
  abstract dynamicProperties(): Array<string>;

  // No-op to be implemented by child class
  init(): void {
    // No-op
  }

  // No-op to be implemented by child class
  shutdown(): void {
    // No-op
  }

  // escapeStringProperties specifies the properties whose bindings should be
  // string escaped.
  escapeStringProperties(): Array<string> {
    return [];
  }

  name(): string {
    return this.constructor.name;
  }

  async timedExecute({
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
  async resolveActionConfigurationProperty(resolutionContext: ActionConfigurationResolutionContext): Promise<string | any[]> {
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
  async setupAndExecute({
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
    try {
      // resolve dynamic ActionConfiguration properties
      for (const property of this.dynamicProperties()) {
        if (!_.get(actionConfiguration, property, undefined)) {
          // dynamic property has not been set.
          continue;
        }

        const shouldEscapeProperty = this.escapeStringProperties().includes(property);
        _.set(
          actionConfiguration,
          property,
          await this.resolveActionConfigurationProperty({
            context: redactedContext,
            actionConfiguration,
            files,
            property,
            escapeStrings: shouldEscapeProperty
          })
        );
        context.preparedStatementContext = redactedContext.preparedStatementContext;
      }
      rawRequest = this.getRequest(actionConfiguration, redactedDatasourceConfiguration, files);
      output.request = rawRequest;
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
      this.logger.info(`Executing API step ${this.name()} took ${output.executionTime}ms`);
    } catch (err) {
      output.logError(err.message);
      this.logger.info(`Executing API step ${this.name()} failed with error: ${err.message}`);
    }
    return output;
  }
}
