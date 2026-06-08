"""
CabalScan graph analyzer — NetworkX worker for wallet clustering.
Consumes analysis jobs from Redis, returns cluster results.
"""

import json
import os
import sys

try:
    import networkx as nx
    import redis
except ImportError:
    print("Install dependencies: pip install networkx redis")
    sys.exit(1)

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
QUEUE_KEY = "cabalscan:graph_jobs"
RESULT_KEY = "cabalscan:graph_results"


def analyze_graph(job: dict) -> dict:
    g = nx.DiGraph()

    for node in job.get("nodes", []):
        g.add_node(node["wallet"], supply=node.get("supply", 0))

    for edge in job.get("edges", []):
        g.add_edge(edge["from"], edge["to"], type=edge.get("type", "unknown"))

    undirected = g.to_undirected()
    clusters = []

    for component in nx.connected_components(undirected):
        wallets = list(component)
        supply = sum(g.nodes[w].get("supply", 0) for w in wallets)
        edge_types = set()
        for u, v, data in undirected.subgraph(component).edges(data=True):
            edge_types.add(data.get("type", "unknown"))

        total = sum(nx.get_node_attributes(g, "supply").values()) or 1
        clusters.append({
            "wallets": wallets,
            "supply_pct": round(supply / total * 100, 1),
            "coordination_signals": len(edge_types),
        })

    return {"mint": job.get("mint"), "clusters": clusters}


def main():
    r = redis.from_url(REDIS_URL)
    print(f"Analyzer worker listening on {QUEUE_KEY}")

    while True:
        _, raw = r.brpop(QUEUE_KEY, timeout=5)
        if not raw:
            continue

        job = json.loads(raw)
        result = analyze_graph(job)
        r.lpush(RESULT_KEY, json.dumps(result))
        print(f"Analyzed {result['mint']}: {len(result['clusters'])} clusters")


if __name__ == "__main__":
    main()
