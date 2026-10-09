import type { GroundingContext } from '@pusang-gala/ai';

/** Native sampling can select canonical facts, but cannot author new route claims. */
export function explanationGrammar(context: GroundingContext): string {
  if (!context.statements.length) throw new Error('No canonical statements to explain.');
  const terminal = (text: string) => JSON.stringify(text);
  const repeat = (rule: string, count: number) => Array.from({ length: count }, () => `(${rule})?`).join(' ');
  return [
    `root ::= unit ${repeat(`${terminal('\n')} unit`, context.budgets.maxUnits - 1)} ${terminal('\n')}?`,
    `unit ::= ${terminal('{"kind":"summary","inserts":[')} refs ${terminal('],"text":"Here are the reported details."}')}`,
    `refs ::= ref ${repeat(`${terminal(',')} ref`, context.budgets.maxInsertsPerUnit - 1)}`,
    `ref ::= ${context.statements.map(statement => terminal(JSON.stringify(statement.id))).join(' | ')}`,
  ].join('\n');
}
