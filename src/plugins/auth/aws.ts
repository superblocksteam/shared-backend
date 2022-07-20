import { AWSAuthType, AWSDatasourceConfiguration } from '@superblocksteam/shared';
import { ConfigurationOptions, TokenFileWebIdentityCredentials } from 'aws-sdk';

export function getAwsClientConfig(datasourceConfig: AWSDatasourceConfiguration): ConfigurationOptions {
  switch (datasourceConfig.awsAuthType) {
    case AWSAuthType.EC2_INSTANCE_METADATA:
      return {};
    case AWSAuthType.TOKEN_FILE:
      return {
        credentials: new TokenFileWebIdentityCredentials()
      };
    case AWSAuthType.ACCESS_KEY:
    default:
      return {
        region: datasourceConfig.authentication?.custom?.region?.value,
        accessKeyId: datasourceConfig.authentication?.custom?.accessKeyID?.value,
        secretAccessKey: datasourceConfig.authentication?.custom?.secretKey?.value
      };
  }
}
