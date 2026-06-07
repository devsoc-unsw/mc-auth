import { Rcon } from "rcon-client"

export async function sendRconCommand(command: string): Promise<string> {
  const rcon = new Rcon({
    host: process.env.RCON_HOST!,
    port: parseInt(process.env.RCON_PORT ?? "25575", 10),
    password: process.env.RCON_PASSWORD!,
  })
  await rcon.connect()
  try {
    return await rcon.send(command)
  } finally {
    await rcon.end()
  }
}
