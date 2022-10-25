import {
  ApiActionConfiguration,
  ExecutionOutput,
  IntegrationError,
  InternalServerError,
  KVPair,
  Property,
  RestApiBodyDataType
} from '@superblocksteam/shared';
import axios, { AxiosRequestConfig, Method } from 'axios';
import FormData from 'form-data';
import { isEmpty } from 'lodash';
import { BasePlugin } from './BasePlugin';

export const updateRequestBody = function ({
  actionConfiguration,
  headers,
  options
}: {
  actionConfiguration: ApiActionConfiguration;
  headers: Record<string, unknown>;
  options: AxiosRequestConfig;
}): void {
  switch (actionConfiguration.bodyType) {
    case RestApiBodyDataType.JSON: {
      if (!isEmpty(actionConfiguration.body)) {
        try {
          const parsedBody = JSON.parse(actionConfiguration.body as string);
          options.data = parsedBody;
        } catch (err) {
          throw new IntegrationError(`Invalid JSON provided. ${err.message}`);
        }
      }
      break;
    }
    case RestApiBodyDataType.RAW: {
      if (!isEmpty(actionConfiguration.body)) {
        options.data = actionConfiguration.body;
      }
      break;
    }
    case RestApiBodyDataType.FORM: {
      if (!isEmpty(actionConfiguration.formData)) {
        const formData = new FormData();
        for (const property of actionConfiguration.formData as KVPair[]) {
          if (!isEmpty(property.key)) {
            const opts: FormData.AppendOptions | undefined = property.file === undefined ? undefined : { filename: property.file.filename };
            formData.append(property.key as string, property.value, opts);
          }
        }
        options.data = formData;
        // We need to attach form headers as it generates the Boundary
        // for multipart/forms content types
        options.headers = {
          ...headers,
          ...formData.getHeaders()
        };
      }
      break;
    }
    case RestApiBodyDataType.FILE_FORM:
      {
        if (!isEmpty(actionConfiguration.fileName) && !isEmpty(actionConfiguration.body) && !isEmpty(actionConfiguration.fileFormKey)) {
          const formData = new FormData();
          formData.append(actionConfiguration.fileFormKey as string, Buffer.from(actionConfiguration.body as string), {
            filename: actionConfiguration.fileName
          });
          options.data = formData;
          // We need to attach form headers as it generates the Boundary
          // for multipart/forms content types
          options.headers = {
            ...headers,
            ...formData.getHeaders()
          };
        }
      }
      break;
  }
};

export abstract class ApiPlugin extends BasePlugin {
  executeRequest(requestConfig: AxiosRequestConfig): Promise<ExecutionOutput> {
    return new Promise((resolve, reject) => {
      axios(requestConfig)
        .then((response) => {
          const ret = new ExecutionOutput();
          ret.output = response.data;
          resolve(ret);
        })
        .catch((error) => {
          let errMessage = error.message;
          if (error.response?.statusText) {
            errMessage += `: ${error.response?.statusText}`;
          }
          if (error.response?.data) {
            const responseData =
              typeof error.response?.data === 'string' ? error.response?.data : JSON.stringify(error.response?.data, null, 2);
            errMessage += '\nBody:\n' + responseData;
          }
          reject(new Error(errMessage));
        });
    });
  }

  generateRequestConfig(actionConfiguration: ApiActionConfiguration): AxiosRequestConfig {
    if (!actionConfiguration.path) {
      throw new InternalServerError('Action confguration path is missing.');
    }

    if (!actionConfiguration.headers) {
      throw new InternalServerError('Action configuration headers are missing.');
    }

    const endpoint = new URL(actionConfiguration.path);
    const requestConfig: AxiosRequestConfig = {
      url: endpoint.toString(),
      method: actionConfiguration.httpMethod as Method,
      headers: this.getHeaders(actionConfiguration.headers)
    };

    return requestConfig;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getHeaders(actionHeaders: Property[]): any {
    try {
      let headers = {};
      const headerList = actionHeaders;
      if (headerList) {
        headers = headerList.reduce<Record<string, unknown>>((o: Record<string, unknown>, p: Property, _i: number, _ps: Property[]) => {
          if (p.key !== null && p.key !== undefined && p.key != '' && !Object.prototype.hasOwnProperty.call(o, p.key)) {
            o[p.key] = p.value;
          }
          return o;
        }, {});
        return headers;
      }
    } catch (err) {
      throw new InternalServerError(`Headers failed to transform - ${err.message}`);
    }
  }
}
