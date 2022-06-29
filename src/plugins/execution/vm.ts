import { ExecutionContext, ExecutionOutput } from '@superblocksteam/shared';
import { NodeVM } from 'vm2';

export function nodeVMWithContext(
  context: ExecutionContext,
  // Keys are the path in the data tree, values are the path on disk
  fileTreeToDisk?: Record<string, string>,
  timeout = 5000,
  extLibs: string[] = [
    'lodash',
    'moment',
    'axios',
    'aws-sdk',
    'xmlbuilder2',
    'base64url',
    'jsonwebtoken',
    'deasync',
    'amazon-qldb-driver-nodejs'
  ]
): NodeVM {
  const vm = new NodeVM({
    console: 'redirect',
    timeout: timeout,
    sandbox: { ...context.globals, ...context.outputs, $superblocksFiles: fileTreeToDisk },
    require: {
      builtin: ['*'],
      external: extLibs
    }
  });
  return vm;
}

export function addLogListenersToVM(vm: NodeVM, output: ExecutionOutput): void {
  if (output) {
    vm.on('console.log', (...data) => {
      output.logInfo(data.join(' '));
    });
    vm.on('console.dir', (...data) => {
      output.logInfo(data.join(' '));
    });
    vm.on('console.warn', (...data) => {
      output.logWarn(data.join(' '));
    });
    vm.on('console.error', (...data) => {
      output.logError(data.join(' '));
    });
  }
}
