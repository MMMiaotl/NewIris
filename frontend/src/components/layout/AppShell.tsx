import { Splitter } from 'antd';
import { ConnectionBar } from '../connection/ConnectionBar';
import { MenuBar } from '../toolbar/MenuBar';
import { VariableTree } from '../tree/VariableTree';
import { ParameterTable } from '../table/ParameterTable';
import { PlotPanel } from '../plot/PlotPanel';
import { ControlPanel } from '../control/ControlPanel';
import { SettingsDrawer } from '../settings/SettingsDrawer';
import { WatchIoMessageLogDrawer } from '../debug/WatchIoMessageLogDrawer';
import { ReplayControls } from '../replay/ReplayControls';
import { useConnectionStore } from '../../stores/connectionStore';
import { useWatchIo } from '../../hooks/useWatchIo';
import { useReplay } from '../../hooks/useReplay';

export function AppShell() {
  const { viewMode, appMode, config, status, plotDrawerOpen, setPlotDrawerOpen } =
    useConnectionStore();
  const { connect, disconnect, setVariableValue, refreshVariable, client } = useWatchIo();
  useReplay();

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
        <ConnectionBar onConnect={connect} onDisconnect={disconnect} />
      </header>

      {appMode === 'replay' && <ReplayControls />}

      <main className="app-main">
        <Splitter className="app-main-splitter">
          <Splitter.Panel min="40%">
            <Splitter className="main-splitter">
              <Splitter.Panel defaultSize="15.4%" min="15%" max="40%">
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
                <Splitter orientation="vertical" className="right-splitter">
                  {showList && (
                    <Splitter.Panel defaultSize="45%" min="20%">
                      <ParameterTable onSetValue={setVariableValue} />
                    </Splitter.Panel>
                  )}
                  {showPlot && (
                    <Splitter.Panel min="25%">
                      <PlotPanel />
                    </Splitter.Panel>
                  )}
                </Splitter>
              </Splitter.Panel>
            </Splitter>
          </Splitter.Panel>
          {plotDrawerOpen && (
            <Splitter.Panel defaultSize="400" min="280" max="45%">
              <ControlPanel
                onClose={() => setPlotDrawerOpen(false)}
                onSetValue={setVariableValue}
                onRefreshVariable={refreshVariable}
              />
            </Splitter.Panel>
          )}
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

      <SettingsDrawer />
      <WatchIoMessageLogDrawer />
    </div>
  );
}
