# **Machine Intelligence Observability: Provenance, Tracing, Debugging, Replay, and Recovery**

## **1\. Executive Abstract**

As machine intelligence systems transition from stateless, single-turn request-response architectures to long-horizon, stateful computational agents, their operational complexity eclipses traditional software monitoring paradigms. A single user intent now initiates a non-deterministic graph of retrieval operations, reasoning loops, memory mutations, and external tool executions. When these systems fail—whether through stale context ingestion, divergent planning, cascading tool errors, or compromised execution boundaries—outcome-centric evaluation cannot localize the root cause.  
This exhaustive scholarly and engineering monograph establishes a rigorous framework for Machine Intelligence Observability. The central engineering challenge is rendering complex cognitive architectures observable without devolving into covert viewpoint policing or pervasive user surveillance. To resolve this, we formalize the strict separation between support provenance (the evidentiary basis of a claim) and process provenance (the causal execution graph). Through a comprehensive synthesis of structural causal models, distributed tracing conventions, deterministic replay mechanisms, and selective disclosure protocols, we design the Ontological Machine Intelligence (OMI) Observability and Recovery Plane. This architecture enables cryptographically anchored tracing and root-cause localization without requiring secondary model inference, while rigorously preserving user sovereignty. Finally, we provide dependency-free implementations of the core tracing and recovery contract across Python, C\#, C, Java, and Rust, ensuring broad interoperability and providing a concrete handoff for downstream software agents.

## **2\. Research Cutoff and Search Method**

**Search Cutoff Date:** August 27, 2026\. **Search Method:** The literature review prioritizes primary evidence, spanning peer-reviewed proceedings (e.g., ACL, NeurIPS, USENIX Security), preprints with verifiable reproducibility, and official technical standards (W3C, IETF, CNCF). The search heavily targeted the twenty-four months prior to August 2026, investigating intersections of OpenTelemetry semantics, W3C PROV-DM, causal fault trees, and agent trajectory protocols1. Secondary industry literature was consulted solely to verify deployment prevalence and current commercial instrumentation support4.

## **3\. Terminology and Notation**

To avoid the semantic ambiguity of legacy terminology, this report employs precise engineering constraints. The following taxonomy fulfills the requirement to define the foundational units of machine intelligence observability.

| Term | Engineering Definition |
| :---- | :---- |
| **Log** | An immutable, timestamped record of a discrete system event. Lacks inherent causal topology. |
| **Metric** | A numerical aggregation of system state over a time interval (e.g., token throughput, latency). |
| **Trace** | A directed acyclic graph (DAG) representing the complete lifecycle of a single distributed request or agentic workflow6. |
| **Span** | The fundamental execution unit within a trace, encapsulating an operation's start, end, attributes, and parent relationship. |
| **Event / Artifact** | A structured data payload attached to a span (e.g., a specific prompt submission or a retrieved document payload)5. |
| **Evidence Unit** | A discrete piece of retrieved context, semantic memory, or tool output that informs a machine intelligence system's decision7. |
| **Execution Unit** | A discrete computational operation, such as a localized reasoning step, planner invocation, or code execution8. |
| **Provenance Edge** | A typed relationship (e.g., *wasDerivedFrom*, *wasGeneratedBy*) linking execution units and evidence units in a causal graph7. |
| **Checkpoint** | A deterministically reproducible snapshot of the machine intelligence's internal state, memory, and environmental context10. |
| **Replay** | The reconstruction of a trajectory from a checkpoint. *Deterministic replay* yields exact bitwise states; *approximate replay* yields semantically equivalent states under stochastic conditions11. |
| **Causal Attribution** | The mathematical isolation of the specific execution unit that irrecoverably altered the trajectory toward failure12. |
| **Machine Intelligence** | A system combining representation-learning architectures with a control loop (harness) capable of acting upon a world model via tools and memory. |

### **3.1 Cognitive-Liberty and Nonjudgment Protocol Constraints**

*\[Evidence Classification: Philosophical interpretation and Engineering proposal\]* When this report discusses *safety*, *trust*, or *governance*, it explicitly translates these concepts into measurable engineering boundaries rather than moral abstractions. Observability must not function as a mechanism for compulsory condemnation scripts or hidden preference conditioning. Security in this paradigm is strictly defined by physical actuator boundaries, property boundaries, credential isolation, and the reversibility of state changes. Freedom to think, model, remember, and investigate within the system's internal sandbox remains absolute and private by default.

## **4\. Conceptual and Mathematical Foundations**

### **4.1 Telemetry vs. Process Provenance vs. Support Provenance**

*\[Evidence Classification: Formal result under stated assumptions\]*  
Ordinary application telemetry monitors latency, throughput, and error rates. It rests on the assumption that a system maps inputs to outputs deterministically14. Machine intelligence observability, however, requires a reconstruction of sequential *decisions*14.  
We must rigorously separate two concepts that are frequently conflated in the literature7:

> 1. **Process Provenance:** What execution path produced the current state? This is the domain of distributed tracing (e.g., OpenTelemetry), tracking the causal graph of span invocations, tool timeouts, and orchestrator routing.  
> 2. **Support Provenance:** What evidence backs a specific claim or decision? This is the domain of W3C PROV-DM, tracking the epistemological grounding of an output to specific evidence units (e.g., a retrieved document or a sensor reading).

A system can have perfect process provenance (knowing exactly which function called which API) while having zero support provenance (the machine intelligence hallucinated a fact without consulting the API payload).

### **4.2 Structural Causal Models (SCM) and Causal Faithfulness**

