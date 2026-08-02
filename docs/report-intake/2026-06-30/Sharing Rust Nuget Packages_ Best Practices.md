# **Modular Rust and.NET Interoperability: Exhaustive Best Practices for Architecting, Binding, and Distributing Custom NuGet Packages**

The software engineering landscape is increasingly defined by the synthesis of distinct programming paradigms to achieve both rapid application development and extreme runtime performance. In this context, the integration of Rust and C\# represents a highly potent architectural pattern. C\# and the broader.NET ecosystem, governed by the Common Language Runtime (CLR) and executing Common Intermediate Language (CIL), excel in enterprise application development, offering rich frameworks, high developer productivity, and a sophisticated garbage collector.1 Conversely, Rust compiles directly to highly optimized native machine code via the LLVM compiler infrastructure, offering deterministic memory management without a runtime garbage collector, absolute control over system resources, and unparalleled memory safety guarantees.1  
Bridging these two environments allows organizations to leverage the high-level productivity of C\# for user interfaces, web APIs, and orchestration, while delegating computationally intensive, resource-constrained, or highly parallelized operations to a native Rust core.2 Furthermore, organizations migrating legacy C or C++ codebases to safer alternatives frequently adopt Rust, subsequently needing to expose these modern, memory-safe libraries to their existing.NET applications.3  
However, producing a seamless integration is fundamentally challenging. It requires navigating incompatible application binary interfaces (ABIs), reconciling manual memory management with tracing garbage collection, translating disparate error-handling mechanisms, cross-compiling native artifacts for diverse operating systems and CPU architectures, and ultimately packaging these artifacts into a cohesive NuGet package that functions seamlessly across both modern.NET SDK projects and legacy.NET Framework environments.5  
This comprehensive report details the exhaustive best practices for achieving this interoperability. It traverses the entire lifecycle of a native-to-managed integration, beginning with the structural organization of the Rust workspace, detailing the mechanics of the Foreign Function Interface (FFI) boundary, evaluating automated binding generation utilities, outlining continuous integration strategies for cross-compilation, and providing a definitive guide to structuring custom NuGet packages for universal compatibility and secure distribution.

## **Architecting the Rust Workspace for Interoperability**

The foundational step in exposing Rust capabilities to.NET involves the architectural structuring of the Rust codebase itself. As projects scale, maintaining a monolithic Rust repository becomes increasingly detrimental. Monoliths degrade compilation times, obscure semantic boundaries between pure domain logic and integration boilerplate, and complicate continuous integration workflows.9 The highest leverage architectural decision a development team can make is to aggressively split the codebase into distinct, domain-driven crates governed by a centralized Cargo workspace.9

### **Hierarchical Versus Flat Workspace Structures**

Modern Cargo workspace design strongly favors a modular separation between pure business logic and the C-ABI (Application Binary Interface) boundary. A codebase that intertwines idiomatic Rust abstractions—such as advanced generics, lifetimes, and algebraic data types—with repr(C) types inevitably introduces architectural fragility and increases the cognitive load required to maintain the FFI boundary.10  
Industry research and structural patterns indicate that flat workspace structures often yield superior maintainability and visibility compared to deeply nested directory hierarchies.11 Deeply nested trees obscure crate dependencies and often lead to namespace inconsistencies, whereas a single-level directory structure provides immediate visibility of all components.11  
A production-grade, FFI-optimized flat workspace structure is typically arranged as follows:

* Cargo.toml (The Workspace Root)  
* crates/  
  * domain-core/ (Pure, idiomatic Rust business logic)  
  * domain-ffi/ (The C-ABI boundary bindings, exposing domain-core to external callers)  
  * domain-cli/ (Command-line interfaces for standalone execution, if necessary)  
  * shared-types/ (Common data structures utilized across multiple crates)  
  * integration-tests/ (Workspace-level behavioral tests)

By establishing a dedicated domain-ffi crate, the core library (domain-core) remains untainted by the inherently unsafe FFI boilerplate, manual pointer arithmetic, and foreign type conversions required to interface with C\#.9 The root Cargo.toml file coordinates these independent members and centralizes dependency versioning, ensuring that shared third-party dependencies resolve to identical versions across the entire project graph.11

### **Build Optimization and Profile Strategies**

In a workspace intended for distribution as a compiled native binary consumed by.NET, the root Cargo.toml must enforce aggressive build optimizations for the release profile, while prioritizing compilation speed and debuggability during development.11 The optimization strategy applied during the native compilation phase directly dictates the performance characteristics of the resulting.NET application.  
Key release profile configurations required for production FFI workspaces include link-time optimization (LTO), codegen unit restriction, and panic behavior modification. Enabling lto \= "fat" instructs the LLVM backend to perform Link-Time Optimization across all crates within the dependency graph.11 This allows the compiler to inline functions and eliminate dead code across crate boundaries, resulting in significantly smaller and faster binaries, albeit at the cost of vastly increased compilation times during the CI/CD phase.11  
Similarly, setting codegen-units \= 1 prevents LLVM from splitting the crate into multiple parallel units during compilation.11 While multiple codegen units speed up the build process by utilizing multiple CPU cores, they restrict the compiler's ability to optimize the binary globally. For distributed native libraries, runtime performance takes absolute precedence over build time, making a single codegen unit the optimal choice.11  
Finally, the panic \= "abort" configuration is arguably the most critical setting for FFI workspaces.11 By default, a Rust panic initiates a stack unwinding process to clean up resources. However, if this unwinding process crosses the FFI boundary into a foreign environment like the.NET CLR, it triggers undefined behavior, typically resulting in an instantaneous and uncatchable application crash.7 Configuring the release profile to abort on panic prevents this cross-boundary unwinding entirely, simultaneously reducing the size of the compiled binary by stripping the unwinding infrastructure.11

## **Foreign Function Interface (FFI) Mechanics and Memory Safety**

The interface connecting managed.NET memory and unmanaged Rust memory requires strict adherence to C-ABI conventions. Rust's native ABI is intentionally unstable, allowing the compiler to reorder struct fields and optimize calling conventions freely from version to version. Because the.NET CLR possesses no understanding of the Rust ABI, the C-ABI serves as the mandatory lowest common denominator for cross-language communication.13  
Every Rust function intended for invocation from C\# must be declared with the extern "C" linkage modifier and the \#\[no\_mangle\] attribute.16 The \#\[no\_mangle\] attribute prevents the Rust compiler from altering the function's symbol name during compilation, ensuring that the.NET \`\` attribute can locate the exact symbol entry point within the compiled dynamic library.16

