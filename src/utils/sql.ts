import { ActionConfiguration, ExecutionContext } from '@superblocksteam/shared';
import { extractMustacheStrings, renderValue, RequestFiles, resolveAllBindings } from '..';

export type ActionConfigurationResolutionContext = {
  context: ExecutionContext;
  actionConfiguration: ActionConfiguration;
  files: RequestFiles;
  property: string;
  escapeStrings: boolean;
};

export async function resolveActionConfigurationPropertyUtil(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  superResolveActionConfigurationProperty: (resolutionContext: ActionConfigurationResolutionContext) => Promise<string | any[]>,
  resolutionContext: ActionConfigurationResolutionContext,
  useOrderedParameters = true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<string | any[]> {
  if (!resolutionContext.actionConfiguration.usePreparedSql || resolutionContext.property !== 'body') {
    return superResolveActionConfigurationProperty({
      context: resolutionContext.context,
      actionConfiguration: resolutionContext.actionConfiguration,
      files: resolutionContext.files,
      property: resolutionContext.property,
      escapeStrings: resolutionContext.escapeStrings
    });
  }
  const propertyToResolve = resolutionContext.actionConfiguration[resolutionContext.property] ?? '';
  const bindingResolution = {};
  const bindingResolutions = await resolveAllBindings(
    propertyToResolve,
    resolutionContext.context,
    resolutionContext.files ?? {},
    resolutionContext.escapeStrings
  );
  resolutionContext.context.preparedStatementContext = [];
  let bindingCount = 1;
  for (const toEval of extractMustacheStrings(propertyToResolve)) {
    bindingResolution[toEval] = useOrderedParameters ? `$${bindingCount++}` : '?';
    resolutionContext.context.preparedStatementContext.push(bindingResolutions[toEval]);
  }
  return renderValue(propertyToResolve, bindingResolution);
}
