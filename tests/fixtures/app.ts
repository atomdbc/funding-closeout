// Explicit legacy fictional seed for regression tests only. Production start.ts never imports this.
import { createApp as productionApp } from "../../server/app.ts";
import { exampleProgram } from "../../src/domain/demo.ts";
export function createApp(options: Parameters<typeof productionApp>[0] = {}) {
  return productionApp({ initialProgram: exampleProgram(), ...options });
}
