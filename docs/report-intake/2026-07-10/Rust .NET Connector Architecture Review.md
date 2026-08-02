# **Production Architecture Review and Design: TinyRustLM MemoryEndpoints Connector**

## **Executive Summary and System Topology**

This document details the production-grade, cross-language architecture for the optional MemoryEndpoints Connector subsystem. The connector operates as a critical bridge, enabling TinyRustLM applications to securely store, search, and manage short-term and long-term memory via the external MemoryEndpoints.com API or localized offline equivalents. A paramount constraint driving this architectural design is the absolute protection of TinyRustLM's proprietary intellectual property. Proprietary components—encompassing unquantized token embeddings, neural context compression algorithms, local tokenizers, re-ranking logic, and premium routing schemes—must remain strictly encapsulated within the private TinyRustLM core engine1. Only a public-safe, unclassified client boundary is compiled into the foreign function interface (FFI) and distributed via the .NET NuGet package.  
To achieve maximum execution performance without sacrificing universal platform compatibility, the architecture eschews a singular deployment model in favor of a layered hybrid approach. The .NET SDK provisions a highly portable, pure managed HTTP client (HttpClient) as a universal fallback implementation, while exposing an optional, high-performance unmanaged implementation that invokes a native Rust FFI library1. This bifurcated design guarantees cross-platform compatibility across modern .NET ecosystems, including Blazor, WebAssembly, .NET MAUI, and NativeAOT environments, while unlocking low-latency Rust-based transport and localized caching when native platform binaries are available on the host machine.

### **System Topology**

The system topology is organized to facilitate Dependency Injection resolution, abstracting the underlying transport mechanism from the consumer application.  
\+---------------------------------------------------------------------------------------------------------+  
| CONSUMER APPLICATION (.NET) | \+---------------------------------------------------------------------------------------------------------+ | \+--------------------------------+--------------------------------+  
| (Resolves via Microsoft.Extensions.DependencyInjection) | v v \+----------------------------------------+ \+----------------------------------------+  
| Managed HTTP Provider (Default) | | Native Rust Provider (Opt-In) | | \- System.Text.Json (Source Gen) | | \- P/Invoke Bridge (LibraryImport) | | \- HttpClient Transport | | \- SafeHandle Lifecycle Management | | \- Fully Portable & Trim-Safe | | \- Atomic Async Cancellation | \+----------------------------------------+ \+----------------------------------------+  
| | | (REST over HTTPS) | (Native C-ABI FFI) | v | \+----------------------------------------+ | | Unmanaged FFI Wrapper (Rust DLL) | | | \- repr(C) / extern "C" boundaries | | | \- Multi-threaded Tokio Runtime | | | \- panic::catch\_unwind Guarding | | \+----------------------------------------+ | | | | (reqwest Transport) v v \+---------------------------------------------------------------------------------------------------------+  
| MEMORYENDPOINTS.COM | | (Cloud REST API / Future LocalEndpoints) | \+---------------------------------------------------------------------------------------------------------+

## **1\. Public-Private Boundary and Intellectual Property Protection**

To guarantee that proprietary TinyRustLM logic never leaks into the public FFI or distributed NuGet packages, the architecture enforces a strict workspace separation at compile-time. The workspace is physically and logically divided into three distinct strata to prevent accidental linkage or symbol exposure.  
The **Private Core** (tinyrustlm-core) contains all proprietary large language model mechanisms. This includes conversion, quantization, ranking, training, premium routing, key handling, and proprietary orchestration1. This crate is closed-source and serves as the internal engine for TinyRustLM. The **Public Connector** (tinyrustlm-memoryendpoints) operates as a clean, open-source Rust client SDK. It is completely independent of the core engine and contains only types for connecting to the MemoryEndpoints REST API, validating parameters, serializing JSON, and managing retries1. The **Public FFI Wrapper** (tinyrustlm-memoryendpoints-ffi) constitutes the C-Application Binary Interface (ABI) boundary that compiles into shared objects (.dll, .so, .dylib). It references only the public connector crate. No proprietary code is statically linked into this binary.  
The build pipeline rigorously verifies that the NuGet package contains zero references to internal orchestration or private AI model code prior to publication, ensuring that decompilation or symbol analysis of the distributed packages yields no proprietary intellectual property1.

## **2\. Architectural Strategy: Layered .NET Design**

The decision between a pure managed HTTP client, a pure native Rust binary, and a layered hybrid approach dictates the deployment ergonomics and performance ceiling of the subsystem. Evaluating these paradigms reveals distinct trade-offs that necessitate a composite solution.

| Architectural Approach | Portability & Target Support | Performance & Local Integration | Build & Maintenance Complexity |
| :---- | :---- | :---- | :---- |
| **Pure Managed HTTP** | Universal. Runs natively in browser WebAssembly (WASM), mobile devices, and legacy platforms without modification. | High for standard REST APIs, but lacks direct offline access to native IPC or Rust-based local databases. | Low. Utilizes standard .NET HttpClient and C\# build pipelines. |
| **Pure Native Rust FFI** | Restricted. Requires pre-compiled binary matching the OS and CPU architecture (RID). | Maximum. Zero-overhead binary execution, shared local caching, and identical networking stack across all SDKs. | High. Complex FFI boundary, requires multi-platform CI cross-compilation. |
| **Layered Hybrid (Adopted)** | Universal fallback with native acceleration where supported. | Flexible. AOT-safe managed execution with high-throughput native acceleration upon RID match. | Medium. Well-defined abstraction interfaces isolate FFI complexity. |

The SDK adopts the layered approach. The IMemoryEndpointsClient interface acts as the unified contract across the .NET ecosystem. At runtime, the Dependency Injection container evaluates the underlying operating system and architecture via a NativeRuntimeLoader. If a matching native library is found within the application's execution directory (e.g., win-x64, linux-x64, osx-arm64), the NativeMemoryEndpointsClient is instantiated, providing accelerated memory access1. If the platform is unsupported, such as a browser WebAssembly environment or a novel CPU architecture, the factory safely falls back to the ManagedMemoryEndpointsClient, avoiding fatal DllNotFoundException errors and ensuring continuous operational stability1.

