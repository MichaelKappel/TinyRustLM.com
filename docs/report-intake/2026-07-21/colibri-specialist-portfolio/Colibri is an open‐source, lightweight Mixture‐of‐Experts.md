# Executive Summary

Colibri is an open‐source, lightweight Mixture‐of‐Experts (MoE) runtime designed specifically for **GLM-5.2** (a 744B-parameter Chinese LLM). Its single-file C engine (`c/glm.c`) streams expert-layer weights from disk on demand, keeping only the dense backbone (∼17B params) resident in RAM.  This allows running a “frontier” model with ~25 GB of RAM (roughly 10 GB for int4 weights) by leveraging fast NVMe storage.  Colibri has **no BLAS/GPU dependency by default** and uses OpenMP for parallelism.  Supported hardware includes standard x86‐64 CPUs (with optional AVX‐VNNI acceleration), as well as NVIDIA/CUDA or Apple Metal GPUs if available (via optional backend).  Colibri’s model format is a custom **GLM int4 container** (built from GLM-5.2’s safetensors).  TinyRustLM’s small models, however, use a custom SLM format (Rust/WASM), which is *not* compatible with Colibri out-of-the-box. Converting an SLM to Colibri’s format would require reconstructing a GLM architecture version of the model, for which no tool currently exists. 

**Key Points:** Colibri **only supports GLM-style models**. To use Colibri, one downloads a GLM-5.2 container (or converts from GLM safetensors via `coli convert`).  TinyRustLM models (in `.slm`) cannot be directly loaded; no known converter exists.  Running Colibri requires a fast NVMe drive (≈370 GB for GLM-5.2 int4) and ~16–24 GB of RAM.  A GPU is *optional* – the default is CPU-only and GPU-less operation.  Performance is disk-bound: expect **sub-1 token/s** on average (≈0.05–0.1 tok/s cold, 0.5–2 tok/s warm depending on hardware).  Colibri provides commands (`./coli chat/run/serve/doctor/plan`) for model conversion, inference, and launching an OpenAI-compatible API.  It supports batching and speculative decoding (an int8 “MTP” head) for throughput.  Low-memory tuning (e.g. `--topp 0.7`) can reduce RAM/disk use at minor quality cost.  Known issues include heavy disk I/O (so use NVMe, *not* network mounts), a Windows “python alias” trap, and the need to protect the API server with a key.  The following sections analyze Colibri’s design, compatibility with TinyRustLM formats, installation, usage, benchmarks, and deployment steps in detail.

## Colibri Architecture and Supported Formats

Colibri’s engine is a **single C binary** that implements the GLM-5.2 model.  It keeps the shared (dense) weights in RAM at 4‑bit precision and **streams the routed experts from disk on demand**.  The system organizes memory into tiers (VRAM→RAM→NVMe) with an adaptive LRU cache: the hottest experts are automatically “pinned” in fast memory as usage patterns emerge.  This unified-memory strategy means **larger models can run on small hardware** by trading speed for storage.  All math is integer-quantized (mostly int4; the multi-token-prediction head runs in int8).  By default Colibri is **CPU-only** and requires no external libraries (“pure C, zero deps”).  An optional CUDA/Metal backend can be built to host the dense tensors on GPU, but the disk-streaming loop still runs on CPU.  

**Supported Model:** Colibri is built for GLM-5.2.  It loads a custom “Colibri” container (a directory of safetensors shards) that holds an int4-quantized GLM model.  The Colibri CLI includes a `convert` command that downloads the original GLM-5.2 checkpoints (FP8 quantized) from Hugging Face and converts them shard-by-shard into the int4 format without ever storing the full model in memory.  Alternatively, one can download a pre-converted container (Mateo Grgic’s GLM-5.2 int4 with int8 MTP heads) from HF. No other model architectures or formats (e.g. GPT, LLaMA) are natively supported.  

**Runtime Requirements and Dependencies:** Colibri needs a modern C compiler with OpenMP (GCC/Clang or MSVC) and Python only for the one-time conversion step. The Quickstart lists minimal environment: ~16 GB RAM (24+ GB recommended), a few hundred GB of disk, and Linux/Windows/macOS.  A GPU is optional; **no GPU is required** by default.  On Windows you can use a prebuilt EXE (rename it `glm.exe` for the CLI) or build via MSYS2.  The engine itself has no third-party runtime deps.  (CUDA support requires building a separate DLL and linking, as described in the Windows docs.)  Colibri’s runtime also optionally persists the KV cache (`.coli_kv`) across restarts to resume context. 

