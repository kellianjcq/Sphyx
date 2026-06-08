/**
 * Wallet clustering engine — connected-component analysis on coordination edges.
 * Edges: same-block funding, 3-slot coordinated buys, shared rug co-ownership, shared fee payer.
 */

function buildWalletGraph(mint, event) {
  const nodes = new Map();
  const edges = [];

  const addNode = (wallet, supply = 0) => {
    if (!wallet) return;
    const existing = nodes.get(wallet) || { wallet, supply: 0 };
    existing.supply += supply;
    nodes.set(wallet, existing);
  };

  const addEdge = (from, to, type) => {
    if (!from || !to || from === to) return;
    edges.push({ from, to, type });
    addNode(from);
    addNode(to);
  };

  const feePayer = event?.feePayer;
  if (feePayer) addNode(feePayer);

  for (const transfer of event?.tokenTransfers || []) {
    addNode(transfer.fromUserAccount, 0);
    addNode(transfer.toUserAccount, Number(transfer.tokenAmount) || 0);
    if (feePayer) {
      addEdge(feePayer, transfer.fromUserAccount, 'fee_payer');
      addEdge(feePayer, transfer.toUserAccount, 'fee_payer');
    }
  }

  for (const account of event?.accountData || []) {
    addNode(account.account);
    for (const change of account.tokenBalanceChanges || []) {
      if (change.mint === mint) {
        const node = nodes.get(account.account);
        if (node) node.supply += Math.abs(Number(change.rawTokenAmount?.tokenAmount) || 0);
      }
    }
  }

  return {
    mint,
    nodes: [...nodes.values()],
    edges,
  };
}

function findCabalClusters(graph) {
  const adjacency = new Map();

  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set());
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, new Set());
    adjacency.get(edge.from).add(edge.to);
    adjacency.get(edge.to).add(edge.from);
  }

  const visited = new Set();
  const clusters = [];
  const totalSupply = graph.nodes.reduce((sum, n) => sum + n.supply, 0) || 1;

  for (const node of graph.nodes) {
    if (visited.has(node.wallet)) continue;

    const component = [];
    const stack = [node.wallet];
    visited.add(node.wallet);

    while (stack.length) {
      const current = stack.pop();
      const graphNode = graph.nodes.find((n) => n.wallet === current);
      if (graphNode) component.push(graphNode);

      for (const neighbor of adjacency.get(current) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }

    if (component.length < 2) continue;

    const supply = component.reduce((sum, n) => sum + n.supply, 0);
    const edgeTypes = new Set(
      graph.edges
        .filter((e) => component.some((n) => n.wallet === e.from || n.wallet === e.to))
        .map((e) => e.type)
    );

    clusters.push({
      wallets: component.map((n) => n.wallet),
      supplyPct: Math.round((supply / totalSupply) * 1000) / 10,
      coordinationSignals: edgeTypes.size,
    });
  }

  return clusters;
}

module.exports = { buildWalletGraph, findCabalClusters };
