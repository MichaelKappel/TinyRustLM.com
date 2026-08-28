# **Exact Symbolic Optimization and Equality Saturation for Machine Intelligence**

## **The Paradigm of Equality Saturation and the Phase-Ordering Problem**

In the fields of compiler optimization, automated theorem proving, and machine intelligence, the phase-ordering problem represents a fundamental theoretical and practical barrier to optimal code generation1. Traditional optimizing compilers and symbolic algebra systems depend heavily on greedy term-rewriting frameworks. In these architectures, a predetermined sequence of heuristic-driven transformations is sequentially applied to an intermediate representation (IR) or abstract syntax tree (AST)2. Because these rewritings are fundamentally destructive—discarding the original term entirely in favor of the newly transformed expression—the final performance of the synthesized code becomes intensely sensitive to the specific order in which rewrites are applied1. A transformation that locally minimizes computational cost might inadvertently obscure or destroy structural patterns required for a subsequent, more globally impactful optimization3.  
Equality saturation fundamentally resolves this phase-ordering bottleneck by abandoning destructive rewrites in favor of a monotonically additive exploration space2. Instead of prematurely committing to a single optimization trajectory, equality saturation simultaneously explores and preserves all possible equivalent expressions defined by a theoretical set of rewrite rules2. The exploration continues until the underlying data structure reaches saturation—the mathematically defined point at which the application of any valid rewrite rule yields no novel topological information—or until a predefined resource threshold (such as a timeout or memory limit) is triggered1.  
To prevent the combinatorial explosion inherent to retaining an exponential number of equivalent terms, equality saturation relies on the E-Graph (equivalence graph), an immensely compressed, graph-based data structure capable of representing exponential search spaces in polynomial memory2. Originally developed in the late 1970s for automated theorem provers and Satisfiability Modulo Theories (SMT) solvers to perform congruence closure, E-Graphs have recently been repurposed as the foundational architecture for exact symbolic optimization across deep learning computation graphs, symbolic regression, floating-point accuracy tuning, and hardware design5. Through equality saturation, optimization is elegantly bifurcated into two distinct phases: an additive exploration phase that builds the saturated E-Graph, and a subsequent extraction phase that navigates this compressed space to retrieve the optimal concrete implementation governed by a precise mathematical cost model1.

## **The Mathematical Foundation of E-Graphs**

An E-Graph efficiently represents a congruence relation over a vast domain of expressions. Structurally, it is a directed graph constructed from two primary interwoven primitives: E-Nodes and E-Classes.  
An E-Node represents a single functional operation, operator, or atomic value defined within the grammar of the target language2. However, distinct from a standard AST node, the children of an E-Node are not other E-Nodes, but rather E-Classes2. An E-Class is defined as a mathematical set of E-Nodes that have been formally proven to be semantically equivalent under the provided rewrite rules2. Because E-Nodes point to E-Classes, the E-Graph forms a directed, often cyclical graph that naturally deduplicates overlapping subexpressions through maximal structural sharing2.  
The integrity of an E-Graph relies entirely on the strict maintenance of two critical structural invariants:

> 1. **Uniqueness of E-Nodes (Hash-Consing):** There must not exist two distinct E-Nodes with identical operators and identical child E-Classes within the entire E-Graph10. This property is maintained via a hash-consing dictionary (often referred to as an interning structure), which intercepts additions to the E-Graph and ensures that structurally identical nodes are perfectly deduplicated, returning the identifier of the pre-existing node10.  
> 2. **Congruence Closure:** The equivalence relation maintained by the E-Classes must be rigorously closed under congruence. Mathematically, the congruence property states that if ![][image1] and ![][image2] are equivalent terms, then for any function ![][image3], ![][image4] must be equivalent to ![][image5]10. If the E-Graph learns that ![][image6] (typically through a rewrite rule establishing a union between their respective E-Classes), it must propagate this equivalence upwards, unioning the E-Classes containing ![][image4] and ![][image5]10.

### **Handling Bound Variables: The Slotted E-Graph Innovation**

While classical E-Graphs elegantly handle uninterpreted functions and static operators, representing languages with bound variables—such as the lambda calculus—has historically presented a severe challenge9. Traditional E-Graphs rely on syntactic equality; thus, terms that are alpha-equivalent (differing only in the naming of bound variables, e.g., ![][image7] vs ![][image8]) are stored redundantly, defeating the compression benefits of the graph9. Earlier implementations attempted to use de Bruijn indices or explicitly encode variable names as plain strings, which the original developers of the egg framework acknowledged as a "perennially tough problem" that bloated the search space9.  
To solve this, modern research introduced the "slotted E-Graph"9. In a slotted E-Graph, E-Classes are parameterized by slots that abstract over all free variables of the equivalent terms represented by its constituent E-Nodes9. Referring to an E-Class from a parent E-Node requires explicitly relating the variables from the E-Node's context to the slots of the child E-Class9. This guarantees that terms differing solely by bound variable names are represented within the identical unique E-Class, radically shrinking the required memory footprint for symbolic regression and theorem proving over higher-order logics9.

## **Congruence Closure and the Amortized egg Architecture**

Historically, maintaining the congruence invariant in theorem provers required restoring closure immediately after every single union operation. In environments like DPLL(T) solvers, where non-chronological backtracking is heavily utilized to undo modifications, eager invariant maintenance via classical algorithms (like Nelson-Oppen or Downey-Sethi-Tarjan) is unavoidable6. However, this eager propagation traverses the graph extensively, imposing severe computational bottlenecks on equality saturation pipelines that must perform millions of unions in a matter of seconds6.  
The development of the egg (E-Graphs Good) library revolutionized applied equality saturation by introducing an amortized invariant restoration technique known as *delayed rebuilding*6. Because equality saturation does not require backtracking (rewrites are monotonically additive and non-destructive), egg fractures the process into distinct search and apply phases6. During the apply phase, unions are performed rapidly by merely updating a Union-Find data structure, but the congruence invariant is deliberately allowed to break10. The E-Classes affected by these unions are merely recorded in a discrete worklist.  
At the boundary of each iteration, the rebuild procedure is invoked to restore invariants globally. The procedure operates in two primary steps:

> 1. **Canonicalization and Hash-Cons Repair:** For every modified E-Class recorded in the worklist, rebuild updates the child pointers of its parent E-Nodes to reflect the newly merged canonical E-Class IDs6. If two previously distinct parent E-Nodes become structurally identical due to their children merging, the hash-cons table detects the collision.  
> 2. **Parent Merging (Congruence Propagation):** When a hash-cons collision is detected, it signifies that congruence has been empirically established. The rebuild algorithm immediately unions the E-Classes containing the colliding parent E-Nodes, recursively appending the new merger to the worklist to ensure cascading congruences are fully resolved6.

By deferring invariant maintenance to phase boundaries, egg achieves asymptotic speedups over classical upward-merging techniques, transforming E-Graphs into viable data structures for industrial-scale compiler optimization6.

## **Exact Symbolic Optimization: The Extraction Problem**

While the construction of the E-Graph successfully circumvents the phase-ordering problem, it displaces the computational complexity into the final phase of equality saturation: extraction2. Once the E-Graph is saturated, an extraction algorithm must traverse the highly compressed graph to retrieve the single optimal concrete expression, guided by a specific, domain-aware cost model1. Because E-Graphs compress exponentially large search spaces, naive extraction is fundamentally intractable, and exact DAG extraction is proven to be NP-hard18.

### **Greedy Extraction vs. Integer Linear Programming (ILP)**

For objective functions that adhere to local compositional costs (e.g., AST depth, total operator count), a greedy, bottom-up dynamic programming approach is highly efficient19. However, modern machine learning compilation heavily prioritizes the optimization of Directed Acyclic Graphs (DAGs) rather than purely tree-like structures. In tensor computation graphs, the reuse of common subexpressions (where a single intermediate tensor is routed to multiple subsequent operations) is vital for performance1. Greedy tree-cost extractors fundamentally fail to account for node sharing across different branches, causing them to systematically duplicate expensive matrix operations in the final output18.  
To solve the DAG extraction problem, exact symbolic optimization leverages Integer Linear Programming (ILP). The ILP objective is to minimize the total sum of costs of the selected E-Nodes, ensuring that shared E-Nodes are only paid for once by the objective function2.

| Extraction Strategy | Complexity | Optimality | Subexpression Reuse | Cycle Handling |
| :---- | :---- | :---- | :---- | :---- |
| **Greedy (Bottom-Up)** | **![][image9]** | Tree-Optimal | Ignored (Duplicates nodes) | Inherently avoids cycles |
| **ILP-Topo (Glenside)** | NP-Hard | DAG-Optimal | Perfectly captured | Topological constraints (Slow) |
| **ILP-Acyc (Tensat/MaxSAT)** | NP-Hard | DAG-Optimal | Perfectly captured | Explicit cycle breaking (Fast) |

### **The ILP Formulation and Acyclic Constraints**

The classical formulation, observed in tensor frameworks like Glenside and Tensat, defines a binary decision variable ![][image10] for every E-Node ![][image11], and ![][image12] for every E-Class ![][image13]22. The optimization is modeled as:  
![][image14]  
Subject to the foundational structural constraints:

> 1. **Class Constraints:** ![][image15]. If an E-Class is active in the final program, at least one constituent E-Node must be active.  
> 2. **Children Constraints:** ![][image16]. If an E-Node is active, all of its required child E-Classes must necessarily be active.  
> 3. **Root Constraint:** ![][image17]. The ultimate root class of the program must be extracted.

