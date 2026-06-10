export type VariableDataType = 'int' | 'double' | 'string' | 'array';

/** Data type for monitor registration (attributes type=). */
export type VariableType = VariableDataType | 'unknown';

const VARIABLE_DATA_TYPES: ReadonlySet<VariableDataType> = new Set([
  'int',
  'double',
  'string',
  'array',
]);

export function isVariableDataType(type: VariableType): type is VariableDataType {
  return VARIABLE_DATA_TYPES.has(type as VariableDataType);
}

export interface WatchIoEntry {
  name: string;
  value?: string;
  params?: Record<string, string> | Array<{ name: string; value: string }>;
}

export interface WatchIoMessage {
  type: string;
  name?: string;
  value?: string;
  names?: string[];
  entries?: WatchIoEntry[] | Record<string, string>;
  params?: Record<string, string> | Array<{ name: string; value: string }>;
  values?: string[] | string;
}

export interface WatchIoVariable {
  name: string;
  value: string;
  /** WatchIO vartype — Param, local, Input, Output, ... */
  varKind: string;
  /** Data type from attributes type= — int, double, ... */
  dataType: VariableType;
  description: string;
  scale: string;
  registered: boolean;
  alias?: string;
}

export type TreeNodeKind = 'branch' | 'variable';

export interface TreeNode {
  key: string;
  title: string;
  fullPath: string;
  isLeaf: boolean;
  nodeKind?: TreeNodeKind;
  /** Branch nodes: true after varleaves was fetched (may have zero variables). */
  variablesLoaded?: boolean;
  children?: TreeNode[];
}

export interface PlotSeries {
  name: string;
  color: string;
  min: number;
  max: number;
  data: { t: number; v: number }[];
}

export interface RecordingFrame {
  t: number;
  values: Record<string, string>;
}

export interface RecordingFile {
  version: 1;
  watchIoName: string;
  variables: string[];
  frames: RecordingFrame[];
}

export type ConnectionTransport = 'smcServer' | 'watchIoHttp' | 'watchIoWs';

export interface SessionFile {
  version: 1;
  watchIoName: string;
  transport?: ConnectionTransport;
  httpUrl?: string;
  wsUrl?: string;
  serverPath?: string;
  sampleInterval: number;
  registeredVariables: string[];
  plotVariables: string[];
  plotColors: Record<string, string>;
  plotLineWidths?: Record<string, number>;
  plotMin: number;
  plotMax: number;
  plotXWindowSec?: number;
  flatTree: boolean;
  viewMode: ViewMode;
}

export type ViewMode = 'splitter' | 'list' | 'plot';
export type AppMode = 'live' | 'offline' | 'replay';

/** One row from GET /request — same as SmcServerView applicationList entries. */
export interface DiscoveredService {
  name: string;
  uri: string;
  category: string;
  description: string;
}

export interface ConnectionConfig {
  /** SmcServer API or WatchIoWebServer HTTP/WS */
  transport: ConnectionTransport;
  /** Empty = Vite proxy / same-origin; SmcServerView uses http://host:8082 */
  httpUrl: string;
  /** WebSocket URL for watchIoWs (default ws://host:8083) */
  wsUrl: string;
  /** Display host like SmcServerView serverList: localhost:8082 */
  hostAddress: string;
  /** WatchIO segment name (e.g. SmcControl1, CasServer) */
  watchIoName: string;
  /** Service base path from /request: /SmcServer1 or /watchio */
  serverPath: string;
  sampleInterval: number;
}