## **3\. Public Rust API Design**

The public Rust API is designed for safe consumption by both native Rust applications and the FFI translation layer. All structures prioritize semantic correctness, immutability where possible, and strict serde serialization contracts that avoid lifetime coupling to the underlying memory buffers1.  
The configuration and credential structures define the entry point for the API.

Rust  
use serde::{Deserialize, Serialize};  
use std::collections::HashMap;  
use std::time::Duration;  
use url::Url;

\#\[derive(Debug, Clone, Serialize, Deserialize)\]  
pub struct Configuration {  
    pub endpoint\_url: Url,  
    pub workspace\_id: String,  
    pub agent\_id: String,  
    pub timeout: Duration,  
    pub retry\_policy: RetryPolicy,  
}

\#\[derive(Debug, Clone, Serialize, Deserialize)\]  
pub enum Credentials {  
    BearerToken(String),  
    ApiKey { header\_name: String, key: String },  
    None,  
}

The memory storage mechanism relies on explicitly defined tiers and public-safe request bodies. The request payloads are strictly delineated to prevent the accidental transmission of unquantized model weights or proprietary embeddings to the remote endpoint.

Rust  
\#\[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)\]  
\#\[serde(rename\_all \= "snake\_case")\]  
pub enum MemoryTier {  
    ShortTerm,  
    LongTerm,  
}

\#\[derive(Debug, Clone, Serialize, Deserialize)\]  
pub struct SaveRequest {  
    pub scope: String,  
    pub tier: MemoryTier,  
    pub body: String,  
    pub summary: String,   
    pub metadata: HashMap\<String, String\>,  
    pub idempotency\_key: String,  
}

\#\[derive(Debug, Clone, Serialize, Deserialize)\]  
pub struct SearchRequest {  
    pub scope: String,  
    pub query: String,  
    pub tiers: Vec\<MemoryTier\>,  
    pub limit: usize,  
    pub min\_relevance: f32,  
}

Response structures are formalized to return standardized memory items, complete with relevance scoring and ISO8601 UTC timestamps, facilitating deterministic sorting on the client side.

Rust  
\#\[derive(Debug, Clone, Serialize, Deserialize)\]  
pub struct MemoryItem {  
    pub id: String,  
    pub tier: MemoryTier,  
    pub body: String,  
    pub summary: String,  
    pub relevance: f32,  
    pub created\_at: String,  
    pub metadata: HashMap\<String, String\>,  
}

\#\[derive(Debug, Clone, Serialize, Deserialize)\]  
pub struct SearchResponse {  
    pub results: Vec\<MemoryItem\>,  
}

To support resilience and observability, the Rust API includes customizable retry policies and structured diagnostic outputs. These diagnostic structures are explicitly designed to omit sensitive memory payloads and credential headers, ensuring safe logging across distributed tracing systems.

Rust  
\#\[derive(Debug, Clone, Serialize, Deserialize)\]  
pub struct RetryPolicy {  
    pub max\_attempts: u32,  
    pub initial\_delay\_ms: u64,  
    pub max\_delay\_ms: u64,  
    pub multiplier: f32,  
}

\#\[derive(Debug, Clone, Serialize, Deserialize)\]  
pub struct Diagnostics {  
    pub request\_duration\_ms: u64,  
    pub bytes\_sent: usize,  
    pub bytes\_received: usize,  
    pub status\_code: u16,  
    pub is\_success: bool,  
}

These definitions avoid domain leakage by utilizing standard library types and decoupled structures rather than internal engine references.

## **4\. Async Transport Abstraction**

The Rust engine relies on a decoupled, environment-agnostic asynchronous transport trait. This abstraction ensures unified testing, safe browser execution, and future-proof offline integration by isolating the networking execution layer from the memory serialization logic1.

Rust  
use crate::types::{Diagnostics, SaveRequest, SearchRequest, SearchResponse};  
use async\_trait::async\_trait;

\#\[async\_trait\]  
pub trait AsyncTransport: Send \+ Sync {  
    async fn save\_memory(  
        &self,  
        request: \&SaveRequest,  
        auth\_header: Option\<(&str, &str)\>,  
    ) \-\> Result\<Diagnostics, TransportError\>;

    async fn search\_memory(  
        &self,  
        request: \&SearchRequest,  
        auth\_header: Option\<(&str, &str)\>,  
    ) \-\> Result\<(SearchResponse, Diagnostics), TransportError\>;  
}

\#\[derive(Debug, Clone, thiserror::Error)\]  
pub enum TransportError {  
    \#\[error("Network connection failed: {0}")\]  
    Network(String),  
    \#\[error("API responded with error status {status}: {body}")\]  
    ApiError { status: u16, body: String },  
    \#\[error("Execution timeout")\]  
    Timeout,  
    \#\[error("Serialization / Parsing failure: {0}")\]  
    Serialization(String),  
}

The system provides several specialized transport implementations dictated by the compilation target. The **Native Cloud Transport** (ReqwestTransport) is implemented using the reqwest crate and powered by a multi-threaded tokio runtime1. It utilizes connection pooling, native HTTP/2, and platform-native Transport Layer Security (TLS)—specifically Schannel on Windows, Security-Framework on macOS, and OpenSSL on Linux2.  
When compiling for the wasm32-unknown-unknown target, raw TCP sockets are prohibited by the browser sandbox. The transport layer conditionally swaps the implementation to the **Browser/WASM Fetch Transport** (BrowserFetchTransport), mapping HTTP calls to the browser's native fetch API via web-sys and wasm-bindgen-futures3. Under this context, TLS configuration is disabled within reqwest as the browser environment inherently manages secure connections, cookies, and Cross-Site Request Forgery (CSRF) headers through browser-managed origins2.  
For testing methodologies, the **In-Memory Fake Transport** (MockTransport) implements the trait by writing to and reading from a thread-safe Arc\<RwLock\<Vec\<MemoryItem\>\>\>. This enables the execution of contract and property tests in continuous integration environments without any reliance on network availability1. Finally, the architectural blueprint includes provisions for a **Future Offline Transport** (LocalEndpointsTransport), designed to bypass the public internet entirely and communicate directly with a local desktop daemon over Unix domain sockets or Windows named pipes, offering sub-millisecond local caching capabilities.

