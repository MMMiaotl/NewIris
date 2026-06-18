import { useState, useRef, type ReactNode, type RefObject } from 'react';
import { Button, Checkbox, Dropdown, Input, Segmented, Space, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import {
  AppstoreOutlined,
  FolderOpenOutlined,
  LineChartOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  SettingOutlined,
  SlidersOutlined,
  StopOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { defaultServerPath } from '../../constants/transport';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSessionStore } from '../../stores/sessionStore';
import { usePlotStore } from '../../stores/plotStore';
import { useVariableStore } from '../../stores/variableStore';
import { useDisplayStore } from '../../stores/displayStore';
import { useUiPreferencesStore } from '../../stores/uiPreferencesStore';
import {
  createRecording,
  downloadJson,
  parseRecording,
  parseSession,
  serializeRecording,
  serializeSession,
} from '../../utils/recordingFormat';
import type { SessionFile, ViewMode } from '../../api/types';
import { AboutModal } from '../settings/AboutModal';
import { SearchFilterToggles } from './SearchFilterToggles';
import { toggleControlDrawer } from '../../utils/controlDrawer';

interface MenuBarProps {
  searchInputRef?: RefObject<InputRef | null>;
  onOpenRegistration?: () => void;
  onOpenExportVariables?: () => void;
  onOpenImportVariables?: () => void;
  onOpenExportStatistics?: () => void;
  onOpenShowOptions?: () => void;
  onOpenPreferences?: () => void;
}

export function MenuBar({
  searchInputRef,
  onOpenRegistration,
  onOpenExportVariables,
  onOpenImportVariables,
  onOpenExportStatistics,
  onOpenShowOptions,
  onOpenPreferences,
}: MenuBarProps) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const localSearchRef = useRef<InputRef>(null);
  const resolvedSearchRef = searchInputRef ?? localSearchRef;
  const {
    config,
    appMode,
    viewMode,
    flatTree,
    searchQuery,
    plotDrawerOpen,
    setAppMode,
    setViewMode,
    setFlatTree,
    setSearchQuery,
    setConnectionModalOpen,
  } = useConnectionStore();
  const { recording, startRecording, stopRecording, loadReplay, clearReplay } =
    useSessionStore();
  const { plotVariables, colors, lineWidths, yMin, yMax, xWindowSec } = usePlotStore();
  const { registeredNames, clear: clearVars } = useVariableStore();
  const displayOverrides = useDisplayStore((s) => s.overrides);
  const openStyleModal = useDisplayStore((s) => s.openModal);
  const clearDisplay = useDisplayStore((s) => s.clearAll);
  const searchMatchCase = useUiPreferencesStore((s) => s.searchMatchCase);
  const searchMatchWholeWord = useUiPreferencesStore((s) => s.searchMatchWholeWord);
  const setSearchMatchCase = useUiPreferencesStore((s) => s.setSearchMatchCase);
  const setSearchMatchWholeWord = useUiPreferencesStore((s) => s.setSearchMatchWholeWord);

  const openSession = () =>
    openFilePicker('.json', (text) => {
      const session = parseSession(text);
      applySession(session);
    });

  const openRecording = () =>
    openFilePicker('.niris,.json', (text) => {
      loadReplay(parseRecording(text));
      setAppMode('replay');
    });

  // nirislog import is now handled by ImportVariablesModal (opened via onOpenImportVariables)

  const fileMenu: MenuProps['items'] = [
    {
      key: 'new',
      label: 'New',
      onClick: () => {
        clearVars();
        usePlotStore.getState().clearSeries();
        clearDisplay();
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
      key: 'open-nirislog',
      label: 'Import Variables…',
      onClick: () => onOpenImportVariables?.(),
    },
    { type: 'divider' },
    {
      key: 'registration',
      label: 'Registration…',
      onClick: () => onOpenRegistration?.(),
    },
    {
      key: 'save',
      label: 'Save Session',
      onClick: () => saveSession(),
    },
    {
      key: 'save-as',
      label: 'Save Session As…',
      onClick: () => saveSession(),
    },
    { type: 'divider' },
    {
      key: 'export-variables',
      label: 'Export Variables…',
      onClick: () => onOpenExportVariables?.(),
    },
    {
      key: 'export-statistics',
      label: 'Export Statistics…',
      onClick: () => onOpenExportStatistics?.(),
    },
    { type: 'divider' },
    {
      key: 'offline',
      label: appMode === 'offline' ? 'Go Online' : 'Offline',
      onClick: () => setAppMode(appMode === 'offline' ? 'live' : 'offline'),
    },
  ];

  const settingsMenu: MenuProps['items'] = [
    {
      key: 'connection',
      label: 'Connection',
      onClick: () => setConnectionModalOpen(true),
    },
    {
      key: 'format-setting',
      label: 'Format',
      onClick: () => openStyleModal(useVariableStore.getState().focusedVariable),
    },
    { type: 'divider' },
    {
      key: 'show-options',
      label: 'Show Options…',
      onClick: () => onOpenShowOptions?.(),
    },
    {
      key: 'preferences',
      label: 'Preferences…',
      onClick: () => onOpenPreferences?.(),
    },
  ];

  const applySession = (session: SessionFile) => {
    useConnectionStore.getState().setConfig({
      transport: session.transport ?? 'smcServer',
      watchIoName: session.watchIoName,
      httpUrl: session.httpUrl ?? '',
      wsUrl: session.wsUrl ?? '',
      serverPath: session.serverPath ?? defaultServerPath(session.transport ?? 'smcServer'),
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
    if (session.displayOverrides) {
      useDisplayStore.getState().loadOverrides(session.displayOverrides);
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
    displayOverrides: { ...displayOverrides },
  });

  const saveSession = () => {
    const content = serializeSession(buildSession());
    const name = `${config.watchIoName}.session.json`;
    downloadJson(name, content);
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

  const viewOptions: { value: ViewMode; label: ReactNode }[] = [
    {
      value: 'splitter',
      label: (
        <Tooltip title="Splitter view">
          <AppstoreOutlined />
        </Tooltip>
      ),
    },
    {
      value: 'list',
      label: (
        <Tooltip title="List view">
          <UnorderedListOutlined />
        </Tooltip>
      ),
    },
    {
      value: 'plot',
      label: (
        <Tooltip title="Plot view">
          <LineChartOutlined />
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="menu-bar">
      <Space wrap size="small" className="menu-bar-actions">
        <Dropdown menu={{ items: fileMenu }} trigger={['click']}>
          <Button type="text">File</Button>
        </Dropdown>
        <Dropdown menu={{ items: settingsMenu }} trigger={['click']}>
          <Button type="text" icon={<SettingOutlined />}>
            Settings
          </Button>
        </Dropdown>
        <Segmented
          className="view-mode-segmented"
          size="small"
          value={viewMode}
          onChange={(value) => setViewMode(value as ViewMode)}
          options={viewOptions}
        />
        <Tooltip title="Open session">
          <Button type="text" icon={<FolderOpenOutlined />} onClick={openSession} aria-label="Open session" />
        </Tooltip>
        <Tooltip title="Save session">
          <Button type="text" icon={<SaveOutlined />} onClick={() => saveSession()} aria-label="Save session" />
        </Tooltip>
        <Tooltip title={recording ? 'Stop recording' : 'Start recording'}>
          <Button
            type={recording ? 'primary' : 'text'}
            danger={recording}
            icon={recording ? <StopOutlined /> : <PlayCircleOutlined />}
            onClick={toggleRecord}
            aria-label={recording ? 'Stop recording' : 'Start recording'}
          />
        </Tooltip>
        <Tooltip title="Control panel (Ctrl+Shift+C)">
          <Button
            type={plotDrawerOpen ? 'primary' : 'text'}
            icon={<SlidersOutlined />}
            onClick={toggleControlDrawer}
            aria-label="Control panel"
          >
            Control
          </Button>
        </Tooltip>
        <Tooltip title="Search variables (Ctrl+F)">
          <Input
            ref={resolvedSearchRef}
            className="menu-bar-search"
            placeholder="Search variables…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            size="small"
          />
        </Tooltip>
        <SearchFilterToggles
          matchCase={searchMatchCase}
          matchWholeWord={searchMatchWholeWord}
          onMatchCaseChange={setSearchMatchCase}
          onMatchWholeWordChange={setSearchMatchWholeWord}
        />
        <Checkbox checked={flatTree} onChange={(e) => setFlatTree(e.target.checked)}>
          Flat Tree
        </Checkbox>
        <Button type="text" onClick={() => setAboutOpen(true)}>
          About
        </Button>
      </Space>
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
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
