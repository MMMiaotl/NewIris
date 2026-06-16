import type { RecordingFile, RecordingFrame, RegistrationLine, SessionFile } from '../api/types';

export function createRecording(
  watchIoName: string,
  variables: string[],
  frames: RecordingFrame[],
): RecordingFile {
  return { version: 1, watchIoName, variables, frames };
}

export function serializeRecording(recording: RecordingFile): string {
  return JSON.stringify(recording, null, 2);
}

export function parseRecording(text: string): RecordingFile {
  const data = JSON.parse(text) as RecordingFile;
  if (data.version !== 1 || !Array.isArray(data.frames)) {
    throw new Error('Invalid .niris recording file');
  }
  return data;
}

export function downloadJson(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function serializeSession(session: SessionFile): string {
  return JSON.stringify(session, null, 2);
}

export function parseSession(text: string): SessionFile {
  const data = JSON.parse(text) as SessionFile;
  if (data.version !== 1) throw new Error('Invalid session file');
  return data;
}

// ── JSON Lines registration format (.nirislog) ────────────────────────────────

export interface NirisLogHeader {
  version: 1;
  watchIoName: string;
  variables: string[];
  startedAt: string; // ISO-8601
  includeTimestamp: boolean;
}

export interface NirisLogFile {
  header: NirisLogHeader;
  lines: RegistrationLine[];
}

/**
 * Serialize registration lines to JSON Lines format.
 * Line 0: header object.
 * Line 1…N: one RegistrationLine per sample.
 */
export function serializeNirisLog(
  watchIoName: string,
  variables: string[],
  lines: RegistrationLine[],
  includeTimestamp: boolean,
  startedAt: number,
): string {
  const header: NirisLogHeader = {
    version: 1,
    watchIoName,
    variables,
    startedAt: new Date(startedAt).toISOString(),
    includeTimestamp,
  };
  const rows = [JSON.stringify(header), ...lines.map((l) => JSON.stringify(l))];
  return rows.join('\n');
}

/**
 * Parse a .nirislog file back into a header + lines structure.
 * Compatible with parseRecording for replay: converts to RecordingFile shape.
 */
export function parseNirisLog(text: string): NirisLogFile {
  const rows = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (rows.length < 1) throw new Error('Empty .nirislog file');
  const header = JSON.parse(rows[0]) as NirisLogHeader;
  if (header.version !== 1) throw new Error('Unsupported .nirislog version');
  const lines = rows.slice(1).map((r) => JSON.parse(r) as RegistrationLine);
  return { header, lines };
}

/** Convert a parsed NirisLogFile to RecordingFile so it can be loaded into replay. */
export function nirisLogToRecording(log: NirisLogFile): RecordingFile {
  return {
    version: 1,
    watchIoName: log.header.watchIoName,
    variables: log.header.variables,
    frames: log.lines.map((l) => ({ t: l.t, values: l.values })),
  };
}
