import { DurableObject } from "cloudflare:workers";

const SERVER_VERSION = "9.1.0";
const MAX_PLAYERS_PER_ROOM = 32;
const MAX_WS_MESSAGE_BYTES = 128_000;
const CURRENT_GENERATOR_VERSION = 4;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const WS_TICKET_TTL_MS = 60 * 1000;
const encoder = new TextEncoder();

const ALLOWED_ROLES = new Set(["host", "client"]);
const SIGNAL_TYPES = new Set(["offer", "answer", "ice-candidate", "ready", "leave", "game-relay"]);
const CLIENT_RELAY_TYPES = new Set([
  "hello", "input", "player-state", "restart_request", "restart-request",
  "character-choice", "mode-message"
]);
const HOST_RELAY_TYPES = new Set([
  "hello", "session", "map", "state", "restart",
  "character-roster", "character-choice-sync", "mode-message"
]);

function securityHeaders() {
  return {
    "cache-control": "no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=()"
  };
}

function configuredOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
}

function originAllowed(origin, env) {
  if (!origin) return true;

  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  if (
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
    (parsed.protocol === "http:" || parsed.protocol === "https:")
  ) {
    return true;
  }

  const configured = configuredOrigins(env);
  if (configured.length) return configured.includes(origin);

  // Fallback inicial. Para divulgação pública, configure ALLOWED_ORIGINS com
  // a origem exata do GitHub Pages/domínio próprio.
  return parsed.protocol === "https:" && parsed.hostname.toLowerCase().endsWith(".github.io");
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const headers = {
    ...securityHeaders(),
    "vary": "Origin",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-max-age": "600"
  };

  if (origin && originAllowed(origin, env)) {
    headers["access-control-allow-origin"] = origin;
  }
  return headers;
}

function json(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      ...corsHeaders(request, env)
    }
  });
}

function internalJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}

function cleanRoomCode(value) {
  const room = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return /^[A-Z0-9]{4,8}$/.test(room) ? room : null;
}

function cleanPlayerId(value) {
  const id = String(value || "").trim().slice(0, 100);
  return /^[A-Za-z0-9._:-]{8,100}$/.test(id) ? id : null;
}

function cleanCharacterId(value) {
  const id = String(value || "classic").trim().slice(0, 40);
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(id) ? id : "classic";
}

function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join("");
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(text) {
  const normalized = String(text).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(value)));
  return base64Url(new Uint8Array(digest));
}

async function hmacKey(secret, usages) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages
  );
}

async function signSession(env, payload) {
  if (!env.SESSION_SECRET || String(env.SESSION_SECRET).length < 32) {
    throw new Error("SESSION_SECRET não configurado.");
  }
  const body = base64Url(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey(env.SESSION_SECRET, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${base64Url(new Uint8Array(signature))}`;
}

async function verifySession(env, token) {
  if (!env.SESSION_SECRET || String(env.SESSION_SECRET).length < 32) return null;
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;

  try {
    const [body, signatureText] = parts;
    const key = await hmacKey(env.SESSION_SECRET, ["verify"]);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(signatureText),
      encoder.encode(body)
    );
    if (!ok) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)));
    if (
      payload?.v !== 1 ||
      !cleanRoomCode(payload.room) ||
      !cleanPlayerId(payload.pid) ||
      !ALLOWED_ROLES.has(payload.role) ||
      !Number.isFinite(Number(payload.exp)) ||
      Date.now() > Number(payload.exp)
    ) return null;

    return payload;
  } catch {
    return null;
  }
}

function bearerToken(request) {
  const match = String(request.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function safeSecretEqual(left, right) {
  if (!left || !right) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(String(left))),
    crypto.subtle.digest("SHA-256", encoder.encode(String(right)))
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function readJson(request, maxBytes = 512_000) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > maxBytes) {
    const error = new Error("Payload excede o limite permitido.");
    error.status = 413;
    throw error;
  }

  const text = await request.text();
  if (text.length > maxBytes) {
    const error = new Error("Payload excede o limite permitido.");
    error.status = 413;
    throw error;
  }
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    const error = new Error("JSON inválido.");
    error.status = 400;
    throw error;
  }
}

function clientIp(request) {
  return String(
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "unknown"
  ).split(",")[0].trim().slice(0, 80);
}

async function roomInternal(env, roomCode, path, body = {}) {
  const room = env.GAME_ROOM.getByName(roomCode);
  return room.fetch(new Request(`https://internal.vc${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }));
}

async function rateLimit(env, request, bucket, max, windowMs) {
  const ipHash = await sha256Base64Url(clientIp(request));
  const limiter = env.GAME_ROOM.getByName(`__rate__:${ipHash}`);
  const response = await limiter.fetch(new Request("https://internal.vc/internal/rate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bucket, max, windowMs })
  }));
  return response.json();
}

function rateLimitedResponse(request, env, retryAfter = 1000) {
  const response = json(request, env, {
    error: "Muitas solicitações. Aguarde e tente novamente."
  }, 429);
  response.headers.set("retry-after", String(Math.max(1, Math.ceil(retryAfter / 1000))));
  return response;
}

async function createServerSession(request, env) {
  const origin = request.headers.get("Origin");
  if (origin && !originAllowed(origin, env)) {
    return json(request, env, { error: "Origem não autorizada." }, 403);
  }

  const limit = await rateLimit(env, request, "session", 30, 10 * 60 * 1000);
  if (!limit.allowed) return rateLimitedResponse(request, env, limit.retryAfter);

  const body = await readJson(request, 16_000);
  const role = String(body?.role || "");
  const playerId = cleanPlayerId(body?.player_id);
  const characterId = cleanCharacterId(body?.character_id);

  if (!ALLOWED_ROLES.has(role) || !playerId) {
    return json(request, env, { error: "Dados da sessão inválidos." }, 400);
  }

  let roomCode = role === "client" ? cleanRoomCode(body?.room_code) : null;
  if (role === "client" && !roomCode) {
    return json(request, env, { error: "Código da sala inválido." }, 400);
  }

  let grant = null;
  const attempts = role === "host" ? 8 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (role === "host") roomCode = randomRoomCode();

    const response = await roomInternal(env, roomCode, "/internal/session", {
      role,
      playerId,
      characterId
    });
    const data = await response.json();

    if (response.ok) {
      grant = data;
      break;
    }

    if (role === "client") {
      return json(request, env, {
        error: data?.error || "Não foi possível entrar na sala."
      }, response.status);
    }
  }

  if (!grant) {
    return json(request, env, { error: "Não foi possível reservar uma sala segura." }, 409);
  }

  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  const apiToken = await signSession(env, {
    v: 1,
    room: roomCode,
    pid: playerId,
    role,
    iat: now,
    exp: expiresAt,
    nonce: randomToken(12)
  });

  return json(request, env, {
    ok: true,
    room_code: roomCode,
    role,
    player_id: playerId,
    ws_ticket: grant.ticket,
    api_token: apiToken,
    expires_at: expiresAt,
    security_version: SERVER_VERSION
  }, 201);
}

