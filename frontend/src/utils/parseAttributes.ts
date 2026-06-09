/**
 * Entry attributes — WatchIO uses params.attributes="type=int ...";
 * SmcServerView InitVarList uses params.vartype / description / override directly.
 */

export function parseAttributes(attrStr: string | undefined): Record<string, string> {
  if (!attrStr) return {};
  const result: Record<string, string> = {};
  const regex = /(\w+)=("([^"]*)"|[^\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(attrStr)) !== null) {
    result[match[1]] = match[3] ?? match[2];
  }
  return result;
}

function paramList(
  params?: Record<string, string> | Array<{ name: string; value: string }>,
): Array<{ name: string; value: string }> {
  if (!params) return [];
  if (Array.isArray(params)) return params;
  if (typeof params === 'object' && 'name' in params && 'value' in params) {
    return [params as { name: string; value: string }];
  }
  return [];
}

export function getEntryAttributes(entry: {
  params?: Record<string, string> | Array<{ name: string; value: string }>;
}): Record<string, string> {
  const list = paramList(entry.params);
  const result: Record<string, string> = {};

  for (const p of list) {
    if (p.name === 'attributes') {
      Object.assign(result, parseAttributes(p.value));
    }
    // SmcServerView InitVarList direct params
    if (p.name === 'vartype') result.type = p.value;
    if (p.name === 'description') result.description = p.value;
    if (p.name === 'override') result.override = p.value;
    if (p.name === 'iodisable') result.iodisable = p.value;
    if (p.name === 'type') result.type = p.value;
    if (p.name === 'scale') result.scale = p.value;
    if (p.name === 'alias') result.alias = p.value;
  }

  return result;
}