## **5\. Native FFI Boundary, Ownership, and Cancellation**

The execution of asynchronous unmanaged Rust code from .NET requires rigorous handling of thread state, memory ownership, and panic semantics. The unmanaged bridge exposes a pure C-ABI boundary, ensuring compatibility with the .NET runtime's P/Invoke marshaller.

### **Crash Safety and Unwind Guarding**

Panicking across an FFI boundary results in undefined behavior, which often manifests as catastrophic process termination, such as segmentation faults or access violations5. To ensure absolute system resilience and protect the host .NET process, all unmanaged FFI entry points are guarded with std::panic::catch\_unwind1. If a panic is intercepted within the Rust execution context, the function safely transitions to a standardized FfiResult containing a negative HRESULT integer (e.g., \-2147467259 for E\_FAIL) and a safely allocated error string1.

### **Memory Ownership and String Encodings**

Memory leaks at the FFI boundary represent a significant technical debt if not meticulously managed. The architecture dictates that inputs (such as request JSON strings) are borrowed exclusively for the duration of the FFI function call. The Rust layer receives \*const c\_char pointers, translates them to CStr, and parses the UTF-8 payload1.  
Outputs originating from Rust are allocated on the unmanaged heap via CString::into\_raw(). Crucially, to prevent asymmetrical allocator issues where C\# attempts to free Rust-allocated memory via CoTaskMemFree, the C\# client is strictly required to pass these pointers back to the Rust layer via a dedicated tinyrustlm\_free\_string export1.

Rust  
use std::ffi::{CStr, CString};  
use std::os::raw::{c\_char, c\_void};  
use std::sync::Arc;  
use tokio::runtime::Runtime;  
use tokio\_util::sync::CancellationToken;

pub struct TokioRuntimeWrapper {  
    pub inner: Runtime,  
}

pub struct MemoryClientWrapper {  
    pub runtime: Arc\<Runtime\>,  
    pub transport: Arc\<dyn AsyncTransport\>,  
}

pub struct CancelHandleWrapper {  
    pub token: CancellationToken,  
}

\#\[repr(C)\]  
pub struct FfiResult {  
    pub status\_code: i32,  
    pub error\_msg: \*mut c\_char,  
}

impl FfiResult {  
    pub fn success() \-\> Self {  
        Self { status\_code: 0, error\_msg: std::ptr::null\_mut() }  
    }

    pub fn error(hresult: i32, message: &str) \-\> Self {  
        let c\_str \= CString::new(message).unwrap\_or\_else(|\_| CString::new("FFI Error").unwrap());  
        Self { status\_code: hresult, error\_msg: c\_str.into\_raw() }  
    }  
}

\#\[no\_mangle\]  
pub unsafe extern "C" fn tinyrustlm\_free\_string(ptr: \*mut c\_char) {  
    if \!ptr.is\_null() {  
        let \_ \= CString::from\_raw(ptr);  
    }  
}

### **Async FFI Dispatch and Cooperative Cancellation**

Because C\# and Rust do not share task executors or a unified poll loop, asynchronous interoperability requires an unmanaged callback bridge6. The native code spawns a multi-threaded Tokio task and immediately returns control to the calling C\# thread, preventing the .NET thread pool from becoming blocked or starved during network I/O1. When the Tokio task completes, it invokes a provided C-style callback function pointer1.  
A critical race condition exists in this architecture: a fast-executing Tokio task might complete and trigger the callback before the .NET caller has finished registering its cancellation handlers. To resolve this without introducing costly synchronization locks, the architecture employs an atomic three-state cooperative cancellation scheme using tokio\_util::sync::CancellationToken1. The pointer to the native cancellation token is passed back to C\#, which manages it as an atomic state machine, guaranteeing that cancellation signals are dispatched safely and double-frees are mathematically impossible6.

Rust  
pub type FfiSaveCallback \= extern "C" fn(  
    user\_data: \*mut c\_void,  
    status\_code: i32,  
    response\_json: \*const c\_char,  
    error\_msg: \*const c\_char,  
);

