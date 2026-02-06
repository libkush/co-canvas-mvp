import { Group, Path, Text, Rect } from 'react-konva';
import { Cursor as CursorData } from '../types';

interface CursorProps {
  cursor: CursorData;
}

export function Cursor({ cursor }: CursorProps) {
  // SVG path for cursor shape (arrow pointer)
  const cursorPath = 'M0,0 L0,16 L4,12 L7,19 L9,18 L6,11 L12,11 Z';
  
  return (
    <Group x={cursor.x} y={cursor.y} listening={false}>
      {/* Cursor pointer */}
      <Path
        data={cursorPath}
        fill={cursor.color}
        stroke="#ffffff"
        strokeWidth={1}
        shadowColor="rgba(0,0,0,0.3)"
        shadowBlur={3}
        shadowOffsetX={1}
        shadowOffsetY={1}
      />
      
      {/* Username label */}
      <Group x={12} y={16}>
        {/* Label background */}
        <Rect
          x={0}
          y={0}
          width={cursor.name.length * 7 + 12}
          height={20}
          fill={cursor.color}
          cornerRadius={4}
          shadowColor="rgba(0,0,0,0.2)"
          shadowBlur={4}
          shadowOffsetY={2}
        />
        {/* Label text */}
        <Text
          x={6}
          y={4}
          text={cursor.name}
          fontSize={12}
          fontFamily="Arial, sans-serif"
          fill="#ffffff"
          fontStyle="bold"
        />
      </Group>
    </Group>
  );
}
