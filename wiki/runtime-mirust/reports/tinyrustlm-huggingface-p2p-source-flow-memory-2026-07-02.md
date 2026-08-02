# TinyRustLM Hugging Face P2P Source Flow Memory - 2026-07-02

TinyRustLM now makes the Hugging Face source lane clearer for new users. Search results are external model-card candidates, not runnable local models. The simple result list no longer shows `Choose converted .slm`, `Save Conversion Request`, or `Save Rust Conversion Script` on each card.

The simple Hugging Face lane has one list-level `Enable P2P when available` toggle. P2P defaults on. When P2P is on and a MiniModel match has peer-offer proof, that row shows `P2P Import`. When P2P is off, the list shows one warning that local conversion can take a while, and peer-capable rows fall back to `Start Conversion`.

Unmatched Hugging Face rows show `Start Conversion`. That action saves the local Rust conversion script handoff and binds the conversion request locally; it does not download model bytes, call Hugging Face `/resolve/`, or run conversion inside the browser.

`P2P Import` currently selects peer-proof MiniModel metadata and waits for verified local or peer bytes. It must not imply project servers serve user model bytes, and it must not bypass local `.slm` validation. Peer proof is metadata; bytes still require local verification before TinyRustLM can run them.

The `hf-search-ui` smoke now proves:

- the source chooser stays open immediately after Search Metadata and after a repeated search/filter click
- P2P is enabled by default
- peer-proof matches show `P2P Import` while P2P is on
- disabling P2P shows one list-level warning and removes `P2P Import`
- rows use `Start Conversion` when P2P is disabled or no peer proof exists
- no Hugging Face `/resolve/` model-byte fetch occurs

This preserves the browser-local boundary: Hugging Face is discovery, MiniModel is metadata/proof, P2P is opt-out source preference, and Rust/WASM local `.slm` validation remains the execution gate.
