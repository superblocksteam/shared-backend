import { context } from '@opentelemetry/api';
import {
  LogFields,
  logger,
  OBS_TAG_RESOURCE_ID,
  OBS_TAG_RESOURCE_TYPE,
  OBS_TAG_ENV,
  OBS_TAG_ORG_ID,
  OBS_TAG_ORG_NAME,
  OBS_TAG_CORRELATION_ID,
  OBS_TAG_RESOURCE_NAME,
  OBS_TAG_USER_EMAIL,
  OBS_TAG_RESOURCE_ACTION,
  OBS_TAG_ERROR,
  OBS_TAG_ERROR_TYPE,
  OBS_TAG_CONTROLLER_ID,
  OBS_TAG_WORKER_ID,
  OBS_TAG_PARENT_ID,
  OBS_TAG_PARENT_NAME,
  OBS_TAG_PARENT_TYPE,
  OBS_TAG_PLUGIN_NAME,
  OBS_TAG_INTEGRATION_ID
} from '@superblocksteam/shared';
import { default as P, default as pino } from 'pino';
import { otelSpanContextToDataDog } from './tracing';

// RemoteLogger lets us enforce the precense of required
// logging fields that we must send to the customer.
export class RemoteLogger implements logger {
  static EligibleField = 'remote';

  private _logger: P.Logger;

  constructor({ enabled, stream }: { enabled: boolean; stream?: P.DestinationStream }) {
    const formatters = {
      level: (label) => {
        return { level: label };
      }
    };

    const pinoConfig: P.LoggerOptions = {
      name: undefined, // do not set
      level: 'trace', // we want to log everything
      timestamp: true,
      messageKey: 'msg',
      base: {
        remote: 'true'
      },
      enabled,
      formatters,
      mixin() {
        // https://docs.datadoghq.com/tracing/other_telemetry/connect_logs_and_traces/opentelemetry/?tab=nodejs
        return otelSpanContextToDataDog(context.active());
      }
    };

    if (stream) {
      this._logger = pino(pinoConfig, stream);
    } else {
      this._logger = pino(pinoConfig);
    }
  }

  public trace(fields: LogFields, msg: string): void {
    this._logger.trace(this.marshalFields(fields), msg);
  }

  public debug(fields: LogFields, msg: string): void {
    this._logger.debug(this.marshalFields(fields), msg);
  }

  public warn(fields: LogFields, msg: string): void {
    this._logger.warn(this.marshalFields(fields), msg);
  }

  public error(fields: LogFields, msg: string): void {
    this._logger.error(this.marshalFields(fields), msg);
  }

  public info(fields: LogFields, msg: string): void {
    this._logger.info(this.marshalFields(fields), msg);
  }

  // This is needed so that callers can use `.resourceId`
  // instead of `'resource-id'`. It's somewhat cleaner.
  private marshalFields(fields: LogFields) {
    return {
      [OBS_TAG_RESOURCE_ID]: fields.resourceId,
      [OBS_TAG_RESOURCE_TYPE]: fields.resourceType,
      [OBS_TAG_ENV]: fields.environment,
      [OBS_TAG_ORG_ID]: fields.organizationId,
      [OBS_TAG_ORG_NAME]: fields.organizationName,
      [OBS_TAG_CORRELATION_ID]: fields.correlationId,
      [OBS_TAG_RESOURCE_NAME]: fields.resourceName,
      [OBS_TAG_USER_EMAIL]: fields.userEmail,
      [OBS_TAG_RESOURCE_ACTION]: fields.resourceAction,
      [OBS_TAG_ERROR]: fields.error,
      [OBS_TAG_ERROR_TYPE]: fields.errorType,
      [OBS_TAG_CONTROLLER_ID]: fields.controllerId,
      [OBS_TAG_WORKER_ID]: fields.workerId,
      [OBS_TAG_PARENT_ID]: fields.parentId,
      [OBS_TAG_PARENT_NAME]: fields.parentName,
      [OBS_TAG_PARENT_TYPE]: fields.parentType,
      [OBS_TAG_PLUGIN_NAME]: fields.plugin,
      [OBS_TAG_INTEGRATION_ID]: fields.integragionId
    };
  }
}
