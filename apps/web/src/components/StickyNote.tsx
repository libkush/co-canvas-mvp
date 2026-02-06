import { useRef, useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import Konva from 'konva';
import { StickyNoteData } from '../types';

interface StickyNoteProps {
  note: StickyNoteData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTextChange: (id: string, text: string) => void;
  stageScale: number;
}

export function StickyNote({
  note,
  isSelected,
  onSelect,
  onDragEnd,
  onTextChange,
  stageScale,
}: StickyNoteProps) {
  const [isEditing, setIsEditing] = useState(false);
  const textRef = useRef<Konva.Text>(null);
  const groupRef = useRef<Konva.Group>(null);

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    onDragEnd(note.id, e.target.x(), e.target.y());
  };

  const handleClick = () => {
    onSelect(note.id);
  };

  const handleDoubleClick = () => {
    setIsEditing(true);

    const textNode = textRef.current;
    const stage = textNode?.getStage();
    const stageContainer = stage?.container();

    if (!textNode || !stage || !stageContainer) return;

    // Hide the text node while editing
    textNode.hide();

    // Get the position of the text node relative to the stage
    const textPosition = textNode.absolutePosition();
    const areaPosition = {
      x: stageContainer.offsetLeft + textPosition.x,
      y: stageContainer.offsetTop + textPosition.y,
    };

    // Create textarea for editing
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    textarea.value = note.text;
    textarea.style.position = 'absolute';
    textarea.style.top = `${areaPosition.y}px`;
    textarea.style.left = `${areaPosition.x}px`;
    textarea.style.width = `${(note.width - 20) * stageScale}px`;
    textarea.style.height = `${(note.height - 20) * stageScale}px`;
    textarea.style.fontSize = `${14 * stageScale}px`;
    textarea.style.border = 'none';
    textarea.style.padding = '5px';
    textarea.style.margin = '0px';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'transparent';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.fontFamily = 'Arial, sans-serif';
    textarea.style.lineHeight = '1.4';
    textarea.style.transformOrigin = 'left top';
    textarea.style.color = '#374151';
    textarea.style.zIndex = '1000';

    textarea.focus();

    let isRemoved = false;
    const removeTextarea = (saveChanges: boolean = true) => {
      if (isRemoved) return;
      isRemoved = true;
      
      if (saveChanges) {
        onTextChange(note.id, textarea.value);
      }
      textarea.remove();
      textNode.show();
      setIsEditing(false);
    };

    textarea.addEventListener('keydown', (e) => {
      // Submit on Enter (without shift), cancel on Escape
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        removeTextarea(true);
      } else if (e.key === 'Escape') {
        removeTextarea(false);
      }
    });

    textarea.addEventListener('blur', () => {
      removeTextarea(true);
    });
  };

  // Add subtle shadow effect
  const shadowProps = isSelected
    ? { shadowColor: '#3b82f6', shadowBlur: 15, shadowOpacity: 0.6 }
    : { shadowColor: 'black', shadowBlur: 8, shadowOpacity: 0.2 };

  return (
    <Group
      ref={groupRef}
      x={note.x}
      y={note.y}
      draggable
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={handleClick}
      onDblClick={handleDoubleClick}
      onDblTap={handleDoubleClick}
    >
      {/* Main sticky note background */}
      <Rect
        width={note.width}
        height={note.height}
        fill={note.color}
        cornerRadius={8}
        {...shadowProps}
      />
      
      {/* Selection border */}
      {isSelected && (
        <Rect
          width={note.width}
          height={note.height}
          stroke="#3b82f6"
          strokeWidth={3}
          cornerRadius={8}
          listening={false}
        />
      )}

      {/* Folded corner effect */}
      <Rect
        x={note.width - 20}
        y={0}
        width={20}
        height={20}
        fill={note.color}
        cornerRadius={[0, 8, 0, 0]}
      />
      <Rect
        x={note.width - 20}
        y={0}
        width={20}
        height={20}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 20, y: 20 }}
        fillLinearGradientColorStops={[0, 'rgba(0,0,0,0.1)', 1, 'rgba(0,0,0,0)']}
        cornerRadius={[0, 8, 0, 0]}
      />

      {/* Text content */}
      <Text
        ref={textRef}
        x={10}
        y={10}
        width={note.width - 20}
        height={note.height - 20}
        text={note.text}
        fontSize={14}
        fontFamily="Arial, sans-serif"
        fill="#374151"
        lineHeight={1.4}
        wrap="word"
        ellipsis={true}
        visible={!isEditing}
      />
    </Group>
  );
}