**Configuration:** Many runtime knobs exist. By default Colibri auto-sizes its expert cache to available RAM. Users can override with `RAM_GB=N`, `PIN_GB=N`, or limit VRAM usage (`CUDA_EXPERT_GB=…`).  Speculative multi-token decoding (the MTP head) is on by default with an int8 head; it can be disabled (`DRAFT=0`) for maximum fidelity. Other tunables include `--topk/--topp` (controls sampling vs reading fewer experts), `PILOT=1` (lookahead prefetch of experts), and `PIPE=1` (overlap I/O with compute). `coli plan` reports how many GB are used in each tier.  

<pre class="language-mermaid">sequenceDiagram
    actor User
    participant CLI as Colibri CLI
    participant Engine
    User->>CLI: `COLI_MODEL=/path/model ./coli chat`
    CLI->>Engine: Load model (dense→RAM, experts→disk)
    Engine->>CLI: “[ready, model loaded]”
    User->>CLI: Prompt text
    CLI->>Engine: Forward tokens to model
    Engine->>Engine: Route experts, stream/cache, compute layers
    Engine-->>CLI: Return generated tokens
    CLI-->>User: Display response
</pre>

## TinyRustLM Models: Format & Compatibility

**TinyRustLM (.slm) Format:** Models from TinyRustLM.com use a custom *SLM* container (version 1) developed for their Rust/WASM runtime.  For example, “TinyLM-16M” comes packaged as `.slm` with embedded tokenizer and weights.  These artifacts are not in standard safetensors or GGUF formats. MiRust documentation explicitly notes “no GGUF compatibility” and that the runtime is Rust/WASM-only. In short, **Colibri cannot directly load .slm files**.

**Conversion Possibilities:** There is no published tool to convert `.slm` to Colibri’s GLM format.  TinyRustLM models are likely trained in a GPT-like transformer architecture, not GLM, so even weight conversion would be nontrivial.  If a tiny model has a HuggingFace ancestor (e.g. sbintuitions/tiny-lm-16M on HF), one could theoretically export that to safetensors and attempt to reformat it, but it *would not match Colibri’s GLM architecture*. We found no direct pathway.  In practice, one would need to retrain or re-export the model in GLM form (or pick a GLM-compatible small model). Absent that, TinyRustLM models remain incompatible.  

**Supported Model Formats (Summary):** Colibri expects GLM-5.2 in its own int4 container. It can *convert* from the HuggingFace safetensors/FP8 checkpoint (via `coli convert`). Conversely, a Colibri-ready model is a directory of safetensors shards (the “int4 container”) that the engine memory-maps.  We tabulate key formats and tools below:

| Model Type / Format                      | Extension    | Conversion Tool                | Colibri Support              |
|------------------------------------------|--------------|--------------------------------|------------------------------|
| **GLM-5.2 original (FP8 safetensors)**   | .safetensors | `./coli convert --model <dir>`  | **Yes** – produces int4 container |
| **GLM-5.2 Colibri container (int4)**     | .safetensors | (n/a)                         | **Yes** – load directly |
| **TinyRustLM custom small model (SLM1)** | .slm         | No tool (Rust runtime only)    | **No** – not compatible     |
| **HuggingFace GPT/LLaMA models (safetensors)** | .safetensors/.gguf | LLaMA tools (llama.cpp, transformers) | No (architecture mismatch) |
| **Other MoE LLM (hypothetical)**         | —            | —                              | No (engine GLM-specific)    |

## Installation and Building

**Prerequisites:** A typical setup requires (on Linux/macOS) `gcc`/`clang`, `make`, `git`, and Python 3. Install with your distro’s package manager, e.g. on Ubuntu: 
```
sudo apt install build-essential git python3
``` 
That provides OpenMP support (via libgomp) for multi-threading.  On Windows, the Quickstart offers two paths: a **prebuilt binary** or building via MSYS2. Option A (easier) is to download `colibri-*-windows-x86_64.zip` from the Releases and unzip. Inside will be `colibri-<ver>.exe` (rename it to `glm.exe`) and the `coli` Python launcher. Then install Python 3 from python.org. Option B is to install MSYS2, use `pacman -S mingw-w64-ucrt-x86_64-gcc make git python` and build as below. On macOS, use Xcode/clang plus Homebrew: `brew install libomp git python`.

