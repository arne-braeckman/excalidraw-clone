import { 
  Menu, Square, Circle, Minus, Type, Pencil, 
  MousePointer2, Image, MinusCircle, PlusCircle, RotateCcw, RotateCw, Upload,
  Home, Plus as PlusIcon
} from 'lucide-react';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { jsPDF } from 'jspdf';
import './App.css';
import { useStore } from './store';
import { Canvas } from './components/Canvas';
import { useEffect, useState } from 'react';
import { set } from 'idb-keyval';

const THEME_PALETTES = {
  light: {
    stroke: ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00'],
    bg: ['#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99']
  },
  dark: {
    stroke: ['#e0e0e0', '#ff6b6b', '#51cf66', '#339af0', '#fcc419'],
    bg: ['#c92a2a', '#2b8a3e', '#1864ab', '#e67700']
  },
  neon: {
    stroke: ['#ff007f', '#00ffff', '#39ff14', '#ffff00', '#bd00ff'],
    bg: ['#ff007f', '#00ffff', '#39ff14', '#ffff00', '#bd00ff']
  },
  monokai: {
    stroke: ['#f8f8f2', '#f92672', '#a6e22e', '#66d9ef', '#fd971f'],
    bg: ['#f92672', '#a6e22e', '#66d9ef', '#fd971f']
  },
  nord: {
    stroke: ['#eceff4', '#bf616a', '#a3be8c', '#81a1c1', '#ebcb8b'],
    bg: ['#bf616a', '#a3be8c', '#81a1c1', '#ebcb8b']
  }
};

