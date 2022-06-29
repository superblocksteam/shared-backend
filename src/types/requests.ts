import { SupportedPluginVersions } from '@superblocksteam/shared';

export interface AgentRegistrationBody {
  pluginVersions: SupportedPluginVersions;
  type?: number;
}
