import newGraph from "./graph";

describe("Graph", () => {
  it("can have a node added", () => {
    const graph = newGraph();
    graph.addNode("a");
    expect(graph.from("a")).toEqual([]);
    expect(graph.to("a")).toEqual([]);
  });

  it("can have a connection added", () => {
    const graph = newGraph();

    graph.connectNode("a", "b");

    expect(graph.from("a")).toEqual(["b"]);
    expect(graph.to("b")).toEqual(["a"]);
    expect(graph.to("a")).toEqual([]);
    expect(graph.from("b")).toEqual([]);
  });

  it("can have a connection forwarded", () => {
    const graph = newGraph();

    graph.connectNode("a", "c");
    graph.connectNode("b", "c");
    graph.forwardNode("c", "d");

    expect(graph.from("a")).toEqual(["d"]);
    expect(graph.from("b")).toEqual(["d"]);

    expect(graph.from("c")).toEqual([]);
    expect(graph.to("c")).toEqual([]);

    expect(graph.from("d")).toEqual([]);
    expect(graph.to("d")).toEqual(["a", "b"]);
  });
});
