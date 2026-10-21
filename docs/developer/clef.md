# Clef and AI Gateway

Clef is a **decision** layer: it selects, sequences, and prioritizes existing
cards. It does not generate flashcard content.

- Code lives in `packages/api/src/services/ai/`:
  `gateway-client.ts`, `clef.ts`, `schemas.ts`, `cache.ts`, `evaluation-service.ts`.
- Only the API calls AI Gateway / Workers AI; the browser never sees credentials.
- Every evaluation records model, input hash, schema, result, confidence, and
  gateway request id in `ai_evaluations`.
- Deterministic evaluations are cached by input hash + schema version.
- Bulk imports enqueue evaluations instead of blocking the request.

## Configuration

```env
AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/<account>/<gateway>
AI_GATEWAY_TOKEN=<secret>
CLEF_MODEL=@cf/meta/llama-3.1-8b-instruct
```

When `AI_GATEWAY_URL`/`AI_GATEWAY_TOKEN` are unset, the Worker uses the Workers
AI `AI` binding; when neither is available, evaluations are marked `skipped`.

## Failure behaviour

| Failure          | Behaviour                                |
| ---------------- | ---------------------------------------- |
| Gateway timeout  | Return fallback scheduler plan           |
| Clef unavailable | Mark evaluation `failed`; continue study |
| Low confidence   | Use deterministic thresholds             |
| Invalid output   | Reject evaluation and log diagnostic     |
| Rate limit       | Queue or defer evaluation                |
