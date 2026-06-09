/**
 * JSON body shape for WatchIoWebServer STOMP/HTTP POST bodies.
 * See reference/HttpWeb/WatchIoWebServer/Instance.cpp help examples.
 */

export function watchIoAttributesParam(attributes: string): { name: string; value: string } {
  return { name: 'attributes', value: attributes };
}

export function watchIoEntry(
  name: string,
  attributes?: string,
  value?: string,
): Record<string, unknown> {
  const entry: Record<string, unknown> = { name };
  if (attributes) entry.params = watchIoAttributesParam(attributes);
  if (value !== undefined) entry.value = value;
  return entry;
}

/** Space-separated — WatchIoWebServer SimpleScanString splits on spaces, not `;`. */
export const WATCHIO_VARLEAVES_ATTRS =
  'addtype=1 adddescription=1 addvalue=1 fullname=1';

export const WATCHIO_VARTREE_BRANCH_ATTRS = 'branch=1';
