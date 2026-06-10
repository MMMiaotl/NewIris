/**
 * Entry attributes — WatchIO uses params.attributes="type=int vartype=Param ...";
 * SmcServerView InitVarList uses params.vartype / description / override directly.
 */

export interface EntryAttributes {
  /** Data type from attributes type= or param type (int, double, ...). */
  dataType?: string;
  /** WatchIO variable kind from vartype (Param, local, Input, Output, ...). */
  varKind?: string;
  description?: string;
  scale?: string;
  alias?: string;
  override?: string;
  iodisable?: string;
}

const DATA_TYPE_TOKENS = new Set([
  'int',
  'double',
  'string',
  'array',
  'bool',
  'float',
  'real',
  'dint',
  'sint',
]);

/** Route type/vartype tokens to dataType vs WatchIO varKind by value shape. */
export function classifyTypeToken(raw?: string): Pick<EntryAttributes, 'dataType' | 'varKind'> {
  if (!raw?.trim()) return {};
  const value = raw.trim();
  const lower = value.toLowerCase();
  if (DATA_TYPE_TOKENS.has(lower)) {
    if (lower === 'float' || lower === 'real') return { dataType: 'double' };
    if (lower === 'bool' || lower === 'dint' || lower === 'sint') return { dataType: 'int' };
    if (lower === 'array' || lower === 'string' || lower === 'int' || lower === 'double') {
      return { dataType: lower as EntryAttributes['dataType'] };
    }
  }
  return { varKind: value };
}

function mergeTypeFields(
  target: EntryAttributes,
  patch: Pick<EntryAttributes, 'dataType' | 'varKind'>,
): void {
  if (patch.dataType) target.dataType = patch.dataType;
  if (patch.varKind) target.varKind = patch.varKind;
}

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

function parsedToken(parsed: Record<string, string>, ...keys: string[]): string | undefined {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  for (const [key, value] of Object.entries(parsed)) {
    if (wanted.has(key.toLowerCase())) return value;
  }
  return undefined;
}

/** Normalize entry.params — array, single {name,value}, or record map. */
export function normalizeEntryParams(
  params?: Record<string, string> | Array<{ name: string; value: string }>,
): Array<{ name: string; value: string }> {
  if (!params) return [];
  if (Array.isArray(params)) return params;
  if (typeof params === 'object' && 'name' in params && 'value' in params) {
    return [params as { name: string; value: string }];
  }
  if (typeof params === 'object') {
    return Object.entries(params).map(([name, value]) => ({
      name,
      value: typeof value === 'string' ? value : String(value),
    }));
  }
  return [];
}

function applyParsedAttributeTokens(target: EntryAttributes, parsed: Record<string, string>): void {
  const typeToken = parsedToken(parsed, 'type');
  const vartypeToken = parsedToken(parsed, 'vartype', 'varclass', 'class', 'kind');
  if (typeToken) mergeTypeFields(target, classifyTypeToken(typeToken));
  if (vartypeToken) mergeTypeFields(target, classifyTypeToken(vartypeToken));

  const description = parsedToken(parsed, 'description');
  if (description) target.description = description;
  const scale = parsedToken(parsed, 'scale');
  if (scale) target.scale = scale;
  const alias = parsedToken(parsed, 'alias');
  if (alias) target.alias = alias;
  const override = parsedToken(parsed, 'override');
  if (override) target.override = override;
  const iodisable = parsedToken(parsed, 'iodisable');
  if (iodisable) target.iodisable = iodisable;
}

export function getEntryAttributes(entry: {
  params?: Record<string, string> | Array<{ name: string; value: string }>;
}): EntryAttributes {
  const list = normalizeEntryParams(entry.params);
  const result: EntryAttributes = {};
  let directDescription = '';

  for (const p of list) {
    const key = p.name.toLowerCase();
    if (key === 'description') {
      directDescription = p.value;
      continue;
    }
    if (key === 'attributes') {
      applyParsedAttributeTokens(result, parseAttributes(p.value));
      continue;
    }
    if (key === 'vartype' || key === 'type' || key === 'varclass' || key === 'class' || key === 'kind') {
      mergeTypeFields(result, classifyTypeToken(p.value));
      continue;
    }
    if (key === 'override') result.override = p.value;
    if (key === 'iodisable') result.iodisable = p.value;
    if (key === 'scale') result.scale = p.value;
    if (key === 'alias') result.alias = p.value;
  }

  if (directDescription) result.description = directDescription;

  return result;
}
