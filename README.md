# shared-backend

This repository contains the source code of shared utilities in the agent and plugin platform.
This is a dependency pulled down by the [agent-controller](https://github.com/superblocksteam/agent-controller) and the [agent-worker](https://github.com/superblocksteam/agent-worker).

**Note**: We have yet to release a major version for this library and breaking changes will be pushed to them until we stabilize and cut a v1 release.

You can find more information about the Agent Platform [here](https://github.com/superblocksteam/agent).

## Build locally

### Requirements

- Node v16

To transpile the source files:

```bash
npm run build
```

To run tests:

```bash
npm run test
```
