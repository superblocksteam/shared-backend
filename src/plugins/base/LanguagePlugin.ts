import {
  ActionConfiguration,
  DatasourceConfiguration,
  DatasourceMetadataDto,
  EvaluationPair,
  ExecutionContext,
  ExecutionOutput,
  LanguageActionConfiguration,
  RawRequest,
  truncatedJsonStringify
} from '@superblocksteam/shared';
import { RelayDelegate } from '../../relay';
import { AgentCredentials } from '../auth';
import { RecursionContext } from '../execution';
import { RequestFiles } from '../files';
import { BasePlugin } from './BasePlugin';

export abstract class LanguagePlugin extends BasePlugin {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract evaluateBindingPairs(code: string, entitiesToExtract: Set<string>, dataContext: Record<string, any>): Promise<EvaluationPair[]>;

  protected async evaluateActionConfig(
    context: ExecutionContext,
    actionConfig: LanguageActionConfiguration
  ): Promise<LanguageActionConfiguration> {
    const replaceAll = (str, find, replace) => {
      const escapedFind = find.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
      return str.replace(new RegExp(escapedFind, 'g'), replace);
    };

    const dataContext = Object.assign({}, context.globals, context.outputs);
    const entitiesToExtract = new Set(Object.keys(dataContext));
    let code = actionConfig.body ?? '';
    const bindingPairs = await this.evaluateBindingPairs(code, entitiesToExtract, dataContext);
    // Sort by longest binding first.
    bindingPairs.sort((l, r) => (l.binding.length < r.binding.length ? 1 : -1));
    for (const pair of bindingPairs) {
      code = replaceAll(code, pair.binding, truncatedJsonStringify(pair.value));
    }
    return { body: code };
  }

  getRequest(actionConfiguration: LanguageActionConfiguration): RawRequest {
    return actionConfiguration.body;
  }

  dynamicProperties(): string[] {
    return ['body'];
  }

  async metadata(datasourceConfiguration: DatasourceConfiguration): Promise<DatasourceMetadataDto> {
    return {};
  }

  async test(datasourceConfiguration: DatasourceConfiguration): Promise<void> {
    return;
  }

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
    relayDelegate
  }: {
    environment: string;
    context: ExecutionContext;
    redactedContext: ExecutionContext;
    agentCredentials: AgentCredentials;
    redactedDatasourceConfiguration: DatasourceConfiguration;
    datasourceConfiguration: DatasourceConfiguration;
    actionConfiguration: LanguageActionConfiguration;
    files: RequestFiles;
    recursionContext: RecursionContext;
    relayDelegate: RelayDelegate;
  }): Promise<ExecutionOutput> {
    let output = new ExecutionOutput();
    let rawRequest: string | undefined;
    try {
      rawRequest = this.getRequest(await this.evaluateActionConfig(redactedContext, actionConfiguration));
      output = await this.timedExecute({
        environment,
        context,
        datasourceConfiguration,
        actionConfiguration: actionConfiguration as ActionConfiguration,
        files,
        agentCredentials,
        recursionContext,
        relayDelegate
      });
      output.request = rawRequest;
      this.logger.info(`Executing API step ${this.name()} took ${output.executionTime}ms`);
    } catch (err) {
      this.logger.info(`Executing API step ${this.name()} failed with error: ${err.message}`);
      output.request = rawRequest;
      output.logError(err.message);
    }
    return output;
  }
}
