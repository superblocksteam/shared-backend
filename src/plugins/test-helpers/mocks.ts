import { RelayDelegate } from '../../relay/delegate';

export const MOCK_EXECUTION_CONTEXT = {
  globals: {
    params: { environment: 'dev' },
    body: {},
    Env: {}
  },
  outputs: {},
  preparedStatementContext: [],
  addGlobalVariable: (): void => undefined,
  addGlobalsOverride: (): void => undefined,
  addGlobalVariableOverride: (): void => undefined,
  addOutput: (): void => undefined,
  merge: (): void => undefined
};

export const MOCK_DB_DATASOURCE_CONFIGURATION = {
  endpoint: {
    port: 5432,
    host: 'host-url'
  },
  connection: {
    useSsl: true,
    mode: 0
  },
  authentication: {
    custom: {
      databaseName: {
        value: 'superblocks_wayfair_demo'
      },
      account: {
        value: 'test-account'
      }
    },
    password: 'password',
    username: 'demo_user'
  },
  superblocksMetadata: {
    pluginVersion: '0.0.7'
  },
  name: '[Demo] Unit Test'
};

export const MOCK_ACTION_CONFIGURATION = {
  body: 'select * from orders limit 1;',
  usePreparedSql: true,
  superblocksMetadata: {
    pluginVersion: '0.0.7'
  }
};

export const MOCK_EXTRA_PLUGIN_EXECUTION_PROPS = {
  files: [],
  agentCredentials: {},
  recursionContext: {
    executedWorkflowsPath: [],
    isEvaluatingDatasource: false
  },
  environment: 'dev',
  relayDelegate: new RelayDelegate({
    body: {},
    headers: {},
    query: {}
  })
};

export const MOCK_QUERY_RESULT = [
  {
    id: 30000,
    user_id: 'user_id',
    image: 'image_url',
    product: 'Renna Frame Coffee Table',
    date_purchased: '2021-01-22T16:00:00.000Z',
    user_email: 'bad_guy@superblockshq.com',
    price: 249.99
  }
];

export const MOCK_TABLE_RESULT = [
  {
    name: 'id',
    column_type: 'int4',
    default_expr: null,
    kind: 'r',
    table_name: 'orders',
    schema_name: 'public'
  },
  {
    name: 'user_id',
    column_type: 'int8',
    default_expr: null,
    kind: 'r',
    table_name: 'orders',
    schema_name: 'public'
  }
];

export const MOCK_EXPECTED_METADATA = {
  name: 'orders',
  type: 'TABLE',
  columns: [
    { name: 'id', type: 'int4' },
    { name: 'user_id', type: 'int8' }
  ],
  keys: [],
  templates: []
};
