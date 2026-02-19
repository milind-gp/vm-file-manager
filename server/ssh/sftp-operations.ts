import type { Client, SFTPWrapper } from "ssh2";
import * as path from "path";
import { acquireSftp, releaseSftp } from "./sftp-pool";

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size: number;
  permissions: string;
  owner: number;
  group: number;
  modified: string;
  accessed: string;
  isHidden: boolean;
}

export interface FileStat {
  type: "file" | "directory" | "symlink";
  size: number;
  permissions: string;
  owner: number;
  group: number;
  modified: string;
  accessed: string;
}

function permissionsToString(mode: number): string {
  const perms = ["---", "--x", "-w-", "-wx", "r--", "r-x", "rw-", "rwx"];
  const owner = perms[(mode >> 6) & 7];
  const group = perms[(mode >> 3) & 7];
  const other = perms[mode & 7];
  return `${owner}${group}${other}`;
}

function getFileType(attrs: { isDirectory: () => boolean; isSymbolicLink: () => boolean }): "file" | "directory" | "symlink" {
  if (attrs.isDirectory()) return "directory";
  if (attrs.isSymbolicLink()) return "symlink";
  return "file";
}

function sanitizePath(inputPath: string): string {
  const resolved = path.posix.resolve("/", inputPath);
  if (resolved.includes("\0")) {
    throw new Error("Invalid path: contains null bytes");
  }
  return resolved;
}

export async function listDirectory(connectionId: string, client: Client, dirPath: string): Promise<{ path: string; entries: FileEntry[]; parent: string | null }> {
  const safePath = sanitizePath(dirPath);
  const sftp = await acquireSftp(connectionId, client);

  try {
    return await new Promise((resolve, reject) => {
      sftp.readdir(safePath, (err, list) => {
        if (err) {
          reject(new Error(`Failed to list directory ${safePath}: ${err.message}`));
          return;
        }

        const entries: FileEntry[] = list.map((item) => ({
          name: item.filename,
          path: path.posix.join(safePath, item.filename),
          type: getFileType(item.attrs),
          size: item.attrs.size,
          permissions: permissionsToString(item.attrs.mode & 0o777),
          owner: item.attrs.uid,
          group: item.attrs.gid,
          modified: new Date((item.attrs.mtime || 0) * 1000).toISOString(),
          accessed: new Date((item.attrs.atime || 0) * 1000).toISOString(),
          isHidden: item.filename.startsWith("."),
        }));

        const parent = safePath === "/" ? null : path.posix.dirname(safePath);
        resolve({ path: safePath, entries, parent });
      });
    });
  } finally {
    releaseSftp(connectionId);
  }
}

export async function statFile(connectionId: string, client: Client, filePath: string): Promise<FileStat> {
  const safePath = sanitizePath(filePath);
  const sftp = await acquireSftp(connectionId, client);

  try {
    return await new Promise((resolve, reject) => {
      sftp.stat(safePath, (err, stats) => {
        if (err) {
          reject(new Error(`Failed to stat ${safePath}: ${err.message}`));
          return;
        }

        resolve({
          type: getFileType(stats),
          size: stats.size,
          permissions: permissionsToString(stats.mode & 0o777),
          owner: stats.uid,
          group: stats.gid,
          modified: new Date((stats.mtime || 0) * 1000).toISOString(),
          accessed: new Date((stats.atime || 0) * 1000).toISOString(),
        });
      });
    });
  } finally {
    releaseSftp(connectionId);
  }
}

export async function readFile(connectionId: string, client: Client, filePath: string): Promise<Buffer> {
  const safePath = sanitizePath(filePath);
  const sftp = await acquireSftp(connectionId, client);

  try {
    return await new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = sftp.createReadStream(safePath);

      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      stream.on("error", (err: Error) => {
        reject(new Error(`Failed to read ${safePath}: ${err.message}`));
      });
    });
  } finally {
    releaseSftp(connectionId);
  }
}

export async function writeFile(connectionId: string, client: Client, filePath: string, content: string | Buffer, encoding: BufferEncoding = "utf-8"): Promise<void> {
  const safePath = sanitizePath(filePath);
  const sftp = await acquireSftp(connectionId, client);

  try {
    return await new Promise((resolve, reject) => {
      const buffer = typeof content === "string" ? Buffer.from(content, encoding) : content;
      const stream = sftp.createWriteStream(safePath);

      stream.on("close", () => {
        resolve();
      });
      stream.on("error", (err: Error) => {
        reject(new Error(`Failed to write ${safePath}: ${err.message}`));
      });

      stream.end(buffer);
    });
  } finally {
    releaseSftp(connectionId);
  }
}

export async function createDirectory(connectionId: string, client: Client, dirPath: string): Promise<void> {
  const safePath = sanitizePath(dirPath);
  const sftp = await acquireSftp(connectionId, client);

  try {
    return await new Promise((resolve, reject) => {
      sftp.mkdir(safePath, (err) => {
        if (err) reject(new Error(`Failed to create directory ${safePath}: ${err.message}`));
        else resolve();
      });
    });
  } finally {
    releaseSftp(connectionId);
  }
}

