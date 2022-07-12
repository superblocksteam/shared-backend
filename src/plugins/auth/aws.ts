import { AWSDatasourceConfiguration } from '@superblocksteam/shared';
import { ConfigurationOptions, TokenFileWebIdentityCredentials } from 'aws-sdk';
import { isEmpty } from 'lodash';

export function getAwsClientConfig(datasourceConfig: AWSDatasourceConfiguration): ConfigurationOptions {
  if (
    isEmpty(datasourceConfig.authentication?.custom?.region?.value) ||
    isEmpty(datasourceConfig.authentication?.custom?.accessKeyID?.value) ||
    isEmpty(datasourceConfig.authentication?.custom?.secretKey?.value)
  ) {
    return {
      credentials: new TokenFileWebIdentityCredentials()
    };
  }

  return {
    region: datasourceConfig.authentication?.custom?.region?.value,
    accessKeyId: datasourceConfig.authentication?.custom?.accessKeyID?.value,
    secretAccessKey: datasourceConfig.authentication?.custom?.secretKey?.value
  };
}
