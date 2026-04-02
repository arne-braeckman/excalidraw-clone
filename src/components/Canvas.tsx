import React, { useEffect, useRef, useState } from 'react';
import { useStore, type CanvasElement } from '../store';
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
  const { elements, appState, setAppState, setElements, clipboard, setClipboard } = useStore();
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<CanvasElement | null>(null);
  const [textInput, setTextInput] = useState<TextInputState | null>(null);
  
  const selectedElementIds = appState.selectedElementIds || [];
  const [lastPointerPos, setLastPointerPos] = useState<{x: number, y: number} | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [draggingLinePoint, setDraggingLinePoint] = useState<number | null>(null);
  const [connectorTarget, setConnectorTarget] = useState<{ elementId: string; point: { x: number; y: number } } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; x: number; y: number } | null>(null);

  const CONNECTOR_SNAP_DISTANCE = 30;

  const getConnectorPoints = (el: CanvasElement): { x: number; y: number }[] => {
    if (el.type === 'line' || el.type === 'pencil' || el.type === 'text') return [];
    const minX = Math.min(el.x, el.x + el.width);
    const minY = Math.min(el.y, el.y + el.height);
    const w = Math.abs(el.width);
    const h = Math.abs(el.height);
    
    const points: { x: number; y: number }[] = [];
    
    let hSegments = Math.floor(w / 40);
    if (hSegments < 2) hSegments = 2;
    if (hSegments % 2 !== 0) hSegments += 1;

    let vSegments = Math.floor(h / 40);
    if (vSegments < 2) vSegments = 2;
    if (vSegments % 2 !== 0) vSegments += 1;

    // Top & Bottom edges
    for (let i = 0; i <= hSegments; i++) {
        const x = minX + (w * i) / hSegments;
        points.push({ x, y: minY });         // Top
        points.push({ x, y: minY + h });     // Bottom
    }

    // Left & Right edges (exclude corners to avoid duplicates)
    for (let i = 1; i < vSegments; i++) {
        const y = minY + (h * i) / vSegments;
        points.push({ x: minX, y });         // Left
        points.push({ x: minX + w, y });     // Right
    }

    return points;
  };

  const findNearestConnector = (px: number, py: number, excludeId?: string): { elementId: string; point: { x: number; y: number } } | null => {
    let best: { elementId: string; point: { x: number; y: number }; dist: number } | null = null;
    for (const el of elements) {
      if (el.id === excludeId) continue;
      if (el.type === 'line' || el.type === 'pencil' || el.type === 'text') continue;
      const connectors = getConnectorPoints(el);
      for (const cp of connectors) {
        const dist = Math.hypot(px - cp.x, py - cp.y);
        if (dist < CONNECTOR_SNAP_DISTANCE && (!best || dist < best.dist)) {
          best = { elementId: el.id, point: cp, dist };
        }
      }
    }
    return best ? { elementId: best.elementId, point: best.point } : null;
  };

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

      const drawElement = (el: CanvasElement) => {
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
        if (selectedElementIds.includes(el.id) && !textInput) {
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

      // Draw selection box
      if (selectionBox) {
        const sx = Math.min(selectionBox.startX, selectionBox.x);
        const sy = Math.min(selectionBox.startY, selectionBox.y);
        const sw = Math.abs(selectionBox.x - selectionBox.startX);
        const sh = Math.abs(selectionBox.y - selectionBox.startY);
        ctx.fillStyle = 'rgba(105, 101, 219, 0.08)';
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeStyle = '#6965db';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.setLineDash([]);
      }

      // Draw connector spots on target element
      if (connectorTarget) {
        const targetEl = elements.find(e => e.id === connectorTarget.elementId);
        if (targetEl) {
          const connectors = getConnectorPoints(targetEl);
          connectors.forEach(cp => {
            const isSnapped = cp.x === connectorTarget.point.x && cp.y === connectorTarget.point.y;
            ctx.beginPath();
            ctx.arc(cp.x, cp.y, isSnapped ? 6 : 4, 0, Math.PI * 2);
            ctx.fillStyle = isSnapped ? '#6965db' : 'rgba(105, 101, 219, 0.4)';
            ctx.fill();
            ctx.strokeStyle = '#6965db';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          });
        }
      }

      ctx.restore();
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [elements, currentElement, appState.zoom, appState.scrollX, appState.scrollY, selectedElementIds, textInput, connectorTarget, selectionBox]);

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

  const isPointInElement = (x: number, y: number, el: CanvasElement) => {
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

  const isPointInResizeHandle = (x: number, y: number, el: CanvasElement) => {
    if (el.type === 'text' || el.type === 'pencil' || el.type === 'line') return false; 
    const maxX = Math.max(el.x, el.x + el.width);
    const maxY = Math.max(el.y, el.y + el.height);
    return x >= maxX - 6 && x <= maxX + 6 && y >= maxY - 6 && y <= maxY + 6;
  };

  const getLineHandleClicked = (x: number, y: number, el: CanvasElement) => {
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

    if (textInput) {
       return;
    }

    // Spacebar panning or middle-click
    if (spaceHeld) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    const { x, y } = getPointerCoords(e);

    if (appState.activeTool === 'select') {
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (selectedElementIds.length === 1 && selectedElementIds[0] === el.id && el.type === 'line') {
          const handleIdx = getLineHandleClicked(x, y, el);
          if (handleIdx !== null) {
            setDraggingLinePoint(handleIdx);
            setIsDrawing(true);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            return;
          }
        }

        if (selectedElementIds.length === 1 && selectedElementIds[0] === el.id && isPointInResizeHandle(x, y, el)) {
          setIsResizing(true);
          setIsDrawing(true);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }

        if (isPointInElement(x, y, el)) {
          if (e.shiftKey) {
             setAppState({
                 selectedElementIds: selectedElementIds.includes(el.id)
                     ? selectedElementIds.filter(id => id !== el.id)
                     : [...selectedElementIds, el.id]
             });
          } else {
             if (!selectedElementIds.includes(el.id)) {
                 setAppState({ selectedElementIds: [el.id] });
             }
          }
          setLastPointerPos({ x, y });
          setIsDrawing(true);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }
      }
      // No element hit — start selection box
      setAppState({ selectedElementIds: [] });
      setSelectionBox({ startX: x, startY: y, x, y });
      setIsDrawing(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (appState.activeTool === 'text') {
      e.preventDefault();
      setTextInput({ x, y });
      return;
    }

    const id = window.crypto.randomUUID();
    let startX = x, startY = y;
    if (appState.activeTool === 'line') {
      const snap = findNearestConnector(x, y);
      if (snap) {
        startX = snap.point.x;
        startY = snap.point.y;
        setConnectorTarget(snap);
      }
    }
    const newElement: CanvasElement = {
      id,
      type: appState.activeTool,
      x: startX,
      y: startY,
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
      points: [{x: startX, y: startY}],
      seed: Math.floor(Math.random() * 100000000),
    };
    
    setCurrentElement(newElement);
    setIsDrawing(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Handle panning
    if (isPanning && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setAppState({
        scrollX: appState.scrollX + dx,
        scrollY: appState.scrollY + dy,
      });
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (!isDrawing) return;
    const { x, y } = getPointerCoords(e);
    
    if (appState.activeTool === 'select' && selectionBox) {
      setSelectionBox({ ...selectionBox, x, y });
      return;
    }

    if (appState.activeTool === 'select' && selectedElementIds.length > 0) {
      if (draggingLinePoint !== null && selectedElementIds.length === 1) {
         const isEndpoint = draggingLinePoint === 0 || draggingLinePoint === 2;
         const snap = isEndpoint ? findNearestConnector(x, y, selectedElementIds[0]) : null;
         setConnectorTarget(snap);
         const snapX = snap ? snap.point.x : x;
         const snapY = snap ? snap.point.y : y;

         setElements(prev => prev.map(el => {
            if (el.id === selectedElementIds[0] && el.type === 'line' && el.points) {
               let newPoints = [...el.points];
               if (newPoints.length === 2 && draggingLinePoint === 1) {
                   newPoints = [newPoints[0], {x, y}, newPoints[1]];
               } else if (newPoints.length === 3) {
                   newPoints[draggingLinePoint] = isEndpoint ? {x: snapX, y: snapY} : {x, y};
               } else if (newPoints.length === 2) {
                   if (draggingLinePoint === 0) newPoints[0] = {x: snapX, y: snapY};
                   if (draggingLinePoint === 2) newPoints[1] = {x: snapX, y: snapY};
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

      if (isResizing && selectedElementIds.length === 1) {
         setElements(prev => prev.map(el => {
           if (el.id === selectedElementIds[0]) {
             return { ...el, width: x - el.x, height: y - el.y };
           }
           return el;
         }));
         return;
      }
      
      if (lastPointerPos) {
         const dx = x - lastPointerPos.x;
         const dy = y - lastPointerPos.y;
         if (dx === 0 && dy === 0) return;

         setElements(prev => {
           return prev.map(el => {
             if (selectedElementIds.includes(el.id)) {
                 let newPoints = el.points;
                 if (newPoints) {
                     newPoints = newPoints.map(p => ({ x: p.x + dx, y: p.y + dy }));
                 }
                 return { ...el, x: el.x + dx, y: el.y + dy, points: newPoints };
             }
             if (el.type === 'line') {
                 let updated = false;
                 let p = el.points ? [...el.points] : [];
                 if (el.startBinding && selectedElementIds.includes(el.startBinding) && p.length > 0) {
                     // Find the moved bound element and snap to its nearest connector
                     const boundEl = prev.find(e => e.id === el.startBinding);
                     if (boundEl) {
                       const movedEl = { ...boundEl, x: boundEl.x + dx, y: boundEl.y + dy };
                       const connectors = getConnectorPoints(movedEl);
                       const endPt = p[p.length - 1];
                       let nearest = connectors[0];
                       let nearestDist = Infinity;
                       for (const cp of connectors) {
                         const d = Math.hypot(endPt.x - cp.x, endPt.y - cp.y);
                         if (d < nearestDist) { nearestDist = d; nearest = cp; }
                       }
                       p[0] = nearest;
                     } else {
                       p[0] = { x: p[0].x + dx, y: p[0].y + dy };
                     }
                     updated = true;
                 }
                 if (el.endBinding && selectedElementIds.includes(el.endBinding) && p.length > 1) {
                     const boundEl = prev.find(e => e.id === el.endBinding);
                     if (boundEl) {
                       const movedEl = { ...boundEl, x: boundEl.x + dx, y: boundEl.y + dy };
                       const connectors = getConnectorPoints(movedEl);
                       const startPt = p[0];
                       let nearest = connectors[0];
                       let nearestDist = Infinity;
                       for (const cp of connectors) {
                         const d = Math.hypot(startPt.x - cp.x, startPt.y - cp.y);
                         if (d < nearestDist) { nearestDist = d; nearest = cp; }
                       }
                       p[p.length - 1] = nearest;
                     } else {
                       p[p.length - 1] = { x: p[p.length - 1].x + dx, y: p[p.length - 1].y + dy };
                     }
                     updated = true;
                 }
                 if (updated) {
                     return { ...el, x: p[0].x, y: p[0].y, points: p, width: Math.abs(p[p.length-1].x - p[0].x), height: Math.abs(p[p.length-1].y - p[0].y) };
                 }
             }
             return el;
           });
         });
         setLastPointerPos({ x, y });
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
        const snap = findNearestConnector(x, y, currentElement.id);
        setConnectorTarget(snap);
        const endX = snap ? snap.point.x : x;
        const endY = snap ? snap.point.y : y;
        setCurrentElement({
          ...currentElement,
          points: [{x: currentElement.x, y: currentElement.y}, {x: endX, y: endY}],
          width: Math.abs(endX - currentElement.x),
          height: Math.abs(endY - currentElement.y)
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
          setAppState({ selectedElementIds: [el.id] });
        }
        return;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      return;
    }

    if (textInput) return;

    if (!isDrawing) return;
    
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDrawing(false);
    setIsResizing(false);
    setConnectorTarget(null);

    // Finalize selection box
    if (selectionBox) {
      const boxMinX = Math.min(selectionBox.startX, selectionBox.x);
      const boxMaxX = Math.max(selectionBox.startX, selectionBox.x);
      const boxMinY = Math.min(selectionBox.startY, selectionBox.y);
      const boxMaxY = Math.max(selectionBox.startY, selectionBox.y);
      const selected = elements.filter(el => {
        let elMinX: number, elMinY: number, elMaxX: number, elMaxY: number;
        if (el.type === 'line' || el.type === 'pencil') {
          const pts = el.points || [];
          elMinX = Math.min(...pts.map(p => p.x));
          elMaxX = Math.max(...pts.map(p => p.x));
          elMinY = Math.min(...pts.map(p => p.y));
          elMaxY = Math.max(...pts.map(p => p.y));
        } else {
          elMinX = Math.min(el.x, el.x + el.width);
          elMaxX = Math.max(el.x, el.x + el.width);
          elMinY = Math.min(el.y, el.y + el.height);
          elMaxY = Math.max(el.y, el.y + el.height);
        }
        return elMinX >= boxMinX && elMaxX <= boxMaxX && elMinY >= boxMinY && elMaxY <= boxMaxY;
      });
      if (selected.length > 0) {
        setAppState({ selectedElementIds: selected.map(el => el.id) });
      }
      setSelectionBox(null);
      return;
    }

    // If dragging a point on a select tool line, bind to nearest connector
    if (appState.activeTool === 'select' && draggingLinePoint !== null && selectedElementIds.length === 1) {
        const lineId = selectedElementIds[0];
        setElements(prev => {
           const el = prev.find(e => e.id === lineId);
           if (el && el.type === 'line' && el.points && el.points.length > 1) {
               let updatedEl = { ...el };
               const startP = el.points[0];
               const endP = el.points[el.points.length - 1];
               if (draggingLinePoint === 0) {
                   const snap = findNearestConnector(startP.x, startP.y, el.id);
                   updatedEl.startBinding = snap ? snap.elementId : null;
               }
               if (draggingLinePoint === 2) {
                   const snap = findNearestConnector(endP.x, endP.y, el.id);
                   updatedEl.endBinding = snap ? snap.elementId : null;
               }
               return prev.map(e => e.id === updatedEl.id ? updatedEl : e);
           }
           return prev;
        });
    }
    setDraggingLinePoint(null);

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
        const startSnap = findNearestConnector(startP.x, startP.y, finalElement.id);
        const endSnap = findNearestConnector(endP.x, endP.y, finalElement.id);
        if (startSnap) {
          finalElement.startBinding = startSnap.elementId;
          p[0] = startSnap.point;
        }
        if (endSnap) {
          finalElement.endBinding = endSnap.elementId;
          p[p.length - 1] = endSnap.point;
        }
        finalElement.points = p;
      }
    }

    setElements((prev) => [...prev, finalElement]);
    setCurrentElement(null);
    setAppState({ activeTool: 'select', selectedElementIds: [currentElement.id] }); 
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

       if (e.key === ' ' && !textInput) {
           e.preventDefault();
           setSpaceHeld(true);
           return;
       }

       if ((e.key === 'Backspace' || e.key === 'Delete') && selectedElementIds.length > 0 && !textInput) {
           setElements(prev => prev.filter(el => !selectedElementIds.includes(el.id)));
           setAppState({ selectedElementIds: [] });
       }

       if (e.key === 'Enter' && selectedElementIds.length === 1 && !textInput) {
           const el = elements.find(e => e.id === selectedElementIds[0]);
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

       // COPY
       if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && selectedElementIds.length > 0 && !textInput) {
           const copied = elements.filter(e => selectedElementIds.includes(e.id));
           if (copied.length > 0) {
               setClipboard(JSON.parse(JSON.stringify(copied)));
           }
       }

       // PASTE
       if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v' && clipboard.length > 0 && !textInput) {
           const pastedEls = clipboard.map(c => {
               const newId = window.crypto.randomUUID();
               const newEl: CanvasElement = JSON.parse(JSON.stringify(c));
               newEl.id = newId;
               newEl.x += 20;
               newEl.y += 20;
               if (newEl.points) {
                   newEl.points = newEl.points.map(p => ({ x: p.x + 20, y: p.y + 20 }));
               }
               newEl.seed = Math.floor(Math.random() * 100000000);
               return newEl;
           });
           
           setElements(prev => [...prev, ...pastedEls]);
           setAppState({ selectedElementIds: pastedEls.map(e => e.id) });
           setClipboard(pastedEls);
       }

       // DUPLICATE
       if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selectedElementIds.length > 0 && !textInput) {
           e.preventDefault(); 
           const copied = elements.filter(e => selectedElementIds.includes(e.id));
           if (copied.length > 0) {
               const dupeEls = copied.map(c => {
                   const newId = window.crypto.randomUUID();
                   const newEl: CanvasElement = JSON.parse(JSON.stringify(c));
                   newEl.id = newId;
                   newEl.x += 20;
                   newEl.y += 20;
                   if (newEl.points) {
                       newEl.points = newEl.points.map(p => ({ x: p.x + 20, y: p.y + 20 }));
                   }
                   newEl.seed = Math.floor(Math.random() * 100000000);
                   return newEl;
               });
               
               setElements(prev => [...prev, ...dupeEls]);
               setAppState({ selectedElementIds: dupeEls.map(e => e.id) });
           }
       }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
       if (e.key === ' ') {
           setSpaceHeld(false);
       }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedElementIds, elements, setElements, textInput, setAppState, clipboard, setClipboard]);

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
          cursor: isPanning ? 'grabbing' : spaceHeld ? 'grab' : appState.activeTool === 'select' ? (selectionBox ? 'crosshair' : 'default') : 'crosshair'
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
                 setAppState({ selectedElementIds: [id] });
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
