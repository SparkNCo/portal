"use client";

import ReactFlow, { Background, Controls, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";

const MOCK_NODES: Node[] = [
  { id: "1", type: "input", position: { x: 0, y: 0 }, data: { label: "User opens feature" } },
  { id: "2", position: { x: 0, y: 110 }, data: { label: "Fills out form" } },
  { id: "3", position: { x: -170, y: 220 }, data: { label: "Validation fails" } },
  { id: "4", position: { x: 170, y: 220 }, data: { label: "Validation passes" } },
  { id: "5", type: "output", position: { x: 170, y: 330 }, data: { label: "Confirmation screen" } },
];

const MOCK_EDGES: Edge[] = [
  { id: "e1-2", source: "1", target: "2" },
  { id: "e2-3", source: "2", target: "3", label: "invalid" },
  { id: "e2-4", source: "2", target: "4", label: "valid" },
  { id: "e3-2", source: "3", target: "2", label: "retry" },
  { id: "e4-5", source: "4", target: "5" },
];

export function DesignTab() {
  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-[320px]">
      <p className="text-xs text-muted-foreground italic">
        Mock data — embedded flows and diagrams for this issue will appear here.
      </p>

      <div className="h-[360px] rounded-lg border border-border overflow-hidden">
        <ReactFlow
          nodes={MOCK_NODES}
          edges={MOCK_EDGES}
          fitView
          proOptions={{ hideAttribution: true }}
          className="!bg-secondary/20"
        >
          <Background color="hsl(var(--muted-foreground))" gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
