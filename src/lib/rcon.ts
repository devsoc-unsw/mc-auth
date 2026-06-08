import { Rcon } from "rcon-client"

// Bound every connect/send so an unreachable or hung server fails fast instead
// of holding the request open indefinitely.
const RCON_TIMEOUT_MS = 5000

function createRcon() {
  return new Rcon({
    host: process.env.RCON_HOST!,
    port: parseInt(process.env.RCON_PORT ?? "25575", 10),
    password: process.env.RCON_PASSWORD!,
    timeout: RCON_TIMEOUT_MS,
  })
}

// Run one or more commands over a single connection. Reusing the connection
// avoids a fresh TCP + auth handshake per command (e.g. unlink's remove + kick).
export async function withRcon<T>(
  fn: (send: (command: string) => Promise<string>) => Promise<T>,
): Promise<T> {
  const rcon = createRcon()
  await rcon.connect()
  try {
    return await fn((command) => rcon.send(command))
  } finally {
    await rcon.end()
  }
}

export async function sendRconCommand(command: string): Promise<string> {
  return withRcon((send) => send(command))
}
