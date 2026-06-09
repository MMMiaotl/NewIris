/**
 * Entry attributes — WatchIO uses params.attributes="type=int ...";
 * SmcServerView InitVarList uses params.vartype / description / override directly.
 */

export function parseAttributes(attrStr: string | undefined): Record<string, string> {
  if (!attrStr) return {};
  const result: Record<string, string> = {};
  // WatchIoWebServer normalizes ';' to spaces before parsing attributes.
  const normalized = attrStr.replace(/;/g, ' ');
  const regex = /(\w+)=("([^"]*)"|[^\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(normalized)) !== null) {
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
  let directDescription = '';

  for (const p of list) {
    const key = p.name.toLowerCase();
    if (key === 'description') {
      directDescription = p.value;
      continue;
    }
    if (key === 'attributes') {
      Object.assign(result, parseAttributes(p.value));
      continue;
    }
    // SmcServerView InitVarList direct params
    if (key === 'vartype') result.type = p.value;
    if (key === 'override') result.override = p.value;
    if (key === 'iodisable') result.iodisable = p.value;
    if (key === 'type') result.type = p.value;
    if (key === 'scale') result.scale = p.value;
    if (key === 'alias') result.alias = p.value;
  }

  if (directDescription) result.description = directDescription;

  return result;
}
