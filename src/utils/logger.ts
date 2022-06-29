import { LogFields, logger } from '@superblocksteam/shared';
import { default as P, default as pino } from 'pino';

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
      formatters
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
      'resource-id': fields.resourceId,
      'resource-type': fields.resourceType,
      environment: fields.environment,
      'organization-id': fields.organizationId,
      'correlation-id': fields.correlationId,
      'resource-name': fields.resourceName,
      'user-email': fields.userEmail,
      'resource-action': fields.resourceAction,
      error: fields.error,
      'error-type': fields.errorType,
      'controller-id': fields.controllerId,
      'worker-id': fields.workerId,
      'parent-id': fields.parentId,
      'parent-name': fields.parentName,
      'parent-type': fields.parentType,
      plugin: fields.plugin,
      'integration-id': fields.integragionId
    };
  }
}
