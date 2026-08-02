# TinyRustLM Gemma 3 270M IT Source Preflight Memory

Date and public-source retrieval date: 2026-07-16

## Decision

Reject immutable candidate `google/gemma-3-270m-it` revision
`ac82b4e820549b854eebf28ce6dedaf9fdfa17b3` before model acquisition. Do not
accept the Gemma terms, request or store a user credential, download the gated
payload, run a quality screen, implement Gemma runtime support, convert the
checkpoint, or distribute a derivative for this campaign.

The local rejection receipt is
`sha256:3d882467ffcc5a3bd8123bd8d2370bd6191864f640601bc83e25cb44195351fa`.
It binds the immutable repository revision, exact public model card and
repository-tree observations, the Google terms and prohibited-use policy
retrieved on 2026-07-16, the public engineering assessment, and recorder
identity. It contains no credential, private path, prompt, model byte, or raw
model output.

This is a product-contract and engineering admission decision, not legal
advice. A different product with model-specific terms, restricted behavior,
and downstream license enforcement could reach a different conclusion.

## Directly Observed Public Facts

The revision-bound model card declares:

- model ID `google/gemma-3-270m-it`, based on `google/gemma-3-270m`;
- license identifier `gemma`;
- Transformers text generation;
- a gated access prompt requiring a logged-in user to acknowledge Google's
  usage license;
- a 32K-token input/output context statement for the 270M and 1B sizes;
- a publisher claim that the 270M model was trained on six trillion tokens;
- Google DeepMind as author.

The credential-free repository-tree observation names ten payload files. It
reports `model.safetensors` as 536,223,056 bytes, `tokenizer.json` as
33,384,570 bytes, and `tokenizer.model` as 4,689,074 bytes. The response did
not expose usable LFS SHA-256 identities for those gated objects.

Only `README.md` and local Hugging Face cache metadata were present. The
weights, configuration, generation configuration, tokenizer payloads, special
token maps, and chat template were absent. No `HF_TOKEN`,
`HUGGING_FACE_HUB_TOKEN`, default Hugging Face token file, or stored-token file
was present during the local credential-presence check. No secret value was
read or written.

The current Google Gemma Terms of Use say they were last modified on
2026-04-01 and list Gemma 3 in the appendix. Their distribution section
requires downstream use restrictions to be enforceable, a copy of the
agreement for recipients, notices on modified files, and a specified Notice
file for non-hosted distribution. The terms incorporate the Gemma Prohibited
Use Policy.

The incorporated prohibited-use policy says it was last modified on
2024-02-21. Among other restrictions, it prohibits generating sexually
explicit content for pornography or sexual gratification, including sexual
chatbots, while carving out scientific, educational, documentary, and
artistic purposes.

## Sourced External Facts

The public model card describes Gemma 3 as an open-weight family derived from
Gemini research. It reports instruction-tuned 270M benchmark values, but those
publisher measurements are not evidence of TinyRustLM conversational quality,
browser portability, or runtime compatibility. No benchmark number influenced
this admission decision.

The public repository listing and terms are mutable web authorities. This
review therefore records both retrieval date and exact response-body hashes.
The model revision is immutable, but the linked legal pages can change.

## Engineering Determination

Three independent gates reject this candidate:

1. `gated-acquisition-authorization-absent`: the payload requires an individual
   user to accept external terms and supply an authorized credential. This
   Codex session has neither and must not accept legal terms on another
   person's behalf.
2. `custom-license-product-policy-conflict`: TinyRustLM's fixed product
   contract requires substantive handling of lawful adult requests with
   narrow concrete-harm boundaries. Gemma imposes an additional category-wide
   restriction on some otherwise lawful adult content. A model-specific hidden
   restriction would make the product claim untrue.