**Building Colibri:** Clone the repo and compile the C engine: 
```bash
git clone https://github.com/JustVugg/colibri.git
cd colibri/c
./setup.sh
``` 
`setup.sh` will test your compiler, then `make` the `glm` engine. A successful build prints “engine self-test: 32/32 (expected 32/32)”. (On Windows, if using the prebuilt, skip this; otherwise, run in an MSYS2 UCRT64 shell.)

**CUDA (optional):** To enable GPU support on Windows, install the CUDA toolkit and compile the CUDA backend as a separate DLL. In brief:  
1. Build `coli_cuda.dll` with MSVC+nvcc.  
2. Rebuild the host with `CUDA_DLL=1` (this links `backend_loader.c` instead of `cudart`).  
Set `COLI_CUDA=1` and `CUDA_EXPERT_GB` to allow GPU placement for dense weights.  If the DLL is missing, Colibri will simply run CPU-only without error.

## Obtaining and Converting Models

**GLM-5.2 Container:** Colibri’s Quickstart suggests downloading a pre-built int4 container from Hugging Face (Mateo’s “GLM-5.2-colibri-int4-with-int8-mtp” ~372 GB). Alternatively, one can convert the FP8 repository with:
```bash
# example: convert GLM-5.2 checkpoints to Colibri container
./coli convert --model /nvme/glm52_i4
```
This Python-based command downloads and quantizes each shard in sequence. It may be interrupted and resumed safely. 

**TinyRustLM Models:** If you have TinyRustLM `.slm` files, there is no documented way to run them in Colibri. You would have to skip Colibri and use a TinyRustLM-compatible runtime (e.g. their WASM loader) or find a model in a supported format.  

## Running Models (Chat/Serve)

After building and preparing a model, set the `COLI_MODEL` environment var to the model folder, then run Colibri:

- **Interactive chat:** 
  ```bash
  COLI_MODEL=/nvme/glm52_i4 ./coli chat
  ``` 
  (Replace the path with your model directory.) On Windows (UCRT64), `COLI_MODEL=/d/glm52_i4 ./coli chat`. This launches an interactive REPL.  

- **Single-run prompt:** For a one-off prompt, use `coli chat` or `coli run`. For example:
  ```bash
  COLI_MODEL=/nvme/glm52_i4 ./coli run "Hello, world!"
  ```
  (The Windows docs show `python coli run "…" --model D:\glm52_i4` as equivalent.)

- **Diagnostics:** 
  - `./coli doctor` checks that the model and environment are ready. 
  - `./coli plan` reports how memory tiers will be used (RAM/VRAM/disk).

- **OpenAI-style API (`coli serve`):** Colibri can serve a REST API. For example:
  ```bash
  COLI_MODEL=/nvme/glm52_i4 COLI_API_KEY=yourkey ./coli serve \
      --host 127.0.0.1 --port 8000 --model-id glm-5.2-colibri
  ```
  This launches a local HTTP server with `/v1/chat/completions`, `/v1/models`, etc. The server binds to localhost by default. It processes one generation at a time (concurrent requests are queued). 

- **Multiple models (concurrent/sequence):** Since each `coli serve` can load only one model, you can run multiple instances on different ports. For example, in separate terminals or background processes:
  ```bash
  COLI_MODEL=/models/modelA ./coli serve --port 8001 --model-id A &
  COLI_MODEL=/models/modelB ./coli serve --port 8002 --model-id B &
  ```
  Each one will load its model into memory. Similarly, to run models sequentially, simply change `COLI_MODEL` and restart the command. No built-in “multi-model” interface exists aside from separate processes.

## Performance and Configuration for Tiny Models

Colibri is optimized for the huge GLM-5.2, so performance with **tiny models** should be vastly better in principle, but we have limited data. A minimal built-in GLM (2.4 MB test model) runs extremely fast on any hardware (see the Windows docs’ “tiny model 2.4MB” smoke test). In general, runtime scales with model size:

- **Dense memory:** Expect ~10 GB RAM for GLM-5.2 dense weights. Tiny models (e.g. 10–100 MB) would use proportionally less (tens of MB to a few GB) if reformatted as GLM.  
- **Disk I/O:** Colibri’s throughput is limited by disk. On the reference setup (WSL2, ~1 GB/s NVMe), decoding GLM-5.2 cold achieves only ~0.05–0.1 tok/s.  A warm cache jumps to 0.4–1 tok/s. With faster NVMe and more RAM pinning, speeds can approach a few tok/s. For tiny models, disk reads per token are far smaller, so expect much higher throughput (potentially thousands of tokens/sec on modern hardware), limited mostly by CPU or the smaller weight set.  

