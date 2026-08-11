// Glide MCP stdio server entrypoint
export { createGlideServer, main } from "./server.js";
import { main } from "./server.js";

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err: unknown) => {
    if (err instanceof Error) {
      console.error(err);
    } else {
      console.error(String(err));
    }
    process.exit(1);
  });
}
