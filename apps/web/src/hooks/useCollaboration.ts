import { useEffect, useState, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { StickyNoteData, Cursor } from '../types';

// Generate a random user color
const getRandomColor = () => {
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Generate a random username
const getRandomName = () => {
  const adjectives = ['Happy', 'Clever', 'Swift', 'Bright', 'Calm', 'Bold', 'Kind', 'Wise'];
  const nouns = ['Panda', 'Eagle', 'Fox', 'Owl', 'Tiger', 'Bear', 'Wolf', 'Hawk'];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
};

// Get or create persistent user info
const getUserInfo = () => {
  const stored = localStorage.getItem('co-canvas-user');
  if (stored) {
    return JSON.parse(stored);
  }
  const userInfo = {
    id: crypto.randomUUID(),
    name: getRandomName(),
    color: getRandomColor(),
  };
  localStorage.setItem('co-canvas-user', JSON.stringify(userInfo));
  return userInfo;
};

interface UseCollaborationOptions {
  roomName?: string;
  wsUrl?: string;
}

interface UseCollaborationReturn {
  notes: StickyNoteData[];
  cursors: Cursor[];
  isConnected: boolean;
  isSynced: boolean;
  userInfo: { id: string; name: string; color: string };
  addNote: (note: StickyNoteData) => void;
  updateNote: (id: string, updates: Partial<StickyNoteData>) => void;
  updateNotes: (updates: Array<{ id: string; updates: Partial<StickyNoteData> }>) => void;
  deleteNote: (id: string) => void;
  updateCursor: (x: number, y: number) => void;
  setUserName: (name: string) => void;
}

export function useCollaboration(options: UseCollaborationOptions = {}): UseCollaborationReturn {
  const defaultWsUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
    : 'ws://localhost:1234';
  const { roomName = 'co-canvas', wsUrl = defaultWsUrl } = options;

  const [notes, setNotes] = useState<StickyNoteData[]>([]);
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [userInfo, setUserInfo] = useState(getUserInfo);

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const notesMapRef = useRef<Y.Map<StickyNoteData> | null>(null);

  // Initialize Yjs
  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Create the shared notes map
    const notesMap = ydoc.getMap<StickyNoteData>('notes');
    notesMapRef.current = notesMap;

    // Set up IndexedDB persistence for offline support
    const indexeddbProvider = new IndexeddbPersistence(roomName, ydoc);
    indexeddbProvider.on('synced', () => {
      console.log('📦 IndexedDB synced');
    });

    // Set up WebSocket provider for real-time sync
    const wsProvider = new WebsocketProvider(wsUrl, roomName, ydoc);
    providerRef.current = wsProvider;

    // Handle connection status
    wsProvider.on('status', (event: { status: string }) => {
      console.log('🔌 WebSocket status:', event.status);
      setIsConnected(event.status === 'connected');
    });

    wsProvider.on('sync', (synced: boolean) => {
      console.log('🔄 Sync status:', synced);
      setIsSynced(synced);
    });

    // Set up awareness (cursors)
    const awareness = wsProvider.awareness;
    
    // Set local user state
    awareness.setLocalStateField('user', userInfo);

    // Observe notes changes
    const updateNotes = () => {
      const notesArray: StickyNoteData[] = [];
      notesMap.forEach((note, id) => {
        notesArray.push({ ...note, id });
      });
      setNotes(notesArray);
    };

    notesMap.observe(updateNotes);
    updateNotes(); // Initial load

    // Observe awareness (cursor) changes
    const updateCursors = () => {
      const cursorList: Cursor[] = [];
      awareness.getStates().forEach((state, clientId) => {
        // Skip our own cursor
        if (clientId === awareness.clientID) return;
        
        if (state.user && state.cursor) {
          cursorList.push({
            id: state.user.id,
            name: state.user.name,
            x: state.cursor.x,
            y: state.cursor.y,
            color: state.user.color,
          });
        }
      });
      setCursors(cursorList);
    };

    awareness.on('change', updateCursors);
    updateCursors(); // Initial load

    // Cleanup
    return () => {
      notesMap.unobserve(updateNotes);
      awareness.off('change', updateCursors);
      wsProvider.destroy();
      indexeddbProvider.destroy();
      ydoc.destroy();
    };
  }, [roomName, wsUrl, userInfo.id]);

  // Add a new note
  const addNote = useCallback((note: StickyNoteData) => {
    const notesMap = notesMapRef.current;
    if (!notesMap) return;
    
    notesMap.set(note.id, note);
  }, []);

  // Update an existing note
  const updateNote = useCallback((id: string, updates: Partial<StickyNoteData>) => {
    const notesMap = notesMapRef.current;
    if (!notesMap) return;

    const existingNote = notesMap.get(id);
    if (existingNote) {
      notesMap.set(id, { ...existingNote, ...updates });
    }
  }, []);

  // Batch update multiple notes (for Smart Tidy animation)
  const updateNotes = useCallback((updates: Array<{ id: string; updates: Partial<StickyNoteData> }>) => {
    const notesMap = notesMapRef.current;
    const ydoc = ydocRef.current;
    if (!notesMap || !ydoc) return;

    // Use a transaction for batch updates
    ydoc.transact(() => {
      for (const { id, updates: noteUpdates } of updates) {
        const existingNote = notesMap.get(id);
        if (existingNote) {
          notesMap.set(id, { ...existingNote, ...noteUpdates });
        }
      }
    });
  }, []);

  // Delete a note
  const deleteNote = useCallback((id: string) => {
    const notesMap = notesMapRef.current;
    if (!notesMap) return;

    notesMap.delete(id);
  }, []);

  // Update cursor position
  const updateCursor = useCallback((x: number, y: number) => {
    const provider = providerRef.current;
    if (!provider) return;

    provider.awareness.setLocalStateField('cursor', { x, y });
  }, []);

  // Update user name
  const setUserName = useCallback((name: string) => {
    const newUserInfo = { ...userInfo, name };
    setUserInfo(newUserInfo);
    localStorage.setItem('co-canvas-user', JSON.stringify(newUserInfo));
    
    const provider = providerRef.current;
    if (provider) {
      provider.awareness.setLocalStateField('user', newUserInfo);
    }
  }, [userInfo]);

  return {
    notes,
    cursors,
    isConnected,
    isSynced,
    userInfo,
    addNote,
    updateNote,
    updateNotes,
    deleteNote,
    updateCursor,
    setUserName,
  };
}
