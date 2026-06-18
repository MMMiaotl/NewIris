/**
 * Root layout: menu, connection bar, resizable tree/table/plot panels, control side panel.
 * Hooks mounted here (not in children): useWatchIo, useReplayPlayback, useWorkspacePersistence.
 */
import { Splitter } from 'antd';
import { ConnectionBar } from '../connection/ConnectionBar';
import { ConnectionBarSection } from '../connection/ConnectionBarSection';
import { WatchIoComHost } from '../connection/WatchIoComHost';
import { MenuBar } from '../toolbar/MenuBar';
import { VariableTree } from '../tree/VariableTree';
import { ParameterTable } from '../table/ParameterTable';
import { PlotPanel } from '../plot/PlotPanel';
import { ControlPanel } from '../control/ControlPanel';
import { ConnectionSettingsModal } from '../settings/ConnectionSettingsModal';
import { WatchIoMessageLogDrawer } from '../debug/WatchIoMessageLogDrawer';
import { ChangeStyleScaleModal } from '../display/ChangeStyleScaleModal';
import { ReplayControls } from '../replay/ReplayControls';
import { RecordingBar } from '../replay/RecordingBar';
import { ConnectionStatusDrawer } from '../status/ConnectionStatusDrawer';
import { ConnectionStatusTrigger } from '../status/ConnectionStatusTrigger';
import {
  DEFAULT_TREE_PANEL_WIDTH,
  MIN_CONTROL_PANEL_WIDTH,
  MIN_TREE_PANEL_WIDTH,
  useConnectionStore,
} from '../../stores/connectionStore';
import { useWatchIo } from '../../hooks/useWatchIo';
import { useReplayPlayback } from '../../hooks/useReplay';
import { useWorkspacePersistence } from '../../hooks/useWorkspacePersistence';
import { useRegistration } from '../../hooks/useRegistration';
import { RegistrationPanel } from '../registration/RegistrationPanel';
import { ExportVariablesModal } from '../registration/ExportVariablesModal';
import { ImportVariablesModal } from '../registration/ImportVariablesModal';
import { ExportStatisticsModal } from '../registration/ExportStatisticsModal';
import { ShowOptionsModal } from '../settings/ShowOptionsModal';
import { PreferencesModal } from '../settings/PreferencesModal';
import {
  readInitialParameterPanelDefaultSize,
  readInitialPlotPanelDefaultSize,
  writePersistedParameterPlotSplitRatio,
} from '../../utils/layoutPersistence';
import { useDisplayStore } from '../../stores/displayStore';
import { useState } from 'react';

const parameterPanelDefaultSize = readInitialParameterPanelDefaultSize();
const plotPanelDefaultSize = readInitialPlotPanelDefaultSize();

