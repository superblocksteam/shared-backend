import { ActionConfiguration, ExecutionContext, PlaceholdersInfo, ResolvedActionConfigurationProperty } from '@superblocksteam/shared';
import { extractMustacheStrings, renderValueWithLoc, RequestFiles, resolveAllBindings } from '..';

const MAX_SHOWN_VALUE_LEN = 100;

function showBoundValue(val: unknown) {
  const str = JSON.stringify(val);
  return str.length <= MAX_SHOWN_VALUE_LEN ? str : str.substring(0, MAX_SHOWN_VALUE_LEN) + '…';
}

export type ActionConfigurationResolutionContext = {
  context: ExecutionContext;
  actionConfiguration: ActionConfiguration;
  files: RequestFiles;
  property: string;
  escapeStrings: boolean;
};

export async function resolveActionConfigurationPropertyUtil(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  superResolveActionConfigurationProperty: (
    resolutionContext: ActionConfigurationResolutionContext
  ) => Promise<ResolvedActionConfigurationProperty>,
  resolutionContext: ActionConfigurationResolutionContext,
  useOrderedParameters = true
): Promise<ResolvedActionConfigurationProperty> {
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
