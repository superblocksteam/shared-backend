import { ApiExecutionResponse } from '@superblocksteam/shared';
import { FetchAndExecuteProps } from '../execution';

export type PluginConfiguration = JavascriptPluginConfiguration &
  PythonPluginConfiguration &
  WorkflowPluginConfiguration &
  RestApiPluginConfiguration;

export type JavascriptPluginConfiguration = {
  javascriptExecutionTimeoutMs: string;
};

export type PythonPluginConfiguration = {
  pythonExecutionTimeoutMs: string;
};

export type WorkflowPluginConfiguration = {
  workflowFetchAndExecuteFunc: (fetchAndExecuteProps: FetchAndExecuteProps) => Promise<ApiExecutionResponse>;
};

export type RestApiPluginConfiguration = {
  restApiExecutionTimeoutMs: number;
};
