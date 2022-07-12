import { Buffer } from 'buffer';
import fs from 'fs';
import { Readable } from 'stream';
import { ExecutionContext, AGENT_KEY_HEADER } from '@superblocksteam/shared';
import axios from 'axios';
import type { Request } from 'express';

export type RequestFile = Request['file'];
export type RequestFiles = Request['files'];

export async function getFileStream(context: ExecutionContext, location: string): Promise<Readable> {
  if (!('$flagWorker' in context.globals) || !context.globals['$flagWorker']) {
    return fs.createReadStream(location);
  }

  const headers = {};
  headers[AGENT_KEY_HEADER] = context.globals['$agentKey'];

  const response = await axios.get(`${context.globals['$fileServerUrl']}?location=${location}`, {
    headers,
    responseType: 'stream'
  });

  return response.data;
}

export async function getFileBuffer(context: ExecutionContext, location: string): Promise<Buffer> {
  const stream = await getFileStream(context, location);

  return await new Promise<Buffer>((resolve, reject) => {
    const _buffer = Array<Uint8Array>();

    stream.on('data', (chunk) => _buffer.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(_buffer)));
    stream.on('error', (err) => reject(err));
  });
}

export async function getEncodedFile(context: ExecutionContext, location: string, encoding: BufferEncoding): Promise<string> {
  const _buffer = await getFileBuffer(context, location);
  return _buffer.toString(encoding);
}