A severe complication in exact ILP extraction is the presence of cyclic relationships in the E-Graph, which naturally arise from bi-directional rewrite rules (e.g., ![][image18] or ![][image19]). If the ILP solver selects a cyclic path to minimize local node costs, it creates an infinitely recursive term that is fundamentally invalid in standard compilers21.  
Early ILP extractors prevented cycles by offloading topological sorting to the ILP solver, assigning a topological rank variable ![][image20] to every class and strictly enforcing ![][image21] for all active nodes22. This topological encoding scales incredibly poorly, yielding an exponentially large search space and causing commercial solver timeouts on complex deep learning models like ResNet-5022.  
Recent algorithmic advancements address this by statically identifying cycles prior to extraction and injecting explicit *Acyclic constraints* into the model22. By utilizing path-finding algorithms to detect fundamental cycle bases within the E-Graph, the extractor mathematically restricts the solver from activating a complete loop. For any statically detected cycle ![][image22], the ILP model is injected with the constraint:  
![][image23]  
To prevent the number of constraints from expanding exponentially, practitioners apply a Tseitin transformation, introducing auxiliary Boolean variables to encode the cycle logic compactly22. This explicit cycle-breaking formulation, often combined with Weighted Partial MAXSAT solvers, eliminates the need for topological variables entirely, yielding order-of-magnitude speedups in extraction time while mathematically guaranteeing globally optimal tensor program extraction21.

## **Machine Intelligence Compilers: Tensor Graph Superoptimization**

Deep learning execution frameworks (like PyTorch, XLA, and TVM) traditionally optimize computation graphs using manually engineered, heuristic-based rewrite rules23. Because the sheer volume of novel hardware accelerators and diverse neural topologies outpaces human engineering capacity, these rules are often brittle and incomplete16.  
The TASO (Tensor Algebra SuperOptimizer) framework pioneered automated rule discovery by enumerating candidate subgraphs and verifying their mathematical equivalence via formal properties and randomized fuzz testing24. However, TASO still relied on sequential, cost-based backtracking search to apply these rules to the neural network graph, leaving it vulnerable to the phase-ordering problem2.  
The Tensat system bridged this gap by porting TASO's verified tensor rules into an equality saturation engine powered by egg2. By applying all possible tensor substitutions simultaneously within an E-Graph, Tensat successfully navigates the exponential search space of equivalent neural network topologies. Coupled with ILP-based extraction, Tensat yields models with significantly higher inference throughput compared to sequential optimizers, discovering novel operation fusions that human engineers routinely overlook2.  
Further extending this paradigm, the Prism superoptimizer introduces sGraph (symbolic graphs), replacing concrete instantiations with hierarchical symbolic parameters. This permits Prism to prune provably suboptimal regions of the search space using symbolic reasoning over operator semantics and hardware constraints before saturating the graph, bridging exhaustive E-Graph search with the scalability required for modern Large Language Model (LLM) workloads24.

## **Guiding Saturation: Reinforcement Learning and MCTS-GEB**

While E-Graphs compress terms exponentially, highly complex rule sets—specifically rules governing associativity, distributivity, and commutativity over massive tensor graphs—can still induce memory exhaustion long before true saturation is reached1. When saturation fails, phase-ordering issues immediately resurface, as the quality of the final ILP extraction depends entirely on which specific rules the engine arbitrarily chose to apply before the memory threshold was hit1.  
To solve this, the MCTS-GEB (Monte Carlo Tree Search is a Good E-graph Builder) framework reformulates E-Graph construction as a Markov Decision Process (MDP) to be solved via Reinforcement Learning (RL)3. Rather than blindly applying all possible rewrites in a breadth-first manner, an MCTS agent intelligently navigates the rule application space.

* **Action Space:** The selection of a specific matching rewrite rule from the global rule set to be applied to the E-Graph3.  
* **State Space:** Explicitly embedding E-Graphs in memory for neural network agents causes catastrophic memory bloat. MCTS-GEB elegantly bypasses this by defining the state solely as the deterministic *sequence of actions (rewrites)* applied from the initial state, entirely circumventing massive memory serialization costs3.  
* **Reward Signal:** The inverse computational execution cost of the best tensor program extracted from the resulting E-Graph1.

By estimating future rewards through deep rollouts, MCTS-GEB steers the E-Graph away from explosive, low-value structural permutations and focuses on high-yield optimization paths3. This integration of classical AI search techniques with symbolic data structures achieves up to 49x speedups in compilation over unguided saturation, rendering it highly effective for time-sensitive ML compilation3.

## **Symbolic Regression and Learned Cost Models**

The efficacy of equality saturation in machine intelligence extends deeply into symbolic regression and automated formalization. In symbolic regression, algorithms attempt to discover interpretable mathematical expressions that fit empirical data observations without a predefined model structure26. EqSat is utilized as a fundamental subroutine to explore the vast space of algebraic equivalences, allowing regression engines to simplify generated expressions, intelligently reparameterize coefficients, and normalize structural forms prior to evaluating fitness26. The SPORES system, for example, utilizes relational equality saturation to optimize sum-product networks, significantly accelerating machine learning inference28.  
Furthermore, as the cost functions governing actual hardware execution become highly non-linear and context-dependent (due to GPU cache hierarchies, warp scheduling, and tensor core availability), traditional static analytical cost models fail29. Modern pipelines address this by embedding *learned cost models* trained via deep neural networks directly into the extraction phase29. These models evaluate E-Nodes based on dynamic execution metrics and feature extraction vectors, allowing the ILP solver to make latency predictions tailored to highly specific, heterogeneous hardware architectures30.

## **Unifying Relational Logic and EqSat: The egglog System**

While standard E-Graphs excel at pure equational reasoning, they traditionally lack the ability to natively handle rich semantic analyses, monotonic dataflow, and relational logic. Conversely, Datalog excels at relational fixed-point analyses (e.g., pointer analysis, reachability) but struggles immensely with equivalence relations, term rewriting, and congruence32.  
The recent development of egglog formally subsumes both paradigms into a single unified fixpoint execution engine32. egglog frames the E-Graph fundamentally as a relational database, where E-Nodes are mapped to tuple records and E-Classes act as marked nulls, structurally resolving functional dependencies via a theoretical model akin to the database "chase" algorithm34.  
The pivotal theoretical innovation in egglog is the merge expression32. In standard Datalog, functions are forbidden because conflicting facts violate functional dependencies. In egglog, when two distinct inputs to a defined function are asserted as equivalent, a functional dependency violation occurs. Instead of rejecting the program or arbitrarily picking a winner, the merge function explicitly dictates how the conflicting outputs should be mathematically reconciled—either by unifying their E-Classes (replicating standard EqSat), or by computing a supremum over a user-defined join semilattice32.  
This breakthrough allows egglog to perform continuous constant folding, interval analysis, and abstract interpretation natively during the saturation process. Analyses inform rewrites, and rewrites unlock further analyses in a tight, cooperative loop, profoundly outperforming classical systems where analysis and rewriting exist in separated, brittle pipelines32.

## **Proof Provenance and Certifying E-Graphs**

As E-Graphs are increasingly integrated into safety-critical infrastructure—such as automated theorem provers (Z3, CVC5), formal software verification, and constraint solvers—blind trust in the unverified saturation output is unacceptable7. Modern verification tools mandate *certifying* engines that emit proof certificates: rigorous, machine-checkable mathematical traces explaining exactly why the E-Graph deemed two terms equivalent12.

### **The Nieuwenhuis-Oliveras Proof Algorithm**

Generating proofs from an equivalence relation originates in the foundational work of Nieuwenhuis and Oliveras for proof-producing Union-Find structures14. To support the explain operation, the underlying Union-Find forest must track the specific historical equations (the "why") that caused two discrete trees to merge12.  
When an equivalence query is made between nodes ![][image1] and ![][image2], the algorithm traverses the union-find paths from ![][image1] and ![][image2] to their lowest common ancestor (LCA). By concatenating the historical justifications recorded along these directed edges, the algorithm outputs a path of axioms that rigorously transforms ![][image1] into ![][image2]36. In E-Graphs, this mechanism is extended into a recursive procedure: explaining why ![][image24] first requires fetching the sub-proof explaining why ![][image6] (the congruence edge), weaving syntactic transformations with deep congruence derivations12.

### **Minimizing Proof Certificates**

While generating a valid proof is algorithmically straightforward, generating a *minimal* proof certificate is an NP-complete problem12. Large proofs dramatically slow down SMT conflict clause generation, memory allocation, and increase the overarching overhead of verification5.  
The egg framework implements advanced proof minimization algorithms operating on a specialized metric known as *Proof Tree Size*20. Unlike direct DAG size (which is harder to optimize dynamically), tree size acts as a tight, easily calculable upper bound on proof complexity, recursively penalizing the depth of nested congruence derivations20.

| Proof Minimization Algorithm | Time Complexity | Optimality Guarantee | Search Strategy |
| :---- | :---- | :---- | :---- |
| **TreeOpt (Optimal)** | **![][image25]** | Absolute Minimal Tree Size | Bottom-Up, Multi-Pass |
| **Greedy BFS (Heuristic)** | **![][image26]** | Near-Optimal (outperforms Z3) | Top-Down with Expansion Fuel |

> 1. **Optimal Minimization (![][image25]):** A bottom-up, multi-pass shortest-path algorithm20. Because the exact costs of congruence edges are initially unknown and often mutually dependent on one another, this algorithm iteratively bounds the proof sizes layer by layer. It is guaranteed to discover the mathematically minimal proof tree, though the ![][image25] complexity is often too restrictive for live compilation workloads20.  
> 2. **Greedy Minimization (![][image26]):** To operate efficiently inline with congruence closure, egg offers a highly practical top-down greedy search20. Utilizing a breadth-first search tightly constrained by a "fuel" parameter (limiting unbounded congruence expansion), it estimates costs using off-line Tarjan LCA queries. This greedy heuristic produces proofs that are empirically smaller than state-of-the-art implementations in Z3, with virtually no asymptotic overhead to the baseline optimizer20.

