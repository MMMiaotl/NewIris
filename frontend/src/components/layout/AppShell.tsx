/**
 * Root layout: menu, connection bar, resizable tree/table/plot panels, control side panel.
 * Hooks mounted here (not in children): useWatchIo, useReplayPlayback, useWorkspacePersistence.
 */
import { Splitter } from 'antd';
import { ConnectionBar } from '../connection/ConnectionBar';
import { MenuBar } from '../toolbar/MenuBar';
import { VariableTree } from '../tree/VariableTree';
import { ParameterTable } from '../table/ParameterTable';
import { PlotPanel } from '../plot/PlotPanel';
import { ControlPanel } from '../control/ControlPanel';
import { SettingsDrawer } from '../settings/SettingsDrawer';
import { WatchIoMessageLogDrawer } from '../debug/WatchIoMessageLogDrawer';
import { ChangeStyleScaleModal } from '../display/ChangeStyleScaleModal';
import { ReplayControls } from '../replay/ReplayControls';
import {
  DEFAULT_TREE_PANEL_WIDTH,
  MIN_CONTROL_PANEL_WIDTH,
  MIN_TREE_PANEL_WIDTH,
  useConnectionStore,
} from '../../stores/connectionStore';
import { useWatchIo } from '../../hooks/useWatchIo';
import { useReplayPlayback } from '../../hooks/useReplay';
import { useWorkspacePersistence } from '../../hooks/useWorkspacePersistence';
import {
  readInitialParameterPanelDefaultSize,
  readInitialPlotPanelDefaultSize,
  writePersistedParameterPlotSplitRatio,
} from '../../utils/layoutPersistence';
import { useDisplayStore } from '../../stores/displayStore';

const parameterPanelDefaultSize = readInitialParameterPanelDefaultSize();
const plotPanelDefaultSize = readInitialPlotPanelDefaultSize();

export function AppShell() {
  useWorkspacePersistence();
  const {
    viewMode,
    appMode,
    config,
    status,
    plotDrawerOpen,
    setPlotDrawerOpen,
    controlPanelWidth,
    setControlPanelWidth,
  } = useConnectionStore();
  const { connect, disconnect, applyWatchIoName, setVariableValue, refreshVariable, client } =
    useWatchIo();
  useReplayPlayback();
  const styleModalOpen = useDisplayStore((s) => s.modalOpen);
  const styleModalFocus = useDisplayStore((s) => s.modalFocusVariable);
  const closeStyleModal = useDisplayStore((s) => s.closeModal);

  const showList = viewMode === 'splitter' || viewMode === 'list';
  const showPlot = viewMode === 'splitter' || viewMode === 'plot';

  const statusClass =
    status === 'connected'
      ? 'footer-status--connected'
      : status === 'error'
        ? 'footer-status--error'
        : status === 'connecting'
          ? 'footer-status--connecting'
          : 'footer-status--disconnected';

  const modeLabel =
    appMode === 'offline' ? 'Off Line' : appMode === 'replay' ? 'Replay' : status;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-top">
          <div className="app-title">NewIris</div>
          <span className="app-subtitle">WatchIO Monitor</span>
        </div>
        <MenuBar />
        <ConnectionBar
          onConnect={connect}
          onDisconnect={() => disconnect(true)}
          onApplyWatchIoName={applyWatchIoName}
        />
      </header>

      {appMode === 'replay' && <ReplayControls />}

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

      <footer className="app-footer">
        <span className="footer-item">{config.transport}</span>
        <span className="footer-sep">·</span>
        <span className="footer-item">
          {config.hostAddress}
          {config.serverPath}
        </span>
        <span className="footer-sep">·</span>
        <span className="footer-item">{config.watchIoName}</span>
        <span className={`footer-status ${statusClass}`}>{modeLabel}</span>
      </footer>

      <SettingsDrawer onApplyWatchIoName={applyWatchIoName} />
      <WatchIoMessageLogDrawer />
      <ChangeStyleScaleModal
        open={styleModalOpen}
        onClose={closeStyleModal}
        initialFocusVariable={styleModalFocus}
      />
    </div>
  );
}