export async function ensureDirectory(connectionId: string, client: Client, dirPath: string): Promise<void> {
  const safePath = sanitizePath(dirPath);
  const sftp = await acquireSftp(connectionId, client);

  try {
    // Walk from root to target, creating each segment that doesn't exist
    const segments = safePath.split("/").filter(Boolean);
    let current = "/";
    for (const segment of segments) {
      current = path.posix.join(current, segment);
      await new Promise<void>((resolve) => {
        sftp.stat(current, (err) => {
          if (err) {
            // Doesn't exist — create it (ignore EEXIST race)
            sftp.mkdir(current, () => resolve());
          } else {
            resolve();
          }
        });
      });
    }
  } finally {
    releaseSftp(connectionId);
  }
}

export async function deleteFile(connectionId: string, client: Client, filePath: string): Promise<void> {
  const safePath = sanitizePath(filePath);
  const sftp = await acquireSftp(connectionId, client);

  try {
    return await new Promise((resolve, reject) => {
      sftp.unlink(safePath, (err) => {
        if (err) reject(new Error(`Failed to delete ${safePath}: ${err.message}`));
        else resolve();
      });
    });
  } finally {
    releaseSftp(connectionId);
  }
}

export async function deleteDirectory(connectionId: string, client: Client, dirPath: string): Promise<void> {
  const safePath = sanitizePath(dirPath);
  const sftp = await acquireSftp(connectionId, client);

  // Recursive delete
  async function rmrf(sftpSession: SFTPWrapper, targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      sftpSession.readdir(targetPath, async (err, list) => {
        if (err) {
          // Not a directory, try to remove as file
          sftpSession.unlink(targetPath, (unlinkErr) => {
            if (unlinkErr) reject(unlinkErr);
            else resolve();
          });
          return;
        }

        try {
          for (const item of list) {
            const itemPath = path.posix.join(targetPath, item.filename);
            if (item.attrs.isSymbolicLink()) {
              // Never follow symlinks — just remove the link itself
              await new Promise<void>((res, rej) => {
                sftpSession.unlink(itemPath, (e) => (e ? rej(e) : res()));
              });
            } else if (item.attrs.isDirectory()) {
              await rmrf(sftpSession, itemPath);
            } else {
              await new Promise<void>((res, rej) => {
                sftpSession.unlink(itemPath, (e) => (e ? rej(e) : res()));
              });
            }
          }
          await new Promise<void>((res, rej) => {
            sftpSession.rmdir(targetPath, (e) => (e ? rej(e) : res()));
          });
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  try {
    await rmrf(sftp, safePath);
  } finally {
    releaseSftp(connectionId);
  }
}

export async function rename(connectionId: string, client: Client, oldPath: string, newPath: string): Promise<void> {
  const safeOld = sanitizePath(oldPath);
  const safeNew = sanitizePath(newPath);
  const sftp = await acquireSftp(connectionId, client);

  try {
    return await new Promise((resolve, reject) => {
      sftp.rename(safeOld, safeNew, (err) => {
        if (err) reject(new Error(`Failed to rename ${safeOld} to ${safeNew}: ${err.message}`));
        else resolve();
      });
    });
  } finally {
    releaseSftp(connectionId);
  }
}

// Internal stream-based copy using an existing SFTP session
function copyFileWithSftp(sftp: SFTPWrapper, safeSrc: string, safeDest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const readStream = sftp.createReadStream(safeSrc);
    const writeStream = sftp.createWriteStream(safeDest);

    readStream.on("error", (err: Error) => {
      reject(new Error(`Failed to copy ${safeSrc}: ${err.message}`));
    });
    writeStream.on("error", (err: Error) => {
      reject(new Error(`Failed to copy to ${safeDest}: ${err.message}`));
    });
    writeStream.on("close", () => {
      resolve();
    });

    readStream.pipe(writeStream);
  });
}

function mkdirWithSftp(sftp: SFTPWrapper, dirPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.mkdir(dirPath, (err) => {
      if (err) reject(new Error(`Failed to create directory ${dirPath}: ${err.message}`));
      else resolve();
    });
  });
}

function readdirWithSftp(sftp: SFTPWrapper, dirPath: string): Promise<FileEntry[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(dirPath, (err, list) => {
      if (err) {
        reject(new Error(`Failed to list directory ${dirPath}: ${err.message}`));
        return;
      }
      resolve(list.map((item) => ({
        name: item.filename,
        path: path.posix.join(dirPath, item.filename),
        type: getFileType(item.attrs),
        size: item.attrs.size,
        permissions: permissionsToString(item.attrs.mode & 0o777),
        owner: item.attrs.uid,
        group: item.attrs.gid,
        modified: new Date((item.attrs.mtime || 0) * 1000).toISOString(),
        accessed: new Date((item.attrs.atime || 0) * 1000).toISOString(),
        isHidden: item.filename.startsWith("."),
      })));
    });
  });
}

