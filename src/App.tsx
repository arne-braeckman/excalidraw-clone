import { 
  Menu, Square, Circle, Minus, Type, Pencil, 
  MousePointer2, Image, MinusCircle, PlusCircle, RotateCcw, RotateCw, Download
} from 'lucide-react';
import './App.css';
import { useStore } from './store';
import { Canvas } from './components/Canvas';
import { useEffect, useState } from 'react';
import { get, set } from 'idb-keyval';

function App() {
  const { elements, appState, setActiveTool, setAppState, setElements } = useStore();
  const { activeTool, zoom, selectedElementId } = appState;
  const [loaded, setLoaded] = useState(false);

  // Load state on startup
  useEffect(() => {
    get('excalidraw-elements').then((savedElements) => {
      if (savedElements && Array.isArray(savedElements)) {
        setElements(savedElements);
      }
      setLoaded(true);
    });
  }, [setElements]);

  // Save state continuously
  useEffect(() => {
    if (loaded) {
      set('excalidraw-elements', elements);
    }
  }, [elements, loaded]);

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

  const handleExport = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'excalidraw-clone-export.png';
    link.href = dataUrl;
    link.click();
  };

  if (!loaded) return null;

  return (
    <div className="app-container">
      {/* Canvas Area */}
      <div className="canvas-container">
        <Canvas />
      </div>

      {/* Top Toolbar: Drawing Tools */}
      <div className="ui-panel toolbar-top">
        <button 
          className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => setActiveTool('select')}
          title="Select"
        >
          <MousePointer2 size={20} />
        </button>
        <button 
          className={`tool-btn ${activeTool === 'rectangle' ? 'active' : ''}`}
          onClick={() => setActiveTool('rectangle')}
          title="Rectangle"
        >
          <Square size={20} />
        </button>
        <button 
          className={`tool-btn ${activeTool === 'ellipse' ? 'active' : ''}`}
          onClick={() => setActiveTool('ellipse')}
          title="Ellipse"
        >
          <Circle size={20} />
        </button>
        <button 
          className={`tool-btn ${activeTool === 'line' ? 'active' : ''}`}
          onClick={() => setActiveTool('line')}
          title="Line"
        >
          <Minus size={20} />
        </button>
        <button 
          className={`tool-btn ${activeTool === 'pencil' ? 'active' : ''}`}
          onClick={() => setActiveTool('pencil')}
          title="Pencil"
        >
          <Pencil size={20} />
        </button>
        <button 
          className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`}
          onClick={() => setActiveTool('text')}
          title="Text"
        >
          <Type size={20} />
        </button>
        <button className="tool-btn" title="Insert Image">
          <Image size={20} />
        </button>
      </div>

      {/* Export Toolbar (Top Right) */}
      <div className="ui-panel" style={{ top: '16px', right: '16px' }}>
        <button className="tool-btn" onClick={handleExport} title="Export to PNG">
          <Download size={20} />
        </button>
      </div>

      {/* Left Toolbar: Settings / Menu / Styling */}
      <div className="ui-panel toolbar-left" style={{ alignItems: 'flex-start', padding: '16px', gap: '16px', minWidth: '150px' }}>
        <button className="tool-btn" title="Menu" style={{ alignSelf: 'center' }}>
          <Menu size={20} />
        </button>
        
        <div style={{ width: '100%', height: '1px', background: 'var(--panel-border)' }} />
        
        {/* Stroke Color */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Stroke</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00'].map(c => (
              <button 
                key={c}
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
              onClick={() => handleBgColorChange('transparent')}
              style={{ 
                width: '24px', height: '24px', borderRadius: '4px', backgroundColor: 'transparent',
                border: appState.backgroundColor === 'transparent' ? '2px solid var(--accent-color)' : '1px solid var(--panel-border)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <Minus size={14} color="var(--text-muted)" />
            </button>
            {['#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99'].map(c => (
              <button 
                key={c}
                onClick={() => handleBgColorChange(c)}
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
                onClick={() => handleFillStyle(f)}
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
                onClick={() => handleRoughness(0)}
                title="Sharp"
                style={{ width: '32px', height: '32px' }}
              >
                <Square size={16} />
            </button>
            <button 
                className={`tool-btn ${appState.roughness === 1 ? 'active' : ''}`}
                onClick={() => handleRoughness(1)}
                title="Architect"
                style={{ width: '32px', height: '32px' }}
              >
                <div style={{fontFamily: 'var(--font-draw)', fontSize: '16px'}}>~</div>
            </button>
            <button 
                className={`tool-btn ${appState.roughness === 2 ? 'active' : ''}`}
                onClick={() => handleRoughness(2)}
                title="Sloppy"
                style={{ width: '32px', height: '32px' }}
              >
                <div style={{fontFamily: 'var(--font-draw)', fontSize: '16px'}}>~~</div>
            </button>
          </div>
        </div>
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
