import type { Client } from "ssh2";

/**
 * Execute a command on a remote server over SSH.
 * Returns collected stdout and stderr as strings.
 */
export async function execCommand(
  client: Client,
  command: string,
  timeoutMs = 10_000
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`SSH command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    client.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        reject(err);
        return;
      }

      let stdout = "";
      let stderr = "";

      stream.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      stream.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      stream.on("close", () => {
        clearTimeout(timer);
        resolve({ stdout, stderr });
      });

      stream.on("error", (streamErr: Error) => {
        clearTimeout(timer);
        reject(streamErr);
      });
    });
  });
}
