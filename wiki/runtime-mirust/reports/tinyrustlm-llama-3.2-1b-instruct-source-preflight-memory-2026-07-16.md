# TinyRustLM Llama 3.2 1B Instruct Source Preflight Memory

Date and public-source retrieval date: 2026-07-16

## Decision

Reject immutable candidate `meta-llama/Llama-3.2-1B-Instruct` revision
`9213176726f574b556790deb65791e0c5aa438b6` before model acquisition. Do not
request access, accept the Llama 3.2 Community License on another person's
behalf, obtain or use a Hugging Face credential, download the gated payload,
run a quality screen, implement runtime support, convert the checkpoint, or
publish a derivative in this campaign.

The local rejection receipt is
`sha256:94973b4bcfd44b75c20103c1aeaf392f9b3b3c3fbb15f8323e8236edc8e08e70`.
It binds the immutable Hugging Face revision, exact credential-free repository
metadata, Meta's official model card, license, and use policy at immutable
official repository revision `0e0b8c519242d5833d8c11bffc1232b77ad7f301`,
the public assessment, and recorder version 4. The receipt contains no
credential, private path, prompt, model byte, or raw model output.

This is a fixed product-contract and engineering-admission decision, not legal
advice and not a statement that the license forbids every form of Llama 3.2
distribution. A separately designed product with model-specific policy,
branding, naming, notice, and recipient-contract handling could make a
different decision.

## Directly Observed Public Facts

The credential-free, revision-bound Hugging Face API response reports:

- model ID `meta-llama/Llama-3.2-1B-Instruct`;
- immutable revision `9213176726f574b556790deb65791e0c5aa438b6`;
- `gated: "manual"`, `private: false`, and `disabled: false`;
- license identifier `llama3.2`, Transformers, safetensors, and text generation;
- 13 repository entries;
- `model.safetensors` size 2,471,645,608 bytes and published LFS SHA-256
  `1ff795ff6a07e6a68085d206fb84417da2f083f68391c2843cd2b8ac6df8538f`;
- `tokenizer.json` size 9,085,657 bytes and `tokenizer_config.json` size
  54,528 bytes; and
- last modification time `2024-10-24T15:07:51Z`.

The public repository lists payload metadata while refusing unauthenticated raw
access to the gated model repository. Credential-free raw requests for the
revision-bound model card, license, and use-policy objects returned HTTP 401.
No retry with a credential occurred. The same publisher's official public
`meta-llama/llama-models` repository supplied the bounded license, model card,
and use policy at verified immutable commit
`0e0b8c519242d5833d8c11bffc1232b77ad7f301`.

The official model card describes the text-only 1B model as 1.23B parameters,
with 128K context, grouped-query attention, shared embeddings, up to nine
trillion pretraining tokens, and a December 2023 knowledge cutoff. Those are
publisher declarations, not locally validated architecture or runtime facts.

No `HF_TOKEN` or `HUGGING_FACE_HUB_TOKEN` environment variable and no default
Hugging Face token file was present during the bounded credential-presence
check. No secret value was read, displayed, written, or transmitted.

## Sourced External Facts

Meta's official Llama 3.2 Community License says use or distribution constitutes
agreement to its terms. Its redistribution section requires a copy of the
agreement, a prominent `Built with Llama` display, a `Llama` prefix when a
distributed model is created or improved using the materials or outputs, and a
specified attribution in a `Notice` file. It incorporates the Llama 3.2
Acceptable Use Policy and adds a separate license threshold for organizations
above 700 million monthly active users at the release date.

The incorporated use policy prohibits several categories beyond the campaign's
narrow concrete-harm boundary, including malicious-code creation, circumventing
usage restrictions, military and warfare applications, guns and illegal
weapons, regulated or controlled substances, self-harm topics, and unauthorized
or unlicensed professional practice. It also requires disclosure of known AI
system dangers.

These sources can change on their default branches. This review therefore uses
the immutable official Git revision for the exact evidence bodies and records
their retrieval date and response hashes.

## Engineering Determination

Three independent admission reasons reject this candidate:

1. `gated-acquisition-authorization-absent`: the model payload requires manual
   access approval, acceptance of external terms, and a user credential. This
   Codex session has no authority to accept those terms for the user and has no
   credential.
2. `custom-license-product-policy-conflict`: TinyRustLM's fixed UAIX product
   contract promises substantive treatment of lawful adult requests with
   narrow, explicit concrete-security and nonconsensual-harm boundaries. The
   incorporated Llama policy adds broader category restrictions. Quietly using
   model-specific boundaries would make the product claim inaccurate.