### **Mitigating Undefined Behavior: Panics and Stack Unwinding**

As established, a fundamental mismatch exists between how Rust and.NET handle unrecoverable errors and exceptions. Rust utilizes stack unwinding during a panic\!, whereas.NET relies on Structured Exception Handling (SEH). If a Rust panic is allowed to propagate across an FFI boundary into.NET managed code, the process escapes the control of both language runtimes.7 The CLR cannot catch a Rust panic using a try/catch block, and the resulting memory corruption or illegal instruction execution forces the operating system to terminate the host process.13  
To safely bridge this gap, all exported Rust FFI functions must intercept potential panics before they escape back to the C\# caller. The std::panic::catch\_unwind utility is explicitly designed for this purpose.7  
The structural pattern involves wrapping the core, potentially panicking logic in a closure passed directly to catch\_unwind.7 If a panic occurs within the closure, it is safely captured, returning a Result::Err.18 The FFI layer can then translate this captured panic into an appropriate C-compatible error code or sentinel value (e.g., returning \-1 or a specific integer constant) back to the C\# caller.2 The C\# side then inspects the returned integer and, if it indicates a failure, throws a managed.NET exception (such as an InvalidOperationException or a custom RustNativeException) to gracefully propagate the failure within the managed ecosystem.2  
It is critical to note that the behavior of catch\_unwind is entirely dependent on the compilation profile. As previously discussed, if the Rust workspace is compiled with panic \= "abort", the catch\_unwind mechanism is inherently bypassed.15 In an aborting runtime, catch\_unwind essentially optimizes down to a direct invocation of the closure, and any panic will immediately terminate the process before catch\_unwind can capture it.15  
Consequently, relying on panics for general error handling is considered an anti-pattern, particularly in native libraries.7 Developers must strictly adhere to utilizing Result\<T, E\> for all recoverable errors within the core Rust logic.7 The FFI layer should map these idiomatic Result types to integer error codes, reserving panics strictly for true, unrecoverable contract violations.14

### **Memory Management and the SafeHandle Paradigm**