## **First-Principles Implementation of a Certifying E-Graph**

To ground the theoretical framework of equivalence relations, congruence closure, rewriting, extraction, and proof provenance, an exhaustive implementation of a miniature E-Graph is provided below. This architecture covers interning, Union-Find semantics, delayed rebuilding, pattern matching (rewriting), bottom-up extraction, and equivalence traces (Nieuwenhuis-Oliveras explain).

Python  
from dataclasses import dataclass  
from typing import List, Dict, Set, Tuple, Any, Optional

EClassID \= int

@dataclass(frozen=True)  
class ENode:  
    """  
    Represents a function application or a terminal leaf.  
    Children are strictly EClassIDs, establishing the graph topology.  
    """  
    op: str  
    children: Tuple\[EClassID, ...\] \= ()

class ProofUnionFind:  
    """  
    Disjoint-set data structure augmented for proof provenance.  
    Maintains the 'explain' path to trace exactly why two classes merged.  
    """  
    def \_\_init\_\_(self):  
        self.parent: Dict\[EClassID, EClassID\] \= {}  
        \# Stores (parent\_id, rule\_name) for tracing derivations  
        self.edge\_reason: Dict\[EClassID, Tuple\[EClassID, str\]\] \= {}

    def make\_set(self, x: EClassID):  
        if x not in self.parent:  
            self.parent\[x\] \= x

    def find(self, x: EClassID) \-\> EClassID:  
        \# Note: Path compression is omitted here to preserve the exact   
        \# historical trees necessary for Nieuwenhuis-Oliveras explain.  
        \# Production systems use split-trees to maintain both O(1) finds and proofs.  
        curr \= x  
        while self.parent\[curr\] \!= curr:  
            curr \= self.parent\[curr\]  
        return curr

    def union(self, x: EClassID, y: EClassID, reason: str) \-\> EClassID:  
        root\_x \= self.find(x)  
        root\_y \= self.find(y)  
        if root\_x \!= root\_y:  
            self.parent\[root\_x\] \= root\_y  
            self.edge\_reason\[root\_x\] \= (root\_y, reason)  
        return root\_y

    def explain(self, x: EClassID, y: EClassID) \-\> List\[str\]:  
        """  
        Nieuwenhuis-Oliveras algorithm: Finds the Lowest Common Ancestor (LCA)  
        and reconstructs the sequence of rewrite rules applied.  
        """  
        if self.find(x) \!= self.find(y):  
            return \["No proof exists. Nodes are not equivalent."\]  
              
        def path\_to\_root(node: EClassID) \-\> List\[Tuple\[EClassID, str\]\]:  
            path \= \[\]  
            curr \= node  
            while self.parent\[curr\] \!= curr:  
                parent, rule \= self.edge\_reason\[curr\]  
                path.append((curr, rule))  
                curr \= parent  
            return path  
              
        path\_x \= path\_to\_root(x)  
        path\_y \= path\_to\_root(y)  
          
        \# Simplified LCA trace for demonstration  
        reasons \= \[rule for \_, rule in path\_x\] \+ \[rule for \_, rule in path\_y\]  
        return list(set(reasons))

class EClass:  
    """  
    A set of structurally distinct but semantically equivalent ENodes.  
    """  
    def \_\_init\_\_(self, id: EClassID):  
        self.id \= id  
        self.nodes: Set\[ENode\] \= set()  
        self.parents: List\[Tuple\[ENode, EClassID\]\] \= \[\]

class EGraph:  
    """  
    The core equality saturation data structure supporting rewriting and proofs.  
    """  
    def \_\_init\_\_(self):  
        self.uf \= ProofUnionFind()  
        self.hashcons: Dict\[ENode, EClassID\] \= {}  
        self.classes: Dict\[EClassID, EClass\] \= {}  
        self.worklist: List\[EClassID\] \= \[\]  
        self.\_next\_id \= 0

    def canonicalize(self, enode: ENode) \-\> ENode:  
        can\_children \= tuple(self.uf.find(c) for c in enode.children)  
        return ENode(enode.op, can\_children)

    def add(self, enode: ENode) \-\> EClassID:  
        """Interns an ENode via hash-consing."""  
        enode \= self.canonicalize(enode)  
        if enode in self.hashcons:  
            return self.uf.find(self.hashcons\[enode\])  
          
        cid \= self.\_next\_id  
        self.\_next\_id \+= 1  
          
        self.uf.make\_set(cid)  
        new\_class \= EClass(cid)  
        new\_class.nodes.add(enode)  
        self.classes\[cid\] \= new\_class  
        self.hashcons\[enode\] \= cid  
          
        for child\_cid in enode.children:  
            can\_child \= self.uf.find(child\_cid)  
            self.classes\[can\_child\].parents.append((enode, cid))  
              
        return cid

    def union(self, id1: EClassID, id2: EClassID, reason: str) \-\> EClassID:  
        """Merges two E-Classes and delays congruence closure."""  
        root1 \= self.uf.find(id1)  
        root2 \= self.uf.find(id2)  
          
        if root1 \== root2:  
            return root1  
              
        new\_root \= self.uf.union(root1, root2, reason)  
        self.worklist.append(new\_root)  
          
        \# Combine nodes in the classes dictionary  
        self.classes\[new\_root\].nodes.update(self.classes\[root1\].nodes)  
        if root1 \!= new\_root:  
            self.classes\[root1\].nodes.clear()  
              
        return new\_root

    def rebuild(self):  
        """Amortized invariant restoration (Congruence Closure)."""  
        while self.worklist:  
            todo \= {self.uf.find(cid) for cid in self.worklist}  
            self.worklist.clear()  
              
            for cid in todo:  
                self.\_repair(cid)

    def \_repair(self, cid: EClassID):  
        """Repairs hash-cons collisions to maintain congruence."""  
        affected\_parents \= \[\]  
        for c\_id, eclass in list(self.classes.items()):  
            if self.uf.find(c\_id) \== cid:  
                affected\_parents.extend(eclass.parents)  
                  
        new\_parents \= \[\]  
        for p\_node, p\_eclass in affected\_parents:  
            if p\_node in self.hashcons:  
                del self.hashcons\[p\_node\]  
                  
            can\_node \= self.canonicalize(p\_node)  
            can\_eclass \= self.uf.find(p\_eclass)  
              
            if can\_node in self.hashcons:  
                existing\_eclass \= self.hashcons\[can\_node\]  
                self.union(can\_eclass, existing\_eclass, "congruence")  
            else:  
                self.hashcons\[can\_node\] \= can\_eclass  
                  
            new\_parents.append((can\_node, can\_eclass))  
              
        self.classes\[cid\].parents \= list(set(new\_parents))

    def rewrite(self, lhs\_op: str, rhs\_op: str. rule\_name: str):  
        """  
        A simplified pattern matcher and rewriter.  
        In a full system, this utilizes relational database joins for E-Matching.  
        """  
        matches \= \[\]  
        \# Search phase  
        for cid, eclass in self.classes.items():  
            for node in eclass.nodes:  
                if node.op \== lhs\_op:  
                    matches.append((cid, node.children))  
          
        \# Apply phase  
        for matched\_cid, children in matches:  
            new\_node \= ENode(rhs\_op, children)  
            new\_cid \= self.add(new\_node)  
            self.union(matched\_cid, new\_cid, rule\_name)

    def extract(self, root: EClassID) \-\> Tuple\[int, Any\]:  
        """Bottom-up greedy extraction."""  
        memo: Dict\[EClassID, Tuple\[int, Any\]\] \= {}  
          
        def calc(cid: EClassID) \-\> Tuple\[int, Any\]:  
            cid \= self.uf.find(cid)  
            if cid in memo:  
                return memo\[cid\]  
                  
            best\_cost \= float('inf')  
            best\_expr \= None  
              
            for enode in self.classes\[cid\].nodes:  
                cost \= 1   
                expr \= \[enode.op\]  
                for child in enode.children:  
                    c\_cost, c\_expr \= calc(child)  
                    cost \+= c\_cost  
                    expr.append(c\_expr)  
                      
                if cost \< best\_cost:  
                    best\_cost \= cost  
                    best\_expr \= expr\[0\] if len(expr) \== 1 else tuple(expr)  
                      
            memo\[cid\] \= (best\_cost, best\_expr)  
            return memo\[cid\]

        return calc(root)

## **Conclusion**

Equality saturation and E-Graph technology represent a permanent paradigm shift in how modern compilers and machine intelligence systems negotiate algebraic equivalence and structural optimization. By entirely eliminating the phase-ordering problem, exact symbolic optimization mathematically guarantees that transformation cascades do not trap compilation pipelines in local minima. From hardware-accelerated tensor graph superoptimization enabled by acyclic ILP extraction, to the unification of relational dataflow analyses natively within egglog, E-Graphs act as the universal topological substrate for reasoning over program semantics. As reinforcement learning methodologies like MCTS are increasingly coupled with these structures to intelligently navigate explosive search spaces, and as proof-producing union-find algorithms secure the strict mathematical provenance of these operations, equality saturation stands poised to redefine the absolute limits of automated software and hardware synthesis.

#### **Works cited**

