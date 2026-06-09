import type { RecordingFile, RecordingFrame, SessionFile } from '../api/types';

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
