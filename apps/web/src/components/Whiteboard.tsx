import { useState, useRef, useCallback, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Text, Group } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { StickyNote } from './StickyNote';
import { Cursor } from './Cursor';
import { ClusterLabel } from './ClusterLabel';
import { useCollaboration } from '../hooks';
import {
  StickyNoteData,
  StagePosition,
  ClusterLabel as ClusterLabelData,
  TidyResponse,
  STICKY_NOTE_COLORS,
  CLUSTER_COLORS,
  DEFAULT_NOTE_WIDTH,
  DEFAULT_NOTE_HEIGHT,
} from '../types';

// Constants
const MIN_SCALE = 0.1;
const MAX_SCALE = 3;
const SCALE_BY = 1.1;
const CLUSTER_GAP = 80;
const NOTES_PER_ROW = 3;
const NOTE_SPACING = 20;

export function Whiteboard() {
  // Collaboration hook for Yjs sync
  const {
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
  } = useCollaboration();

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [stagePos, setStagePos] = useState<StagePosition>({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isEditingName, setIsEditingName] = useState(false);
  const [isTidying, setIsTidying] = useState(false);
  const [clusterLabels, setClusterLabels] = useState<ClusterLabelData[]>([]);
  
  const stageRef = useRef<Konva.Stage>(null);
  const lastClickTime = useRef(0);
  const lastClickPos = useRef({ x: 0, y: 0 });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if editing name or typing in an input/textarea
      if (isEditingName) return;
      
      const activeElement = document.activeElement;
      const isTyping = activeElement instanceof HTMLInputElement || 
                       activeElement instanceof HTMLTextAreaElement;
      if (isTyping) return;
      
      // Delete selected note
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteId) {
        deleteNote(selectedNoteId);
        setSelectedNoteId(null);
      }
      
      // Deselect on Escape
      if (e.key === 'Escape') {
        setSelectedNoteId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteId, deleteNote, isEditingName]);

  // Track mouse movement for cursor awareness
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const stage = stageRef.current;
      if (!stage) return;

      // Convert screen position to canvas position
      const canvasX = (e.clientX - stagePos.x) / stageScale;
      const canvasY = (e.clientY - stagePos.y) / stageScale;
      
      updateCursor(canvasX, canvasY);
    };

    // Throttle cursor updates to 30fps
    let lastUpdate = 0;
    const throttledMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdate > 33) { // ~30fps
        lastUpdate = now;
        handleMouseMove(e);
      }
    };

    window.addEventListener('mousemove', throttledMouseMove);
    return () => window.removeEventListener('mousemove', throttledMouseMove);
  }, [stagePos, stageScale, updateCursor]);

  // Zoom with scroll wheel
  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    // Calculate new scale
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * SCALE_BY : oldScale / SCALE_BY;
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

    setStageScale(clampedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  }, [stageScale, stagePos]);

  // Handle stage drag (panning)
  const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    // Only update position if dragging the stage itself
    if (e.target === stageRef.current) {
      setStagePos({ x: e.target.x(), y: e.target.y() });
    }
  }, []);

  // Create new sticky note on double-click
  const handleStageClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    // Only handle clicks on the stage itself (empty area)
    const clickedOnEmpty = e.target === stage;
    
    if (clickedOnEmpty) {
      // Deselect any selected note
      setSelectedNoteId(null);

      // Detect double click manually for more control
      const now = Date.now();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const timeDiff = now - lastClickTime.current;
      const posDiff = Math.sqrt(
        Math.pow(pointer.x - lastClickPos.current.x, 2) +
        Math.pow(pointer.y - lastClickPos.current.y, 2)
      );

      // Double click detected (within 300ms and 10px)
      if (timeDiff < 300 && posDiff < 10) {
        // Convert screen position to canvas position
        const canvasX = (pointer.x - stagePos.x) / stageScale;
        const canvasY = (pointer.y - stagePos.y) / stageScale;

        // Create new note centered at click position
        const newNote: StickyNoteData = {
          id: uuidv4(),
          x: canvasX - DEFAULT_NOTE_WIDTH / 2,
          y: canvasY - DEFAULT_NOTE_HEIGHT / 2,
          text: 'Double-click to edit',
          color: STICKY_NOTE_COLORS[Math.floor(Math.random() * STICKY_NOTE_COLORS.length)],
          width: DEFAULT_NOTE_WIDTH,
          height: DEFAULT_NOTE_HEIGHT,
        };

        addNote(newNote);
        setSelectedNoteId(newNote.id);
        lastClickTime.current = 0; // Reset to prevent triple-click
      } else {
        lastClickTime.current = now;
        lastClickPos.current = pointer;
      }
    }
  }, [stagePos, stageScale, addNote]);

  // Handle note selection
  const handleNoteSelect = useCallback((id: string) => {
    setSelectedNoteId(id);
  }, []);

  // Handle note text change
  const handleNoteTextChange = useCallback((id: string, text: string) => {
    updateNote(id, { text });
  }, [updateNote]);

  // Reset zoom
  const handleResetZoom = () => {
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
  };

  // Zoom in/out buttons
  const handleZoomIn = () => {
    const newScale = Math.min(MAX_SCALE, stageScale * SCALE_BY);
    setStageScale(newScale);
  };

  const handleZoomOut = () => {
    const newScale = Math.max(MIN_SCALE, stageScale / SCALE_BY);
    setStageScale(newScale);
  };

  // Smart Tidy - AI-powered clustering
  const handleSmartTidy = async () => {
    if (notes.length === 0) {
      alert('Add some notes first before using Smart Tidy!');
      return;
    }

    setIsTidying(true);
    setClusterLabels([]);

    try {
      // Send notes to the API
      const response = await fetch('/api/tidy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notes.map((n) => ({ id: n.id, text: n.text })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to cluster notes');
      }

      const data: TidyResponse = await response.json();
      
      if (!data.clusters || data.clusters.length === 0) {
        throw new Error('No clusters returned');
      }

      // Calculate positions for each cluster
      const clusterWidth = NOTES_PER_ROW * (DEFAULT_NOTE_WIDTH + NOTE_SPACING);
      let currentX = 100;
      let currentY = 100;
      let maxClusterHeight = 0;

      const noteUpdates: Array<{ id: string; updates: Partial<StickyNoteData> }> = [];
      const newLabels: ClusterLabelData[] = [];

      data.clusters.forEach((cluster, clusterIndex) => {
        // Calculate how many rows this cluster needs
        const rows = Math.ceil(cluster.noteIds.length / NOTES_PER_ROW);
        const clusterHeight = rows * (DEFAULT_NOTE_HEIGHT + NOTE_SPACING);

        // Store the label position
        newLabels.push({
          name: cluster.name,
          x: currentX,
          y: currentY,
          noteIds: cluster.noteIds,
        });

        // Position each note in the cluster in a grid
        cluster.noteIds.forEach((noteId, noteIndex) => {
          const col = noteIndex % NOTES_PER_ROW;
          const row = Math.floor(noteIndex / NOTES_PER_ROW);

          const newX = currentX + col * (DEFAULT_NOTE_WIDTH + NOTE_SPACING);
          const newY = currentY + 40 + row * (DEFAULT_NOTE_HEIGHT + NOTE_SPACING); // 40px offset for label

          noteUpdates.push({
            id: noteId,
            updates: { x: newX, y: newY },
          });
        });

        // Track max height for this row of clusters
        maxClusterHeight = Math.max(maxClusterHeight, clusterHeight + 60);

        // Move to next cluster position (horizontal first, then wrap)
        currentX += clusterWidth + CLUSTER_GAP;

        // Wrap to next row after 2 clusters
        if ((clusterIndex + 1) % 2 === 0) {
          currentX = 100;
          currentY += maxClusterHeight + CLUSTER_GAP;
          maxClusterHeight = 0;
        }
      });

      // Animate notes to new positions
      animateNotesToPositions(noteUpdates);
      setClusterLabels(newLabels);

      // Center the view on the clusters
      setTimeout(() => {
        setStageScale(0.8);
        setStagePos({ x: 50, y: 50 });
      }, 100);

    } catch (error) {
      console.error('Smart Tidy error:', error);
      alert('Failed to organize notes. Please try again.');
    } finally {
      setIsTidying(false);
    }
  };

  // Animate notes to new positions over time
  const animateNotesToPositions = (
    noteUpdates: Array<{ id: string; updates: Partial<StickyNoteData> }>
  ) => {
    const duration = 500; // ms
    const fps = 60;
    const frames = duration / (1000 / fps);
    let frame = 0;

    // Store starting positions
    const startPositions = new Map<string, { x: number; y: number }>();
    for (const { id } of noteUpdates) {
      const note = notes.find((n) => n.id === id);
      if (note) {
        startPositions.set(id, { x: note.x, y: note.y });
      }
    }

    const animate = () => {
      frame++;
      const progress = Math.min(frame / frames, 1);
      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);

      const frameUpdates = noteUpdates.map(({ id, updates }) => {
        const start = startPositions.get(id);
        if (!start || updates.x === undefined || updates.y === undefined) {
          return { id, updates };
        }

        return {
          id,
          updates: {
            x: start.x + (updates.x - start.x) * eased,
            y: start.y + (updates.y - start.y) * eased,
          },
        };
      });

      updateNotes(frameUpdates);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };

  // Clear cluster labels when notes are manually moved
  const handleNoteDragEnd = useCallback((id: string, x: number, y: number) => {
    updateNote(id, { x, y });
    // Clear labels when user manually moves notes
    if (clusterLabels.length > 0) {
      setClusterLabels([]);
    }
  }, [updateNote, clusterLabels.length]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100">
      {/* Canvas Stage */}
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        draggable
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer>
          {/* Background grid pattern */}
          <BackgroundGrid
            stagePos={stagePos}
            stageScale={stageScale}
            stageSize={stageSize}
          />

          {/* Cluster Labels */}
          {clusterLabels.map((cluster, index) => (
            <ClusterLabel
              key={cluster.name}
              cluster={cluster}
              color={CLUSTER_COLORS[index % CLUSTER_COLORS.length]}
            />
          ))}

          {/* Sticky Notes */}
          {notes.map((note) => (
            <StickyNote
              key={note.id}
              note={note}
              isSelected={selectedNoteId === note.id}
              onSelect={handleNoteSelect}
              onDragEnd={handleNoteDragEnd}
              onTextChange={handleNoteTextChange}
              stageScale={stageScale}
            />
          ))}

          {/* Other users' cursors */}
          {cursors.map((cursor) => (
            <Cursor key={cursor.id} cursor={cursor} />
          ))}
        </Layer>
      </Stage>

      {/* Smart Tidy Button */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 items-end">
        {clusterLabels.length > 0 && (
          <button
            onClick={() => setClusterLabels([])}
            className="px-4 py-2 rounded-full shadow-lg font-medium text-gray-600 bg-white hover:bg-gray-100 transition-all text-sm"
            title="Clear cluster labels"
          >
            ✕ Clear Labels
          </button>
        )}
        <button
          onClick={handleSmartTidy}
          disabled={isTidying || notes.length === 0}
          className={`px-6 py-3 rounded-full shadow-lg font-semibold text-white transition-all transform hover:scale-105 ${
            isTidying || notes.length === 0
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700'
          }`}
          title={notes.length === 0 ? 'Add notes first' : 'Organize notes using AI'}
        >
          {isTidying ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Organizing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span>✨</span>
              Smart Tidy
            </span>
          )}
        </button>
      </div>

      {/* Connection Status */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="text-xs text-gray-600 bg-white/90 px-2 py-1 rounded">
          {isConnected ? (isSynced ? 'Connected & Synced' : 'Connecting...') : 'Offline'}
        </span>
      </div>

      {/* User Info */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg px-4 py-2 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: userInfo.color }}
          />
          {isEditingName ? (
            <input
              type="text"
              defaultValue={userInfo.name}
              className="text-sm border rounded px-2 py-0.5 w-32"
              autoFocus
              onBlur={(e) => {
                if (e.target.value.trim()) {
                  setUserName(e.target.value.trim());
                }
                setIsEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const input = e.target as HTMLInputElement;
                  if (input.value.trim()) {
                    setUserName(input.value.trim());
                  }
                  setIsEditingName(false);
                } else if (e.key === 'Escape') {
                  setIsEditingName(false);
                }
              }}
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="text-sm text-gray-700 hover:text-gray-900"
              title="Click to change name"
            >
              {userInfo.name}
            </button>
          )}
        </div>
        <div className="text-xs text-gray-500">
          Notes: <span className="font-semibold text-gray-800">{notes.length}</span>
          {cursors.length > 0 && (
            <span className="ml-2">
              • {cursors.length} other{cursors.length > 1 ? 's' : ''} online
            </span>
          )}
        </div>
      </div>

      {/* UI Controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <div className="bg-white rounded-lg shadow-lg p-2 flex flex-col gap-1">
          <button
            onClick={handleZoomIn}
            className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors text-xl font-bold text-gray-700"
            title="Zoom In"
          >
            +
          </button>
          <div className="text-xs text-center text-gray-500 py-1">
            {Math.round(stageScale * 100)}%
          </div>
          <button
            onClick={handleZoomOut}
            className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors text-xl font-bold text-gray-700"
            title="Zoom Out"
          >
            −
          </button>
          <hr className="my-1" />
          <button
            onClick={handleResetZoom}
            className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors text-sm text-gray-700"
            title="Reset View"
          >
            ⌂
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg shadow-lg p-4 max-w-xs">
        <h3 className="font-semibold text-gray-800 mb-2">Controls</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Double-click</strong> canvas to add note</li>
          <li>• <strong>Drag</strong> notes to move them</li>
          <li>• <strong>Double-click</strong> note to edit text</li>
          <li>• <strong>Scroll</strong> to zoom in/out</li>
          <li>• <strong>Drag</strong> canvas to pan</li>
          <li>• <strong>Delete/Backspace</strong> to remove note</li>
        </ul>
      </div>
    </div>
  );
}

// Background grid component for visual reference
function BackgroundGrid({
  stagePos,
  stageScale,
  stageSize,
}: {
  stagePos: StagePosition;
  stageScale: number;
  stageSize: { width: number; height: number };
}) {
  const gridSize = 50;
  const dots: { x: number; y: number }[] = [];

  // Calculate visible area in canvas coordinates
  const startX = Math.floor(-stagePos.x / stageScale / gridSize) * gridSize - gridSize;
  const startY = Math.floor(-stagePos.y / stageScale / gridSize) * gridSize - gridSize;
  const endX = startX + (stageSize.width / stageScale) + gridSize * 3;
  const endY = startY + (stageSize.height / stageScale) + gridSize * 3;

  for (let x = startX; x < endX; x += gridSize) {
    for (let y = startY; y < endY; y += gridSize) {
      dots.push({ x, y });
    }
  }

  return (
    <>
      {/* Large invisible rect for visual reference only - listening disabled to allow clicks through */}
      <Rect
        name="background"
        x={startX - 10000}
        y={startY - 10000}
        width={20000 + stageSize.width / stageScale}
        height={20000 + stageSize.height / stageScale}
        fill="transparent"
        listening={false}
      />
      {/* Grid dots */}
      {dots.map((dot, i) => (
        <Circle
          key={i}
          x={dot.x}
          y={dot.y}
          radius={2 / stageScale}
          fill="#cbd5e1"
          listening={false}
        />
      ))}
      {/* Origin marker */}
      <Group x={0} y={0} listening={false}>
        <Circle radius={8} fill="#94a3b8" opacity={0.5} />
        <Text
          x={12}
          y={-6}
          text="(0,0)"
          fontSize={12}
          fill="#94a3b8"
        />
      </Group>
    </>
  );
}