async function requireActiveSession(request, env, requiredRole = null) {
  const session = await verifySession(env, bearerToken(request));
  if (!session) {
    return { error: json(request, env, { error: "Sessão inválida ou expirada." }, 401) };
  }

  if (requiredRole && session.role !== requiredRole) {
    return { error: json(request, env, { error: "Operação não permitida para esta sessão." }, 403) };
  }

  const response = await roomInternal(env, session.room, "/internal/authorize", {
    playerId: session.pid,
    role: session.role,
    requiredRole
  });
  const data = await response.json();

  if (!response.ok) {
    return { error: json(request, env, { error: "A sessão não está conectada à sala." }, response.status === 403 ? 403 : 401) };
  }

  return {
    session,
    roster: Array.isArray(data.players) ? data.players : []
  };
}

function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validRect(rect, world, allowOutside = false) {
  if (!rect || typeof rect !== "object" || Array.isArray(rect)) return false;
  const x = finiteNumber(rect.x);
  const y = finiteNumber(rect.y);
  const w = finiteNumber(rect.w);
  const h = finiteNumber(rect.h);
  if (x === null || y === null || w === null || h === null || w <= 0 || h <= 0 || w > 2500 || h > 2500) {
    return false;
  }
  if (allowOutside) {
    return x > -3000 && y > -3000 && x < world.w + 3000 && y < world.h + 3000;
  }
  return x >= 0 && y >= 0 && x + w <= world.w + 1 && y + h <= world.h + 1;
}

function validBehavior(behavior) {
  if (behavior == null) return true;
  if (!behavior || typeof behavior !== "object" || Array.isArray(behavior)) return false;
  if (behavior.type === "moving") {
    return ["x", "y"].includes(behavior.axis) &&
      finiteNumber(behavior.range) !== null && Number(behavior.range) >= 0 && Number(behavior.range) <= 200 &&
      finiteNumber(behavior.speed) !== null && Number(behavior.speed) > 0 && Number(behavior.speed) <= 200 &&
      finiteNumber(behavior.phase) !== null;
  }
  if (behavior.type === "blink") {
    return finiteNumber(behavior.period) !== null && Number(behavior.period) >= 2 && Number(behavior.period) <= 30 &&
      finiteNumber(behavior.visibleFor) !== null && Number(behavior.visibleFor) > 0 && Number(behavior.visibleFor) <= Number(behavior.period) &&
      finiteNumber(behavior.phase) !== null;
  }
  return false;
}

function validGeneratedObject(item, world, playerCount, allowOutside = false) {
  if (!validRect(item, world, allowOutside)) return false;
  const allowedTypes = new Set(["yellow", "red", "adaptive", "shared", "blue"]);
  const allowedKinds = new Set(["platform", "obstacle", "death"]);
  if (item.type != null && !allowedTypes.has(String(item.type))) return false;
  if (item.kind != null && !allowedKinds.has(String(item.kind))) return false;
  if (!validBehavior(item.behavior)) return false;
  if (item.ownerIndex != null) {
    const owner = Number(item.ownerIndex);
    if (!Number.isInteger(owner) || owner < 0 || owner >= playerCount) return false;
  }
  return true;
}

