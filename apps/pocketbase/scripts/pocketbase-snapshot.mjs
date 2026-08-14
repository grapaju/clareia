import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { ensurePocketBaseEnv, resolvePocketBaseBinary } from "./pocketbase-bin.mjs";

mkdirSync("./pb_snapshots", { recursive: true });

const args = [
  "migrate",
  "collections",
  "--encryptionEnv=PB_ENCRYPTION_KEY",
  "--dir=./pb_data",
  "--migrationsDir=./pb_snapshots",
];

ensurePocketBaseEnv(args);

const child = spawn(resolvePocketBaseBinary(), args, {
  stdio: ["pipe", "inherit", "inherit"],
});

child.stdin.write("y\n");
child.stdin.end();

child.on("error", (error) => {
  console.error(`[pocketbase] Falha ao gerar snapshot: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