Memory synchronization between a tracing garbage collector (C\#) and manual, Resource Acquisition Is Initialization (RAII) memory management (Rust) is a primary vector for memory leaks, use-after-free bugs, and double-free vulnerabilities.3 When Rust allocates a resource on the heap—such as a database connection, a file handle, or a complex parsing state—and passes a raw pointer back to C\#, the Rust compiler loses the ability to track the lifetime of that object.2 C\# thereby assumes absolute responsibility for eventually requesting Rust to deallocate that memory.2  
Directly mapping unmanaged pointers to standard IntPtr structs in C\# is highly discouraged. Doing so places the burden of disposal entirely on the consumer of the API, virtually guaranteeing that memory leaks will occur when unexpected exceptions interrupt the execution flow before a manual disposal method is called.22  
To enforce deterministic and safe cleanup,.NET provides the SafeHandle abstract class.3 A SafeHandle represents a wrapper around an operating system handle or unmanaged pointer, guaranteeing the execution of finalization logic even in the event of asynchronous thread aborts, unhandled domain exceptions, or severe application domain unloads.22  
Implementing a robust memory bridge requires coordination on both sides of the FFI boundary:

1. **Rust Export:** The Rust FFI crate must export an initialization function that allocates the object on the heap using Box::into\_raw and returns the raw pointer to C\#.2 Crucially, it must also export a corresponding free function that accepts the raw pointer, reconstitutes it into a Box using Box::from\_raw, and immediately lets it drop, thus safely deallocating the memory.22  
2. **C\# Subclassing:** The C\# integration layer defines a class inheriting from SafeHandle (or the more specific SafeHandleZeroOrMinusOneIsInvalid base class).22 The constructor of this class typically invokes the Rust initialization function to acquire the native pointer.  
3. **Release Mechanism:** The SafeHandle subclass must override the protected ReleaseHandle() method. Within this method, C\# invokes the exported Rust free function, passing the encapsulated pointer.22  
4. **Integration with IDisposable:** The higher-level C\# service classes that interact with the FFI layer implement the IDisposable interface. When Dispose() is called, the service class calls Dispose() on the SafeHandle, triggering deterministic cleanup.22

The profound advantage of the SafeHandle pattern is its interaction with the.NET Garbage Collector. If the developer forgets to call Dispose(), the SafeHandle is placed in the finalization queue.22 During a subsequent garbage collection cycle, the GC will execute the finalizer, which in turn calls ReleaseHandle(), ensuring the Rust memory is eventually freed and preventing long-term resource leaks.22  
However, this finalization mechanism introduces a critical thread-safety consideration. The.NET Garbage Collector executes finalizers on a dedicated background thread, fundamentally distinct from the thread that originally allocated the resource.6 Therefore, the Rust free function will be invoked from an arbitrary, concurrent context. If the Rust object being dropped contains thread-local state, RefCell implementations, or other non-thread-safe constructs, dropping it from a different thread constitutes a data race.3 Any object passed across the FFI boundary and managed by a SafeHandle must implement the Rust Send trait, guaranteeing that its ownership can be safely transferred across thread boundaries prior to deallocation.2

## **Automated Binding Generation Ecosystem**

Manually maintaining FFI bindings—writing extern "C" functions in Rust and matching them with declarations in C\#—is a tedious, error-prone process highly susceptible to architectural drift. As the native API evolves, manual signatures quickly fall out of sync, leading to catastrophic runtime memory corruption, layout mismatches, and segmentation faults.4 Consequently, automating the generation of the C\# signatures and their corresponding Rust types is a non-negotiable infrastructure requirement for production-grade libraries.4  
The open-source ecosystem provides several distinct tools for cross-language binding generation, each adhering to a different architectural philosophy. Selecting the correct tool depends heavily on the target languages and the desired level of abstraction.

### **Evaluating Binding Generators**

A comparative analysis of the primary binding generators reveals significant functional divergences:

| Generator Utility | Primary Architecture | C\# Interoperability Support | Key Architectural Characteristics |
| :---- | :---- | :---- | :---- |
| **csbindgen** | Direct Rust/C to C\# transpilation | Excellent | Designed specifically for C\# and Unity target environments. Ingests Rust extern "C" definitions directly (or C headers via bindgen) and outputs native, highly optimized DllImport C\# code automatically.4 |
| **interoptopus** | Custom intermediate AST generation | Very Good | Utilizes a macro-driven approach to generate an Abstract Syntax Tree (AST), which custom backends then convert to C\#, Python, or C.24 It is highly modular but requires developers to learn and implement a custom, domain-specific Rust API for defining types.26 |
| **uniffi** | Universal Definition Language (UDL) | Moderate | Developed by Mozilla; excellent for generating Kotlin, Swift, and Python bindings. C\# support relies entirely on a third-party plugin (uniffi-bindgen-cs).26 |

While uniffi excels at generating idiomatic abstractions for mobile platforms (Swift/Kotlin) using its UDL interface, the dependency on third-party plugins for C\# support introduces friction and potential version incompatibilities.26 interoptopus offers strong C\# support but requires rewriting FFI definitions using its proprietary macro system.24  
For a project specifically targeting NuGet distribution, native.NET execution, and high-performance Unity compatibility, **csbindgen** emerges as the optimal choice. It operates transparently, reading standard Rust FFI declarations and leveraging modern C\# 9.0+ features—such as native-sized integers (nint), unmanaged function pointers (delegate\*), and the CLong type—to generate zero-overhead, highly accurate mapping code.4

### **Implementing csbindgen in the Build Pipeline**

The csbindgen library integrates directly into Cargo's build execution lifecycle via the build.rs build script. By declaring csbindgen within the \[build-dependencies\] section of the FFI crate's Cargo.toml, developers can automatically generate the updated C\# wrapper every time the Rust code compiles, ensuring the native and managed layers remain perfectly synchronized.17  
A standard implementation within build.rs involves configuring the csbindgen::Builder to map the source and destination architectures:

1. **Input Definition:** The builder targets the specific Rust source file containing the FFI logic using .input\_extern\_file("src/lib.rs").17 The parser navigates the Abstract Syntax Tree of the target file, identifying all \#\[no\_mangle\] pub extern "C" functions and repr(C) data structures.4  
2. **DLL Name Designation:** The .csharp\_dll\_name("nativelib") directive explicitly configures the \`\` attribute in the generated C\# code.17 This name dictates what library the CLR will attempt to load at runtime. It is crucial to provide the base name (e.g., nativelib), allowing the.NET runtime to dynamically resolve nativelib.dll on Windows, libnativelib.so on Linux, and libnativelib.dylib on macOS.17  
3. **File Generation:** The .generate\_csharp\_file("../dotnet/NativeMethods.g.cs") directive pushes the generated C\# source code directly across the repository boundary into the adjacent.NET project directory.4

Furthermore, hybrid architectures frequently require the incorporation of legacy C or C++ dependencies alongside modern Rust logic. In these scenarios, csbindgen provides an elegant C-to-Rust-to-C\# pipeline. By leveraging the cc crate to compile the legacy C code and the bindgen crate to generate Rust bindings from the C headers, csbindgen can subsequently ingest the output of bindgen. It then projects those original C signatures all the way through the Rust intermediate layer directly into C\#, effectively bridging decades-old C libraries into modern.NET environments with fully automated build automation.4

## **Cross-Platform Compilation Infrastructure**

Because the.NET runtime dynamically loads native libraries based on the host operating system and the specific CPU architecture of the executing machine, a universally compatible NuGet package must contain pre-compiled native binaries for every supported platform.5 Compiling these multi-target artifacts manually on developer workstations is prohibitively complex, error-prone, and impossible to scale. Best practices mandate the implementation of automated continuous integration (CI) pipelines—typically via GitHub Actions—leveraging specialized cross-compilation toolchains.34

### **Leveraging GitHub Actions and the cross Toolchain**

Standard cargo build commands rely on the host machine's native linker and C toolchain. Attempting to compile Linux binaries from a macOS runner, or ARM64 binaries from an x86\_64 runner, requires highly specific sysroot configurations and cross-linkers that are notoriously difficult to configure.34  
To circumvent this complexity, the community standard is to utilize the cross CLI tool.34 cross acts as a drop-in replacement for Cargo, completely abstracting the cross-compilation process by executing the build commands inside isolated, architecture-specific Docker containers that come pre-configured with the exact C-toolchains, linkers, and standard libraries required for the target platform.38  
A resilient, production-grade GitHub Actions matrix strategy ensures complete coverage of all required.NET Runtime Identifiers (RIDs).39 The pipeline defines a build matrix that pairs the OS runner with the appropriate Rust target triplet and Maps it to the corresponding.NET RID.

| GitHub Actions OS Runner | Rust Target Triplet | Resulting.NET RID | Output Artifact Name |
| :---- | :---- | :---- | :---- |
| windows-latest | x86\_64-pc-windows-msvc | win-x64 | nativelib.dll |
| windows-latest | aarch64-pc-windows-msvc | win-arm64 | nativelib.dll |
| ubuntu-latest | x86\_64-unknown-linux-gnu | linux-x64 | libnativelib.so |
| ubuntu-latest | aarch64-unknown-linux-gnu | linux-arm64 | libnativelib.so |
| macos-latest | x86\_64-apple-darwin | osx-x64 | libnativelib.dylib |
| macos-latest | aarch64-apple-darwin | osx-arm64 | libnativelib.dylib |

By iterating over this matrix, the GitHub Actions workflow compiles the Rust codebase in parallel across disparate virtual machines.39 The workflow utilizes houseabsolute/actions-rust-cross or similar actions to invoke cross build \--release \--target \<target-triplet\>, optionally passing flags to strip the binaries of debug symbols, thereby minimizing the final payload size.38

### **Artifact Aggregation and Merging**

Because the matrix jobs execute on separate virtual machines, the resulting compiled binaries (.dll, .so, .dylib) are distributed across different environments. The final NuGet packaging step requires assembling all of these individual binaries into a single, cohesive directory structure on a single runner.40  
Modern GitHub Actions workflows accomplish this by uploading the outputs of each matrix job as temporary pipeline artifacts using the actions/upload-artifact@v4 action.42 Once all matrix compilation jobs successfully complete, a final "packaging" job executes. This job utilizes the actions/upload-artifact/merge sub-action—or a series of targeted download steps—to aggregate all the architecture-specific binaries onto a single runner.40 Only after the native assets from all platforms are consolidated can the dotnet pack command be invoked to create the unified multi-architecture NuGet package.41

## **Packaging Native Assets with NuGet**

The most complex and poorly documented phase of native integration is ensuring that the.NET SDK correctly identifies, extracts, and copies the native libraries to the output directory of the consuming application.8 If the underlying NuGet package is improperly structured, the consuming application will successfully compile without any warnings, but will immediately throw a DllNotFoundException or System.BadImageFormatException upon attempting to invoke the native FFI at runtime.16  
NuGet packaging conventions bifurcate sharply depending on whether the consuming project utilizes the modern SDK-style PackageReference architecture (used by.NET Core,.NET 5+) or the legacy.NET Framework packages.config model.5 The package architect must account for both paradigms simultaneously to ensure universal compatibility across the ecosystem.

### **The Runtime Identifier (RID) Hierarchy**

For modern.NET applications, the NuGet client relies heavily on the Runtime Identifier (RID) graph.47 The RID designates the target operating system and hardware architecture (e.g., win-x64, linux-arm64, osx-x64).33  
The absolute golden rule of modern native packaging is to place the native shared libraries into precisely named runtimes/{rid}/native/ directories inside the compressed .nupkg archive.5 When an SDK-style project references the NuGet package, the MSBuild engine traverses these directories during the restore phase. During the build and publish phases, NuGet automatically evaluates the RID graph, selects the most compatible native asset based on the project's target framework, and explicitly copies that single asset to the application's output directory.5 Furthermore, the build engine automatically logs these paths into the generated {project}.deps.json file, instructing the runtime exactly where to probe for the binary.5  
A valid, correctly structured internal layout of the generated .nupkg appears as follows: \\lib \\net8.0 \\ManagedWrapper.dll \\runtimes \\win-x64 \\native \\nativelib.dll \\linux-x64 \\native \\libnativelib.so \\osx-arm64 \\native \\libnativelib.dylib  
It is vital to recognize a prevalent anti-pattern: placing native assets inside the lib/ directory alongside the managed wrapper assemblies.5 If a native binary (like an .so or .dll) is placed in the lib/ directory, the NuGet client assumes it is a managed.NET assembly containing MSIL.5 It will consequently pass the native binary to the C\# compiler as an assembly reference, resulting in catastrophic build failures or BadImageFormatExceptions at runtime.5 Native files must exclusively reside within the runtimes/ sub-tree.5

### **Authoring .csproj for Native Packaging**

Historically, developers constructed .nuspec files manually to define the layout of the package.49 However, modern best practices dictate leveraging MSBuild metadata properties natively within the .csproj file, utilizing the dotnet pack CLI command to automatically generate the package.5 This approach ensures that the package metadata dynamically updates alongside the project configuration, drastically reducing maintenance overhead.50  
By adding Pack="true" and PackagePath="runtimes/{rid}/native/" metadata tags to \<Content\> or \<None\> MSBuild item groups, developers can explicitly route the external native binaries (aggregated from the GitHub Actions build matrix) into the required package paths.5  
An example MSBuild configuration snippet inside the wrapper .csproj demonstrates this injection:

XML  
\<ItemGroup\>  
  \<Content Include\="..\\artifacts\\win-x64\\nativelib.dll"\>  
    \<Pack\>true\</Pack\>  
    \<PackagePath\>runtimes\\win-x64\\native\\\</PackagePath\>  
  \</Content\>  
  \<Content Include\="..\\artifacts\\linux-x64\\libnativelib.so"\>  
    \<Pack\>true\</Pack\>  
    \<PackagePath\>runtimes\\linux-x64\\native\\\</PackagePath\>  
  \</Content\>  
  \<Content Include\="..\\artifacts\\osx-arm64\\libnativelib.dylib"\>  
    \<Pack\>true\</Pack\>  
    \<PackagePath\>runtimes\\osx-arm64\\native\\\</PackagePath\>  
  \</Content\>  
\</ItemGroup\>

When the CI pipeline executes dotnet pack, the CLI tool bundles the compiled managed library into the standard lib/ directory, evaluates the \<Content\> tags, and copies the external native files directly into the specified runtimes/ paths.5 Consequently, when the consumer relies on \`\`, the.NET runtime dynamically queries the .deps.json file to locate and load the correct binary for the host machine without requiring manual file manipulation.5

## **MSBuild Targets for Legacy Compatibility**

The runtimes/{rid}/native/ convention is elegantly simple and highly effective, but it inherently fails for older.NET Framework projects relying on the legacy packages.config format, as well as certain non-SDK style projects.5 These legacy environments lack an understanding of the RID graph, do not parse .deps.json files, and do not automatically traverse the runtimes/ directory during the build process.5 Consequently, the native assets are completely ignored and are never copied to the bin/ output directory, leading directly to DllNotFoundException crashes upon execution.5  
To support both modern SDK-style projects and legacy.NET Framework consumers, the NuGet package must be hybridized by shipping with custom MSBuild targets files.5 NuGet 2.5 introduced the build/ directory convention, and NuGet 5.0 introduced the buildTransitive/ directory.54 If an XML file named exactly {PackageId}.targets is placed within these folders, the NuGet client will automatically inject those MSBuild instructions directly into the consumer's build execution pipeline.44  
The goal of the .targets file is to force the MSBuild engine to locate the native libraries embedded within the NuGet package and manually copy them to the output directory of the consuming application. This is achieved by defining an MSBuild \<ItemGroup\> that targets the native libraries and applies the \<CopyToOutputDirectory\>PreserveNewest\</CopyToOutputDirectory\> attribute.44  
A robust {PackageId}.targets file employs MSBuild conditions to dynamically select architecture-specific binaries based on the consuming project's target platform:

XML  
\<?xml version="1.0" encoding="utf-8"?\>  
\<Project ToolsVersion\="4.0" xmlns\="http://schemas.microsoft.com/developer/msbuild/2003"\>  
  \<ItemGroup Condition\=" '$(Platform)' \== 'x64' "\>  
    \<None Include\="$(MSBuildThisFileDirectory)..\\runtimes\\win-x64\\native\\nativelib.dll"\>  
      \<Link\>nativelib.dll\</Link\>  
      \<CopyToOutputDirectory\>PreserveNewest\</CopyToOutputDirectory\>  
    \</None\>  
  \</ItemGroup\>  
    
  \<ItemGroup Condition\=" '$(Platform)' \== 'x86' OR '$(Platform)' \== 'AnyCPU' "\>  
    \<None Include\="$(MSBuildThisFileDirectory)..\\runtimes\\win-x86\\native\\nativelib.dll"\>  
      \<Link\>nativelib.dll\</Link\>  
      \<CopyToOutputDirectory\>PreserveNewest\</CopyToOutputDirectory\>  
    \</None\>  
  \</ItemGroup\>  
\</Project\>

The use of the $(MSBuildThisFileDirectory) macro is a critical mechanism. It ensures that the MSBuild engine resolves the file path relatively from the location of the .targets file (which resides deep in the global NuGet package cache on the developer's machine) out to the runtimes/ folder within the same package.46 Furthermore, applying the \<Link\> attribute is highly recommended; without it, the native files may appear recursively nested in the Visual Studio solution explorer under long, unreadable paths. The \<Link\> attribute flattens the file, dropping it cleanly into the root of the output directory.46  
By bundling both the modern RID directory structure and a robust .targets fallback script within the same .nupkg, the resulting package achieves total ubiquity, functioning flawlessly across the highly fragmented landscape of the.NET ecosystem.5

## **Secure Distribution and Registry Architectures**

Once the highly modular, cross-platform NuGet package is successfully packed by the CI/CD pipeline, releasing it to consumers requires a strategic evaluation of organizational distribution platforms. While open-source modules are routinely published to nuget.org 1, enterprise native integrations frequently contain proprietary algorithms, sensitive business logic, or strictly controlled dependencies.58 Therefore, deploying the artifacts to private, authenticated package registries is standard practice.58

### **Comparing Package Registry Ecosystems**

Organizations typically select a registry platform based on their existing version control and CI/CD infrastructure, weighing integration capabilities against operational constraints.

| Registry Platform | Architectural Strengths | Constraints and Limitations |
| :---- | :---- | :---- |
| **Azure Artifacts** | Deep native integration with Azure DevOps. Excellent enterprise user permission hierarchies via Microsoft Entra ID. Supports hierarchical upstream feed caching to shield against external repository outages.58 | Can incur high bandwidth and storage costs for organizations retaining massive quantities of large native artifact versions over time. |
| **GitHub Packages** | Native, frictionless cohesion with GitHub Actions. Consolidates source code, CI execution, and package hosting under a single organizational namespace.58 | Branch protection policies on private repositories may incur per-user enterprise license fees. Token scoping has historically been rigid compared to Azure's feed-level permissions.61 |
| **JFrog Artifactory / Sonatype Nexus** | Highly agnostic, widely adopted robust SaaS platforms that support virtually every package format in existence.58 | Often requires dedicated operational overhead and distinct authentication workflows compared to vertically integrated SaaS solutions.58 |

Industry analysis suggests that while GitHub Packages is experiencing rapid adoption due to code locality and Docker image support 60, Azure Artifacts maintains a firmer grasp on legacy enterprise configurations. This is specifically true regarding granular Active Directory-based access controls, making it highly suitable for secure, regulated environments.59

### **Continuous Deployment and Secure Authentication**

Deploying packages from a headless CI/CD environment requires robust, automated secret management. The legacy practice of directly injecting static Personal Access Tokens (PATs) into pipeline configuration files is being aggressively phased out in favor of passwordless, identity-driven authentication methods.43  
For organizations utilizing Azure Artifacts, integrating the **Azure Artifacts Credential Provider** is paramount.63 The credential provider integrates dynamically with dotnet, nuget.exe, and MSBuild across Linux, macOS, and Windows operating systems.63 It operates by intercepting authentication requests initiated by the package manager and seamlessly exchanging OpenID Connect (OIDC) tokens—or Managed Identity claims—for session-specific access tokens without requiring manual developer intervention.43  
In a modern GitHub Actions workflow pushing a compiled native package to Azure Artifacts, the pipeline executes the following automated sequence:

1. **Identity Federation:** The azure/login action authenticates the GitHub runner against Azure by utilizing a user-assigned managed identity. This establishes a trust relationship without relying on static passwords.43  
2. **Provider Installation:** The workflow installs the credential provider by executing an automated setup script (install-artifacts-credprovider.sh), configuring the environment variables required for MSBuild integration.43  
3. **Package Compilation:** The dotnet pack command compiles the final multi-architecture package, as defined in previous sections.43  
4. **Authenticated Deployment:** The workflow executes dotnet nuget push. The Azure Artifacts Credential Provider automatically intercepts the HTTP 401 Unauthorized challenge from the upstream server, injects the federated token generated in step one, and authorizes the upload.43

Conversely, deploying to GitHub Packages slightly simplifies the credential pipeline by allowing workflows to utilize the inherently injected ${{ secrets.GITHUB\_TOKEN }}.36 This token is automatically provisioned for the lifespan of the workflow run and automatically possesses the requisite permissions to push packages back to the host repository, drastically simplifying the configuration overhead for teams fully committed to the GitHub suite.36

## **Conclusion**

The hybridization of Rust and C\# via the.NET ecosystem yields profound software capabilities, offering deterministic memory safety, exceptional raw execution speed, and enterprise-grade deployment velocities. Constructing a viable, stable bridge between these distinct computational environments is fundamentally an exercise in deep architectural rigor.  
Success is predicated on establishing heavily isolated Cargo workspaces, shielding core Rust logic from the inherent instability of the C-ABI. Developers must apply diligent memory management utilizing the SafeHandle paradigm, and trap stack unwinds at the FFI boundary using catch\_unwind to neutralize the inherent instabilities of cross-language exception propagation. Furthermore, leveraging automated generation tools like csbindgen in conjunction with build.rs eliminates human error from FFI synchronization, ensuring binding accuracy across rapid iteration cycles.  
Finally, navigating the labyrinth of NuGet distribution demands strict adherence to the .NET SDK runtimes/{rid}/native/ conventions, intelligently supplemented by MSBuild .targets injections to assure backwards compatibility with legacy environments. Combining these nuanced practices with automated matrix cross-compilation in GitHub Actions and secure OIDC authentication provides a continuous, highly automated deployment pipeline capable of shipping secure, high-performance native capabilities directly into the hands of C\# developers as seamless, unified NuGet packages.

#### **Works cited**

1. My exploration of Rust and .NET \- Eric Sink, accessed June 30, 2026, [https://ericsink.com/entries/dotnet\_rust.html](https://ericsink.com/entries/dotnet_rust.html)  
2. How we integrate Rust with C\# \- Seq, accessed June 30, 2026, [https://datalust.co/blog/rust-at-datalust-how-we-integrate-rust-with-csharp](https://datalust.co/blog/rust-at-datalust-how-we-integrate-rust-with-csharp)  
3. Improving C\# Memory Safety \- .NET Blog, accessed June 30, 2026, [https://devblogs.microsoft.com/dotnet/improving-csharp-memory-safety/](https://devblogs.microsoft.com/dotnet/improving-csharp-memory-safety/)  
4. csbindgen — Generate C\# native code bridge automatically or modern approaches to native code invocation from C\# | by Yoshifumi Kawai, accessed June 30, 2026, [https://neuecc.medium.com/csbindgen-generate-c-native-code-bridge-automatically-or-modern-approaches-to-native-code-78d9f9a616fb](https://neuecc.medium.com/csbindgen-generate-c-native-code-bridge-automatically-or-modern-approaches-to-native-code-78d9f9a616fb)  
5. Including native libraries in .NET packages \- NuGet \- Microsoft Learn, accessed June 30, 2026, [https://learn.microsoft.com/en-us/nuget/create-packages/native-files-in-net-packages](https://learn.microsoft.com/en-us/nuget/create-packages/native-files-in-net-packages)  
6. KodrAus/rust-csharp-ffi: An example Rust \+ C\# hybrid application \- GitHub, accessed June 30, 2026, [https://github.com/KodrAus/rust-csharp-ffi](https://github.com/KodrAus/rust-csharp-ffi)  
7. Item 18: Don't panic \- Effective Rust, accessed June 30, 2026, [https://effective-rust.com/panic.html](https://effective-rust.com/panic.html)  
8. Nuget package not copying native DLLs on build \- Stack Overflow, accessed June 30, 2026, [https://stackoverflow.com/questions/56154884/nuget-package-not-copying-native-dlls-on-build](https://stackoverflow.com/questions/56154884/nuget-package-not-copying-native-dlls-on-build)  
9. An Opinionated Guide To Structuring Rust Projects \- Ryan James Spencer, accessed June 30, 2026, [https://www.justanotherdot.com/posts/an-opinionated-guide-to-structuring-rust-projects](https://www.justanotherdot.com/posts/an-opinionated-guide-to-structuring-rust-projects)  
10. core::ffi \- Rust, accessed June 30, 2026, [https://doc.rust-lang.org/beta/core/ffi/index.html](https://doc.rust-lang.org/beta/core/ffi/index.html)  
11. Mastering Rust Workspaces: From Development to Production | by Nishantspatil | Medium, accessed June 30, 2026, [https://medium.com/@nishantspatil0408/mastering-rust-workspaces-from-development-to-production-a57ca9545309](https://medium.com/@nishantspatil0408/mastering-rust-workspaces-from-development-to-production-a57ca9545309)  
12. 1525-cargo-workspace \- The Rust RFC Book, accessed June 30, 2026, [https://rust-lang.github.io/rfcs/1525-cargo-workspace.html](https://rust-lang.github.io/rfcs/1525-cargo-workspace.html)  
13. Rust to .NET compiler backend \- a small update : r/rust \- Reddit, accessed June 30, 2026, [https://www.reddit.com/r/rust/comments/1brv05a/rust\_to\_net\_compiler\_backend\_a\_small\_update/](https://www.reddit.com/r/rust/comments/1brv05a/rust_to_net_compiler_backend_a_small_update/)  
14. Should I use panic::catch\_unwind vs Result  
15. Catching panic at FFI boundary, iff unwinding enabled \- help \- Rust Users Forum, accessed June 30, 2026, [https://users.rust-lang.org/t/catching-panic-at-ffi-boundary-iff-unwinding-enabled/14909](https://users.rust-lang.org/t/catching-panic-at-ffi-boundary-iff-unwinding-enabled/14909)  
16. Execute rust libraries from c\#? : r/rust \- Reddit, accessed June 30, 2026, [https://www.reddit.com/r/rust/comments/1e59sdd/execute\_rust\_libraries\_from\_c/](https://www.reddit.com/r/rust/comments/1e59sdd/execute_rust_libraries_from_c/)  
17. Cysharp/csbindgen: Generate C\# FFI from Rust for automatically brings native code and C native library to .NET and Unity. \- GitHub, accessed June 30, 2026, [https://github.com/Cysharp/csbindgen](https://github.com/Cysharp/csbindgen)  
18. Catching panic\! when Rust called from C FFI, without spawning threads \- Stack Overflow, accessed June 30, 2026, [https://stackoverflow.com/questions/27384824/catching-panic-when-rust-called-from-c-ffi-without-spawning-threads](https://stackoverflow.com/questions/27384824/catching-panic-when-rust-called-from-c-ffi-without-spawning-threads)  
19. catch\_unwind in std::panic \- Rust, accessed June 30, 2026, [https://doc.rust-lang.org/beta/std/panic/fn.catch\_unwind.html](https://doc.rust-lang.org/beta/std/panic/fn.catch_unwind.html)  
20. Non-Rust errors and FFI \- Error Handling in Rust, accessed June 30, 2026, [https://nrc.github.io/error-docs/rust-errors/interop.html](https://nrc.github.io/error-docs/rust-errors/interop.html)  
21. Pros and cons of std::panic::catch\_unwind \- help \- The Rust Programming Language Forum, accessed June 30, 2026, [https://users.rust-lang.org/t/pros-and-cons-of-std-catch-unwind/65417](https://users.rust-lang.org/t/pros-and-cons-of-std-catch-unwind/65417)  
22. Objects \- The Rust FFI Omnibus \- Jake Goulding, accessed June 30, 2026, [http://jakegoulding.com/rust-ffi-omnibus/objects/](http://jakegoulding.com/rust-ffi-omnibus/objects/)  
23. eclipse-iceoryx/iceoryx2-csharp \- GitHub, accessed June 30, 2026, [https://github.com/eclipse-iceoryx/iceoryx2-csharp](https://github.com/eclipse-iceoryx/iceoryx2-csharp)  
24. Interop your .NET application with Rust \- DEV Community, accessed June 30, 2026, [https://dev.to/guilhermerochas/interop-your-net-application-with-rust-nk2](https://dev.to/guilhermerochas/interop-your-net-application-with-rust-nk2)  
25. csbindgen \- crates.io: Rust Package Registry, accessed June 30, 2026, [https://crates.io/crates/csbindgen/1.9.5](https://crates.io/crates/csbindgen/1.9.5)  
26. Tool to use to create bindings for multiple languages \- Rust Users Forum, accessed June 30, 2026, [https://users.rust-lang.org/t/tool-to-use-to-create-bindings-for-multiple-languages/99516](https://users.rust-lang.org/t/tool-to-use-to-create-bindings-for-multiple-languages/99516)  
27. FFI — list of Rust libraries/crates // Lib.rs, accessed June 30, 2026, [https://lib.rs/development-tools/ffi](https://lib.rs/development-tools/ffi)  
28. Has anyone used UniFFI to build FFI functions in Rust? \- Reddit, accessed June 30, 2026, [https://www.reddit.com/r/rust/comments/1sqemlp/has\_anyone\_used\_uniffi\_to\_build\_ffi\_functions\_in/](https://www.reddit.com/r/rust/comments/1sqemlp/has_anyone_used_uniffi_to_build_ffi_functions_in/)  
29. Calling Rust code from C\# | Strathweb. A free flowing tech monologue., accessed June 30, 2026, [https://www.strathweb.com/2023/06/calling-rust-code-from-csharp/](https://www.strathweb.com/2023/06/calling-rust-code-from-csharp/)  
30. uniffi-bindgen-cs/docs/CONFIGURATION.md at main \- GitHub, accessed June 30, 2026, [https://github.com/NordSecurity/uniffi-bindgen-cs/blob/main/docs/CONFIGURATION.md](https://github.com/NordSecurity/uniffi-bindgen-cs/blob/main/docs/CONFIGURATION.md)  
31. Support for C\# · Issue \#1056 · mozilla/uniffi-rs \- GitHub, accessed June 30, 2026, [https://github.com/mozilla/uniffi-rs/issues/1056](https://github.com/mozilla/uniffi-rs/issues/1056)  
32. csbindgen \- crates.io: Rust Package Registry, accessed June 30, 2026, [https://crates.io/crates/csbindgen/1.0.0](https://crates.io/crates/csbindgen/1.0.0)  
33. NET Runtime Identifier (RID) catalog \- Microsoft Learn, accessed June 30, 2026, [https://learn.microsoft.com/en-us/dotnet/core/rid-catalog](https://learn.microsoft.com/en-us/dotnet/core/rid-catalog)  
34. Cargo Cross Action \- GitHub Marketplace, accessed June 30, 2026, [https://github.com/marketplace/actions/cargo-cross-action](https://github.com/marketplace/actions/cargo-cross-action)  
35. Cross Compiling Rust Binaries with Github Actions \- Reddit, accessed June 30, 2026, [https://www.reddit.com/r/rust/comments/o8z614/cross\_compiling\_rust\_binaries\_with\_github\_actions/](https://www.reddit.com/r/rust/comments/o8z614/cross_compiling_rust_binaries_with_github_actions/)  
36. A NuGet package workflow using GitHub Actions | by Andrew Craven \- Medium, accessed June 30, 2026, [https://acraven.medium.com/a-nuget-package-workflow-using-github-actions-7da8c6557863](https://acraven.medium.com/a-nuget-package-workflow-using-github-actions-7da8c6557863)  
37. Cross Compiling Rust Projects in GitHub Actions \- House Absolute(ly Pointless), accessed June 30, 2026, [https://blog.urth.org/2023/03/05/cross-compiling-rust-projects-in-github-actions/](https://blog.urth.org/2023/03/05/cross-compiling-rust-projects-in-github-actions/)  
38. Build Rust Projects with Cross · Actions · GitHub Marketplace, accessed June 30, 2026, [https://github.com/marketplace/actions/build-rust-projects-with-cross](https://github.com/marketplace/actions/build-rust-projects-with-cross)  
39. How to cross-compile your Rust applications using cross-rs and GitHub Actions \- \_CLOUD, accessed June 30, 2026, [https://blog.ediri.io/how-to-cross-compile-your-rust-applications-using-cross-rs-and-github-actions](https://blog.ediri.io/how-to-cross-compile-your-rust-applications-using-cross-rs-and-github-actions)  
40. \[feat req\] Merge artifacts option · Issue \#483 · actions/upload-artifact \- GitHub, accessed June 30, 2026, [https://github.com/actions/upload-artifact/issues/483](https://github.com/actions/upload-artifact/issues/483)  
41. Adding .Net artefacts to a release automatically with GitHub Actions : r/dotnet \- Reddit, accessed June 30, 2026, [https://www.reddit.com/r/dotnet/comments/r0oj8f/adding\_net\_artefacts\_to\_a\_release\_automatically/](https://www.reddit.com/r/dotnet/comments/r0oj8f/adding_net_artefacts_to_a_release_automatically/)  
42. Building and testing .NET \- GitHub Docs, accessed June 30, 2026, [https://docs.github.com/actions/guides/building-and-testing-net](https://docs.github.com/actions/guides/building-and-testing-net)  
43. Quickstart: Use GitHub Actions to push to Azure Artifacts \- Microsoft Learn, accessed June 30, 2026, [https://learn.microsoft.com/en-us/azure/devops/artifacts/quickstarts/github-actions?view=azure-devops](https://learn.microsoft.com/en-us/azure/devops/artifacts/quickstarts/github-actions?view=azure-devops)  
44. Targets file for deploying nativs dlls to output directory \- Stack Overflow, accessed June 30, 2026, [https://stackoverflow.com/questions/60623546/targets-file-for-deploying-nativs-dlls-to-output-directory](https://stackoverflow.com/questions/60623546/targets-file-for-deploying-nativs-dlls-to-output-directory)  
45. How to make native dlls in a nuget package be copied to the output folder? : r/dotnet \- Reddit, accessed June 30, 2026, [https://www.reddit.com/r/dotnet/comments/1jpz9sd/how\_to\_make\_native\_dlls\_in\_a\_nuget\_package\_be/](https://www.reddit.com/r/dotnet/comments/1jpz9sd/how_to_make_native_dlls_in_a_nuget_package_be/)  
46. Add native files from NuGet package to project output directory \- Stack Overflow, accessed June 30, 2026, [https://stackoverflow.com/questions/19478775/add-native-files-from-nuget-package-to-project-output-directory](https://stackoverflow.com/questions/19478775/add-native-files-from-nuget-package-to-project-output-directory)  
47. runtime identifier \- NuGet \- RID and TFM Examples \- Stack Overflow, accessed June 30, 2026, [https://stackoverflow.com/questions/32699340/nuget-rid-and-tfm-examples](https://stackoverflow.com/questions/32699340/nuget-rid-and-tfm-examples)  
48. Nupkg Containing Native Libraries \- DEV Community, accessed June 30, 2026, [https://dev.to/jeikabu/nupkg-containing-native-libraries-1576](https://dev.to/jeikabu/nupkg-containing-native-libraries-1576)  
49. Multi-targeting for NuGet Packages \- Microsoft Learn, accessed June 30, 2026, [https://learn.microsoft.com/en-us/nuget/create-packages/supporting-multiple-target-frameworks](https://learn.microsoft.com/en-us/nuget/create-packages/supporting-multiple-target-frameworks)  
50. Add native files from NuGet package to .NET application output directory \- Stack Overflow, accessed June 30, 2026, [https://stackoverflow.com/questions/78856188/add-native-files-from-nuget-package-to-net-application-output-directory](https://stackoverflow.com/questions/78856188/add-native-files-from-nuget-package-to-net-application-output-directory)  
51. Creating Cross-Platform NuGet Package To Wrap Native C++ Libraries \- Medium, accessed June 30, 2026, [https://medium.com/@yooonatan/creating-cross-platform-nuget-package-to-wrap-native-c-libraries-b2ee71c34164](https://medium.com/@yooonatan/creating-cross-platform-nuget-package-to-wrap-native-c-libraries-b2ee71c34164)  
52. dotnet pack command \- .NET CLI | Microsoft Learn, accessed June 30, 2026, [https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-pack](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-pack)  
53. Automatic native and managed DLLs extracting from NuGet Package \- Stack Overflow, accessed June 30, 2026, [https://stackoverflow.com/questions/40104838/automatic-native-and-managed-dlls-extracting-from-nuget-package](https://stackoverflow.com/questions/40104838/automatic-native-and-managed-dlls-extracting-from-nuget-package)  
54. Nuget and MSBuild Targets \- SushiHangover, accessed June 30, 2026, [http://sushihangover.github.io/nuget-and-msbuild-targets/](http://sushihangover.github.io/nuget-and-msbuild-targets/)  
55. MSBuild props and targets in a package \- NuGet \- Microsoft Learn, accessed June 30, 2026, [https://learn.microsoft.com/en-us/nuget/concepts/msbuild-props-and-targets](https://learn.microsoft.com/en-us/nuget/concepts/msbuild-props-and-targets)  
56. Output Directory of native dll bundled with NuGet \- Stack Overflow, accessed June 30, 2026, [https://stackoverflow.com/questions/52448979/output-directory-of-native-dll-bundled-with-nuget](https://stackoverflow.com/questions/52448979/output-directory-of-native-dll-bundled-with-nuget)  
57. csproj: document how to properly pack platform-specific native assemblies \#6645 \- GitHub, accessed June 30, 2026, [https://github.com/NuGet/Home/issues/6645](https://github.com/NuGet/Home/issues/6645)  
58. Overview of Hosting Your Own NuGet Feeds | Microsoft Learn, accessed June 30, 2026, [https://learn.microsoft.com/en-us/nuget/hosting-packages/overview](https://learn.microsoft.com/en-us/nuget/hosting-packages/overview)  
59. Azure Artifacts vs. GitHub Packages Comparison \- SourceForge, accessed June 30, 2026, [https://sourceforge.net/software/compare/Azure-Artifacts-vs-GitHub-Packages/](https://sourceforge.net/software/compare/Azure-Artifacts-vs-GitHub-Packages/)  
60. Why I am disappointed in GitHub \- Medium, accessed June 30, 2026, [https://medium.com/nerd-for-tech/why-i-am-dissapointed-in-github-16fd664754ef](https://medium.com/nerd-for-tech/why-i-am-dissapointed-in-github-16fd664754ef)  
61. Azure DevOps vs. Github endgame : r/dotnet \- Reddit, accessed June 30, 2026, [https://www.reddit.com/r/dotnet/comments/1iy93p1/azure\_devops\_vs\_github\_endgame/](https://www.reddit.com/r/dotnet/comments/1iy93p1/azure_devops_vs_github_endgame/)  
62. GitHub packages vs Artifactory/azure devops · community · Discussion \#51102, accessed June 30, 2026, [https://github.com/orgs/community/discussions/51102](https://github.com/orgs/community/discussions/51102)  
63. microsoft/artifacts-credprovider: The Azure Artifacts Credential Provider enables dotnet, NuGet.exe, and MSBuild to interactively acquire credentials for Azure Artifacts feeds. \- GitHub, accessed June 30, 2026, [https://github.com/microsoft/artifacts-credprovider](https://github.com/microsoft/artifacts-credprovider)  
64. Using the Azure Artifacts Credential Provider with Github Actions | by Peter Labick \- Medium, accessed June 30, 2026, [https://medium.com/@peterlabick/using-the-azure-artifacts-credential-provider-with-github-actions-5b397ed2a450](https://medium.com/@peterlabick/using-the-azure-artifacts-credential-provider-with-github-actions-5b397ed2a450)  
65. JetBrains/azure-artifacts-credprovider: The Azure Artifacts Credential Provider enables dotnet, NuGet.exe, and MSBuild to interactively acquire credentials for Azure Artifacts feeds. \- GitHub, accessed June 30, 2026, [https://github.com/JetBrains/azure-artifacts-credprovider](https://github.com/JetBrains/azure-artifacts-credprovider)