export function AppShell() {
  useWorkspacePersistence();
  useRegistration();
  const [registrationPanelOpen, setRegistrationPanelOpen] = useState(false);
  const [exportVarsOpen, setExportVarsOpen] = useState(false);
  const [importVarsOpen, setImportVarsOpen] = useState(false);
  const [exportStatsOpen, setExportStatsOpen] = useState(false);
  const [showOptionsOpen, setShowOptionsOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const {
    viewMode,
    appMode,
    plotDrawerOpen,
    setPlotDrawerOpen,
    controlPanelWidth,
    setControlPanelWidth,
    connectionModalOpen,
    setConnectionModalOpen,
  } = useConnectionStore();
  const { connect, disconnect, applyWatchIoName, setVariableValue, refreshVariable, client } =
    useWatchIo();
  useReplayPlayback();
  const styleModalOpen = useDisplayStore((s) => s.modalOpen);
  const styleModalFocus = useDisplayStore((s) => s.modalFocusVariable);
  const closeStyleModal = useDisplayStore((s) => s.closeModal);

  const showList = viewMode === 'splitter' || viewMode === 'list';
  const showPlot = viewMode === 'splitter' || viewMode === 'plot';

  return (
    <div className="app-shell">
      <WatchIoComHost />
      <header className="app-header">
        <div className="app-header-top">
          <div className="app-header-brand">
            <div className="app-title">Iris Next</div>
            <span className="app-subtitle">WatchIO Monitor</span>
          </div>
          <ConnectionStatusTrigger />
        </div>
        <MenuBar
          onOpenRegistration={() => setRegistrationPanelOpen(true)}
          onOpenExportVariables={() => setExportVarsOpen(true)}
          onOpenImportVariables={() => setImportVarsOpen(true)}
          onOpenExportStatistics={() => setExportStatsOpen(true)}
          onOpenShowOptions={() => setShowOptionsOpen(true)}
          onOpenPreferences={() => setPreferencesOpen(true)}
        />
        <ConnectionBarSection>
          <ConnectionBar
            onConnect={connect}
            onDisconnect={() => disconnect(true)}
            onApplyWatchIoName={applyWatchIoName}
          />
        </ConnectionBarSection>
      </header>

      {appMode === 'replay' && <ReplayControls />}
      <RecordingBar />

      <main className="app-main">
        <Splitter
          className="app-main-splitter"
          onResize={(sizes) => {
            const nextWidth = sizes[1];
            if (typeof nextWidth === 'number' && nextWidth > 0) {
              setControlPanelWidth(nextWidth);
            }
          }}
        >
          <Splitter.Panel min="40%">
            <Splitter className="main-splitter">
              <Splitter.Panel
                className="tree-splitter-panel"
                defaultSize={DEFAULT_TREE_PANEL_WIDTH}
                min={MIN_TREE_PANEL_WIDTH}
                max="40%"
              >
                <VariableTree
                  onExpandBranch={(branch) => {
                    if (!branch) client.current?.fetchVarTree();
                    else client.current?.fetchVarTree(branch);
                  }}
                  onLoadVariables={(branch) => {
                    client.current?.fetchVarLeaves(branch);
                  }}
                />
              </Splitter.Panel>
              <Splitter.Panel>
                <Splitter
                  orientation="vertical"
                  className="right-splitter"
                  onResizeEnd={(sizes) => {
                    const first = sizes[0];
                    const second = sizes[1];
                    if (
                      typeof first === 'number' &&
                      typeof second === 'number' &&
                      first > 0 &&
                      second > 0
                    ) {
                      writePersistedParameterPlotSplitRatio(first / (first + second));
                    }
                  }}
                >
                  {showList && (
                    <Splitter.Panel defaultSize={parameterPanelDefaultSize} min="20%">
                      <ParameterTable onSetValue={setVariableValue} />
                    </Splitter.Panel>
                  )}
                  {showPlot && (
                    <Splitter.Panel defaultSize={plotPanelDefaultSize} min="25%">
                      <PlotPanel />
                    </Splitter.Panel>
                  )}
                </Splitter>
              </Splitter.Panel>
            </Splitter>
          </Splitter.Panel>
          <Splitter.Panel
            size={plotDrawerOpen ? controlPanelWidth : 0}
            min={plotDrawerOpen ? MIN_CONTROL_PANEL_WIDTH : 0}
            max="45%"
            collapsible={{ end: true, showCollapsibleIcon: 'auto' }}
            resizable={plotDrawerOpen}
            destroyOnHidden
          >
            {plotDrawerOpen && (
              <ControlPanel
                onClose={() => setPlotDrawerOpen(false)}
                onSetValue={setVariableValue}
                onRefreshVariable={refreshVariable}
              />
            )}
          </Splitter.Panel>
        </Splitter>
      </main>

      <ConnectionSettingsModal
        open={connectionModalOpen}
        onClose={() => setConnectionModalOpen(false)}
      />
      <ConnectionStatusDrawer />
      <WatchIoMessageLogDrawer />
      <RegistrationPanel
        open={registrationPanelOpen}
        onClose={() => setRegistrationPanelOpen(false)}
      />
      <ExportVariablesModal
        open={exportVarsOpen}
        onClose={() => setExportVarsOpen(false)}
      />
      <ImportVariablesModal
        open={importVarsOpen}
        onClose={() => setImportVarsOpen(false)}
      />
      <ExportStatisticsModal
        open={exportStatsOpen}
        onClose={() => setExportStatsOpen(false)}
      />
      <ShowOptionsModal
        open={showOptionsOpen}
        onClose={() => setShowOptionsOpen(false)}
      />
      <PreferencesModal
        open={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
      />
      <ChangeStyleScaleModal
        open={styleModalOpen}
        onClose={closeStyleModal}
        initialFocusVariable={styleModalFocus}
      />
    </div>
  );
}
