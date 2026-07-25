# Agent discovery

What this site publishes so AI agents can work out what it offers without
scraping HTML, plus the parts that still need action outside the codebase.

## Shipped in the app

| Surface | Path | Source |
| --- | --- | --- |
| `Link` headers (RFC 8288) | every HTML page | `next.config.ts` |
| Content signals | `/robots.txt` | `app/robots.txt/route.ts` |
| API catalog (RFC 9727) | `/.well-known/api-catalog` | `lib/agent-discovery/api-catalog.ts` |
| OpenAPI 3.1 description | `/openapi.json` | `lib/agent-discovery/openapi.ts` |
| Agent skills index (0.2.0) | `/.well-known/agent-skills/index.json` | `lib/agent-discovery/skills.ts` |
| Skill documents | `/.well-known/agent-skills/{name}/SKILL.md` | `lib/agent-discovery/skills.ts` |
| Markdown negotiation | public pages, `Accept: text/markdown` | `lib/agent-discovery/markdown/` |
| WebMCP tools | marketing pages | `lib/agent-discovery/webmcp-tools.ts` |

Quick check against a running server:

```bash
curl -sI https://gipiti.ru/ | grep -i '^link:'
```

```bash
curl -s -H 'Accept: text/markdown' https://gipiti.ru/ | head
```

### Content signals

`/robots.txt` declares `search=yes, ai-input=yes, ai-train=no` — indexing and
assistant retrieval are welcome, model training is not. This is a business
preference rather than a technical control; change it in
`lib/agent-discovery/constants.ts` (`CONTENT_SIGNALS`).

### Adding a skill

Add an entry to `agentSkills` in `lib/agent-discovery/skills.ts`. The index
route computes the SHA-256 digest from the served body, so it cannot go stale,
and `generateStaticParams` picks up the new URL automatically.

### Adding a Markdown view for a page

Extend `isMarkdownNegotiablePath` in `lib/agent-discovery/markdown/paths.ts` and
add the branch to `getMarkdownForPath` in `lib/agent-discovery/markdown/index.ts`.
Generate the text from the same module the React page renders — the point of
that directory is that the two views cannot drift.

## Needs DNS changes (not code)

DNS-based discovery (DNS-AID, `draft-mozleywilliams-dnsop-dnsaid`) advertises
agent entrypoints as SVCB records. It is zone configuration, so it cannot be
shipped from this repository — it has to be added wherever `gipiti.ru` is
hosted.

The minimum useful record points agents at the HTTPS discovery surface this app
already serves:

```dns
_index._agents.gipiti.ru. 3600 IN SVCB 1 gipiti.ru. (
    alpn="h2,http/1.1" port=443 mandatory=alpn,port )
```

Notes before publishing:

- **ServiceMode, not AliasMode** — the leading `1` is the priority; `0` would
  make it an alias record and drop the parameters.
- **DNSSEC** — sign the zone, otherwise a validating resolver cannot tell the
  record is authentic, and the draft treats unsigned discovery data as
  untrusted.
- **Protocol-specific names** (`_a2a._agents`, `_mcp._agents`) should only be
  published once there is a server actually speaking that protocol. Advertising
  an endpoint that does not answer is worse than publishing nothing.
- The draft is not a ratified RFC yet; the record format may change.

## Deliberately not published

These checks appear in agent-readiness audits but would require infrastructure
this product does not have. Publishing the metadata without the service behind
it points agents at endpoints that 404 or reject them, which is worse than
returning nothing.

| Metadata | Why not | What it would take |
| --- | --- | --- |
| `/.well-known/openid-configuration`, `/.well-known/oauth-authorization-server` | GIPITI is not an OAuth/OIDC authorization server. Auth is NextAuth credentials (email + password) with a session cookie; there is no `authorization_endpoint`, `token_endpoint` or `jwks_uri` to advertise. | Standing up an authorization server and issuing tokens to third-party clients. |
| `/.well-known/oauth-protected-resource` (RFC 9728) | No API accepts bearer tokens, so there is no protected resource to describe and no authorization server to name. | The above, plus token auth on the API routes. |
| `/auth.md` | The WorkOS agent-registration flow assumes agents can register and obtain credentials. GIPITI has no programmatic sign-up and issues no API keys. | A registration endpoint and an agent credential model. |
| `/.well-known/mcp/server-card.json` (SEP-1649) | There is no MCP server. A server card declares a transport endpoint and capabilities; ours would point nowhere. | Building and hosting an MCP server exposing GIPITI's chat capability. |
| MPP payment metadata (`x-payment-info`) | Payments run through CloudPayments' hosted widget against a logged-in account. No operation can be paid for by an agent over HTTP. | An agent-callable paid API plus an MPP-compatible payment flow. |

If any of these get built, the discovery documents are small additions
alongside the existing ones in `lib/agent-discovery/`.
