import { Group, Rect, Text } from 'react-konva';
import { ClusterLabel as ClusterLabelData } from '../types';

interface ClusterLabelProps {
  cluster: ClusterLabelData;
  color: string;
}

export function ClusterLabel({ cluster, color }: ClusterLabelProps) {
  const padding = 12;
  const fontSize = 16;
  const labelWidth = cluster.name.length * 10 + padding * 2;
  const labelHeight = fontSize + padding * 2;

  return (
    <Group x={cluster.x} y={cluster.y - 50} listening={false}>
      {/* Background pill */}
      <Rect
        x={0}
        y={0}
        width={labelWidth}
        height={labelHeight}
        fill={color}
        cornerRadius={labelHeight / 2}
        shadowColor="rgba(0,0,0,0.2)"
        shadowBlur={8}
        shadowOffsetY={2}
      />
      
      {/* Label text */}
      <Text
        x={padding}
        y={padding}
        text={cluster.name}
        fontSize={fontSize}
        fontFamily="Arial, sans-serif"
        fontStyle="bold"
        fill="#ffffff"
      />
      
      {/* Note count badge */}
      <Group x={labelWidth + 8} y={(labelHeight - 20) / 2}>
        <Rect
          width={24}
          height={20}
          fill="rgba(255,255,255,0.9)"
          cornerRadius={10}
        />
        <Text
          x={24 / 2}
          y={4}
          text={String(cluster.noteIds.length)}
          fontSize={12}
          fontFamily="Arial, sans-serif"
          fontStyle="bold"
          fill={color}
          align="center"
          offsetX={6}
        />
      </Group>
    </Group>
  );
}
