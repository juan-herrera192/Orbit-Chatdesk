import { test } from "node:test";
import assert from "node:assert/strict";
import { pool } from "@workspace/db";
import { memberFor, getState, uid, hash, now, visitorView, type WorkspaceRow } from "./lib/orbit-store";
import { performAction } from "./lib/orbit-actions";
import type { Conversation } from "@workspace/api-zod";

test("workspace isolation, concurrent two-chat cap, persistence and note conflict protection", async () => {
  const users = [`test-${uid()}`, `test-${uid()}`];
  const workspaces: string[] = [];
  try {
    const agent = await memberFor(users[0]!);
    const other = await memberFor(users[1]!);
    workspaces.push(agent.workspace_id, other.workspace_id);
    const state = await getState(agent);
    assert.equal(state.conversations.length, 0);
    assert.equal(state.metrics.nps, null);
    assert.equal(state.owner, true);
    const ids: string[] = [];
    for (let n = 0; n < 3; n++) {
      const chat: Conversation = {
        id: uid(), customer: { name: `Test ${n}`, email: "test@example.com", phone: "", model: "", orderNumber: "", since: "" },
        status: "queued", assignedTo: "", openedAt: null, idleSince: null, createdAt: now(), closedAt: null,
        category: "", subcategory: "", notes: "", version: 0, resolved: false, firstContact: false, score: null,
        messages: [{ id: uid(), from: "customer", text: "Test request", createdAt: now() }],
      };
      ids.push(chat.id);
      await pool.query("INSERT INTO orbit_conversations(id,workspace_id,token_hash,data) VALUES($1,$2,$3,$4)", [chat.id, agent.workspace_id, hash(uid()), JSON.stringify(chat)]);
    }
    assert.equal((await getState(other)).conversations.length, 0);
    await assert.rejects(performAction(other.id, { action: "claim", id: ids[0] }), /no encontrada/);
    const claims = await Promise.allSettled(ids.map(id => performAction(agent.id, { action: "claim", id })));
    assert.equal(claims.filter(c => c.status === "fulfilled").length, 2);
    assert.equal(claims.filter(c => c.status === "rejected").length, 1);
    const claimed = (await getState(agent)).conversations.filter(c => c.status === "active");
    const id = claimed[0]!.id;
    assert.equal(claimed[0]!.idleSince, null);
    await performAction(agent.id, { action: "open", id });
    assert.ok((await getState(agent)).conversations.find(c => c.id === id)!.idleSince);
    await performAction(agent.id, { action: "send", id, text: "Persisted response" });
    assert.equal((await getState(agent)).conversations.find(c => c.id === id)!.messages.at(-1)!.text, "Persisted response");
    await assert.rejects(performAction(agent.id, { action: "close", id, resolved: true, firstContact: true }), /categoría/);
    const save = { action: "saveNotes" as const, id, category: "Tech Support", subcategory: "Instalación y montaje", notes: "Internal only", version: 0 };
    await performAction(agent.id, save);
    await assert.rejects(performAction(agent.id, save), /otra sesión/);
    const stored = (await getState(agent)).conversations.find(c => c.id === id)!;
    assert.equal(stored.notes, "Internal only");
    assert.equal(visitorView(stored).notes, "");
    assert.equal(visitorView(stored).customer.email, "");
    await performAction(agent.id, { action: "close", id, resolved: true, firstContact: true });
    await assert.rejects(performAction(agent.id, { action: "send", id, text: "Late" }), /cerrada/);
    const queued = (await getState(agent)).conversations.find(c => c.status === "queued")!;
    await performAction(agent.id, { action: "claim", id: queued.id });
    assert.equal((await getState(agent)).conversations.filter(c => c.status === "active").length, 2);
    const workspace = (await pool.query<WorkspaceRow>("SELECT * FROM orbit_workspaces WHERE id=$1", [agent.workspace_id])).rows[0]!;
    const joined = await performAction(other.id, { action: "join", inviteCode: workspace.invite_code });
    const joinedState = await getState(joined);
    assert.equal(joinedState.owner, false);
    assert.equal(joinedState.inviteCode, "");
    await assert.rejects(performAction(other.id, { action: "deleteArticle", id: "order-guide" }), /administrador/);
    await performAction(agent.id, { action: "contact", role: "QA", text: "Review requested" });
    assert.equal((await getState(joined)).contactMessages.length, 0);
    const qa = await performAction(other.id, { action: "profile", role: "QA", name: "Quality" });
    assert.equal((await getState(qa)).contactMessages.length, 1);
    assert.equal((await getState(agent)).metrics.closed, 1);
  } finally {
    // Remove only the disposable records created by this test.
    await pool.query("DELETE FROM orbit_conversations WHERE workspace_id=ANY($1::text[])", [workspaces]);
    await pool.query("DELETE FROM orbit_members WHERE id=ANY($1::text[])", [users]);
    await pool.query("DELETE FROM orbit_workspaces WHERE id=ANY($1::text[])", [workspaces]);
    await pool.end();
  }
});