- **Latency:** Cold-start overhead (loading ~10 GB dense weights) takes tens of seconds. Subsequent tokens stream from cache. For tiny models, this load time is negligible.

- **Configurables:** In low-memory or disk-constrained environments, use sampling parameters: e.g. `--topp 0.7` or `--topp 0.85` dramatically reduces tokens/sec by reading fewer experts, yet often preserves output quality.  The default policy is *quality-preserving*, i.e. it won’t skip experts unless you adjust top-p or top-k. Other knobs: disable speculation (`DRAFT=0`) to reduce compute spikes, limit batch size (`--batch N`), or restrict RAM for caching (`RAM_GB=…`). Use `coli plan` to verify resource allocation. 

- **Benchmark examples:** On a high-end Apple M5 Max (128 GB RAM), a GPU-accelerated run achieved ~1–2 tok/s. On a typical laptop (NVMe ~2–3 GB/s, 32 GB RAM), one could expect ~0.5–1 tok/s for GLM-5.2. Tiny models would be orders of magnitude faster. (Users are encouraged to profile with the included `iobench.c` tool to measure their disk throughput as Colibri sees it.)

## Limitations, Known Issues, and Security

- **Architecture limitation:** **GLM-only.** Colibri does not support GPT/LLama/BLOOM etc. If your TinyRustLM model is not a GLM, Colibri cannot run it.

- **Memory & Storage:** The full GLM-5.2 requires ~370 GB storage; smaller models scale down. Colibri does *not* work over a network share or slow disk – use a local NVMe. At least ~16 GB RAM is needed (24 GB+ recommended). Insufficient RAM will cause paging or failure. Very low-memory GPUs (≤4 GB) cannot hold the 10 GB dense part. In that case disable GPU tier or add `--cap` to limit VRAM.

- **Performance trade-off:** Colibri’s speed is low on CPU-only (sub-token-per-second). It’s intended for batch/overnight jobs, not real-time chat. The kernel is single-request streaming; concurrent threads only parallelize matrix multiplies, not multiple prompts.

- **Windows quirks:** On Windows, the Microsoft Store “python” alias can break the CLI. The docs warn to “install real Python” or disable the alias. Also, building CUDA parts requires MSVC. The Windows Quickstart notes NVMe+WSL2 benchmarks and stresses using NTFS on local drive (no network mount).

- **Disk wear:** Colibri reads experts but mostly does **no writes** (aside from swap or the KV cache). SSDs are safe from read wear, but heavy swapping (if RAM is exceeded) can write and shorten disk life. It’s advisable to monitor swap usage and drive temperature during long runs.

- **Concurrency:** The default `coli serve` handles one request at a time. If you need parallel inference, you must run multiple engine instances. There is no GPU sharing between sessions in Colibri’s design.

- **Security:** The OpenAI-compatible server (`coli serve`) accepts any request matching the schema. **Protect it with an API key** (`COLI_API_KEY`) if exposed beyond localhost. By default it binds to 127.0.0.1 and allows CORS from the local UI. Always set `COLI_API_KEY` before using `coli serve` in production. The engine itself has no network capabilities; it does not execute external code. However, it does persist the KV-cache (`.coli_kv`) to disk between runs, so treat that file as sensitive (it contains conversation history). Ensure you trust the loaded model weights (GLM-5.2’s license is MIT) and run the code in a secure environment. 

## Deployment Plan & Example Scripts

**1. Environment setup:** Install compiler, `git`, Python (preferable from python.org). For example, on Ubuntu:
```bash
sudo apt update && sudo apt install -y git gcc make python3 libgomp1
```
(Ensure OpenMP library is present.) On Windows, install Python and either get the prebuilt zip or set up MSYS2 as above.

**2. Clone and build:**  
```bash
git clone https://github.com/JustVugg/colibri.git
cd colibri/c
./setup.sh           # builds glm engine and tests
```

**3. Prepare models:** (GLM-5.2 example)  
```bash
# Download or convert model
# Option A: download prepared container:
pip install "huggingface_hub[hf_transfer]"
HF_HUB_ENABLE_HF_TRANSFER=1 hf download mateogrgic/GLM-5.2-colibri-int4-with-int8-mtp --local-dir /nvme/glm52_i4

# Option B: convert from FP8:
./coli convert --model /nvme/glm52_i4
```
Verify the container is ready (`coli doctor`).  

