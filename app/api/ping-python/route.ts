import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

const PYTHON_BIN = path.join(process.cwd(), "scripts", "venv", "bin", "python3");
const SCRIPT_PATH = path.join(process.cwd(), "scripts", "hello.py");

export async function GET() {
  const { stdout } = await execFileAsync(PYTHON_BIN, [SCRIPT_PATH]);
  return NextResponse.json(JSON.parse(stdout));
}