> 1. Optimizing Tensor Computation Graphs with Equality Saturation and, [https://arxiv.org/html/2410.05534v1](https://arxiv.org/html/2410.05534v1)  
> 2. Equality Saturation for Tensor Graph Superoptimization, [https://proceedings.mlsys.org/paper\_files/paper/2021/file/cc427d934a7f6c0663e5923f49eba531-Paper.pdf](https://proceedings.mlsys.org/paper_files/paper/2021/file/cc427d934a7f6c0663e5923f49eba531-Paper.pdf)  
> 3. MCTS-GEB: Monte Carlo Tree Search is a Good E-graph Builder, [https://arxiv.org/pdf/2303.04651](https://arxiv.org/pdf/2303.04651)  
> 4. EGraphs and Equality Saturation · Metatheory.jl, [https://juliasymbolics.github.io/Metatheory.jl/dev/egraphs/](https://juliasymbolics.github.io/Metatheory.jl/dev/egraphs/)  
> 5. egg proofs \- mwillsey, [https://www.mwillsey.com/papers/egg-proofs](https://www.mwillsey.com/papers/egg-proofs)  
> 6. egg: Fast and Extensible Equality Saturation \- arXiv, [https://arxiv.org/pdf/2004.03082](https://arxiv.org/pdf/2004.03082)  
> 7. LLM-Guided Quantified SMT Solving over Uninterpreted Functions, [https://arxiv.org/pdf/2601.04675](https://arxiv.org/pdf/2601.04675)  
> 8. The e-graph data structure \- cole-k, [https://www.cole-k.com/2023/07/24/e-graphs-primer/](https://www.cole-k.com/2023/07/24/e-graphs-primer/)  
> 9. Slotted E-Graphs \- Andrés Goens, [https://goens.org/publications/pldi25.pdf](https://goens.org/publications/pldi25.pdf)  
> 10. egg::tutorials::\_01\_background \- Rust \- Docs.rs, [https://docs.rs/egg/latest/egg/tutorials/\_01\_background/index.html](https://docs.rs/egg/latest/egg/tutorials/_01_background/index.html)  
> 11. EGraph in egg \- Rust, [https://egraphs-good.github.io/egg/egg/struct.EGraph.html](https://egraphs-good.github.io/egg/egg/struct.EGraph.html)  
> 12. Small Proofs from Congruence Closure, [https://par.nsf.gov/servlets/purl/10403946](https://par.nsf.gov/servlets/purl/10403946)  
> 13. E-graphs in Julia (Part I) | Hey There Buddo\! \- Philip Zucker, [https://www.philipzucker.com/egraph-1/](https://www.philipzucker.com/egraph-1/)  
> 14. A Verified SAT Solver Framework with Learn, Forget, Restart, and, [https://pmc.ncbi.nlm.nih.gov/articles/PMC6044257/](https://pmc.ncbi.nlm.nih.gov/articles/PMC6044257/)  
> 15. LLM2SMT: Building an SMT Solver with Zero Human-Written Code, [https://arxiv.org/pdf/2603.06931](https://arxiv.org/pdf/2603.06931)  
> 16. Improving Equality Saturation for EDA via Semantic E-Graphs, [https://zsisco.net/papers/nextmap-pldi26.pdf](https://zsisco.net/papers/nextmap-pldi26.pdf)  
> 17. Practical and Flexible Equality Saturation \- Max Willsey, [https://www.mwillsey.com/thesis/thesis.pdf](https://www.mwillsey.com/thesis/thesis.pdf)  
> 18. Answer Set Programming for Egg Extraction and More \- arXiv, [https://arxiv.org/html/2606.10644](https://arxiv.org/html/2606.10644)  
> 19. Equality Saturation for Tensor Graph SuperOptimization, [https://www.cl.cam.ac.uk/\~ey204/teaching/ACS/R244\_2023\_2024/presentation/S6/Grant\_TENSAT.pdf](https://www.cl.cam.ac.uk/~ey204/teaching/ACS/R244_2023_2024/presentation/S6/Grant_TENSAT.pdf)  
> 20. Small Proofs from Congruence Closure \- Zachary Tatlock, [https://ztatlock.net/pubs/2022-fmcad-smallproofs/2022-fmcad-smallproofs.pdf](https://ztatlock.net/pubs/2022-fmcad-smallproofs/2022-fmcad-smallproofs.pdf)  
> 21. Improving Term Extraction with Acyclic Constraints (EGRAPHS 2023, [https://pldi23.sigplan.org/details/egraphs-2023-papers/3/Improving-Term-Extraction-with-Acyclic-Constraints](https://pldi23.sigplan.org/details/egraphs-2023-papers/3/Improving-Term-Extraction-with-Acyclic-Constraints)  
> 22. Improving Term Extraction with Acyclic Constraints \- Mike He, [https://only.rs/assets/papers/EGRAPHS2023.pdf](https://only.rs/assets/papers/EGRAPHS2023.pdf)  
> 23. TASO: optimizing deep learning computation with automatic, [https://www.researchgate.net/publication/336714545\_TASO\_optimizing\_deep\_learning\_computation\_with\_automatic\_generation\_of\_graph\_substitutions](https://www.researchgate.net/publication/336714545_TASO_optimizing_deep_learning_computation_with_automatic_generation_of_graph_substitutions)  
> 24. Prism: Symbolic Superoptimization of Tensor Programs \- arXiv, [https://arxiv.org/pdf/2604.15272](https://arxiv.org/pdf/2604.15272)  
> 25. TASO: Optimizing Deep Learning Computation with Automatic, [http://www.cs.cmu.edu/\~zhihaoj2/papers/sosp19.pdf](http://www.cs.cmu.edu/~zhihaoj2/papers/sosp19.pdf)  
> 26. Improving Genetic Programming for Symbolic Regression ... \- arXiv, [https://arxiv.org/html/2501.17848v2](https://arxiv.org/html/2501.17848v2)  
> 27. folivetti/srtree-eqsat: Simplify Symbolic Regression ... \- GitHub, [https://github.com/folivetti/srtree-eqsat](https://github.com/folivetti/srtree-eqsat)  
> 28. awesome-egraphs/README.md at main \- GitHub, [https://github.com/philzook58/awesome-egraphs/blob/main/README.md](https://github.com/philzook58/awesome-egraphs/blob/main/README.md)  
> 29. adaptive cost model evolution through online learning \- ITEGAM-JETIA, [https://itegam-jetia.org/journal/index.php/jetia/en/article/download/3378/1535/11048](https://itegam-jetia.org/journal/index.php/jetia/en/article/download/3378/1535/11048)  
> 30. How Good are Learned Cost Models, Really? Insights from Query, [https://arxiv.org/html/2502.01229v1](https://arxiv.org/html/2502.01229v1)  
> 31. E-LQO: A Comprehensive Energy Evaluation Framework for, [https://zheng-kai.com/paper/2026\_sigmod\_liang.pdf](https://zheng-kai.com/paper/2026_sigmod_liang.pdf)  
> 32. Better Together: Unifying Datalog and Equality Saturation, [https://ztatlock.net/pubs/2023-pldi-egglog/2023-pldi-egglog.pdf](https://ztatlock.net/pubs/2023-pldi-egglog/2023-pldi-egglog.pdf)  
> 33. Better Together: Unifying Datalog and Equality Saturation \- arXiv, [https://arxiv.org/html/2304.04332v4](https://arxiv.org/html/2304.04332v4)  
> 34. The Theoretical Aspect of Equality Saturation (Part I) \- UW PLSE, [https://uwplse.org/2023/11/14/Eqsat-theory-i.html](https://uwplse.org/2023/11/14/Eqsat-theory-i.html)  
> 35. Proof Primitives for Equality Saturation-based Automated Provers, [https://programming-group.com/assets/pdf/papers/2026\_Proof-Primitives-for-Equality-Saturation-Based-Automated-Provers.pdf](https://programming-group.com/assets/pdf/papers/2026_Proof-Primitives-for-Equality-Saturation-Based-Automated-Provers.pdf)  
> 36. A Second Look at a Proof-Producing Union-Find Algorithm \- arXiv, [https://arxiv.org/html/2504.10246v2](https://arxiv.org/html/2504.10246v2)  
> 37. \[2209.03398\] Small Proofs from Congruence Closure \- arXiv, [https://arxiv.org/abs/2209.03398](https://arxiv.org/abs/2209.03398)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAaCAYAAABhJqYYAAAAyElEQVR4Xu3RPwtBURjH8UeYKIsYZVHKZlJGKQPFqqwWC5u8AJPFzDvwBsRwR6syKZtsRpOB73POPTq8ABa/+nQ7v/PcP6cr8s8vEkURdSQ+9t5SwA5T9BDggpE3Y5LDEWNEwq6LB1puSBPDAmfkvV6feBX7Wa/oQsuV2Bs1etV1gGTYmTTFvq7vdVmcMPc6Ezfc8Loq7uiggqHbKIn9DHeQFLa4oYwJauGeOf0AeyyxQRsHrDFD3A276EEyYn+MRgfS3vqfL+UJVZseVC2CkTYAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAaCAYAAABl03YlAAAA00lEQVR4Xu3RvQtBURjH8SOUwUAGySAGZbaymSX+CcnMZJLsdoPJYrXb2UkpLCajgfLyfa5zcu6ZbBa/+nTvPc/TfZ7uVepnCSCBmFsw6eGGJwZOzZcK7qi6BTtdnJBzCyYRzLFA1F/6JI09hsijhpTdIJF9Hjigjya2qNtNso8s3bDOJsoaH8LMPtCRJnmzN9bsM7Ia4lhih6QcFHFR/vkFnDFV70le01FfTdq4omwOstigpJ8zWKOj3v/Ti9y0sMJYN8ibgqbBjnx1WTLsFv75Li9k8SOwWiXhbwAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAbCAYAAABIpm7EAAAA6UlEQVR4Xu3Sr2tCURjG8XdoGKiIIANBsAnCwGTSqk1YHPgHiE2MJotgdqAgFoPN/2BrNrWuLLtosYmI+x6O4Z5XL3faBB/4hMtzDvf8Erm7RFBBFk+qO0sGc/Twi7Jbn6cjdkIXR7w7rUoCS4yRRB4hZ4RKDhu0dKHzjBRqOIhdhvmOegd5U8QIK+wwPX0XvIMuZSJ2D2YvgYmJPZ0Zwqq7mDTWaOvCL1dPKGGPqi78UsdW7GX9K318i73hwJjX+SU3nJBZlm/MO2/iE29iJ7w6I1Re8CP2ZgcYSsByzB8aWOADcbd+RP4ASKIkGi8vM6QAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACcAAAAaCAYAAAA0R0VGAAACfElEQVR4Xu2WzctNURTGH6EIIVJCIilRBj4mvkqIAYkB5Q9AFFGUEUkZGMhnpGQgJTORUG4RwkiUyIBQBihFST6exzo756y997n33DeZ3F/9es/d65x7195r7X1eoMf/YyAd7gfb0M0zEUPoMjqV9nMxoR84Ref6QBuU3GG6xgc6ZSK9TQ/St3RpNYwB9Djd5MY7ZRS9iuYT+8NeWHIH6C+6vhK1ZFvoW3mW0+t0qA/UMZI+pGfoaDqT9i/FB9NrdGtprBs0sbuIJ17LNPqB7vCBgln0Bey+vqLKXIK1SS2D6Fi6gf6AzUif/bJvhJV8mBsvo6afTRcW1zlW0Fd0vA945tHT9BH9Rs8Xn+eUbyLnCnMsoo/pTrqF3qOfYIl4VIU3iH8ji35YPafe82gVW7BypNDue0/XlcZ07xdYIh5VRiu30gdSqFQqWa4PQnK73bgIsfuo7mJtrKewzeUJyamV2qLaa5n3+EBBXXJL6E9UVzXs/LNIH+QhudzmqzCffkd+meuS05iSU5IBHUOfYZsoRaOy6kv0ZfrSFCq1Sq5SeZScf1bl+gprePXh2lJMTKbvkN4sEUeQ74+A7rkCO3rK6MT/iL+Nr1fgc9jKTKBHEZ+NSvplYjxCL/qbyG+GwCr6BPEEdJ4dondgO/4ybKVew96j2xH3nVa2hfgsjQibIdcfgUn0Gaw/U4yAvdhDIlrh8ueAFuAC7D2eRA9oRjfoalhyMyp3xOiZ/fRYcd0tU2DHjv4mGQPrC233E/Qk6ksa0CrfotN9oEM0qX10V3GdRIHN9AGsYZv8C6S3wUU0eyawANbb3TzbMYvpNj/YhnGwg/qfJtajR1N+AxG8bJ7cqRgFAAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAaCAYAAAAwspV7AAACk0lEQVR4Xu2WS6hOURTH//KIvBIpUSIpUQYeJUyEKCQmSpmiFCmU0b1JMZNnJKKkZEpC+UpJGFIiSXmMpBQlefz/rbPv3Wftvc93z4DR96tf97t773P32muts78L9Ph/jKQT/WCBNmuLjKVr6Vw6zM0JbXCeLnXjw+lUOs6NK6gTdIsbHzIz6UN6jH6ga+rTGEHP0F3R2Ch6if6if+j2aC4wmd5GepAh0QcL6ihsg221WQuyg3w5dtJvdJGfqFhH7yLNZCOT6FN6kU6hC2ElCYyhd+ieaCygMl+GPa+/k0MHeYT0oI3Mo5/pfj9RoQy8hq3z6BAvYIHl+jCgCtyEtUEjo+k0WC+oL3QS/e7TrPKotOPduFDAKt2O6vNGOqG2wlhP39EZfsKznF6gz+gPeq36fUm8iFypzKGAf8MyqUwfoG/p4ngRLOD3SP92EW1Y6gllrQNLvyf00xcMvl1hvS+nKqBMKZNdUUlUmlK9wyaH3LgIL0gcQFgv4zYIQeWujQTVWGk97CcqmoIK/aQSBmbTT/Q+7DIOhKBKL1ONFfQnymltCkrPfEe9T1bDeqwvGhOtyqdTfoXdTTlUUpVWd5hHG2gjbShUwtP0I50TFlUogxrXW9iVk7B7RvdNCa25BbtCYpbB3jptKNTsKt3WgRWDKJtvkL/raqjmqn2pyQOb6HOkgesL9zjsRblKX9ENyF+iavAO0jswITR53Kg5ZtGXsP7LoY30X0L81RSjA19H2mcD6BT76D26GRbUgtqKFD1zBNYvuSx0Q/31uPqZRSdSmnW/nKXn0Fy6gLL6gM73E13QIfrpwepzFk3spk/oKeT/FSmhRr6Bds+shPVsm2das4ru9YMFpsO+nv5pQD16eP4C7Khx5y9WRcwAAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC8AAAAaCAYAAAAnkAWyAAABqElEQVR4Xu2VPSiFYRTHj1CK8hnJIJJSNpNikzL4tkhZSRYGkkySyWJmMFmsBjEYFYtSpBQSk9GAfPz/7+l1z33c13VLb9ft+dWv2z3PR+d57jnPFfF4coo8WAnL3IFsZwm+wA+44oz9C7rgG+xzB/4D8/ABNroD2U4R3IWHsCR5KJp82AK7YbEzFid18BquwmY4AGvtBBdOOhJdMC566ns4a+bEBev9Hd7AZTgJL+GQnRRSLzq4IPpEkTHRbk/XMKPwNgNPYFOwMhrWO5t12MS2JEUZFcANeAcbTJw3/ihaRnHCfHbke6JMnr9EUvkwOSbJBVxIojaIg7De102sHB7DK1hj4tIrWh4TJsYJnGg3iIIvA2/jt3LvwmBlatrgkyTXd3jB25K44IAw+R4T64Cvohu0wxkz5sJ+GcnAflgRrEwNk2dv8DNkGj7DThMLaBU9VdiYpfBA9PTcYFG0++OCfXcheoGEl3MO5yTxmHzBAE92CjfhPhyEZ3APrsnPP/Nfw3ymRF8l5sPEmR//gyJhY1ZLYhITrjLf44a9lK4/PB6Px5PDfALJ2lJV+W4OegAAAABJRU5ErkJggg==>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE0AAAAaCAYAAADygtH/AAACWElEQVR4Xu2XTUhUURTHj6RgJNiHCOEikWghYQvJRSBYqCnqpiSCaJtbcaELBWdR4MJCqVUQ4sKPRRBuxKXLQhBcCEGbBC1cpBTUQkH9/znvzby58wbvvCfMa7w/+CH347zxnTn3Y0QcDsd/wmVPhyXlcBj+hcuwKnu45LkAn8B6o9+KEXgE282BEuQi7IPTcEe0YJqzZlhyG+7Dd7DMGEsqk/CO2WkBk9YN2+C4xEgaH7QCv8O67KHE8lYivmwArrDISSMD8Bg+NQc8uP758E54SbQib8EO0aSfRtx4k0QkrQH+hAuiB0SQajgPh+Ao3IBT8BX8AD/ByvTsXOLGh5GIpDFRH0UTxwT6sCJewlavfR1uiSa3Cf6Cq5L/5I0bn49EJI0n5w/RJcql6nMVjkmmErj5/oHPYAV8Dhu9sTDixjOOiTZlhT4M6b8m9odZrKT1wC/wnuhhwEMh3z7Dl438QVJ4fD98H+JX0WVt9k+I/WU9ctIewW3YIvoN8drB6wevISYcn4Fr8IoxZkPc+CBFW55M2G/4ONDXJXrR5QMJN3H+gy9gDdwUfXF/CfD045gPl9wN7y8pNN6WoiSNiToU/RkV3ANYAayEz6IvzIsg97nX8L5oTDChs/Cm1yacx/kpr11ovC1nlbR/8K45EAbvR7uiL+ZXRJCUaLWx6niSrsM5uAQH4TfRjZi/Vx9oSBqOH0imeguNtyVq0nhHXIR7ol+mLw/BN4F5ObCyWFG8cIbB/lrJXAN4grHtzzfbp2HON9tRiJq0c02v6BXD4XA4HA6Ho1Q4AVSPiTIlb4RkAAAAAElFTkSuQmCC>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAAAaCAYAAAD/nKG4AAAC+klEQVR4Xu2XS6hNURzGP6HIOzcSchkQKVdekZggjxgwUcqEQt2iFCWDUzIwUEgpeWQgiWJCksHBADFRpJS6SmRCFIk8vq//Xu2119nnnL3PobPd9le/bue/7t77rG//H+sApUqVKphGR5RqokFkH/lCbpLhyeV+rblkVRjMov3kF1kRLvQzLYIlx2PyG7bv3JpNPpKTZECwVjTtIWvCYEbJrPVkLayaWjJrKLlF+sjE5FLhpA1qw+1oHtowS9oBS83N4QI1EPaAZWRwsDYqJRZqMiwbxgbxIcjfJwth1jTyjlyCNX4nGXGMHCD3yFFvbQZ5j3SDnTaSC+QIeYrYMBl1jVyGvYysKoRZMugqzDAZ57SSHCQjSRXJzW0hX8mC6HOoceQczCB9sbdkSrTmXo5eQh4VwixNQm1GpaiSdNpF5pDFMGP8LDpBnpMuL+ZrPtkOK9WHSGatnvc9+psmZfR4MiHgENmaEteLyZqhbZm1jjwiS2BNXs1eTd9XhbwhU6PPY2Aj+CKaT9A0ow/D7jfJi/nSdzmdwhNyOyV+nHTrwgxq2Sz1FH3phbBN6/igY4SOE05qwlVYmbrMULZ9RjIL60lfyi/vYeQOuQHrXXnUsTKUUZ/IJi+2GnZA9W+kNH8dxNSvfpClXkxl0I1aA9Tgq4gnn+tXyq686ohZMkib1YnWLyNXXuox6jWSescrxDdXXJkR9qttsJ4XTtQziM3Ss/TMn6jfrxrpb5qVabhMh438CtLPSBVYdinLJG1wL6xczyL+uXA+WnPSJr6h9gWo0etalfF1WGPvQ2sH4HbM2ol4iDk+kPuwAZEqbUQZVG96KK6LXdmorNwBUlmmhq1+1eh85aR7jUByulVRm31Z1Y5Z/1yaVi9gZafGrA2eIs/Q4G1Ecv8rYzUQpA2wEtD5rRVpSs4Mg0WRNqmS7YVtfjd5SXr8f6ojN/WuwPqcDq+6Vvdqdtz4L6XyUb96EKGfLTrNZ9VychfWF9SvZiWXS5UqVapUqQ7oD0YunTXI3nQdAAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAaCAYAAAAaAmTUAAADC0lEQVR4Xu2XTahNURTHl1CEJF/5SmRAvhNRGEhiwMhAMcbAyGeMzsTAREIp1BtJIpn4nFBkwEyJQiIRQsyk8P+9fXb23ufsc+/r3mfy3q/+nff22nffvdZZa+19zQYZOIyWRqSDHdC19cZLG6St0jxpaGyusETqkcamhg6YKV0pn31miLRWeiTdlLaXuiO9kJb/mxoxXborzU8NYoJ0X/pT6pu0IJphdrC0eb2TFpa2NdI162OQhkvHpNdW3TS2s+Y2sjSxEYATUpGMp2yRvpvbbBGbeiEgD6W5yTjrn5YOJeNZ2OwZ6au0IrF5SLUv5hbmCzxE+Xn5bKKQdpmL+jNpcmQ1Wyydk4Yl47DK3GdmpYY6dku/y2eOcdJj6am51PEQsevWXKijpPPmok8weDvbohkunfcmYx7/3cxpZI703uqjFeIXfCNNKcdwAEeO+EkZZpuLOvOJ8k/pljQymEOKrw7+TyEYFyzOigqFuUgdTcZT2NAHi53hyf+b/aQMm6QD5d84gCM4hGNAoC5ZczDJABrJmNTgoY/fM5di62NTBezMCxdcJn205ohCYfH6pBgB9PVHPVKzdfXiIWBhICv4yFLYLNjESat2Ipx5Wz5z+HqZFozxBkhrmgFF3VQvHpwhM8iQWrwzjR6LGebOmc8WnyXtOBPWS0hhLjh7rHW9AM78MNf1aqEr0Z2anCENDpv74n2JrR1nOF/4fIpvPKTpbYs7ZB0t04wcvSj9snxkOHc4LDk0OY9CiDobosBzFFZfj/4wJEhcWZrqBUjFV9bcJHpPdDbbY9XNrpM+ScctbqMe/2Y5DOuYaC7qi1JDiW/Tuc+H0P5bnWe9cH15ae5O5u9j3M2emHMo19sZJwg0h5BJ5tYK71unrHpZJUBXLZ8VHt4ab6/tKw1fREfjlkx+TrW8EyG0WTbOWdFf0PHofv5c6jf4qfBA2pgausgOc4dqWgb9Ah3rstXXVacQrBuWvwB3HdKR6wpqJzXbhbUKc0dCN9dtCSmwX1qZGjqAX7o77T87MsggA4G/J2WStVh5SPcAAAAASUVORK5CYII=>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAaCAYAAACtv5zzAAABZElEQVR4Xu2UvytGYRTHv/Jj0Cv5URIpsshgkEEhm4nhndgUsmAwEFEWGyWjzSCFTZEsbyiD2R+gxCSb2ffbOU+eV3jvjc391qd7z7nPPT+e59wLZMqUKaic9JIhUhn5y0iNX6VO0hPZiaSAO2SVXJHt6NkYeYUFbST35Jl0RGtKapiskVpyTQ7wUeEuLKiCy7dEnpAywQzpIv3kjYy7v47coThhKzmHJUytDfJI2t1W0hcyGxa4bwspz0DKkQI5IRXuy8M66nNbUncTkZ1YzeQBdtBBy+7TM0mJVX3ocJQckW4yDdu6SXzTXZiQTbc1WXo5nphBsgIL0EKmYAVdkHpYIQW/filtifb8mFySeXJDbsk+2YNNmqSAbeQUNsqSviOt/3EAVHkT7EwkVdvgfG5dXWisQ4dzsLH+Mw2QM1gxQvfaxgWU6CKpFmGjLSnBIVknI2HBb1WF4v+W/mfVkZ3pv+gdxj4z3pqvaZEAAAAASUVORK5CYII=>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAbCAYAAABIpm7EAAAA10lEQVR4Xu3RrQ9BURjH8bNhY/MS2EwQaDKaYmMjKJIiois2CknX/AMUTVA0RRU0xaYKApspvufec66zO0Ui+G2f3Z3nuffc8yLEP7+UMKpIqrEPOdQQ1y/pBDHFCCc0sUQbA1xQct4mFXSQxRVrRFQvgSN6amylhQzqeKBo9GT9jK5RczLBHjGj1sAdBaPm5KMPQthgAa+qyeccW/Hak5N3a00J+9SGCGCMqG7qDZu/lndwQx5l9I2eNctOGDOQNA5YYSZcy/IL+wLdkTcuD8Hjbvzz3TwBLFQieXz1O1wAAAAASUVORK5CYII=>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAaCAYAAACzdqxAAAABTUlEQVR4Xu2TsSvFURTHj1AGQpSUEjGIMsig0FstBhN/ACaDhUiy2JCMNoMURjJYhKLM7EpMspl9vu759bu/wnvpLfT71Kf37rn33XPuufeZ5eT8HypxAEexOopXYJ1/ii7sj8Y/oo22cRkvcTOaG8c3C5s14z2+YGe05lsKuIL1eIX7lla0Y2EzbarYAj5biRtPYw8O4TtOerwR7yybqA3PLCQqmTV8wg4fK9krziYLPLZhJfZY1OIFHmOVxyYsnGDQx0KnmYrGRWnFRwsXmLDoMc0JJVS1yYmEWrKKJzhj2Rf1SXLj6z7WgkPLvoARXLK0De14it0WHoB+3+JzGXR09fQIz3EOr/EG93DXwssRqv7AwqlEDTb49y9RpcqqngtV1+TGF6b2POBwFCsLSn6LfVGs19KCfo2qn8ctCy9F/9Yxj5eFor3N+YN8AOVALxW3IZLhAAAAAElFTkSuQmCC>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAaCAYAAABl03YlAAAAo0lEQVR4XmNgGAXkAnEg9gViOyBmRZNjkADiNUC8HogjgLgOiHcBMT9MgTwQXwHiWQwQ3SCJE0D8Fog1QQpYgHgOED8BYkWIHrBYEhAHADEjSACkEqQDZBVIEisAOfI/EBehSyADTwaIIpBidMAFxMwghiwQ3wbiBGRZIHAC4nVALAwTAJkGcvhqBogPDwBxOxDzwRTAAMjroIAUY4BaMQpIAwAvUBUS5DgSfQAAAABJRU5ErkJggg==>

[image14]: <data:image/png;base64,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>

[image15]: <data:image/png;base64,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>

[image16]: <data:image/png;base64,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>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAaCAYAAADovjFxAAACFklEQVR4Xu2WP0hVURzHv1FBQWH/0IIGCwkbxEEaEhKHloZCxMFwaYlAaAqNQqFFcFCQRnFpaCgb2oqCkAwEBZEokhqiEJ0kCHET/X79ncM77xXcd0CeT+/5wIfHOfde9Hzvud97gUQikcgP9bS7dDIPXKa99APdoM+KD+cDhdBBW+kSchqC5xz9hYgQDtIW2kYPB/MH6HH3KxpoczCuZqJC0KLH6GP6kY4Gx27RP7CFn6Ff6Qq9GJxTrUSF0E4HaA2dps9RuNNPYQtXAJrrp8vYuRAG6e8I39JT21dmExXCXViZXKXrKLxSTtI5FIdynr6BhSJO0xf0O12gU7AgX9NL7pzdIioEzxNYm15wYwWzSu/5E9zcCIo7QWHNwh4dzx36hdYGc5UmOoRjsLv4ih5yc52wnXHFjYV2ye1gLNQX2gkKyNOD8rpDf1f/bLkqVJV4OUSH4C9QOXoeujkdEwpHu8DvFI8WPAVbkNAzq/EDZL9FmmhXhDfo0e0rs4kOwTf/kBvrjfESxXfzGn2Efxc2Qedhj9M7+ok2hifsEj6EsNMy0fZXB0zS9/Q+bEEzsDTHYW+QkNI+UFGqTMN+qDTXYd2mT+ZN5xr9DNt5mWgH1KGwtZWgFib/l6Y+sH6g0Af+jRKW6b6ntA9Ukn/pTdgjdtbN70tO0GG6SH/SPnoE9h3xDfYoSY1zicJQKek3kUgkEnuRLYffbAFm+RW0AAAAAElFTkSuQmCC>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFsAAAAaCAYAAADYMiBQAAAC5klEQVR4Xu2XTahNURiGP6GIEtd/oiSFIhERhVCIlJhIZIBuEgqFgcREREgSycBPJphgICkGSpGBkYFMlMRAGciA9+nb+5591t1n/5xzI7WeetI539rH2u9e+1vrmkUikUgk0jfMlivDLyN9x3x5UL6Sv+Wh5nKkLyHstXK1/GEx7F4MkWPCLzP0k+Nl/7BQwBzrLOwV5r/RCmqM+ScQBBOgRxIeAU01n9DgzLg8Rsm7cm5YMP+dbfKCHNhcKqSTsAeY/3/TwkIGaqfN51eXLvO3j3y4nrzIbUp2UCuGyVtyvzwi38pz8qS8Ju/JQT2j85kgH8t5me/aDRo6CZtWdMY89FZQu2zFqz+P9fK23CxfyEvyjtwtP8glPSNzIJATcnHyeZz8aP6DM+VX+UwOTepFZAPvJGhoN2zmcFNOCgs5MOaqHBsWWjBDXrTG/TC3n3KBPG++oa9LarmMkEetsXJnye/mT44f3SKnJ7UqpIEzqXaDhrph83CXyedyufmiqeIa+TK5tqylbLLGogQeFKem4eYtZauVt9wmCJmbrPt6pTBh2tEXuTCo1aFu2Ix/Iz+Zt74rFWUs13BtnXsmYIK+buUPKRcu4uL0adWF6+ldrOiJ5r0+28PrUDdsYJPfY77XVHmjGMPetN3qnZQgnR+LszJsjoSzQ46U76z5aXEaoVZGNuj0RumF7QbeTtjAPPbJjWEhB4I6YNVXJicOTl20n53W3AFoH2fl6ORzLqvMGzu791L5yxo3yIO4YeVHGibbbb5KwhXVbuBp2IfDQgW6zPcM5t8K/i5gURWNycLx7on8bH5w4J44SBA8bDDf+wof3GT52nwHfyD3yvfmveyh+cZRBhvocesddAqb8Knk3zJ2mfdQFkDqN/ONr3DVBLBvLAq/zMAmyhtQFUI8Jp/K++ZH5EeJnNw4jfBASuEkwo2kfSv8/D/CPRT9bVBWz4PAeWvSY3D4ORKJRCKRSCQSifxl/gB48n/RvG74VQAAAABJRU5ErkJggg==>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEwAAAAaCAYAAAAdQLrBAAAC9klEQVR4Xu2XS8gOURjH/3LJrYQvd/FJ5MtlYSG3BSEibJQSC+VbKEIhsZDYiNwjl0RhQ5LIQlI2ShHFRooSKxuxkMT/3zPjG4+ZMzNvPrx1fvXrbeY5552ZZ855zhkgEmkWetDu/mQkny50D53oA5F8WulZ2ssHmojRdKU/2VnoQuv8ySZgAl1P79Fv9MKv4c6hJz1Dx/hAE6CELacz6Fv8pYSpbp2g3XzgDzKfTvUnMyimNo0ylL5BzYR1hV14Ae0DK+TjYDcSqk0a0kVzfyRdkvyKgXQR7AarohdxDDYailDsAOyeG6F2wvrRy3QL3Umf0sN0Hz1Hr8Omnkf9ztPB7rxufBM9SdfQF3Q/vUi30Zd0/M/WYabRgwiPYMVOITwKQ9RKmB5uL52dHKedr9DJ9AO9T/sm8SzTYYnwb1ajclfmvG5ENUIj4Rb9jGoPN4JeoqN8IAe10Uo9xAcqUCthA2APl46gKfQjXQXbiK6mbUnMs5vO8yfJRth0Fpred+lV2EiYSZfBSkARSvRc+gD2/3qgKi6mD5O+/iWGqJUwjxJVZQS0wC7Q3wccWj3f0+0+EEDXfkLfwUrC6Yqqrfqob9n9Z2k4YXorqkmPUJ6IhbB6V8ZS+oXO8oESNAI1UlVHq3xyqY3q7lqER28etRKmwq1VqB02ap7DkpYOadUjxbIodgT5b1Ex3bSKsOreUfqaDk/ig+gh2js5DqH/2kxX+EAOmhlbUW8qptRKmJb577CVaA79io7po2TqT8YmxymtKP4U0or5CrbSaiV8jI5FQw+jh9LDVUVbkeOweylC19RLDrUJkSZMC0xpwlVj9FBqfAO2HdCyr3pwG1ZAPdp3af+Vh6aGknyT3qEbYFNcRf8a3ZG0qYO2O6EprYVBI7Eu6qfVW59FGjTyE31GJ2Xa/YZWSE2VdO774yzpRjL0KaR+6p+uvP64LuoX6lsW/6doL6WEhTaSkQyhT6GIQ0Veq6P/FIoUMAw2wkpXkkgkEon8f/wA0U58rF+IYr4AAAAASUVORK5CYII=>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAZCAYAAADuWXTMAAAA30lEQVR4XmNgGAUUgSQg3g3EwugShAAHEG+FYhCbJCADxE+AuBVdAh/gAWJJIA4F4t9AHAHE4kDMiqwIF4gH4llAfB+IfwLxUiCeBMTKyIrwAfr7FwZcgPgXlCYJwJy8B4i5GSAB1cUAcQ0IgPigQFwPxL1ALAEVBwMRIL7KgHByEBAXADEjA0TjVCCOhKo7D8SeUHVgAFLUCMR3gHgllA2LJpCN+xkg0cnMAEl5IBoDCEAxMljIQGYggsAcIM5G4oP8K4/ExwtMGCABBXJ+ORBXADEnigoCAK9fRwEJAAAQOB+O+QoQKAAAAABJRU5ErkJggg==>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE8AAAAaCAYAAAD2dwHCAAADM0lEQVR4Xu2YS8hNURiGP7nkfr8kSsgtIrlFGAhRLqWEFEUuZUAU5RZhgJJEhFJEiVBuhTIgKSNKGSgTZWRioDDgfVprdfZZnf7/rLO3HOynnv7973XO8a9vre/d6zArKSkpKSlpgHXysewTD/yjjJGv5Kx4IJWO8r6X62aii2wf3yyATfKzuSLmYrD8KI/EA03ADPlMbjVXyCJoI6+a23m9orG66SoHyuXyh1wpB9jvWek8tJVzzBXxuDUeLcyL+Y2V7+Qlc/OnDsmsleflB/nN3GqcksOzL2oi2DHT5FN52tzEUxgvz8lH8qf/yfyXZF+UQt68GyYXxDdrMEIuNleAvPAZFOKhvClHVQ+3SlPkXX950urf9ivksvhmTigcBbzlr1ujkLwLzJXf/c9U9lh9uy7QQ140V/QiGWqueLdlz2gspq98ay6ecrNbfjLXfikQvJctffUOWY6MiWCn3fDWs+tgivwqV8cDqYS8e2KV89Qxc60ME+R+c087wnmfnO3HZsoLVsmwdnKjuUAm31gUMmm+Hw8sNNfqjRLy7p65f59dlwJ598Xc3GCVXOqv+Ww66Yq5J/FIf78mYQuHvCOPtlmlILv8GIVaL0/IyX6M11KgwES5yFyenJWd5CR5x6ozkXvXLP3hVNRxhXYNeTfE3N9KnDDnnebmxEYiArb799SENxyU7+V1fx3OeOwkgpjzEKsVT5bCYoAcY6WemysQ0J53rfq9tQraEhSNnfFS7pXdq4eTYSMQU8yX+YUumy7fyEHm6tLb6jzvErJx0PIhL+RUc6322tzuClDQbPGAwvD9mFXlD+AsxuuypBZvsxX77QJYTBabhQkwF4rJpskNK/TA3CSRa+5xsKbdObPx5MxCCJMVFI7i02Lj5A6r7L44K5sFWvRM5ndaeXTm9yT4sAP+mtUg75D/fQEOmBQq25Kc1vmKB7QDxwceOCGcgQK3mCV/CPKPnFsjt8ij5lq3ITpYdc+zU7KtwwOB4mWPOJ2tuhV4P58TYBFYXXZjM5KUdXmZZ+7pXC8U7bAVlCt/O6zUBqscX1qCDOFp3i8e+J+hTbvFN2tANsbHnZKSkiR+AWaVeVr+JBfDAAAAAElFTkSuQmCC>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAZCAYAAADuWXTMAAAA30lEQVR4Xu3SPwtBURjH8UfYUGxKvAKjxVswKJPd4hXwUpRFJm/ApqSUkZJBNsVCsUgZxPc657jXyf9RfvUZ7j3Pwz1Pj8g/Zaxw8jhigrSn7mkSWKCH0O3R65jmPsLW2d1EUMEUHRywxlDUj+Tgv1Z7khJ1ry5iiGMu7mdnsUENQdWiEkBL1HAK+p3d7END1xR1zSWmcI+M9a4n7sCqopqb+vmST/+5pGuueefOW9TFurOJmfYMbXGn7Ux6hLw8mLadJJYYIGqdvcxXG+bsttPk7LPZ7R3G8sFu//NbOQNL7DubgtaDXgAAAABJRU5ErkJggg==>

[image23]: <data:image/png;base64,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>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGgAAAAaCAYAAABb9hlrAAAE60lEQVR4Xu2ZachtUxjHH6EIGSMhLjcl11CG3IwJ8cGQIVd8vF1EkbGkvJJSfDCLlKEkQ1EyhHiLzJ90dUUyZEhCKUoy/H+es3rXefZa++x9zts574fzq3/ve9ba++y11jOsZ69jNmfOnNmypbR9bBzBOPesRLaVtoqNFfpc25ltpFOk/aXNQh+wyA9KR8aOEWCgO6WzY8cKYmfpNGmv2DHgUOkRazoaRtjNfI45e0vPDv4uC3zRW9Jt0nfSycPdtoV0n3RJaO8KC/CS9TfuNDhcel+6XfpaOnC42/aU3gztq6WN0r/SD9K+WV/iWOl5axp1LBbMDXSr+UPXDfW6wRZtsoedKr1qHv4rBRzvSekJ6XHpT2lt1k8mIfoXsrYE0fOi+bqU5sS990rXx46+7Ch9KD0s7SIdIm2e9W8tvSJdnrWNA8Z9x5rGnyV4PhFwlXkWiel9jfTp4G9kD+krc6eugbE3SatiRx8OkH42H2SJw6TPza+bFCZDbsZzVwInSX+b7z8l8H6ipLThp3vPiB0ZyfkvjB1d4KG7m9/Mg/BsPsdwvdg8/W0X2nPYJMnlxw3+r8FCkOfJ67OEOTLXm6TfpBMGn3NDpBR2Q9aWg/GIvoPNi6tjbDjzJMhMpNBS4dXK0dJD0kfmuZcv4fMR+UXisYFqHC99LF0tXSa9K/1qZa8kGr+15jOmzXnmc/1S+sm8Qrtb2i+7BoPhTKdnbYlkPNaNAgInZ41etuY+jSFHOXgrfDFhSDhG8LRFq+dZqrIfpfOzNq793dwYkbZJ51wgfdNDOBmVVR/S3Gopl/EzNyIjkvaf123JIFxPNMaUx1yZM3PvDVbFurVBpkmUKpHU954New0h/Yl5wRFJBhorJy8zpFmiueZ8LDjGLzkaRiN6cmNwHY4Z1woD1UrxkaRB1vJsm4HYJP+x4QmmTZGUUcq5yUC1gmSakGb/sPoLdJuBWA8Kq7xwwul4RYlzw0BEFtVxb/CEv6yectoMRBsGwlAJBsFgKCxKdE1xqYDpqtLb/ChY0FoqhjYDsS3EfYU9jKham7XBRCmOhWyzLmmP9EfaimCgeC+TxivxTvalc7I+IMy/t3IBkcM7ybk9dKa00/93docF/cLcuCXaxhoLJ75jk/S0NR2FNWl7TisMsrZfJLim9C7AycAvtuRhLOpn5t7CmdY91nx3wnAMNrZPm1SFleaVYE1Ym1I2WLClfZtUfp25gUpnb2wfbc+pwuEoVUitQEiwEW60phHxlDukt8296QXziCEtcO52pTX3Ibxp0ZrvWtMGb8ZRagUCMPZUfkfYu98wXzvmuijtk/UnUgYqbREjSQVCyUNyVpkfd5TKTdjB/DA0GQNPyT8nGCznXguhfRYQybyr5ftnCV7eP7DyKwjzY57MvwZrR2TFfakKX4pnvyadZW6gNUNXNOGeW8wP/uKi92G1eUnO31lAxN8lPSqtN1+4UfsCBiBDkM7H4SLpKWvuS1V2Nd8nKIXvlx6w9vSWINrikXsfMOzN5rl6EiNPwkHmUcNPAM+Zn3x0gRT/jPmhcR8wbu+fWFicS83Dlk08Hku0wYOoUvrck+C3EXLxOPcuF3gxmYC53zj43AXW7NqBujoX1y2YO0HXe5aFE6UrYuMIOBZhM56lcSYFY14jHRU7KnB4usGmbJw5c+bMmTNnXP4DcEPu9RxfYUQAAAAASUVORK5CYII=>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADUAAAAaCAYAAAAXHBSTAAADQklEQVR4Xu2XTahNURTHl1DkOyIinhiIQj6ifCWJRAYKkQGFAaWQGN1IGPiMlJQMkBiYoFAUA2GkfBQS+QihDAwo/H9vn93bZ5977j33uZfJ/dev895e5+6719prrb2vWVMNVW+xSYwRI8VKMST1xn9Ud9ElHiyggeKV+C3eiqWiQ2Bv77wZ9RVzxRIxSnRMmzMaJ06JXrGhgHBqVzwYaKi4mDxrFtGZIe6Jq2JFwjXxTExqezWlweKmGB0bCgqn9ohpYqHomTa3arq4ZDUGrbPYJ15advHYToivYnxkIxCHRCkar0U4xYKpJ7hs2V3he46KbdF4rlj0cfFFTI5sXqTgZ3MTh/lOcT9NnvUQc5+x8kGaKp6IlthQTuvFr+SZpz7ivngk+gXjRI7I/k0hLxAnzTUEdDohll8DJVFRI8Q7cxEYENlC+QnpUqQLwhEc2uFfCkRjoUYmJH+zA8PEYss2njVir7mM8XNuCOyhcJ6dDLMlo5K5Vro7Go81XLy3tFO+FVPcsTaKneKxue84Zq7DrRLPxX5rWxid9qA5h3mHRec1BDLjtugRG7zY7lvmUm9O2pQRdt4LJ2QXPpjbkVDs+GHR39z8NJiwVkktxn26IXaJz+FgpV0ggGFgM/KRpgGQEpV0xNyOloIxnHqdPENNFMvNtfo35rqqX6hPrxuiWzJWi3CKjCFzyso7VdFzc1cWzqlPlj6L8pzyYnd/JE+vFnOOVkv3POHUNzE2NnjRxehmlZwiwtvN7dLmyFbNKRpIHNVl4ru59tweVU2/TuKc+GnZuvCiFqgJDl/yPhSLpXPOj8ZRuTTz33fXXCNYLWYmtqKinb+wyp269YbAorm3xYueLT6KA6JrZEN+p9fFBmurpzDNfLqzgzQR2nNel8sTny10LnItos1y5/P3Pe5+D805lteNGCcYNJFYpBfBmhWMEbSz4oG4bq6h1CJ2mott4asShyEdkFs5eTvI8p0JRY0QDA7nUMzHWDwH/9O2q0a6jGgyXBLaW4+FxQLviHmxoQHix+N5y5ZJQ7RIXLDydVcvEbwrln/hrrtIqa0JcbrVQ8xZMnekNGL+XJESW8SU2FAH8Qt8rf1jh5pqqimzPxSgjuIyKkMjAAAAAElFTkSuQmCC>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAAAaCAYAAAA38EtuAAAE6klEQVR4Xu2YachtUxjHHyFkzo1MGUKJuleGS8aE+EBCIaL44EY+mIekE0nGjF2JRKEM+YCuEEIImcpQSCRCKOEDGf4/az/3POc5a5997nuP13E7//p33netvfd61n89095mM8www2isJ66dB1chrC5uLK6WJ1YGm4iHiceJO1tZZBQWifeIG+aJOYCNsD4HN03ArvPEc5q/5wxuPkB8XVwmntTwafFjcc/+pQPYSnxe3CVPzAFniX81vCjNTQPWFO8Tj80T44IHXCN+ZsOCMnen+KO4W5rjcG4Se2l8ZbCj+K1Np9BgV/FVces80QWEXCr+IO6V5hykj+/F22wwbFj0o+Z3Uthc/NymV+g1xAdtDs61RPyz+W0DReAN8X1xQRhHjCdtskVw2oUGpFT0QJexsIP4lfihuFmai3ChEQAhAOIi8qV+UQDFcz9x9+ZvomBb8WjrLq6jhCZcTxXPFXey4aIU16HerCUuFm8U9+1fthxcv9DKtUQ2QIcjxT3CWAb3YGNOs63oWSk8V6XxjO3Fr21QaBcEozLOFq8QP7Cyxu3ileIp4ifiDTYskqMmNBu+THzOyibJ44Qvnc664ZrrxbeseNzV4s/iteJD4r3NdRHYfp34oni3eLmVNHqC+Ir4qLjO8qv7cBuPyRM10D69YCVtHDI4NQTmue4lcf1mDG/9xornRuARN4ubWnk+RTTmfjbMeFv7VhOatPallQh00ALSIVGMObTDxV+sbw92Yu9j4kY2nN4QEDuxF5v+sMFugvWjY0W4drWoG4JviCJHOI/CLVY8vxfGEPqL5jeCkDvRStuHOHQz7r2ebp61vidmZKGpCdSGWi1AICKNiON6hHZ7XIxPrZ4WSUP0xPT+fiAxVbDntnv92V2Z4B/4htpOzYFB9NHf2WCv3Ca0gyj4rfl1bGdF/FEGZqFJFT9ZPfQZwwGOEA8VfxePaubco0kxdApt8I7qjDCG+K+Jj1j9Xhf6rjRehXvKKKHxxEusbIa3ooguoSmS7m0Oct+v4j5hLCML7ULUNo3QiEu6IEKWWSnsZ1oRmNRCZI0Cedaf4cA+7MTeGlYodWA0xuRFIsit5FheWHIFRkA6Frwpo5YifD08BY85TTywmYvIQrt3xfoAeB7iIyzhzYHfamVtnkGNGNXdOGopomcl8ohAIoXiGuFdGN3PWOBNDyGp3lnIg628odEa1SqvR0QMOYfn55giXEA8HREIu9q3kSw0IB1g5/5hjMLIGt7/k2LoaHiN5xsN5HsNRbMNnl5itLi33m/FSZZaETyC/XE4MS12gl4QAwkz/75BCL5nRWzSRw2Mc0B4RAahhzAHhTEO8gHxTfEZK0UzA9Foyfx7B6+6HAprYcs74sNWUgY2H9/MgQ3Ex61/byRiZUcC21g5rNPDGM/rWXn+U1Z68gwyAE62ZZ7oAiFGLsQL6C23sHaBI8hhHFB+Q2r7pMj/eFjuHsaF35/TAt6ImERJjD7EpXenmNa8j+dhZy3F0BK2taA96y6yEwWbftlKD/tfgvxKKNdenjw9jJ1PO8CeeXGKaWxeQP4knGt5fL6AZ15oJbp4a3Rg08Xiu1bSxCRwsniH1VPRvwo2eUHDnCrmE6y9WHxCfLshAnMA5O9JgAJM/ZrUoa0wON3zxb3zxCoEUhBdVFdfPsMMM8www/8EfwOV6vpM31zPgAAAAABJRU5ErkJggg==>