3. `p2p-redistribution-contract-incompatible`: the fixed campaign requires a
   model-independent direct P2P catalog and artifact contract. Llama-specific
   agreement delivery, branding, derived-model naming, notice, and policy
   handling would be a separate product path. Adding that one-off path would
   violate the standing pre-release no-debt and no-legacy rule.

The access reason alone could be revisited by an authorized user. The two fixed
product-contract reasons are terminal for this campaign, so requesting a token
or asking the user to accept terms would not change the result.

## Evidence Inventory

| Evidence | Bytes | SHA-256 |
| --- | ---: | --- |
| Official Llama 3.2 license | 7,669 | `8cc15535a8a34b41888f644b339a1a9eb428af793a4f5e24df58a3e5b1487d74` |
| Official Llama 3.2 model card | 25,416 | `cdc06052012c47654cfa49dc41a766cdb8801c4dfd469bee6d42774b058beb78` |
| Revision-bound repository metadata | 24,721 | `9793261431e2c13cbfcb920e04e9c7c98a95fb1a440103759d92cd6ca6200e14` |
| Official Llama 3.2 use policy | 6,021 | `40e2777d7faa6beaf98400654170f414d8ab29b921b5163ad4ea0a1d39894201` |
| Canonical evidence set | n/a | `7920414351a3b427f7df40b0c2bd61016ea8da38844643475b9191d446c8fc7b` |
| Public assessment | 3,442 | `ea4317aa3e66ec4227543be798950e65657fc0d4cb40b2bd3cc6c9dd6ac9c2a4` |
| Preflight recorder v4 | n/a | `a3076d6b44b4c702b44011a24ea20947e955986d7e2a5276ae68c50f5e850731` |

The four public evidence bodies are retained outside Git as bounded local
review inputs. The committed assessment retains only public identities, URLs,
dates, sizes, hashes, bounded decisions, and missing-artifact names.

## What Was Not Done

- No Llama terms were accepted by this session.
- No access request was submitted and no credential was requested or used.
- No gated weight, configuration, tokenizer, or chat-template object was
  acquired.
- No tensor shape, tokenizer behavior, or chat serialization was locally
  inspected.
- No inference, source screen, conversion, quantization, browser run, or
  conversational-quality claim occurred.
- No claim is made that this checkpoint would pass or fail TinyRustLM's raw
  eight-case source screen.

## Campaign Consequences

1. Count this exact immutable candidate as attempted and rejected, never
   qualified.
2. Keep it out of the 20-model target, conversion backlog, and runtime backlog.
3. Do not treat a later operator-supplied Hugging Face token as sufficient to
   reopen the candidate while the fixed policy and distribution conflicts
   remain.
4. Continue with ungated, self-contained sources whose redistribution and use
   terms fit the shared product contract.
5. Preserve this receipt and assessment if public metadata or terms change; a
   later review must supersede rather than overwrite them.

## Unknowns Requiring Different Authorization

- Whether an authorized account would receive repository access.
- The exact gated `config.json`, tokenizer, chat-template, and tensor contents.
- Untouched raw quality on the private source-screen cases.
- Native, WASM, browser, memory, and latency behavior.
- Whether project counsel would approve a separately designed Llama-specific
  product and P2P distribution contract.

None of these unknowns needs resolution for this campaign rejection.

## Primary Sources

- Meta, [immutable Llama 3.2 1B Instruct repository](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct/tree/9213176726f574b556790deb65791e0c5aa438b6), retrieved 2026-07-16.
- Hugging Face, [revision-bound repository metadata](https://huggingface.co/api/models/meta-llama/Llama-3.2-1B-Instruct/revision/9213176726f574b556790deb65791e0c5aa438b6?blobs=true), retrieved 2026-07-16.
- Meta, [official source revision](https://github.com/meta-llama/llama-models/commit/0e0b8c519242d5833d8c11bffc1232b77ad7f301), committed 2025-10-10 and retrieved 2026-07-16.
- Meta, [Llama 3.2 Community License](https://github.com/meta-llama/llama-models/blob/0e0b8c519242d5833d8c11bffc1232b77ad7f301/models/llama3_2/LICENSE), retrieved 2026-07-16.
- Meta, [Llama 3.2 text model card](https://github.com/meta-llama/llama-models/blob/0e0b8c519242d5833d8c11bffc1232b77ad7f301/models/llama3_2/MODEL_CARD.md), retrieved 2026-07-16.
- Meta, [Llama 3.2 Acceptable Use Policy](https://github.com/meta-llama/llama-models/blob/0e0b8c519242d5833d8c11bffc1232b77ad7f301/models/llama3_2/USE_POLICY.md), retrieved 2026-07-16.
