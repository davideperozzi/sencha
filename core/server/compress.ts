import { brotliCompressSync } from "zlib";

export async function compressBuffer(req: Request, rawBuffer: ArrayBuffer | string) {
  const acceptEncoding = req.headers.get("Accept-Encoding") || "";
  let compressedBuffer: Uint8Array | null = null;
  let encoding: string | null = null;

  if (acceptEncoding.includes("br")) {
    compressedBuffer = new Uint8Array(brotliCompressSync(rawBuffer));
    encoding = "br";
  } else if (acceptEncoding.includes("gzip")) {
    compressedBuffer = new Uint8Array(Bun.gzipSync(rawBuffer));
    encoding = "gzip";
  } else if (acceptEncoding.includes("deflate")) {
    compressedBuffer = new Uint8Array(Bun.deflateSync(rawBuffer));
    encoding = "deflate";
  }

  const buffer =  compressedBuffer || (
    rawBuffer instanceof ArrayBuffer ? new Uint8Array(rawBuffer) : rawBuffer
  );

  return encoding ? { 
    buffer, 
    headers: {
      "Content-Length": buffer.length.toString(),
      "Content-Encoding": encoding
    }
  } : { buffer };
}
