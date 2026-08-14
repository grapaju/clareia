import { spawn } from "node:child_process";
import { ensurePocketBaseEnv, resolvePocketBaseBinary } from "./pocketbase-bin.mjs";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("[pocketbase] Informe os argumentos do comando.");
  process.exit(1);
}

ensurePocketBaseEnv(args);

const binaryPath = resolvePocketBaseBinary();
const child = spawn(binaryPath, args, {
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`[pocketbase] Falha ao iniciar: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
