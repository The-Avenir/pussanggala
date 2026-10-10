import { buildGroundingContext, DEFAULT_BUDGETS, isSafeExplanationUnit } from '@pusang-gala/ai';
import type { GroundingContext, SafeExplanationUnit } from '@pusang-gala/ai';

/** The UI currently owns synthetic walkthrough answers, never installed route evidence. */
export function previewAnswerContext(answer: string): GroundingContext {
  const statements = answer.split(/(?<=[.!?])\s+/).filter(Boolean).map((text, index) => ({
    id: `preview-answer-${index}`, role: 'note' as const, text,
    packRecordIds: ['SYNTHETIC-walkthrough'],
  }));
  statements.unshift({ id: 'preview-warning', role: 'note',
    text: 'This is a design walkthrough with synthetic examples, not installed route data or travel guidance.',
    packRecordIds: ['SYNTHETIC-walkthrough'] });
  const result = buildGroundingContext({
    cards: [{ cardId: 'preview-answer', title: 'Example answer', packRecordIds: ['SYNTHETIC-walkthrough'] }],
    statements,
  }, { ...DEFAULT_BUDGETS, maxUnits: 3 });
  if (!result.ok) throw new Error(result.reason);
  return result.context;
}

export function renderSafeExplanation(unit: SafeExplanationUnit, context: GroundingContext): string {
  if (!isSafeExplanationUnit(unit)) throw new Error('Only validated explanations can be displayed.');
  return [unit.text, ...(unit.inserts ?? []).map(id => context.statements.find(statement => statement.id === id)?.text ?? '')]
    .filter(Boolean).join(' ');
}

/** Show validated connective prose together with the unchanged, cited route facts. */
export function renderGroundedRouteUnit(unit: SafeExplanationUnit, context: GroundingContext): string {
  if (!isSafeExplanationUnit(unit)) throw new Error('Only validated explanations can be displayed.');
  return renderSafeExplanation(unit, context);
}
