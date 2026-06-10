import { Button, Checkbox, Dropdown, Input, Space, Tooltip } from 'antd';
import {
  FolderOpenOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  SettingOutlined,
  SlidersOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSessionStore } from '../../stores/sessionStore';
import { usePlotStore } from '../../stores/plotStore';
import { useVariableStore } from '../../stores/variableStore';
import {
  createRecording,
  downloadJson,
  parseRecording,
  parseSession,
  serializeRecording,
  serializeSession,
} from '../../utils/recordingFormat';
import type { SessionFile } from '../../api/types';

export function MenuBar() {
  const {
    config,
    status,
    statusDetail,
    appMode,
    viewMode,
    flatTree,
    searchQuery,
    setAppMode,
    setViewMode,
    setFlatTree,
    setSearchQuery,
    setSettingsDrawerOpen,
  } = useConnectionStore();
  const { recording, startRecording, stopRecording, loadReplay, clearReplay, addRecentSession } =
    useSessionStore();
  const { plotVariables, colors, lineWidths, yMin, yMax, xWindowSec } = usePlotStore();
  const { registeredNames, clear: clearVars } = useVariableStore();

  const openSession = () =>
    openFilePicker('.json', (text, name) => {
      const session = parseSession(text);
      applySession(session);
      addRecentSession(name);
    });

  const openRecording = () =>
    openFilePicker('.niris,.json', (text) => {
      loadReplay(parseRecording(text));
      setAppMode('replay');
    });

  const fileMenu: MenuProps['items'] = [
    {
      key: 'new',
      label: 'New',
      onClick: () => {
        clearVars();
        usePlotStore.getState().clearSeries();
        clearReplay();
        setAppMode('live');
      },
    },
    {
      key: 'open-session',
      label: 'Open Session…',
      onClick: openSession,
    },
    {
      key: 'open-recording',
      label: 'Open Recording…',
      onClick: openRecording,
    },
    {
      key: 'save',
      label: 'Save Session',
      onClick: () => saveSession(false),
    },
    {
      key: 'save-as',
      label: 'Save Session As…',
      onClick: () => saveSession(true),
    },
    { type: 'divider' },
    {
      key: 'offline',
      label: appMode === 'offline' ? 'Go Online' : 'Off Line',
      onClick: () => setAppMode(appMode === 'offline' ? 'live' : 'offline'),
    },
  ];

  const viewLabel = (mode: typeof viewMode, text: string) =>
    viewMode === mode ? `✓ ${text}` : text;

  const viewMenu: MenuProps['items'] = [
    {
      key: 'list',
      label: viewLabel('list', 'List View'),
      onClick: () => setViewMode('list'),
    },
    {
      key: 'plot',
      label: viewLabel('plot', 'Plot View'),
      onClick: () => setViewMode('plot'),
    },
    {
      key: 'splitter',
      label: viewLabel('splitter', 'Splitter View'),
      onClick: () => setViewMode('splitter'),
    },
    { type: 'divider' },
    {
      key: 'control',
      label: 'Control Window',
      onClick: openControlDrawer,
    },
  ];

  const showMenu: MenuProps['items'] = [
    { key: 'name', label: 'Name Variables' },
    { key: 'alias', label: 'Alias Variables', disabled: true },
  ];

  const applySession = (session: SessionFile) => {
    useConnectionStore.getState().setConfig({
      transport: session.transport ?? 'smcServer',
      watchIoName: session.watchIoName,
      httpUrl: session.httpUrl ?? '',
      wsUrl: session.wsUrl ?? '',
      serverPath: session.serverPath ?? '/SmcServer1',
      sampleInterval: session.sampleInterval,
    });
    setFlatTree(session.flatTree);
    setViewMode(session.viewMode);
    usePlotStore.getState().loadPlotConfig(
      session.plotVariables,
      session.plotColors,
      session.plotMin,
      session.plotMax,
      session.plotXWindowSec,
      session.plotLineWidths,
    );
    for (const name of session.registeredVariables) {
      useVariableStore.getState().setRegistered(name, true);
    }
  };

  const buildSession = (): SessionFile => ({
    version: 1,
    transport: config.transport,
    watchIoName: config.watchIoName,
    httpUrl: config.httpUrl,
    wsUrl: config.wsUrl,
    serverPath: config.serverPath,
    sampleInterval: config.sampleInterval,
    registeredVariables: Array.from(registeredNames),
    plotVariables,
    plotColors: colors,
    plotLineWidths: lineWidths,
    plotMin: yMin,
    plotMax: yMax,
    plotXWindowSec: xWindowSec,
    flatTree,
    viewMode,
  });

  const saveSession = (asNew: boolean) => {
    const content = serializeSession(buildSession());
    const name = `${config.watchIoName}.session.json`;
    if (asNew) downloadJson(name, content);
    else downloadJson(name, content);
    addRecentSession(name);
  };

  const toggleRecord = () => {
    if (recording) {
      const frames = stopRecording();
      const rec = createRecording(
        config.watchIoName,
        plotVariables.length ? plotVariables : Array.from(registeredNames),
        frames,
      );
      downloadJson(`${config.watchIoName}-${Date.now()}.niris`, serializeRecording(rec));
    } else {
      startRecording();
    }
  };

  const statusColor =
    status === 'connected' ? '#52c41a' : status === 'error' ? '#ff4d4f' : '#faad14';

  const statusLabel =
    appMode === 'offline' ? 'Off Line' : appMode === 'replay' ? 'Replay' : status;

  return (
    <div className="menu-bar">
      <Space wrap size="small" className="menu-bar-actions">
        <Dropdown menu={{ items: fileMenu }} trigger={['click']}>
          <Button type="text">File</Button>
        </Dropdown>
        <Button type="text" icon={<SettingOutlined />} onClick={() => setSettingsDrawerOpen(true)}>
          Settings
        </Button>
        <Dropdown menu={{ items: showMenu }} trigger={['click']}>
          <Button type="text">Show</Button>
        </Dropdown>
        <Dropdown menu={{ items: viewMenu }} trigger={['click']}>
          <Button type="text">View</Button>
        </Dropdown>
        <Button type="text" icon={<FolderOpenOutlined />} onClick={openSession} />
        <Button type="text" icon={<SaveOutlined />} onClick={() => saveSession(false)} />
        <Tooltip title={recording ? 'Stop recording' : 'Start recording'}>
          <Button
            type={recording ? 'primary' : 'text'}
            danger={recording}
            icon={recording ? <StopOutlined /> : <PlayCircleOutlined />}
            onClick={toggleRecord}
          />
        </Tooltip>
        <Button type="text" icon={<SlidersOutlined />} onClick={openControlDrawer}>
          Control
        </Button>
        <Input
          placeholder="Search variables…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: 180 }}
          allowClear
          size="small"
        />
        <Checkbox checked={flatTree} onChange={(e) => setFlatTree(e.target.checked)}>
          Flat Tree
        </Checkbox>
      </Space>
      <Tooltip title={statusDetail}>
        <span className="status-pill menu-bar-status" style={{ borderColor: statusColor, color: statusColor }}>
          {statusLabel}
        </span>
      </Tooltip>
    </div>
  );
}

function openControlDrawer() {
  const { focusedVariable, selectedVariables, setFocusedVariable } = useVariableStore.getState();
  if (!focusedVariable && selectedVariables.length) {
    setFocusedVariable(selectedVariables[0]);
  }
  useConnectionStore.getState().setPlotDrawerOpen(true);
}

function openFilePicker(accept: string, onLoad: (text: string, name: string) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    onLoad(text, file.name);
  };
  input.click();
}
