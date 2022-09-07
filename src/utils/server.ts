import { Server } from 'http';
import { MaybeError } from '@superblocksteam/shared';
import express, { RequestHandler } from 'express';
import { Closer } from './runtime';

export type HttpServerOptions = {
  handlers: RequestHandler[];
  port: number;
};

export class HttpServer implements Closer {
  private _server: Server;

  constructor(options: HttpServerOptions) {
    const app = express();
    options.handlers.forEach((handler) => app.use(handler));
    this._server = app.listen(options.port);
  }

  public async close(reason?: string): Promise<MaybeError> {
    return await new Promise<void>((resolve, reject) => {
      this._server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}
