"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: "POLICYHOLDER" | "GARAGE" | "EXPERT" | "LOCATION";
  label: string;
  claimCount: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  weight: number;
}

interface Props {
  nodes: { type: string; key: string; label: string; claimIds: string[] }[];
  links: { sourceKey: string; targetKey: string; weight: number }[];
  onNodeClick?: (node: GraphNode) => void;
}

const NODE_COLORS: Record<string, string> = {
  POLICYHOLDER: "#f97316", // orange
  GARAGE: "#ef4444",       // red
  EXPERT: "#a855f7",       // purple
  LOCATION: "#3b82f6",     // blue
};

const NODE_TYPE_LABELS: Record<string, string> = {
  POLICYHOLDER: "Assuré",
  GARAGE: "Garage",
  EXPERT: "Expert",
  LOCATION: "Lieu",
};

export function FraudNetworkGraph({ nodes, links, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const width = svgRef.current.clientWidth || 800;
    const height = 500;

    // Limit to 50 most-connected nodes
    const limitedNodes = nodes.slice(0, 50);
    const nodeKeys = new Set(limitedNodes.map((n) => n.key));

    const graphNodes: GraphNode[] = limitedNodes.map((n) => ({
      id: n.key,
      type: n.type as GraphNode["type"],
      label: n.label,
      claimCount: n.claimIds.length,
    }));

    const graphLinks: GraphLink[] = links
      .filter((l) => nodeKeys.has(l.sourceKey) && nodeKeys.has(l.targetKey))
      .map((l) => ({
        source: l.sourceKey,
        target: l.targetKey,
        weight: l.weight,
      }));

    // Clear previous render
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Zoom container
    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform as string);
      });

    svg.call(zoom);

    // Arrow marker for directed feel (optional decoration)
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 18)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", "#94a3b8");

    // Force simulation
    const simulation = d3
      .forceSimulation<GraphNode>(graphNodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(graphLinks)
          .id((d) => d.id)
          .distance(90)
          .strength((l) => Math.min(l.weight / 5, 1))
      )
      .force("charge", d3.forceManyBody<GraphNode>().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>(32));

    // Links
    const link = g
      .append("g")
      .attr("class", "links")
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(graphLinks)
      .join("line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", 0.55)
      .attr("stroke-width", (d) => Math.max(1, Math.sqrt(d.weight)));

    // Node groups
    const node = g
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(graphNodes)
      .join("g")
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on("click", (_, d) => onNodeClick?.(d));

    // Node circles
    node
      .append("circle")
      .attr("r", (d) => 12 + Math.min(d.claimCount, 5) * 3)
      .attr("fill", (d) => NODE_COLORS[d.type] ?? "#64748b")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("opacity", 0.9);

    // Node labels (truncated)
    node
      .append("text")
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("font-size", "9px")
      .attr("fill", "#fff")
      .attr("font-weight", "700")
      .attr("pointer-events", "none")
      .text((d) => d.label.substring(0, 9));

    // Tooltip
    node
      .append("title")
      .text(
        (d) =>
          `${d.label}\nType : ${NODE_TYPE_LABELS[d.type] ?? d.type}\nSinistres : ${d.claimCount}`
      );

    // Tick handler
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      node.attr(
        "transform",
        (d) => `translate(${d.x ?? 0},${d.y ?? 0})`
      );
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links, onNodeClick]);

  return (
    <div className="w-full border border-gray-200 rounded-xl bg-gray-950 overflow-hidden">
      {nodes.length > 50 && (
        <div className="px-4 py-2 bg-yellow-900/50 text-yellow-300 text-xs font-medium">
          Affichage limité aux 50 premiers nœuds ({nodes.length} nœuds au total)
        </div>
      )}
      {nodes.length === 0 && (
        <div className="flex items-center justify-center text-slate-400 text-sm" style={{ height: 500 }}>
          Aucun nœud à afficher
        </div>
      )}
      <svg ref={svgRef} className="w-full" style={{ height: 500 }} />
      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-4 py-3 bg-gray-900 border-t border-gray-800">
        {(
          [
            ["POLICYHOLDER", "#f97316", "Assuré"],
            ["GARAGE", "#ef4444", "Garage"],
            ["EXPERT", "#a855f7", "Expert"],
            ["LOCATION", "#3b82f6", "Lieu"],
          ] as [string, string, string][]
        ).map(([type, color, label]) => (
          <span key={type} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span
              className="w-3 h-3 rounded-full inline-block flex-shrink-0"
              style={{ background: color }}
            />
            {label}
          </span>
        ))}
        <span className="text-xs text-gray-500 ml-auto">
          Glisser-déposer les nœuds · Molette pour zoomer
        </span>
      </div>
    </div>
  );
}
