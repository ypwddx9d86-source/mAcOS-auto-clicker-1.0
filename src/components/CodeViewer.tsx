import React, { useState } from 'react';
import { TargetPoint, AppMode, SwiftFile } from '../types';
import { getSwiftFiles } from '../swiftCodeTemplates';
import { FileCode, Play, Terminal, Sparkles, Copy, Check, Download, Info } from 'lucide-react';

interface CodeViewerProps {
  targets: TargetPoint[];
  appMode: AppMode;
  randomizeInterval: boolean;
  intervalVariancePercent: number;
  randomizeCoords: boolean;
  coordsVariancePixels: number;
  limitCycles: boolean;
  maxCycles: number;
}

export default function CodeViewer({
  targets,
  appMode,
  randomizeInterval,
  intervalVariancePercent,
  randomizeCoords,
  coordsVariancePixels,
  limitCycles,
  maxCycles
}: CodeViewerProps) {
  const files = getSwiftFiles(
    targets,
    appMode,
    randomizeInterval,
    intervalVariancePercent,
    randomizeCoords,
    coordsVariancePixels,
    limitCycles,
    maxCycles
  );
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const selectedFile = files[selectedFileIndex] || files[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (file: SwiftFile) => {
    const mimeType = file.name.endsWith('.md') ? 'text/markdown' : file.name.endsWith('.plist') ? 'application/xml' : 'text/plain';
    const blob = new Blob([file.code], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Simple, high-quality, lightweight syntax highlighting for previewing Swift/XML
  const renderCodeWithHighlight = (code: string, language: string) => {
    const lines = code.split('\n');
    return (
      <code className="font-mono text-[13px] leading-relaxed text-slate-300 block select-text">
        {lines.map((line, idx) => {
          let lineClass = "text-slate-300";
          
          if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
            lineClass = "text-emerald-400 font-normal italic"; // Comment
          } else if (line.trim().startsWith('#') || line.trim().startsWith('##')) {
            lineClass = "text-sky-400 font-semibold"; // MD Headers
          } else if (line.includes('func ') || line.includes('struct ') || line.includes('class ') || line.includes('enum ')) {
            // Swift keywords
            lineClass = "text-amber-200 font-medium";
          }

          return (
            <div key={idx} className="flex hover:bg-white/5 px-4 py-0.5" id={`L${idx + 1}`}>
              <span className="w-10 text-right pr-4 mr-4 border-r border-slate-800 text-slate-600 select-none text-xs sticky left-0 bg-slate-950/50">
                {idx + 1}
              </span>
              <span className={`${lineClass} whitespace-pre-wrap`}>
                {line || ' '}
              </span>
            </div>
          );
        })}
      </code>
    );
  };

  return (
    <div className="bg-[#0f172a]/75 backdrop-blur-md rounded-2xl border border-slate-700/80 overflow-hidden flex flex-col md:flex-row h-[550px] shadow-2xl" id="code-viewer-container">
      {/* File Sidebar */}
      <div className="w-full md:w-64 bg-[#0f172a]/95 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col shrink-0" id="sidebar-panel">
        <div className="p-4 border-b border-slate-800 bg-slate-950/40" id="sidebar-header">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#ff5f56] block"></span>
              <span className="w-3 h-3 rounded-full bg-[#ffbd2e] block"></span>
              <span className="w-3 h-3 rounded-full bg-[#27c93f] block"></span>
            </div>
            <span className="text-xs font-mono font-medium text-slate-400 ml-2">Xcode Workspace</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-sans">
            Export-ready native Swift files. Code changes reactively as you change targets.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin" id="sidebar-files">
          {files.map((file, idx) => (
            <button
              key={file.name}
              id={`file-btn-${file.name.replace('.', '-')}`}
              onClick={() => setSelectedFileIndex(idx)}
              className={`w-full text-left px-3 py-2 rounded-lg flex items-start gap-2.5 transition-all group ${
                selectedFileIndex === idx
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <FileCode className={`w-4 h-4 mt-0.5 shrink-0 ${selectedFileIndex === idx ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
              <div className="min-w-0">
                <p className="text-xs font-mono font-semibold truncate leading-none mb-1">
                  {file.name}
                </p>
                <p className="text-[10px] text-slate-500 line-clamp-1 leading-none">
                  {file.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex flex-col gap-2" id="sidebar-footer">
          <button
            onClick={() => {
              // Sequentially download all project files
              files.forEach(f => downloadFile(f));
            }}
            id="download-all-btn"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-xl shadow-lg shadow-indigo-950/20 transition-all border border-indigo-500/30 text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download Xcode Project
          </button>
        </div>
      </div>

      {/* Code Editor Body */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0f172a]/40" id="editor-panel">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/50 shrink-0" id="editor-header">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-500/10 text-indigo-400 font-mono font-medium border border-indigo-400/20 uppercase tracking-wider">
              {selectedFile.language}
            </span>
            <span className="text-xs font-mono text-slate-300 font-semibold truncate">
              {selectedFile.path}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              id="copy-code-btn"
              className="p-1 px-2.5 rounded-md hover:bg-indigo-500/10 text-indigo-300 hover:text-indigo-200 transition-all border border-slate-800 hover:border-slate-700 text-[11px] font-sans flex items-center gap-1.5"
              title="Copy details"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => downloadFile(selectedFile)}
              id="download-file-btn"
              className="p-1 rounded-md hover:bg-indigo-500/10 text-indigo-300 hover:text-indigo-200 transition-all border border-slate-800 hover:border-slate-700 cursor-pointer"
              title="Download File"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Realtime generated notification bar */}
        {selectedFile.name !== 'README.md' && selectedFile.name !== 'Info.plist' && (
          <div className="px-4 py-1.5 bg-indigo-500/5 text-indigo-300 border-b border-indigo-500/10 text-[10px] font-mono flex items-center gap-1.5 select-none" id="realtime-notice">
            <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
            Auto-Updated: Code reflects your currently placed coordinate targets & interval speeds!
          </div>
        )}

        {/* Scrollable Container */}
        <div className="flex-1 overflow-auto py-4 bg-slate-950/70 scrollbar-thin select-text" id="editor-codebox">
          <pre className="m-0 select-text">
            {renderCodeWithHighlight(selectedFile.code, selectedFile.language)}
          </pre>
        </div>
      </div>
    </div>
  );
}