\#\[no\_mangle\]  
pub unsafe extern "C" fn tinyrustlm\_save\_memory\_async(  
    client: \*mut MemoryClientWrapper,  
    request\_json: \*const c\_char,  
    callback: FfiSaveCallback,  
    user\_data: \*mut c\_void,  
    out\_cancel\_handle: \*mut \*mut CancelHandleWrapper,  
) \-\> FfiResult {  
    std::panic::catch\_unwind(|| {  
        if client.is\_null() || request\_json.is\_null() || out\_cancel\_handle.is\_null() {  
            return FfiResult::error(-2147467261, "Null pointer argument");  
        }

        let client \= &\*client;  
        let request\_str \= match CStr::from\_ptr(request\_json).to\_str() {  
            Ok(s) \=\> s,  
            Err(e) \=\> return FfiResult::error(-2147024809, &format\!("Invalid UTF-8: {}", e)),  
        };

        let request: SaveRequest \= match serde\_json::from\_str(request\_str) {  
            Ok(r) \=\> r,  
            Err(e) \=\> return FfiResult::error(-2147024809, &format\!("JSON parse error: {}", e)),  
        };

        let cancel\_token \= CancellationToken::new();  
        let ffi\_cancel\_token \= cancel\_token.clone();  
          
        let cancel\_wrapper \= Box::into\_raw(Box::new(CancelHandleWrapper { token: cancel\_token }));  
        \*out\_cancel\_handle \= cancel\_wrapper;

        let transport \= Arc::clone(\&client.transport);

        client.runtime.spawn(async move {  
            let save\_future \= transport.save\_memory(\&request, None); // Auth omitted for brevity

            tokio::select\! {  
                res \= save\_future \=\> {  
                    match res {  
                        Ok(diagnostics) \=\> {  
                            let json\_res \= serde\_json::to\_string(\&diagnostics).unwrap\_or\_default();  
                            let c\_json \= CString::new(json\_res).unwrap();  
                            callback(user\_data, 0, c\_json.as\_ptr(), std::ptr::null());  
                        }  
                        Err(e) \=\> {  
                            let err\_str \= CString::new(e.to\_string()).unwrap();  
                            callback(user\_data, \-1, std::ptr::null(), err\_str.as\_ptr());  
                        }  
                    }  
                }  
                \_ \= ffi\_cancel\_token.cancelled() \=\> {  
                    let cancel\_err \= CString::new("Operation was cancelled").unwrap();  
                    callback(user\_data, \-2147467260, std::ptr::null(), cancel\_err.as\_ptr()); // E\_ABORT  
                }  
            }  
        });

        FfiResult::success()  
    })  
    .unwrap\_or\_else(|\_| FfiResult::error(-2147467259, "Panic within async dispatch"))  
}

## **6\. Idiomatic C\# Abstractions and Consumer Ergonomics**

The C\# abstractions are designed to feel natively idiomatic to .NET developers, avoiding the mechanical mirroring of C structures. The public API relies heavily on C\# records for immutability and value equality, Task\<T\> for Task-based Asynchronous Pattern (TAP) execution, and standard cancellation tokens1.  
Consumer ergonomics are prioritized to ensure developers can persist and search context easily. A typical workflow involves resolving the IMemoryEndpointsClient and executing requests mapping to natural domain operations, such as short-term saving, long-term archiving, or scoped model-context retrieval.

C\#  
namespace TinyRustLM.MemoryEndpoints;

using System;  
using System.Collections.Generic;  
using System.Threading;  
using System.Threading.Tasks;

public enum MemoryTier { ShortTerm, LongTerm }

public record SaveMemoryRequest(  
    string Scope,  
    MemoryTier Tier,  
    string Body,  
    string Summary,  
    Dictionary\<string, string\> Metadata,  
    string IdempotencyKey  
);

public record SearchMemoryRequest(  
    string Scope,  
    string Query,  
    List\<MemoryTier\> Tiers,  
    int Limit,  
    float MinRelevance  
);

public record DiagnosticsRecord(  
    double DurationMs,  
    int BytesSent,  
    int BytesReceived,  
    int StatusCode,  
    bool IsSuccess  
);

public interface IMemoryEndpointsClient : IDisposable, IAsyncDisposable  
{  
    Task\<DiagnosticsRecord\> SaveMemoryAsync(SaveMemoryRequest request, CancellationToken cancellationToken \= default);  
    Task\<IReadOnlyList\<MemoryItem\>\> SearchMemoryAsync(SearchMemoryRequest request, CancellationToken cancellationToken \= default);  
}

An application developer retrieving a localized conversation context for an AI agent might execute a tiered search across both short-term and long-term memory simultaneously:

C\#  
var searchRequest \= new SearchMemoryRequest(  
    Scope: "agent-session-90210",  
    Query: "Previous directives regarding user authentication",  
    Tiers: new List\<MemoryTier\> { MemoryTier.ShortTerm, MemoryTier.LongTerm },  
    Limit: 5,  
    MinRelevance: 0.85f  
);

// Results ordered by relevance, abstracting the dual-tier search logic  
var contextMemories \= await memoryClient.SearchMemoryAsync(searchRequest, cancellationToken);

## **7\. Validation Guardrails and Structured Diagnostics**

Protecting the transport layer from malformed inputs and preventing the leakage of sensitive data into observability platforms are core tenets of the architecture. The API enforces strict boundary validation prior to any network execution.  
Validation rules are explicitly applied to strings traversing the system1. The EndpointUrl must be a valid absolute URI starting with https:// (or http:// for local loopback testing). Workspace and Agent identifiers are confined to alphanumeric characters, hyphens, and underscores via regular expressions (^\[a-zA-Z0-9-\_\]+$), with length bounds enforced to prevent buffer exhaustion attacks. The Summary field attached to memories is capped at 200 characters and represents a public-safe abstraction; any payload resembling API tokens, passwords, or raw unquantized context embeddings is rejected at the client level before transmission.  
Structured diagnostics ensure observability without exposing intellectual property or personal data. The DiagnosticsRecord strictly excludes raw request bodies, response payloads, bearer tokens, and granular system prompts. It explicitly curates only operational metrics, such as payload sizes (BytesSent, BytesReceived), network latency (DurationMs), and result states (StatusCode, IsSuccess)1. This guarantees that diagnostic objects can be securely serialized to centralized logging systems.

## **8\. Secret Injection and Dependency Injection Registration**

Security compliance strictly forbids the retention of raw credentials within static configuration objects, as long-lived options classes are highly susceptible to exposure during application memory dumps or diagnostic collection1. Instead, the architecture utilizes a transient MemoryEndpointsCredentialResolver delegate, injecting secrets on demand immediately prior to transport execution1.

C\#  
using Microsoft.Extensions.DependencyInjection;  
using Microsoft.Extensions.Options;

public delegate Task\<string\> MemoryEndpointsCredentialResolver(CancellationToken cancellationToken);

