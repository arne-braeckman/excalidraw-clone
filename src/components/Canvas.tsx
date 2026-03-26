import React, { useEffect, useRef, useState } from 'react';
import { useStore, type ExcalidrawElement } from '../store';
import rough from 'roughjs/bin/rough';

interface TextInputState {
  x: number;
  y: number;
  targetId?: string;
  initialValue?: string;
}

export const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCache = useRef<Record<string, HTMLImageElement>>({});
  const { elements, appState, setAppState, setElements } = useStore();
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<ExcalidrawElement | null>(null);
  const [textInput, setTextInput] = useState<TextInputState | null>(null);
  
  const selectedElementId = appState.selectedElementId;
  const [dragOffset, setDragOffset] = useState<{x: number, y: number} | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [draggingLinePoint, setDraggingLinePoint] = useState<number | null>(null);

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

      const hashCode = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return Math.abs(hash);
      };

      const drawElement = (el: ExcalidrawElement) => {
        const options = {
          stroke: el.strokeColor,
          fill: el.backgroundColor === 'transparent' ? undefined : el.backgroundColor,
          strokeWidth: el.strokeWidth,
          roughness: el.roughness,
          fillStyle: el.fillStyle,
          seed: el.seed || hashCode(el.id)
        };
        
        if (el.type === 'rectangle') {
          rc.rectangle(el.x, el.y, el.width, el.height, options);
        } else if (el.type === 'ellipse') {
          rc.ellipse(el.x + el.width/2, el.y + el.height/2, Math.abs(el.width), Math.abs(el.height), options);
        } else if (el.type === 'line') {
          const pts = el.points || [];
          if (pts.length > 0) {
            const first = pts[0];
            const last = pts[pts.length - 1];
            if (pts.length === 3) {
               rc.curve([[pts[0].x, pts[0].y], [pts[1].x, pts[1].y], [pts[2].x, pts[2].y]], { ...options, curveStepCount: 16 });
            } else {
               rc.line(first.x, first.y, last.x, last.y, options);
            }
            
            const drawArrowhead = (x: number, y: number, angle: number) => {
               const size = 15;
               const p1 = { x: x - size * Math.cos(angle - Math.PI / 6), y: y - size * Math.sin(angle - Math.PI / 6) };
               const p2 = { x: x - size * Math.cos(angle + Math.PI / 6), y: y - size * Math.sin(angle + Math.PI / 6) };
               rc.line(x, y, p1.x, p1.y, options);
               rc.line(x, y, p2.x, p2.y, options);
            };

            let startAngle, endAngle;
            if (pts.length === 3) {
               startAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
               endAngle = Math.atan2(pts[2].y - pts[1].y, pts[2].x - pts[1].x);
            } else {
               startAngle = Math.atan2(last.y - first.y, last.x - first.x);
               endAngle = startAngle;
            }

            if (el.startArrowhead === 'arrow') {
               drawArrowhead(first.x, first.y, startAngle + Math.PI);
            }
            if (el.endArrowhead === 'arrow') {
               drawArrowhead(last.x, last.y, endAngle);
            }
          }
        } else if (el.type === 'pencil') {
          const pts = el.points || [];
          if (pts.length > 1) {
            rc.curve(pts.map(p => [p.x, p.y]), options);
          }
        } else if (el.type === 'text') {
          ctx.font = `${el.fontSize || 24}px ${el.fontFamily || 'Caveat, cursive'}`;
          ctx.fillStyle = el.strokeColor;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const lines = (el.text || '').split('\n');
          lines.forEach((line, i) => {
             ctx.fillText(line, el.x, el.y + i * ((el.fontSize || 24) * 1.2));
          });
        } else if (el.type === 'image' && el.dataUrl) {
           let img = imageCache.current[el.id];
           if (!img) {
               img = new window.Image();
               img.src = el.dataUrl;
               img.onload = () => {
                   setElements(prev => [...prev]);
               };
               imageCache.current[el.id] = img;
           }
           if (img.complete && img.naturalWidth > 0) {
               ctx.drawImage(img, el.x, el.y, el.width, el.height);
           }
        }

        // Draw shape attached text
        if (el.text && el.type !== 'text') {
          ctx.font = `${el.fontSize || 24}px ${el.fontFamily || 'Caveat, cursive'}`;
          ctx.fillStyle = el.strokeColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const rawLines = el.text.split('\n');
          const wrappedLines: string[] = [];
          const maxWidth = Math.max(10, Math.abs(el.width) - 20); 

          rawLines.forEach(line => {
             const words = line.split(' ');
             let currentLine = '';
             for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const testLine = currentLine + word + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && currentLine !== '') {
                   wrappedLines.push(currentLine.trimEnd());
                   currentLine = word + ' ';
                } else {
                   currentLine = testLine;
                }
             }
             wrappedLines.push(currentLine.trimEnd());
          });

          const lineHeight = (el.fontSize || 24) * 1.2;
          const totalHeight = wrappedLines.length * lineHeight;
          const startY = el.y + el.height/2 - totalHeight/2 + lineHeight/2;
          wrappedLines.forEach((line, i) => {
             ctx.fillText(line, el.x + el.width/2, startY + i * lineHeight);
          });
        }

        // Draw selection box
        if (el.id === selectedElementId && !textInput) {
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
            ctx.font = `${el.fontSize || 24}px ${el.fontFamily || 'Caveat, cursive'}`;
            const lines = (el.text || '').split('\n');
            let tMaxWidth = 0;
            lines.forEach(l => {
                tMaxWidth = Math.max(tMaxWidth, ctx.measureText(l).width);
            });
            maxW = tMaxWidth;
            maxH = lines.length * ((el.fontSize || 24) * 1.2);
          } else {
             minX = Math.min(el.x, el.x + el.width);
             minY = Math.min(el.y, el.y + el.height);
             maxW = Math.abs(el.width);
             maxH = Math.abs(el.height);
          }

          if (el.type !== 'line') {
             ctx.strokeRect(minX - 4, minY - 4, maxW + 8, maxH + 8);
          }
          ctx.setLineDash([]);

          if (el.type === 'line') {
             ctx.fillStyle = '#ffffff';
             const pts = el.points || [];
             if (pts.length === 2) {
                 const midX = (pts[0].x + pts[1].x) / 2;
                 const midY = (pts[0].y + pts[1].y) / 2;
                 [pts[0], {x: midX, y: midY}, pts[1]].forEach((p, i) => {
                     ctx.fillStyle = i === 1 ? '#e9ecef' : '#ffffff';
                     ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
                     ctx.strokeRect(p.x - 4, p.y - 4, 8, 8);
                 });
             } else if (pts.length === 3) {
                 pts.forEach((p) => {
                     ctx.fillStyle = '#ffffff';
                     ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
                     ctx.strokeRect(p.x - 4, p.y - 4, 8, 8);
                 });
             }
          } else if (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'image') {
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
  }, [elements, currentElement, appState.zoom, appState.scrollX, appState.scrollY, selectedElementId, textInput]);

  const getPointerCoords = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    let clientX = 0, clientY = 0;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.PointerEvent).clientX;
      clientY = (e as React.PointerEvent).clientY;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    const left = rect ? rect.left : 0;
    const top = rect ? rect.top : 0;
    const x = (clientX - left - appState.scrollX) / appState.zoom;
    const y = (clientY - top - appState.scrollY) / appState.zoom;
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
      let tWidth = 0;
      const ctx = canvasRef.current?.getContext('2d');
      const lines = (el.text || '').split('\n');
      if (ctx) {
         ctx.save();
         ctx.font = `${el.fontSize || 24}px ${el.fontFamily || 'Caveat, cursive'}`;
         lines.forEach(l => tWidth = Math.max(tWidth, ctx.measureText(l).width));
         ctx.restore();
      } else {
         const maxLineLength = Math.max(...lines.map(l => l.length));
         tWidth = maxLineLength * (el.fontSize || 24) * 0.6;
      }
      maxX = el.x + tWidth;
      maxY = el.y + lines.length * ((el.fontSize || 24) * 1.2);
    }
    
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  };

  const isPointInResizeHandle = (x: number, y: number, el: ExcalidrawElement) => {
    if (el.type === 'text' || el.type === 'pencil' || el.type === 'line') return false; 
    const maxX = Math.max(el.x, el.x + el.width);
    const maxY = Math.max(el.y, el.y + el.height);
    return x >= maxX - 6 && x <= maxX + 6 && y >= maxY - 6 && y <= maxY + 6;
  };

  const getLineHandleClicked = (x: number, y: number, el: ExcalidrawElement) => {
    if (el.type !== 'line' || !el.points) return null;
    const pts = el.points;
    if (pts.length === 2) {
        if (Math.abs(x - pts[0].x) <= 6 && Math.abs(y - pts[0].y) <= 6) return 0;
        if (Math.abs(x - pts[1].x) <= 6 && Math.abs(y - pts[1].y) <= 6) return 2;
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        if (Math.abs(x - midX) <= 6 && Math.abs(y - midY) <= 6) return 1;
    } else if (pts.length === 3) {
        for (let i=0; i<3; i++) {
           if (Math.abs(x - pts[i].x) <= 6 && Math.abs(y - pts[i].y) <= 6) return i;
        }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; 
    const { x, y } = getPointerCoords(e);

    if (textInput) {
       return; 
    }

    if (appState.activeTool === 'select') {
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.id === selectedElementId && el.type === 'line') {
          const handleIdx = getLineHandleClicked(x, y, el);
          if (handleIdx !== null) {
            setDraggingLinePoint(handleIdx);
            setIsDrawing(true);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            return;
          }
        }

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
      e.preventDefault();
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
      fontFamily: appState.fontFamily,
      fontSize: appState.fontSize,
      startArrowhead: appState.startArrowhead,
      endArrowhead: appState.endArrowhead,
      points: [{x, y}],
      seed: Math.floor(Math.random() * 100000000),
    };
    
    setCurrentElement(newElement);
    setIsDrawing(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const { x, y } = getPointerCoords(e);
    
    if (appState.activeTool === 'select' && selectedElementId) {
      if (draggingLinePoint !== null) {
         setElements(prev => prev.map(el => {
            if (el.id === selectedElementId && el.type === 'line' && el.points) {
               let newPoints = [...el.points];
               if (newPoints.length === 2 && draggingLinePoint === 1) {
                   newPoints = [newPoints[0], {x, y}, newPoints[1]];
               } else if (newPoints.length === 3) {
                   newPoints[draggingLinePoint] = {x, y};
               } else if (newPoints.length === 2) {
                   if (draggingLinePoint === 0) newPoints[0] = {x, y};
                   if (draggingLinePoint === 2) newPoints[1] = {x, y};
               }
               let startBinding = el.startBinding;
               let endBinding = el.endBinding;
               if (draggingLinePoint === 0) startBinding = null;
               if (draggingLinePoint === 2) endBinding = null;

               return { ...el, points: newPoints, startBinding, endBinding };
            }
            return el;
         }));
         return;
      }

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
         setElements(prev => {
           let targetEl = prev.find(e => e.id === selectedElementId);
           if (!targetEl) return prev;
           const newX = x - dragOffset.x;
           const newY = y - dragOffset.y;
           const deltaX = newX - targetEl.x;
           const deltaY = newY - targetEl.y;

           if (deltaX === 0 && deltaY === 0) return prev;

           return prev.map(el => {
             if (el.id === selectedElementId) {
                 let newPoints = el.points;
                 if (newPoints) {
                     newPoints = newPoints.map(p => ({ x: p.x + deltaX, y: p.y + deltaY }));
                 }
                 return { ...el, x: newX, y: newY, points: newPoints };
             }
             if (el.type === 'line') {
                 let updated = false;
                 let p = el.points ? [...el.points] : [];
                 if (el.startBinding === selectedElementId && p.length > 0) {
                     p[0] = { x: p[0].x + deltaX, y: p[0].y + deltaY };
                     updated = true;
                 }
                 if (el.endBinding === selectedElementId && p.length > 1) {
                     p[p.length - 1] = { x: p[p.length - 1].x + deltaX, y: p[p.length - 1].y + deltaY };
                     updated = true;
                 }
                 if (updated) {
                     return { ...el, x: p[0].x, y: p[0].y, points: p, width: Math.abs(p[p.length-1].x - p[0].x), height: Math.abs(p[p.length-1].y - p[0].y) };
                 }
             }
             return el;
           });
         });
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

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const { x, y } = getPointerCoords(e);
    
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (isPointInElement(x, y, el)) {
        if (el.type === 'text' || el.type === 'rectangle' || el.type === 'ellipse') {
          setTextInput({ 
            x: el.type === 'text' ? el.x : el.x + el.width / 2, 
            y: el.type === 'text' ? el.y : el.y + el.height / 2,
            targetId: el.id,
            initialValue: el.text || ''
          });
          setAppState({ selectedElementId: el.id });
        }
        return;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (textInput) return; // Prevent finishing draw if just closed text input

    if (!isDrawing) return;
    
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDrawing(false);
    setIsResizing(false);
    setDraggingLinePoint(null);

    // If dragging a point on a select tool line, we hit test to potentially auto-bind endpoints!
    if (appState.activeTool === 'select' && draggingLinePoint !== null && selectedElementId) {
        setElements(prev => {
           const el = prev.find(e => e.id === selectedElementId);
           if (el && el.type === 'line' && el.points && el.points.length > 1) {
               let updatedEl = { ...el };
               const startP = el.points[0];
               const endP = el.points[el.points.length - 1];
               if (draggingLinePoint === 0) {
                   const hit = prev.find(e => e.id !== el.id && e.type !== 'line' && e.type !== 'pencil' && isPointInElement(startP.x, startP.y, e));
                   updatedEl.startBinding = hit ? hit.id : null;
               }
               if (draggingLinePoint === 2) {
                   const hit = prev.find(e => e.id !== el.id && e.type !== 'line' && e.type !== 'pencil' && isPointInElement(endP.x, endP.y, e));
                   updatedEl.endBinding = hit ? hit.id : null;
               }
               return prev.map(e => e.id === updatedEl.id ? updatedEl : e);
           }
           return prev;
        });
    }

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

    let finalElement = { ...currentElement };
    if (finalElement.type === 'line') {
      const p = finalElement.points || [];
      if (p.length > 1) {
        const startP = p[0];
        const endP = p[p.length - 1];
        const startHit = elements.find(el => el.id !== finalElement.id && el.type !== 'line' && el.type !== 'pencil' && isPointInElement(startP.x, startP.y, el));
        const endHit = elements.find(el => el.id !== finalElement.id && el.type !== 'line' && el.type !== 'pencil' && isPointInElement(endP.x, endP.y, el));
        if (startHit) finalElement.startBinding = startHit.id;
        if (endHit) finalElement.endBinding = endHit.id;
      }
    }

    setElements((prev) => [...prev, finalElement]);
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
       if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
           return;
       }
       
       if ((e.key === 'Backspace' || e.key === 'Delete') && selectedElementId && !textInput) {
           setElements(prev => prev.filter(el => el.id !== selectedElementId));
           setAppState({ selectedElementId: null });
       }

       if (e.key === 'Enter' && selectedElementId && !textInput) {
           const el = elements.find(e => e.id === selectedElementId);
           if (el && el.type !== 'pencil' && el.type !== 'line') {
               setTextInput({ 
                   x: el.type === 'text' ? el.x : el.x + el.width / 2, 
                   y: el.type === 'text' ? el.y : el.y + el.height / 2,
                   targetId: el.id,
                   initialValue: el.text || ''
               });
               e.preventDefault();
           }
       }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, elements, setElements, textInput, setAppState]);

  return (
    <React.Fragment>
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        style={{ 
          touchAction: 'none', 
          display: 'block',
          cursor: appState.activeTool === 'select' ? (isDrawing ? 'grabbing' : 'grab') : 'crosshair'
        }}
      />
      {textInput && (
        <textarea
          key={textInput.targetId || 'new'}
          ref={(el) => { 
             if (el) {
                setTimeout(() => el.focus(), 10); 
                el.style.height = 'auto'; 
                el.style.height = el.scrollHeight + 'px'; 
                if (!textInput.targetId || elements.find(e => e.id === textInput.targetId)?.type === 'text') {
                    el.style.width = 'auto';
                    el.style.width = el.scrollWidth + 'px';
                }
             } 
          }}
          defaultValue={textInput.initialValue || ''}
          placeholder="Type here..."
          wrap={(textInput.targetId && elements.find(e => e.id === textInput.targetId)?.type !== 'text') ? "soft" : "off"}
          onChange={(e) => {
             e.target.style.height = 'auto';
             e.target.style.height = e.target.scrollHeight + 'px';
             if (!textInput.targetId || elements.find(el => el.id === textInput.targetId)?.type === 'text') {
                 e.target.style.width = 'auto';
                 e.target.style.width = e.target.scrollWidth + 'px';
             }
          }}
          style={{
            position: 'absolute',
            left: `${textInput.x * appState.zoom + appState.scrollX}px`, 
            top: `${textInput.y * appState.zoom + appState.scrollY}px`,
            font: `${(textInput.targetId ? (elements.find(e => e.id === textInput.targetId)?.fontSize || 24) : appState.fontSize) * appState.zoom}px ${textInput.targetId ? (elements.find(e => e.id === textInput.targetId)?.fontFamily || 'Caveat, cursive') : appState.fontFamily}`,
            margin: 0,
            padding: 0,
            border: 0,
            outline: '1px dashed #6965db',
            background: 'transparent',
            color: 'var(--text-main)',
            transformOrigin: 'left top',
            transform: (textInput.targetId && elements.find(e => e.id === textInput.targetId)?.type !== 'text') ? 'translate(-50%, -50%)' : 'none',
            textAlign: (textInput.targetId && elements.find(e => e.id === textInput.targetId)?.type !== 'text') ? 'center' : 'left',
            whiteSpace: (textInput.targetId && elements.find(e => e.id === textInput.targetId)?.type !== 'text') ? 'pre-wrap' : 'pre',
            width: (textInput.targetId && elements.find(e => e.id === textInput.targetId)?.type !== 'text') ? `${Math.max(50, Math.abs(elements.find(e => e.id === textInput.targetId)!.width) * appState.zoom - 40)}px` : undefined,
            minWidth: '10px',
            resize: 'none',
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}
          onBlur={(e) => {
            const val = e.target.value.trim();
            if (val) {
              if (textInput.targetId) {
                 setElements(prev => prev.map(el => el.id === textInput.targetId ? { ...el, text: val } : el));
              } else {
                 const id = window.crypto.randomUUID();
                 setElements(prev => [...prev, {
                   id, type: 'text', x: textInput.x, y: textInput.y, width: 0, height: 0,
                   strokeColor: appState.strokeColor, backgroundColor: 'transparent', fillStyle: 'solid',
                   strokeWidth: 1, roughness: 1, text: val,
                   fontFamily: appState.fontFamily, fontSize: appState.fontSize,
                   seed: Math.floor(Math.random() * 100000000)
                 }]);
                 setAppState({ selectedElementId: id });
              }
            } else if (textInput.targetId) {
               setElements(prev => prev.map(el => el.id === textInput.targetId ? { ...el, text: undefined } : el));
            }
            setTextInput(null);
            setAppState({ activeTool: 'select' });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.blur();
            }
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