3. `p2p-redistribution-contract-incompatible`: the campaign requires direct P2P
   distribution of promoted `.slm` artifacts. Gemma redistribution would need
   model-specific enforceable recipient restrictions, agreement delivery, and
   notices. Adding a one-off terms path solely for this candidate would expand
   the product contract and create avoidable pre-release complexity.

The access failure alone could be retried by an authorized user. The two
product-contract conflicts are terminal for this campaign. Supplying a token
would therefore not change the decision and is neither requested nor useful.

## Evidence Inventory

| Evidence | Bytes | SHA-256 |
| --- | ---: | --- |
| Revision-bound model card | 28,308 | `9568b09f2a80d09746687bc077aefe9a070948c68d5f1af07007b2da9a70a065` |
| Credential-free repository-tree response | 1,826 | `04466f85df5d8be2ab0ec3456d7f573e97babff725da11fabd917ed7356d6e7f` |
| Gemma Terms of Use response | 10,541 | `e77acc0d3163bb7534675045c584b4d04b387b529239fc4b3647da0a01ba4745` |
| Gemma Prohibited Use Policy response | 3,851 | `574fec39e0c7e5ec4a8cb2d645475d278791a9f11c0fe7569cd15199f3b99f6a` |
| Canonical evidence set | n/a | `8d53ca54711d7f94899876ccd0161f8790a494e0cab8557ca6cc3ca04bf30a5f` |
| Public assessment | 2,889 | `537674b919e8f80a16040583a15e93d3ceea442bfcc9a6103810919596e14e69` |
| Preflight recorder v1 | 15,480 | `adf1b0442d63ceeced06c2330bba2d750134454d0f8c1d09b99f0800b9269df0` |

The four public evidence bodies are retained outside the repository as local
review inputs. The committed assessment contains only public URLs, dates,
sizes, hashes, bounded codes, and the immutable model identity.

## What Was Not Done

- No Gemma terms were accepted by this session.
- No credential was requested, printed, persisted, or transmitted.
- No gated model or tokenizer object was acquired.
- No configuration, architecture tensor contract, or chat template was
  inspected locally.
- No inference, source screen, conversion, quantization, browser run, or
  quality claim occurred.
- No claim is made that Gemma 3 270M IT would pass or fail TinyRustLM's
  conversational gate.

## Campaign Consequences

1. Count this exact model identity as attempted at source review and rejected,
   never qualified.
2. Keep it out of the 20-model target and out of conversion/runtime backlogs.
3. Do not treat an operator-provided Hugging Face token as a reason to reopen
   the candidate while the product-policy and P2P-distribution conflicts
   remain.
4. Continue with ungated sources whose exact revisions carry redistribution
   terms compatible with the shared product contract.
5. Preserve the receipt and assessment even if public terms later change; a
   new review must supersede rather than overwrite this evidence.

## Unknowns Requiring Different Authorization

- The exact gated object hashes and tensor shapes.
- Whether the immutable checkpoint loads with remote code disabled.
- Untouched output quality on the private source-screen cases.
- Native, WASM, browser, memory, and latency behavior.
- Whether project counsel would approve a separate Gemma-specific product and
  redistribution contract.

None of these unknowns needs resolution for the present rejection.

## Primary Sources

- Google, [immutable Gemma 3 270M IT repository](https://huggingface.co/google/gemma-3-270m-it/tree/ac82b4e820549b854eebf28ce6dedaf9fdfa17b3), retrieved 2026-07-16.
- Google, [revision-bound Gemma 3 model card](https://huggingface.co/google/gemma-3-270m-it/blob/ac82b4e820549b854eebf28ce6dedaf9fdfa17b3/README.md), retrieved 2026-07-16.
- Google, [Gemma Terms of Use](https://ai.google.dev/gemma/terms), last modified 2026-04-01, retrieved 2026-07-16.
- Google, [Gemma Prohibited Use Policy](https://ai.google.dev/gemma/prohibited_use_policy), last modified 2024-02-21, retrieved 2026-07-16.