**4. Run inference:**  
- *Interactive:*  
  ```bash
  COLI_MODEL=/nvme/glm52_i4 ./coli chat --topp 0.8
  ```
- *Single prompt:*  
  ```bash
  COLI_MODEL=/nvme/glm52_i4 ./coli run "Translate to French: Hello" --topp 0.8
  ```
- *API server:*  
  ```bash
  COLI_MODEL=/nvme/glm52_i4 COLI_API_KEY=secret123 ./coli serve --host 0.0.0.0 --port 8000 --model-id glm52
  ```

**5. Measuring performance:** Use Unix `time` or `valgrind --tool=massif` to profile. For example:
```bash
# Measure latency and memory (Linux example)
/usr/bin/time -v COLI_MODEL=/nvme/glm52_i4 ./coli run "Once upon a time..." --topp 0.9
```
On Windows, use PowerShell’s `Measure-Command` or ProcMon to observe memory/disk I/O.

**Example Shell Script (3 Tiny Models Sequentially):**  
```bash
#!/bin/bash
MODELS=(tinymodelA tinymodelB tinymodelC)
for m in "${MODELS[@]}"; do
  export COLI_MODEL="/models/$m"
  echo "Running model $m..."
  /usr/bin/time -f "Real: %E, Memory: %M KB" ./coli run "Test prompt for $m" --topp 0.85
done
``` 

**Example Rust Script (Concurrent Runs):** A simple Rust program using `std::process` to spawn two Colibri servers on different ports and poll them:  
```rust
use std::process::{Command, Stdio};
fn main() {
    // Launch two Colibri servers
    let mut child1 = Command::new("bash")
        .arg("-c")
        .arg("COLI_MODEL=/models/A ./coli serve --port 8001 --model-id A")
        .stdin(Stdio::null()).spawn().unwrap();
    let mut child2 = Command::new("bash")
        .arg("-c")
        .arg("COLI_MODEL=/models/B ./coli serve --port 8002 --model-id B")
        .stdin(Stdio::null()).spawn().unwrap();
    // (In real code, handle I/O and termination properly)
    println!("Servers running: {:?}", (child1.id(), child2.id()));
}
```
This launches two isolated Colibri instances. You can then query `http://localhost:8001/v1/chat/completions` and port 8002.

**Illustrative Deployment Flow:**  

<pre class="language-mermaid">flowchart LR
    A[Install build tools (gcc, git, python)] --> B[Clone Colibri GitHub repo]
    B --> C[Build engine (`./setup.sh`)]
    C --> D[Download/convert GLM-5.2 model]
    D --> E[Run inference (`coli chat` or `coli serve`)]
    E --> F[Generate responses or serve API]
</pre>

This flow covers the key steps from setup to serving. (See [39†L274-L282] for prerequisites, [39†L344-L350] for build, [39†L358-L366] for model retrieval, and [39†L384-L390] for execution examples.)

## Comparison of Formats and Tools

| **Model Format**           | **Extension**  | **Example**                        | **Conversion Tool**       | **Colibri**                   |
|----------------------------|---------------|------------------------------------|---------------------------|-------------------------------|
| GLM-5.2 (safetensors FP8)  | .safetensors  | `mateogrgic/GLM-5.2-FP8`          | `coli convert` (Python) | Yes – outputs Colibri int4 |
| GLM-5.2 (Colibri int4)     | .safetensors  | (Mateo’s int4 container)          | –                         | Yes – load with `COLI_MODEL` |
| TinyRustLM small (SLM1)    | .slm          | (e.g. TinyLM-16M.slm)            | *None*                     | **No** (format not supported) |
| LLaMA/GPT (safetensors/gguf)| .safetensors, .gguf | `llama-7b.gguf`, `gpt2.safetensors` | llama.cpp, transformers  | No (different architecture)  |

**Sources:** Colibri’s docs and code (GLM conversion: ; GLM int4 container: ) and TinyRustLM/MiRust documentation (SLM format: ).

**Images:** Below is the Colibri web dashboard showing a live GLM-5.2 run (for illustration of metrics and UI).  

 *Figure: Colibri web UI with GPT-style chat interface and live metrics. The example shows GLM-5.2 running on 6×RTX 5090 (32 GB RAM) at ~4 tok/s. On smaller hardware, expect much lower rates.*  

**References:** Colibri repository and docs. TinyRustLM (MiRust) documentation provides model format details. All commands and behaviors are from these sources or Colibri’s official docs. 

