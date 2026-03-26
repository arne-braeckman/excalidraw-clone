import React, { useEffect } from 'react';
import { useStore } from '../store';
import type { BoardMeta } from '../store';
import { get, set } from 'idb-keyval';
import { Plus, LogOut, FileEdit } from 'lucide-react';

export const Dashboard: React.FC = () => {
    const { currentUser, boards, setBoards, setCurrentBoard, setElements, setCurrentUser } = useStore();

    useEffect(() => {
        if (currentUser) {
            get(`user-${currentUser}-boards`).then((savedBoards) => {
                if (savedBoards && savedBoards.length > 0) {
                    setBoards(savedBoards);
                } else {
                    get('excalidraw-elements').then((legacy) => {
                       if (legacy && legacy.length > 0) {
                           const legacyBoard = { id: 'legacy', name: 'Legacy Board', lastModified: Date.now() };
                           setBoards([legacyBoard]);
                           set(`user-${currentUser}-boards`, [legacyBoard]);
                           set('board-legacy', legacy);
                       }
                    });
                }
            });
        }
    }, [currentUser, setBoards]);

    const handleCreateBoard = () => {
        const newBoard: BoardMeta = {
            id: window.crypto.randomUUID(),
            name: "Untitled Board",
            lastModified: Date.now()
        };
        const newBoards = [...boards, newBoard];
        setBoards(newBoards);
        set(`user-${currentUser}-boards`, newBoards);
        
        setElements([]);
        setCurrentBoard(newBoard.id, newBoard.name);
    };

    const handleOpenBoard = (board: BoardMeta) => {
        get(`board-${board.id}`).then((elements) => {
            setElements(elements || []);
            setCurrentBoard(board.id, board.name);
        });
    };

    const handleLogout = () => {
        localStorage.removeItem('excalidraw-user');
        setCurrentUser(null);
        setCurrentBoard(null, '');
    };

    return (
        <div style={{ padding: '48px', width: '100vw', height: '100vh', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}>
                <h1 style={{margin: 0, fontSize: '36px'}}>Good to see you, {currentUser}.</h1>
                <button onClick={handleLogout} className="tool-btn" style={{ width: 'auto', padding: '8px 16px', border: '1px solid var(--panel-border)' }}><LogOut size={16} /><span style={{marginLeft: '8px'}}>Logout</span></button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '32px' }}>
                <div 
                    onClick={handleCreateBoard}
                    style={{ background: 'var(--panel-bg)', border: '2px dashed var(--accent-color)', borderRadius: '12px', height: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '16px', transition: '0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                >
                    <Plus size={48} color="var(--accent-color)" />
                    <span style={{ fontWeight: 'bold', fontSize: '18px', color: 'var(--accent-color)' }}>Initialize New Board</span>
                </div>
                {boards.map(b => (
                    <div 
                        key={b.id}
                        onClick={() => handleOpenBoard(b)}
                        style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '12px', height: '220px', padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    >
                        <FileEdit size={32} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
                        <h3 style={{ margin: 0, marginBottom: '8px', fontSize: '20px' }}>{b.name}</h3>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: 'auto', fontWeight: 600 }}>Last modified: {new Date(b.lastModified).toLocaleString()}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
