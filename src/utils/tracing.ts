import { Span, Context, SpanContext, trace, propagation, context } from '@opentelemetry/api';

const UINT_MAX = 4294967296;

// Convert a buffer to a numerical string.
function toNumberString(buffer: Uint8Array, radix = 10) {
  let high = readInt32(buffer, 0);
  let low = readInt32(buffer, 4);
  let str = '';

  radix = radix || 10;

  for (;;) {
    const mod = (high % radix) * UINT_MAX + low;

    high = Math.floor(high / radix);
    low = Math.floor(mod / radix);
    str = (mod % radix).toString(radix) + str;

    if (!high && !low) break;
  }

  return str;
}

// Convert a numerical string to a buffer using the specified radix.
function fromString(str: string, radix: number) {
  const buffer = new Uint8Array(8);
  const len = str.length;

  let pos = 0;
  let high = 0;
  let low = 0;

  if (str[0] === '-') pos++;

  const sign = pos;

  while (pos < len) {
    const chr = parseInt(str[pos++], radix);

    if (!(chr >= 0)) break; // NaN

    low = low * radix + chr;
    high = high * radix + Math.floor(low / UINT_MAX);
    low %= UINT_MAX;
  }

  if (sign) {
    high = ~high;

    if (low) {
      low = UINT_MAX - low;
    } else {
      high++;
    }
  }

  writeUInt32BE(buffer, high, 0);
  writeUInt32BE(buffer, low, 4);

  return buffer;
}

// Write unsigned integer bytes to a buffer.
function writeUInt32BE(buffer, value, offset) {
  buffer[3 + offset] = value & 255;
  value = value >> 8;
  buffer[2 + offset] = value & 255;
  value = value >> 8;
  buffer[1 + offset] = value & 255;
  value = value >> 8;
  buffer[0 + offset] = value & 255;
}

// Read a buffer to unsigned integer bytes.
function readInt32(buffer, offset) {
  return buffer[offset + 0] * 16777216 + (buffer[offset + 1] << 16) + (buffer[offset + 2] << 8) + buffer[offset + 3];
}

// https://docs.datadoghq.com/tracing/other_telemetry/connect_logs_and_traces/opentelemetry/?tab=nodejs
export function otelSpanContextToDataDog(ctx: Context): Record<string, string> {
  const span: Span | undefined = trace.getSpan(ctx);
  if (!span) {
    return {};
  }

  const spanContext: SpanContext = span.spanContext();

  return {
    'dd.trace_id': toNumberString(fromString(spanContext.traceId.slice(spanContext.traceId.length / 2), 16)),
    'dd.span_id': toNumberString(fromString(spanContext.spanId, 16))
  };
}

export function getTraceTagsFromContext(context: Context): Record<string, string> {
  const baggage = propagation.getBaggage(context);
  const traceTags = {};
  baggage?.getAllEntries().forEach((value) => {
    traceTags[value[0]] = value[1].value;
  });
  return traceTags;
}

export function getTraceTagsFromActiveContext(): Record<string, string> {
  return getTraceTagsFromContext(context.active());
}
