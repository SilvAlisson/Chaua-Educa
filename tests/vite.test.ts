import { expect, it } from "vitest";
import { createServer } from "vite";

it("serves the game scene and imported presets in development without public-import warnings", async () => {
  const warnings: string[] = [];
  const server = await createServer({
    server: {
      host: "127.0.0.1",
      port: 0,
      open: false,
      preTransformRequests: false,
    },
    optimizeDeps: { noDiscovery: true, include: [] },
    customLogger: {
      info() {},
      warn(message) {
        warnings.push(message);
      },
      warnOnce(message) {
        warnings.push(message);
      },
      error(message) {
        warnings.push(message);
      },
      clearScreen() {},
      hasErrorLogged() {
        return false;
      },
      hasWarned: false,
    },
  });
  try {
    await server.listen();
    const address = server.httpServer!.address();
    if (!address || typeof address === "string")
      throw Error("Missing development server address");
    const base = `http://127.0.0.1:${address.port}`;
    const scene = await fetch(`${base}/src/game/ForestScene.ts`);
    expect(scene.status).toBe(200);
    expect(await scene.text()).toContain("/src/game/assets/trunks.json");
    const presets = await fetch(`${base}/src/game/assets/trunks.json?import`);
    expect(presets.status).toBe(200);
    expect(await presets.text()).toContain("originX");
    const main = await fetch(`${base}/src/main.ts`);
    expect(main.status).toBe(200);
    for (const key of [
      "snake",
      "hollow",
      "branch",
      "hawk-0",
      "hawk-1",
      "perch",
      "shield",
      "feather",
    ]) {
      const asset = await fetch(`${base}/assets/v4/${key}.webp`);
      expect(asset.status).toBe(200);
      expect(asset.headers.get("content-type")).toContain("image/webp");
    }
    expect(warnings).toEqual([]);
  } finally {
    await server.close();
  }
}, 15000);
