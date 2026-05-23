/**
 * test/integration/publishing-routes.test.ts  — P4 Test Infrastructure
 *
 * Integration tests for split publishing sub-routers.
 * Verifies each sub-router mounts and responds correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../../server/infrastructure/db/index.ts", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from:   vi.fn().mockReturnThis(),
    where:  vi.fn().mockResolvedValue([{ id: 1, name: "test" }]),
  },
}));

vi.mock("../../server/publishing/index.ts", () => ({
  startDeployment:    vi.fn().mockResolvedValue({ id: 1, status: "deploying" }),
  getDeployment:      vi.fn().mockResolvedValue({ id: 1, status: "deployed" }),
  listDeployments:    vi.fn().mockResolvedValue([{ id: 1, status: "deployed" }]),
  settingsStore:      { getSettings: vi.fn().mockResolvedValue({ appName: "test", region: "us", environment: "prod" }), upsertSettings: vi.fn(), listSecrets: vi.fn().mockResolvedValue([]), addSecret: vi.fn(), updateSecret: vi.fn().mockResolvedValue(true), deleteSecret: vi.fn().mockResolvedValue(true) },
  authConfigStore:    { getConfig: vi.fn().mockResolvedValue({}), upsertConfig: vi.fn(), toggleProvider: vi.fn() },
  domainManager:      { listDomains: vi.fn().mockResolvedValue([]), addDomain: vi.fn().mockResolvedValue({ name: "test.com" }), removeDomain: vi.fn().mockResolvedValue(true), retryDomain: vi.fn().mockResolvedValue(true) },
  getDnsRecords:      vi.fn().mockReturnValue([]),
  securityScanner:    { getScanResult: vi.fn().mockReturnValue(null), isScanning: vi.fn().mockReturnValue(false), runScan: vi.fn() },
  issueStore:         { setIssueState: vi.fn().mockReturnValue(true), getIssueCounts: vi.fn().mockReturnValue({}) },
  runtimeStatus:      { getStatus: vi.fn().mockReturnValue({ healthy: true }), restart: vi.fn(), redeploy: vi.fn(), shutdown: vi.fn() },
  logStore:           { query: vi.fn().mockReturnValue([]), levelCounts: vi.fn().mockReturnValue({}) },
  metricsCollector:   { getMetrics: vi.fn().mockReturnValue([]), getCurrentStats: vi.fn().mockReturnValue({}) },
}));

import { createPublishingRouter } from "../../server/api/publishing.routes.ts";

// ── App setup ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use("/api/publishing", createPublishingRouter());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Publishing Routes (thin combiner + sub-routers)", () => {
  it("GET /status/:projectId → 200", async () => {
    const res = await request(app).get("/api/publishing/status/1");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.projectId).toBe(1);
  });

  it("POST /publish/:projectId → 200", async () => {
    const res = await request(app).post("/api/publishing/publish/1");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.deployment).toBeDefined();
  });

  it("GET /deployments/:projectId → 200", async () => {
    const res = await request(app).get("/api/publishing/deployments/1");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.deployments)).toBe(true);
  });

  it("GET /deployments/:projectId/domains → 200", async () => {
    const res = await request(app).get("/api/publishing/deployments/1/domains");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.domains)).toBe(true);
  });

  it("GET /deployments/:projectId/settings → 200", async () => {
    const res = await request(app).get("/api/publishing/deployments/1/settings");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("GET /deployments/:deploymentId/security-scan → 200", async () => {
    const res = await request(app).get("/api/publishing/deployments/1/security-scan");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("GET /deployments/:deploymentId/manage/status → 200", async () => {
    const res = await request(app).get("/api/publishing/deployments/1/manage/status");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
