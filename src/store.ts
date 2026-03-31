import { create } from 'zustand';

export type ElementType = 'select' | 'rectangle' | 'ellipse' | 'line' | 'pencil' | 'text' | 'image';

export interface BoardMeta {
  id: string;
  name: string;
  lastModified: number;
}

export interface CanvasElement {
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
  text?: string; 
  fontFamily?: string;
  fontSize?: number;
  startBinding?: string | null;
  endBinding?: string | null;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  seed: number;
  dataUrl?: string;
}

export type AppTheme = 'light' | 'dark' | 'neon' | 'monokai' | 'nord';

export interface AppState {
  theme: AppTheme;
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
  fontFamily: string;
  fontSize: number;
  startArrowhead: string | null;
  endArrowhead: string | null;
}

export interface StoreState {
  elements: CanvasElement[];
  clipboard: CanvasElement | null;
  appState: AppState;
  currentUser: string | null;
  boards: BoardMeta[];
  currentBoardId: string | null;
  currentBoardName: string;
  setElements: (elements: CanvasElement[] | ((prev: CanvasElement[]) => CanvasElement[])) => void;
  setClipboard: (element: CanvasElement | null) => void;
  setAppState: (state: Partial<AppState>) => void;
  setCurrentUser: (user: string | null) => void;
  setBoards: (boards: BoardMeta[] | ((prev: BoardMeta[]) => BoardMeta[])) => void;
  setCurrentBoard: (id: string | null, name: string) => void;
  setActiveTool: (tool: ElementType) => void;
}

export const useStore = create<StoreState>((set) => ({
  elements: [],
  clipboard: null,
  appState: {
    theme: 'light',
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
    fontFamily: 'Caveat, cursive',
    fontSize: 24,
    startArrowhead: null,
    endArrowhead: 'arrow',
  },
  currentUser: null,
  boards: [],
  currentBoardId: null,
  currentBoardName: '',
  setElements: (updater) => set((state) => ({ 
    elements: typeof updater === 'function' ? updater(state.elements) : updater 
  })),
  setClipboard: (element) => set({ clipboard: element }),
  setAppState: (state) => set((prev) => ({ appState: { ...prev.appState, ...state } })),
  setCurrentUser: (user) => set({ currentUser: user }),
  setBoards: (updater) => set((state) => ({ boards: typeof updater === 'function' ? updater(state.boards) : updater })),
  setCurrentBoard: (id, name) => set({ currentBoardId: id, currentBoardName: name }),
  setActiveTool: (tool) => set((state) => ({
    appState: { ...state.appState, activeTool: tool, selectedElementId: null }
  })),
}));
