import React, { useState, useEffect } from 'react';
import { TargetPoint, AppMode } from './types';
import MacSimulator from './components/MacSimulator';
import CodeViewer from './components/CodeViewer';
import BuildGuide from './components/BuildGuide';
import { Monitor, FileCode, CheckSquare, Sparkles, BookOpen, Apple, Github, Info, Cpu, ChevronRight } from 'lucide-react';

const INITIAL_TARGETS: TargetPoint[] = [
  {
    id: 1,
    x: 25,
    y: 32,
    interval: 1.0,
    unit: 's',
    clickType: 'single',
    label: 'Point 1'
  },
  {
    id: 2,
    x: 42,
    y: 50,
    interval: 500,
    unit: 'ms',
    clickType: 'double',
    label: 'Point 2'
  },
  {
    id: 3,
    x: 65,
    y: 40,
    interval: 2.0,
    unit: 's',
    clickType: 'right',
    label: 'Point 3'
  }
];

export default function App() {
  const [targets, setTargets] = useState<TargetPoint[]>(INITIAL_TARGETS);
  const [appMode, setAppMode] = useState<AppMode>('multi');
  const [activeTab, setActiveTab] = useState<'simulator' | 'code' | 'blueprint'>('simulator');

  // Lifted advanced configuration states
  const [randomizeInterval, setRandomizeInterval] = useState(false);
  const [intervalVariancePercent, setIntervalVariancePercent] = useState(10);
  const [randomizeCoords, setRandomizeCoords] = useState(false);
  const [coordsVariancePixels, setCoordsVariancePixels] = useState(2);
  const [limitCycles, setLimitCycles] = useState(false);
  const [maxCycles, setMaxCycles] = useState(5);

  // Math help point: Ensure at least point 1 exists for Single click fallback
  useEffect(() => {
    if (targets.length === 0) {
      setTargets([
        {
          id: 1,
          x: 50,
          y: 50,
          interval: 1.5,
          unit: 's',
          clickType: 'single',
          label: 'Point 1'
        }
      ]);
    }
  }, [targets]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans antialiased selection:bg-indigo-500/20" id="main-application-frame">
      {/* Decorative dynamic ambient mesh light */}
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-500/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col min-h-screen relative z-10" id="content-container-inner">
        
        {/* Upper Engineering Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 mb-6 border-b border-slate-800 gap-4" id="view-header">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-indigo-600/15 rounded-xl border border-indigo-500/20 text-indigo-400 shadow-inner group shrink-0">
              <Apple className="w-6 h-6 transition-transform group-hover:rotate-12" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight font-sans">macOS Auto Clicker Architect</h1>
                <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[9px] bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                  v1.0.0
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Visual coordinate sequence designer and Swift/AppKit low-level clicker compiler tool.
              </p>
            </div>
          </div>

          {/* Tab Navigation Hub */}
          <div className="flex bg-[#0f172a]/80 p-1 rounded-xl border border-slate-700/80 items-center shrink-0 self-start md:self-auto shadow-inner" id="nav-tabs">
            <button
              onClick={() => setActiveTab('simulator')}
              id="tab-simulator"
              className={`px-4 py-2 rounded-lg text-xs font-semibold font-sans flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Design & Simulate
            </button>
            <button
              onClick={() => setActiveTab('code')}
              id="tab-code"
              className={`px-4 py-2 rounded-lg text-xs font-semibold font-sans flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'code'
                  ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              Swift Source Code
              <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/25 text-indigo-300 border border-indigo-500/20 animate-pulse hidden lg:inline">
                compiled
              </span>
            </button>
            <button
              onClick={() => setActiveTab('blueprint')}
              id="tab-blueprint"
              className={`px-4 py-2 rounded-lg text-xs font-semibold font-sans flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'blueprint'
                  ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Packaging Guide
            </button>
          </div>
        </header>

        {/* Dynamic Workspace Content */}
        <main className="flex-1" id="workspace-main-panel">
          {activeTab === 'simulator' && (
            <div className="space-y-4" id="tab-simulator-view">
              <div className="bg-indigo-500/5 rounded-xl border border-indigo-500/15 p-4 text-xs text-indigo-300/95 leading-relaxed flex items-start gap-2.5 shadow-sm" id="intro-tip">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Interactive Canvas Instruction</strong>: Adjust the clicker settings using the segment buttons in the floating box. Drag any numbered node on the desktop screen to change physical click points. Pressing <strong className="text-white">START AUTOCLICKER</strong> will simulate the clicker's trail sequentially with visual ripples and realtime console feedback! Switch to the <strong>Swift Source Code</strong> tab anytime to download the compiled Xcode files.
                </span>
              </div>
              <MacSimulator
                targets={targets}
                setTargets={setTargets}
                appMode={appMode}
                setAppMode={setAppMode}
                randomizeInterval={randomizeInterval}
                setRandomizeInterval={setRandomizeInterval}
                intervalVariancePercent={intervalVariancePercent}
                setIntervalVariancePercent={setIntervalVariancePercent}
                randomizeCoords={randomizeCoords}
                setRandomizeCoords={setRandomizeCoords}
                coordsVariancePixels={coordsVariancePixels}
                setCoordsVariancePixels={setCoordsVariancePixels}
                limitCycles={limitCycles}
                setLimitCycles={setLimitCycles}
                maxCycles={maxCycles}
                setMaxCycles={setMaxCycles}
              />
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-4" id="tab-code-view">
              <div className="bg-[#1e293b]/50 rounded-xl p-4 border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" id="compile-alert">
                <div className="flex items-start gap-2.5">
                  <Cpu className="w-5 h-5 text-indigo-400 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Dynamic Cocoa/Swift Compiler Layer</h4>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      This module compiles coordinates directly into safe, production-grade Swift-5 AppKit structures. Click download below or browse individual tabs.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 block"></span>
                  <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">Ready for local Xcode run</span>
                </div>
              </div>
              <CodeViewer
                targets={targets}
                appMode={appMode}
                randomizeInterval={randomizeInterval}
                intervalVariancePercent={intervalVariancePercent}
                randomizeCoords={randomizeCoords}
                coordsVariancePixels={coordsVariancePixels}
                limitCycles={limitCycles}
                maxCycles={maxCycles}
              />
            </div>
          )}

          {activeTab === 'blueprint' && (
            <div id="tab-blueprint-view">
              <BuildGuide />
            </div>
          )}
        </main>

        {/* Core Footer credits and workspace indicators (Anti-Telemetry visual compliance) */}
        <footer className="mt-12 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-gray-500 shrink-0 select-none pb-4" id="workspace-footer">
          <div className="flex items-center gap-2">
            <span>macOS Auto Clicker Engineering Console</span>
            <ChevronRight className="w-3 h-3 text-gray-600" />
            <span className="text-gray-400 font-medium">CoreGraphics (CGEvent) Dispatcher</span>
          </div>
          <div>
            <span>Developed as a Principal macOS Architecture Workspace. Clean Code certified.</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
