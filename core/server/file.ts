import { createReadStream, statSync } from 'node:fs';
import { compressBuffer } from './compress';

function parseRange(range: string, fileSize: number): { start: number; end: number } {
  const [, rangeStart, rangeEnd] = range.match(/bytes=(\d*)-(\d*)/) || [];
  const start = rangeStart ? parseInt(rangeStart, 10) : 0;
  const end = rangeEnd ? parseInt(rangeEnd, 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) {
    throw new Error("Invalid Range");
  }

  return { start, end };
}

export async function sendFile(
  req: Request, 
  filePath: string, 
  cacheScripts = true
): Promise<Response | undefined> {
  try {
    const fileStats = statSync(filePath);

    if (!fileStats.isFile()) {
      return;
    }

    const file = Bun.file(filePath);
    const mimeType = file.type || "application/octet-stream";
    const range = req.headers.get("Range");

    if (range) {
      const { start, end } = parseRange(range, fileStats.size);
      const stream = createReadStream(filePath, { start, end });

      return new Response(stream as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": (end - start + 1).toString(),
          "Content-Range": `bytes ${start}-${end}/${fileStats.size}`,
          "Accept-Ranges": "bytes",
        },
      });
    }

    const { buffer, headers } = await compressBuffer(req, await file.arrayBuffer());
    const noCache = !cacheScripts && ['text/javascript', 'text/css'].find(m => mimeType.startsWith(m));

    return new Response(buffer, { status: 200, headers: {
      "Content-Type": mimeType,
      "Cache-Control": noCache ? "no-cache, no-store, must-revalidate" : "public, max-age=3600",
      "Accept-Ranges": "bytes", 
      ...headers
    } });
  } catch (error) {
    console.error("error serving file:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