public static class MemoryEndpointsServiceCollectionExtensions  
{  
    public static IServiceCollection AddMemoryEndpointsClient(  
        this IServiceCollection services,  
        Action\<MemoryEndpointsOptions\> configureOptions,  
        MemoryEndpointsCredentialResolver credentialResolver)  
    {  
        services.Configure(configureOptions);  
        services.AddSingleton\<IValidateOptions\<MemoryEndpointsOptions\>, MemoryEndpointsOptionsValidator\>();  
        services.AddSingleton(credentialResolver);  
          
        services.AddSingleton\<IMemoryEndpointsClient\>(sp \=\>  
        {  
            var options \= sp.GetRequiredService\<IOptions\<MemoryEndpointsOptions\>\>().Value;  
            var resolver \= sp.GetRequiredService\<MemoryEndpointsCredentialResolver\>();  
              
            if (NativeRuntimeLoader.IsNativeSupportedAndPresent())  
            {  
                return new NativeMemoryEndpointsClient(options, resolver);  
            }  
            return new ManagedMemoryEndpointsClient(options, resolver);  
        });  
        return services;  
    }  
}

Options validation implements the IValidateOptions\<T\> interface from .NET, applying rigorous constraints on the configuration object at application startup. This enforces fail-fast semantics, rejecting invalid endpoints or missing identifiers before the first memory operation is ever attempted1.

## **9\. Resilience, Resource Management, and Polly v8**

Proper resource management is vital to prevent memory leaks, while robust resilience strategies are required to handle distributed network instability elegantly.

### **IAsyncDisposable Lifecycle Management**

The SDK ensures IAsyncDisposable is correctly implemented using the DisposeAsyncCore pattern8. The native client safely invokes unmanaged cleanup routines, wrapping pointers in SafeHandle classes to guarantee release even during application crashes, preventing leaks on the unmanaged heap9. The managed fallback client safely disposes of the underlying HttpClient and associated message handlers. The underlying resources are disposed of asynchronously without blocking the finalizer thread, cascading disposal properly through the dependency graph10.

### **Resilience with Polly v8 Circuit Breakers**

To handle transient faults on the managed fallback implementation, the SDK integrates sophisticated resilience pipelines utilizing the modern Microsoft.Extensions.Http.Resilience package (Polly v8)11.  
The pure managed client configures the HttpClient with a comprehensive pipeline using the modern AddResilienceHandler syntax, replacing the deprecated AddTransientHttpErrorPolicy11. The pipeline incorporates:

1. **Exponential Backoff and Jitter**: Retries failed network requests with randomized delay spacing. The jitter prevents the "thundering herd" problem, where numerous client instances retry simultaneously and inadvertently DDOS a recovering service12. During these retries, the IdempotencyKey provided in the SaveMemoryRequest guarantees that remote systems safely dedup concurrent submissions1.  
2. **Circuit Breaker Pattern**: Configured via HttpCircuitBreakerStrategyOptions, this policy monitors the failure ratio across a defined sampling duration11. If the failure threshold is exceeded, the circuit transitions to an open state. Subsequent requests are immediately short-circuited, throwing a BrokenCircuitException locally rather than exacerbating resource exhaustion on the distressed downstream service13.

*Note: The native Rust client handles retries and connection timeouts internally via Tokio routines based on the identical configuration parameters, ensuring functional parity without imposing dual resilience configurations on the consumer.*

## **10\. Stable Serialization Contracts and Schema Versioning**

The architectural design mandates strict JSON serialization contracts to facilitate Multi-Agent Task Management (MATM) registrations, memory submissions, searches, and meeting coordinations.

### **Serialization Payload Specifications**

The JSON schemas are carefully modeled to ensure exact parity across the Rust and C\# runtimes.  
**MATM Registration** defines the capabilities and identifiers of the connected agent:

JSON  
{  
  "workspace\_id": "workspace-prod-009",  
  "agent\_id": "agent-orchestrator",  
  "agent\_role": "context\_coordinator",  
  "capabilities": \["tiered\_search", "long\_term\_retrieval"\],  
  "registered\_at": "2026-07-10T10:49:31Z",  
  "schema\_version": "1.0.0"  
}

**Memory Submission** serializes the context payload with strict idempotency:

JSON  
{  
  "scope": "user\_123-session\_abc",  
  "tier": "short\_term",  
  "body": "User requested dark mode and strict context limits.",  
  "summary": "User UI preferences.",  
  "metadata": {  
    "token\_count": "11"  
  },  
  "idempotency\_key": "idem-99x-11a"  
}

**Meeting Coordination** negotiates multi-agent context retrieval parameters, ensuring integer bounds are respected to prevent serialization overflows:

JSON  
{  
  "meeting\_id": "meet-9812-ad",  
  "participants": \["agent-orchestrator", "agent-summarizer"\],  
  "context\_token\_limit": 8192  
}

### **Forward Compatibility**

API schemas naturally evolve over time, frequently introducing novel fields. To prevent catastrophic deserialization exceptions when newer properties appear in API responses, both the Rust and .NET systems strictly enforce forward compatibility mechanisms1.

* **Rust (serde)**: Structs explicitly avoid the \#\[serde(deny\_unknown\_fields)\] macro, allowing the default behavior to gracefully ignore and truncate unmapped JSON elements.  
* **C\# (System.Text.Json)**: Serialization generation options specify JsonUnmappedMemberHandling.Ignore, ensuring that the introduction of new keys in the MemoryEndpoints.com payload does not break legacy compiled clients1.

## **11\. Trimming, NativeAOT, and Browser/WASM Compatibility**

NativeAOT ahead-of-time compilation strips the .NET application of runtime reflection and dynamic MSIL generation capabilities, fundamentally altering how interop and serialization function15. To remain robust in strict NativeAOT and trimmed environments, the SDK aggressively adopts modern .NET features.

### **System.Text.Json Source Generators**

The SDK bypasses reflection-based serialization entirely by registering a JsonSerializerContext initialized via the JsonSourceGenerationOptions attribute17.

C\#  
namespace TinyRustLM.MemoryEndpoints;

using System.Text.Json.Serialization;

