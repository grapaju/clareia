import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

function isElfBinary(filePath) {
  try {
    const header = readFileSync(filePath, { encoding: null, flag: "r" }).subarray(0, 4);
    return header[0] === 0x7f && header[1] === 0x45 && header[2] === 0x4c && header[3] === 0x46;
  } catch {
    return false;
  }
}

function loadDotEnvFile(envPath) {
  const raw = readFileSync(envPath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function isValidAesKeySize(value) {
  const size = Buffer.byteLength(value ?? "", "utf8");
  return size === 16 || size === 24 || size === 32;
}

function upsertEnvVar(envPath, key, value) {
  const line = `${key}=${value}`;

  if (!existsSync(envPath)) {
    writeFileSync(envPath, `${line}\n`, "utf8");
    return;
  }

  const raw = readFileSync(envPath, "utf8");
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(raw)) {
    const next = raw.replace(pattern, line);
    writeFileSync(envPath, next.endsWith("\n") ? next : `${next}\n`, "utf8");
    return;
  }

  appendFileSync(envPath, `\n${line}\n`, "utf8");
}

export function ensurePocketBaseEnv(commandArgs = []) {
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    loadDotEnvFile(envPath);
  }

  const needsEncryptionKey = commandArgs.includes("--encryptionEnv=PB_ENCRYPTION_KEY");
  if (needsEncryptionKey) {
    if (process.env.PB_ENCRYPTION_KEY) {
      if (isValidAesKeySize(process.env.PB_ENCRYPTION_KEY)) {
        // keep the existing valid key
      } else {
        const regeneratedKey = randomBytes(16).toString("hex");
        upsertEnvVar(envPath, "PB_ENCRYPTION_KEY", regeneratedKey);
        process.env.PB_ENCRYPTION_KEY = regeneratedKey;
        console.warn("[pocketbase] PB_ENCRYPTION_KEY invalida. Uma nova chave local valida foi gerada em apps/pocketbase/.env.");
      }
    } else {
      const generatedKey = randomBytes(16).toString("hex");
      upsertEnvVar(envPath, "PB_ENCRYPTION_KEY", generatedKey);
      process.env.PB_ENCRYPTION_KEY = generatedKey;
      console.warn("[pocketbase] PB_ENCRYPTION_KEY nao encontrada. Uma chave local foi criada em apps/pocketbase/.env.");
    }
  }

  if (!process.env.PB_SUPERUSER_EMAIL) {
    process.env.PB_SUPERUSER_EMAIL = "admin@clareia.local";
    upsertEnvVar(envPath, "PB_SUPERUSER_EMAIL", process.env.PB_SUPERUSER_EMAIL);
    console.warn("[pocketbase] PB_SUPERUSER_EMAIL nao encontrada. Valor local padrao adicionado em apps/pocketbase/.env.");
  }

  if (!process.env.PB_SUPERUSER_PASSWORD) {
    process.env.PB_SUPERUSER_PASSWORD = randomBytes(24).toString("base64url");
    upsertEnvVar(envPath, "PB_SUPERUSER_PASSWORD", process.env.PB_SUPERUSER_PASSWORD);
    console.warn("[pocketbase] PB_SUPERUSER_PASSWORD nao encontrada. Senha local forte gerada em apps/pocketbase/.env.");
  }
}

export function resolvePocketBaseBinary() {
  const cwd = process.cwd();
  const isWin = process.platform === "win32";

  const preferred = resolve(cwd, isWin ? "pocketbase.exe" : "pocketbase");
  const fallback = resolve(cwd, isWin ? "pocketbase" : "pocketbase.exe");

  if (existsSync(preferred)) {
    return preferred;
  }

  if (isWin && existsSync(fallback) && isElfBinary(fallback)) {
    console.error("[pocketbase] Foi encontrado apenas o binario Linux em apps/pocketbase/pocketbase.");
    console.error("[pocketbase] No Windows, baixe o executavel pocketbase.exe da mesma versao e coloque na pasta apps/pocketbase.");
    process.exit(1);
  }

  if (existsSync(fallback)) {
    return fallback;
  }

  console.error("[pocketbase] Binario nao encontrado. Esperado: pocketbase (Linux/macOS) ou pocketbase.exe (Windows) em apps/pocketbase.");
  process.exit(1);
}
