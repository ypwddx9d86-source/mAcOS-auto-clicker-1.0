import React, { useState, useEffect, useRef } from 'react';
import { TargetPoint, AppMode, SimulationState, LogEntry, ClickTimeUnit, ClickType } from '../types';
import { Play, Square, Plus, Trash2, Settings, Terminal, MousePointer, Sun, Moon, Sparkles, Monitor, AppWindow, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

interface MacSimulatorProps {
  targets: TargetPoint[];
  setTargets: React.Dispatch<React.SetStateAction<TargetPoint[]>>;
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  randomizeInterval: boolean;
  setRandomizeInterval: (b: boolean) => void;
  intervalVariancePercent: number;
  setIntervalVariancePercent: (n: number) => void;
  randomizeCoords: boolean;
  setRandomizeCoords: (b: boolean) => void;
  coordsVariancePixels: number;
  setCoordsVariancePixels: (n: number) => void;
  limitCycles: boolean;
  setLimitCycles: (b: boolean) => void;
  maxCycles: number;
  setMaxCycles: (n: number) => void;
}

const WALLPAPERS = [
  { id: 'sequoia', name: 'Sequoia Glow', css: 'bg-gradient-to-tr from-[#9a3412] via-[#b91c1c] to-[#ca8a04]' },
  { id: 'sonoma', name: 'Sonoma Gold', css: 'bg-gradient-to-br from-[#1d4ed8] via-[#701a75] to-[#f59e0b]' },
  { id: 'obsidian', name: 'Midnight Space', css: 'bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#020617]' },
  { id: 'quartz', name: 'Quartz Emerald', css: 'bg-gradient-to-br from-[#064e3b] via-[#111827] to-[#1e1b4b]' }
];

export default function MacSimulator({
  targets,
  setTargets,
  appMode,
  setAppMode,
  randomizeInterval,
  setRandomizeInterval,
  intervalVariancePercent,
  setIntervalVariancePercent,
  randomizeCoords,
  setRandomizeCoords,
  coordsVariancePixels,
  setCoordsVariancePixels,
  limitCycles,
  setLimitCycles,
  maxCycles,
  setMaxCycles
}: MacSimulatorProps) {
  // Simulator State
  const [wallpaperIdx, setWallpaperIdx] = useState(0);
  const [simulationState, setSimulationState] = useState<SimulationState>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 'init', timestamp: new Date().toLocaleTimeString(), message: 'CoreGraphics EventTap Initialized: Waiting for click command...', type: 'info' }
  ]);
  
  // Custom drag tracking state
  const [draggingTargetId, setDraggingTargetId] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [activeRipple, setActiveRipple] = useState<{ x: number, y: number, id: number } | null>(null);
  
  // Virtual Cursor State
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 });
  const [activeTargetIndex, setActiveTargetIndex] = useState<number>(-1);
  const [totalClicksGenerated, setTotalClicksGenerated] = useState(0);
  
  // Repeat tracking states
  const completedCyclesRef = useRef(0);
  const [cyclesRun, setCyclesRun] = useState(0);
  
  // Refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const simulationTimerRef = useRef<any>(null);

  // Immune refs for thread execution
  const targetsRef = useRef(targets);
  const appModeRef = useRef(appMode);
  const randomizeIntervalRef = useRef(randomizeInterval);
  const intervalVariancePercentRef = useRef(intervalVariancePercent);
  const randomizeCoordsRef = useRef(randomizeCoords);
  const coordsVariancePixelsRef = useRef(coordsVariancePixels);
  const limitCyclesRef = useRef(limitCycles);
  const maxCyclesRef = useRef(maxCycles);
  const simulationStateRef = useRef(simulationState);

  // Sync immune refs:
  useEffect(() => { targetsRef.current = targets; }, [targets]);
  useEffect(() => { appModeRef.current = appMode; }, [appMode]);
  useEffect(() => { randomizeIntervalRef.current = randomizeInterval; }, [randomizeInterval]);
  useEffect(() => { intervalVariancePercentRef.current = intervalVariancePercent; }, [intervalVariancePercent]);
  useEffect(() => { randomizeCoordsRef.current = randomizeCoords; }, [randomizeCoords]);
  useEffect(() => { coordsVariancePixelsRef.current = coordsVariancePixels; }, [coordsVariancePixels]);
  useEffect(() => { limitCyclesRef.current = limitCycles; }, [limitCycles]);
  useEffect(() => { maxCyclesRef.current = maxCycles; }, [maxCycles]);
  useEffect(() => { simulationStateRef.current = simulationState; }, [simulationState]);

  // Time String for macOS Menu Bar
  const [timeStr, setTimeStr] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Set up click log events
  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'click', targetId?: number) => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [
      { id: Date.now().toString() + Math.random(), timestamp: time, message, type, targetId },
      ...prev.slice(0, 49) // Keep last 50 events
    ]);
  };

  // Add clicking targets (max 8)
  const handleAddTarget = () => {
    if (targets.length >= 8) {
      addLog('Safety Limit: Cannot add more than 8 clicker targets.', 'warning');
      return;
    }
    const nextId = targets.length > 0 ? Math.max(...targets.map(t => t.id)) + 1 : 1;
    
    // Spawn targets radially or in center with small offset
    const offset = nextId * 4;
    const newPoint: TargetPoint = {
      id: nextId,
      x: 35 + offset + (Math.random() * 10),
      y: 40 + offset + (Math.random() * 10),
      interval: 1.5,
      unit: 's',
      clickType: 'single',
      label: `Point ${nextId}`
    };
    
    setTargets(prev => [...prev, newPoint]);
    addLog(`Target Marker ${nextId} spawned. Drag to position.`, 'info', nextId);
  };

  // Delete a specific target point
  const handleDeleteTarget = (id: number) => {
    setTargets(prev => prev.filter(t => t.id !== id));
    addLog(`Removed Target Marker ${id}.`, 'info', id);
  };

  // Drag handlers for transparent circular overlay
  const handleStartDrag = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (simulationState === 'running') return; // Absolute safety during clicking
    setDraggingTargetId(id);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggingTargetId === null || !canvasRef.current) return;
      
      const bounds = canvasRef.current.getBoundingClientRect();
      const rawX = e.clientX - bounds.left;
      const rawY = e.clientY - bounds.top;
      
      // Calculate high-precision decimal percentages (to 2 decimal places) for buttery smooth drag-and-drop actions
      const pctX = Number((Math.max(3, Math.min(97, (rawX / bounds.width) * 100))).toFixed(2));
      const pctY = Number((Math.max(8, Math.min(95, (rawY / bounds.height) * 100))).toFixed(2));
      
      setTargets(prev => prev.map(t => {
        if (t.id === draggingTargetId) {
          return { ...t, x: pctX, y: pctY };
        }
        return t;
      }));
    };

    const handleGlobalMouseUp = () => {
      if (draggingTargetId !== null) {
        // Compute discrete virtual screen coordinates for standard 1440x900 grid log
        const updatedTarget = targets.find(t => t.id === draggingTargetId);
        if (updatedTarget) {
          const virtualX = Math.round((updatedTarget.x / 100) * 1440);
          const virtualY = Math.round((updatedTarget.y / 100) * 900);
          addLog(`Position updated for Target Marker ${draggingTargetId} to coordinate (x: ${virtualX}px, y: ${virtualY}px).`, 'info', draggingTargetId);
        }
        setDraggingTargetId(null);
      }
    };

    if (draggingTargetId !== null) {
      window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingTargetId, targets]);

  // Click simulation sequencers
  const stopSimulationState = () => {
    setSimulationState('idle');
    setActiveTargetIndex(-1);
    if (simulationTimerRef.current) {
      clearTimeout(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
    addLog("Clicker Engine Stopped. Overlay handles enabled.", "warning");
  };

  const startSimulationState = () => {
    if (targets.length === 0) {
      addLog("Cannot start: Please add at least 1 coordinate target.", "warning");
      return;
    }
    
    // Reset cycle tracking
    completedCyclesRef.current = 0;
    setCyclesRun(0);
    
    setSimulationState('running');
    addLog("CGEvent Sequence Hook in effect. Hover handles temporarily locked.", "success");
    runNextSequenceElement(0); // Start from first element
  };

  const runNextSequenceElement = (targetIdx: number) => {
    if (targetsRef.current.length === 0) return;
    
    const activeIndex = targetIdx % targetsRef.current.length;
    let actualActiveIndex = activeIndex;
    
    // In Single mode, we only click targetsRef.current[0] continuously
    if (appModeRef.current === 'single') {
      actualActiveIndex = 0;
    }

    const currentTarget = targetsRef.current[actualActiveIndex];
    if (!currentTarget) return;

    setActiveTargetIndex(actualActiveIndex);
    
    // Determine coordinates (including optional random offsets)
    let finalX = currentTarget.x;
    let finalY = currentTarget.y;
    let coordLogSuffix = "";
    
    if (randomizeCoordsRef.current) {
      // Coordinate shift +/- px, bounded inside standard coordinates system
      const pixelOffsetX = (Math.random() * 2 - 1) * coordsVariancePixelsRef.current;
      const pixelOffsetY = (Math.random() * 2 - 1) * coordsVariancePixelsRef.current;
      
      const pctOffsetX = (pixelOffsetX / 1440) * 100;
      const pctOffsetY = (pixelOffsetY / 900) * 100;
      
      finalX = Math.round(Math.max(3, Math.min(97, currentTarget.x + pctOffsetX)));
      finalY = Math.round(Math.max(8, Math.min(95, currentTarget.y + pctOffsetY)));
      coordLogSuffix = ` (randomized: +/-${coordsVariancePixelsRef.current}px => shift:[${pixelOffsetX > 0 ? '+' : ''}${Math.round(pixelOffsetX)}px, ${pixelOffsetY > 0 ? '+' : ''}${Math.round(pixelOffsetY)}px])`;
    }

    // Glide mouse cursor to target coordinate
    setCursorPos({ x: finalX, y: finalY });

    // Emulate clicking trigger delay
    const baseClickDuration = currentTarget.unit === 'ms' 
      ? currentTarget.interval 
      : currentTarget.unit === 's' 
        ? currentTarget.interval * 1000 
        : currentTarget.interval * 60 * 1000;

    let finalClickDuration = baseClickDuration;
    let timingLogSuffix = "";
    
    if (randomizeIntervalRef.current) {
      const minInterval = 10;
      const variancePercent = intervalVariancePercentRef.current;
      const randomFactor = (Math.random() * 2 - 1) * (variancePercent / 100);
      const sleepOffset = baseClickDuration * randomFactor;
      finalClickDuration = Math.max(minInterval, baseClickDuration + sleepOffset);
      timingLogSuffix = ` (randomized: +/-${variancePercent}% => ${Math.round(finalClickDuration)}ms)`;
    }

    const delayTimer = setTimeout(() => {
      // Double check active status before dispatching events
      if (simulationStateRef.current !== 'running') return;

      // Fire Visual Ripple event at potentially randomized coordinates
      setActiveRipple({ x: finalX, y: finalY, id: currentTarget.id });
      setTimeout(() => setActiveRipple(null), 700);

      const mathX = Math.round((finalX / 100) * 1440);
      const mathY = Math.round((finalY / 100) * 900);
      
      const clickVerb = currentTarget.clickType === 'right' ? 'RIGHT click' : currentTarget.clickType === 'double' ? 'DOUBLE click' : 'LEFT click';
      addLog(`[SYSTEM] CGEvent posted ${clickVerb} at (x: ${mathX}, y: ${mathY})${coordLogSuffix} on Target ${currentTarget.id}${timingLogSuffix}`, 'click', currentTarget.id);
      
      setTotalClicksGenerated(prev => prev + 1);

      // Track cycles repetition completed
      let cycleCompleting = false;
      if (appModeRef.current === 'single') {
        completedCyclesRef.current += 1;
        cycleCompleting = true;
      } else {
        // Multi-point: finishes a loop when last point in Sequence is reached
        if (actualActiveIndex === targetsRef.current.length - 1) {
          completedCyclesRef.current += 1;
          cycleCompleting = true;
        }
      }

      if (cycleCompleting) {
        setCyclesRun(completedCyclesRef.current);
        if (limitCyclesRef.current) {
          if (completedCyclesRef.current >= maxCyclesRef.current) {
            addLog(`Completed repeat limit of ${maxCyclesRef.current} cycle(s). Autoclicker stopped.`, 'success');
            setSimulationState('idle');
            setActiveTargetIndex(-1);
            if (simulationTimerRef.current) {
              clearTimeout(simulationTimerRef.current);
              simulationTimerRef.current = null;
            }
            return;
          } else {
            addLog(`Completed loop cycle [${completedCyclesRef.current}/${maxCyclesRef.current}].`, 'info');
          }
        } else {
          addLog(`Completed loop cycle [${completedCyclesRef.current}].`, 'info');
        }
      }

      // Loop to next item
      const nextIdx = actualActiveIndex + 1;
      runNextSequenceElement(appModeRef.current === 'single' ? 0 : nextIdx);
    }, Math.max(100, finalClickDuration));

    simulationTimerRef.current = delayTimer;
  };

  // Run cleanup on unmount
  useEffect(() => {
    return () => {
      if (simulationTimerRef.current) {
        clearTimeout(simulationTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-6" id="simulator-outer-pane">
      
      {/* Dynamic Wallpaper Controls & Quick Stats */}
      <div className="flex items-center justify-between bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 shrink-0 shadow-lg" id="controls-topbar">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-indigo-400 animate-pulse" />
          <span className="text-xs font-semibold text-white tracking-wide font-sans">Active Sandbox Simulator</span>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Dynamic Wallpaper Toggle */}
          <div className="flex bg-slate-950/80 p-1.5 rounded-xl border border-slate-700/80 items-center gap-1.5" id="wallpaper-toggle-box">
            <span className="text-[10px] text-slate-400 font-mono px-1.5">Desktop:</span>
            {WALLPAPERS.map((wall, idx) => (
              <button
                key={wall.id}
                onClick={() => setWallpaperIdx(idx)}
                className={`w-4 h-4 rounded-full border cursor-pointer transition-transform ${wall.css} ${
                  wallpaperIdx === idx ? 'scale-125 border-white' : 'border-transparent'
                }`}
                title={wall.name}
              />
            ))}
          </div>

          <div className="h-4 w-px bg-slate-700" />

          {/* Quick Counter */}
          <div className="flex items-center gap-2 text-xs font-mono" id="clicks-badge">
            <span className="text-slate-404 text-slate-400">Clicks Dispatched:</span>
            <span className="font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/35 animate-pulse">
              {totalClicksGenerated}
            </span>
          </div>
        </div>
      </div>

      {/* Main macOS Monitor Display Section */}
      <div 
        ref={canvasRef}
        id="macos-display-canvas"
        className={`relative w-full aspect-[16/10] min-h-[380px] rounded-2xl border border-white/20 select-none overflow-hidden group shadow-2xl transition-all duration-700 ${WALLPAPERS[wallpaperIdx].css}`}
      >
        {/* Subtle dynamic background glow and depth shadows */}
        <div className="absolute inset-0 bg-neutral-900/15 backdrop-blur-[0.5px] pointer-events-none" />

        {/* macOS Menu Bar */}
        <div className="absolute top-0 left-0 right-0 h-6.5 bg-black/35 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4 z-40 select-none text-[11px] font-sans text-white/95" id="macos-menu-bar">
          <div className="flex items-center gap-3">
            {/* Apple Logo SVG */}
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 170 170">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.34.13-9.13-1.92-14.35-6.12-3.57-2.9-7.51-7.7-11.83-14.42-4.72-7.3-8.87-16-.9-26.05 4.58-10.74 9.97-16.12 16.16-16.12 3.59 0 7.89 1.15 12.89 3.44 5 2.3 8.78 3.45 11.36 3.45 2.12 0 5.43-.89 9.94-2.65 4.51-1.77 8.35-2.66 11.53-2.66 6.07 0 11.49 1.66 16.27 4.97 3.84 2.65 7.15 6.23 9.94 10.74-8.8 5.34-13.1 12.56-12.91 21.65.19 7.02 2.76 12.93 7.72 17.72 4.97 4.79 10.8 7.4 17.49 7.82 1.44-3.5 2.72-7 3.84-10.51l.01-.01zm-32.96-74.9c0-6.13 2.15-11.89 6.44-17.27 4.29-5.39 9.59-8.75 15.88-10.08.13.78.2 1.55.2 2.3 0 5.86-2.18 11.45-6.54 16.78-4.36 5.32-9.82 8.74-16.4 10.27l1.42.06.01.01-.01-.1-.01-.03-.98-.97z" />
            </svg>
            <span className="font-semibold text-white">Simulator</span>
            <span className="text-gray-300">File</span>
            <span className="text-gray-300">Target</span>
            <span className="text-gray-300">Device</span>
            <span className="text-gray-300">OSXEngine</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-gray-300">&#128366;&nbsp;Active</span>
            <span className="text-gray-300">98% [Battery]</span>
            <span className="font-medium text-white">{timeStr || '10:00 AM'}</span>
          </div>
        </div>

        {/* Dynamic click visual coordinate ripple effect overlay */}
        {activeRipple && (
          <div 
            className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-30"
            style={{ left: `${activeRipple.x}%`, top: `${activeRipple.y}%` }}
          >
            <span className="absolute w-16 h-16 rounded-full bg-indigo-500/40 animate-ping" />
            <span className="absolute w-10 h-10 rounded-full bg-indigo-500/70 scale-0 transition-transform duration-300 animate-out fade-out" />
            <span className="absolute w-4 h-4 rounded-full bg-indigo-300 border border-white scale-125 shadow-lg" />
          </div>
        )}

        {/* Main Background Desktop Windows (Simulating macOS desktop app window underneath) */}
        <div className="absolute top-12 left-12 right-1/3 bottom-12 rounded-xl bg-slate-900/75 backdrop-blur-md border border-slate-700 overflow-hidden flex flex-col z-10" id="simulated-app-pane">
          <div className="h-8 bg-slate-950/45 flex items-center px-4 gap-2 border-b border-slate-800 select-none shrink-0">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f] block"></span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono font-medium mx-auto">Target macOS Application Console</span>
          </div>
          <div className="flex-1 p-4 flex flex-col items-center justify-center text-center text-gray-300" id="simulated-app-canvas">
            <AppWindow className="w-12 h-12 text-indigo-400/80 mb-3" />
            <h4 className="text-xs font-bold font-sans text-white uppercase tracking-wider mb-1">Clickable Native Application Dashboard</h4>
            <p className="text-[10px] text-[#94a3b8] max-w-sm leading-normal">
              Drag target nodes anywhere on this virtual desktop, set timing rules, and press START inside the controller to simulate clicks hitting here.
            </p>
          </div>
        </div>

        {/* Draggable Red Crosshair Coordinates Markers (Up to 8 Targets) */}
        {targets.map((t, idx) => {
          const isTargetFocused = activeTargetIndex === idx && simulationState === 'running';
          const isSingleFocused = appMode === 'single' && idx === 0;
          const shouldRender = appMode === 'multi' || isSingleFocused;

          if (!shouldRender) return null;

          return (
            <div
              key={t.id}
              id={`visual-marker-${t.id}`}
              onMouseDown={(e) => handleStartDrag(e, t.id)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-25 flex items-center justify-center cursor-move select-none transition-transform active:scale-110 duration-150 ${
                simulationState === 'running' ? 'pointer-events-none opacity-60' : 'pointer-events-auto hover:scale-105'
              }`}
              style={{ left: `${t.x}%`, top: `${t.y}%` }}
            >
              <div className="relative">
                {/* Drag Indicator Outer Circle */}
                <div className={`w-[44px] h-[44px] rounded-full flex items-center justify-center bg-slate-900/90 backdrop-blur-sm border-2 shadow-xl transition-all ${
                  isTargetFocused 
                    ? 'border-indigo-400 ring-4 ring-indigo-500/20 scale-110 shadow-indigo-500/20' 
                    : 'border-slate-600 hover:border-slate-400'
                }`}>
                  <span className={`text-sm font-black font-sans select-none ${isTargetFocused ? 'text-indigo-300' : 'text-slate-200'}`}>
                    {idx + 1}
                  </span>
                </div>
                
                {/* Tiny target crosshair point */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-indigo-400 rounded-full" />
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2.5 w-0.5 bg-indigo-500/70" />
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2.5 w-0.5 bg-indigo-500/70" />
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2.5 h-0.5 bg-indigo-500/70" />
                <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2.5 h-0.5 bg-indigo-500/70" />

                {/* Micro timing label beneath markers */}
                <span className="absolute top-[48px] left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-950/90 border border-slate-800 text-[8px] font-mono whitespace-nowrap text-slate-300 shadow-md">
                  Point {idx + 1}: {t.interval}{t.unit} ({t.clickType === 'right' ? 'Right' : 'Left'})
                </span>
              </div>
            </div>
          );
        })}

        {/* Floating Controller HUD Panel (The customizable overlay requested in prompt) */}
        <div 
          className="absolute right-6 top-10 w-[240px] bg-slate-900/95 backdrop-blur-2xl rounded-2xl border border-slate-700/80 overflow-hidden z-20 flex flex-col shadow-2xl transition-all"
          id="clicker-controller-hud"
        >
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-slate-950/60 border-b border-indigo-950/50 flex items-center justify-between" id="hud-header">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
              <h4 className="text-[11px] font-bold font-sans text-slate-200 uppercase tracking-widest">OSX CLICKER OVERLAY</h4>
            </div>
            <Settings className="w-3.5 h-3.5 text-slate-500" />
          </div>

          {/* Settings Section */}
          <div className="p-3.5 flex flex-col gap-3 flex-1" id="hud-body">
            {/* Mode segment selector */}
            <div className="flex flex-col gap-1.5" id="mode-selector-box">
              <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Execution Mode</label>
              <div className="grid grid-cols-2 bg-slate-950/80 p-0.5 rounded-xl border border-slate-800" id="mode-tabs">
                <button
                  onClick={() => {
                    if (simulationState === 'running') return;
                    setAppMode('single');
                    addLog('Mode switched to Single Click Point.', 'info');
                  }}
                  id="tab-single-mode"
                  className={`py-1 text-[10px] font-semibold font-sans text-center rounded-lg transition-all cursor-pointer ${
                    appMode === 'single' ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Single Target
                </button>
                <button
                  onClick={() => {
                    if (simulationState === 'running') return;
                    setAppMode('multi');
                    addLog('Mode switched to Multi Sequenced Clicks.', 'info');
                  }}
                  id="tab-multi-mode"
                  className={`py-1 text-[10px] font-semibold font-sans text-center rounded-lg transition-all cursor-pointer ${
                    appMode === 'multi' ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sequence (8 max)
                </button>
              </div>
            </div>

            {/* Spawn Point Button */}
            {appMode === 'multi' && (
              <button
                onClick={handleAddTarget}
                id="hud-add-point-btn"
                disabled={targets.length >= 8 || simulationState === 'running'}
                className="w-full bg-slate-950/80 hover:bg-slate-900/60 text-slate-200 border border-slate-700/80 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                Add Target Pin ({targets.length}/8)
              </button>
            )}

            {/* Advanced Settings Checkbox Block inside HUD Panel */}
            <div className="border-t border-slate-800/80 pt-2 flex flex-col gap-1.5" id="hud-advanced-settings">
              {/* Limit Loops Checkbox Row */}
              <div className="flex flex-col gap-1 bg-slate-950/40 p-1.5 rounded-lg border border-slate-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] text-slate-300 font-medium">Limit Repeat Cycles</span>
                  <input
                    type="checkbox"
                    id="hud-checkbox-limit-cycles"
                    checked={limitCycles}
                    onChange={(e) => {
                      if (simulationState === 'running') return;
                      setLimitCycles(e.target.checked);
                    }}
                    disabled={simulationState === 'running'}
                    className="w-3.5 h-3.5 rounded border-slate-700 text-indigo-500 bg-slate-950 accent-indigo-500 cursor-pointer disabled:opacity-40"
                  />
                </div>
                {limitCycles && (
                  <div className="flex items-center justify-between mt-1 gap-2" id="hud-cycle-limit-inputs">
                    <span className="text-[8px] text-slate-400 font-mono">Repeat X times:</span>
                    <input
                      type="number"
                      id="hud-input-max-cycles"
                      min="1"
                      className="w-14 bg-slate-950 text-[10px] text-white border border-slate-800 rounded px-1 text-center font-mono focus:border-indigo-500 focus:outline-none"
                      value={maxCycles}
                      disabled={simulationState === 'running'}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        setMaxCycles(val);
                      }}
                    />
                  </div>
                )}
                {simulationState === 'running' && limitCycles && (
                  <span className="text-[8.5px] text-indigo-400 font-mono mt-0.5 animate-pulse">
                    Cycle progress: {cyclesRun} / {maxCycles}
                  </span>
                )}
              </div>

              {/* Randomization Parameters Block */}
              <div className="flex flex-col gap-1.5 bg-slate-950/40 p-1.5 rounded-lg border border-slate-800/50">
                {/* Randomize Intervals checkbox */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] text-slate-300 font-medium font-sans">Random Intervals</span>
                    <input
                      type="checkbox"
                      id="hud-checkbox-random-interval"
                      checked={randomizeInterval}
                      onChange={(e) => {
                        if (simulationState === 'running') return;
                        setRandomizeInterval(e.target.checked);
                      }}
                      disabled={simulationState === 'running'}
                      className="w-3.5 h-3.5 rounded border-slate-700 text-indigo-500 bg-slate-950 accent-indigo-500 cursor-pointer disabled:opacity-40"
                    />
                  </div>
                  {randomizeInterval && (
                    <div className="flex items-center justify-between mt-0.5 gap-2" id="hud-timing-variance">
                      <span className="text-[8px] text-slate-400 font-mono">Variance (+/-%):</span>
                      <input
                        type="number"
                        id="hud-input-variance-pct"
                        min="1"
                        max="100"
                        className="w-14 bg-slate-950 text-[10px] text-white border border-slate-800 rounded px-1 text-center font-mono focus:border-indigo-500 focus:outline-none"
                        value={intervalVariancePercent}
                        disabled={simulationState === 'running'}
                        onChange={(e) => {
                          const val = Math.max(1, Math.min(100, parseInt(e.target.value) || 10));
                          setIntervalVariancePercent(val);
                        }}
                      />
                    </div>
                  )}
                </div>

                <hr className="border-slate-850/50" />

                {/* Randomize Coordinates checkbox */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] text-slate-300 font-medium font-sans">Random Coordinates</span>
                    <input
                      type="checkbox"
                      id="hud-checkbox-random-coords"
                      checked={randomizeCoords}
                      onChange={(e) => {
                        if (simulationState === 'running') return;
                        setRandomizeCoords(e.target.checked);
                      }}
                      disabled={simulationState === 'running'}
                      className="w-3.5 h-3.5 rounded border-slate-700 text-indigo-500 bg-slate-950 accent-indigo-500 cursor-pointer disabled:opacity-40"
                    />
                  </div>
                  {randomizeCoords && (
                    <div className="flex items-center justify-between mt-0.5 gap-2" id="hud-coords-variance">
                      <span className="text-[8px] text-slate-400 font-mono">Variance (+/- px):</span>
                      <input
                        type="number"
                        id="hud-input-variance-px"
                        min="0"
                        max="50"
                        className="w-14 bg-slate-950 text-[10px] text-white border border-slate-800 rounded px-1 text-center font-mono focus:border-indigo-500 focus:outline-none"
                        value={coordsVariancePixels}
                        disabled={simulationState === 'running'}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(50, parseInt(e.target.value) || 2));
                          setCoordsVariancePixels(val);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Big Trigger buttons */}
            <div className="grid grid-cols-1 gap-2 mt-1" id="trigger-box-hud">
              {simulationState === 'running' ? (
                <button
                  onClick={stopSimulationState}
                  id="hud-stop-btn"
                  className="w-full bg-rose-600 hover:bg-rose-500 font-sans text-white rounded-xl py-2.5 text-xs font-bold tracking-wide transition-all shadow-lg shadow-rose-950/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  STOP ENGINE
                </button>
              ) : (
                <button
                  onClick={startSimulationState}
                  id="hud-start-btn"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 font-sans text-white rounded-xl py-2.5 text-xs font-bold tracking-wide transition-all shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  START AUTOCLICKER
                </button>
              )}
            </div>
          </div>

          {/* Footer Active Notification */}
          <div className="bg-slate-950/85 px-3 py-2 border-t border-slate-800 flex items-center gap-2 text-[9px] text-slate-500" id="hud-footer">
            <span className={`w-1.5 h-1.5 rounded-full ${simulationState === 'running' ? 'bg-indigo-400 animate-ping' : 'bg-slate-700'}`} />
            <span>{simulationState === 'running' ? 'Programmatic overlay active' : 'Reposition markers on screen'}</span>
          </div>
        </div>

        {/* Real-time Simulated Mouse cursor on the Desktop during runs */}
        {simulationState === 'running' && (
          <div 
            className="absolute z-40 p-1 pointer-events-none transition-all duration-300 ease-out"
            style={{ left: `${cursorPos.x}%`, top: `${cursorPos.y}%` }}
            id="virtual-mouse"
          >
            <MousePointer className="w-6 h-6 text-white leading-none fill-black stroke-white stroke-2 drop-shadow-md" />
          </div>
        )}
      </div>

      {/* Target parameters lists and live console logger side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="simulator-bottom-grid">
        
        {/* Dynamic click Target Speeds Parameters Editor */}
        <div className="bg-[#1e293b]/40 backdrop-blur-md rounded-2xl border border-slate-700/80 p-5 flex flex-col min-h-[300px]" id="parameters-frame">
          <div className="flex items-center justify-between mb-4 shrink-0" id="params-header">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Target Timing & Actions</h3>
            <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase">Dynamic Config</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[240px] scrollbar-thin overflow-x-hidden" id="params-scroll">
            {targets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10" id="params-empty">
                <Settings className="w-8 h-8 text-slate-700 mb-2 animate-spin-slow" />
                <p className="text-xs text-slate-500">No active anchors found.</p>
                <button 
                  onClick={handleAddTarget} 
                  id="params-add-first-btn"
                  className="text-xs text-indigo-400 font-semibold hover:underline mt-2 cursor-pointer"
                >
                  Create Target 1 (+ Add Target)
                </button>
              </div>
            ) : (
              targets.map((t, idx) => {
                const isSingleAndHidden = appMode === 'single' && idx !== 0;
                if (isSingleAndHidden) return null;

                return (
                  <div 
                    key={t.id} 
                    id={`param-row-${t.id}`}
                    draggable={simulationState !== 'running'}
                    onDragStart={(e) => {
                      if (simulationState === 'running') return;
                      setDraggedIndex(idx);
                      e.dataTransfer.setData('text/plain', idx.toString());
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIndex === null || draggedIndex === idx) return;
                      
                      const reordered = [...targets];
                      const [removed] = reordered.splice(draggedIndex, 1);
                      reordered.splice(idx, 0, removed);
                      setTargets(reordered);
                      setDraggedIndex(null);
                      addLog(`Drag-and-Drop update: Reordered loop index ${draggedIndex + 1} to position ${idx + 1}.`, 'info');
                    }}
                    onDragEnd={() => setDraggedIndex(null)}
                    className={`bg-slate-900/60 p-3 rounded-xl border flex flex-wrap sm:flex-nowrap items-center gap-3 transition-colors ${
                      draggedIndex === idx 
                        ? 'opacity-40 border-dashed border-indigo-500 bg-slate-950/40 cursor-grabbing' 
                        : 'border-slate-800/80 cursor-grab active:cursor-grabbing hover:border-slate-700/60'
                    }`}
                  >
                    {/* Reorder drag handle & swap arrows */}
                    <div className="flex items-center gap-1 text-slate-500 hover:text-slate-400">
                      <GripVertical className="w-4 h-4 shrink-0 cursor-grab active:cursor-grabbing" />
                      <div className="flex flex-col gap-0.5 justify-center">
                        <button
                          onClick={() => {
                            if (idx === 0 || simulationState === 'running') return;
                            const reordered = [...targets];
                            const temp = reordered[idx];
                            reordered[idx] = reordered[idx - 1];
                            reordered[idx - 1] = temp;
                            setTargets(reordered);
                            addLog(`Moved Point in slot ${idx + 1} up to slot ${idx}.`, 'info');
                          }}
                          disabled={idx === 0 || simulationState === 'running'}
                          className="text-slate-500 hover:text-indigo-400 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed leading-none p-0.5"
                          title="Move Up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (idx === targets.length - 1 || simulationState === 'running') return;
                            const reordered = [...targets];
                            const temp = reordered[idx];
                            reordered[idx] = reordered[idx + 1];
                            reordered[idx + 1] = temp;
                            setTargets(reordered);
                            addLog(`Moved Point in slot ${idx + 1} down to slot ${idx + 2}.`, 'info');
                          }}
                          disabled={idx === targets.length - 1 || simulationState === 'running'}
                          className="text-slate-500 hover:text-indigo-400 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed leading-none p-0.5"
                          title="Move Down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Circle Node id */}
                    <div className="flex items-center gap-2 select-none">
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white font-mono text-[10px] font-bold flex items-center justify-center shadow-md shadow-indigo-500/20">
                        {idx + 1}
                      </div>
                      <span className="text-xs font-semibold text-slate-200">Point</span>
                    </div>
 
                     {/* Coordinates output */}
                     <div className="text-[10px] font-mono text-slate-500 leading-none select-none">
                       X: {Math.round((t.x / 100) * 1440)}px <br />
                       Y: {Math.round((t.y / 100) * 900)}px
                     </div>
 
                     <div className="h-4 w-px bg-slate-800 hidden sm:block" />
 
                     {/* Interval input wrapper */}
                     <div className="flex items-center gap-1">
                       <span className="text-[10px] text-slate-500 select-none">Speed:</span>
                       <input
                         type="number"
                         id={`interval-input-${t.id}`}
                         value={t.interval}
                         step="any"
                         placeholder="1.0"
                         min="0.01"
                         onChange={(e) => {
                           const val = parseFloat(e.target.value) || 0.1;
                           setTargets(prev => prev.map(p => p.id === t.id ? { ...p, interval: val } : p));
                         }}
                         className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-white text-center font-mono focus:border-indigo-500 focus:outline-none"
                       />
                       <select
                         id={`unit-select-${t.id}`}
                         value={t.unit}
                         onChange={(e) => {
                           const val = e.target.value as ClickTimeUnit;
                           setTargets(prev => prev.map(p => p.id === t.id ? { ...p, unit: val } : p));
                         }}
                         className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                       >
                         <option value="ms">ms</option>
                         <option value="s">sec</option>
                         <option value="m">min</option>
                       </select>
                     </div>
 
                     {/* Click event selector */}
                     <div className="flex items-center gap-1 ml-auto">
                       <span className="text-[10px] text-slate-500 hidden xl:inline select-none">Action:</span>
                       <select
                         id={`clicktype-select-${t.id}`}
                         value={t.clickType}
                         onChange={(e) => {
                           const val = e.target.value as ClickType;
                           setTargets(prev => prev.map(p => p.id === t.id ? { ...p, clickType: val } : p));
                         }}
                         className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer text-center"
                       >
                         <option value="single">Single</option>
                         <option value="double">Double</option>
                         <option value="right">Right</option>
                       </select>
 
                       {targets.length > 1 && (
                         <button
                           onClick={() => handleDeleteTarget(t.id)}
                           id={`delete-btn-${t.id}`}
                           className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ml-1 cursor-pointer"
                           title="Delete Point"
                         >
                           <Trash2 className="w-3.5 h-3.5" />
                         </button>
                       )}
                     </div>
                   </div>
                );
              })
            )}
          </div>
        </div>

        {/* Low-level platform event logs console */}
        <div className="bg-[#1e293b]/40 backdrop-blur-md rounded-2xl border border-slate-700/80 p-5 flex flex-col min-h-[300px]" id="terminal-log-panel">
          <div className="flex items-center justify-between mb-4 shrink-0" id="terminal-header">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400 animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">EventTap Dispatcher Output</h3>
            </div>
            <button
              onClick={() => setLogs([])}
              id="clear-logs-btn"
              className="text-[10px] text-slate-400 hover:text-slate-200 underline font-mono bg-transparent border-0 cursor-pointer"
            >
              Clear Buffer
            </button>
          </div>

          {/* Terminal Box */}
          <div className="flex-1 overflow-y-auto p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 font-mono text-[10.5px] space-y-2 select-text max-h-[240px] scrollbar-thin" id="terminal-body">
            {logs.length === 0 ? (
              <p className="text-slate-600 italic text-center pt-8">Console log queue cleared.</p>
            ) : (
              logs.map((log) => (
                <div 
                  key={log.id} 
                  id={`log-row-${log.id}`}
                  className={`flex gap-2 select-text ${
                    log.type === 'click' 
                      ? 'text-indigo-300 font-semibold' 
                      : log.type === 'success' 
                        ? 'text-emerald-400' 
                        : log.type === 'warning' 
                          ? 'text-rose-400' 
                          : 'text-slate-400'
                  }`}
                >
                  <span className="text-slate-600 block shrink-0">[{log.timestamp}]</span>
                  <span className="whitespace-pre-wrap select-text">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