\[JsonSourceGenerationOptions(  
    PropertyNamingPolicy \= JsonKnownNamingPolicy.CamelCase,  
    DefaultIgnoreCondition \= JsonIgnoreCondition.WhenWritingNull,  
    UnmappedMemberHandling \= JsonUnmappedMemberHandling.Ignore   
)\]  
\[JsonSerializable(typeof(SaveMemoryRequest))\]  
\[JsonSerializable(typeof(DiagnosticsRecord))\]  
internal partial class MemoryJsonSourceGenContext : JsonSerializerContext { }

This configuration enforces the static analysis of all serialization paths at compile time. By shifting the reflection cost to the build phase, it eliminates the IL2026 (RequiresUnreferencedCodeAttribute) warnings associated with NativeAOT builds, reduces application footprint, and increases throughput20.

### **Unmanaged Callback Safety and LibraryImport**

Traditional P/Invoke marshalling via \[DllImport\] generates runtime IL stubs that are incompatible with NativeAOT23. The FFI boundary therefore utilizes \[LibraryImport\] source generators, which emit static C\# marshalling logic at compile time23.  
Furthermore, passing standard managed delegates to unmanaged callbacks introduces extreme risk; if a delegate is garbage collected by the .NET runtime while an unmanaged function still holds a pointer to it, a catastrophic access violation occurs (as monitored by the callbackOnCollectedDelegate Managed Debugging Assistant)25.  
To solve this safely and deterministically within NativeAOT, the callback bridge uses static unmanaged function pointers (delegate\* unmanaged) attributed with \[UnmanagedCallersOnly\]28. The unmanaged calling convention must be explicitly specified (e.g., CallConvCdecl) to guarantee stack alignment across the boundary, as NativeAOT prohibits implicit transitions29.

C\#  
using System.Runtime.InteropServices;  
using System.Runtime.CompilerServices;

internal static partial class NativeMethods  
{  
    \[LibraryImport("tinyrustlm\_memoryendpoints\_ffi", EntryPoint \= "tinyrustlm\_save\_memory\_async")\]  
    internal static partial FfiResult SaveMemoryAsync(  
        IntPtr client,  
        \[MarshalAs(UnmanagedType.LPUTF8Str)\] string requestJson,  
        delegate\* unmanaged\[Cdecl\]\<IntPtr, int, IntPtr, IntPtr, void\> callback,  
        IntPtr userData,  
        out IntPtr outCancelHandle  
    );

    \[LibraryImport("tinyrustlm\_memoryendpoints\_ffi", EntryPoint \= "tinyrustlm\_cancel\_operation")\]  
    \[SuppressGCTransition\] // Prevents GC suspension overhead for micro-calls  
    internal static partial FfiResult CancelOperation(IntPtr cancelHandle);  
}

The C\# implementation coordinates the callback via a TaskCompletionSource, explicitly initialized with TaskCreationOptions.RunContinuationsAsynchronously to prevent C\# awaiter continuations from hijacking the unmanaged Tokio thread1.

## **12\. Packaging, Metadata, and Semantic Versioning**

The SDK leverages the modern .nupkg runtime identifier (RID) layout to distribute pre-compiled native binaries in a unified package1. When the consumer application is published, the .NET SDK seamlessly analyzes the RID graph and extracts the appropriate unmanaged binary matching the target architecture.

### **Package Layout**

The NuGet archive is internally structured to provide standard managed references alongside platform-specific native libraries.  
TinyRustLM.MemoryEndpoints.nupkg ├── lib/net8.0/ │ └── TinyRustLM.MemoryEndpoints.dll (Managed logic and P/Invoke bindings) ├── ref/net8.0/ │ └── TinyRustLM.MemoryEndpoints.dll (Reference assembly targeting AnyCPU) └── runtimes/ ├── win-x64/native/tinyrustlm\_memoryendpoints\_ffi.dll ├── linux-x64/native/libtinyrustlm\_memoryendpoints\_ffi.so ├── osx-x64/native/libtinyrustlm\_memoryendpoints\_ffi.dylib └── osx-arm64/native/libtinyrustlm\_memoryendpoints\_ffi.dylib  
To enable seamless developer discoverability and debugging, the .csproj file contains rich metadata, including comprehensive tags (rust, dotnet, ffi, tinyrustlm, vector-cache), a README, and proper license expressions1. Source Link is configured by injecting \<EmbedUntrackedSources\>true\</EmbedUntrackedSources\> and packaging symbols into a separated .snupkg archive, allowing consumers to step directly into the C\# source code during debugging1.

### **Semantic Versioning Compatibility Matrix**

Versioning across language paradigms is meticulously synchronized to prevent breaking integrations across disparate domains1.

| Interoperability Layer | Version Scheme | Compatibility Policy |
| :---- | :---- | :---- |
| **API JSON Schema** | v1.x.y | Strict semantic versioning. Additive properties only. |
| **Native Rust DLL ABI** | v2.x.y | C-compatible entry points. Any FFI signature alteration forces a symbol rename and major version increment. |
| **.NET NuGet Package** | v2.x.y | Packages strongly match and bundle the corresponding Native Rust ABI major version. |

## **13\. Analysis of API Weaknesses and Technical Debt**

An audit of the preceding TinyRustLM integration pipeline reveals several critical technical debts and leaky abstractions that this modern architecture strictly rectifies1.  
The foremost weakness involved unmanaged heap leaks. Previous integrations relied on returning raw strings from Rust to C\# where the managed runtime inherently attempted pointer disposal via CoTaskMemFree. While this strategy functions intermittently on Windows COM subsystems, it resulted in systemic, uncatchable unmanaged memory leaks on Linux and macOS environments. The new architecture strictly mandates explicit allocation control: all C-strings originating on the Rust heap are copied within the C\# callback and destroyed via explicit calls to the Rust-exported tinyrustlm\_free\_string1.  
Secondly, historical implementations suffered from Thread Pool starvation. The legacy C\# FFI invoked blocking waits (e.g., futures::executor::block\_on) across the boundary1. This locked managed ThreadPool threads during network I/O, freezing user interfaces and exhausting server resources. The new architecture transitions purely to an asynchronous callback-driven dispatch, returning immediately to unblock the caller.  
Finally, the legacy subsystem lacked strict validation boundaries. Untrusted schema boundaries allowed malformed strings and oversize payloads to enter the Rust transport layer directly, risking buffer issues. The new architecture enforces strict limits, regex validations, and summary stripping prior to serialization on both sides of the boundary1.