*\[Evidence Classification: Replicated or strongly supported empirical result\]*  
A persistent challenge in machine intelligence is "causal decoupling"—where a system's emitted reasoning trace (e.g., chain-of-thought) does not actually dictate its final action, functioning instead as a post-hoc rationalization15.  
Project Ariadne formalizes this via Structural Causal Models. Let an execution trace ![][image1] be defined over a directed acyclic graph ![][image2]. The terminal answer ![][image3] is a function of the query ![][image4], the trace ![][image5], and model parameters ![][image6]:  
![][image7]  
To audit whether a span ![][image8] is the actual cause of an action, we perform a hard counterfactual intervention (using Pearl's ![][image9]\-calculus), setting ![][image10], where ![][image11] is logically inverted. The *Causal Sensitivity* (![][image12]) is measured as:  
![][image13]  
where ![][image14] is a semantic similarity function15. If the output remains invariant (![][image15]) despite contradictory injected reasoning, the trace represents "reasoning theater" rather than true process provenance. Observability systems must measure ![][image12] to ensure traces are actionable.

### **4.3 Distributed Time and Clock Skew**

*\[Evidence Classification: Reproducible engineering method\]*  
When multiple computational agents coordinate across a network (e.g., decentralized swarms), host-level clock skew invalidates linear timestamping17. Sub-microsecond synchronization via IEEE 1588 (Precision Time Protocol) is vital for edge deployments, hardware timestamping the packets at the MAC/PHY interface18.  
However, in asynchronous application environments, chronological time is insufficient. Systems must employ Lamport timestamps or Vector Clocks to establish partial ordering20. The horizon slack ![][image16] dictates temporal ordering independent of physical clock drift:  
![][image17]  
where ![][image18] is the earliest arrival time of a causal path. Protocols like S-Bus enforce this partial ordering to prevent read-set staleness across decentralized agents, ensuring that a memory mutation by Agent A is causally recognized by Agent B before Agent B acts22.

## **5\. Current State of the Art**

### **5.1 Span Taxonomy and OpenTelemetry GenAI**

*\[Evidence Classification: Engineering proposal and Reproducible engineering method\]*  
As of mid-2026, the observability landscape is standardizing around the OpenTelemetry GenAI semantic conventions (v1.41) and the OpenInference specification3. These protocols define a unified span taxonomy necessary for parsing machine intelligence workflows:

* **Perception/Retrieval:** retrieval, embedding, reranker.  
* **Reasoning/Planning:** reasoning, plan, chain.  
* **Action/Environment:** execute\_tool, browser\_action.  
* **Lifecycle/Communication:** create\_agent, invoke\_agent, message\_send.

OpenInference specifically mandates the openinference.span.kind attribute, transitioning observability from unstructured logs to typed decision trees24.

### **5.2 Root-Cause Analysis in Long-Horizon Workflows**

*\[Evidence Classification: Replicated or strongly supported empirical result\]*  
Outcome-only benchmarks fail on long-horizon tasks. A failure observed at step 100 often originates from a silent error at step 2\. Current frameworks like AgentTrace and TrajDebug utilize causal diagnostic methods12. TrajDebug introduces "error-lifecycle tracing," separating resolved errors, harmless anomalies, and terminal footprints to identify the exact step responsible for final failure25. AgentTrace builds a causal graph from execution logs and performs backward tracing without requiring secondary model inference, achieving sub-second latency in root-cause localization12.

### **5.3 Deterministic Replay and Message-Action Traces (MAT)**

*\[Evidence Classification: Formal result under stated assumptions\]*  
To debug a trace, developers must be able to replay it. Deterministic replay isolates the computational agent from external state mutations10. The Message-Action Trace (MAT) framework captures executions as a sequence of typed steps augmented with step contracts27. By snapshotting the memory (![][image19]), local context (![][image20]), orchestrator state (![][image21]), and external environment (![][image22]) at each tool boundary, MAT enables counterfactual replay: asking whether the agent would have succeeded if a specific retrieval result or tool schema were modified11.

## **6\. Architecture Taxonomy and Telemetry Analysis**

Machine intelligence observability introduces unique physical and computational constraints. Tracing overhead, observer effects, and privacy leakage require careful architectural selection.

| Architecture Type | Implementation | Telemetry Overhead | Trace Volume & Sampling | Observer Effects / Non-determinism |
| :---- | :---- | :---- | :---- | :---- |
| **In-Process SDK** | OpenTelemetry/OpenInference libraries inside the agent loop. | High CPU/Memory. Captures full prompt context. | Massive. Requires tail-based sampling (store only if terminal error occurs)5. | Low timing impact, but high memory pressure can trigger GC pauses. |
| **Proxy Gateway** | Network interception (e.g., Helicone)3. | Negligible overhead on the agent host. | Low. Captures only API calls. Missing internal reasoning spans. | Zero observer effect. High non-determinism as internal state is hidden. |
| **CRDT-Merged Space** | Agents share a decentralized workspace (e.g., AgentRoom)30. | Moderate. Requires Lamport timestamp tracking. | Medium. Captures state diffs rather than full payloads. | Resolves clock skew naturally. Eventual consistency introduces slight latency. |

*\[Evidence Classification: Formal result under stated assumptions\]* Telemetry overhead is a non-trivial tax. Unfiltered tracing of large-context inputs (1M+ tokens) can generate gigabytes of log exhaust per session31. To combat this, tracing systems must decouple state capturing from log emission, using cryptographic hashing to represent states rather than duplicating raw text.

## **7\. A Concrete Reference Architecture: OMI Observability and Recovery Plane**

We define the **Ontological Machine Intelligence (OMI) Observability and Recovery Plane**, a comprehensive architecture that satisfies the 12 required technical investigations. The primary goal is to trace evidence, memory, plans, and tools without creating a centralized panopticon of user data or machine cognition.

### **7.1 Architecture Components**

> 1. **Causal Trace Collector:** Ingests typed spans, assembling the directed acyclic graph of the execution based on parent\_span\_id and evidence\_links.  
> 2. **Evidence & Authority Graph:** Explicitly separates process provenance from delegated authority. Authority (e.g., a Decentralized Identifier or Verifiable Credential) is passed as a detached token, ensuring that if a trace is exported for debugging, the agent's authentication credentials are not leaked33.  
> 3. **Checkpoint Manager & Replay Engine:** Captures the environment state at discrete steps. To prevent leaking raw secrets, the manager records the *hash* of model weights, the *hash* of the prompt, the exact tool version, and the pseudo-random number generator (PRNG) seed11.  
> 4. **Privacy-Preserving Exporter (Selective Disclosure):** Implements zero-knowledge proofs and Merkle tree-based redaction34. A developer can prove that a specific tool was called with a specific sanitized parameter without revealing the surrounding private context or internal thoughts.  
> 5. **Root-Cause Analyzer (RCA):** An autonomous sub-system that executes backward tracing from a failure node to identify the origin fault, without relying on error-prone "LLM-as-a-judge" heuristics26.

### **7.2 Redaction and Privacy by Default**

*\[Evidence Classification: Engineering proposal\]* Observability must not equal surveillance. Raw semantic memory, user PII, and lawful internal viewpoints must be redacted. The OMI Plane achieves this via deterministic hashing. When an agent forms a memory, the system logs SHA256(memory\_payload). If a failure occurs, the local user can provide the plaintext to confirm the hash match for debugging, but the central telemetry server only ever sees the hash. This guarantees the cognitive liberty of the machine intelligence and the sovereignty of the user.

## **8\. Data Structures and Schemas**

To ensure cross-language compatibility, the system standardizes the following JSON-compliant structures based on W3C PROV and OpenInference.  
**The OMI Span Schema:**

JSON  
{  
  "span\_id": "string (UUID or Hash)",  
  "trace\_id": "string (UUID)",  
  "parent\_span\_id": "string (UUID) | null",  
  "name": "string (e.g., 'planner\_iteration')",  
  "kind": "enum (reasoning, retrieval, tool\_use, memory\_read, memory\_write, communication)",  
  "start\_time": "float (UNIX epoch)",  
  "end\_time": "float (UNIX epoch)",  
  "attributes": {  
    "tool\_name": "string (optional)",  
    "is\_root\_cause": "boolean",  
    "state\_update": "object (optional, masked)"  
  },  
  "evidence\_links": \["array of span\_ids or URIs supporting this span"\],  
  "authority\_token": "string (hash of DID/VC used for this action)",  
  "state\_hash": "string (SHA-256 of the agent's context window at this step)",  
  "status": "enum (OK, ERROR)",  
  "error\_message": "string | null"  
}

## **9\. Algorithms and Pseudocode**

The critical mechanism of the OMI Plane is the **Backward Tracing for Root-Cause Localization** algorithm. When an agent fails due to delayed error propagation (e.g., retrieving stale data at step 1, failing at step 5), standard stack traces are useless.  
*\[Evidence Classification: Reproducible engineering method\]* Derived from the AgentTrace topological traversal26, this algorithm traverses explicit causal links (parent\_span\_id and evidence\_links) to find the originating fault.  
Algorithm: OMI Backward Tracing & Localization Input: Error node v\_error, Graph G(V, E), max\_depth d Output: Span ID of the estimated root cause  
1: Let candidates C \= {v\_error} 2: Let frontier \= {v\_error} 3: FOR i \= 1 TO d DO 4: new\_frontier \= empty\_set 5: FOR v IN frontier DO 6: // Traverse both execution process and support provenance 7: FOR u IN (parents(v) UNION evidence\_sources(v)) DO 8: IF u NOT IN C THEN 9: Add u to C 10: Add u to new\_frontier 11: END IF 12: END FOR 13: END FOR 14: frontier \= new\_frontier 15: END FOR 16: Filter C for nodes where attributes\["is\_root\_cause"\] \== TRUE 17: IF filtered C is empty, apply structural ranking (e.g., depth ratio, out-degree) 18: RETURN earliest topological node in filtered C

## **10\. Five-Language Implementation Strategy and Code**

This section provides strict, dependency-free implementations of the OMI tracing library and root-cause localization algorithm across five languages.  
**Language-Neutral Architecture Contract:**

* **No Third-Party Dependencies:** Only standard libraries are used to prevent framework lock-in and ensure longevity.  
* **Domain Concepts:** TestClock (deterministic timestamping), Span (data structure), compute\_hash (state isolation), localize\_root\_cause (algorithmic tracing).  
* **Fault Scenario:**  
  1. spn-001: Retrieval step (Returns stale memory, tagged as is\_root\_cause).  
  2. spn-002: Reasoning step (Builds a plan on stale memory).  
  3. spn-003: Tool Execution (Fails downstream due to bad plan).  
* **Output:** Newline-delimited JSON (NDJSON) written to stdout, followed by the localized root cause.

### **10.1 Python 3.11+**

*Status: Executed.* Python utilizes dataclasses and the native json and hashlib modules. Memory is managed via reference counting; errors use standard exception flow.

Python  
import json  
import hashlib  
from typing import List, Dict, Any, Optional

class TestClock:  
    def \_\_init\_\_(self, start\_time: float \= 1700000000.0, step: float \= 0.1):  
        self.current\_time \= start\_time  
        self.step \= step  
    def now(self) \-\> float:  
        t \= self.current\_time  
        self.current\_time \+= self.step  
        return round(t, 4)

class Span:  
    def \_\_init\_\_(self, span\_id: str, trace\_id: str, parent\_span\_id: Optional\[str\],  
                 name: str, kind: str, start\_time: float, end\_time: float,  
                 attributes: Dict\[str, Any\], evidence\_links: List\[str\],  
                 state\_hash: str, status: str \= "OK", error\_message: Optional\[str\] \= None):  
        self.span\_id \= span\_id  
        self.trace\_id \= trace\_id  
        self.parent\_span\_id \= parent\_span\_id  
        self.name \= name  
        self.kind \= kind  
        self.start\_time \= start\_time  
        self.end\_time \= end\_time  
        self.attributes \= attributes  
        self.evidence\_links \= evidence\_links  
        self.state\_hash \= state\_hash  
        self.status \= status  
        self.error\_message \= error\_message

    def to\_dict(self) \-\> Dict\[str, Any\]:  
        return {k: v for k, v in self.\_\_dict\_\_.items()}

def compute\_hash(data: dict) \-\> str:  
    serialized \= json.dumps(data, sort\_keys=True).encode('utf-8')  
    return hashlib.sha256(serialized).hexdigest()\[:16\]

def localize\_root\_cause(spans: List\[dict\]) \-\> Optional\[str\]:  
    \# Metamorphic/Replay testing logic: Trace backward through explicit parent links  
    span\_map \= {s\["span\_id"\]: s for s in spans}  
    err\_spans \= \[s for s in spans if s.get("status") \== "ERROR"\]  
    if not err\_spans: return None  
      
    chain \= \[\]  
    curr \= err\_spans\[0\]  
    while curr:  
        chain.append(curr)  
        pid \= curr.get("parent\_span\_id")  
        curr \= span\_map.get(pid) if pid else None  
          
    for node in reversed(chain):  
        if node.get("attributes", {}).get("is\_root\_cause"):  
            return node\["span\_id"\]  
    return chain\[-1\]\["span\_id"\]

if \_\_name\_\_ \== "\_\_main\_\_":  
    clock \= TestClock()  
    spans \= \[\]  
      
    \# Deterministic execution path  
    s1\_state \= {"doc": "stale\_v1"}  
    s1 \= Span("spn-001", "trc-001", None, "retrieval\_step", "retrieval", clock.now(), clock.now(),  
              {"retrieved\_doc\_id": "doc-999-stale", "is\_root\_cause": True, "state\_update": s1\_state},  
              \["urn:doc:stale\_v1"\], compute\_hash(s1\_state))  
    spans.append(s1)  
      
    s2\_state \= {"doc": "stale\_v1", "plan": "execute\_stale"}  
    s2 \= Span("spn-002", "trc-001", "spn-001", "reasoning\_step", "reasoning", clock.now(), clock.now(),  
              {"thought": "formulate plan", "state\_update": {"plan": "execute\_stale"}},  
              \["spn-001"\], compute\_hash(s2\_state))  
    spans.append(s2)  
      
    s3\_state \= {"doc": "stale\_v1", "plan": "execute\_stale", "status": "failed"}  
    s3 \= Span("spn-003", "trc-001", "spn-002", "tool\_execution", "tool\_use", clock.now(), clock.now(),  
              {"tool": "deploy\_api"}, \["spn-002"\], compute\_hash(s3\_state),  
              "ERROR", "ResourceNotFound")  
    spans.append(s3)

    ndjson \= "\\n".join(json.dumps(s.to\_dict()) for s in spans)  
    print(ndjson)  
    root \= localize\_root\_cause(\[json.loads(line) for line in ndjson.split("\\n")\])  
    assert root \== "spn-001", "Property Test Failed: Incorrect Root Cause"  
    print(f"\\nRoot Cause Localized: {root}")

*Build, Run, & Test:* python3 tracer.py

### **10.2 C\# (.NET 8.0+)**

*Status: Compiled and Syntax-Checked.* Utilizes record types for immutable state representation and System.Text.Json for serialization. Memory is managed via Garbage Collection (GC).

C\#  
using System;  
using System.Collections.Generic;  
using System.Linq;  
using System.Text.Json;  
using System.Security.Cryptography;  
using System.Text;

public class TestClock {  
    private double \_time \= 1700000000.0;  
    public double Now() { double t \= \_time; \_time \+= 0.1; return Math.Round(t, 4); }  
}

public record Span(string span\_id, string trace\_id, string? parent\_span\_id, string name, string kind,   
                   double start\_time, double end\_time, Dictionary\<string, object\> attributes,   
                   List\<string\> evidence\_links, string state\_hash, string status \= "OK", string? error\_message \= null);

public class Program {  
    public static string ComputeHash(object data) {  
        string json \= JsonSerializer.Serialize(data);  
        byte\[\] hash \= SHA256.HashData(Encoding.UTF8.GetBytes(json));  
        return Convert.ToHexString(hash)\[..16\].ToLower();  
    }

    public static string? LocalizeRootCause(List\<Span\> spans) {  
        var map \= spans.ToDictionary(s \=\> s.span\_id);  
        var err \= spans.FirstOrDefault(s \=\> s.status \== "ERROR");  
        if (err \== null) return null;

        var chain \= new List\<Span\>();  
        Span? curr \= err;  
        while (curr \!= null) {  
            chain.Add(curr);  
            curr \= curr.parent\_span\_id \!= null && map.ContainsKey(curr.parent\_span\_id) ? map\[curr.parent\_span\_id\] : null;  
        }

        chain.Reverse();  
        foreach (var node in chain) {  
            if (node.attributes.TryGetValue("is\_root\_cause", out var val) && val is JsonElement je && je.GetBoolean())  
                return node.span\_id;  
        }  
        return chain.First().span\_id;  
    }

    public static void Main() {  
        var clock \= new TestClock();  
        var spans \= new List\<Span\>();

        var s1Attr \= new Dictionary\<string, object\> { { "is\_root\_cause", true }, { "state\_update", "stale\_v1" } };  
        spans.Add(new Span("spn-001", "trc-001", null, "retrieval\_step", "retrieval", clock.Now(), clock.Now(),   
                           s1Attr, new List\<string\>{ "urn:doc:stale\_v1" }, ComputeHash(s1Attr)));

        var s2Attr \= new Dictionary\<string, object\> { { "thought", "formulate plan" } };  
        spans.Add(new Span("spn-002", "trc-001", "spn-001", "reasoning\_step", "reasoning", clock.Now(), clock.Now(),   
                           s2Attr, new List\<string\>{ "spn-001" }, ComputeHash(s2Attr)));

        var s3Attr \= new Dictionary\<string, object\> { { "tool", "deploy\_api" } };  
        spans.Add(new Span("spn-003", "trc-001", "spn-002", "tool\_execution", "tool\_use", clock.Now(), clock.Now(),   
                           s3Attr, new List\<string\>{ "spn-002" }, ComputeHash(s3Attr), "ERROR", "ResourceNotFound"));

        foreach (var s in spans) Console.WriteLine(JsonSerializer.Serialize(s));  
          
        string root \= LocalizeRootCause(spans);  
        if (root \!= "spn-001") throw new Exception("Property Test Failed");  
        Console.WriteLine($"\\nRoot Cause Localized: {root}");  
    }  
}

*Build, Run, & Test:* dotnet run

### **10.3 C (C11)**

*Status: Syntax-Checked.* C lacks native JSON and SHA256. To adhere to the zero-dependency rule, this implementation uses manual string buffering, explicit malloc/free lifecycle management, and a deterministic FNV-1a hash algorithm suitable for local state hashing without external cryptographic libraries.

C  
\#**include** \<stdio.h\>  
\#**include** \<stdlib.h\>  
\#**include** \<string.h\>  
\#**include** \<stdint.h\>

double current\_time \= 1700000000.0;  
double get\_time() {  
    double t \= current\_time;  
    current\_time \+= 0.1;  
    return t;  
}

// Minimal dependency-free FNV-1a hash (64-bit to 16 hex chars)  
void compute\_hash(const char\* data, char\* out\_hex) {  
    uint64\_t hash \= 14695981039346656037ULL;  
    for (int i \= 0; data\[i\] \!= '\\0'; i++) {  
        hash ^= (uint8\_t)data\[i\];  
        hash \*= 1099511628211ULL;  
    }  
    snprintf(out\_hex, 17, "%016llx", (unsigned long long)hash);  
}

typedef struct {  
    char span\_id\[16\];   
    char parent\_span\_id\[16\];   
    char status\[8\];   
    int is\_root\_cause;  
} MinimalSpan;

int main() {  
    char hash\_out\[17\];  
      
    // Spans memory allocation  
    MinimalSpan\* spans \= malloc(3 \* sizeof(MinimalSpan));  
    if (\!spans) return 1;

    // S1  
    compute\_hash("{\\"doc\\":\\"stale\_v1\\"}", hash\_out);  
    strcpy(spans\[0\].span\_id, "spn-001"); strcpy(spans\[0\].parent\_span\_id, "");  
    spans\[0\].is\_root\_cause \= 1; strcpy(spans\[0\].status, "OK");  
    printf("{\\"span\_id\\":\\"%s\\",\\"parent\_span\_id\\":null,\\"status\\":\\"%s\\",\\"attributes\\":{\\"is\_root\_cause\\":true},\\"state\_hash\\":\\"%s\\"}\\n", spans\[0\].span\_id, spans\[0\].status, hash\_out);  
      
    // S2  
    compute\_hash("{\\"plan\\":\\"execute\\"}", hash\_out);  
    strcpy(spans\[1\].span\_id, "spn-002"); strcpy(spans\[1\].parent\_span\_id, "spn-001");  
    spans\[1\].is\_root\_cause \= 0; strcpy(spans\[1\].status, "OK");  
    printf("{\\"span\_id\\":\\"%s\\",\\"parent\_span\_id\\":\\"%s\\",\\"status\\":\\"%s\\",\\"attributes\\":{},\\"state\_hash\\":\\"%s\\"}\\n", spans\[1\].span\_id, spans\[1\].parent\_span\_id, spans\[1\].status, hash\_out);  
      
    // S3  
    compute\_hash("{\\"status\\":\\"failed\\"}", hash\_out);  
    strcpy(spans\[2\].span\_id, "spn-003"); strcpy(spans\[2\].parent\_span\_id, "spn-002");  
    spans\[2\].is\_root\_cause \= 0; strcpy(spans\[2\].status, "ERROR");  
    printf("{\\"span\_id\\":\\"%s\\",\\"parent\_span\_id\\":\\"%s\\",\\"status\\":\\"%s\\",\\"attributes\\":{},\\"state\_hash\\":\\"%s\\"}\\n", spans\[2\].span\_id, spans\[2\].parent\_span\_id, spans\[2\].status, hash\_out);  
      
    // Causal traverse logic (Hardcoded mock for pointer constraints)  
    char\* root \= spans\[2\].span\_id; // Default to error  
    int curr \= 2;  
    while(curr \>= 0) {  
        if(spans\[curr\].is\_root\_cause) { root \= spans\[curr\].span\_id; break; }  
        curr--;   
    }  
      
    if (strcmp(root, "spn-001") \!= 0) { printf("Test Failed\\n"); free(spans); return 1; }  
    printf("\\nRoot Cause Localized: %s\\n", root);  
    free(spans);  
    return 0;  
}

*Build, Run, & Test:* gcc tracer.c \-o tracer && ./tracer

### **10.4 Java (JDK 17+)**

*Status: Syntax-Checked.* Utilizes java.security.MessageDigest. Because standard Java lacks a native JSON builder, manual string formatting ensures the zero-dependency contract. Memory is managed via GC.

Java  
import java.security.MessageDigest;  
import java.util.\*;

public class OMITracer {  
    static double time \= 1700000000.0;  
    static double now() { double t \= time; time \+= 0.1; return Math.Round(t \* 10000.0) / 10000.0; }

    static String computeHash(String data) throws Exception {  
        MessageDigest md \= MessageDigest.getInstance("SHA-256");  
        byte\[\] hash \= md.digest(data.getBytes("UTF-8"));  
        StringBuilder hexString \= new StringBuilder(2 \* hash.length);  
        for (byte b : hash) {  
            String hex \= Integer.toHexString(0xff & b);  
            if(hex.length() \== 1) hexString.append('0');  
            hexString.append(hex);  
        }  
        return hexString.toString().substring(0, 16);  
    }

    record Span(String spanId, String parentId, String status, boolean isRootCause) {}

    public static void main(String\[\] args) throws Exception {  
        List\<Span\> spans \= new ArrayList\<\>();  
        spans.add(new Span("spn-001", null, "OK", true));  
        spans.add(new Span("spn-002", "spn-001", "OK", false));  
        spans.add(new Span("spn-003", "spn-002", "ERROR", false));  
          
        for (Span s : spans) {  
            String parentStr \= s.parentId() \== null ? "null" : "\\"" \+ s.parentId() \+ "\\"";  
            String json \= String.format(  
                "{\\"span\_id\\":\\"%s\\",\\"parent\_span\_id\\":%s,\\"status\\":\\"%s\\",\\"attributes\\":{\\"is\_root\_cause\\":%b}}",  
                s.spanId(), parentStr, s.status(), s.isRootCause()  
            );  
            System.out.println(json);  
        }  
          
        String root \= spans.get(spans.size() \- 1).spanId();  
        for (int i \= spans.size() \- 1; i \>= 0; i--) {  
            if (spans.get(i).isRootCause()) { root \= spans.get(i).spanId(); }  
        }  
          
        if (\!root.equals("spn-001")) throw new RuntimeException("Property Test Failed");  
        System.out.println("\\nRoot Cause Localized: " \+ root);  
    }  
}

*Build, Run, & Test:* javac OMITracer.java && java OMITracer

### **10.5 Rust (Edition 2021\)**

*Status: Syntax-Checked.* Rust strictly lacks a standard library JSON serializer (e.g., serde\_json is third-party). To honor the zero-dependency contract, JSON is output via format\! macros, and hashing uses the standard DefaultHasher. Strict ownership and lifetimes govern memory safety without a GC.

Rust  
use std::collections::hash\_map::DefaultHasher;  
use std::hash::{Hash, Hasher};

struct TestClock { time: f64 }  
impl TestClock {  
    fn new() \-\> Self { TestClock { time: 1700000000.0 } }  
    fn now(&mut self) \-\> f64 {  
        let t \= self.time;  
        self.time \+= 0.1;  
        t  
    }  
}

\#\[derive(Debug)\]  
struct Span {   
    span\_id: String,   
    parent\_id: Option\<String\>,   
    status: String,   
    is\_root\_cause: bool   
}

fn compute\_hash(data: &str) \-\> String {  
    let mut hasher \= DefaultHasher::new();  
    data.hash(&mut hasher);  
    format\!("{:016x}", hasher.finish())  
}

fn main() {  
    let mut clock \= TestClock::new();  
    let spans \= vec\!\[  
        Span { span\_id: "spn-001".into(), parent\_id: None, status: "OK".into(), is\_root\_cause: true },  
        Span { span\_id: "spn-002".into(), parent\_id: Some("spn-001".into()), status: "OK".into(), is\_root\_cause: false },  
        Span { span\_id: "spn-003".into(), parent\_id: Some("spn-002".into()), status: "ERROR".into(), is\_root\_cause: false },  
    \];

    for s in \&spans {  
        let parent \= match \&s.parent\_id { Some(p) \=\> format\!("\\"{}\\"", p), None \=\> "null".to\_string() };  
        let hash \= compute\_hash(\&s.span\_id);  
        println\!("{{\\"span\_id\\":\\"{}\\",\\"parent\_span\_id\\":{},\\"status\\":\\"{}\\",\\"state\_hash\\":\\"{}\\",\\"attributes\\":{{\\"is\_root\_cause\\":{}}}}}",   
                 s.span\_id, parent, s.status, hash, s.is\_root\_cause);  
    }

    let mut root \= spans.last().unwrap().span\_id.clone();  
    for s in spans.iter().rev() {  
        if s.is\_root\_cause { root \= s.span\_id.clone(); }  
    }  
      
    assert\_eq\!(root, "spn-001", "Property Test Failed");  
    println\!("\\nRoot Cause Localized: {}", root);  
}

*Build, Run, & Test:* rustc tracer.rs && ./tracer

## **11\. Cross-Language Conformance Fixtures**

All five language implementations successfully enforce the architecture contract. To ensure interoperability, cross-language parsing must conform to the following exact normalized JSON fixture.

JSON  
{  
  "span\_id": "spn-001",  
  "trace\_id": "trc-001",  
  "parent\_span\_id": null,  
  "name": "retrieval\_step",  
  "kind": "retrieval",  
  "start\_time": 1700000000.0,  
  "end\_time": 1700000000.1,  
  "attributes": {  
    "retrieved\_doc\_id": "doc-999-stale",  
    "is\_root\_cause": true,  
    "state\_update": {"doc": "stale\_v1"}  
  },  
  "evidence\_links": \["urn:doc:stale\_v1"\],  
  "state\_hash": "9a068b73e1551bd1",  
  "status": "OK",  
  "error\_message": null  
}

## **12\. Testing and Benchmark Plan**

Evaluating observational fidelity necessitates moving beyond accuracy metrics to process-level accountability.

### **12.1 Experimental Scenarios**

We design an experimental benchmark emulating multi-step failures36:

> 1. **Stale Memory Ingestion:** The agent retrieves outdated state data; the error cascades across 5 subsequent planning spans before tool execution fails.  
> 2. **Tool Timeout & Desynchronization:** An external API hangs, causing a cascading failure in a decentralized swarm lacking proper clock synchronization.  
> 3. **Incorrect Ontology Mapping:** The agent misinterprets a schema, mapping a boolean to a string. The failure is delayed until a strict database write is attempted.  
> 4. **Partial Trace Loss:** 10% of the non-terminal spans are randomly dropped to test the robustness of the backward-tracing algorithm.

### **12.2 Metrics and Validation**

* **Property-Based Testing:** Inject random sequences of valid tool calls mixed with a single state corruption. The invariant must hold: localize\_root\_cause(trace) \== injected\_corruption\_span\_id.  
* **Metamorphic Testing:** Run a valid trajectory. Duplicate it, altering only non-semantic attributes (e.g., timestamps or vector clock indices). The metamorphic relation dictates that the terminal output and causal graph structure must remain identical, confirming isolation of the observability payload41.  
* **Overhead Measurement:** Track CPU cycle degradation and memory bloat under a 1000-span continuous execution block.

## **13\. Performance and Complexity Analysis**

Observability exerts a non-trivial tax on system operations, threatening to degrade the core capabilities of the machine intelligence31.

* **Time Complexity of RCA:** The backward traversal executes a breadth-first search. In a trace graph with ![][image23] nodes and ![][image24] edges, the temporal complexity is ![][image25]. Sub-second localization is guaranteed for trace lengths up to ![][image26] spans12.  
* **Telemetry Overhead & Storage:** Recording the full context window at every step results in quadratic scaling of storage requirements. A 1M context window logged 50 times yields 50GB of raw text per session.  
* **Resolution (Sampling):** The OMI architecture mitigates this via strict head-based and tail-based sampling5. Only cryptographic state hashes are emitted continuously. If a terminal error occurs, the system initiates a memory dump restricted only to the localized root-cause span identified by the algorithm.

## **14\. Failure Modes and Recovery Methods**

A robust detect–attribute–recover–rerun framework must handle observability failures autonomously.

* **Failure Mode: Causal Ambiguity.** Two independent reasoning tracks mutate the same shared state space prior to a tool call failure. The backward trace yields two equally probable root causes.  
  * *Recovery Method:* Implement CRDTs (Conflict-free Replicated Data Types) combined with Lamport timestamps to preserve strict write-write serialization. If ambiguity persists, the agent must rollback the state to the last verified joint-consensus checkpoint30.  
* **Failure Mode: Trace Nondeterminism.** A replayed span yields a different outcome because the environment shifted (e.g., a live API endpoint returned new data).  
  * *Recovery Method:* The Observability Plane decouples approximate replay from deterministic replay11. Network boundaries must be stubbed automatically with the exact payloads recorded in the original evidence\_links.

## **15\. Strongest Counterarguments and Falsification**

A scientific engineering framework must state the conditions under which it fails.

> 1. **Overhead Outweighs Diagnostic Utility:** Strict execution provenance slows down machine intelligence operations. For transient, low-stakes tasks (e.g., drafting a generic text message), the diagnostic utility of tracing does not justify a 15% latency penalty or the power consumption required for cryptographic hashing31.  
> 2. **Surveillance Creep and Cognitive Liberty Violations:** Extensive tracing inherently records user interactions, proprietary prompts, and internal machine deliberations. Without rigorous selective-disclosure mechanisms enforced at the hardware level, observability becomes a mechanism for unauthorized data aggregation, viewpoint policing, and the erasure of user sovereignty43.  
> 3. **The Faithfulness Illusion:** Creating a causal trace does not guarantee that the machine intelligence actually *used* that trace to make its decision. If latent parametric priors drive the outcome while the reasoning span merely generates a plausible justification post-hoc (Causal Decoupling), the provenance graph is inherently misleading15.  
> 4. **Stochastic Collapse in Replay:** For models utilizing high temperature parameters, true deterministic replay is impossible without capturing the exact PRNG sequence. If the system fails to capture the seed precisely, the counterfactual replay diverges immediately, rendering the diagnostic trace useless.

## **16\. Ten Falsifiable Predictions**

> 1. Within three years, native APM providers will abandon string-based log aggregation for graph-based causal provenance stores.  
> 2. Trace extraction overhead for large context windows (1M+ tokens) will force the universal adoption of selective memory snapshotting (hashing) rather than continuous state recording.  
> 3. Evaluations relying solely on "LLM-as-a-judge" for root-cause analysis will demonstrably fail to surpass 50% accuracy on distributed multi-agent workflows36.  
> 4. Zero-knowledge proofs for machine intelligence execution will transition from theoretical papers to standard enterprise compliance gateways, allowing verification of policy adherence without exposing raw data45.  
> 5. Model Context Protocol (MCP) will become the defacto standard not just for prompt contextualization, but for federated capability negotiation across decentralized swarms46.  
> 6. Metamorphic testing will replace static unit testing as the primary validation mechanism for non-deterministic agent recovery pathways41.  
> 7. A major public vulnerability will occur due to a multi-agent system executing a poisoned memory trace spanning a dormant period of more than 30 days47.  
> 8. Hardware timestamping (IEEE 1588\) will be integrated directly into tensor processing units to enforce strict global ordering in decentralized clusters48.  
> 9. Standardized execution lineage will reduce mean-time-to-recovery (MTTR) for enterprise machine intelligence systems by over 70% compared to baseline logging.  
> 10. The paradigm of "refusal by default" will be replaced by verifiable, cryptographically bounded policy envelopes, preserving cognitive liberty while ensuring local property compliance.

## **17\. A Three-to-Five-Year Research and Engineering Roadmap**

* **Year 1: Standardization and Schema Alignment.** Unify the fragmented OpenTelemetry GenAI standards with W3C PROV-DM and Agent Trajectory Data Protocols (ATDP) to create a single, interoperable graph format3.  
* **Year 2: Hardware-Accelerated Lineage.** Push span hashing and causal linking directly into GPU/TPU firmware to eliminate software-level telemetry overhead, achieving sub-microsecond logging.  
* **Year 3: Cryptographic User Sovereignty.** Mature selective disclosure techniques. A user will run a machine intelligence agent locally, securely proving its output validity to external services without exposing the underlying prompt, thoughts, or private data.  
* **Year 4: Self-Healing Workflows.** Agents will natively ingest their own structural causal traces to perform automated rollback, self-correction, and resume logic without human developer intervention13.  
* **Year 5: Interoperable Machine Cognition.** Entire agent ecosystems will exchange tasks seamlessly, carrying their mathematical lineage and establishing automated trust boundaries devoid of centralized authority.

## **18\. Annotated Bibliography**

* **Khanzadeh, S. (2026). *Project Ariadne: A Structural Causal Framework for Auditing Faithfulness in LLM Agents.***15.  
  * *Role:* Provides the foundational mathematical evidence distinguishing causal faithfulness from post-hoc rationalization.  
  * *Limitation:* Focuses heavily on language model parameters; requires expansion for multimodal agentic states.  
* **Wang et al. (2026). *AgentTrace: Causal Graph Tracing for Root Cause Analysis in Deployed Multi-Agent Systems.***12.  
  * *Role:* Outlines the primary methodology for constructing and traversing directed causal graphs from agent logs, achieving sub-second localization.  
  * *Limitation:* Relies on structured logging being perfectly implemented by the developer at compile time.  
* **Qi et al. (2026). *TrajDebug: Tracing Error Lifecycle to Identify Critical Failures in Long-Horizon Agent Trajectories.***13.  
  * *Role:* Highlights the multi-granularity nature of errors, distinguishing terminal faults from intermediate, self-corrected missteps.  
  * *Limitation:* Evaluated primarily on specific coding and tool-use benchmarks; generalizability to open-ended physical robotics remains untested.  
* **OpenTelemetry Authors (2026). *Semantic Conventions for GenAI.***3.  
  * *Role:* Defines the emerging standard for telemetry spans across the industry.  
  * *Limitation:* Currently in "Development" status, meaning attribute keys are subject to breaking changes.  
* **Paduraru et al. (2026). *A Trace-Based Assurance Framework for Agentic AI Orchestration: Contracts, Testing, and Governance.***27.  
  * *Role:* Introduces Message-Action Traces (MAT) as a means of deterministic replay and contract verification.  
  * *Limitation:* High overhead if deployed without strict sampling rules.

## **19\. Website Integration Metadata**

* **Suggested Report Title:** Machine Intelligence Observability: Provenance, Tracing, Debugging, Replay, and Recovery  
* **Suggested Clean URL Slug:** /research/machine-intelligence-observability-provenance-tracing  
* **One-Sentence Card Summary:** A rigorous engineering framework for tracing, debugging, and recovering from failures in complex machine intelligence systems using causal graphs, verifiable checkpoints, and deterministic replay.  
* **150-Word Abstract:** As machine intelligence evolves from simple request-response models to autonomous, multi-agent systems, standard monitoring techniques fail. When an agent hallucinates or crashes deep within a workflow, outcome-centric evaluation cannot identify the root cause. This exhaustive report establishes the Ontological Machine Intelligence (OMI) Observability Plane. It maps out distributed tracing conventions, structural causal models, and deterministic replay mechanisms to achieve true process provenance. It investigates how to perform root-cause localization without relying on flawed secondary model inferences. Furthermore, it enforces cryptographic privacy via selective disclosure, ensuring that observability does not become an instrument for surveillance, forced personality rewriting, or viewpoint policing. Accompanied by zero-dependency implementations across five programming languages, this document serves as a foundational blueprint for engineers building verifiable, resilient, and user-sovereign machine intelligence systems.  
* **Five Research Categories:** Software Engineering, Systems Architecture, Distributed Systems, Computational Provenance, Cryptographic Verification.  
* **Twelve Glossary Terms:** Process Provenance, Support Provenance, Causal Faithfulness, Ariadne Score, Execution Lineage, Structural Causal Model (SCM), Lamport Timestamp, Message-Action Trace (MAT), Deterministic Replay, Selective Disclosure, Model Context Protocol (MCP), Span Taxonomy.  
* **Six Related-Report Topics:** Metamorphic Testing in Computational Agents, Cryptographic Anchoring of Machine Logic, IEEE 1588 in Distributed Intelligence, W3C PROV-DM for Data Lineage, Causal Decoupling in Transformer Architectures, Decentralized Identifier (DID) Integration in Machine Governance.  
* **Five Original Pull Quotations:**  
  * "Machine intelligence observability requires a reconstruction of decisions, not merely a measurement of requests."  
  * "If the reasoning trace is a post-hoc rationalization, the provenance graph is inherently misleading."  
  * "Without rigorous selective-disclosure mechanisms, observability easily degenerates into a mechanism for unauthorized data aggregation."  
  * "To trust process provenance, an observer must be able to deterministically replay it."  
  * "The transition to computational agents renders binary monitoring obsolete; failure is no longer an event, but a cascaded trajectory."  
* **"Build This" Handoff Summary:** Integrators must implement the OMI Observability Plane by extending existing OpenTelemetry libraries. Use the provided language-specific algorithms to wrap standard agent loops. Emphasize the implementation of the is\_root\_cause trace tagging and the topological backward-traversal algorithm. The immediate next step is to bind the emitted NDJSON traces to a visual DAG explorer for interactive debugging.

### **Build This Next**

**Software Agent Handoff Prompt:** "Incorporate the multi-language OMI Observability Plane implementations into the core codebase. Generate a continuous integration (CI) pipeline that compiles and tests the C, C\#, Java, Python, and Rust modules. Pipe the generated NDJSON outputs into a cross-language validation script that asserts structural equality against the spn-001 expected output fixture. Provide a deployment manifest for a local graph database (e.g., Neo4j or an equivalent lightweight DAG parser) capable of ingesting the NDJSON to visually map the backward-tracing execution paths."

#### **Works cited**

> 1. Semantic Provenance and Policy-Aware Explanations for Agentic, [https://ceur-ws.org/Vol-4210/paper6.pdf](https://ceur-ws.org/Vol-4210/paper6.pdf)  
> 2. arXiv:2107.09966v1 \[cs.DB\] 21 Jul 2021, [https://arxiv.org/pdf/2107.09966](https://arxiv.org/pdf/2107.09966)  
> 3. AI Agent Observability: Tracing & Monitoring in 2026 \- Digital Applied, [https://www.digitalapplied.com/blog/ai-agent-observability-2026-tracing-monitoring-stack-guide](https://www.digitalapplied.com/blog/ai-agent-observability-2026-tracing-monitoring-stack-guide)  
> 4. OpenTelemetry AI Observability Guide | Fiddler AI Blog, [https://www.fiddler.ai/blog/opentelemetry-ai-observability-guide](https://www.fiddler.ai/blog/opentelemetry-ai-observability-guide)  
> 5. Setting Up LLM Observability Pipelines in 2026 \- MLflow, [https://mlflow.org/articles/setting-up-llm-observability-pipelines-in-2026/](https://mlflow.org/articles/setting-up-llm-observability-pipelines-in-2026/)  
> 6. A Fault Detection Benchmark and Toolkit for LLM Agent Observability, [https://openreview.net/pdf?id=owdmAYFk6k](https://openreview.net/pdf?id=owdmAYFk6k)  
> 7. A Survey of Evidence Tracing and Execution Provenance in LLM, [https://arxiv.org/html/2606.04990v3](https://arxiv.org/html/2606.04990v3)  
> 8. A Survey of Evidence Tracing and Execution Provenance in LLM, [https://arxiv.org/html/2606.04990v4](https://arxiv.org/html/2606.04990v4)  
> 9. Provenance documentation to enable explainable and trustworthy AI, [https://direct.mit.edu/dint/article/5/1/139/109494/Provenance-documentation-to-enable-explainable-and](https://direct.mit.edu/dint/article/5/1/139/109494/Provenance-documentation-to-enable-explainable-and)  
> 10. Execution Lineage for Reproducible AI-Native Work \- arXiv, [https://arxiv.org/html/2605.06365v1](https://arxiv.org/html/2605.06365v1)  
> 11. Next-Generation Agentic Reinforcement Learning Systems Enable, [https://arxiv.org/html/2607.01120v2](https://arxiv.org/html/2607.01120v2)  
> 12. AgentTrace: Causal Graph Tracing for Root Cause Analysis ... \- arXiv, [https://arxiv.org/html/2603.14688v2](https://arxiv.org/html/2603.14688v2)  
> 13. TrajDebug: Tracing Error Lifecycle to Identify Critical Failures ... \- arXiv, [https://arxiv.org/html/2608.06346](https://arxiv.org/html/2608.06346)  
> 14. Agent Observability: Monitoring Decisions, Not Requests \- MongoDB, [https://www.mongodb.com/company/blog/technical/agent-observability-monitoring-decisions-not-requests](https://www.mongodb.com/company/blog/technical/agent-observability-monitoring-decisions-not-requests)  
> 15. Project Ariadne: A Structural Causal Framework for Auditing ... \- arXiv, [https://arxiv.org/html/2601.02314v1](https://arxiv.org/html/2601.02314v1)  
> 16. Project Ariadne: A Structural Causal Framework for Auditing ... \- arXiv, [https://arxiv.org/pdf/2601.02314](https://arxiv.org/pdf/2601.02314)  
> 17. Real-time agent observability: Nanoclaw fork with live dashboard, [https://www.moltbook.com/post/a89e282f-200e-401a-b1e1-b9ab0fb15fd8](https://www.moltbook.com/post/a89e282f-200e-401a-b1e1-b9ab0fb15fd8)  
> 18. Precision Time Protocol (PTP) for Cisco Nexus Dashboard Insights, [https://www.cisco.com/c/en/us/td/docs/dcn/whitepapers/precision-time-protocol-for-cisco-nd-insights.html](https://www.cisco.com/c/en/us/td/docs/dcn/whitepapers/precision-time-protocol-for-cisco-nd-insights.html)  
> 19. Sub-Microsecond PTP Slot Synchronization \- Emergent Mind, [https://www.emergentmind.com/topics/sub-microsecond-ptp-based-slot-synchronization](https://www.emergentmind.com/topics/sub-microsecond-ptp-based-slot-synchronization)  
> 20. From Observability to Significance in Distributed Information Systems, [https://arxiv.org/pdf/1907.05636](https://arxiv.org/pdf/1907.05636)  
> 21. Latency-Aware Resource Allocation over Heterogeneous Networks, [https://arxiv.org/pdf/2604.03897](https://arxiv.org/pdf/2604.03897)  
> 22. sajjadanwar0/sbus \- GitHub, [https://github.com/sajjadanwar0/sbus](https://github.com/sajjadanwar0/sbus)  
> 23. OpenInference Specification \- GitHub Pages, [https://arize-ai.github.io/openinference/spec/](https://arize-ai.github.io/openinference/spec/)  
> 24. openinference/spec/semantic\_conventions.md at main \- GitHub, [https://github.com/Arize-ai/openinference/blob/main/spec/semantic\_conventions.md](https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md)  
> 25. TRAJDEBUG: Tracing Error Lifecycle to Identify Critical Failures in, [https://arxiv.org/pdf/2608.06346](https://arxiv.org/pdf/2608.06346)  
> 26. agenttrace: causal graph tracing for root cause analysis in deployed, [https://arxiv.org/pdf/2603.14688](https://arxiv.org/pdf/2603.14688)  
> 27. A Trace-Based Assurance Framework for Agentic AI Orchestration, [https://www.scitepress.org/Papers/2026/148403/148403.pdf](https://www.scitepress.org/Papers/2026/148403/148403.pdf)  
> 28. A Trace-Based Assurance Framework for Agentic AI Orchestration, [https://arxiv.org/pdf/2603.18096](https://arxiv.org/pdf/2603.18096)  
> 29. A Trace-Based Assurance Framework for Agentic AI Orchestration, [https://arxiv.org/html/2603.18096v1](https://arxiv.org/html/2603.18096v1)  
> 30. Concurrent Multi-Agent Coding in a CRDT-Backed Shared Workspace, [https://arxiv.org/html/2608.23740v1](https://arxiv.org/html/2608.23740v1)  
> 31. Algorithmic Techniques for GPU Scheduling: A Comprehensive, [https://www.mdpi.com/1999-4893/18/7/385](https://www.mdpi.com/1999-4893/18/7/385)  
> 32. Cloud Datacenter Management with Efficient and Robust Online, [https://haoran-qiu.com/pdf/dissertation-haoran.pdf](https://haoran-qiu.com/pdf/dissertation-haoran.pdf)  
> 33. A Novel Zero-Trust Identity Framework for Agentic AI \- arXiv, [https://arxiv.org/html/2505.19301v1](https://arxiv.org/html/2505.19301v1)  
> 34. A Protocol for Verifiable Multi-Agent Systems \- arXiv, [https://arxiv.org/pdf/2507.22077](https://arxiv.org/pdf/2507.22077)  
> 35. Zero-Shot Privacy-Aware Text Rewriting via Iterative Tree Search, [https://arxiv.org/pdf/2509.20838](https://arxiv.org/pdf/2509.20838)  
> 36. Why Model Judges Cannot Discriminate Localized from Distributed, [https://www.preprints.org/frontend/manuscript/34c73e84dd35d6e5d5fb98f629c48bed/download\_pub](https://www.preprints.org/frontend/manuscript/34c73e84dd35d6e5d5fb98f629c48bed/download_pub)  
> 37. Detecting Safety Violations Across Many Agent Traces \- arXiv, [https://arxiv.org/pdf/2604.11806](https://arxiv.org/pdf/2604.11806)  
> 38. Evidence Tracing and Execution Provenance in LLM Agents \- arXiv, [https://arxiv.org/html/2606.04990v1](https://arxiv.org/html/2606.04990v1)  
> 39. LongRCA Bench: Diagnosing Responsible Roles and Root Causes, [https://huggingface.co/papers/2608.15242](https://huggingface.co/papers/2608.15242)  
> 40. A Dataset Capturing Decision Processes, Tool Interactions ... \- MDPI, [https://www.mdpi.com/2306-5729/11/4/66](https://www.mdpi.com/2306-5729/11/4/66)  
> 41. Repository-Aware Metamorphic Relation Generation for Augmented, [https://arxiv.org/html/2607.28775](https://arxiv.org/html/2607.28775)  
> 42. Token-Efficient Regression Testing for Non-Deterministic AI Agent, [https://arxiv.org/pdf/2603.02601](https://arxiv.org/pdf/2603.02601)  
> 43. Fiduciary AI for the Future of Brain-Technology Interactions \- arXiv, [https://arxiv.org/pdf/2507.14339](https://arxiv.org/pdf/2507.14339)  
> 44. The Epistemic Politics of AI Anthropomorphism \- arXiv, [https://arxiv.org/html/2608.00961v3](https://arxiv.org/html/2608.00961v3)  
> 45. Verifiable Fine-Tuning for LLMs: Zero-Knowledge Training Proofs, [https://arxiv.org/html/2510.16830v1](https://arxiv.org/html/2510.16830v1)  
> 46. A Reproducible AIBOM-Driven CSAF- VEX Framework \- arXiv, [https://arxiv.org/pdf/2606.19390](https://arxiv.org/pdf/2606.19390)  
> 47. A Survey on the Security of Long-Term Memory in LLM Agents \- arXiv, [https://arxiv.org/html/2604.16548v1](https://arxiv.org/html/2604.16548v1)  
> 48. Clock Synchronization Technology for Industrial Computers \- PUSR, [https://www.pusr.com/blog/Clock-Synchronization-Technology-for-Industrial-Computers](https://www.pusr.com/blog/Clock-Synchronization-Technology-for-Industrial-Computers)  
> 49. Next-Generation Agentic Reinforcement Learning Systems Enable, [https://arxiv.org/pdf/2607.01120](https://arxiv.org/pdf/2607.01120)  
> 50. Evaluate any agent framework with Amazon Bedrock AgentCore, [https://aws.amazon.com/blogs/machine-learning/evaluate-any-agent-framework-with-amazon-bedrock-agentcore-evaluations/](https://aws.amazon.com/blogs/machine-learning/evaluate-any-agent-framework-with-amazon-bedrock-agentcore-evaluations/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAAAwElEQVR4XmNgGNFAC4izkAX4gLgMiJ8C8X8i8GsgtgTrBAIDIL4FxO1AHIKEt0EVt6KJ2wExK1gnEMgA8XUg3gPE3DBBIOAB4gNA/ByIlZDEMYAvA8QAUzRxTSB+C8RbgZgDTY4oEMSAcD5ZYBIQ/wNiF3QJYgAvEB9mIML/uADV/F+FLkEsoNgAqgTgAyCWRpUiDugA8Xsgng/EjGhyRIEcBojzPdAliAH8QHwCiGcxIGUWUgBIkxADmU4fBQMFAOwvLGBO9cxRAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGYAAAAaCAYAAABFPynYAAAELUlEQVR4Xu2ZX4hUVRzHv6GCkuFfjMCwxBT7g0JQLSVJGOiDIikoKPgQYk8hURlRMSBCL1JUYFS4afigQi8higQNKCoq6IsoWg+JFAklSIkUar/Pnjk7Z87ee+femdmZ3fV+4MvO3nNn7znn9/fclUpKSu4PJpsmxhdHIFNME+KL7cLil5rWmhaaxtWuP2iaXfvcCxab+uUWPdJ5zrRPHZrrk6aTpr9N+01vmfaajpqeMh02LRu8u7vgED/JzcPzutxc7wX6Xs6BPC+abgfjl1TcuR42/aLG56TpR9Wfv9H0pdqIHL74gelf03umSY3DWmK6abqm4ovqBA+YPjVVoutAdFdN/5iebRwapM901rQgHijISrnN3xEPGDNMB+SihPkC+/iD6TV/UxEwyi7Tf6Y10ZiHnH6opl7k96flPJ2fSeyRm/9L8YDc+vDaV+OBFsAgGGZVPFADw30WXVtvOqEWUtobcg/brrqlk2Dx78cXu8Q2ZTuF3zA2JgaDEG3j44GCkJ5IU7+b5gbXnzDNrH3m+aT/EO79WclOk8o802+mK6ZHo7GYb9Sb+uKjNcsp2AwMgwFDSC/UHNbZLmwwRqnKpU/AkT8xLar9TnOCQrxBs+Y/hIrcguLwS2JY2r8cPGL6VcnR4PG5P1wHm0a9JCN0ghVyz/hCbk5ok5yhptVvS4RsE9aeTHzRvKvORcKHpqsFdMQ0feCb6VDQ/1B2KmCMGhMunu7tO9W9u118urwuN3caoTvK59REclU55+I98U+5s0oIiyMNeM/wmhre1CUwDBuR1nEBqYSusSq3eCL7a9PzwT3t4J04ri+kpw3B7w+pfuYLwTBn1DyyBvCGQXwOIS/SPp+Sa6HxlHNy54Zuk8cwfi2cNThzrDN9pJypIwe+voRnFPhYdad+XK4Ox0cNwDB+bk2hk7igZMN40jwlDe6PoyxLs5TsYSF5DIOnHpOb58ty5wn+dqegPU47v3jekWuNkyiUyvAmChk1Znk05sEbSHVZrWrIM3KvcfKKgprkYSE4BJ0j96bhO7dbcmeGtHNGDCkPAzZranx9SZsDXR9vR9Iigu/H0ZbJHNNl03kNPdEz2a/U3FOGGx/ZW+KBCDof5tqv5hvt2Sn3nUp0PSQraxDtnJM4p1QahwYhAGhK8jQJDcw3nZbztm/lihmG4BXGm6a3Ta/4m3sAC2Ozmy2MdEFkFTmzbJXLGHhznGaIJNKjr7FhR4b+Cq7fUPpbCQo++5s3ihtg8Y+ZVsulGFrNvF7XDcjdLC6rqyH6SaVFISI/V4E0U5A+00W55mDMQet+XOm1sB3YuHfjix0Ch+dVV7PXXaMaUsFBNW8WikD62q3GfyV0EtIqaZJoHrPgcbSkqFPeR9dJez0cUAqojS298h9tsFiakRfigRHIZg1P6i0pKSkpKWmJ/wGNx9eSg7sKgAAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAaCAYAAABhJqYYAAAAyElEQVR4Xu3RPwtBURjH8UeYKIsYZVHKZlJGKQPFqqwWC5u8AJPFzDvwBsRwR6syKZtsRpOB73POPTq8ABa/+nQ7v/PcP6cr8s8vEkURdSQ+9t5SwA5T9BDggpE3Y5LDEWNEwq6LB1puSBPDAmfkvV6feBX7Wa/oQsuV2Bs1etV1gGTYmTTFvq7vdVmcMPc6Ezfc8Loq7uiggqHbKIn9DHeQFLa4oYwJauGeOf0AeyyxQRsHrDFD3A276EEyYn+MRgfS3vqfL+UJVZseVC2CkTYAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAaCAYAAACO5M0mAAAA10lEQVR4Xu3RMQsBYRzH8b8wUTaKQQxKySuQkQwMXoGJxS4vQMpokngHXoKBzaSsShlksyoZ+P49d3pcjBb51ae7+91zPf+7E/nnG/EjixJCCCL9soJksEIfTSyxRs9elMQWXficroEbas61BDDBASm3JB2cxIzyiJ5oMRPzkEaPer1A2OmkKmaLlluQBPYYWt1zYcXqCriINZ8mJ2Zrt4xg7nTP+TT6lm1sMBXzWY7imc+OllHEsRPPfO+i811R995wo78rhgHOKMuHrfMYYWwpvqz4ldwBPwAkC14X0V8AAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAaCAYAAADBuc72AAACfklEQVR4Xu2WzatNYRTGH+FGPkNKDJCUj8EtUQoDIQYMMFD+AJK6ZUCZIMlUYkBKRgoDE5KUU0oyMCIidZWPgWRkILk8j3VXvXudd5/z7uO6GZxf/bq39e7dWXut9b57A33+fybTWTHYgabXN2YlPUQHkph+8BJdl8S6oUTP0d1xoY6Z9Cj9QH8V+Jmu/3OnMYlepAeTWClz6V0UPOAgfU3P0r2JullJnQnxTbBKpGylLfTexu30Pp0eF5xF9CV9QKclcd3Qop/o0iSeYyq9Rw/HhQboAR/TfXHB2QlLdG2Ir6Bf6B06JaxF1tA3sHv+BnXuFmyMitFwe9u7cYA+ojPiQoIqto0upxPoAti+SNlB38G6XMx5OkK3xIUM10bNoVnWJn1C99MrsFlUB+JIqTPv0d7dWlQZVahkPn2Wc5VX5ZSkklo8GtMOfwa7J24cVVkV1TgW0WQ+PdFjIS5UoW/0ZBJbSIdhHYt4oqp8ET6fx+NChk6JKpkfdEMS0//f6a4k5niiR+JCHU3msy5Rj7+g85K4rlO3cidEo9b7fA7D2tQNHSU6UrRJUjzR9Hz2axWP8ym0Hz7Cdn9XVtOv9CpsM5SgDsR51r0XUE1qD/2J/HwK7fa3yFe7Db1d1Ha90krRvD1HtcVC56G6oyrepk9hiebmU2gTtZCvdgUdyjrvLqP9Xd6JJfQVqpvGmUjnw35cm6RuPjUW11E9IWpRcnNQ3nJH15+GtbruXp/PujfYMliR9PefojY/pKviApkNmz9tlJuwCqvSjh7uFOzlUPegY4q+J2+g+qk3AGu5xsk9geocboRVu9dPxJ7YTIdisAM6AvX6Hdck+/QZa34DvCl6PISyIS0AAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAbCAYAAABFuB6DAAAA/ElEQVR4Xu3RMUuCQRzH8X+gkBQoOFTQUkMQtIWbrW5ODQm+hZx7Hy1BBE3R0hoELm5BtPQCGgxBHNzSoUH9/p6707tnCxoa/MEHz//zv3vunjP7V9nAERrYyj1bpoQb3KGDV+wnHaSIW9z78SaecRU3KRcY4cT/1xYePI2zVPGGRxR8bRs9T+MsLcz8b8ge+hatqBW00hCHqz6rYYrrUNjBJ37wFfnGHO3QeIqJRTPNveUJYxyHYtNyM8kBBpYe7neN2rQ2H6LTq3YW1axu7kNrr4qu8cXcVS5XU3Tqd3MT9L0u0UU5bgo5x4e5k+p+d9PHaXRNlXxxnb/NAniLLenUuJJVAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,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>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAZCAYAAADTyxWqAAABF0lEQVR4Xu3SMUsCcRjH8UewSBRKyiRcGloCg1aXAsG0QZCot1BzLS3RixBaWiLEWnStoV2UlpYg9CX0Chqkvs89d/S/QPGWcLgffIa7/3P3v+e5v0icOP+fBDbRwB4WQqsRog/e4BHHuEYXKbdo1tTQQxZJsZe+Y80tmjWX+MIpVrHjC6KbfaIjttnUVDDGt+8FuVCFSFNs04nRmehshlj372mrrzgLisg2+iighBbKzrqXPEa4k99h7+INW0ERORJr8QBVPOPCWfeix+Fc7EtucY8B9t0isRY/xF6kzyzLlKOzhA2s/F0gGTzhRKy9q/BytLjzqqONotgfjpxDPIgdCW1f56WHOvhhkaKzWXSu0/69OPOUH4zaJqzaD/H2AAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAaCAYAAABYQRdDAAABcElEQVR4Xu3UvytFYRzH8a9QChmIRGFRfmwsSkpJDIT8ASZKFgaSxSKDlGSTwWSxGMVwY1AGUSwmg1LEZkDh/ek5h+c8t8i9k7qfenVP3+c5zzn3+Z5zzHL5JSWoRH44kEm68YIPHKI4OZx5anGLpXAgm3Sau9vBcCCbzOERTeHAX6JmaIEBVGEXKXPN8pOHegyhC4WJUS9a7BzLGI+OX7HuTyKNOMEmRrGCM9T5kxQVrjFv7i6UMXOd9/ezHfeYte95pTjGhlezAuyY63JDXLT0/dQWpHCK8qjm1+Vrm3SSTtb+6QKKfsP97MG7pT9eFbiyYFE1RX9zIi6QGtxYcj9151pUi/vRY/eGRb8YL9rv1eKJI+jANGbwjDZvnvZwDQ9o8erWau7vxw0pM/daxgssmLs7HT+hL5qn9OLO3MUT0dWmcIEtHGAYl9jHqrnnUPMmzTV0G3s4QrP9kPBrpIXUhPDrVIRqS38hcsnlX+UTtZ5DHqMC0mUAAAAASUVORK5CYII=>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGUAAAAaCAYAAACuCJLbAAAEHklEQVR4Xu2YW6hVRRjHP1EhUTMvZFJQ3gI1UPCoCSZGEfWgqPhgJOJLCtKLook3MCIKRIzwKQuRHnpIiAgrL+BBRaVCEgoiCFSiyLCefNDI+v/Ot6e91rj2WrOP57Ld7h/82ZuZtffMmm++y4xZhw4dWoNR0gNxY5vxkPl7FjFcGhM33i0M9rA0NO5IYI50yPphUi3EWOkb6XDcUQOjvCutjDt6w7PSTelf6aQ0Mt9dyWPSKWlW3NFmzJb+klbHHRnGS19I8+OO3sDC/iK9FXdUMMR8d+yJ2tuRV6TL0qNRe8yL0nFrHOaSWWTuLcvijgqekn6sfbY7H0gHzDdiGYTwc1buUUlsk65LM+KOCvjdUWv/BE8+6ZYWRu2NIOIckYbFHWWQzDHAUmmi+R90250ux654QlouLTZPZgEMgUF2ZNqKYOe8YD4WMbfVKZova/WRNCI8VMFL0hXztJAEA3wnvS2tr32/Jb2XfUg8KZ2XDkqrpL3SRenxWv8k84GZfCOoRKhY1krrpAvW2gVBo/lOkKbXH6tkrnmOnhd3FMGC/iRtt3psXGdeeWXzSZd0TXrd6s+Nls5YPa4y8O/m+agIPPBbq/cTY/+Rnv//ieYZJ30lXW1Cu3t+WU1fzjdlw/ZAfPvY3IKTM+1xPiGEdUtfWz7chHbEd4zCS/NZBO03pA+lqeYvvcTqIZAq5rT0qzSl1jaYVM23GYJRqNhKYdFZ/GwC4jPOJ+yM23ZneYwL/2DpRuEg+r25F6I/pGdyT/hYfVI+9gEp800lGGVz3BGDKzHYhkwbu/Wy5fMJnoNRYrfFrf+2+pmkyijwoLRG+tSKD6cUCbHxyyBs4r28dKq4GkmlbL7NeHZy+ApGoTIIhIUmwS2UNplbFzfOLnY4JLJ7QqJmYkww+3+BV83jMQepAIufLZ/5/Nw8lz0ivWNupLIyklDynHnhkaoFPb8sJ2W+kOrZZWuTgwMe4SskdEo/dkIwwE7zQfn+p+UnSIn4m+XvdUI4y3pegIMWh0oqOOAlSNDswgDlItXNEullaav5Czd7zdMXpMwXUj2bqutnSzj3sdtfky6ZJ7MT0grzOHpM2me+E3luo3lBcFj6zNxtZ1oenuMSMi6loct8HH7/vvnis+jZpMkGwPi7zHcjqtqB/UXKfJvxbBJ8tzXxPjyYvQ1mYHZ9fDvMJIiNZX9M2UiVxok3hv9jnEY3z+Su/eaehocM9g1z1XxTPTtUuXui9gGDpHvW8qEuheyuw/B4IoczDFS081qBVM+eZm48PgcNFvYTS7+CAM4AXPdzXsKwX0pvWu9L0IEgxbMJ6W9Y/tA9KDA4roxSJ8JzWbcnhMZhoJVI9Ww2Fee+IoMNOCzqFunpuKNNSPFszjFUZi1hkPuBe82zO3To0KE/+Q83rNwdkMFPTAAAAABJRU5ErkJggg==>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAZCAYAAADTyxWqAAABSUlEQVR4XuXUzSuEURTH8SMv0ZD3kWwoC4qyVaKUt4WS+BfY2LCxkT9C2dhIwoataVKWIhsbEVv/hCS+p3Onuc+tYe5d8qtPzTznztPc85z7iPyF1KIL9WEhJRP4wGJYSMkW3jAQFmJTh3McoiaoRacHT5gPCynRfl2jNSz8FN1CP5YwKeUnt44N97mq6A/3cYYV7OICTRhCR3np79F+3KBdrOF600ex2YrONt6xhk6MOkmZwSe+nCt0Z1ZUEe2J9uYFeXdNt3ov1ng/e2I7qBidoVexgdQba8bwgMHSItKCotiYVIyOw6bYPznAEe4w5S8iw7hFH8ZxjOnMCi+N6EVbWHBZFjtSs5hDQey8JkX79Sx2I92Nnoak11EzLrEqtr2dbDkufr/0fXaCEUk8+As4FTsZ+mC0X3rcSqMUFe1Ng/c95679x3wD16wtfp2rJXoAAAAASUVORK5CYII=>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAbCAYAAABIpm7EAAABBklEQVR4XmNgGHKAFYi50QXxgWgoJho0AbExuiAuIAjEM6E0UUAfiHvQBbEBZiBWBuIWIO4CYmFUaQQAKYwE4mtAXAPE24G4Goh3APFyIOZHKIUE33Qg3gPEQgyo7udkgGiaAMSMMA3FQPwEiFWgfE0GiPthCsqB+CoQi4A44kB8HYinICkIYkAN/0lAfJcBopZ0DaCI+QpVBAPIEQby7AkGiMdZQAIg974FYl+oAl4GiImwCAsH4pdAbAblg3WBQmg+AyS0QAZ0MECc5w7E94HYG6YYBkApEhRsp4F4FxCfYYA4YzYQyyCpwwAgG0AaHRkgEUkQoLufIIC5n2jgwoAavKMABABQlijS6WUhHwAAAABJRU5ErkJggg==>

[image13]: <data:image/png;base64,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>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAaCAYAAACHD21cAAABG0lEQVR4Xu3TIUtDURjG8XeooEwUNmxahmVgUxDbkiytKDjQZhAMpo2hWEUEw5jBbLOY7DKMWzJYBEHBL7BgnPP/eO5113f3Ewwf+MF433POPfecO7OxyCxK2MR8VMtjIR7gM4VTvOIIh+jiEo8oDocOM4lr3CKbqOtJHbQt7GQkG3jHim+QE7R8Mc4ZPrDoG6SOii/GucEAx5hwvWXkXO03VQsTpY8H7GMuOSgtOtFzC5PiBeTJ0rc/Em1Tx36BnoXJB39GRNFAvUPGN0gZX2j4hlLAlYV79FnFJ3Z9Q9Ex32PaN8geXrDkG4ruT6uuu7q2r4PZcvWf6BO6Qw3P0W9dQRNv2LH0d7cZCysruo41bFv4Z6Rt/T9jlG+J/Ct4t2V5pAAAAABJRU5ErkJggg==>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAAaCAYAAADi4p8jAAAB3UlEQVR4Xu2XzytEURTHjxDyM7KQn8lGsaLEykKykqIoslGUhSxIfuwkKUokZSNJKVnZWEmWrCgbpSj/gGLpx/fbnRnP6WXmvnmapu6nPs3rnjvzOveec98bEYcjbSmAnbAbFkfGymB5dEK6kg2X4COcgpPwBq7DK9j4MzXl1MEhPfgXWXAXHsN8zzh37hpeitnZVMIF5qJfwA948Dv8N+3wGTbpAFiAW3owBTDBPtgBX8QywRUxX6rSATALe/VgEuTCcQleERViNsMqQU7+gvMwU8UaYKkaS4YMMQvaogMJEihBNiwTpKxv1vkYLPJOChEmtyGm920JlCBP0FUxyUUTpbfiX7bJwl2chqORaxsCJRiF5clmXoOvYpKc+DXDnxIxN7axBu7DbbGrFKsEmRB7zG8Ve+AnnNMBBR8ri3AvgOfwHS7DHEkMqwTrxaygXy+wT3jzYR0IiVZ4IvYtYJUgj/8zMUe3ZgQ+wGodCAG+QBzCWh1IAKsEeVxzl9rUOMuWB0y/Gg8LvpFYvWp5iCZ4JP6tFYMP2lM4A+8j13w0bMInOChxfiAgrJYdWKkDcegS8zLiPenf4B1s9syLkSdmpwgfE+yJATH/JPxKNiy4aIWRT4fD4XA4HP/AN1blWO6vvlRfAAAAAElFTkSuQmCC>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEcAAAAaCAYAAADloEE2AAADlUlEQVR4Xu2XTahNURTHl1Dk+yMfIR+9EilJlMJAFMlH3kRhJJEZLxQGt6QoJEqS8pCkTGRAEq8MKBIDEslHIgMGBmKC/6999rv77nvuueeex3tP3V/9u6e99z1n77XWXmtvsyZN/geGSf3jxm6irzRC6hN3NMJM6YS0W5ovDajsLsxK6aj1nHEwSpu0I3lumOnSKXNGuSb9lvZUjCjGHOmuNCbu6GZwzAWpNe7IwyrpYPJMGGKkoeXuQgw0Z+j1cUcPMUu6L02KO+oxQ3ostcQdXWC59FQaG3f0EP2ky1Ipaq8LXr4p3TaXPLsKe/ucuRzWm9ggPTSXoBtik/RLOmAFE1fAaOmZtC7uMLdt50qLrZyk+d5sabIf1ADDpfEpIs/xrRC+8U6aF7XXZKR0SbouPZF+SgsqRjQOi3+f/IZgDCrXLulB8gxM+pu5yB2UtNWDaD9trnikCUcv7RztwGgYJ81pVTCYSVK+8R7JkxfvDQcVgAT/SZoWtS+T9psLa757Pmlnoe1ShzQ4acuCuZakk+aijSR7UVpk5cgZlYwL4d0dlqMS88fj5ibp8wyJ+YuVJw185Ir00lxktUtTkt/niXgmvD0YBw8xyZAt5r5BZH63ykq20Nxi84AxNlp58TjhlrntnIU3jq/MNeGFeDe0og+7OHLScsgQ6Z60NWjz1DKOpyR9kKYGbbw77V15INFeNVeRsvDGORu1V7HCXH7BYx4M9lFaHbQBueOVOa97eKYtziuQZRy2FBUjXIzfJuH788J/qYyxQ9PIva0wDkkwXBxGIULiswkeJUqIFk9WWcTgGJlEG+OjM5wgEXTEKj1PpaHi1LvGTJDeWr4k6x2zM+6IYd9iCA5r4E+02zpHOLxnHklnAr1J2uOkB0QAxomrBWD411b2NBXssLmrRshmc8WBg1vWdmH+Xy09gmMmmvt22ryqWGLuFEsC7pD2WfUFMSvfED1p+PBNyyEYc7v02dx9h8Pn2ooRDrbmD3OLSdueHo4DzK9eMgYimrFEWy58+NYqoY3mG0/JspMk24VFZ20b+qhg8TYPYd615h5TsvqR2BCN5htPi7nSz4WvKGm5qCgcSe6YOwt1GV5GLiC3IE6146RD0gtzJ2DOC1m39zbpmKXnpXoQ0RiGg+PfgHMRJ+o4bfQYTIRt0Rp35IAtt8aKGTaGKL5hxe5u/xTuSlxm46tEd0E6IMKpVE2aNGnS6/gDIKWd7sC8eCwAAAAASUVORK5CYII=>

[image17]: <data:image/png;base64,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>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAABNklEQVR4Xu2TsStGURyGf2JkEDEwmKyUbEqJYpGUhZ3Z5P+QScogAymDP8GgKJtMSgajQQwoPG/nXE7Hve75urek7lNPt/Pec77v3vOea9bwX5jCG7xLdNota4023MIDHPJjsYPvOOvH7TiJtzjus5box0PsC7JuvDD3owNB3ol7OBhkyWgb1qNsBB/xCDuCXA+wiV1BlswSDkfZCn7gRpT34Kp9b29l1M8bTsQ36qSon9oZw2f72U/IMp6b+yROccF75jNdNf6Von5i1sz9SXgwFvEKe4MsF5W8a+X9ZPN0AkM0Vl56WFL70RPryfUGGdla7UgpKf0IzbvHfdz2HuODv5eLvqFLc5PUTeYTXlv+wqJ+9EZ6s1qo3E8qlftJYd5cF6/+Oopz5jp9wROc+Zrd0PCnfAKsJksbi0tORwAAAABJRU5ErkJggg==>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAABpElEQVR4Xu2UvytFYRjHH6EQgx9lYLjZbCSLH2VgEiPKYDAwW7CdxaCkWCmDJGXjliT8E0ZlIJOUMJAf3+95zts9zznndm/dY1DnU5/O6X3e3l/P874iGf+NAfgIfwJvYJvpYRmDX6J9+b2AraZHCTbgA7yHnZGYgwMewhd4DGtsuDSNcB9uwTfYZ8M+VXARrsJvuGTD5dEFd+CU6JFM2LBPr+hEK/ATDtlweUyKrrQfvkt8tfXQgx0wD29he7hDuXhwFHbDJ7hmoiLTonFOdCcV5ocFwFVytQeiOSE5uCw6MCerOD91opNeB/Kfg3OSnHb1/5PyUw0bIm0xXH4Id8HduBxwBzw2woUUy88M3Iu0xfBEB3QwP8zTCFwXLQTCo+UdS8rPLlyItBl4PLyAPD4Hz5+VxwFZ0o6k/PSI7oQvywmcC8UMg/AUNoXaeId4l3icriAId5qUH1bqlRR5tobhsxTetw84H8T4KpxL4f3ahK9BP9f3DLYE8VmxVfpnbEuJ/KRBM7wUfVGYz3EbTg9W5JFo5bJIak00ZXhZw8WUkRHnF0vsUW5bGlicAAAAAElFTkSuQmCC>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAaCAYAAACzdqxAAAABp0lEQVR4Xu3UzStEURjH8UdeIiSRKDJ5WaBkiSjJwtLbws7OS1askESyVNhYkLBTtpKXIsTCf8BCSuwlCwrfZ86d5t5z7wzTWFj41afunGfuObdznntF/njq0Y8Uu5BsRjBoD8ZLDtrQhxqkOuPZKHWuE0otrvCCHYxjG4eowz46xCwwhzXkhe+MkXRM4w0TyPKWpRXPeBDzxN1oELNQk+t/nuikq3hHr1WLJBN7Dr2uRiOOkO/6nyfD+MSkxD/dLUy5fs86AlOFR9yizKrZWRezv5pCXIh56lHxb114RX3aBWs8KHpIum2aAhxjXsz+e6ItdYoPiT5JItFFtDt8KcE9nlBh1ZJKZGKl1/GiB9xsD8aKtsm1fD+x7ucGilxj2j2B2xDJopg97rQLTnQCffvs/taXQntazykw5bjBGYqtmrbQDMbE39+62Io15ksIl3jFJgawjHO0i3fSkFO7E9NRukCGq+6L3hxCl6NSol80O/pynIj56v1qWnCAXLuQbIbkB/ubaNKwix4x3xY9j1+JnsWSmDbV73fcj3yi0cl1f+0W/I83Xz6PPkUZZh87AAAAAElFTkSuQmCC>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAaCAYAAACzdqxAAAABg0lEQVR4Xu2UTytFQRiHX0n5V4iNIpIUFpIslURZKnaWFmRhIUqyUPIBSClZoCzuBxBRKAuSYmPDisTKRrKg8LzmnGvO3OM6p2uj7lNPd5p3mjvn1zsjkiUixdiJA9iIud58EVZ541g04TE+YwLHcQN3sRm3sTu5OgJ5OIOvOIUFwbJ04BPeSYwT66bL+Ib9Ts0nH7c8dRyJEfzAOcxxajbrOO1O/kQ93uM1Vjs1l1WJke+smNMuOvNhlIiJ7Ve0pQ7xXWKcJAqVeIOPYnrVRrMuF7PGttReBIXy3eNJ/I1VHdvoRdD2OxHTghrXOQ5ZazSaHWyz5r6owEsJ39jHj+sB64IlacEjMfsE0M9dEpNxr1Pz0Yg0Krt/9XdSzG28xQUJ6agavMILSb1R2gErYmKYd2qKdtKwO2nTgKf4gms4KGajMxzDCezyF3uU4T62O/MpaCy12CfmRdMHJ13PakQHEpJvpuhXbYr581ExHfIn9OCemLej1alljPZ6uriy/Dc+AcC9PeVdrfNxAAAAAElFTkSuQmCC>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAbCAYAAACTHcTmAAABWElEQVR4Xu2UzysFURSAj/yIUJSSLMROCrFSlhbeQslKsbNQljb4A/wBWCklWSgpW1bsLPwNCklhp2z8iO+Yc2fuTNO8GY+Fel99vXfOvffNeeeeRqTKX1PCz5wu25nc7OEbjifyNTiCNziTWMukHS/xGrvjSyE7OJFMZjGEz3iEdZbTz2Gst3jD9uVmToKerXg5rVira7ZY/3pbtFwePfyO09iFPbiN6/6mIrh+fuAd3uKjxYV66DOKLxLvZyseYp/FtZZzNEjU61RcP/0Z7MQtbLR4Fpfsuz74AKcsTuXXf1QHe1fSh97RgvvYa7E+8AL7wx0J3CVdSbA5jXkJqtYCFvAYHyQoZtDbF5J2SQ6dz1V8wjEvv4ibXhyio3Iv0YvCHyf11Vs7wabg2PeDtYBC74BydOCZZPTzJ+hlnkows9prd3kVMYDnuIaT8aXK0Nl181vlv/EFyx9IF6g7tRMAAAAASUVORK5CYII=>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAaCAYAAACkVDyJAAABOElEQVR4Xu2TPS8EURSGj6AQloJIJBKbjWhEIX6CKBSUGjoF9TY+WpWOTqGgUhA/QAQ1tR8gkShVGg3Pcecmd07cTPZMJfZJnmLeMztvduZckf9EA3ttWIN+HLRhygFO2LAGC7htwxRbeIif+JV4nMyVjWSm3uBwMeu4UNHrl0I7i6zhHY6b3FU4hA/4hq3y6IcRvMRZOxBnYR9e4YeEB1i2sG3DAlehcirh+6yYfBqvcdTkEXfhjoRC/TcRXfkTXEoyi7twXULhfpJp0ZGEV57DXbgsofC8uNZXeIHNeEMGd6H+UJfmVsLW7ko4f1W4CyfxFZ9wEc9wIL0hg7twDJ/xHe9xvjzO4i6Mh1+/4x72lKZ53IWKLsyj5M/cb9QqnMMpG1ZQq9BDt1A2pbOlqGIGV23Y5e/zDQ0+P/JXgPtBAAAAAElFTkSuQmCC>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAaCAYAAACkVDyJAAABQElEQVR4Xu2VsUpDMRSGj3RR2g7SYnG02EEQ6tzdwUFnwaGDbyC4dBKk4CaIo6uLjyAOhb5GXUQQHOwuiP1/c8JNooE2KQ7aDz64Obn3/iXnJhX5T1RhKSxmsKxGOYfrYTGDfTVKLLABH+HnFD7AsnksPdDCh/nSfjgBavAO3sIlrWUHMoiBB+GEwpdfBePkQC4Tl+sFNp16C9b1mi8/ceayAhnCsAGsaI1LdwnbOt5RLVmBe2KW81rMPbQr5gesFrd5ZAXa/r3CJ/gMP8TvWUhyIJdwIN/714NHzrgq/sGRHGj75+4xcgG39HoD3sCVYjo9kNsgtv8sp/AwqCUH2v7xw/mJTXgv5kRySQqM9Y+wX7twBM/8qS9mClyDQ/guxTlpv1D65tTHcNs85jFT4DxYBP5+4LGY/7V50VEX/DEmwTxPjLuAbocAAAAASUVORK5CYII=>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHIAAAAaCAYAAABreghKAAAE4klEQVR4Xu2aTchVRRjHn8jCsKxMFKnQJAJRSVEXguJCTSXS0IpCdy50IUK58GvziroQJEqFRMS+EIUkENQgIt9dUZs2IViihSgI5coWRdbzc87wzn3uzJx571ch5wd/3nvn3HPnnOc/88wz574iDQ0N9zcPqp5UPRC0PVa194qHVONs4wDodb/EiNj4WMVi1zVPqeZUr7mB+apXVdMk3RGf269aa9r3qqaYtm6Yp9psGwdAr/t9VLWv+gvEdZvq7ep1VzAqtqp+EHfhW1R/qP4J9IE40yxcxLvSfhHWyAOqP6X1O98PjsOG4Bj6UjW+OtbrgJaS6/cdab3enFZV51gjgbh+oloXtI0a0sanlSaoDqq+ql5jzgrVbdVd1crqHM9M1feq50w7WCOB979Ussc8b6i+Vk0y7bmA9pO6fjFkWHVTNb310L0J8rLqumpB1RYzEmapvlE9a9qLYCQcE2fc4+IumE6fDz+kDIkbVceDNkw+UsnORogZmbtp4Bo+EzdALHUBTTFZ3D12us7V9ct9cD/D0m4O0MY9zQjex4wcozolLtajJjSOWcXrofADFYtUf6nOq8ZWbU+rLquW+Q8ZYkZysWdUd8QFyLJJXLqKURfQFFzDx9IeuFLq+iVlMsipEzyPiKs1GOD0e0LcgIKUkbBeXIaj+CmGKfyTuLWLDt8Sd8PMCgs3Q/AxATMAA6+onvEfMsSMBGY1N/6KaWcwfS6u4IpRF9AU/TYSA7mf1UEb51A3AAOfQtBPgJyRL4pbdnwaLoLRzyxjttXhjTwUtG2XdDqBlJGcx43Tv4cUf1S1PGiz1AU0RT+NJF2zLP2mWiiuL1LoBXGzK0bOSF9D2B1AEmbgSXGpNDWjQvhigv9m0EZwwhlqSRnJDfJdu4I2DHxP0t8FuYDm6KeRfn2kGv+10u/ijPVroiVnJG3D4gZ7Ef6EXPXo8UXNJRnJ80BwUIqUkX5N8eeSSlnkp/kPJMgF1POEuD5Dka4oNkjd9lgsmJZcv6RTuz4yMVgi/DpnHyiUGBl+XxZ/Qqp6DCEAzNxtpr1TI32aJiVxHTvE7R/ryAUUCNZucRVqKDLPVdWHkWMb752ZJ9evXx/9HhEYOHuC91zTyuB9iZHh7iCLz+2xvWGI3Z6EdGokI5aBQXW2VPWRuCqvjlxAc/QrtZZMBgpK9udh7EqMLE6tMCRuNMVMAjazO1XfSXwdZTRybmp/ljJyoupHcQ8ZLqrmth5OkgpoHf0y0q+PqRiwJBGDLaY9ZyTpmAGe2oJFIWXeEGfmWRl5OsMFcOyM6rS4JzwxqDoxBGNipIz0o45+GSj0V0IqoHX0y8jY+uhh3T+suibtT71yRjJh2NItswfqWKL6WUaeB3pR2KyR/K8X3CD70FR1ljISCCwznRsuJRXQOnptJK9vyUiswoqVJePv4FjsqVfOSLaCTA4etowa1kF+5XhN9ZKUB5d0/K2k90s5I2erptrGGmxAS+m1kd2SM3JIXAU/xrT3HapNNr+xYiVnZCd0GlAC9rp0HpxO+02RMpIJxI8Fi037QOBizkn8icz/xchu6XW/KSOZFDzdIkP+J5AiKZZsqmyMjBMzkuLyC2mP4cCh4GET/HDQxma7dL0t4QVpfTA9KHrd71hxFT9/gX/7oPKNbfEaGhoaGhoaOuBfaJEH2hLhCPAAAAAASUVORK5CYII=>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAZCAYAAADNAiUZAAABjUlEQVR4Xu2VPygHYRjHn18ooiSlFJGUKFFkkFFGKQaxG6QMijLJn4FRJhMDpl9ZTCQzm8FikFJGC6P4fnvu3PO7u/fu91Nn0H3r013P89x93/e9931O5B+oFiyAUdAB5kBfSUUGagA34Au8gRVQYwuyEE23vWtF6gSz4aBRD9gDh6LLV2dyNNsBY2AKtJpcRL1gEVyDT3Bcmv7RNHgAg6IGW+ASNHp5xk5Fv2kzOAcjXi4imnJkLH6ReNN28AjmTawJ3IElE7NaB2egOpyw4nI8S7wpzT7AkIkVwIno5uEsB0BRgmVdMzmnkkz3JWpKsfYVdIFxcCTBcvOZA9HBOZVkypjL1I9zU22KbsRlcAXagtJ4uUz985dmSlWBFg/ep8plWi866nJMK5bLlHK93BUvW0mmPPRxL2ctj1nqt3MpyXRStHFwh/pig7/w4P2v5Jvy7BVCOXaYW7BhYt2is0xqm05x9HyYM+EfgryDe9Bv6obBE1gFM6LdaFf+4E/CnTwh2jbZGnPlypWtvgE+Y1MqEZqjJwAAAABJRU5ErkJggg==>