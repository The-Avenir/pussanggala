import type { GroundingContext } from '@pusang-gala/ai';

/** Constrain the wire format and citations; prose is checked by the stream guard. */
export function explanationGrammar(context: GroundingContext): string {
  const terminal = (text: string) => JSON.stringify(text);
  const steps = context.statements.filter(statement => statement.role === 'step').sort((a, b) => a.stepOrder! - b.stepOrder!);
  const requiredSteps = context.budgets.connectiveTextOnly && steps.length > 0 && steps.length <= context.budgets.maxInsertsPerUnit
    ? steps.map(statement => statement.id) : [];
  const refs = context.statements.filter(statement => !requiredSteps.includes(statement.id));
  return [
    `root ::= ${requiredSteps.length ? 'route-unit' : 'unit'} (${terminal('\n')} unit){0,${context.budgets.maxUnits - 1}} ${terminal('\n')}?`,
    ...(requiredSteps.length ? [`route-unit ::= ${terminal('{"kind":"step","inserts":')} ${terminal(JSON.stringify(requiredSteps))} ${terminal(',"text":')} text ${terminal('}')}`] : []),
    refs.length
      ? `unit ::= ${terminal('{"kind":')} kind ${terminal(',"inserts":[')} refs ${terminal('],"text":')} text ${terminal('}')}`
      : `unit ::= ${terminal('{"kind":')} kind ${terminal(',"inserts":[],"text":')} text ${terminal('}')}`,
    `kind ::= ${(context.statements.length ? ['summary', 'step', 'comparison', 'hours', 'caveat', 'clarify', 'redirect'] : ['summary', 'clarify']).map(kind => terminal(JSON.stringify(kind))).join(' | ')}`,
    ...(refs.length ? [
      `refs ::= (ref (${terminal(',')} ref){0,${context.budgets.maxInsertsPerUnit - 1}})?`,
      `ref ::= ${refs.map(statement => terminal(JSON.stringify(statement.id))).join(' | ')}`,
    ] : []),
    `text ::= ${terminal('"')} text-char{1,${context.budgets.maxUnitTextChars}} ${terminal('"')}`,
    String.raw`text-char ::= [^"\\\x00-\x1F] | "\\" (["\\/bfnrt] | "u" [0-9a-fA-F]{4})`,
  ].join('\n');
}
