export type SutMode = "stub" | "real";

export function resolveSutMode(
  argv: string[],
  env: Record<string, string | undefined>,
): SutMode {
  const cliValue = argv
    .find((argument) => argument.startsWith("--sut="))
    ?.slice("--sut=".length);
  const value = cliValue ?? env["PUSANG_GALA_EVAL_SUT"] ?? "stub";

  if (value !== "stub" && value !== "real") {
    throw new Error("--sut must be stub or real");
  }
  return value;
}