function App() {
  const { elements, appState, setActiveTool, setAppState, setElements, currentUser, currentBoardId, setCurrentUser } = useStore();
  const { activeTool, zoom, selectedElementId } = appState;
  const [loaded, setLoaded] = useState(false);

  // Load state on startup
  useEffect(() => {
     const savedUser = localStorage.getItem('canvas-user');
     if (savedUser) setCurrentUser(savedUser);
     setLoaded(true);
  }, [setCurrentUser]);

  // Save state continuously FOR CURRENT BOARD
  useEffect(() => {
    if (loaded && currentBoardId) {
      set(`board-${currentBoardId}`, elements);
      
      const state = useStore.getState();
      if (state.currentUser) {
          const updatedBoards = state.boards.map(b => b.id === currentBoardId ? { ...b, lastModified: Date.now() } : b);
          state.setBoards(updatedBoards);
          set(`user-${state.currentUser}-boards`, updatedBoards);
      }
    }
  }, [elements, loaded, currentBoardId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appState.theme);
  }, [appState.theme]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'r': setActiveTool('rectangle'); break;
        case 'c': setActiveTool('ellipse'); break;
        case 't': setActiveTool('text'); break;
        case 'l': setActiveTool('line'); break;
        case 'p': setActiveTool('pencil'); break;
        case 'v':
        case 'escape': 
          setActiveTool('select'); 
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTool]);

  const handleZoomIn = () => setAppState({ zoom: Math.min(zoom + 0.1, 10) });
  const handleZoomOut = () => setAppState({ zoom: Math.max(zoom - 0.1, 0.1) });

  const handleColorChange = (color: string) => {
    setAppState({ strokeColor: color });
    if (selectedElementId) {
      setElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, strokeColor: color } : el));
    }
  };

  const handleBgColorChange = (color: string) => {
    setAppState({ backgroundColor: color });
    if (selectedElementId) {
      setElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, backgroundColor: color } : el));
    }
  };

  const handleThemeChange = (newTheme: string) => {
    const oldTheme = appState.theme;
    if (oldTheme === newTheme) return;

    const oldStrokeColors = THEME_PALETTES[oldTheme as keyof typeof THEME_PALETTES]?.stroke || [];
    const newStrokeColors = THEME_PALETTES[newTheme as keyof typeof THEME_PALETTES]?.stroke || [];
    
    const oldBgColors = THEME_PALETTES[oldTheme as keyof typeof THEME_PALETTES]?.bg || [];
    const newBgColors = THEME_PALETTES[newTheme as keyof typeof THEME_PALETTES]?.bg || [];

    setElements(prev => prev.map(el => {
      let strokeColor = el.strokeColor;
      let backgroundColor = el.backgroundColor;

      const strokeIdx = oldStrokeColors.indexOf(strokeColor);
      if (strokeIdx !== -1 && newStrokeColors[strokeIdx]) {
        strokeColor = newStrokeColors[strokeIdx];
      }

      const bgIdx = oldBgColors.indexOf(backgroundColor);
      if (bgIdx !== -1 && newBgColors[bgIdx]) {
        backgroundColor = newBgColors[bgIdx];
      }

      return { ...el, strokeColor, backgroundColor };
    }));

    let activeStrokeColor = appState.strokeColor;
    let activeBackgroundColor = appState.backgroundColor;

    const activeStrokeIdx = oldStrokeColors.indexOf(activeStrokeColor);
    if (activeStrokeIdx !== -1 && newStrokeColors[activeStrokeIdx]) {
        activeStrokeColor = newStrokeColors[activeStrokeIdx];
    }
    const activeBgIdx = oldBgColors.indexOf(activeBackgroundColor);
    if (activeBgIdx !== -1 && newBgColors[activeBgIdx]) {
        activeBackgroundColor = newBgColors[activeBgIdx];
    }

    setAppState({ theme: newTheme as any, strokeColor: activeStrokeColor, backgroundColor: activeBackgroundColor });
  };
  
  const handleFillStyle = (style: string) => {
    setAppState({ fillStyle: style });
    if (selectedElementId) {
      setElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, fillStyle: style } : el));
    }
  };
  
  const handleRoughness = (r: number) => {
    setAppState({ roughness: r });
    if (selectedElementId) {
      setElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, roughness: r } : el));
    }
  };

  const handleFontFamily = (f: string) => {
    setAppState({ fontFamily: f });
    if (selectedElementId) {
      setElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, fontFamily: f } : el));
    }
  };

  const handleFontSize = (s: number) => {
    setAppState({ fontSize: s });
    if (selectedElementId) {
      setElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, fontSize: s } : el));
    }
  };

  const handleImageUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
         const id = window.crypto.randomUUID();
         const newElement: any = {
            id,
            type: 'image',
            x: (-appState.scrollX + window.innerWidth / 2) / appState.zoom - img.width / 2,
            y: (-appState.scrollY + window.innerHeight / 2) / appState.zoom - img.height / 2,
            width: img.width,
            height: img.height,
            strokeColor: 'transparent',
            backgroundColor: 'transparent',
            fillStyle: 'solid',
            strokeWidth: 1,
            roughness: 1,
            dataUrl,
            seed: Math.floor(Math.random() * 100000000)
         };
         setElements(prev => [...prev, newElement]);
         setAppState({activeTool: 'select', selectedElementId: id});
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleStartArrowToggle = () => {
    const val = appState.startArrowhead === 'arrow' ? null : 'arrow';
    setAppState({ startArrowhead: val });
    if (selectedElementId) {
      setElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, startArrowhead: val } : el));
    }
  };

  const handleEndArrowToggle = () => {
    const val = appState.endArrowhead === 'arrow' ? null : 'arrow';
    setAppState({ endArrowhead: val });
    if (selectedElementId) {
      setElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, endArrowhead: val } : el));
    }
  };

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.elements && Array.isArray(json.elements)) {
          setElements(json.elements);
        }
      } catch (err) {
        console.error("Failed to parse JSON", err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ elements }));
    const link = document.createElement('a');
    link.download = 'canvas-export.json';
    link.href = dataStr;
    link.click();
  };

  const handleExportPNG = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'canvas-export.png';
    link.href = dataUrl;
    link.click();
  };

  const handleExportPDF = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const imgData = canvas.toDataURL('image/png');
    const width = canvas.style.width ? parseInt(canvas.style.width) : canvas.width;
    const height = canvas.style.height ? parseInt(canvas.style.height) : canvas.height;
    
    // Scale down if pixel ratio is high so PDF isn't artificially massive in points
    const ratio = window.devicePixelRatio || 1;
    const pdfWidth = width / ratio;
    const pdfHeight = height / ratio;
    
    const pdf = new jsPDF({
      orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
      unit: 'px',
      format: [pdfWidth, pdfHeight]
    });
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('canvas-export.pdf');
  };

  if (!loaded) return null;
  if (!currentUser) return <LoginScreen />;
  if (!currentBoardId) return <Dashboard />;

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Canvas />

      {/* Top Menu: Boards & Saving */}
      <div className="ui-panel" style={{ top: '16px', left: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
        <button className="tool-btn" title="Back to Dashboard" onClick={() => useStore.getState().setCurrentBoard(null, '')}>
          <Home size={16} />
        </button>
        <button className="tool-btn" title="New Board" onClick={() => {
            const state = useStore.getState();
            const newBoard = { id: window.crypto.randomUUID(), name: "Untitled Board", lastModified: Date.now() };
            const newBoardsList = [...state.boards, newBoard];
            state.setBoards(newBoardsList);
            set(`user-${currentUser}-boards`, newBoardsList);
            state.setElements([]);
            state.setCurrentBoard(newBoard.id, newBoard.name);
        }}>
            <PlusIcon size={16} />
        </button>
        <div style={{ width: '1px', height: '24px', background: 'var(--panel-border)', margin: '0 4px' }} />
        <input 
           title="Rename Board"
           value={useStore.getState().currentBoardName}
           onChange={(e) => {
               const val = e.target.value;
               useStore.getState().setCurrentBoard(currentBoardId, val);
               const state = useStore.getState();
               const updatedBoards = state.boards.map(b => b.id === currentBoardId ? { ...b, name: val } : b);
               state.setBoards(updatedBoards);
               set(`user-${currentUser}-boards`, updatedBoards);
           }}
           style={{ background: 'transparent', border: '1px solid transparent', color: 'var(--text-main)', fontSize: '14px', fontWeight: 600, width: '140px', outline: 'none', padding: '4px', borderRadius: '4px' }}
           onFocus={e => e.target.style.border = '1px solid var(--accent-color)'}
           onBlur={e => e.target.style.border = '1px solid transparent'}
        />
      </div>

      {/* Primary Toolbar (Top Center) */}
      <div className="ui-panel" style={{ top: '16px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', padding: '8px 12px' }}>
        <button 
          className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => setActiveTool('select')}
          title="Select (V)"
        >
          <MousePointer2 size={20} />
        </button>
        <button 
          className={`tool-btn ${activeTool === 'rectangle' ? 'active' : ''}`}
          onClick={() => setActiveTool('rectangle')}
          title="Rectangle (R)"
        >
          <Square size={20} />
        </button>
        <button 
          className={`tool-btn ${activeTool === 'ellipse' ? 'active' : ''}`}
          onClick={() => setActiveTool('ellipse')}
          title="Ellipse (C)"
        >
          <Circle size={20} />
        </button>
        <button 
          className={`tool-btn ${activeTool === 'line' ? 'active' : ''}`}
          onClick={() => setActiveTool('line')}
          title="Line (L)"
        >
          <Minus size={20} />
        </button>
        <button 
          className={`tool-btn ${activeTool === 'pencil' ? 'active' : ''}`}
          onClick={() => setActiveTool('pencil')}
          title="Pencil (P)"
        >
          <Pencil size={20} />
        </button>
        <button 
          className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`}
          onClick={() => setActiveTool('text')}
          title="Text (T)"
        >
          <Type size={20} />
        </button>
        <button className="tool-btn" title="Insert Image" onClick={() => document.getElementById('image-upload-input')?.click()}>
          <Image size={20} />
        </button>
        <input 
           id="image-upload-input"
           type="file" 
           accept="image/*" 
           style={{ display: 'none' }} 
           onChange={handleImageUpload} 
        />
        <div style={{ width: '1px', height: '24px', background: 'var(--panel-border)', alignSelf: 'center' }} />
        <button className="tool-btn" onClick={() => document.getElementById('json-import-input')?.click()} title="Import Drawing">
          <Upload size={16} /> <span style={{fontSize: '12px', marginLeft: '4px', fontWeight: 600}}>Import</span>
        </button>
        <input 
           id="json-import-input"
           type="file" 
           accept=".json,.canvas" 
           style={{ display: 'none' }} 
           onChange={handleJsonImport} 
        />
        <div style={{ width: '1px', height: '24px', background: 'var(--panel-border)', alignSelf: 'center' }} />
        <span style={{fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', alignSelf: 'center', marginRight: '4px'}}>Export:</span>
        <button className="tool-btn" onClick={handleExportJSON} title="Export as JSON" style={{fontSize: '12px', fontWeight: 600}}>
          JSON
        </button>
        <button className="tool-btn" onClick={handleExportPNG} title="Export as PNG" style={{fontSize: '12px', fontWeight: 600}}>
          PNG
        </button>
        <button className="tool-btn" onClick={handleExportPDF} title="Export as PDF" style={{fontSize: '12px', fontWeight: 600}}>
          PDF
        </button>
      </div>

      {/* Left Toolbar: Settings / Menu / Styling */}
      <div className="ui-panel toolbar-left" style={{ alignItems: 'flex-start', padding: '16px', gap: '16px', minWidth: '150px' }}>
        <button className="tool-btn" title="Menu" style={{ alignSelf: 'center' }}>
          <Menu size={20} />
        </button>
        
        <div style={{ width: '100%', height: '1px', background: 'var(--panel-border)' }} />
        
        {/* Theme Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>App Theme</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {(Object.keys(THEME_PALETTES) as Array<keyof typeof THEME_PALETTES>).map(t => (
              <button 
                key={t}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleThemeChange(t)}
                className={`tool-btn ${appState.theme === t ? 'active' : ''}`}
                style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', textTransform: 'capitalize' }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Stroke Color */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Stroke</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {THEME_PALETTES[appState.theme]?.stroke?.map(c => (
              <button 
                key={c}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleColorChange(c)}
                style={{ 
                  width: '24px', height: '24px', borderRadius: '4px', backgroundColor: c, 
                  border: appState.strokeColor === c ? '2px solid var(--accent-color)' : '1px solid var(--panel-border)',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        </div>

        {/* Background Color */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Background</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <button 
              onMouseDown={(e) => e.preventDefault()} onClick={() => handleBgColorChange('transparent')}
              style={{ 
                width: '24px', height: '24px', borderRadius: '4px', backgroundColor: 'transparent',
                border: appState.backgroundColor === 'transparent' ? '2px solid var(--accent-color)' : '1px solid var(--panel-border)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <Minus size={14} color="var(--text-muted)" />
            </button>
            {THEME_PALETTES[appState.theme]?.bg?.map(c => (
              <button 
                key={c}
                onMouseDown={(e) => e.preventDefault()} onClick={() => handleBgColorChange(c)}
                style={{ 
                  width: '24px', height: '24px', borderRadius: '4px', backgroundColor: c, 
                  border: appState.backgroundColor === c ? '2px solid var(--accent-color)' : '1px solid var(--panel-border)',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        </div>

        {/* Fill Style */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Fill</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {['hachure', 'cross-hatch', 'solid'].map(f => (
              <button 
                key={f}
                className={`tool-btn ${appState.fillStyle === f ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()} onClick={() => handleFillStyle(f)}
                style={{ width: 'auto', padding: '0 8px', fontSize: '12px', height: '28px' }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Roughness */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Edges</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button 
                className={`tool-btn ${appState.roughness === 0 ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()} onClick={() => handleRoughness(0)}
                title="Sharp"
                style={{ width: '32px', height: '32px' }}
              >
                <Square size={16} />
            </button>
            <button 
                className={`tool-btn ${appState.roughness === 1 ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()} onClick={() => handleRoughness(1)}
                title="Architect"
                style={{ width: '32px', height: '32px' }}
              >
                <div style={{fontFamily: 'var(--font-draw)', fontSize: '16px'}}>~</div>
            </button>
            <button 
                className={`tool-btn ${appState.roughness === 2 ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()} onClick={() => handleRoughness(2)}
                title="Sloppy"
                style={{ width: '32px', height: '32px' }}
              >
                <div style={{fontFamily: 'var(--font-draw)', fontSize: '16px'}}>~~</div>
            </button>
          </div>
        </div>

        {/* Font Family */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Font family</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <button 
              className={`tool-btn ${appState.fontFamily === 'Caveat, cursive' ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()} onClick={() => handleFontFamily('Caveat, cursive')}
              style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', fontFamily: 'Caveat, cursive' }}
            >
              Hand-drawn
            </button>
            <button 
              className={`tool-btn ${appState.fontFamily === 'Inter, sans-serif' ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()} onClick={() => handleFontFamily('Inter, sans-serif')}
              style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
            >
              Normal
            </button>
            <button 
              className={`tool-btn ${appState.fontFamily === 'monospace' ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()} onClick={() => handleFontFamily('monospace')}
              style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', fontFamily: 'monospace' }}
            >
              Code
            </button>
          </div>
        </div>

        {/* Font Size */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Font size</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {[16, 24, 32].map(size => (
              <button 
                key={size}
                className={`tool-btn ${appState.fontSize === size ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()} onClick={() => handleFontSize(size)}
                style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
              >
                {size === 16 ? 'S' : size === 24 ? 'M' : 'L'}
              </button>
            ))}
          </div>
        </div>

        {/* Arrowheads for lines */}
        {(appState.activeTool === 'line' || (selectedElementId && elements.find(e => e.id === selectedElementId)?.type === 'line')) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Arrowheads</span>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button 
                className={`tool-btn ${appState.startArrowhead === 'arrow' ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleStartArrowToggle}
                style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
              >
                Start
              </button>
              <button 
                className={`tool-btn ${appState.endArrowhead === 'arrow' ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleEndArrowToggle}
                style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
              >
                End
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Toolbar: Zoom & Undo/Redo */}
      <div className="ui-panel toolbar-bottom">
        <button className="tool-btn" onClick={handleZoomOut} title="Zoom Out">
          <MinusCircle size={20} />
        </button>
        <span style={{ fontSize: '14px', margin: '0 8px', fontWeight: 500, minWidth: '40px', textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button className="tool-btn" onClick={handleZoomIn} title="Zoom In">
          <PlusCircle size={20} />
        </button>
        <div style={{ width: '1px', height: '20px', background: 'var(--panel-border)', margin: '0 4px' }} />
        <button className="tool-btn" title="Undo">
          <RotateCcw size={20} />
        </button>
        <button className="tool-btn" title="Redo">
          <RotateCw size={20} />
        </button>
      </div>
    </div>
  );
}

export default App;