function transitionReachable(prev, next) {
  const GRAVITY = 1850;
  const MOVE_SPEED = 315;
  const JUMP_SPEED = 680;
  const dy = Number(next.y) - Number(prev.y);
  const discriminant = JUMP_SPEED * JUMP_SPEED + 2 * GRAVITY * dy;
  if (discriminant < 0) return false;
  const landingTime = (JUMP_SPEED + Math.sqrt(discriminant)) / GRAVITY;
  const safeHorizontal = MOVE_SPEED * landingTime * 0.90;

  let gap = 0;
  if (next.x > prev.x + prev.w) gap = next.x - (prev.x + prev.w);
  else if (prev.x > next.x + next.w) gap = prev.x - (next.x + next.w);
  return gap <= safeHorizontal;
}

function validateMapSubmission(body) {
  const seed = String(body?.seed || "");
  const hash = String(body?.map_hash || "").toLowerCase();
  const generatorVersion = Number(body?.generator_version);
  const playerCount = Math.floor(Number(body?.player_count || body?.map?.playerCount));
  const map = body?.map;

  if (
    !/^[A-Z2-9]{8}$/.test(seed) ||
    !/^[0-9a-f]{8}$/.test(hash) ||
    generatorVersion !== CURRENT_GENERATOR_VERSION ||
    !Number.isInteger(playerCount) || playerCount < 2 || playerCount > MAX_PLAYERS_PER_ROOM ||
    !map || typeof map !== "object" || Array.isArray(map)
  ) {
    return { ok: false, error: "Metadados do mapa inválidos." };
  }

  if (
    String(map.seed || "") !== seed ||
    Number(map.generatorVersion) !== generatorVersion ||
    Number(map.playerCount) !== playerCount
  ) {
    return { ok: false, error: "Metadados internos do mapa não correspondem ao envio." };
  }

  const world = { w: finiteNumber(map.world?.w), h: finiteNumber(map.world?.h) };
  if (world.w === null || world.h === null || world.w < 1000 || world.w > 40000 || world.h !== 680) {
    return { ok: false, error: "Dimensões do mapa inválidas." };
  }

  if (
    !Array.isArray(map.path) || map.path.length < 3 || map.path.length > 300 ||
    !Array.isArray(map.blocks) || map.blocks.length > 2000 ||
    !validRect(map.goal, world)
  ) {
    return { ok: false, error: "Estrutura do mapa inválida." };
  }

  for (let i = 0; i < map.path.length; i++) {
    const platform = map.path[i];
    if (!validGeneratedObject(platform, world, playerCount) || Number(platform.w) < 40) {
      return { ok: false, error: `Plataforma ${i + 1} inválida.` };
    }
    if (i > 0 && !transitionReachable(map.path[i - 1], platform)) {
      return { ok: false, error: `Salto ${i} fora da física permitida.` };
    }
  }

  for (const block of map.blocks) {
    if (!validGeneratedObject(block, world, playerCount, true)) {
      return { ok: false, error: "Bloco do mapa inválido." };
    }
  }

  const last = map.path[map.path.length - 1];
  if (
    Number(map.goal.x) < Number(last.x) ||
    Number(map.goal.x) + Number(map.goal.w) > Number(last.x) + Number(last.w) + 1 ||
    Math.abs((Number(map.goal.y) + Number(map.goal.h)) - Number(last.y)) > 3
  ) {
    return { ok: false, error: "Saída não está apoiada na plataforma final." };
  }

  const canonical = {
    generatorVersion: Number(map.generatorVersion),
    playerCount: Number(map.playerCount),
    world: map.world,
    path: map.path,
    blocks: map.blocks,
    goal: map.goal,
    features: map.features || {}
  };
  const computedHash = fnv1a(JSON.stringify(canonical));
  if (computedHash !== hash || (map.hash && String(map.hash).toLowerCase() !== hash)) {
    return { ok: false, error: "Hash do mapa não corresponde ao conteúdo." };
  }

  const mapJson = JSON.stringify(map);
  if (mapJson.length > 350_000) {
    return { ok: false, error: "Mapa excede o tamanho permitido." };
  }

  return { ok: true, seed, hash, generatorVersion, playerCount, map, mapJson };
}

