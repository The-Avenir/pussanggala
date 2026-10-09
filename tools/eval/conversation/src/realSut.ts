/**
 * Optional bridge to the real conversation and local-AI packages.
 *
 * The conversation package owns the integration factory so this harness does
 * not duplicate product wiring. Until both packages exist, callers can treat
 * RealSutUnavailableError as a clean skip.
 */

import type { DemoPack } from "./pack.ts";
import type { SystemUnderTest } from "./sut.ts";

export type ModuleImporter = (specifier: string) => Promise<unknown>;

interface ConversationModule {
  createConversationEvalSut(options: {
    pack: DemoPack;
    aiModule: unknown;
  }): SystemUnderTest | Promise<SystemUnderTest>;
}

export class RealSutUnavailableError extends Error {
  override readonly name = "RealSutUnavailableError";
}

function isConversationModule(value: unknown): value is ConversationModule {
  return (
    typeof value === "object" &&
    value !== null &&
    "createConversationEvalSut" in value &&
    typeof value.createConversationEvalSut === "function"
  );
}

function isSystemUnderTest(value: unknown): value is SystemUnderTest {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<SystemUnderTest>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.parse === "function" &&
    typeof candidate.respond === "function" &&
    typeof candidate.guardStream === "function"
  );
}

async function importRequired(
  name: string,
  importer: ModuleImporter,
): Promise<unknown> {
  try {
    return await importer(name);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new RealSutUnavailableError(
      `Cannot load ${name}; real conversation evaluation is skipped (${detail}).`,
    );
  }
}

export async function loadRealSut(
  pack: DemoPack,
  importer: ModuleImporter = (specifier) => import(specifier),
): Promise<SystemUnderTest> {
  const conversationModule = await importRequired(
    "@pusang-gala/conversation",
    importer,
  );
  const aiModule = await importRequired("@pusang-gala/ai", importer);

  if (!isConversationModule(conversationModule)) {
    throw new RealSutUnavailableError(
      "@pusang-gala/conversation does not export createConversationEvalSut; real conversation evaluation is skipped.",
    );
  }

  const sut = await conversationModule.createConversationEvalSut({
    pack,
    aiModule,
  });
  if (!isSystemUnderTest(sut)) {
    throw new RealSutUnavailableError(
      "createConversationEvalSut did not return a SystemUnderTest; real conversation evaluation is skipped.",
    );
  }
  return sut;
}