## **14\. Comprehensive Test Matrix**

Robust verification requires multi-tiered evaluation spanning language boundaries. The test matrix enforces validation at the unit, interoperability, and platform levels.

| Testing Tier | Verification Strategy | Core Assertions |
| :---- | :---- | :---- |
| **Rust Unit & Property Tests** | proptest generators inject high-entropy, malformed UTF-8 identifiers into URL and scope parsers. | Validates that rejection mechanisms drop malformed data without triggering panics. |
| **Schema Evolution** | Deserialization pipelines are fed JSON responses containing injected schema permutations. | Proves forward-compatibility handling; serde and System.Text.Json ignore unknown fields. |
| **Session Secret Handling** | Security suites execute automated memory scans against application core dumps following transport execution. | Confirms raw credentials and bearer tokens do not persist on the heap after garbage collection. |
| **Retry & Idempotency** | Fake transport interceptors simulate HTTP 503 Service Unavailable failures. | Enforces that Tokio and Polly engines apply exponential jittered backoff while preserving the exact idempotency\_key. |
| **Cancellation Preemption** | C\# tests invoke immediate cancellation via CancellationTokenSource.Cancel() during an active wait. | Asserts that atomic cancellation propagates through the FFI, pre-empting the Tokio task without introducing double-free race conditions. |
| **Browser/WASM Connectors** | Tests compiled to WASM are executed in headless browser automation instances (Karma/Selenium). | Ensures the HTTP transport layer bypasses raw TCP sockets and seamlessly maps requests directly into the browser's fetch API sandbox. |

## **15\. CI/CD Release Pipeline and Automated Gates**

The build pipeline leverages robust, deterministic gating logic prior to the publication of the NuGet artifacts, ensuring that compromised or flawed code never reaches the distribution repository.

1. **Multi-Platform Compilation**: Parallel worker nodes compile the Rust .cdylib targets across win-x64, linux-x64, and macos-arm64. Resultant unmanaged binaries are staged into the appropriate NuGet runtimes/ subdirectory1.  
2. **Static Analysis (SAST)**: C\# code is evaluated against Roslyn analyzers, while Rust code undergoes strict cargo clippy enforcement. A cargo audit step explicitly blocks dependencies burdened with known security vulnerabilities1.  
3. **Intellectual Property Leak Scanning**: Custom analyzers perform symbol and static string scanning on the final .so/.dll artifacts. The build terminates immediately if any proprietary class structures, neural configurations, or module namespaces belonging to tinyrustlm-core are detected in the public binaries1.  
4. **Live Environment Credential Policy**: Standard integration tests execute strictly against the local MockTransport. Live tests accessing MemoryEndpoints.com require explicit environment opt-in (RUN\_LIVE\_TESTS=1) and are strictly relegated to protected release branches interacting with secure key stores. Unit tests never possess or demand production credentials1.  
5. **AOT Assembly Validation**: Prior to packaging, test environments perform a dotnet publish \-p:PublishAot=true pass. Any warnings related to trim-compatibility or reflection utilization act as hard release blocks. Intermediate .nupkg and .snupkg files are unzipped and programmatically scanned by the CI agent to confirm that RID folders contain valid machine code libraries, rejecting the build if defensive stubs are present.

#### **Works cited**

