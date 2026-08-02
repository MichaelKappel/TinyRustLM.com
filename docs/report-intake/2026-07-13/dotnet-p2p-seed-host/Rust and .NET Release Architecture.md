# **Distribution Architecture and Native Release Engineering for the TinyRustLM P2P Companion**

## **1\. Executive Recommendation**

The release engineering architecture for the TinyRustLM P2P companion requires a resilient, cross-platform deployment strategy that seamlessly bridges a highly performant Rust core with a C\# orchestration layer. Based on a comprehensive evaluation of the .NET 10 ecosystem, Cargo build semantics, and modern supply-chain security standards, the recommended architecture utilizes a dual-package NuGet distribution model combined with a tightly constrained, C-compatible Foreign Function Interface (FFI).  
The strategy mandates the separation of the system into two distinct artifacts: a library package (UAIX.Browser.p2pRuntime.SeedHost) and a runtime-specific tool package (UAIX.Browser.p2pRuntime.SeedHost.Tool). This separation is necessary because library consumers require compile-time abstractions and transitive native asset resolution, whereas operators require a pre-compiled, standalone executable. To achieve this, the .NET 10 ToolPackageRuntimeIdentifiers property must be utilized to natively generate Runtime Identifier (RID)-specific tool packages without relying on fragile post-install scripts or extraction workarounds1.  
For the initial release, it is strictly recommended to deploy the application as a framework-dependent .NET tool rather than a single-file self-contained executable. Single-file deployments present severe hazards on Windows due to the "Mark-of-the-Web" (MotW) Zone.Identifier alternate data stream (ADS). When a single-file executable is downloaded, Windows applies the MotW; subsequent dynamic extraction of native payloads to temporary directories frequently triggers aggressive antivirus heuristics and SmartScreen blocks3. Furthermore, single-file extraction obscures the DllImportSearchPath resolution, forcing the runtime to search temporary directories rather than the deterministic application path6. A framework-dependent deployment circumvents these extraction hazards, relies on the host's vetted .NET runtime, and ensures native binaries remain statically placed within the runtimes/\<rid\>/native/ directory structure8.  
The Rust C ABI must be designed around source-generated \[LibraryImport\] bindings rather than legacy \[DllImport\]. \[LibraryImport\] guarantees Ahead-of-Time (AOT) compatibility, ensures trim safety, and bypasses the substantial overhead of the .NET runtime marshaler by generating inline IL stubs at compile time9. To avoid memory leaks and allocator mismatches, the ABI must enforce strict ownership rules: Rust must allocate all response buffers, and C\# must return those buffers to Rust for deallocation via a dedicated uaix\_free\_buffer export. Complex object hierarchies should be serialized into UTF-8 JSON envelopes and passed over the FFI boundary as raw byte spans, minimizing crossing frequency and avoiding complex struct marshaling9.  
For supply-chain integrity, the pipeline must implement a multi-layered cryptographic approach. The build environment must inject dependency metadata directly into the Rust binaries using cargo-auditable, ensuring that the compiled executable itself carries an irrefutable record of its dependencies13. Simultaneously, the Microsoft SBOM Tool must generate an SPDX 2.2 compliant Software Bill of Materials (SBOM) during the Continuous Integration (CI) pipeline15. Finally, the resulting NuGet packages must be cryptographically signed using SLSA-aligned provenance through GitHub Actions and countersigned via Sigstore's cosign to prevent artifact tampering between the CI runner and the end consumer18.

## **2\. Assumptions and Publicly Observable Product Facts**

The design of this architecture is predicated on the following publicly observable constraints and product boundaries:

* **Product Segmentation:** TinyRustLM.com operates strictly as the browser-based AI chat interface. MiniModel.org acts as the public model catalog and P2P discovery authority. The application being packaged is a downloadable operational companion designed exclusively for validating, importing, storing, and serving .slm model pieces. It does not contain chat interface logic.  
* **Domain Authority:** Rust is the absolute authority for .slm files, MiniModel manifests, cryptographic Merkle validation, import rules, and receipt generation. The C\# layer exists solely to orchestrate these functions and expose them through a narrow C ABI.  
* **Runtime Environment:** The target deployment environment must not require a Rust compiler, a C/C++ build chain, Python, Node.js, or any source checkout. The application must execute entirely from pre-compiled binaries.  
* **Target Platforms:** The required RIDs are win-x64, linux-x64, and linux-arm64.  
* **Artifact Identifiers:** The library is distributed as UAIX.Browser.p2pRuntime.SeedHost, and the executable tool as UAIX.Browser.p2pRuntime.SeedHost.Tool. The executable command exposed to the operator is uaix-p2p-seed.  
* **Isolation of Execution:** The system has no access to private source trees, unpublished NuGet packages, or proprietary build infrastructure. All pipeline designs utilize public GitHub Actions runners and standard open-source toolchains.

## **3\. Recommended ABI Contract**

To bridge the C\# orchestrator and the Rust core, a stable, synchronous C ABI is required. Due to the potentially long-running nature of model preparation and import operations, the ABI must account for cooperative cancellation, thread safety, and panic containment.

