import React, { useState, useCallback, useRef } from 'react';

interface Block {
  id: string;
  type: 'header' | 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'columns';
  content: Record<string, any>;
}

const BLOCK_TYPES = [
  { type: 'header', label: 'Header', icon: 'H' },
  { type: 'text', label: 'Text', icon: 'T' },
  { type: 'image', label: 'Image', icon: '🖼' },
  { type: 'button', label: 'Button', icon: '▶' },
  { type: 'divider', label: 'Divider', icon: '—' },
  { type: 'spacer', label: 'Spacer', icon: '↕' },
  { type: 'columns', label: '2 Columns', icon: '▥' },
] as const;

const DEFAULT_CONTENT: Record<string, Record<string, any>> = {
  header: { text: 'Your Heading', level: 'h2', align: 'center' },
  text: { text: 'Write your content here. Use {{customer_name}} for personalization.', align: 'left' },
  image: { src: '', alt: 'Image', width: '100%' },
  button: { text: 'Shop Now', url: '#', align: 'center', color: '#2563eb' },
  divider: { color: '#334155', thickness: 1 },
  spacer: { height: 24 },
  columns: { left: 'Left column content', right: 'Right column content' },
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function blockToHtml(block: Block): string {
  const c = block.content;
  switch (block.type) {
    case 'header': {
      const tag = c.level || 'h2';
      return `<${tag} style="text-align:${c.align || 'center'};color:#f1f5f9;margin:16px 0">${c.text}</${tag}>`;
    }
    case 'text':
      return `<p style="text-align:${c.align || 'left'};color:#cbd5e1;line-height:1.6;margin:12px 0">${c.text}</p>`;
    case 'image':
      return c.src
        ? `<div style="text-align:center;margin:16px 0"><img src="${c.src}" alt="${c.alt || ''}" style="max-width:${c.width || '100%'};border-radius:8px" /></div>`
        : `<div style="text-align:center;padding:32px;background:#1e293b;border:1px dashed #475569;border-radius:8px;margin:16px 0;color:#94a3b8">Image placeholder</div>`;
    case 'button':
      return `<div style="text-align:${c.align || 'center'};margin:20px 0"><a href="${c.url || '#'}" style="display:inline-block;padding:12px 28px;background:${c.color || '#2563eb'};color:#fff;text-decoration:none;border-radius:8px;font-weight:600">${c.text}</a></div>`;
    case 'divider':
      return `<hr style="border:none;border-top:${c.thickness || 1}px solid ${c.color || '#334155'};margin:20px 0" />`;
    case 'spacer':
      return `<div style="height:${c.height || 24}px"></div>`;
    case 'columns':
      return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0"><tr><td width="50%" style="vertical-align:top;padding-right:8px;color:#cbd5e1">${c.left}</td><td width="50%" style="vertical-align:top;padding-left:8px;color:#cbd5e1">${c.right}</td></tr></table>`;
    default:
      return '';
  }
}

function blocksToHtml(blocks: Block[]): string {
  const inner = blocks.map(blockToHtml).join('\n');
  return `<div style="max-width:600px;margin:0 auto;font-family:system-ui,-apple-system,sans-serif;background:#0f172a;padding:32px;border-radius:12px">\n${inner}\n</div>`;
}

interface BlockEditorProps {
  block: Block;
  onUpdate: (id: string, content: Record<string, any>) => void;
}

const BlockEditor: React.FC<BlockEditorProps> = ({ block, onUpdate }) => {
  const c = block.content;
  const update = (key: string, value: any) => onUpdate(block.id, { ...c, [key]: value });

  const inputClass = 'w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500';

  switch (block.type) {
    case 'header':
      return (
        <div className="space-y-2">
          <input className={inputClass} value={c.text} onChange={e => update('text', e.target.value)} placeholder="Heading text" />
          <div className="flex gap-2">
            <select className={`${inputClass} w-24`} value={c.level} onChange={e => update('level', e.target.value)}>
              <option value="h1">H1</option>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
            </select>
            <select className={`${inputClass} w-24`} value={c.align} onChange={e => update('align', e.target.value)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      );
    case 'text':
      return (
        <div className="space-y-2">
          <textarea className={`${inputClass} resize-y`} rows={3} value={c.text} onChange={e => update('text', e.target.value)} placeholder="Text content..." />
          <select className={`${inputClass} w-24`} value={c.align} onChange={e => update('align', e.target.value)}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      );
    case 'image':
      return (
        <div className="space-y-2">
          <input className={inputClass} value={c.src} onChange={e => update('src', e.target.value)} placeholder="Image URL" />
          <input className={inputClass} value={c.alt} onChange={e => update('alt', e.target.value)} placeholder="Alt text" />
        </div>
      );
    case 'button':
      return (
        <div className="space-y-2">
          <input className={inputClass} value={c.text} onChange={e => update('text', e.target.value)} placeholder="Button text" />
          <input className={inputClass} value={c.url} onChange={e => update('url', e.target.value)} placeholder="Button URL" />
          <div className="flex gap-2 items-center">
            <input type="color" value={c.color || '#2563eb'} onChange={e => update('color', e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
            <select className={`${inputClass} w-24`} value={c.align} onChange={e => update('align', e.target.value)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      );
    case 'divider':
      return (
        <div className="flex gap-2 items-center">
          <input type="color" value={c.color || '#334155'} onChange={e => update('color', e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
          <input type="number" className={`${inputClass} w-20`} min={1} max={4} value={c.thickness} onChange={e => update('thickness', Number(e.target.value))} />
          <span className="text-xs text-slate-500">px</span>
        </div>
      );
    case 'spacer':
      return (
        <div className="flex gap-2 items-center">
          <input type="range" min={8} max={64} value={c.height} onChange={e => update('height', Number(e.target.value))} className="flex-1" />
          <span className="text-xs text-slate-400 w-10">{c.height}px</span>
        </div>
      );
    case 'columns':
      return (
        <div className="grid grid-cols-2 gap-2">
          <textarea className={`${inputClass} resize-y`} rows={2} value={c.left} onChange={e => update('left', e.target.value)} placeholder="Left column" />
          <textarea className={`${inputClass} resize-y`} rows={2} value={c.right} onChange={e => update('right', e.target.value)} placeholder="Right column" />
        </div>
      );
    default:
      return null;
  }
};

interface CampaignTemplateEditorProps {
  value: string;
  onChange: (html: string) => void;
}

const CampaignTemplateEditor: React.FC<CampaignTemplateEditorProps> = ({ value, onChange }) => {
  const [blocks, setBlocks] = useState<Block[]>(() => {
    if (value && value.trim().startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch {}
    }
    return [];
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragSrcIdx = useRef<number | null>(null);

  const emitHtml = useCallback((newBlocks: Block[]) => {
    onChange(blocksToHtml(newBlocks));
  }, [onChange]);

  const addBlock = (type: string) => {
    const block: Block = {
      id: generateId(),
      type: type as Block['type'],
      content: { ...DEFAULT_CONTENT[type] },
    };
    const next = [...blocks, block];
    setBlocks(next);
    setSelectedId(block.id);
    emitHtml(next);
  };

  const updateBlock = (id: string, content: Record<string, any>) => {
    const next = blocks.map(b => b.id === id ? { ...b, content } : b);
    setBlocks(next);
    emitHtml(next);
  };

  const removeBlock = (id: string) => {
    const next = blocks.filter(b => b.id !== id);
    setBlocks(next);
    if (selectedId === id) setSelectedId(null);
    emitHtml(next);
  };

  const moveBlock = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const next = [...blocks];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setBlocks(next);
    emitHtml(next);
  };

  const duplicateBlock = (id: string) => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx === -1) return;
    const dup: Block = { ...blocks[idx], id: generateId(), content: { ...blocks[idx].content } };
    const next = [...blocks];
    next.splice(idx + 1, 0, dup);
    setBlocks(next);
    setSelectedId(dup.id);
    emitHtml(next);
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    dragSrcIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    setDragOverIdx(null);

    const newType = e.dataTransfer.getData('block-type');
    if (newType) {
      const block: Block = {
        id: generateId(),
        type: newType as Block['type'],
        content: { ...DEFAULT_CONTENT[newType] },
      };
      const next = [...blocks];
      next.splice(toIdx, 0, block);
      setBlocks(next);
      setSelectedId(block.id);
      emitHtml(next);
      return;
    }

    if (dragSrcIdx.current !== null) {
      moveBlock(dragSrcIdx.current, toIdx);
      dragSrcIdx.current = null;
    }
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIdx(null);
    const newType = e.dataTransfer.getData('block-type');
    if (newType) {
      addBlock(newType);
    }
  };

  const html = blocksToHtml(blocks);

  return (
    <div className="flex gap-4 min-h-[400px]">
      {/* Sidebar — block palette */}
      <div className="w-36 flex-shrink-0">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Blocks</p>
        <div className="space-y-1.5">
          {BLOCK_TYPES.map(bt => (
            <div
              key={bt.type}
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('block-type', bt.type);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => addBlock(bt.type)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 cursor-grab active:cursor-grabbing text-slate-300 text-sm transition-colors border border-slate-700/50"
            >
              <span className="w-5 text-center text-xs">{bt.icon}</span>
              <span>{bt.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Variables</p>
          {['customer_name', 'email', 'first_name'].map(v => (
            <button
              key={v}
              onClick={() => navigator.clipboard.writeText(`{{${v}}}`)}
              className="block w-full text-left px-2 py-1 rounded text-xs text-blue-400 hover:bg-slate-800 transition-colors"
              title={`Copy {{${v}}} to clipboard`}
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setShowPreview(false)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${!showPreview ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
          >
            Editor
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${showPreview ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
          >
            Preview
          </button>
          <span className="ml-auto text-xs text-slate-500">{blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
        </div>

        {showPreview ? (
          <div
            className="flex-1 bg-slate-950 rounded-xl border border-slate-800 p-6 overflow-auto"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div
            className="flex-1 bg-slate-950/50 rounded-xl border border-slate-800 p-4 overflow-auto"
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={handleCanvasDrop}
          >
            {blocks.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <p className="text-sm mb-1">Drag blocks here or click to add</p>
                <p className="text-xs">Build your email template visually</p>
              </div>
            )}

            {blocks.map((block, idx) => (
              <div
                key={block.id}
                draggable
                onDragStart={e => handleDragStart(e, idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={e => handleDrop(e, idx)}
                onDragLeave={() => setDragOverIdx(null)}
                onClick={() => setSelectedId(selectedId === block.id ? null : block.id)}
                className={`group relative mb-2 rounded-lg border transition-all cursor-pointer ${
                  selectedId === block.id
                    ? 'border-blue-500 bg-slate-900/80'
                    : 'border-slate-800/50 bg-slate-900/30 hover:border-slate-700'
                } ${dragOverIdx === idx ? 'border-t-2 border-t-blue-400' : ''}`}
              >
                {/* Block header */}
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-800/30">
                  <span className="text-slate-600 cursor-grab active:cursor-grabbing">⠿</span>
                  <span className="text-xs text-slate-500 font-medium uppercase">{block.type}</span>
                  <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); moveBlock(idx, Math.max(0, idx - 1)); }}
                      className="p-1 text-slate-500 hover:text-slate-300 text-xs"
                      title="Move up"
                    >↑</button>
                    <button
                      onClick={e => { e.stopPropagation(); moveBlock(idx, Math.min(blocks.length - 1, idx + 1)); }}
                      className="p-1 text-slate-500 hover:text-slate-300 text-xs"
                      title="Move down"
                    >↓</button>
                    <button
                      onClick={e => { e.stopPropagation(); duplicateBlock(block.id); }}
                      className="p-1 text-slate-500 hover:text-slate-300 text-xs"
                      title="Duplicate"
                    >⧉</button>
                    <button
                      onClick={e => { e.stopPropagation(); removeBlock(block.id); }}
                      className="p-1 text-rose-500/70 hover:text-rose-400 text-xs"
                      title="Delete"
                    >✕</button>
                  </div>
                </div>

                {/* Block content / inline editor */}
                <div className="px-3 py-2">
                  {selectedId === block.id ? (
                    <BlockEditor block={block} onUpdate={updateBlock} />
                  ) : (
                    <div
                      className="text-sm text-slate-400 pointer-events-none"
                      dangerouslySetInnerHTML={{ __html: blockToHtml(block) }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignTemplateEditor;
