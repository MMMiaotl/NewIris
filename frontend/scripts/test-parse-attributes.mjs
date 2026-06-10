/**
 * Offline smoke test for parseAttributes (run: node scripts/test-parse-attributes.mjs).
 */

import {
  classifyTypeToken,
  getEntryAttributes,
} from '../src/utils/parseAttributes.ts';

const samples = [
  {
    name: 'array params',
    entry: {
      params: [
        { name: 'vartype', value: 'Param' },
        { name: 'description', value: 'test' },
      ],
    },
  },
  {
    name: 'attributes string',
    entry: {
      params: [{ name: 'attributes', value: 'type=double vartype=Param description="d"' }],
    },
  },
  {
    name: 'record params',
    entry: { params: { vartype: 'Input', description: 'd', type: 'double' } },
  },
  {
    name: 'type param is WatchIO kind',
    entry: { params: [{ name: 'type', value: 'Output' }] },
  },
  {
    name: 'vartype holds data type, type holds kind',
    entry: {
      params: [
        { name: 'vartype', value: 'double' },
        { name: 'type', value: 'Param' },
      ],
    },
  },
];

let failed = 0;
for (const s of samples) {
  const attrs = getEntryAttributes(s.entry);
  console.log(s.name, '→', attrs);
  if (s.name === 'array params' && attrs.varKind !== 'Param') failed++;
  if (s.name === 'attributes string' && attrs.varKind !== 'Param') failed++;
  if (s.name === 'record params' && attrs.varKind !== 'Input') failed++;
  if (s.name === 'type param is WatchIO kind' && attrs.varKind !== 'Output') failed++;
  if (s.name === 'vartype holds data type, type holds kind' && attrs.varKind !== 'Param') failed++;
}

console.log('classify double →', classifyTypeToken('double'));
console.log('classify Param →', classifyTypeToken('Param'));
if (failed) {
  console.error(`FAIL: ${failed} sample(s)`);
  process.exit(1);
}
console.log('OK parseAttributes');