### **ABI Version Negotiation and Data Envelopes**

The ABI must be versioned to prevent runtime faults caused by mismatched C\# and Rust binaries. The initialization call must negotiate the ABI version using a dedicated handshake function. Data transfer for complex operations must utilize UTF-8 JSON envelopes. Instead of marshaling complex C-structs—which are highly susceptible to padding and alignment mismatches—the C\# layer serializes requests to UTF-8 JSON, passes the byte array to Rust, and Rust returns a UTF-8 JSON response9. This fetch-all read path minimizes P/Invoke crossing overhead.

### **Maximum Request/Response Sizes and Null Pointers**

To avoid buffer overflow vulnerabilities and strlen calculation overhead, all string and byte span transfers must pass explicit 32-bit integer lengths alongside the pointer12. The ABI must define a maximum request envelope size (e.g., 64 MiB for large manifest imports). Every exported Rust function must assert that incoming pointers are non-null before dereferencing. If a null pointer is detected, the function must return an ERR\_INVALID\_ARGUMENT code.

### **Invalid UTF-8 and Panic Containment**

While the .NET StringMarshalling.Utf8 generator ensures valid UTF-8 encoding on the C\# side9, the Rust boundary must still employ std::str::from\_utf8 to validate the incoming bytes and gracefully handle Utf8Error. Furthermore, Rust panics must never unwind across the FFI boundary into C\#, as this constitutes undefined behavior and will immediately crash the .NET runtime host. Every exported Rust function must wrap its execution in std::panic::catch\_unwind. If a panic is caught, the function must return a predefined fatal error code (e.g., \-1) and optionally populate a pre-allocated error buffer with the panic payload12.

### **Memory Ownership and Allocator Symmetry**

A fundamental rule of FFI is that memory must be freed by the allocator that created it. If C\# allocates a buffer, the .NET Garbage Collector manages it. If Rust allocates a buffer, the Rust global allocator must free it. The C ABI will dictate that C\# passes pre-allocated stack scratch buffers for small reads, but for large or unpredictable responses, Rust will allocate a Vec\<u8\>, convert it via into\_raw\_parts(), and return an opaque pointer. C\# wraps this pointer in a SafeHandle subclass to guarantee that a uaix\_free\_buffer FFI function is called during finalization or AppDomain teardown9.

### **Cooperative Cancellation: Callbacks vs. Native Handles**

Asynchronous callbacks across FFI introduce severe complexity regarding thread lifecycles and garbage collection pinning. Passing a C\# delegate to Rust requires pinning the delegate to prevent the GC from moving it, and invoking it from a background Rust thread can violate .NET execution context expectations. Subprocess isolation provides excellent fault tolerance but incurs massive Inter-Process Communication (IPC) serialization overhead, which is detrimental when processing gigabytes of model piece data.  
Instead, long-running operations will utilize explicit native operation handles. C\# initiates a process and receives an opaque uaix\_operation\_t\*. A separate thread in C\# can call uaix\_cancel\_operation(uaix\_operation\_t\*) if cancellation is requested. The Rust side monitors a corresponding Arc\<AtomicBool\> flag to cooperatively halt the operation and return a CANCELED status code12. Polling is managed entirely on the Rust side, freeing the C\# runtime from busy-wait loops.

### **Lifecycle and Cancellation State Diagram**

