import React, { useEffect, useRef, useState } from 'react';
import { useStore, type ExcalidrawElement } from '../store';
import rough from 'roughjs/bin/rough';

export const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { elements, appState, setAppState, setElements } = useStore();
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<ExcalidrawElement | null>(null);
  const [textInput, setTextInput] = useState<{x: number, y: number} | null>(null);
  
  const selectedElementId = appState.selectedElementId;
  const [dragOffset, setDragOffset] = useState<{x: number, y: number} | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;

      ctx.scale(ratio, ratio);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      
      ctx.translate(appState.scrollX, appState.scrollY);
      ctx.scale(appState.zoom, appState.zoom);

      const rc = rough.canvas(canvas);

      const drawElement = (el: ExcalidrawElement) => {
        const options = {
          stroke: el.strokeColor,
          fill: el.backgroundColor === 'transparent' ? undefined : el.backgroundColor,
          strokeWidth: el.strokeWidth,
          roughness: el.roughness,
          fillStyle: el.fillStyle
        };
        
        if (el.type === 'rectangle') {
          rc.rectangle(el.x, el.y, el.width, el.height, options);
        } else if (el.type === 'ellipse') {
          rc.ellipse(el.x + el.width/2, el.y + el.height/2, Math.abs(el.width), Math.abs(el.height), options);
        } else if (el.type === 'line') {
          const pts = el.points || [];
          if (pts.length > 0) {
            const last = pts[pts.length - 1];
            rc.line(el.x, el.y, last.x, last.y, options);
          }
        } else if (el.type === 'pencil') {
          const pts = el.points || [];
          if (pts.length > 1) {
            rc.curve(pts.map(p => [p.x, p.y]), options);
          }
        } else if (el.type === 'text') {
          ctx.font = `24px var(--font-draw)`;
          ctx.fillStyle = el.strokeColor;
          ctx.fillText(el.text || '', el.x, el.y + 24);
        }

        // Draw selection box
        if (el.id === selectedElementId) {
          ctx.strokeStyle = '#6965db';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          let minX = el.x, minY = el.y, maxW = el.width, maxH = el.height;
          
          if (el.type === 'line' || el.type === 'pencil') {
            let lMinX = Infinity, lMaxX = -Infinity, lMinY = Infinity, lMaxY = -Infinity;
            (el.points || []).forEach(p => {
              lMinX = Math.min(lMinX, p.x); lMaxX = Math.max(lMaxX, p.x);
              lMinY = Math.min(lMinY, p.y); lMaxY = Math.max(lMaxY, p.y);
            });
            minX = lMinX; minY = lMinY; maxW = lMaxX - lMinX; maxH = lMaxY - lMinY;
          } else if (el.type === 'text') {
            maxW = (el.text?.length || 0) * 14; 
            maxH = 28;
          } else {
             minX = Math.min(el.x, el.x + el.width);
             minY = Math.min(el.y, el.y + el.height);
             maxW = Math.abs(el.width);
             maxH = Math.abs(el.height);
          }

          ctx.strokeRect(minX - 4, minY - 4, maxW + 8, maxH + 8);
          ctx.setLineDash([]);

          // Draw resize handle
          if (el.type === 'rectangle' || el.type === 'ellipse') {
             ctx.fillStyle = '#ffffff';
             ctx.fillRect(minX + maxW - 4, minY + maxH - 4, 8, 8);
             ctx.strokeRect(minX + maxW - 4, minY + maxH - 4, 8, 8);
          }
        }
      };
      
      elements.forEach(drawElement);
      if (currentElement) {
        drawElement(currentElement);
      }

      ctx.restore();
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [elements, currentElement, appState.zoom, appState.scrollX, appState.scrollY, selectedElementId]);

  const getPointerCoords = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    let clientX = 0, clientY = 0;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.PointerEvent).clientX;
      clientY = (e as React.PointerEvent).clientY;
    }
    const x = (clientX - rect.left - appState.scrollX) / appState.zoom;
    const y = (clientY - rect.top - appState.scrollY) / appState.zoom;
    return { x, y };
  };

  const isPointInElement = (x: number, y: number, el: ExcalidrawElement) => {
    let minX = Math.min(el.x, el.x + el.width);
    let maxX = Math.max(el.x, el.x + el.width);
    let minY = Math.min(el.y, el.y + el.height);
    let maxY = Math.max(el.y, el.y + el.height);
    
    if (el.type === 'line' || el.type === 'pencil') {
      let lMinX = Infinity, lMaxX = -Infinity, lMinY = Infinity, lMaxY = -Infinity;
      (el.points || []).forEach(p => {
        lMinX = Math.min(lMinX, p.x); lMaxX = Math.max(lMaxX, p.x);
        lMinY = Math.min(lMinY, p.y); lMaxY = Math.max(lMaxY, p.y);
      });
      minX = lMinX; maxX = lMaxX; minY = lMinY; maxY = lMaxY;
    } else if (el.type === 'text') {
      maxX = el.x + (el.text?.length || 0) * 14;
      maxY = el.y + 28;
    }
    
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  };

  const isPointInResizeHandle = (x: number, y: number, el: ExcalidrawElement) => {
    if (el.type === 'text' || el.type === 'pencil' || el.type === 'line') return false; 
    const maxX = Math.max(el.x, el.x + el.width);
    const maxY = Math.max(el.y, el.y + el.height);
    return x >= maxX - 6 && x <= maxX + 6 && y >= maxY - 6 && y <= maxY + 6;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; 
    const { x, y } = getPointerCoords(e);

    if (appState.activeTool === 'select') {
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.id === selectedElementId && isPointInResizeHandle(x, y, el)) {
          setIsResizing(true);
          setIsDrawing(true);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }

        if (isPointInElement(x, y, el)) {
          setAppState({ selectedElementId: el.id });
          setDragOffset({ x: x - el.x, y: y - el.y });
          setIsDrawing(true); 
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }
      }
      setAppState({ selectedElementId: null });
      return;
    }

    if (appState.activeTool === 'text') {
      setTextInput({ x, y });
      return;
    }

    const id = window.crypto.randomUUID();
    const newElement: ExcalidrawElement = {
      id,
      type: appState.activeTool,
      x,
      y,
      width: 0,
      height: 0,
      strokeColor: appState.strokeColor, 
      backgroundColor: appState.backgroundColor,
      fillStyle: appState.fillStyle,
      strokeWidth: appState.strokeWidth,
      roughness: appState.roughness,
      points: [{x, y}],
    };
    
    setCurrentElement(newElement);
    setIsDrawing(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const { x, y } = getPointerCoords(e);
    
    if (appState.activeTool === 'select' && selectedElementId) {
      if (isResizing) {
         setElements(prev => prev.map(el => {
           if (el.id === selectedElementId) {
             return { ...el, width: x - el.x, height: y - el.y };
           }
           return el;
         }));
         return;
      }
      
      if (dragOffset) {
        setElements(prev => prev.map(el => {
          if (el.id === selectedElementId) {
             const dx = x - dragOffset.x - el.x;
             const dy = y - dragOffset.y - el.y;
             let newPoints = el.points;
             if (newPoints) {
                 newPoints = newPoints.map(p => ({ x: p.x + dx, y: p.y + dy }));
             }
             return { ...el, x: x - dragOffset.x, y: y - dragOffset.y, points: newPoints };
          }
          return el;
        }));
      }
      return;
    }

    // Drawing new element
    if (currentElement) {
      if (currentElement.type === 'pencil') {
        setCurrentElement({
          ...currentElement,
          points: [...(currentElement.points || []), {x, y}],
          width: Math.abs(x - currentElement.x),
          height: Math.abs(y - currentElement.y)
        });
      } else if (currentElement.type === 'line') {
        setCurrentElement({
          ...currentElement,
          points: [{x: currentElement.x, y: currentElement.y}, {x, y}],
          width: Math.abs(x - currentElement.x),
          height: Math.abs(y - currentElement.y)
        });
      } else {
        setCurrentElement({
          ...currentElement,
          width: x - currentElement.x,
          height: y - currentElement.y
        });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDrawing(false);
    setIsResizing(false);

    if (appState.activeTool === 'select') return;

    if (!currentElement) return;
    
    if (
      currentElement.type !== 'pencil' && 
      currentElement.type !== 'text' && 
      Math.abs(currentElement.width) < 2 && 
      Math.abs(currentElement.height) < 2
    ) {
      setCurrentElement(null);
      return;
    }

    setElements((prev) => [...prev, currentElement]);
    setCurrentElement(null);
    setAppState({ activeTool: 'select', selectedElementId: currentElement.id }); 
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const newZoom = appState.zoom - e.deltaY * zoomSensitivity;
      setAppState({ zoom: Math.min(Math.max(0.1, newZoom), 10) });
    } else {
      setAppState({ 
        scrollX: appState.scrollX - e.deltaX,
        scrollY: appState.scrollY - e.deltaY,
      });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
       if ((e.key === 'Backspace' || e.key === 'Delete') && selectedElementId && !textInput) {
           setElements(prev => prev.filter(el => el.id !== selectedElementId));
           setAppState({ selectedElementId: null });
       }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, setElements, textInput, setAppState]);

  return (
    <React.Fragment>
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: 'none', display: 'block' }}
      />
      {textInput && (
        <input
          autoFocus
          style={{
            position: 'absolute',
            left: `${textInput.x * appState.zoom + appState.scrollX}px`, 
            top: `${textInput.y * appState.zoom + appState.scrollY}px`,
            font: `${24 * appState.zoom}px var(--font-draw)`,
            margin: 0,
            padding: 0,
            border: 0,
            outline: 0,
            background: 'transparent',
            color: 'var(--text-main)',
            transformOrigin: 'left top',
            whiteSpace: 'pre',
          }}
          onBlur={(e) => {
            if (e.target.value.trim()) {
              const id = window.crypto.randomUUID();
              setElements(prev => [...prev, {
                id, type: 'text', x: textInput.x, y: textInput.y, width: 0, height: 0,
                strokeColor: appState.strokeColor, backgroundColor: 'transparent', fillStyle: 'solid',
                strokeWidth: 1, roughness: 1, text: e.target.value
              }]);
              setAppState({ selectedElementId: id });
            }
            setTextInput(null);
            setAppState({ activeTool: 'select' });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
                setTextInput(null);
                setAppState({ activeTool: 'select' });
            }
          }}
        />
      )}
    </React.Fragment>
  );
};