async function copyDirectoryWithSftp(sftp: SFTPWrapper, safeSrc: string, safeDest: string): Promise<void> {
  await mkdirWithSftp(sftp, safeDest);
  const entries = await readdirWithSftp(sftp, safeSrc);

  for (const entry of entries) {
    const newDest = path.posix.join(safeDest, entry.name);
    if (entry.type === "directory") {
      await copyDirectoryWithSftp(sftp, entry.path, newDest);
    } else if (entry.type === "symlink") {
      // Skip symlinks during copy to avoid following into unrelated directories
      continue;
    } else {
      await copyFileWithSftp(sftp, entry.path, newDest);
    }
  }
}

export async function copyFile(connectionId: string, client: Client, srcPath: string, destPath: string): Promise<void> {
  const safeSrc = sanitizePath(srcPath);
  const safeDest = sanitizePath(destPath);
  const sftp = await acquireSftp(connectionId, client);

  try {
    await copyFileWithSftp(sftp, safeSrc, safeDest);
  } finally {
    releaseSftp(connectionId);
  }
}

export async function copyDirectory(connectionId: string, client: Client, srcPath: string, destPath: string): Promise<void> {
  const safeSrc = sanitizePath(srcPath);
  const safeDest = sanitizePath(destPath);
  const sftp = await acquireSftp(connectionId, client);

  try {
    await copyDirectoryWithSftp(sftp, safeSrc, safeDest);
  } finally {
    releaseSftp(connectionId);
  }
}

export async function uploadFile(
  connectionId: string,
  client: Client,
  remotePath: string,
  data: Buffer | ReadableStream<Uint8Array>,
  totalBytes: number,
  onProgress?: (bytesWritten: number, totalBytes: number) => void
): Promise<void> {
  const safePath = sanitizePath(remotePath);
  const sftp = await acquireSftp(connectionId, client);

  try {
    return await new Promise((resolve, reject) => {
      const stream = sftp.createWriteStream(safePath);
      let bytesWritten = 0;

      stream.on("close", () => {
        resolve();
      });
      stream.on("error", (err: Error) => {
        reject(new Error(`Failed to upload to ${safePath}: ${err.message}`));
      });

      if (Buffer.isBuffer(data)) {
        // Buffer mode: write in chunks for progress reporting
        const CHUNK_SIZE = 64 * 1024;
        let offset = 0;

        function writeChunk() {
          while (offset < (data as Buffer).length) {
            const end = Math.min(offset + CHUNK_SIZE, (data as Buffer).length);
            const chunk = (data as Buffer).subarray(offset, end);
            offset = end;
            bytesWritten = offset;
            onProgress?.(bytesWritten, totalBytes);

            if (!stream.write(chunk)) {
              stream.once("drain", writeChunk);
              return;
            }
          }
          stream.end();
        }

        writeChunk();
      } else {
        // Stream mode: pipe ReadableStream chunks directly
        const reader = data.getReader();

        async function pump() {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                stream.end();
                return;
              }
              bytesWritten += value.byteLength;
              onProgress?.(bytesWritten, totalBytes);
              if (!stream.write(Buffer.from(value))) {
                await new Promise<void>((r) => stream.once("drain", r));
              }
            }
          } catch (err) {
            stream.destroy();
            reject(err);
          }
        }

        pump();
      }
    });
  } finally {
    releaseSftp(connectionId);
  }
}

export async function createDownloadStream(connectionId: string, client: Client, filePath: string): Promise<{ stream: NodeJS.ReadableStream; connectionId: string }> {
  const safePath = sanitizePath(filePath);
  const sftp = await acquireSftp(connectionId, client);

  const stream = sftp.createReadStream(safePath);
  stream.on("error", (streamErr: Error) => {
    releaseSftp(connectionId);
    throw new Error(`Failed to download ${safePath}: ${streamErr.message}`);
  });
  stream.on("end", () => {
    releaseSftp(connectionId);
  });

  return { stream, connectionId };
}

export async function searchFiles(
  connectionId: string,
  client: Client,
  basePath: string,
  query: string,
  type: "name" | "content" = "name"
): Promise<string[]> {
  const safePath = sanitizePath(basePath);
  const safeQuery = query.replace(/[^a-zA-Z0-9_./-]/g, "\\$&");

  return new Promise((resolve, reject) => {
    const command =
      type === "name"
        ? `find "${safePath}" -maxdepth 5 -name "*${safeQuery}*" -type f 2>/dev/null | head -100`
        : `grep -rl --include="*" -m 1 "${safeQuery}" "${safePath}" 2>/dev/null | head -100`;

    client.exec(command, (err, stream) => {
      if (err) {
        reject(new Error(`Search failed: ${err.message}`));
        return;
      }

      let output = "";
      stream.on("data", (data: Buffer) => {
        output += data.toString();
      });

      stream.on("close", () => {
        const results = output
          .trim()
          .split("\n")
          .filter((line) => line.length > 0);
        resolve(results);
      });

      stream.stderr.on("data", () => {
        // Ignore stderr (permission errors, etc.)
      });
    });
  });
}
