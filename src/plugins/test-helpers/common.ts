import { ExecutionContext } from '@superblocksteam/shared';
import { RelayDelegate } from '../../relay';
import { AgentCredentials } from '../auth';

export const EXECUTE_COMMON_PARAMETERS = {
  context: new ExecutionContext(),
  datasourceConfiguration: {},
  files: undefined,
  agentCredentials: new AgentCredentials({}),
  recursionContext: { executedWorkflowsPath: [], isEvaluatingDatasource: false },
  environment: 'prod',
  relayDelegate: new RelayDelegate({
    body: {
      relays: {
        headers: {},
        query: {},
        body: {}
      }
    }
  })
};
