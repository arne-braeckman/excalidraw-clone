import { create } from 'zustand';

export type ElementType = 'select' | 'rectangle' | 'ellipse' | 'line' | 'pencil' | 'text';

export interface ExcalidrawElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  roughness: number;
  points?: { x: number; y: number }[]; // For lines and pencil
  text?: string; // For text
}

export interface AppState {
  zoom: number;
  scrollX: number;
  scrollY: number;
  activeTool: ElementType;
  selectedElementId: string | null;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  roughness: number;
}

interface StoreState {
  elements: ExcalidrawElement[];
  appState: AppState;
  setElements: (elements: ExcalidrawElement[] | ((prev: ExcalidrawElement[]) => ExcalidrawElement[])) => void;
  setAppState: (state: Partial<AppState>) => void;
  setActiveTool: (tool: ElementType) => void;
}

export const useStore = create<StoreState>((set) => ({
  elements: [],
  appState: {
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    activeTool: 'select',
    selectedElementId: null,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 1,
    roughness: 1,
  },
  setElements: (elements) => set((state) => ({
    elements: typeof elements === 'function' ? elements(state.elements) : elements
  })),
  setAppState: (newState) => set((state) => ({
    appState: { ...state.appState, ...newState }
  })),
  setActiveTool: (tool) => set((state) => ({
    appState: { ...state.appState, activeTool: tool, selectedElementId: null }
  })),
}));