\[C\# Application\] \[Rust Core ABI\]  
| |  
|--- 1\. uaix\_init(version) \----------\>|  
|\<-- 2\. return 0 (Success) \-----------|  
| |  
|--- 3\. uaix\_create\_operation() \-----\>| (Allocates state)  
|\<-- 4\. return UaixOperationHandle \---|  
| |  
|--- 5\. uaix\_execute\_operation() \----\>| (Starts heavy import)  
| |  
\[User Cancels\] |  
|--- 6\. uaix\_cancel\_operation() \-----\>| (Sets atomic cancel flag)  
| | (Rust checks flag, aborts)  
|\<-- 7\. return ERR\_CANCELED \----------|  
| |  
|--- 8\. SafeHandle.Dispose() \--------\>|  
|--- 9\. uaix\_free\_operation() \-------\>| (Deallocates state)  
|\<-- 10\. return 0 \--------------------|

## **4\. Exact Package and Archive Layouts**

NuGet package layout is critical for ensuring that .NET correctly resolves platform-specific assets. The layout must strictly adhere to the runtimes/\<rid\>/native/ convention. When a project consumes UAIX.Browser.p2pRuntime.SeedHost via \<PackageReference\>, the .NET SDK build targets interrogate the runtime fallback graph and extract the native library corresponding to the host platform into the output directory8.

### **Transitive Native Asset Selection and CopyToOutputDirectory Conflicts**

A common anti-pattern in .NET native packaging is relying on \<CopyToOutputDirectory\> within project references. When compiling a RID-agnostic application, naive copy directives cause binaries for multiple Linux architectures (e.g., linux-x64 and linux-arm64) to flatten into the root bin/ path, creating file lock collisions or silently overwriting the target binary22.  
To prevent architecture flattening, the native assets must strictly remain within their RID-specific subdirectories until the final application is either published for a specific RID or executed dynamically. The .NET host implements a probing fallback mechanism; if linux-x64 is not found, the PortableRuntimeIdentifierGraph.json instructs the loader to probe broader definitions like unix-x6421. By placing the Rust shared libraries exclusively in the runtimes/ tree, NuGet completely bypasses the flattening hazard8.

### **UAIX.Browser.p2pRuntime.SeedHost (Library Package)**

The library package contains the C\# orchestration bindings and the pre-compiled Rust native libraries for all supported RIDs.  
UAIX.Browser.p2pRuntime.SeedHost.nupkg  
├── UAIX.Browser.p2pRuntime.SeedHost.nuspec  
├── lib/  
│ └── net10.0/  
│ ├── UAIX.Browser.p2pRuntime.SeedHost.dll  
│ └── UAIX.Browser.p2pRuntime.SeedHost.xml  
├── runtimes/  
│ ├── win-x64/  
│ │ └── native/  
│ │ ├── uaix\_p2p\_core.dll (Rust ABI Library)  
│ │ └── uaix-p2p-seed.exe (Rust MiniModel Server Executable)  
│ ├── linux-x64/  
│ │ └── native/  
│ │ ├── libuaix\_p2p\_core.so  
│ │ └── uaix-p2p-seed  
│ └── linux-arm64/  
│ └── native/  
│ ├── libuaix\_p2p\_core.so  
│ └── uaix-p2p-seed  
└── README.md

### **UAIX.Browser.p2pRuntime.SeedHost.Tool (.NET Tool Package)**

In .NET 10, the introduction of the ToolPackageRuntimeIdentifiers MSBuild property fundamentally alters how .NET Tools are packaged1. Instead of creating a single generic package containing all architectures, setting \<ToolPackageRuntimeIdentifiers\>win-x64;linux-x64;linux-arm64\</ToolPackageRuntimeIdentifiers\> instructs dotnet pack to produce a top-level pointer package and individual RID-specific packages1.

# **Top-Level Pointer Package**

UAIX.Browser.p2pRuntime.SeedHost.Tool.nupkg  
├── DotnetToolSettings.xml (points to rid-specific packages)

# **RID-Specific Package (e.g., win-x64)**

UAIX.Browser.p2pRuntime.SeedHost.Tool.win-x64.nupkg  
├── tools/  
│ └── net10.0/  
│ └── any/  
│ ├── DotnetToolSettings.xml (Runner \= dotnet)  
│ ├── uaix-p2p-seed.dll (C\# Orchestrator Entrypoint)  
│ ├── uaix\_p2p\_core.dll (Rust ABI Library)  
│ └── uaix-p2p-seed.exe (Rust MiniModel Server Executable)  
By defining the DotnetToolSettings.xml appropriately, executing dotnet tool install \-g UAIX.Browser.p2pRuntime.SeedHost.Tool will interrogate the host OS and seamlessly download the correct RID-specific package, mapping the CLI tool command uaix-p2p-seed to the user's PATH1.

## **5\. Build and Release Pipeline**

To maintain verifiable integrity, the CI pipeline must guarantee deterministic, isolated build directories per RID. Contamination between win-x64, WSL/Linux x64, and linux-arm64 artifacts occurs if the Cargo target directories are shared, leading to linker provenance errors and corrupted object files.

### **Cargo Build Isolation**

The build pipeline will inject a specific CARGO\_TARGET\_DIR for each platform cross-compilation target. A pinned Rust toolchain (via rust-toolchain.toml) and a committed Cargo.lock file ensure that reproducible builds are maintained across CI runs. Furthermore, strict source-revision receipts are achieved by exporting the GITHUB\_SHA into the build environment, compiled statically into the Rust binary as the semantic version identifier.  
To achieve transparent Software Composition Analysis (SCA) on the Rust binaries, the build will replace the standard cargo build command with cargo auditable build. This tool embeds the resolved dependency tree directly into the ELF/PE executable sections, allowing tools like Syft or Trivy to extract the exact dependency graph post-compilation13.  
**Concrete Cargo Build Command (Linux x64 Example):**

Bash  
\# Isolate target directory to prevent cross-contamination  
export CARGO\_TARGET\_DIR="target/linux-x64-isolated"

\# Build core library and executable with embedded SBOM data  
cargo auditable build \--release \--target x86\_64-unknown-linux-gnu \--manifest-path ./Cargo.toml

### **.NET Pack and Publish**

Once the Rust artifacts are generated, they must be moved into the correct runtimes/\<rid\>/native/ structure for the .NET pack operation.  
**Concrete .NET Tool Build Command:**

Bash  
\# Build the C\# orchestrator and pack the RID-specific tool packages  
dotnet pack src/UAIX.Browser.p2pRuntime.SeedHost.Tool/UAIX.Browser.p2pRuntime.SeedHost.Tool.csproj \\  
    \-c Release \\  
    \-p:ToolPackageRuntimeIdentifiers="win-x64;linux-x64;linux-arm64" \\  
    \-p:PublishAot=false \\  
    \-p:IncludeSymbols=true \\  
    \-p:SymbolPackageFormat=snupkg \\  
    \-p:EmbedUntrackedSources=true \\  
    \-p:PublishRepositoryUrl=true \\  
    \-o ./artifacts

The inclusion of \<IncludeSymbols\>, \<EmbedUntrackedSources\>, and \<SymbolPackageFormat\>snupkg\</SymbolPackageFormat\> ensures that SourceLink metadata is embedded within the portable PDBs. This feature enables developers to step into the C\# source code via debugging tools, as the debugger dynamically fetches the exact source code revision directly from the GitHub repository29.

### **SPDX SBOM Generation**

Simultaneously, the pipeline must generate an enterprise-grade SBOM for the overall software package. Microsoft's open-source sbom-tool generates SPDX 2.2 compliant manifests. It scans both the C\# .csproj dependencies and the Cargo.toml definitions, producing a unified cryptographic inventory that validates against the NTIA minimum elements15.  
**Concrete SBOM Command:**

Bash  
\# Download Microsoft SBOM tool  
curl \-Lo sbom-tool https://github.com/microsoft/sbom-tool/releases/latest/download/sbom-tool-linux-x64  
chmod \+x sbom-tool

\# Generate SPDX 2.2 SBOM  
./sbom-tool generate \\  
    \-b ./artifacts \\  
    \-bc ./src \\  
    \-pn UAIX.Browser.p2pRuntime.SeedHost \\  
    \-pv 1.0.0 \\  
    \-ps TinyRustLM \\  
    \-nsb https://minimodel.org/sboms

## **6\. RID Compatibility Matrix**

The application must support three primary environments. Ensuring compatibility requires strict adherence to minimum OS baselines and C standard library definitions.

| Runtime Identifier (RID) | Target Architecture | C Library Baseline | OS Baseline | Notes |
| :---- | :---- | :---- | :---- | :---- |
| win-x64 | x86\_64-pc-windows-msvc | MSVCRT / UCRT | Windows 10+ / Windows Server 2022+ | Requires Visual C++ Redistributable31. Case-insensitive file system requires careful naming of native binaries vs managed DLLs9. |
| linux-x64 | x86\_64-unknown-linux-gnu | glibc 2.27+ | Ubuntu 18.04+, RHEL 8+ | .NET 8/10 establishes Ubuntu 16.04 as a baseline, but libstdc++6 requirements for modern Rust compilation generally push this to glibc 2.27+31. |
| linux-arm64 | aarch64-unknown-linux-gnu | glibc 2.27+ | Ubuntu 18.04+, Debian 10+ | Must cross-compile from x64 CI using aarch64-linux-gnu-gcc linker. Requires emulated execution tests (QEMU). |

*Note on musl*: Alpine Linux utilizes the musl libc implementation rather than glibc. Binaries compiled for linux-x64 will immediately fault with a DllNotFoundException on Alpine because the dynamic linker (ld-linux-x86-64.so.2) is missing34. Supporting Alpine requires explicitly compiling a separate RID (linux-musl-x64) and cross-compiling the Rust core targeting x86\_64-unknown-linux-musl. This is excluded from the initial release scope.

## **7\. Supply-Chain Threat Model and Mitigations**

Distributing a P2P application handling arbitrary AI model files introduces severe supply-chain risks. The threat model includes compromised CI environments, hijacked NuGet repositories, and malicious code injection during the build process35.

### **Threat: CI Runner Compromise and Artifact Tampering**

If a threat actor compromises the GitHub Actions pipeline or intercepts the .nupkg prior to publication, they could inject malicious native binaries. **Mitigation:** Implementation of SLSA (Supply chain Levels for Software Artifacts) Level 3 provenance. GitHub Actions will utilize OpenID Connect (OIDC) to generate a non-forgeable cryptographic attestation of the build process (the provenance manifest), recording the exact source revision, build inputs, and dependencies20. The pipeline will subsequently utilize Sigstore's cosign tool to cryptographically sign the .nupkg and the SPDX JSON manifest, ensuring downstream consumers can verify the artifact's origin18.

### **Threat: Malicious Native Dependency Injection**

A malicious actor could compromise a transitive crate dependency in the Rust ecosystem. **Mitigation:** Exact dependency bounds must be defined in Cargo.toml. The integration of cargo-auditable guarantees that the compiled Rust executables contain a tamper-evident, embedded manifest of all dependencies used at compile-time13. Security teams can independently extract this data from the binary on the end-user machine without requiring the original source code. Continuous monitoring of these generated artifacts is performed via syft and grype integrations37.

### **Threat: Secret Leakage and Repo Traversal**

A developer accidentally commits a private key, or an archive extraction attack overrides local files via path traversal (../../).  
**Mitigation:** Pre-commit hooks and automated CI secret scanning must monitor the repository. The release pipeline implements archive traversal checks during the dotnet pack operation to ensure no absolute paths or parent-directory references exist within the archive boundaries. Release retention policies ensure that older, potentially vulnerable packages are soft-deprecated but retained to prevent "left-pad" style registry disruption.

### **Local vs. CI Capabilities**

Developers building locally can perform SBOM generation, cargo-auditable verification, and integration testing, but cannot mint a trusted NuGet signature or a valid SLSA attestation. Production signing credentials and OIDC context are strictly isolated to the authorized GitHub Actions publication job, preventing local developer machines from becoming high-value targets for attackers.

## **8\. CI and Release Acceptance Matrix**

The CI pipeline must enforce strict quality gates prior to release. Passing build steps alone is insufficient; the native code must prove functional across all RIDs.

| Test Gate | Target / Environment | Expected Evidence |
| :---- | :---- | :---- |
| **Native Headers** | All RIDs | Execute file and readelf/objdump on the compiled Rust binaries. Evidence must show the correct architecture (x86\_64 vs aarch64) and correct linkage. This distinguishes a cross-compiled file-header check from execution capabilities. |
| **ABI Loading (init)** | win-x64, linux-x64 | A lightweight C\# test project instantiates the \[LibraryImport\] methods. Evidence is a return code of 0 from uaix\_init(), proving the dynamic linker successfully found the library10. |
| **Emulated Exec (inspect)** | linux-arm64 (via QEMU) | The pipeline spins up a Docker container utilizing qemu-user-static for ARM64. Evidence is successful execution of uaix-p2p-seed \--version. |
| **Tool Extraction & Permissions** | linux-x64 | Execute dotnet tool install \-g UAIX.Browser.p2pRuntime.SeedHost.Tool \--add-source ./artifacts. Evidence is a successful installation layout in \~/.dotnet/tools/ and verification that executable bits (chmod \+x) are preserved on the extracted binaries5. |
| **Diagnostic Mode (doctor)** | win-x64 | Execution of uaix-p2p-seed doctor. Evidence is a successful return of the host OS and RID evaluation output, confirming that the tool correctly identifies its runtime environment. |
| **Wrong-RID Testing** | linux-x64 | Force installation of the win-x64 package onto a Linux environment. Evidence is a graceful catch of the PlatformNotSupportedException or DllNotFoundException with a human-readable diagnostic, rather than a raw segmentation fault21. |
| **Clean Consumer Restore** | All RIDs | Test dotnet restore on a clean machine referencing the newly built .nupkg. Evidence is zero MSBuild warnings regarding asset conflicts or native library resolution8. |
| **Missing-Library Test** | All RIDs | Manually delete the native .so/.dll from the test output and invoke the ABI. Evidence is the wrapper correctly reporting a missing library payload instead of executing undefined behavior. |
| **Package Metadata Check** | All .nupkg artifacts | Extraction of the NuGet package verifies that DotnetToolSettings.xml exists, no extra architectures bled into runtimes/win-x64/, the SPDX manifest.spdx.json is present, and .snupkg files are generated correctly29. |

## **9\. Failure Modes and Operator-Facing Diagnostics**

Robust operational diagnostics are vital for a P2P companion application running on disparate end-user machines. The C\# application must gracefully handle native layer failures.

* **DllNotFoundException or System.BadImageFormatException:**  
  * **Cause:** The .NET runtime failed to locate uaix\_p2p\_core in the RID-specific path, or the user is running a 32-bit OS/Runtime attempting to load a 64-bit library9.  
  * **Diagnostic:** The C\# application must catch this exception globally during startup and run the doctor command. This command interrogates RuntimeInformation.RuntimeIdentifier, compares it to the physical files present in runtimes/, and outputs a human-readable error (e.g., "FATAL: Running on linux-musl-x64 but only linux-x64 assets are installed").  
* **Missing System Dependencies (libstdc++ / glibc mismatch):**  
  * **Cause:** The Linux host has an outdated glibc (older than 2.27)33.  
  * **Diagnostic:** The C\# wrapper invokes ldd libuaix\_p2p\_core.so via an out-of-process system call and parses the output to identify unresolved symbols, displaying "Your Linux distribution is too old to support this P2P node."  
* **Panic at FFI Boundary:**  
  * **Cause:** A catastrophic failure in Rust that bypassed catch\_unwind.  
  * **Diagnostic:** To prevent a silent crash, the Rust code registers a custom panic handler during uaix\_init(). This handler writes a localized p2p-crash-\<timestamp\>.log containing the stack trace and the exact cargo-auditable dependency graph before terminating the process, allowing the operator to retrieve forensic data.  
* **File Locking and Mark-of-the-Web (Windows):**  
  * **Cause:** Windows Defender holds a lock on the executable, or MotW prevents extraction.  
  * **Diagnostic:** The C\# orchestrator uses the Win32 RestartManager API to detect which process holds the file lock. Releasing the application as a framework-dependent tool avoids dynamic extraction into %TEMP%, mitigating the vast majority of MotW execution blocks3.

## **10\. Prioritized Implementation Backlog**

### **Phase 1: First Release (Core FFI & Packaging)**

1. **Scaffold the C ABI:** Implement the Rust extern "C" functions, JSON envelope serialization, allocator symmetry functions (uaix\_free\_buffer), and explicit native handles.  
2. **RID-Isolated Build Matrix:** Configure GitHub Actions to cross-compile for win-x64, linux-x64, and linux-arm64 using dedicated CARGO\_TARGET\_DIR paths.  
3. **.NET 10 Tool Packaging:** Implement \<ToolPackageRuntimeIdentifiers\> in the C\# .csproj to automatically generate the architecture-specific .NET tool packages, avoiding manual archiving scripts1.  
4. **CI Smoke Tests:** Implement the dotnet tool install extraction test and uaix\_init() ABI verification.

### **Phase 2: Next Hardening Release (Supply Chain & Debugging)**

1. **SBOM Generation:** Integrate Microsoft sbom-tool into the pipeline to generate SPDX 2.2 documents alongside the release artifacts15.  
2. **cargo-auditable Integration:** Modify the Rust build commands to embed dependency manifests directly into the raw executable binaries13.  
3. **SourceLink and Symbols:** Configure \<PublishRepositoryUrl\>, \<EmbedUntrackedSources\>, and \<SymbolPackageFormat\>snupkg in MSBuild to push .snupkg symbol packages to NuGet, enabling transparent step-through debugging29.  
4. **SLSA & Signing:** Implement GitHub Actions OIDC SLSA provenance generation and Sigstore cosign signatures for the published .nupkg artifacts18.

### **Phase 3: Optional Future Work**

1. **Alpine Linux Support:** Add linux-musl-x64 to the ToolPackageRuntimeIdentifiers and configure a dedicated Alpine build container to compile the Rust components against musl-libc to support lightweight containerized deployments34.  
2. **Memory-Mapped Files (MMF) for FFI:** If .slm pieces passed across the boundary exceed several megabytes, replace the raw UTF-8 pointer allocation with a shared memory-mapped file architecture to eliminate memory copy overhead.

## **11\. Open Questions for Local Source Inspection**

The following technical questions require direct access to the private repository, source tree, or runtime environment to finalize the implementation:

1. **Rust Crate Dependencies:** Do any of the Rust crates in the workspace rely on dynamically linked system libraries other than glibc and libstdc++ (e.g., libssl, libsqlite3)? If so, these must be statically linked (via openssl-sys vendored features) to maintain the "no C compiler or system dependency" runtime requirement.  
2. **C\# Orchestration Workload:** How heavy is the .NET orchestration layer? If the C\# logic relies heavily on runtime reflection or dynamic code generation, it presents a trimming hazard that restricts any future migration to Native AOT.  
3. **Payload Volume Constraints:** What is the specific upper bound of the .slm JSON manifests passed across the ABI boundary? Establishing a maximum request/response size is required to pre-allocate buffers safely and avoid Out-Of-Memory (OOM) killer intervention.

## **12\. Annotated Bibliography**

* 9  
  Stoolap.io Documentation (Retrieved: July 2026). Details performance principles for C\# Native interop, specifically advocating for UTF-8 end-to-end communication, zero-allocation span binding, and strict use of SafeHandle for unmanaged resources to prevent memory leaks during AppDomain teardown.  
* 31  
  Whisper.net NuGet Package Structure (Updated: 2025). Provides a real-world example of cross-platform native library distribution using the runtimes/\<rid\>/native layout and highlights the required GLIBC versions for modern native interop.  
* 8  
  Microsoft .NET RID Catalog and Native Files Deployment (Retrieved: July 2026). Explains the runtime fallback graph and the preferred usage of portable, non-distro-specific RIDs. Documents the mechanics of deps.json generation and how native dependencies are flattened into output directories.  
* 1  
  Microsoft .NET Tool Packaging and .NET 10 Breaking Changes (Updated: 2025-2026). Details the introduction of the ToolPackageRuntimeIdentifiers MSBuild property, which fundamentally shifts how platform-specific tools are built, generating top-level pointer packages and specific RID sub-packages.  
* 3  
  Windows Mark-of-the-Web and Single-File Extraction Hazards (Retrieved: July 2026). Explains the mechanics of NTFS Alternate Data Streams (Zone.Identifier) and how dynamically extracting native payload files from single-file applications triggers severe security warnings and file-lock errors.  
* 15  
  Microsoft SBOM Tool Documentation (Retrieved: July 2026). Details the command-line usage, SPDX 2.2 support, and CI/CD integration of the sbom-tool for generating NTIA-compliant Software Bills of Materials.  
* 13  
  cargo-auditable Rust Project (Updated: 2025). Describes the methodology of embedding JSON-formatted dependency graphs directly into compiled Rust binaries to facilitate offline auditing without relying on side-car SBOM files.  
* 32  
  .NET 8/10 Linux Support Baselines (Retrieved: July 2026). Microsoft's documentation specifying the minimum glibc constraints (Ubuntu 16.04/18.04 baseline, glibc 2.27) for cross-platform Linux execution.  
* 10  
  Microsoft .NET LibraryImport Trimming Constraints (Updated: 2024-2025). Details the deprecation of DllImport for AOT and trimmed workloads in favor of source-generated LibraryImport marshalling, providing AOT safety and reducing runtime overhead.  
* 6  
  .NET Core DllImportSearchPath and Single-File Architecture (Updated: 2025). Explains the complex probing logic .NET uses to find native libraries at runtime and why single-file architectures obscure deterministic library loading.  
* 18  
  SLSA Provenance and Sigstore Cosign (Retrieved: July 2026). Defines the cryptographic requirements for securing the software supply chain, including OIDC attestations and artifact signing to prevent interception attacks.  
* 29  
  NuGet SourceLink and snupkg Properties (Updated: 2026). Outlines the specific .csproj properties (PublishRepositoryUrl, EmbedUntrackedSources, IncludeSymbols) required to generate symbol packages that allow step-through debugging of distributed NuGet binaries.

#### **Works cited**

1. Create RID-specific, self-contained, and AOT .NET tools \- .NET CLI | Microsoft Learn, [https://learn.microsoft.com/en-us/dotnet/core/tools/rid-specific-tools](https://learn.microsoft.com/en-us/dotnet/core/tools/rid-specific-tools)  
2. NET tool packaging creates RuntimeIdentifier-specific tool packages \- Microsoft Learn, [https://learn.microsoft.com/en-us/dotnet/core/compatibility/sdk/10.0/dotnet-tool-pack-publish](https://learn.microsoft.com/en-us/dotnet/core/compatibility/sdk/10.0/dotnet-tool-pack-publish)  
3. How Windows Knows Your Files Came from the Internet: Alternate Data Streams (Zone.Identifier) | by Dean | Medium, [https://medium.com/@cyberengage.org/how-windows-knows-your-files-came-from-the-internet-alternate-data-streams-zone-identifier-6243950e4f7e](https://medium.com/@cyberengage.org/how-windows-knows-your-files-came-from-the-internet-alternate-data-streams-zone-identifier-6243950e4f7e)  
4. No IOCs? No Problem\! Getting a Start Hunting for Malicious Office Files, [https://isc.sans.edu/diary/26026](https://isc.sans.edu/diary/26026)  
5. Request: Set IncludeNativeLibrariesForSelfExtract default to true · Issue \#24181 · dotnet/sdk, [https://github.com/dotnet/sdk/issues/24181](https://github.com/dotnet/sdk/issues/24181)  
6. Remove always searching executable directory for native libraries in single-file applications · Issue \#114717 · dotnet/runtime \- GitHub, [https://github.com/dotnet/runtime/issues/114717](https://github.com/dotnet/runtime/issues/114717)  
7. Support Single-File Apps in .NET 5 · Issue \#36590 · dotnet/runtime \- GitHub, [https://github.com/dotnet/runtime/issues/36590](https://github.com/dotnet/runtime/issues/36590)  
8. Including native libraries in .NET packages \- NuGet \- Microsoft Learn, [https://learn.microsoft.com/en-us/nuget/create-packages/native-files-in-net-packages](https://learn.microsoft.com/en-us/nuget/create-packages/native-files-in-net-packages)  
9. C\# Driver \- Stoolap, [https://stoolap.io/docs/drivers/csharp/](https://stoolap.io/docs/drivers/csharp/)  
10. Support LibraryImport with non-C\# languages · Issue \#98265 · dotnet/runtime \- GitHub, [https://github.com/dotnet/runtime/issues/98265](https://github.com/dotnet/runtime/issues/98265)  
11. Consider using CsWin32 for win32 Interop code · Issue \#7007 · dotnet/wpf \- GitHub, [https://github.com/dotnet/wpf/issues/7007](https://github.com/dotnet/wpf/issues/7007)  
12. Calling a C\# Native AOT DLL from C/C++, [https://comcomponent.com/en/blog/2026/03/12/003-csharp-native-aot-native-dll-from-c-cpp/](https://comcomponent.com/en/blog/2026/03/12/003-csharp-native-aot-native-dll-from-c-cpp/)  
13. cargo-auditable now supports WebAssembly, gets deployed by 5 Linux distributions : r/rust, [https://www.reddit.com/r/rust/comments/1glod3q/cargoauditable\_now\_supports\_webassembly\_gets/](https://www.reddit.com/r/rust/comments/1glod3q/cargoauditable_now_supports_webassembly_gets/)  
14. Making the conda(-forge) ecosystem ready for cybersecurity regulations, [https://tech.quantco.com/blog/conda-regulation-support/](https://tech.quantco.com/blog/conda-regulation-support/)  
15. 5 SBOM Generation Tools & 5 Critical Best Practices \- Oligo Security, [https://www.oligo.security/academy/5-sbom-generation-tools-5-critical-best-practices](https://www.oligo.security/academy/5-sbom-generation-tools-5-critical-best-practices)  
16. Open Source Tools \- SPDX, [https://spdx.dev/tools/open-source-tools/](https://spdx.dev/tools/open-source-tools/)  
17. sbom-tool-cli-reference.md \- GitHub, [https://github.com/microsoft/sbom-tool/blob/main/docs/sbom-tool-cli-reference.md](https://github.com/microsoft/sbom-tool/blob/main/docs/sbom-tool-cli-reference.md)  
18. Digitally sign DLLs with cosign · Issue \#4603 · open-telemetry/opentelemetry-dotnet-contrib, [https://github.com/open-telemetry/opentelemetry-dotnet-contrib/issues/4603](https://github.com/open-telemetry/opentelemetry-dotnet-contrib/issues/4603)  
19. Native Signing Support In Cloudsmith Extended To Docker, NuGet, And Swift, [https://cloudsmith.com/blog/native-signing-support-in-cloudsmith-extended-to-docker-nuget-and-swift](https://cloudsmith.com/blog/native-signing-support-in-cloudsmith-extended-to-docker-nuget-and-swift)  
20. Provenance \- SLSA.dev, [https://slsa.dev/spec/v1.0/provenance](https://slsa.dev/spec/v1.0/provenance)  
21. NET Runtime Identifier (RID) catalog \- Microsoft Learn, [https://learn.microsoft.com/en-us/dotnet/core/rid-catalog](https://learn.microsoft.com/en-us/dotnet/core/rid-catalog)  
22. dotnet publish, contentFiles, and transitive nuget dependencies \- Stack Overflow, [https://stackoverflow.com/questions/45970316/dotnet-publish-contentfiles-and-transitive-nuget-dependencies](https://stackoverflow.com/questions/45970316/dotnet-publish-contentfiles-and-transitive-nuget-dependencies)  
23. How to use and deliver native C/C++ libraries with .NET | by Aleksandr Grinevskii | Medium, [https://medium.com/@grinaypps/how-to-use-and-deliver-native-c-c-libraries-with-net-b53d60e01f80](https://medium.com/@grinaypps/how-to-use-and-deliver-native-c-c-libraries-with-net-b53d60e01f80)  
24. Architecture-specific folders like \`runtimes/  
25. Nupkg Containing Native Libraries \- DEV Community, [https://dev.to/jeikabu/nupkg-containing-native-libraries-1576](https://dev.to/jeikabu/nupkg-containing-native-libraries-1576)  
26. Microsoft.NET.PackTool.targets \- sdk \- GitHub, [https://github.com/dotnet/sdk/blob/main/src/Tasks/Microsoft.NET.Build.Tasks/targets/Microsoft.NET.PackTool.targets](https://github.com/dotnet/sdk/blob/main/src/Tasks/Microsoft.NET.Build.Tasks/targets/Microsoft.NET.PackTool.targets)  
27. dotnet tool install command \- .NET CLI \- Microsoft Learn, [https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-tool-install](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-tool-install)  
28. sbom \- Keywords \- crates.io: Rust Package Registry, [https://crates.io/keywords/sbom?sort=alpha](https://crates.io/keywords/sbom?sort=alpha)  
29. NuGet SourceLink and Symbol Packages: Step-Through Debugging for .NET Libraries, [https://www.devleader.ca/2026/07/11/nuget-sourcelink-and-symbol-packages-stepthrough-debugging-for-net-libraries](https://www.devleader.ca/2026/07/11/nuget-sourcelink-and-symbol-packages-stepthrough-debugging-for-net-libraries)  
30. How to configure Source Link in .NET & how to use into the Visual Studio \- Plain Concepts, [https://www.plainconcepts.com/configure-source-link-net-visual-studio/](https://www.plainconcepts.com/configure-source-link-net-visual-studio/)  
31. Whisper.net 1.9.1 \- NuGet, [https://www.nuget.org/packages/Whisper.net/](https://www.nuget.org/packages/Whisper.net/)  
32. .NET 8 End of Life: Key Dates, Risks & Next Steps Now \- TuxCare, [https://tuxcare.com/blog/net-8-end-of-life/](https://tuxcare.com/blog/net-8-end-of-life/)  
33. What's new in the SDK for .NET 8 \- NashTech Blog, [https://blog.nashtechglobal.com/whats-new-in-the-sdk-for-net-8/](https://blog.nashtechglobal.com/whats-new-in-the-sdk-for-net-8/)  
34. New features in .NET Core 3.0 on Linux \- Red Hat Developer, [https://developers.redhat.com/blog/2019/10/17/new-features-in-net-core-3-0-on-linux](https://developers.redhat.com/blog/2019/10/17/new-features-in-net-core-3-0-on-linux)  
35. Cryptographic Registry Provenance: Structural Defense Against Dependency Confusion in AI Package Ecosystems \- arXiv, [https://arxiv.org/html/2605.03309v2](https://arxiv.org/html/2605.03309v2)  
36. Supply Chain Guard · Actions · GitHub Marketplace, [https://github.com/marketplace/actions/supply-chain-guard](https://github.com/marketplace/actions/supply-chain-guard)  
37. Software Bill of Materials (SBOM) Overview and Open Source SBOM Tools \- OpenLogic, [https://www.openlogic.com/blog/software-bill-of-materials-sbom-overview](https://www.openlogic.com/blog/software-bill-of-materials-sbom-overview)  
38. fo-dicom.Codecs 5.16.4 \- NuGet, [https://www.nuget.org/packages/fo-dicom.Codecs/5.16.4](https://www.nuget.org/packages/fo-dicom.Codecs/5.16.4)