1. [unknown\_url](http://docs.google.com/unknown_url)  
2. reqwest \- Rust \- Docs.rs, [https://docs.rs/reqwest/](https://docs.rs/reqwest/)  
3. web-sys: using fetch \- The \`wasm-bindgen\` Guide \- Rust and WebAssembly, [https://rustwasm.github.io/docs/wasm-bindgen/examples/fetch.html](https://rustwasm.github.io/docs/wasm-bindgen/examples/fetch.html)  
4. \[Rust\] Don't use the \`reqwest\` crate when compiling to \`wasm\` · Issue \#437 · ory/sdk \- GitHub, [https://github.com/ory/sdk/issues/437](https://github.com/ory/sdk/issues/437)  
5. rust-best-practices | Skills Marketp... \- LobeHub, [https://lobehub.com/tr/skills/lklimek-claudius-rust-best-practices](https://lobehub.com/tr/skills/lklimek-claudius-rust-best-practices)  
6. [https://www.npiontko.pro/2026/04/26/rust-csharp-async-interop](https://www.npiontko.pro/2026/04/26/rust-csharp-async-interop)  
7. Asynchronous Programming \- Rust for C\#/.NET Developers, [https://microsoft.github.io/rust-for-dotnet-devs/latest/asynchronous-programming/index.html](https://microsoft.github.io/rust-for-dotnet-devs/latest/asynchronous-programming/index.html)  
8. Implement a DisposeAsync method \- .NET \- Microsoft Learn, [https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/implementing-disposeasync](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/implementing-disposeasync)  
9. Working with the IDisposable Interface in .NET C\# \- Reintech, [https://reintech.io/blog/tutorial-working-idisposable-interface-net-csharp](https://reintech.io/blog/tutorial-working-idisposable-interface-net-csharp)  
10. Implement a Dispose method \- .NET \- Microsoft Learn, [https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/implementing-dispose](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/implementing-dispose)  
11. Using Polly v8 with HttpClientFactory \- C:\\Dave\\Storey \- Medium, [https://truestorydavestorey.medium.com/using-polly-v8-with-httpclientfactory-3f9a64359990](https://truestorydavestorey.medium.com/using-polly-v8-with-httpclientfactory-3f9a64359990)  
12. How to Build HTTP Clients with Polly Retry in .NET \- OneUptime, [https://oneuptime.com/blog/post/2026-01-25-http-clients-polly-retry-dotnet/view](https://oneuptime.com/blog/post/2026-01-25-http-clients-polly-retry-dotnet/view)  
13. Circuit breaker resilience strategy \- Polly, [https://www.pollydocs.org/strategies/circuit-breaker.html](https://www.pollydocs.org/strategies/circuit-breaker.html)  
14. Implement Circuit Breaker using Polly in .Net Core 8 \- DEV Community, [https://dev.to/neers/implement-circuit-breaker-using-polly-in-net-core-8-5gm1](https://dev.to/neers/implement-circuit-breaker-using-polly-in-net-core-8-5gm1)  
15. ASP.NET Core support for Native AOT \- Microsoft Learn, [https://learn.microsoft.com/en-us/aspnet/core/fundamentals/native-aot?view=aspnetcore-10.0](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/native-aot?view=aspnetcore-10.0)  
16. Surviving Native AOT: The Reflection Migration Guide Every .NET Architect Needs, [https://blog.stackademic.com/surviving-native-aot-the-reflection-migration-guide-every-net-architect-needs-fa3760fbb41b](https://blog.stackademic.com/surviving-native-aot-the-reflection-migration-guide-every-net-architect-needs-fa3760fbb41b)  
17. Intro to Serialization with Source Generation in System.Text.Json, [https://okyrylchuk.dev/blog/intro-to-serialization-with-source-generation-in-system-text-json/](https://okyrylchuk.dev/blog/intro-to-serialization-with-source-generation-in-system-text-json/)  
18. How to use source generation in System.Text.Json \- .NET \- Microsoft Learn, [https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/source-generation](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/source-generation)  
19. What's new in System.Text.Json in .NET 8 \- Microsoft Developer Blogs, [https://devblogs.microsoft.com/dotnet/system-text-json-in-dotnet-8/](https://devblogs.microsoft.com/dotnet/system-text-json-in-dotnet-8/)  
20. \[.NET 9 / AOT\] How to handle IL2026 warning with System.Text.Json when using Deserialize  
21. System.Text.Json source generator doesn't work with native AOT \`IlcDisableReflection\` · Issue \#68093 · dotnet/runtime \- GitHub, [https://github.com/dotnet/runtime/issues/68093](https://github.com/dotnet/runtime/issues/68093)  
22. Playing with System.Text.Json Source Generators \- Steve Gordon, [https://www.stevejgordon.co.uk/playing-with-system-text-json-source-generators](https://www.stevejgordon.co.uk/playing-with-system-text-json-source-generators)  
23. P/Invoke source generation \- .NET \- Microsoft Learn, [https://learn.microsoft.com/en-us/dotnet/standard/native-interop/pinvoke-source-generation](https://learn.microsoft.com/en-us/dotnet/standard/native-interop/pinvoke-source-generation)  
24. csbindgen — Generate C\# native code bridge automatically or modern approaches to native code invocation from C\# | by Yoshifumi Kawai, [https://neuecc.medium.com/csbindgen-generate-c-native-code-bridge-automatically-or-modern-approaches-to-native-code-78d9f9a616fb](https://neuecc.medium.com/csbindgen-generate-c-native-code-bridge-automatically-or-modern-approaches-to-native-code-78d9f9a616fb)  
25. callbackOnCollectedDelegate MDA \- .NET Framework \- Microsoft Learn, [https://learn.microsoft.com/en-us/dotnet/framework/debug-trace-profile/callbackoncollecteddelegate-mda](https://learn.microsoft.com/en-us/dotnet/framework/debug-trace-profile/callbackoncollecteddelegate-mda)  
26. Preventing unmanaged function pointer garbage collection \- Stack Overflow, [https://stackoverflow.com/questions/17251754/preventing-unmanaged-function-pointer-garbage-collection](https://stackoverflow.com/questions/17251754/preventing-unmanaged-function-pointer-garbage-collection)  
27. C\# (Managed) callbacks, garbage collection, & P/Invoke : r/csharp \- Reddit, [https://www.reddit.com/r/csharp/comments/a4dj0i/c\_managed\_callbacks\_garbage\_collection\_pinvoke/](https://www.reddit.com/r/csharp/comments/a4dj0i/c_managed_callbacks_garbage_collection_pinvoke/)  
28. Writing a .NET profiler in C\# — Part 2 \- minidump.net, [https://minidump.net/writing-a-net-profiler-in-c-part-2-8039da001e43/](https://minidump.net/writing-a-net-profiler-in-c-part-2-8039da001e43/)  
29. Writing Node.js Addons with .NET Native AOT: A Complete Guide \- DEV Community, [https://dev.to/vikrant\_bagal\_afae3e25ca7/writing-nodejs-addons-with-net-native-aot-a-complete-guide-3m6l](https://dev.to/vikrant_bagal_afae3e25ca7/writing-nodejs-addons-with-net-native-aot-a-complete-guide-3m6l)  
30. Resolve errors using delegates and function pointers \- C\# reference \- Microsoft Learn, [https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-messages/delegate-function-pointer-diagnostics](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-messages/delegate-function-pointer-diagnostics)  
31. Unmanaged calling conventions \- .NET | Microsoft Learn, [https://learn.microsoft.com/en-us/dotnet/standard/native-interop/calling-conventions](https://learn.microsoft.com/en-us/dotnet/standard/native-interop/calling-conventions)  
32. Including native libraries in .NET packages \- NuGet \- Microsoft Learn, [https://learn.microsoft.com/en-us/nuget/create-packages/native-files-in-net-packages](https://learn.microsoft.com/en-us/nuget/create-packages/native-files-in-net-packages)  
33. NET Runtime Identifier (RID) catalog \- Microsoft Learn, [https://learn.microsoft.com/en-us/dotnet/core/rid-catalog](https://learn.microsoft.com/en-us/dotnet/core/rid-catalog)