async function handleMapFeedback(request, env, auth) {
  const limit = await rateLimit(env, request, "map-feedback", 12, 60 * 60 * 1000);
  if (!limit.allowed) return rateLimitedResponse(request, env, limit.retryAfter);

  const body = await readJson(request, 420_000);
  const vote = Number(body?.vote);
  if (vote !== 1 && vote !== -1) {
    return json(request, env, { error: "Feedback inválido." }, 400);
  }

  const validation = validateMapSubmission(body);
  if (!validation.ok) return json(request, env, { error: validation.error }, 400);

  const existing = await env.MAPS_DB.prepare(
    `SELECT id, status FROM maps WHERE map_hash = ? LIMIT 1`
  ).bind(validation.hash).first();

  if (existing) {
    return json(request, env, {
      ok: true,
      library_status: existing.status,
      map_id: existing.id,
      already_reviewed: true
    });
  }

  const pendingCount = await env.MAPS_DB.prepare(
    `SELECT COUNT(*) AS total FROM map_submissions WHERE status = 'pending'`
  ).first();
  if (Number(pendingCount?.total || 0) >= 5000) {
    return json(request, env, { error: "Fila de revisão temporariamente cheia." }, 503);
  }

  let submission = await env.MAPS_DB.prepare(
    `SELECT id, status FROM map_submissions WHERE map_hash = ? LIMIT 1`
  ).bind(validation.hash).first();

  if (submission && submission.status !== "pending") {
    return json(request, env, {
      ok: true,
      submission_id: submission.id,
      library_status: submission.status
    });
  }

  if (!submission) {
    await env.MAPS_DB.prepare(
      `INSERT INTO map_submissions (
         seed, generator_version, map_hash, map_json, player_count, status,
         positive_votes, negative_votes, submitted_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 'pending', 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      validation.seed,
      validation.generatorVersion,
      validation.hash,
      validation.mapJson,
      validation.playerCount
    ).run();
  }

  await env.MAPS_DB.prepare(
    `INSERT INTO map_submission_votes (
       map_hash, player_id, room_code, vote, created_at, updated_at
     ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(map_hash, player_id)
     DO UPDATE SET
       room_code = excluded.room_code,
       vote = excluded.vote,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(validation.hash, auth.session.pid, auth.session.room, vote).run();

  await env.MAPS_DB.prepare(
    `UPDATE map_submissions
     SET positive_votes = (
           SELECT COUNT(*) FROM map_submission_votes WHERE map_hash = ? AND vote = 1
         ),
         negative_votes = (
           SELECT COUNT(*) FROM map_submission_votes WHERE map_hash = ? AND vote = -1
         ),
         updated_at = CURRENT_TIMESTAMP
     WHERE map_hash = ?`
  ).bind(validation.hash, validation.hash, validation.hash).run();

  submission = await env.MAPS_DB.prepare(
    `SELECT id, status, positive_votes, negative_votes
     FROM map_submissions WHERE map_hash = ? LIMIT 1`
  ).bind(validation.hash).first();

  return json(request, env, {
    ok: true,
    submission_id: submission?.id || null,
    library_status: "pending",
    positive_votes: Number(submission?.positive_votes || 0),
    negative_votes: Number(submission?.negative_votes || 0)
  }, 201);
}

async function handleAdmin(request, env, url) {
  if (!env.ADMIN_SECRET || String(env.ADMIN_SECRET).length < 32) {
    return json(request, env, { error: "Administração não configurada." }, 503);
  }

  if (!await safeSecretEqual(bearerToken(request), env.ADMIN_SECRET)) {
    return json(request, env, { error: "Não autorizado." }, 401);
  }

  const limit = await rateLimit(env, request, "admin", 120, 60 * 1000);
  if (!limit.allowed) return rateLimitedResponse(request, env, limit.retryAfter);

  if (url.pathname === "/api/admin/submissions" && request.method === "GET") {
    const rawStatus = String(url.searchParams.get("status") || "pending");
    const status = ["pending", "approved", "rejected"].includes(rawStatus) ? rawStatus : "pending";
    const rowsLimit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 25));
    const rows = await env.MAPS_DB.prepare(
      `SELECT id, seed, generator_version, map_hash, player_count, status,
              positive_votes, negative_votes, submitted_at, updated_at
       FROM map_submissions
       WHERE status = ?
       ORDER BY submitted_at ASC
       LIMIT ?`
    ).bind(status, rowsLimit).all();
    return json(request, env, { submissions: rows.results || [] });
  }

  if (url.pathname === "/api/admin/submissions/review" && request.method === "POST") {
    const body = await readJson(request, 16_000);
    const mapHash = String(body?.map_hash || "").toLowerCase();
    const decision = String(body?.decision || "");
    if (!/^[0-9a-f]{8}$/.test(mapHash) || !["approved", "rejected"].includes(decision)) {
      return json(request, env, { error: "Revisão inválida." }, 400);
    }

    const submission = await env.MAPS_DB.prepare(
      `SELECT * FROM map_submissions WHERE map_hash = ? LIMIT 1`
    ).bind(mapHash).first();
    if (!submission) return json(request, env, { error: "Submissão não encontrada." }, 404);

    const existing = await env.MAPS_DB.prepare(
      `SELECT id, status FROM maps WHERE map_hash = ? LIMIT 1`
    ).bind(mapHash).first();
    if (existing && existing.status !== decision) {
      return json(request, env, {
        error: `Mapa já está ${existing.status}; revisão conflitante recusada.`
      }, 409);
    }

    if (!existing) {
      await env.MAPS_DB.prepare(
        `INSERT INTO maps (
           seed, generator_version, map_hash, map_json, player_count, status,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        submission.seed,
        submission.generator_version,
        submission.map_hash,
        submission.map_json,
        submission.player_count,
        decision
      ).run();
    }

    await env.MAPS_DB.prepare(
      `UPDATE map_submissions
       SET status = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE map_hash = ?`
    ).bind(decision, mapHash).run();

    const mapRow = await env.MAPS_DB.prepare(
      `SELECT id, status FROM maps WHERE map_hash = ? LIMIT 1`
    ).bind(mapHash).first();

    return json(request, env, {
      ok: true,
      map_hash: mapHash,
      decision,
      map_id: mapRow?.id || null
    });
  }

  return json(request, env, { error: "Endpoint administrativo não encontrado." }, 404);
}

async function throttleApi(env, request, bucket, max = 120, windowMs = 60_000) {
  const result = await rateLimit(env, request, bucket, max, windowMs);
  return result.allowed ? null : rateLimitedResponse(request, env, result.retryAfter);
}

async function handleApi(request, env, url) {
  if (!env.MAPS_DB) {
    return json(request, env, { error: "Serviço de dados indisponível." }, 503);
  }

  const origin = request.headers.get("Origin");
  if (origin && !originAllowed(origin, env)) {
    return json(request, env, { error: "Origem não autorizada." }, 403);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  if (url.pathname === "/api/session" && request.method === "POST") {
    return createServerSession(request, env);
  }

  if (url.pathname.startsWith("/api/admin/")) {
    return handleAdmin(request, env, url);
  }

  if (url.pathname === "/api/maps/check" && request.method === "GET") {
    const auth = await requireActiveSession(request, env, "host");
    if (auth.error) return auth.error;
    const throttled = await throttleApi(env, request, "map-check", 240);
    if (throttled) return throttled;

    const hash = String(url.searchParams.get("hash") || "").toLowerCase().slice(0, 64);
    if (!/^[0-9a-f]{8}$/.test(hash)) return json(request, env, { error: "hash inválido" }, 400);

    const row = await env.MAPS_DB.prepare(
      `SELECT id, status FROM maps WHERE map_hash = ? LIMIT 1`
    ).bind(hash).first();
    if (row) return json(request, env, { known: true, status: row.status, id: row.id });

    const pending = await env.MAPS_DB.prepare(
      `SELECT id, status FROM map_submissions WHERE map_hash = ? LIMIT 1`
    ).bind(hash).first();
    return json(request, env, {
      known: !!pending,
      status: pending?.status || null,
      submission_id: pending?.id || null
    });
  }

  if (url.pathname === "/api/maps/next" && request.method === "POST") {
    const auth = await requireActiveSession(request, env, "host");
    if (auth.error) return auth.error;
    const throttled = await throttleApi(env, request, "map-next", 120);
    if (throttled) return throttled;

    const playerIds = auth.roster
      .map(player => cleanPlayerId(player.playerId))
      .filter(Boolean)
      .slice(0, MAX_PLAYERS_PER_ROOM);
    if (playerIds.length < 2) {
      return json(request, env, { error: "A sala precisa de pelo menos 2 jogadores conectados." }, 409);
    }

    const playerCount = playerIds.length;
    const placeholders = playerIds.map(() => "?").join(",");
    const sql = `
      SELECT m.id, m.seed, m.generator_version, m.map_hash, m.map_json, m.player_count,
             COUNT(DISTINCT pm.player_id) AS seen_by
      FROM maps m
      LEFT JOIN player_maps pm
        ON pm.map_id = m.id
       AND pm.player_id IN (${placeholders})
      WHERE m.status = 'approved'
        AND m.player_count = ?
      GROUP BY m.id, m.seed, m.generator_version, m.map_hash, m.map_json, m.player_count
      HAVING COUNT(DISTINCT pm.player_id) < ?
      ORDER BY seen_by ASC, RANDOM()
      LIMIT 1`;

    const row = await env.MAPS_DB.prepare(sql)
      .bind(...playerIds, playerCount, playerIds.length)
      .first();

    if (!row) {
      return json(request, env, {
        map: null,
        generate: true,
        reason: "all-approved-maps-seen-by-every-player"
      });
    }

    let map;
    try {
      map = JSON.parse(row.map_json);
    } catch {
      return json(request, env, { error: "Mapa salvo está corrompido." }, 500);
    }

    const seenBy = Number(row.seen_by || 0);
    return json(request, env, {
      generate: false,
      seen_by: seenBy,
      unseen_by: Math.max(0, playerIds.length - seenBy),
      map: {
        ...map,
        seed: row.seed,
        hash: row.map_hash,
        generatorVersion: row.generator_version,
        playerCount: Number(row.player_count || 2),
        databaseId: row.id,
        source: "database"
      }
    });
  }

  if (url.pathname === "/api/maps/feedback" && request.method === "POST") {
    const auth = await requireActiveSession(request, env, "host");
    if (auth.error) return auth.error;
    return handleMapFeedback(request, env, auth);
  }

  if (
    (url.pathname === "/api/maps/approve" || url.pathname === "/api/maps/reject") &&
    request.method === "POST"
  ) {
    return json(request, env, {
      error: "Endpoint desativado na V9.1. Use a fila de revisão segura."
    }, 410);
  }

  if (url.pathname === "/api/maps/played" && request.method === "POST") {
    const auth = await requireActiveSession(request, env, "host");
    if (auth.error) return auth.error;
    const throttled = await throttleApi(env, request, "map-played", 180);
    if (throttled) return throttled;

    const body = await readJson(request, 16_000);
    const mapId = Number(body?.map_id);
    const completed = body?.completed ? 1 : 0;
    if (!Number.isInteger(mapId) || mapId <= 0) {
      return json(request, env, { error: "map_id inválido." }, 400);
    }

    const mapRow = await env.MAPS_DB.prepare(
      `SELECT id, status, player_count FROM maps WHERE id = ? LIMIT 1`
    ).bind(mapId).first();
    if (!mapRow || mapRow.status !== "approved") {
      return json(request, env, { error: "Mapa não pertence à biblioteca aprovada." }, 404);
    }

    const playerIds = auth.roster
      .map(player => cleanPlayerId(player.playerId))
      .filter(Boolean)
      .slice(0, MAX_PLAYERS_PER_ROOM);
    if (Number(mapRow.player_count) !== playerIds.length) {
      return json(request, env, { error: "Quantidade de jogadores não corresponde ao mapa." }, 409);
    }

    const statements = playerIds.map(playerId =>
      env.MAPS_DB.prepare(
        `INSERT INTO player_maps (player_id, map_id, completed, played_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(player_id, map_id)
         DO UPDATE SET
           completed = CASE
             WHEN excluded.completed > player_maps.completed THEN excluded.completed
             ELSE player_maps.completed
           END,
           played_at = CURRENT_TIMESTAMP`
      ).bind(playerId, mapId, completed)
    );
    await env.MAPS_DB.batch(statements);
    return json(request, env, { ok: true });
  }

  if (url.pathname === "/api/player/stats" && request.method === "GET") {
    const auth = await requireActiveSession(request, env);
    if (auth.error) return auth.error;
    const throttled = await throttleApi(env, request, "player-stats", 120);
    if (throttled) return throttled;

    const row = await env.MAPS_DB.prepare(
      `SELECT COUNT(*) AS played,
              SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed
       FROM player_maps
       WHERE player_id = ?`
    ).bind(auth.session.pid).first();
    return json(request, env, {
      played: Number(row?.played || 0),
      completed: Number(row?.completed || 0)
    });
  }

  if (url.pathname === "/api/maps/stats" && request.method === "GET") {
    const auth = await requireActiveSession(request, env);
    if (auth.error) return auth.error;
    const throttled = await throttleApi(env, request, "map-stats", 60);
    if (throttled) return throttled;

    const [approved, rejected, pending] = await Promise.all([
      env.MAPS_DB.prepare(`SELECT COUNT(*) AS total FROM maps WHERE status='approved'`).first(),
      env.MAPS_DB.prepare(`SELECT COUNT(*) AS total FROM maps WHERE status='rejected'`).first(),
      env.MAPS_DB.prepare(`SELECT COUNT(*) AS total FROM map_submissions WHERE status='pending'`).first()
    ]);
    return json(request, env, {
      approved: Number(approved?.total || 0),
      rejected: Number(rejected?.total || 0),
      pending: Number(pending?.total || 0)
    });
  }

  return json(request, env, { error: "Endpoint não encontrado." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const requestId = crypto.randomUUID();

    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (error) {
        const status = Number(error?.status) || 500;
        console.error("API error", {
          requestId,
          path: url.pathname,
          status,
          message: error?.message || String(error)
        });
        return json(request, env, {
          error: status >= 500 ? "Erro interno do servidor." : (error?.message || "Solicitação inválida."),
          request_id: requestId
        }, status);
      }
    }

    if (url.pathname === "/") {
      return json(request, env, {
        ok: true,
        service: "Visoes Cruzadas Server",
        version: SERVER_VERSION,
        security: "session-ticket-v1"
      });
    }

    const match = url.pathname.match(/^\/room\/([A-Z0-9]{4,8})$/);
    if (!match) return new Response("Não encontrado.", { status: 404, headers: securityHeaders() });

    const origin = request.headers.get("Origin");
    if (origin && !originAllowed(origin, env)) {
      return new Response("Origem não autorizada.", { status: 403, headers: securityHeaders() });
    }

    const upgrade = request.headers.get("Upgrade");
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
      return new Response("WebSocket necessário.", { status: 426, headers: securityHeaders() });
    }

    const ticket = String(url.searchParams.get("ticket") || "").trim().slice(0, 180);
    if (!/^[A-Za-z0-9_-]{32,180}$/.test(ticket)) {
      return new Response("Ticket inválido.", { status: 401, headers: securityHeaders() });
    }

    const room = env.GAME_ROOM.getByName(match[1]);
    // Encaminha apenas ticket. A identidade real é recuperada dentro do DO.
    return room.fetch(request);
  }
};

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.messageBudget = new Map();
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  readSocketMeta(ws) {
    try { return ws.deserializeAttachment() ?? {}; }
    catch { return {}; }
  }

  connectedPlayers() {
    return this.ctx.getWebSockets()
      .map(ws => this.readSocketMeta(ws))
      .filter(meta => meta.playerId)
      .sort((a, b) => Number(a.slot ?? 999999) - Number(b.slot ?? 999999));
  }

  firstAvailableClientSlot() {
    const used = new Set(this.connectedPlayers().map(p => Number(p.slot)).filter(Number.isInteger));
    let slot = 1;
    while (used.has(slot)) slot++;
    return slot;
  }

  socketByPlayerId(playerId) {
    return this.ctx.getWebSockets(`player:${playerId}`)[0] || null;
  }

  async cleanupTickets() {
    const now = Date.now();
    const tickets = await this.ctx.storage.list({ prefix: "ticket:" });
    for (const [key, value] of tickets) {
      if (!value || Number(value.expiresAt || 0) <= now) await this.ctx.storage.delete(key);
    }
    const reservation = await this.ctx.storage.get("host-reservation");
    if (reservation && Number(reservation.expiresAt || 0) <= now) {
      await this.ctx.storage.delete("host-reservation");
    }
  }

  async issueTicket(role, playerId, characterId) {
    const ticket = randomToken(32);
    const hash = await sha256Base64Url(ticket);
    await this.ctx.storage.put(`ticket:${hash}`, {
      role,
      playerId,
      characterId,
      expiresAt: Date.now() + WS_TICKET_TTL_MS
    });
    return ticket;
  }

  async internalSession(request) {
    await this.cleanupTickets();
    const body = await readJson(request, 16_000);
    const role = String(body?.role || "");
    const playerId = cleanPlayerId(body?.playerId);
    const characterId = cleanCharacterId(body?.characterId);
    if (!ALLOWED_ROLES.has(role) || !playerId) {
      return internalJson({ error: "Sessão inválida." }, 400);
    }

    const players = this.connectedPlayers();
    if (players.length >= MAX_PLAYERS_PER_ROOM) return internalJson({ error: "Sala cheia." }, 429);
    if (players.some(p => p.playerId === playerId)) {
      return internalJson({ error: "Este jogador já está conectado." }, 409);
    }

    const pending = await this.ctx.storage.list({ prefix: "ticket:" });
    for (const value of pending.values()) {
      if (value?.playerId === playerId && Number(value.expiresAt || 0) > Date.now()) {
        return internalJson({ error: "Já existe uma autorização pendente para este jogador." }, 409);
      }
    }

    const hostConnected = players.some(p => p.role === "host");
    const hostReservation = await this.ctx.storage.get("host-reservation");
    const hostReserved = hostReservation && Number(hostReservation.expiresAt || 0) > Date.now();

    if (role === "host") {
      if (hostConnected || (hostReserved && hostReservation.playerId !== playerId)) {
        return internalJson({ error: "Esta sala já possui um Host." }, 409);
      }
      await this.ctx.storage.put("host-reservation", {
        playerId,
        expiresAt: Date.now() + WS_TICKET_TTL_MS
      });
    } else if (!hostConnected && !hostReserved) {
      return internalJson({ error: "Sala não encontrada ou Host ainda não conectado." }, 404);
    }

    return internalJson({
      ok: true,
      ticket: await this.issueTicket(role, playerId, characterId)
    }, 201);
  }

  async internalAuthorize(request) {
    const body = await readJson(request, 12_000);
    const playerId = cleanPlayerId(body?.playerId);
    const role = String(body?.role || "");
    const requiredRole = body?.requiredRole ? String(body.requiredRole) : null;
    if (!playerId || !ALLOWED_ROLES.has(role)) return internalJson({ error: "Sessão inválida." }, 401);

    const socket = this.socketByPlayerId(playerId);
    if (!socket) return internalJson({ error: "Jogador não conectado." }, 401);
    const meta = this.readSocketMeta(socket);
    if (meta.role !== role || (requiredRole && meta.role !== requiredRole)) {
      return internalJson({ error: "Permissão insuficiente." }, 403);
    }

    return internalJson({
      ok: true,
      player: { playerId: meta.playerId, role: meta.role, slot: meta.slot },
      players: this.connectedPlayers().map(p => ({
        playerId: p.playerId,
        role: p.role,
        slot: p.slot
      }))
    });
  }

  async internalRate(request) {
    const body = await readJson(request, 8_000);
    const bucket = String(body?.bucket || "default").replace(/[^A-Za-z0-9._:-]/g, "_").slice(0, 80);
    const max = Math.max(1, Math.min(10_000, Number(body?.max) || 60));
    const windowMs = Math.max(1000, Math.min(24 * 60 * 60 * 1000, Number(body?.windowMs) || 60_000));
    const key = `rate:${bucket}`;
    const now = Date.now();
    const current = await this.ctx.storage.get(key);
    const state = current && now - Number(current.startedAt || 0) < windowMs
      ? current
      : { startedAt: now, count: 0 };
    state.count = Number(state.count || 0) + 1;
    await this.ctx.storage.put(key, state);
    return internalJson({
      allowed: state.count <= max,
      remaining: Math.max(0, max - state.count),
      retryAfter: Math.max(0, windowMs - (now - state.startedAt))
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/internal/session") return this.internalSession(request);
    if (url.pathname === "/internal/authorize") return this.internalAuthorize(request);
    if (url.pathname === "/internal/rate") return this.internalRate(request);

    const upgrade = request.headers.get("Upgrade");
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
      return new Response("WebSocket necessário.", { status: 426 });
    }

    await this.cleanupTickets();
    const ticket = String(url.searchParams.get("ticket") || "");
    const ticketKey = `ticket:${await sha256Base64Url(ticket)}`;
    const grant = await this.ctx.storage.get(ticketKey);
    if (!grant || Number(grant.expiresAt || 0) <= Date.now()) {
      if (grant) await this.ctx.storage.delete(ticketKey);
      return new Response("Ticket expirado ou já utilizado.", { status: 401 });
    }

    // Uso único: remove antes de aceitar o socket.
    await this.ctx.storage.delete(ticketKey);

    const role = grant.role;
    const playerId = cleanPlayerId(grant.playerId);
    const characterId = cleanCharacterId(grant.characterId);
    if (!ALLOWED_ROLES.has(role) || !playerId) return new Response("Ticket inválido.", { status: 401 });
    if (this.connectedPlayers().length >= MAX_PLAYERS_PER_ROOM) return new Response("Sala cheia.", { status: 429 });
    if (this.socketByPlayerId(playerId)) return new Response("Este jogador já está conectado.", { status: 409 });
    if (role === "host" && this.ctx.getWebSockets("host").length > 0) {
      return new Response("Esta sala já possui um Host.", { status: 409 });
    }

    if (role === "host") {
      const reservation = await this.ctx.storage.get("host-reservation");
      if (
        !reservation || reservation.playerId !== playerId ||
        Number(reservation.expiresAt || 0) <= Date.now()
      ) {
        return new Response("Reserva do Host inválida.", { status: 401 });
      }
      await this.ctx.storage.delete("host-reservation");
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const slot = role === "host" ? 0 : this.firstAvailableClientSlot();
    this.ctx.acceptWebSocket(server, [role, `player:${playerId}`]);
    server.serializeAttachment({ role, playerId, slot, characterId, joinedAt: Date.now() });
    this.messageBudget.set(playerId, { tokens: 120, last: performance.now() });

    this.ctx.waitUntil(Promise.resolve().then(() => this.broadcastPresence()));
    return new Response(null, { status: 101, webSocket: client });
  }

  consumeMessageBudget(playerId, byteLength) {
    const now = performance.now();
    const state = this.messageBudget.get(playerId) || { tokens: 120, last: now };
    const elapsed = Math.max(0, (now - state.last) / 1000);
    state.tokens = Math.min(120, state.tokens + elapsed * 45);
    state.last = now;
    const cost = 1 + Math.ceil(Math.max(0, byteLength - 16_000) / 16_000);
    if (state.tokens < cost) {
      this.messageBudget.set(playerId, state);
      return false;
    }
    state.tokens -= cost;
    this.messageBudget.set(playerId, state);
    return true;
  }

  validRelayPayload(sender, payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    const type = String(payload.type || "");
    if (!type || type.length > 64) return false;
    return sender.role === "host" ? HOST_RELAY_TYPES.has(type) : CLIENT_RELAY_TYPES.has(type);
  }

  targetAllowed(sender, targetId) {
    if (!targetId) return true;
    const target = this.socketByPlayerId(targetId);
    if (!target) return false;
    const targetMeta = this.readSocketMeta(target);
    return sender.role === "client" ? targetMeta.role === "host" : targetMeta.role === "client";
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== "string") {
      try { ws.close(1008, "Somente mensagens de texto são aceitas."); } catch {}
      return;
    }
    if (message === "ping") return;

    const sender = this.readSocketMeta(ws);
    if (!sender.playerId) return;
    const byteLength = encoder.encode(message).byteLength;
    if (byteLength > MAX_WS_MESSAGE_BYTES) {
      try { ws.close(1009, "Mensagem muito grande."); } catch {}
      return;
    }
    if (!this.consumeMessageBudget(sender.playerId, byteLength)) {
      try { ws.close(1008, "Limite de mensagens excedido."); } catch {}
      return;
    }

    let data;
    try { data = JSON.parse(message); }
    catch { return; }
    if (!data || typeof data !== "object" || Array.isArray(data) || !SIGNAL_TYPES.has(data.type)) return;
    if (data.type === "offer" && sender.role !== "host") return;
    if (data.type === "answer" && sender.role !== "client") return;
    if (data.type === "game-relay" && !this.validRelayPayload(sender, data.payload)) return;

    const targetId = data.to ? cleanPlayerId(data.to) : null;
    if (data.to && !targetId) return;
    if (!this.targetAllowed(sender, targetId)) return;

    const safeMessage = {
      type: data.type,
      from: sender.playerId,
      fromRole: sender.role
    };
    if (data.type === "game-relay") safeMessage.payload = data.payload;
    else {
      if (data.sdp) safeMessage.sdp = data.sdp;
      if (data.candidate) safeMessage.candidate = data.candidate;
    }

    if (targetId) {
      const target = this.socketByPlayerId(targetId);
      if (!target) return;
      try { target.send(JSON.stringify(safeMessage)); } catch {}
      return;
    }

    const targetRole = sender.role === "host" ? "client" : "host";
    for (const target of this.ctx.getWebSockets(targetRole)) {
      try { target.send(JSON.stringify(safeMessage)); } catch {}
    }
  }

  async webSocketClose(ws, code, reason) {
    const departed = this.readSocketMeta(ws);
    if (departed.playerId) this.messageBudget.delete(departed.playerId);

    for (const target of this.ctx.getWebSockets()) {
      if (target === ws) continue;
      try {
        target.send(JSON.stringify({
          type: "peer-left",
          playerId: departed.playerId || null,
          role: departed.role || null,
          slot: departed.slot ?? null
        }));
      } catch {}
    }

    try { ws.close(code, reason); } catch {}
    this.broadcastPresence();
  }

  async webSocketError(ws, error) {
    const meta = this.readSocketMeta(ws);
    console.error("Durable Object WebSocket error", {
      playerId: meta.playerId || null,
      message: error?.message || String(error)
    });
  }

  broadcastPresence() {
    const players = this.connectedPlayers();
    const payload = JSON.stringify({
      type: "roster",
      serverVersion: SERVER_VERSION,
      secureSession: true,
      ready: players.length >= 2,
      count: players.length,
      players: players.map(player => ({
        playerId: player.playerId,
        role: player.role,
        slot: player.slot,
        characterId: player.characterId || "classic"
      }))
    });

    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(payload); } catch {}
    }
  }
}
