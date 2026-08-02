# **Architectural Specification for Generational Parent Pool Evolution and Provenance Lineage in Model Breeding Schedules**

The paradigm shift from training static machine learning architectures on isolated datasets to continuous, open-ended neuroevolution, population-based training, and systematic model breeding has introduced significant engineering complexity.1 Within this operational landscape, trained parameter matrices are no longer viewed merely as static weights of a mathematical function.3 Instead, they are treated as structured data points residing within a continuous, high-dimensional weight space.3 This weight space exhibits its own geometric constraints, symmetries, and functional regularities that can be modeled, mapped, and mathematically navigated to synthesize novel capabilities.3  
To govern this process at scale, metadata lineage systems must track how metadata about these data assets is captured, propagated, and versioned over generations.5 Without detailed point-in-time reconstruction of evolving parent pools, AI operations are vulnerable to silent data corruption, unidentifiable model degradation, and audit failures under emerging global AI compliance frameworks.5  
This report provides a formal technical specification for managing metadata within model breeding schedules, defining parent relatedness metrics, multi-objective fitness structures, behavioral novelty algorithms, weight space operators, and schema-gated provenance receipts.  
The operational and governance requirements of a modern model breeding pipeline require a clear division between data lineage and data provenance, as detailed in the comparison below:

| Architectural Dimension | Operational Data Lineage | Historical Data Provenance |
| :---- | :---- | :---- |
| **Primary Objective** | Tracks the flow, movement, and system-level transformations of data assets from source to destination.8 | Documents origin, chain of custody, authorship, and standard compliance to verify authenticity and trust.8 |
| **Granularity level** | System-level, table-level, and column-level flow paths (e.g., dbt transformations, type casts, schema migrations).5 | Record-level metadata, including creator, reviewer, exact collection conditions, and applied governance policies.5 |
| **Target Audience** | Data engineers and MLOps personnel performing pipeline debugging and impact analysis.8 | Compliance officers, model auditors, and regulatory bodies requiring proof of safety and provenance.6 |
| **AI/ML Relevance** | Maps feature pipelines to model inputs, showing which tables feed specific training runs.6 | Proves the origin, license status, and validation history of datasets and ancestral models.6 |

## **Schedule Orchestration and Hierarchical Execution IDs**

Model breeding schedules operate as distributed, hierarchical workflows executed across multi-tenant GPU environments.13 Managing the parent pool over generations requires representing these schedules as parent and child runs.15 Within this architecture, the overall breeding schedule is assigned a unique, immutable Schedule ID.15 This ID is logged as a Parent Run inside a centralized experiment tracking engine, such as MLflow or Databricks Unity Catalog.15  
Each distinct generation ![][image1] or hyperparameter optimization loop is executed as a nested Child Run using the nested=True programmatic context.15 This hierarchical arrangement ensures that the parameters, scores, and parent-child relationships of each generation remain bound to the overarching schedule.15  
In practice, executing nested runs in custom experiment locations can cause child runs to dissociate from their parents in the graphical user interface.17 This occurs because child processes may resolve a different experiment\_id associated with local workspace directories.17 To prevent this UI dissociation and ensure complete lineage, the orchestrator must programmatically retrieve the parent's experiment\_id during initialization and explicitly pass it to the child runs.17 The parent\_run\_id is then stored in the child's metadata search space.17  
This pattern maps directly to the OpenLineage object hierarchy.18 Here, the Job represents a static, design-time lineage mapping (such as a template model breeding schedule), and the Run represents a specific, time-bound execution of that schedule.18 Each Run is assigned a universally unique identifier (UUIDv4) that acts as the anchor for all emitted lifecycle event metadata.18

## **Theoretical Genetics, Pedigree Metrics, and Realized Relatedness**

Managing a parent pool requires monitoring the genetic variation, coancestry, and inbreeding rates of the candidate models.21 In early evolutionary algorithms, genetic metrics were computed post-hoc from simple pedigree tables.22 However, using only pedigree information introduces significant upward bias in heritability and genetic gain estimations compared to using genome-wide distributed molecular markers.22  
To prevent this bias and control inbreeding depression, modern model breeding systems utilize both pedigree-based relationship models and marker-based realized genomic relationship models.21

### **Pedigree-Based and Marker-Based Matrices**

The pedigree-based relationships are represented via the standard Numerator Relationship Matrix, or ![][image2]\-matrix, whose inverse is used in solving mixed model equations to compute genomic-estimated breeding values (GEBVs) via Best Linear Unbiased Prediction (BLUP).22 The mathematical structure of the ![][image2]\-matrix is defined such that its diagonal elements represent ![][image3], where ![][image4] is the inbreeding coefficient of individual model ![][image5].22 Its off-diagonal elements represent twice the coancestry coefficient between individual models ![][image5] and ![][image6], tracking the probability of identical genes by descent.22  
For high-dimensional parameter spaces, the standard pedigree-based ![][image2]\-matrix is replaced by the marker-based Realized Genomic Relationship Matrix, or ![][image7]\-matrix.22 This substitution enables Genomic Best Linear Unbiased Prediction (GBLUP) or single-step GBLUP (ssGBLUP) models to blend genotypic and pedigree signals.22  
The ![][image7]\-matrix is computed using centered allele content and origin matrices derived from the model parameter snapshots.24 Software frameworks such as the R-package SimpleMating consume these matrices to execute optimal cross selection.21 This optimization maximizes a target performance criterion (such as the mid-parental value or cross usefulness) while applying hard constraints to coancestry and the maximum allowable parental relationship.21

### **Decentralized Phylogenetic Tracking via Hereditary Stratigraphy**

While centralized relationship matrices are effective for local populations, they become bottlenecked in distributed, large-scale parallel simulations.25 In systems where model lineages migrate across independent processing nodes, maintaining a centralized record of every birth, mutation, and termination introduces extreme communication overhead.25  
To resolve this limitation, the system integrates **Hereditary Stratigraphy** via the hstrat library.25 This decentralized technique allows phylogenetic history to be inferred post-hoc from heritable, neutral genetic annotations—termed *hereditary stratigraphic columns*—attached directly to the model genomes.25  
At each generation, an active model appends a new chronological marker, known as a *differentia*, to its stratigraphic column.26 When offspring are generated through mutation or crossover, they inherit this stratigraphic column.25  
Because appending a differentia at every step would cause the columns to grow indefinitely, the library implements a **stratum retention policy** to systematically discard older strata.27 This policy manages the trade-off between annotation memory footprint and historical inference accuracy.25  
For example, a recency-proportional resolution policy downsamples older historical records while maintaining fine-grained resolution for recent generations.25 This allows annotations to fit within tight budgets (e.g., 64 bits per column).25

### **Distance Reconstruction**

By comparing the stratigraphic columns of two extant models, ![][image8] and ![][image9], the system reconstructs their shared evolutionary tree.25 Divergences between differentia values are used to estimate the generation of their Most Recent Common Ancestor (![][image10]).25  
The pairwise distance ![][image11] is computed as the shortest path between the two models on the reconstructed phylogenetic tree 29:  
![][image12]  
For synchronized generations where ![][image13], this simplifies to ![][image14].29 In trie-building and tree reconstruction, missing marker time points resulting from the retention policy act as wildcard characters, requiring the reconstruction algorithm to evaluate multiple diverging string paths to resolve downstream relationships.26  
The different tracing and tracking methodologies are compared below to highlight their trade-offs in distributed parent pool environments:

| Feature / Metric | Pedigree A-Matrix Models | Realized Genomic G-Matrix Models | Decentralized Hereditary Stratigraphy (hstrat) |
| :---- | :---- | :---- | :---- |
| **Tracking Source** | Ancestral pedigree logs.22 | Center-allele and multi-locus genotypes.22 | Heritable stratigraphic column annotations.25 |
| **Accuracy** | Lossless relative to logged entries, but prone to pedigree errors.22 | Exact genomic relatedness; accounts for Mendelian sampling.22 | Approximate; bounded by the stratum retention policy.25 |
| **Memory scaling** | **![][image15]** where ![][image16] is the historical population size.22 | ![][image17] where ![][image18] is parameter size and ![][image16] is pool size.24 | ![][image19] where ![][image20] is a small constant (e.g., 64 bits) and ![][image21] is pool size.25 |
| **Compute Location** | Centralized database.27 | Centralized model registry/feature store.13 | Fully decentralized; calculated peer-to-peer.25 |
| **Network Overhead** | High; requires global logging of all birth/death events.27 | Very high; requires transferring entire parameter tensors.30 | Zero during simulation; columns are bundled with the model weights.25 |

## **Multi-Objective Fitness Vectors, Performance Gates, and Explanatory Analytics**

Model breeding systems operate under continuous resource constraints, making scalar fitness evaluations deceptive and insufficient.2 Instead, the breeding schedule evaluates candidates using a multi-objective fitness vector ![][image22]:  
![][image23]  
These objectives are derived from target execution environments and subjected to hard performance gates to filter viable parents.2

### **Benchmark Environments and Evaluation Gates**

In population-based training and evolutionary recipe optimization, several standard task environments provide the metrics and constraints used to construct these fitness vectors 2:

* **Parameter Golf**: This environment evaluates models on fine-web datasets.2 The primary fitness objective is to minimize validation bits per byte (bpb).2 To remain viable, the model must satisfy a strict size cap (![][image24] MB) and execute within a tight computational budget (![][image25] minutes on 8 H100 GPUs).2  
* **NanoChat-D12**: This setup measures a model's CORE pretraining score, targeting a baseline of 0.1618 CORE.2 The main fitness objective is maximizing computational efficiency within a fixed wallclock budget.2 Speed gains are translated into training on more tokens to improve final performance.2  
* **CIFAR-10 Airbench96**: This environment rewards minimizing cold-process execution wallclock time.2 Crucially, the wallclock timing is subjected to an accuracy gate.2 A model's score is considered valid only when its mean accuracy reaches a minimum threshold (![][image26]).2

### **AutoML Optimization and Explanatory Analytics**

During parent evaluation, AutoML tools are deployed to automate data preprocessing, neural architecture search, and hyperparameter tuning.32 For instance, frameworks like AutoKeras split datasets into inner training and inner validation sets to optimize hyperparameters before predicting on an outer validation set.35  
To prevent target leakage and ensure explainability, the evaluation pipeline integrates game-theoretic metrics.34 In classification and regression runs (such as those orchestrated via Databricks AutoML using PyPI's databricks-automl-runtime), SHapley Additive exPlanations (SHAP) are calculated to estimate the impact of individual features on model predictions.34  
These SHAP values are logged directly as part of the parent's evaluation metadata.13 This step ensures that any target leakage is identified before deployment, making the entire evolutionary process reproducible and auditable.13

## **Behavioral Space Modeling, Dominated Novelty, and Diverse Exploratory Search**

A major limitation of purely objective-based selection is its susceptibility to local optima.31 To address this deception, the breeding engine integrates **Novelty Search**, a paradigm that prioritizes behavioral exploration over direct optimization.38  
Each candidate model is mapped to a low-dimensional descriptor vector ![][image27] within a continuous behavior space ![][image28], representing the observable output of the model.38 In a classic novelty search, the novelty score of a model ![][image29] is calculated as the average distance to its ![][image30]\-nearest neighbors within the active population ![][image31] and an archive of past novel behaviors ![][image2] 38:  
![][image32]  
where ![][image33] represent the ![][image30]\-nearest neighbors in ![][image34] based on a behavioral distance metric, such as Euclidean, Manhattan, or Hamming distance.38

### **Dominated Novelty Search**

Traditional quality-diversity algorithms (like MAP-Elites) rely on partitioning the behavior space into predefined grid structures.42 This discretization requires knowing the bounds of the behavior space in advance, which is impractical in unsupervised quality-diversity systems where the descriptor space is learned dynamically during evolution.42  
To overcome this, the breeding engine implements **Dominated Novelty Search**, an unstructured algorithm that structures local competition without requiring predefined grids or fixed distance thresholds.42  
Dominated Novelty Search executes through a three-step dynamic transformation 42:

1. For each model ![][image5] in the population, the system identifies all models that exhibit superior objective fitness 42:  
   ![][image35]  
2. The pairwise distances in the continuous behavior space between model ![][image5] and all fitter solutions are calculated 42:  
   ![][image36]  
3. The competition fitness ![][image37] is computed as the average distance to the ![][image30]\-nearest fitter solutions 42:  
   ![][image38]  
   where ![][image39] is the set containing the indices of the ![][image30] solutions in ![][image40] with the smallest behavioral distances ![][image41].42 If the count of fitter solutions is less than ![][image30], all available fitter solutions are used.42

This formulation creates dynamic, self-organizing niches within the parameter space, allowing promising but currently underperforming models to survive if they explore unique behavioral regions.39

### **Alternative Exploratory Strategies**

The framework can also utilize alternative search techniques 41:

* **Evolution-Guided Reinforcement Learning (ERL)**: This hybrid approach periodically inserts deep reinforcement learning agents into the evolutionary loop, reusing historical off-policy samples to improve diversity and sample efficiency.43  
* **Surprise Search**: Rather than measuring absolute distance to historical points, surprise search evaluates the deviation of a model's behavior from local prediction trends.41 This strategy has been shown to produce greater behavioral coverage and more robust navigation in complex environments.41

The primary features of these exploratory search strategies are compared below:

| Search Strategy | Core Selection Objective | Archive Type | Space Constraints | Optimization Bias |
| :---- | :---- | :---- | :---- | :---- |
| **Grid Search** | Systematic parameter enumeration.13 | None.13 | Predefined parameter grid.13 | Localized; prone to deception in complex spaces.13 |
| **MAP-Elites** | Local cell-level competition.42 | Structured multi-dimensional grid.42 | Requires predefined grid bounds and cell sizes.42 | High; constrained by structural discretization.42 |
| **Dominated Novelty Search** | Distance-to-fitter-neighbor optimization.42 | Unstructured dynamic archive.42 | Unconstrained; bounds are learned dynamically.42 | Multi-objective; balances performance and novelty.42 |
| **Surprise Search** | Prediction-deviation maximization.41 | Dynamic expectation history.41 | Unconstrained; continuous behavior space.41 | High exploratory focus; escapes local optima.41 |

## **Weight Space Representation, Merging, and Interpolation Seeds**

Generating descendant models from selected parent pools requires operators that can recombine neural network parameters while preserving functional properties.3 Weight Space Representation (WSR) and Weight Space Generation (WSG) provide the mathematical frameworks for direct reasoning and manipulation of models as geometric objects.3 This allows for operations such as model retrieval, model editing, and evolutionary model merging.3

### **Backward Compatible Weight Interpolation (BCWI)**

When a model is updated to incorporate new training data, standard retraining can introduce negative flips, causing previously correct predictions to become incorrect.44 This regression and prediction jitter can be mitigated using **Backward Compatible Weight Interpolation (BCWI)**.44 BCWI interpolates between the parameters of the ancestral base model (![][image42]) and the newly optimized model (![][image43]) 44:  
![][image44]  
where the interpolation seed weight $\\alpha \\in $ determines the blending ratio.44 By moving the new model closer to the old model post-training, BCWI reduces the Negative Flip Rate (NFR) over evaluation datasets 44:  
![][image45]  
This formulation minimizes prediction churn without sacrificing the performance gains of the new model.44 This post-training weight interpolation differs from online weight regularization techniques such as Prior Weight Decay or Mixout, which adjust the weights at each training step.44

### **Diffusion Crossover and Evolutionary Model Merging**

For generative models (such as Denoising Diffusion Probabilistic Models), linear interpolation of weights can lead to out-of-distribution artifacts.45 The engine instead utilizes **Diffusion Crossover**, applying Spherical Linear Interpolation (Slerp) to the step-wise noise sequences (![][image46]) in the reverse denoising process 45:  
![][image47]  
where ![][image48] represents the angular distance between the parent noise sequences.45 This ensures that the generated offspring inherit structural characteristics from both parents while maintaining the geometric properties of the diffusion manifold.45  
To scale model breeding to consumer-grade hardware, evolutionary model merging frameworks such as MERGE^3 and Mergenetic incorporate lightweight fitness estimators.30 These systems extract a reduced dataset for evaluation and estimate candidate model capabilities using **Item Response Theory (IRT)**.30 This IRT-based performance estimation reduces fitness computation costs 50-fold, allowing the evolutionary search to proceed on a single GPU.30

## **Promotion Lifecycles, Failure Auditing, and Unified Lineage Feedback**

Managing the parent pool requires a structured promotion lifecycle governed by state transitions.2 Candidates are processed through several states to determine their suitability for the parent pool 2:

                       \[ Unvalidated Candidate \]  
                                  |  
                                  v  
                        \[ Validation Pipeline \]  
                                  |  
               \---------------------------------------  
              |                                       |  
              v (Executes Successfully)               v (Fails Validation)  
                                
              |  
              v  
       \[ Evaluation Gates \]  
              |  
     \-------------------------------------------------  
    |                      |                          |  
    v (Passes All Gates)   v (Misses Performance Gate) v (Violates Size/Time Limit)  
                       

* **PROMOTED**: The candidate passes all performance gates, size constraints, and latency budgets, and is added to the active parent pool.2  
* **NEAR\_MISS**: The candidate executes within resource constraints but fails to meet a performance gate (e.g., scoring ![][image49] accuracy against a ![][image50] threshold on CIFAR-10 Airbench96).2  
* **BUDGET\_OVERRUN / SIZE\_FAILURE**: The candidate violates resource limits, such as exceeding the 10-minute GPU budget or the 16 MB size cap in Parameter Golf.2  
* **CRASHED / FAILED**: The candidate run encounters execution-level errors or system failures.2  
* **EVICTED**: An active parent is removed from the pool to accommodate a more fit or novel candidate.38

Traditional hyperparameter optimization and neural architecture search frameworks treat evaluations as independent trials.2 In contrast, a breeding engine with **Lineage Feedback** utilizes the cross-trial history—including crashes, overruns, and near-misses—to guide subsequent generations.2  
Near-misses are kept in the lineage history rather than discarded.2 This ensures that fast, near-compliant models can be used by the mutation operators to guide recipe edits, converting historical failure states into informative search steps.2

## **Schema-Gated Provenance Receipts and OpenLineage Integration**

To establish an auditable record of the model breeding process, the orchestrator generates a **Provenance Receipt** at each generation.14 These receipts integrate the W3C PROV-DM conceptual model, the SLSA Provenance v1.0 specification, and the OpenLineage custom facets framework.14

### **OpenLineage Custom Facet Architecture**

In OpenLineage, custom metadata is structured as a custom facet.19 This facet is defined as a JSON object and attached to the run, job, or dataset entities.19 To integrate model breeding metadata, the system implements a custom run facet:

* **Naming Conventions**: The facet class is defined as ModelBreedingScheduleRunFacet.19 In the OpenLineage event payload, the facet is represented as a snake\_case key: model\_breeding\_schedule.19  
* **Mandatory Keys**: To be accepted and stored by compatible backends (such as Marquez), the custom facet must inherit from BaseFacet and include the \_producer and \_schemaURL properties.50  
* **SDK Implementation**: In Python, the custom facet class is implemented using the @attr.define decorator, extending BaseFacet and overriding the static \_get\_schema() method to return the versioned URI of its JSON Schema 50:

Python  
@attr.define  
class ModelBreedingScheduleRunFacet(BaseFacet):  
    schedule\_id: str  
    generation: int  
    parent\_pool\_metadata: dict

    def \_\_init\_\_(self, schedule\_id, generation, parent\_pool\_metadata):  
        super().\_\_init\_\_()  
        self.schedule\_id \= schedule\_id  
        self.generation \= generation  
        self.parent\_pool\_metadata \= parent\_pool\_metadata

    @staticmethod  
    def \_get\_schema() \-\> str:  
        return "https://raw.githubusercontent.com/openlineage/facets/1-0-2/ModelBreedingScheduleRunFacet.json"

To ensure backward compatibility and prevent client code generation failures during compilation, any modifications to the facet's schema must bump the version number in the $id URL (e.g., from 1-0-1 to 1-0-2).51 All changes must be validated locally using prek run and committed with GPG signatures (git commit \-s).51

### **Upstream Parser Extraction and Bounding Box Grounding**

To prevent target leakage and document the origin of the features, the lineage system utilizes abstract syntax tree (AST) parsing.5 The parser reads upstream SQL queries, dbt models, and feature extraction scripts, converting the source code into syntax trees to map column-level dependencies before training occurs.5  
To support rigorous audits, the provenance receipt incorporates grounded-extraction metadata based on the Reducto standard.52 This grounds all extracted parameters with calibrated confidence scores and source citations.52 For document-based sources (such as model cards or papers), citations use normalized coordinates (value, confidence, page index, and bounding boxes).52 For tabular data, citations map to 1-indexed spreadsheet coordinates (sheet index, row, column, and cell spans).52

### **JSON Schema Specification**

The complete, schema-gated structure of the breeding run receipt is defined by the JSON Schema below. This schema integrates SLSA v1.0 parameters (identifying the trusted build platform and resolved dependencies) with the HDI-Project model-provenance-json standard to document predictions, features, data splits, and modeling budgets 14:

JSON  
{  
  "$schema": "http://json-schema.org/draft-07/schema\#",  
  "$id": "https://raw.githubusercontent.com/openlineage/facets/1-0-2/ModelBreedingScheduleRunFacet.json",  
  "title": "ModelBreedingScheduleRunFacet",  
  "description": "JSON Schema governing generational parent pool metadata and evolutionary model breeding provenance.",  
  "type": "object",  
  "properties": {  
    "\_producer": {  
      "type": "string",  
      "format": "uri",  
      "description": "URI of the generating metadata producer."  
    },  
    "\_schemaURL": {  
      "type": "string",  
      "format": "uri",  
      "description": "Versioned canonical URL of this schema."  
    },  
    "schedule\_id": {  
      "type": "string",  
      "format": "uuid",  
      "description": "Schedule ID logged as the parent run."  
    },  
    "generation": {  
      "type": "integer",  
      "minimum": 0,  
      "description": "Evolutionary generation cycle index."  
    },  
    "slsa\_provenance": {  
      "type": "object",  
      "required": \["builder\_id", "build\_type", "external\_parameters", "system\_parameters", "resolved\_dependencies"\],  
      "properties": {  
        "builder\_id": { "type": "string", "format": "uri" },  
        "build\_type": { "type": "string", "format": "uri" },  
        "external\_parameters": { "type": "object" },  
        "system\_parameters": { "type": "object" },  
        "resolved\_dependencies": {  
          "type": "array",  
          "items": {  
            "type": "object",  
            "required": \["uri", "digest"\],  
            "properties": {  
              "uri": { "type": "string", "format": "uri" },  
              "digest": {  
                "type": "object",  
                "additionalProperties": { "type": "string" }  
              }  
            }  
          }  
        }  
      }  
    },  
    "hdi\_provenance": {  
      "type": "object",  
      "required": \["prediction\_engineering", "feature\_engineering", "data\_splits", "modeling\_budget"\],  
      "properties": {  
        "prediction\_engineering": {  
          "type": "object",  
          "required": \["target\_variable", "prediction\_type"\],  
          "properties": {  
            "target\_variable": { "type": "string" },  
            "prediction\_type": { "type": "string", "enum": \["classification", "regression"\] }  
          }  
        },  
        "feature\_engineering": {  
          "type": "object",  
          "required": \["method", "parameters", "training\_window"\],  
          "properties": {  
            "method": { "type": "string" },  
            "parameters": {  
              "type": "object",  
              "properties": {  
                "aggregate\_primitives": { "type": "array", "items": { "type": "string" } },  
                "transform\_primitives": { "type": "array", "items": { "type": "string" } }  
              }  
            },  
            "training\_window": { "type": "string" }  
          }  
        },  
        "data\_splits": {  
          "type": "array",  
          "items": {  
            "type": "object",  
            "required": \["id", "start\_time", "end\_time", "label\_search\_parameters"\],  
            "properties": {  
              "id": { "type": "string" },  
              "start\_time": { "type": "string", "format": "date-time" },  
              "end\_time": { "type": "string", "format": "date-time" },  
              "label\_search\_parameters": {  
                "type": "object",  
                "required": \["offset", "strategy", "examples\_per\_instance", "gap"\],  
                "properties": {  
                  "offset": { "type": "string" },  
                  "strategy": { "type": "string" },  
                  "examples\_per\_instance": { "type": "integer" },  
                  "gap": { "type": "string" }  
                }  
              }  
            }  
          }  
        },  
        "modeling\_budget": {  
          "type": "object",  
          "required": \["max\_time\_seconds", "max\_models"\],  
          "properties": {  
            "max\_time\_seconds": { "type": "integer" },  
            "max\_models": { "type": "integer" }  
          }  
        }  
      }  
    },  
    "parent\_pool\_metadata": {  
      "type": "object",  
      "required": \["parent\_relatedness", "fitness\_vectors", "novelty\_scores", "seed\_weights", "promotion\_history"\],  
      "properties": {  
        "parent\_relatedness": {  
          "type": "object",  
          "required": \["stratum\_retention\_policy", "pairwise\_distances"\],  
          "properties": {  
            "stratum\_retention\_policy": { "type": "string" },  
            "pairwise\_distances": {  
              "type": "array",  
              "items": {  
                "type": "object",  
                "required": \["parent\_a\_id", "parent\_b\_id", "distance"\],  
                "properties": {  
                  "parent\_a\_id": { "type": "string" },  
                  "parent\_b\_id": { "type": "string" },  
                  "distance": { "type": "number" }  
                }  
              }  
            }  
          }  
        },  
        "fitness\_vectors": {  
          "type": "array",  
          "items": {  
            "type": "object",  
            "required": \["model\_id", "vector"\],  
            "properties": {  
              "model\_id": { "type": "string" },  
              "vector": {  
                "type": "object",  
                "required": \["f\_perf", "f\_size", "f\_latency", "f\_comp"\],  
                "properties": {  
                  "f\_perf": { "type": "number" },  
                  "f\_size": { "type": "number" },  
                  "f\_latency": { "type": "number" },  
                  "f\_comp": { "type": "number" }  
                }  
              }  
            }  
          }  
        },  
        "novelty\_scores": {  
          "type": "array",  
          "items": {  
            "type": "object",  
            "required": \["model\_id", "score", "k\_neighbors"\],  
            "properties": {  
              "model\_id": { "type": "string" },  
              "score": { "type": "number" },  
              "k\_neighbors": { "type": "integer" }  
            }  
          }  
        },  
        "seed\_weights": {  
          "type": "array",  
          "items": {  
            "type": "object",  
            "required": \["model\_id", "interpolation\_coefficient", "parent\_ids"\],  
            "properties": {  
              "model\_id": { "type": "string" },  
              "interpolation\_coefficient": { "type": "number" },  
              "parent\_ids": { "type": "array", "items": { "type": "string" } }  
            }  
          }  
        },  
        "promotion\_history": {  
          "type": "array",  
          "items": {  
            "type": "object",  
            "required": \["model\_id", "status", "timestamp", "evicted\_model\_id"\],  
            "properties": {  
              "model\_id": { "type": "string" },  
              "status": { "type": "string", "enum": },  
              "timestamp": { "type": "string", "format": "date-time" },  
              "evicted\_model\_id": { "type": \["string", "null"\] }  
            }  
          }  
        }  
      }  
    },  
    "grounded\_citations": {  
      "type": "array",  
      "items": {  
        "type": "object",  
        "required": \["field\_path", "value", "confidence", "citations"\],  
        "properties": {  
          "field\_path": { "type": "string" },  
          "value": { "type": "string" },  
          "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 },  
          "citations": {  
            "type": "array",  
            "items": {  
              "type": "object",  
              "required": \["page", "bbox"\],  
              "properties": {  
                "page": { "type": "integer" },  
                "bbox": {  
                  "type": "object",  
                  "required": \["left", "top", "width", "height"\],  
                  "properties": {  
                    "left": { "type": "number" },  
                    "top": { "type": "number" },  
                    "width": { "type": "number" },  
                    "height": { "type": "number" }  
                  }  
                },  
                "cell\_coordinates": {  
                  "type": "object",  
                  "required": \["column", "row", "col\_span", "row\_span"\],  
                  "properties": {  
                    "column": { "type": "integer" },  
                    "row": { "type": "integer" },  
                    "col\_span": { "type": "integer" },  
                    "row\_span": { "type": "integer" }  
                  }  
                }  
              }  
            }  
          }  
        }  
      }  
    }  
  },  
  "required":  
}

## **Security Enforcement, Tamper-Evidence, and Compliant Verification**

Because provenance receipts serve as verifiable evidence for compliance audits, they must be protected against retroactively altered metrics and unauthorized modifications.48 The system runs each emitted receipt through a standardized verification pipeline before persisting it in the registry 48:

   
           |  
           v  
  \---\> Sort keys, strip spaces   
           |  
           v  
    \---------\> Generate digital fingerprint   
           |  
           v  
  \------\> Encrypt hash with Private Key   
           |  
           v  
  

1. **Deterministic Serialization**: The JSON document keys are sorted alphabetically, and all redundant whitespace is removed.48 This step ensures a consistent string representation regardless of formatting differences across software environments.48  
2. **Cryptographic Hashing**: A SHA-256 hash is computed over the normalized string, establishing a unique digital fingerprint of the generation's state.48  
3. **Digital Signature**: This hash is encrypted using the private key of the authorized breeding engine agent.48  
4. **Validation**: Downstream verification engines decrypt the signature using the breeding engine's public key.48 If the decrypted hash matches a newly computed hash of the receipt, the document's integrity and authenticity are confirmed.14

This verification pipeline prevents retroactive modification of evaluation results.48 By tracing the chain of signed receipts back through preceding generations, compliance teams can reconstruct the complete evolutionary path of a model.7 This level of traceability is critical for demonstrating adherence to regulatory requirements, such as those defined by the EU AI Act or GDPR, by proving that model parameters were derived from authorized datasets and through validated training processes.6

#### **Works cited**

1. Neuroevolution \- Wikipedia, accessed June 29, 2026, [https://en.wikipedia.org/wiki/Neuroevolution](https://en.wikipedia.org/wiki/Neuroevolution)  
2. Auto Research with Specialist Agents Develops Effective and Non-Trivial Training Recipes, accessed June 29, 2026, [https://arxiv.org/html/2605.05724v1](https://arxiv.org/html/2605.05724v1)  
3. A Survey of Weight Space Learning: Understanding, Representation, and Generation \- arXiv, accessed June 29, 2026, [https://arxiv.org/pdf/2603.10090](https://arxiv.org/pdf/2603.10090)  
4. A Survey of Weight Space Learning: Understanding, Representation, and Generation \- arXiv, accessed June 29, 2026, [https://arxiv.org/html/2603.10090v1](https://arxiv.org/html/2603.10090v1)  
5. What Is Metadata Lineage? \- DataHub, accessed June 29, 2026, [https://datahub.com/blog/metadata-lineage/](https://datahub.com/blog/metadata-lineage/)  
6. Metadata Lineage: Complete Guide to Tracking Data Journey \- Promethium's AI, accessed June 29, 2026, [https://promethium.ai/guides/metadata-lineage-complete-guide-tracking-data-journey/](https://promethium.ai/guides/metadata-lineage-complete-guide-tracking-data-journey/)  
7. Model Lineage and Reproducibility: Tracking Provenance Across the ML Lifecycle, accessed June 29, 2026, [https://agility-at-scale.com/ai/governance/model-lineage-and-reproducibility/](https://agility-at-scale.com/ai/governance/model-lineage-and-reproducibility/)  
8. Data Provenance vs. Data Lineage: Differences & AI Use Cases \- Snowflake, accessed June 29, 2026, [https://www.snowflake.com/en/data-governance/data-lineage/data-provenance/](https://www.snowflake.com/en/data-governance/data-lineage/data-provenance/)  
9. What is data lineage (and why does it matter)? \- Twilio, accessed June 29, 2026, [https://www.twilio.com/en-us/blog/insights/data/data-lineage](https://www.twilio.com/en-us/blog/insights/data/data-lineage)  
10. Data Lineage vs Data Provenance: Best Practices and Insights \- OvalEdge, accessed June 29, 2026, [https://www.ovaledge.com/blog/data-lineage-vs-data-provenance](https://www.ovaledge.com/blog/data-lineage-vs-data-provenance)  
11. The Ultimate Guide To Data Lineage \- Monte Carlo Data, accessed June 29, 2026, [https://montecarlo.ai/blog-data-lineage/](https://montecarlo.ai/blog-data-lineage/)  
12. Lineage \- OpenMetadata Standards, accessed June 29, 2026, [https://openmetadatastandards.org/lineage/lineage/](https://openmetadatastandards.org/lineage/lineage/)  
13. AI Pipeline System Design: Data Ingestion, Training, and Serving | InfraSketch Blog, accessed June 29, 2026, [https://infrasketch.net/blog/ai-pipeline-system-design](https://infrasketch.net/blog/ai-pipeline-system-design)  
14. Provenance \- SLSA.dev, accessed June 29, 2026, [https://slsa.dev/spec/v1.0-rc1/provenance](https://slsa.dev/spec/v1.0-rc1/provenance)  
15. Understanding Parent and Child Runs in MLflow, accessed June 29, 2026, [https://mlflow.org/docs/latest/ml/traditional-ml/tutorials/hyperparameter-tuning/part1-child-runs/](https://mlflow.org/docs/latest/ml/traditional-ml/tutorials/hyperparameter-tuning/part1-child-runs/)  
16. ML Model Registry | MLflow AI Platform, accessed June 29, 2026, [https://mlflow.org/docs/latest/ml/model-registry/](https://mlflow.org/docs/latest/ml/model-registry/)  
17. Nested runs don't group correctly in MLflow \- Databricks Community, accessed June 29, 2026, [https://community.databricks.com/t5/machine-learning/nested-runs-don-t-group-correctly-in-mlflow/td-p/104616](https://community.databricks.com/t5/machine-learning/nested-runs-don-t-group-correctly-in-mlflow/td-p/104616)  
18. Data Lineage | Pentaho Academy, accessed June 29, 2026, [https://academy.pentaho.com/pentaho-data-catalog-en/data-catalog/getting-started/data-lineage](https://academy.pentaho.com/pentaho-data-catalog-en/data-catalog/getting-started/data-lineage)  
19. Facets & Extensibility \- OpenLineage, accessed June 29, 2026, [https://openlineage.io/docs/spec/facets/](https://openlineage.io/docs/spec/facets/)  
20. OpenLineage integration \- IBM, accessed June 29, 2026, [https://www.ibm.com/docs/en/ws-and-kc?topic=lineage-openlineage-integration](https://www.ibm.com/docs/en/ws-and-kc?topic=lineage-openlineage-integration)  
21. SimpleMating: R‐package for prediction and optimization of breeding crosses using genomic selection \- PMC, accessed June 29, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC11726409/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11726409/)  
22. Metadata analysis indicates biased estimation of genetic parameters and gains using conventional pedigree information instead of genomic-based approaches in tree breeding \- PMC, accessed June 29, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC8913692/](https://pmc.ncbi.nlm.nih.gov/articles/PMC8913692/)  
23. Tutorial \- ALIFE 2024 Copenhagen \- Artificial Life, accessed June 29, 2026, [https://2024.alife.org/tutorials.html](https://2024.alife.org/tutorials.html)  
24. A Review of Genomic Models for the Analysis of Livestock Crossbred Data \- PMC, accessed June 29, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC7332767/](https://pmc.ncbi.nlm.nih.gov/articles/PMC7332767/)  
25. Overview — hstrat 1.25.0 documentation, accessed June 29, 2026, [https://hstrat.readthedocs.io/](https://hstrat.readthedocs.io/)  
26. A Scalable Trie Building Algorithm for High-Throughput Phyloanalysis of Wafer-Scale Digital Evolution Experiments \- MIT Press Direct, accessed June 29, 2026, [https://direct.mit.edu/isal/proceedings-pdf/isal2025/37/62/2567097/isal.a.890.pdf](https://direct.mit.edu/isal/proceedings-pdf/isal2025/37/62/2567097/isal.a.890.pdf)  
27. hstrat: a Python Package for phylogenetic inference on distributed digital evolution populations \- Open Journals, accessed June 29, 2026, [https://www.theoj.org/joss-papers/joss.04866/10.21105.joss.04866.pdf](https://www.theoj.org/joss-papers/joss.04866/10.21105.joss.04866.pdf)  
28. Analysis of Phylogeny Tracking Algorithms for Serial and Multiprocess Applications \- arXiv, accessed June 29, 2026, [https://arxiv.org/pdf/2403.00246](https://arxiv.org/pdf/2403.00246)  
29. Phylogeny-Informed Interaction Estimation Accelerates Co-Evolutionary Learning \- MIT Press Direct, accessed June 29, 2026, [https://direct.mit.edu/isal/proceedings-pdf/isal2024/36/66/2461071/isal\_a\_00796.pdf](https://direct.mit.edu/isal/proceedings-pdf/isal2024/36/66/2461071/isal_a_00796.pdf)  
30. Daily Papers \- Hugging Face, accessed June 29, 2026, [https://huggingface.co/papers?q=evolutionary%20model%20merging](https://huggingface.co/papers?q=evolutionary+model+merging)  
31. Chapter 1 NOVELTY SEARCH AND THE PROBLEM WITH OBJECTIVES \- Computer Science, accessed June 29, 2026, [https://www.cs.swarthmore.edu/\~meeden/DevelopmentalRobotics/lehmanNoveltySearch11.pdf](https://www.cs.swarthmore.edu/~meeden/DevelopmentalRobotics/lehmanNoveltySearch11.pdf)  
32. Automatic machine learning \- agua \- tidymodels, accessed June 29, 2026, [https://agua.tidymodels.org/articles/auto\_ml.html](https://agua.tidymodels.org/articles/auto_ml.html)  
33. Train and Deploy Models with AutoML (Automated Machine Learning) \- Domo, accessed June 29, 2026, [https://www.domo.com/docs/s/article/360048127854](https://www.domo.com/docs/s/article/360048127854)  
34. ExAutoGP: Enhancing Genomic Prediction Stability and Interpretability with Automated Machine Learning and SHAP \- PMC, accessed June 29, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC12024354/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12024354/)  
35. Automated Machine Learning: A Case Study of Genomic “Image-Based” Prediction in Maize Hybrids \- Frontiers, accessed June 29, 2026, [https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2022.845524/full](https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2022.845524/full)  
36. What is AutoML? | Databricks on AWS, accessed June 29, 2026, [https://docs.databricks.com/aws/en/machine-learning/automl/](https://docs.databricks.com/aws/en/machine-learning/automl/)  
37. Data Lineage for Machine Learning: Why Reliable ML Lives Upstream \- DataHub, accessed June 29, 2026, [https://datahub.com/blog/data-lineage-for-ml/](https://datahub.com/blog/data-lineage-for-ml/)  
38. Novelty Search Algorithm, accessed June 29, 2026, [https://algorithmafternoon.com/novelty/novelty\_search\_algorithm/](https://algorithmafternoon.com/novelty/novelty_search_algorithm/)  
39. Unveiling the Unknown: Evolutionary Algorithms for Novelty Search in AI \- Alphanome.AI, accessed June 29, 2026, [https://www.alphanome.ai/post/unveiling-the-unknown-evolutionary-algorithms-for-novelty-search-in-ai](https://www.alphanome.ai/post/unveiling-the-unknown-evolutionary-algorithms-for-novelty-search-in-ai)  
40. Critical Factors in the Performance of Novelty Search \- CMAP, accessed June 29, 2026, [http://www.cmap.polytechnique.fr/\~nikolaus.hansen/proceedings/2011/GECCO/proceedings/p965.pdf](http://www.cmap.polytechnique.fr/~nikolaus.hansen/proceedings/2011/GECCO/proceedings/p965.pdf)  
41. Surprise Search: Beyond Objectives and Novelty \- Georgios N. Yannakakis, accessed June 29, 2026, [https://yannakakis.net/wp-content/uploads/2016/05/surprise\_search\_camera\_ready\_Final.pdf](https://yannakakis.net/wp-content/uploads/2016/05/surprise_search_camera_ready_Final.pdf)  
42. Dominated Novelty Search:Rethinking Local Competition in Quality-Diversity \- arXiv, accessed June 29, 2026, [https://arxiv.org/html/2502.00593v1](https://arxiv.org/html/2502.00593v1)  
43. Efficient Novelty Search Through Deep Reinforcement Learning \- SciSpace, accessed June 29, 2026, [https://scispace.com/pdf/efficient-novelty-search-through-deep-reinforcement-learning-4albf5f7mq.pdf](https://scispace.com/pdf/efficient-novelty-search-through-deep-reinforcement-learning-4albf5f7mq.pdf)  
44. Backward Compatibility During Data Updates by Weight Interpolation \- ACL Anthology, accessed June 29, 2026, [https://aclanthology.org/2024.eacl-long.174.pdf](https://aclanthology.org/2024.eacl-long.174.pdf)  
45. \[2604.14790\] Diffusion Crossover: Defining Evolutionary Recombination in Diffusion Models via Noise Sequence Interpolation \- arXiv, accessed June 29, 2026, [https://arxiv.org/abs/2604.14790](https://arxiv.org/abs/2604.14790)  
46. Tracing the Roots: A Multi-Agent Framework for Uncovering Data Lineage in Post-Training LLMs \- arXiv, accessed June 29, 2026, [https://arxiv.org/html/2604.10480v1](https://arxiv.org/html/2604.10480v1)  
47. Provenance \- SLSA.dev, accessed June 29, 2026, [https://slsa.dev/spec/v0.1/provenance](https://slsa.dev/spec/v0.1/provenance)  
48. Structuring JSON/XML Lineage Documents · Provenance Tracking, accessed June 29, 2026, [https://www.provenance-tracking.com/storage-indexing-query-optimization/structuring-jsonxml-lineage-documents/](https://www.provenance-tracking.com/storage-indexing-query-optimization/structuring-jsonxml-lineage-documents/)  
49. The PROV-JSONLD Serialization \- W3C, accessed June 29, 2026, [https://www.w3.org/submissions/2024/SUBM-prov-jsonld-20240825/](https://www.w3.org/submissions/2024/SUBM-prov-jsonld-20240825/)  
50. Custom Facets | OpenLineage, accessed June 29, 2026, [https://openlineage.io/docs/spec/facets/custom-facets/](https://openlineage.io/docs/spec/facets/custom-facets/)  
51. Working with Schemas \- OpenLineage, accessed June 29, 2026, [https://openlineage.io/docs/spec/schemas/](https://openlineage.io/docs/spec/schemas/)  
52. JSON Schema Extraction with Citations (Reducto), accessed June 29, 2026, [https://llms.reducto.ai/json-schema-extraction-with-citations](https://llms.reducto.ai/json-schema-extraction-with-citations)  
53. Model Cards \- Hugging Face, accessed June 29, 2026, [https://huggingface.co/docs/hub/model-cards](https://huggingface.co/docs/hub/model-cards)  
54. GitHub \- HDI-Project/model-provenance-json: A specification for the model provenance file that keeps track of the journey from raw data to deployed model in Machine Learning 2.0 projects., accessed June 29, 2026, [https://github.com/HDI-Project/model-provenance-json](https://github.com/HDI-Project/model-provenance-json)  
55. What is Lineage Tracking? \- Dremio, accessed June 29, 2026, [https://www.dremio.com/wiki/lineage-tracking/](https://www.dremio.com/wiki/lineage-tracking/)  
56. What is model lineage? Meaning, Architecture, Examples, Use Cases, and How to Measure It (2026 Guide) \- AIOps School, accessed June 29, 2026, [https://aiopsschool.com/blog/model-lineage/](https://aiopsschool.com/blog/model-lineage/)  
57. 7.3. Lineage \- MLOps Coding Course, accessed June 29, 2026, [https://mlops-coding-course.fmind.dev/7.%20Observability/7.3.%20Lineage.html](https://mlops-coding-course.fmind.dev/7.%20Observability/7.3.%20Lineage.html)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAcCAYAAAC3f0UFAAAA0ElEQVR4Xu3QMQsBYRzH8UcMFEkpmQwsJorVCzAoycArsBjkJSiDF6AMssliMdgMSlmsBovBYvQa/H7u5zx3gzJZ7luf4Z7733PPnTFB/6oAPShDQsL2QAj6soA8zOAhlc/oj8M1uAiPwRpwlYzWTARWsBZesyFsJaq111N8mjeJ8VhLGItbFm7GeS2xNJyhLm5x2ENLuGsX7lAUT1U4CM+4gROkxNNPw/74UXP/IhvAyLpOwhE61prbDiaQk6lxdo3ZQ+/465rQlpJx/kjQ1550iCplAq+IbgAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAcCAYAAAC+lOV/AAAAz0lEQVR4XmNgGOyAG4hZoZhkQLZmYSA+BcS+UEwSyADi/wxkaJYF4pNA/A+Iy6GYKMAIxJVAHAHEDxlI1KwNxO0MENtBmhdCMUHAwgDRCDKAF4gPM9BLsy0DxL8gf/MA8QEkDOJjBZxQvBSI84E4BIhjgPgGAxGaA6C4hwGiEYYPAfFdKBaHq0YCoJQ0DYpBbGTQygAJcRCWRJMD+60MiCOhGB2A4vcTFOsjS/gB8TsGSBKEKXCEyoFcsBuIf0HlQfgVEJdA5SnTPApGAe0AAGr2OAmQWWDHAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADcAAAAbCAYAAADYtRcLAAABm0lEQVR4Xu2XTSsFURjHn0J5DSUvZWWnZKMshA2RBUk2SlnYoOxI2SjlC1jaSb6EDWV5tz6BxOraWVDi/+880x3P3Dtm5rq3cTu/+tXcc+btP+c8Z+aKeDz/ggG1w3bUiVZ4CC8SuKTHJKbhwvXASXgOX9SJH3vUjybYD7fhF9xVh0KuwUd4pMfEwhPtwQP4pmYNtwgXbGMGzmARjqqWY7hsG+PgztWG4zlSXbQMnfAO3sMulbRIqVz24bRuJyIv4UbElQbLJMwKXNXtGXFTNDF5CccQrDeWS1BnvJ9bKT9FE5GXcByxd3gtpZXxARZgb2i/VKQNxydrl+cb1bbTdXdYLLbeAng/p6HfhDXYbdoqkjZcOaodOU67okTrbVyi97Qh0cAV8eF+odpwwWLCF/WfkodwHDGOXNyq2Ay34BUcNn0RdsR9znyIe2r0VdvmQ/slIWs4fko9wU9x138Wt7D0qWE4RefgJRwzfTUla7i0MBRfFW22o5YMSvRJ1wKO9CacEjdNacNwIi7grO1oBPjXqN02ejwejyct35CdZ2V1+A9HAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAbCAYAAACeA7ShAAABJ0lEQVR4XmNgGJEgGYhnEYFB6kAYL6CaYYxALAzEnlD8E4j7gVgSCdsC8XkgXgjFBEE0FP8DYhc0ORAIAuJyKMYLQK6bD8VPgFgGKs4MxLxQti8DwkK8QBCIT0PxViDmgIobA3EulK0LxJpQjBeANH2F4k4GSDiBNG1gwO5lvCCdARJWILyeARJzh4H4GRArIakjCGDhBQor5PACuW4aA8LLyICHAbs4gwgQX2WAhBVyeMkyYHqRDYpnArE3mhwYUNUwWOBXQTFFABb4IFeguwQZSANxLxRPZYCEGxyAUvQjIP4FxP+B+BUUXwBiLSR1MJAAxDZQvAWI+VFkyQCw7JSDLkEqALkE5CIQtmKAuJBsoAjE66AYlMVAsU0RgCUNVnSJUTBcAADsI0LJuF4D5wAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAcCAYAAACtQ6WLAAAAkUlEQVR4XmNgGByAB4g50AXFofguEM9Ak2NgheJYIJZAk8MNJIE4H4rVkSVkgLgZiCOg+AwQixAlmQHExkCcDsWngVgQJskLxNxAvBWKG2ASMKADxA+h2BJNjiEHiE9AMSgg/IGYDSQBMnIPEJdDMciUVIgeBgZGIJ4AxHOhuB+I+YmSBAFmBojfQBgUvqMABgBZLBfRcIEaLQAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAdCAYAAACT4f2eAAAAtElEQVR4XmNgGLqAGYgFoZgRTQ4FpAPxQyiWRJNDAXpA7APFeE3EC1ih2A+KYXwMQJRCkEAjFNsD8UogToZiFACSDIdiDiDeCsRFUIwCuBkQVokD8XUgdoFinMAUiK8AsQwU4wREKwTFyh4GiHNAGCeYA8ST0AWRAS8UHwbiIDQ5FKAJxbeAWB9NDgxAgesExBFQfAyI+VFUQAHRCt8CcQUQn4RiM1RpBLACYl8gFobiUQAHALIjG4vHjScbAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAcCAYAAABoMT8aAAABF0lEQVR4Xu3SMUuCcRDH8YsQDBKrzWgKKYJoKXoHDa4ZhHPQS2hoag4aFFraGgJpri2qraihF9AWUZM0BU3W97o7+as5iLQ9P/iAPP/H4/nfnUiWQRnDCpp4xwseUHGzOEQh/hCZced4xgbG/WwCdfeGhj/vpIgrdy1WqDfL7gOb6UEOJ2KVVTk9TFJyep2l9ECrtXHgBiUKnGIyHuZxKfZZ8YlDZeQCc3jFI6bdUFnFJ87E5q8i+ntXrMGpYyzGS9rNllhj/sqU2FTu8OQWxCb3G53/PW7FOtvpbpJ5sY3U5elbIE0VX6i53mvs4Vts3F0LFNGXtsUmoW6w4y6wjyOx63YtUGTkAhFtjFrDFtbF9iRLlv/ND603ODPsx98yAAAAAElFTkSuQmCC>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAbCAYAAACa9mScAAAA/klEQVR4Xu3SPUtCYRTA8RMplDb0MoQiShFBkFNL4OLgoEhzgw6NDU41BI1BW0MYbYlIBH0BP4VzY1vWJ2gJAv+H5winEOWGS3D/8FvOfXvufa5IXFy0FrBrGjhACkv+pGklcYNHU8AlvtB2503tHC/YNFoeQwmrmtkW3nD9a17BO/bcTF95zSy6udTwLeEi3wUGEi4Yt4Nns+Hm87nJGT6w7Wa6I308IIOqOzYxXcErcm5WwqeEj3qMIxyii7r5kW7vvYSnXhn9yD0Jq7lDFk2comUmtooVo+lOrEt4iLaMJ+ybP6V/cAdFM/6fIlXGLU5Mwh2LVFrCa6q4f9EIyyYmHTyEzWYAAAAASUVORK5CYII=>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABHklEQVR4Xu3TP0tCURgG8NdBlBBSGyKQooagocnRtcEG54gWt3YdxMagrSGSBsFBcXBtyS/R3BRump/ARRB8Ht5X7+EoeFVo0Qd+4Plz7znn9VyRffb530TgEh5MFg4g7k4Kkyi8QhvOzBOM4d2ZFypl+IFjp+8UBqK7DJ1z6MOL138Df3Dl9TM8CR36A7cwEX3YTQW+IeX1M/emKV5NSzCEC2tzkL6gASeQt7GV4Y56kLF2zoxE63UHBRvjsapQN9fWPw/P/iG6i2fR2lFLdHc10Zfw6hThyObSbJGFJCHhtPlwWnQxN6xh1yz7c9YKL/OncRffKI8SlGLrbP0y1o+1ikFH9Ab49zJ0eAV+RXfzJsEXsFG4M14J4u9dzhTodif1jiM+RwAAAABJRU5ErkJggg==>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAAbCAYAAAApvkyGAAACiUlEQVR4Xu2WS+iOQRTGHyEJuRW5LJCScis2pOSSKEpuKTuE4s8OWfC3lBSywUJsKJeUXMLizUJEycIlG5cFIXaUnefpnNO8zf+7bahP89Sv7/3OzDsz58yZMy9QVFRUVFRUFBpMVjm7yHgyjPSrd+pWzSGPkRycSZ6QH2R2rV9XaiJ5TXZn9oPkKRmZ2btOveQ7mV6zDSBXyXmyjZyF9Rte6xOSrRfWZz856c/BPrKGjPP+dckmDpM7sHfnkU1kTK1faAtZmxtbaQh54Og5NIG8Jzv8fw/5BJs412ryFeacpAV/cNQm6TxrjnX+X5Ijj5xZNbv6vEXfgKhG3HX03JH+eweHkoqcyuwLyRcy1//vJIfITdjgMYF+t5KHaO2gdAEpkEq/F7CA5UHTmErt3MH55Ah5Q2ZkbU2lK+A0koM6T0ILqRcYObiU3IdNJCRVWAWjQmsHR8EiH+dnGaxCK4ARxLqmou8ubYfViVuwM9+xVEV1wK+TG85zWIGJO1AOaiGqtAqI6E82wnajQmMHj5LN5DasWMV4cvwzmeK0koIsDsCKn3Zcad2o4LWVzl6cPy0sFA5qMbovxWKyCCnNGzkYO6j3XiLdqdoJtWv3RS5V3aiiSxyldAW7n3/BsqCttO2XYYuUVjgfybTohOSgInjJqchkdOZg2JSiA8kgcgLpKpEtpPH2wObSju91xnq7bMouZVFkRFPprKlAKMJy7JWzAellFRF9CCiN9cUTQTgGS53j5Bt5BnPyHPnt3CMrYefpGrkIG1tVU07pY0Jcge3IAtidqGMzCVaY3jkKsqQ1VOQnOeP9mmo0LMrryXKkIvM3pIBpvhF5A8xZ7ZDa2+5KUVFRUdG/0B9GepFpzipqmAAAAABJRU5ErkJggg==>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAbCAYAAADmkHhFAAAEKUlEQVR4Xu2YXahOWRjHHyFk5GNEmqlhIlyYIaKRXEyEGDVKiAslSU4TR8hH5igSuZhm5sZHzVDMiBqaRpELpeSj1Ew+yjR1EiPkxoULasbzO89aznrXu/Z79n6dV97a//p1Tmu9e++1nv2s/7PWFilVqlRtTVPWxY3vuT5VNii94468WqUcqsEuZfSbXxfXVOVX5YO4owm0SFmv9Ig78qgMbLbeKrCDlDmOF8p+ZYTjE2Wna9/oKPIQgnlGmRx3NImwgWPKwrgjr5Y7/lNmRX1ohVhw4Yuor5aWKieUXnFHE2muckHqXHHfO9qVjyq7OoSRP3Jsi/qy1Ff5Q+yFNbOGKtekWEJ1aIBy2UEgCEisMLBHo74scc1t5fO4I1B/ZZ6yWMySGEsRq+lKHypfKwvEngU8o4gYz3GlNe7oSuOVZ44tUZ/XDOWVg8zOI665I+bVsSY6bopNmuD/qTwWG093aL7Y/dnqfan867glloVFxCrNm1BvROXDW7P8Fa1R/nfkXdpfKZek2ps+Vu46WoL2b5UbyuCgrV5NEntJ+CPqKbYzgdNS3PNJuEtSPZea8t4KKX/1XvnAMaqyO1NZgW2TTlvBLpB/RrwaCAgQ7LwWQdB+kcqXRIZiS0CSxKL6D4wbAxUOLA9mAEwqy1/ZKj1XNjvyTjAVWDzuolQ/jxfaLtWrYbqDnUXeSQ1X/pHKl8QcyGDAomItU36W9PxRGVh5TwLrCxcXpgoXy4NAnHL/11ousQgsSy8sFH7SexxeePtTsSJG0eF39Yp7kAjhS2L581zA46krvOS8IjaFvDk8FISFi6z8TKyq/iTVgxin/KhsF6uYZIcvFF5kyV9iE/HyXso1fj/cTyxbWDn49wGxLRGHi5OO2e63iNNgu/K72LWxvJ8SPDREbCtJYGCMsltsjiTKVuWgMsH9PqUjUu3/SRGE+8pLsUr/xEEbPFTOKzMlvfRXim2TOK6yPBgsmR1mJ/9fl+qlN0Vsww3fiC3ztco9sQlwfBwrNsYfHATZy+8q/pb0Vg4RVILJ/TmStopt/eCw2PcL5rVSbK/Lc1lhKZFUnLzqPtYWVWgfZPsVqdwqMXCyui1o86IKA8Gn6iOymUOCF77rvThlDXzDyAos4n4EzScGCeAJxZjPSfb+mfarkt4xdbsYNL5LNjLwvWIfaGJhB7xtJlhUZKnPWO4TBpf74dFZxaaIuLdfeSm1SDo5GiL2nyxHsma1mF+SgbEI+iZJ7x27Upuyw7FEOjOPv0w2tph6xdjCQhpqpPKbMixqb5jwG7yLYHZVKfnNPjFfKyICiL/FhZP2t/2mwLVYQB+xw0TqxMlzWS3UhHciqvJZsQ8TeX0HHy368aORYgdA8SNTv5P0aqMtfqkNVRnYBgmTpxpTTFIDagZhBRTAcNdQqlSpUt2h16Nb2udTzZM5AAAAAElFTkSuQmCC>

[image12]: <data:image/png;base64,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>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAH0AAAAbCAYAAABRLYBiAAADdElEQVR4Xu2Yy6tNURzHf/LIjZs8Iu9HJEWUm4FHIYk8yzWiGHnLQBIjmRkoCSERIyGPIpJ0wsCrSGFIYkDxByjy+/Rbq73uvnvvc4977HOwPvXpnrPuvnz3evzW2lskEolEIpFIJBKJRCKRSLPSoi53bldHqK1qj/CiJmCiuktdpPZT+3b8ddOQztl0WWeojyUZ9GnqE/WbOj24rho91aHq8C46TO3tLMJfc0g9r44V69Dv6pngulrg3+P/T2fKk/vi/qqRl7M7WevOKPWtuiPVvl99pg5MtRdBtViqtnfR1eoQZxG7na/FBgrI/VFd5y+qkUHqKumcKc9lYqu1Gnk5u5O17hxQv6pTgrZe6hX1nCTlvb80pjyNl6TTjgbtc9XP6sygzTNAqlePP4HPmpUzL2vpMHPvOcNZPFJ9r2523/uop8Rme9lQOX46+ezZK7aiwirB6sWb6rygvSx81qyc6awNIw56ffkrBp2SXZGO5QiKSmcRdPgd9UMX5SzR5sxjhdj2E25BWdtPrXC6fi6dM+X5SB3HHxbgs2bl7E7WukKIY5IMOnshsvL9IY5Vf1g9LjZJymaq2ORA35lr1B/S8WA0Xz3i3CfW4WXjs2bl9Fk52J0WO8mzQJgo99WLkhxqGZOK2Omfz1SJs65tg/rSyfcLYuNT0/0S4rZ6Vb3ufCHJzNwotvIpmUyIsiHDVudD9YZ6Sf0iSSWikympPF7iNWnMBPVZs3IimejfBWIHzZ1i2Rn4ivs98ojId37y/a66RJ0lNim4Hpk0Y1z7b1cRVrXfz8NVxL6UfqRrJOTJepz0Kyq9XTWKMCcywK/USeFFUn3QmSjhVusHnXcBNbNJrKz4VcFsQvawya6N1c0qny224suEm74ldoD0h8gWsRlOSQthplMCcWXqd2UQZoWsnKzSp5L0I9dQwnlrx2ouZdDZux+oE8QG+41zrSTlgmdPSj+laLRrKwtKNnvieicddEJsO+LQGEKH0nHI/ZRNmLUo50KxyUBF2ibWp2yx9PEc5xaxswH7/kH1k9iWxZtT9Pf5Tt0jNb4/GSw2Y9rVxZIc5NLwyNaIlx289mSGk89LiQxfh3LDrAZWz2VnTZ1QJ9JZ0zlDWFCt7mfYxmMz8pk+j+RwUmyg2abanJF/nDjo/yGUcg48jSjpkUgkEok0A78ArrbR7631fHMAAAAASUVORK5CYII=>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJ8AAAAbCAYAAABiOl0uAAAFm0lEQVR4Xu2aaaitUxjHH6GMGXMzxLm+SC6umcIXQ2RMFBkShUwZMn7gXBI3Q5mHbrl8QNzcK2OXOIZkCimO+ODyRQgllGR4fj3P41177fc9Z5+9t3P2e1r/+nfOu9ba77veZ/3XM6y9RQoKCgoK/n9srlyi3DTvKGgVzlUudg6MdZV7K/d1btTZPRRsonxSuUfeUdA6sJb3O3fI+maMIr6CmWBo4kN0LysvUz7l/F15vnKtZNyguMpZMD9wkHOl9OmstlCuVu7q14gN3qj8S3mYtw+Khcq3/G/B/MD6zmeVJ2R9PWEv5W/KV5QbJu0HKv9U3pW0DQIS1BXKdfKOgtaDtX1c+lhb3OXNyjOkM8TuIxZ6BxUfE4IIj7DehNhFRysvUG6j3FiGG/ZHAbzP7s7LxTY/a0DO3VaglQ+VC/KOfnGhDCfsbuZ8X3lM1hegXH/HifhIAd5V/iS2SPMFJOl4CI6aIIn6HWJ2nmpjjjq2U34itpEGwpjzS+Vt0rwjIzckZ1wv60uxtfNjqZ8cE58UEzsMXCsmWIQ7H4D3pzJ8SSovD/Aa34ulOW0F6/u1NDuXnsDOpOqF49IsPHCo82/lsqwvxXTiG1f+qNzZCSJMPyxzF3Y5BL9F+VAPvE+quTfhAOUfYvlRilOVa5SHS3Wv3dIBDuzAWMYwr4v8f0hqBOlHxGv7ZwJcH6V81LlKeZ5yF+XxyTjAeyx19prDDSw+hHa3VB6Il2XS5F11wGNBKp0js74UU4mPAodCJ4qdKHi2FVuQfKHaDMLqL9KZRmBjNtjzYtED+5A7PSbdC0+InnDGsQbHVnEdeePpyhfFHAmg7V7l9dLpcenH7vnRF2v/s3NR1teEIr4RRxFfAzDCJVJVvBHqyEcujkF9IsRHDkmYToHBJqS7oiZ0fCfdYm0zWORPlVsmbVGIhQB43yXKN6R74Y9Q3ilTiw9wD0QeDoHw+rZUYkzBPS9NrhnD+e6rToTYC1jfz6SPvBWh8ZD3pDuXWS19Hh4mCMNMSPe9ePY90im+2JFRbDDmTOVysW9ebnAeLOZNqRYpep4W8xiHePuEkxzndjGPgIFWKF8Qy5lmEyz0R2Liiw1+pVgeGIuGcBDLuDOATcjNUrGBXHzc8xTlM2KfwZviVR/x8TmINAuT6/2Vx4pFHMjpQ51oc+DNv5Dp894u8EF2yj815JB5xmpuAAK7KW8UC92ECcQDSYZZpCg2MMYTYuGDRJyv/CBhCeOHYVk4Pssi4P6pKuH2Yt9Vcy/GI/Yxqb7RmS0wf96fjcX7QjbCGrE0A4T48Hp4vwXO/ZQ7Sb34Plee5rxO+ZxU94tNX2f3OnC+ihiDk2KF0nTAy74m1bxGDux8DDrdTop8j8oNINpb/+vtxFTioz3f8YyHc43wfGwwBBj5XYiPa36AgbeGJ3tbnfjiOtoQ2jL/H2C/9BkptpKq2sUjE2pfT/iDdKdEdWDMKNi1ERiHEMAX0YFzxLxaumMQ6TdiOx3g/lPjkXhDEmf62iA+vCyeIYqN8GjkgGfHIKnEBxDct87jvK0X8dH2plihSFhdJJZu4P1zYGt+VAJIV2AKog5zZK51iPcgwuApRxoYYLmYcKLSxRvuKGYIiKFOkqroYdyDYjsab0hf9PPTLIS5p5jRES2VHff9ynmFWO5DaPjAmS74bIBK91exxSUvWul8QKrqc7FYKJ4Umx+LiveDeCjamDveiByWnDW9hpxNUtQhWIQTv0rimYif4hEiyLPEvCrPv0asIMRjco8gtiQnZV75iQb3vdoZG2bkQdFBZc3kKRTwUieKHbLCprCMgGAOjoM28L9THYrPJZgXBRLvSZgbc8YGGzawE+LN7RGiojqts+VMgMiXOvPnjDQICYiloL2INWzdOhbxtR+tFV9BQUFBQUFBQcHs4V9J4zMBvxqLGAAAAABJRU5ErkJggg==>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAYCAYAAAC1Ft6mAAADBUlEQVR4Xu2XS6hNURjHP6HI+xGJwfUqhZAiRQwoBiTJI2byGBh4hKLEQDEQiYkUBkqYSRkoN5RnkchAZiZSlFAGHv/fWeu7e5199j7n3O65V25+9evevde6e69v7W99a12z//wVBsnFcmy+obsZKY/K4dFWMFVulTPlXbkrafP3HJTDkvs19JHz5Q35SD6TL+Q62Teahwdek3PyDWKA3CfPR7dFeY8zO2lH+uMeecfCV1oqn8vR8W+cefKE7J+730GvCYiUwavyohyatE2Rb+T+aDoYOBAtgr6j5Bb5S36MTk/6EDST8Viut9AfB1qWvqsspN3geO3wfFJ9b3qTGWYmkBmqiVZskj+iC5L7E+WD+LMeBHzYQlB4pKrVbII8Lfvl7oNnAF+jiBnyoV8weILgC2BZNZkrv0VJBWe7hfQsGojDrJ6yEDRpjPl3kVK7k2uH8R2z6knMwxe+6RfLLczYzmgZaUCeXgRBMGmARUySxy2kh7/nt9yQ9OEZC5NroD8pOC1eb5ZDsuYqqHaVyG7JzxY+G5axxsIg0AMaIZ/Kld6pBPJ/Y/ydr4Tv5W0L64RxnJPjYx+Hv/tp2XuvWO36dRhfJW958H0LkZdFD2cse/CKeG+chQrI16sHE+B9GBCetWw91ls/zVKZVE8jj7wsenKdnH8VHRPvNxOQrx++ZgqBEBCBLbPi9dMZemdAs+QXebm6rQYWI4WDn+g0E1BaEFKoXpRiUp735wtCZ6kExK77WrZbmMn8pgVt8p1l+1O6RxHQWwsltwwWNuexIrzC8vyy7aJZOgrTDvldLoqmtMknFk4OHD/yMAHtFitMARyTTlr5HsKGyZ7UaB9rho6tgxk/JD9EaVhroeq8tOwMVwbVj40vD5Xtk4Wq+NXCeasI9qRG+1gzXMjf8JRbIlfLyVY/EIe0uWcNjvDdDEuH41dLYBLYnPPp2pMwqY0KW6fg0HjJwq7f05AZ16369N5lel1AQKXjX+R6G3Qr8S2EQ2lZle0ynAXL/qttNf6eeufPf5s/EpGgqXtRn4QAAAAASUVORK5CYII=>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAXCAYAAADtNKTnAAABEklEQVR4Xu3SMWoCURAG4BFioUQ0laRLLARBsPAMQtJYpAgJlraipamCaGMhiDaCvXgFCw8g5ABewMomkC6BaP7fN4uzu7KNXZIfvmLnDW/ZmRX51amrqXqBhDm/gZHyevrm/JCMuocP+IaKOY/DrVpCE67NuS/P8ArvMIcLc5ZSY7gy9VDOuiSm+J15cRfwoqLpKaiBuN5QeDMN4RLuYAcd0/OgaqbmS1m19TkNK1hDVmtdxb6T4SyoamoN2MOTHGcROQ/OgnKmznVuYCHu7ZxF5Dw4C28eXtjcg09xPxdnETkP73uD4Xa4Jf6AJRUK39aCRxUM/xOu+02OG/SF69qKG96XmkHSNolb9yRQ+8/fyA/vpzMFsThjRwAAAABJRU5ErkJggg==>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE4AAAAXCAYAAAClK3kiAAACvUlEQVR4Xu2YTahNURTH/0KR749IKYSBjzJQXooyUBiQkBQjJZIBytN7ZvKSUj6jpGSgDJQkGTB4pSSUj4iJMjChpIQy8PH/t/Z2zl7Ou+9c6d7zeudXv967e59z7z3r7LX2OheoqRnIjKTddJafGAwMCXbQa/QBfUyf0s10aHZownB6hq7zE4Et9ELwGJ2UTifovfYhO/4AHZEcUTEm0qvBS3Rsbm4OfUU7YYH1bKDn6DA/ERhPV9GP9DNdnE4nrKdv6Wu6AHZuZRlH7yK7y7rrnq30O13qxnXunYJxj4J7ln6la91cZDo9Qp/Bbl7RTaoUdeD+AQVJwVIqTg0WofTSRe934yvpfTrBjXsOw9LwHf5+D6Eg7YUFWOmsG1VpVtOfdI+fcMTAHXTjPfSiG/OMpifoXPoSdo5nGd0IC5g+p1EdbDvarW7RT3Shm/NoJfxCGjhtBtp9fTA98+hxWABVEq4gS0OlulQro5ZGN+ER+l/BbUU1Ralzj45xc57TsMCtyY0pEL3ou2ZF1KbsCP9fhp2jc8X24CJYsBS0svVNx6i1aXm7EtMvvwKKUN1TDXxBp+TGywZO9S2mnlbWG9h7qt1QQKU+X8Frpr6pvqrM9Fcq/jvxi2oVNGIb7Avqb54ygdMx5+nk8FpBUT+nz+6CrZjYEDdb35QxN5FmQUvQxahY9yJLHc9M2AopalNi4Ha68Tyqb6eQrWhd5Bd6FGkLo3mlaOXrW2QX/UaX+wlY0B7CLmhUOvUHrValX19ole7OvY7l4STS8tBsfWs7WkWH6HtYfyU3wS7sORo/owqtNu2s+cct1Z4PQW0oP+gN2GPcNHoblmZ6fT0Yj9Vq1LPxfAwQlHYrgmpUZ6NxwCJqY55gkP4qIurAtRilqDYOv+PWlGAGrM7le7yakiyB/UjpW5aaEqhlqQNXU8xvKJOFVxAI21EAAAAASUVORK5CYII=>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAYCAYAAAD6S912AAABQUlEQVR4Xu3TMShGURjG8VdRBopIKZMsMhiwSFkMLAabxGIwUIoQsTGQySgli8lqsiijWVmVFJJdxP+55z199+qeRd/me+o3nfeee855zzH712l0azh284WKYuowY5VaWckXVH1CFUgblvCJSws/KUs/7vHkhtBSqMhlB+e4QfOvMaUB67jChasvVOSiCQ6wiAd0FoezjGMSd9hwyXRjFxN4t7C1fDqwimEL42MuGU00jQE8Y6Q4bHPowQIe0eWS0fI1mYr0wVRurNfChGreqVWaVtq4OHCIdhfPSE2QZQu3oBW32Mu+TKTqE8az2LewpSZc4wSjTt1V1Cg1RJ1OJnZLlzrmzMJd1L0UrVLRC3mzcKal0Yq2nVYSs4VX9LmYI0tf+mwbL/h2HxZWo+hqbFrlWc5a6PyX09MbdLXU8tf8AChUQ0LyqS7YAAAAAElFTkSuQmCC>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE0AAAAYCAYAAAC/SnD0AAACb0lEQVR4Xu2YP0hWURjG38igyIpSkiSoqCWIGoTEQXAoyKGI6M+gtDQU4hAOBbm4OORkCQ4iSIMQ0RbhkEQQRIigROIQLiFFQwRBQYv5PJz39Z57uvd+nw75XTk/+KHfPX4vfo/nPX8UiUTKyC74AB4LB7Y629RW+By+h7NwHl6H25MfTbEDjsBL4YAH656GT+FX+BnOwE61GQ7BPfaGshBDWycHxH0gOgH3emMn4CK8J0mwPlfgKKwLnhus/Qx+guclCZ8t/Uj9Ah/r81KwD07DMZUzJ6QL/oFtqsH3vgqe+Vjt1+LCCzml/hAXfilgQAyKM6lJzaIF/oJ9qnEOvoP7vWeEda02ZxFnaxaHVLbqyWCsZrkAV2BvOBBgod1XjUE47r02OGsoaw+kh1JYaE9gfTBWk+yEL8W1BlukCAbwV9KhcQ3jhuGHSKxutbVLxWG4DN9K5V2LizRDs92OcGa8gRf1tWF1q61dCdt8GsT9QTYVa7lJ+XdH9OE6xzXvIzyokrzQrG41tXkModxJ8+C6SdnqWUvBfyWGtgHOwJ/iFuEiusX9wvzqkxcad8HvalFttttDtSg0tjt9IcnSsGk0wgVxHzxv5zoKlyT7/Gah3c55bmbV5uy7Ky7wMPSa5w78DdvDAXGB8fzEG8Lu9NAanEm8qIfwSkXZojck3aL8/qa40GyRLxWcPf3wmyQH16twGH6Q4jsn4SzjsSO8QlkYDIxtylvDLdgDp+A1HS81bKEO9TI8LsVhGTyDzUnxv4R4TDgr66u7peEM43oXbhKRChwR16J2FIlUQQxtg3DN4nkrPJZEKsBjSQwtkmYV22h/oLIB+xQAAAAASUVORK5CYII=>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAZCAYAAAABmx/yAAAA60lEQVR4XmNgGLmAFYgjgPgKEL8C4kdQ3A7EfEDchFCKAGpAfA6I1wGxIpqcNxDfBuKDyILyUHwdiCuBmBlZEgpYgHgNEM+BCfAD8R4oPgDEPDAJLGASEEfDOBlA/BeKPWCCOEAfEBvDOGRpBDnrABBfhWIRhBr8QBOI3wLxUihmRJXGDUDWfgXiKijGB0CukYBx9IH4ExCXQzE+kAjEljCOIBCfBuL5UIzNqQpQXMcASVVwAArVd1BshizBAHHadCgGJRAUQLZGkPU1UPwNiGcxQBJ5PxAvYIBohgcKLgBKfm5QLIwmNwpoCgDSVC7+hACafQAAAABJRU5ErkJggg==>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAZCAYAAADe1WXtAAABXUlEQVR4Xu3UPS8FQRgF4FcuCRERIRoKJCSiUCkkChIFjUKnUNBQiMJ3iEI0vhKRiOAP+AEUWp0folZRaHCO92zu7Obetbnuqu5JnuxmZnZ2953ZNaslzzTJDtzKTGyEWSNsqo8uoEdKpk7azSf+hEfzG4VjOuEKbqAbCpIaXngIp/ABo/HunxzAcLIxLW3mkw7CC1xa8S2YZjjTuMzhE2xBPdyZT9wrTB8cWfEmmZLLpHMwrfMp8wVbEmYSFnWeObvmT8O0wrP5Loh2wiqMqP/XtMiJjlFWzHcBTZgvUkfQnxquNu0n2llL1pUe4Ny83pnCr4dY0zDRgtEXrMW7y4cruSel6sUFo3cYS/QNyLH5BxMtcvUnnYdX81ejN1jWBVG4C4gl6Arah+Be+M/oh4Wgv6Kwvk+yAePQEA6oJNswKwzLmHm7lQs/6Wvh32xdbX8OX5dY86oll0n/J9+XID4LGPnJTQAAAABJRU5ErkJggg==>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAaCAYAAABsONZfAAAAwklEQVR4Xu3SMQ4BURDG8UlQEKGWOIKIRKfQ0CgcQCJxC0qJG2h1Ig7BPSQacQOdFt/kfcu8h90tRCH+ya9YZtazWZF/T5VoDHs4wRxydshWhC0doAU7OEPTzHnpFzqgluLurr+ygYqZ8+rChXQpsYa4Y13pCAvo2aGw7y1pfXkshf9JH0qZvOKWBjAjr7ilt71aysIIVlAlr48t1aHD6xrdswuR6J3TwTXkKVUTGIp7gZUeObGpuMU2pSoDhfDDX+wGeoU8lFycO+gAAAAASUVORK5CYII=>

[image23]: <data:image/png;base64,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>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFIAAAAbCAYAAADve9g/AAADLklEQVR4Xu2YW4hNYRiGXznkfAhNShkkkVMRERpxQRKhKMwFQlyQQy4oE0m4woULhOSQFOXsauOOO0XuRCKUC+WCcnjfvm/NXnvbe/Zae69mz+R/62lmr/XP2v96/+//vu8fICgo6D9TF7KO5MgjMqLgbudXA+lTfLFIA8h80gjzoyoFIzMycgJ5QY6R32RR4e0OIRmxnex02tJAZzo5ST6SqQUj8upOjsICaA05QXYUjEihveQpGQdbFT28o2gw2UcekBmwaKkUMRucrWQ3+Y5/jYyec4hch73zEPIStjP7to5MoG7ODXIZlSfYnhoGi6abZBKqn9sSlDZSu1B8Igv8mrxYT5Yhxfdpddc6r2FGrkR98+NI54yj32tVOSO1C4W2/RjY/SbSMzamouR8E/IP+0EOo35GjiVXYREoFI1ZqZSRijYFjvhMTsP8aIbViimtIxNKIS2+kMlF99pLeqlVsBy91OlaMKI2lTJS+S/nqLgu9Ouay3m/nipHRhVQCVaJti31hxWjxLkjpZTsVzs5/5lF0StlpLbvXUdbe1TsnnboN6QMrLOOio22e1vSqt1B5X4sCykiF5P7sOpby3eWMlKK3v0tClOJjPwF2+qJFYzMwMh+sLwkVGg6opRG1F2oh1QvqfSSVuWM3Oy8J8Nj11Nvbf2xHiKWx64PJfvJRljibXRU2a7AomMLeUKOk2dkntML9sJamCOwY1cWkqHqJdVTbnKSqpyRUaul1k9zl6Jicxv2Lok0m3xw4u7reKgjkxLyTOSPWwr/i7Bqpt5TC7GCnIIVBSGD98Ck45ZWvB7SPMQ78pP8IV/9c9R8R1IQvYItjhZfOzQeoRWll3zuDIpdVxTJMPWW1/yziBvZA3YqeAyreJGRuq9FUD8qVOU7g3QMVeROQ8JOQSbcIxfIJdLixDULFqFK+PonhiJUxI2UsbfIHB8712mB5RhJE0raWE9E3vxKaKyoqxpgOeEcLA8ohIvDWNVSkaitf5CMdg6QN7AtI7Mewno95a2osZfBOi1sI7vIeCRTpzNS0iQUxuUqoCJJ0aiiouRbjXoj29NJUFBQUFBQUFAV+gupeKLTiqhtYQAAAABJRU5ErkJggg==>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGgAAAAbCAYAAACQqsrOAAAD3klEQVR4Xu2YW4hVVRjHP+kCYSalaKKllqHl2AWtIRMdTQIR84JIVIYolndBAh8kHcUQBUWiB7GEUswLog9dIA2RfBBUUASjB6OQ6CHffAh80Pz//Nby7LPn7Dlnz4zOnOP+w4+Zs9c6e5+9vutaZoUKFSr0QKqXmC9OieNiaNlooUp6RDyTvpjQQ+J5MUE8nhrLrcJA+XVfDdQkLolt4paYVj7csGKR3zN/b3i0fLhMzIVnxYfigvi2bIbr6cCPYov4QJwWc5KT8mqt+U1eFG+b/5BGVm+xSJwUM829HdrTsECrmCfOWVsDkYl2Br4MnxEBcFmMDp9r1sOBI2K/lW7YqHpCrBMnxBSrbpQskbJOWVsDDRZ/BYicqP7mBlqTuFZVzeahCr+bG2iuNWb96Se2imPiZeu8I2YZ6HXxX2BG4nrW/EwRNS3mqQ1uiM+tsQw0SHwROCBGlg93SlkLjlH+D1Qy0C/m6bVmTQ1cE6+kxupdk8zrKiwUj5UPd0odNRDk6ujIiUB+JE+iV8Vua4xOLhZ/6g11Z7Xl9OAM3TcDfR2gSSDtRcXUV00DxKz0xR4q6g51l3elUaAudVRZBuqyGhRVGKhjylrwLjVQHyvlaBqEpGo10GSxMn2xDkTDQONAA0EzkVdZC55ssz9JXB8o/rDa1vSuhoi/A+ldbtJAHwd2iM1ivflGlg3tn+Kq+MH8pYEc3yo2il3mzQebtl/FsgAOgSfzGxCt7z7zaKYVfjdwVvwm3hILxBXxmX+lSzRcfCU2BZJZpD1lGYgo5V0jfEZN5lsZ/tYszoj+CaQ7uGggHsCGCyaGz3ut1EBUirTtYkX4n2fsMT+zYqGJOEC8HGkAI7Gjf0H0FZ+aezXwQhgWD+T/9+98s3tEOgcyzr/mjcBNcwc/aKXmg20KcNKwSow1P9/EMaPBahIhyE3gydRYcuFfCuDdeO8ZK+XX5Dy8KnoWm0L2VNBibqCL5j8WUDQQbT6RUqkm4NHfmZ+XEcV4fL2ILDNOvGPueDWJBfxJfGOeUloDacWFZ0FYPMDD8QBOHD4SbybmsegxOgjtGEHMH2EeJVkG4vyPsefC9aes5K2I5+AUSyyfB+LF0UmqMT6Q5/73RKQKciFp53vzhYt1IIp90PkAtelogHCdLQ6Z14lmc+/nPoyNCnA/xgnppWK62CCuW6lrJFVRvwj918wNftg8Upabe1z0OjaYOEWu/G11aiA0xtxzOTjMIxas0ik3aahScSUnV5qfJTaUdJaI7wHRxH1Ix5WeUaib9EbgZ7HYPKoL9SAVBurhohYAnR2NTaFChQoVqm/dBroq0Yl+lvSZAAAAAElFTkSuQmCC>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAbCAYAAACKlipAAAAEP0lEQVR4Xu2YWahVZRTHVzRQNFFGAxUSDVA20kQleq3AIsywSGkiCuolCEpoejkQ0fAgqehLaomUUKGBNGA93OqliaBoeqiHooKI6kkhBPP/c63V3p67zzl7n3uvHmv/4cfh7OE7Z6/522atWrVq9Z/QAeJOMS62ipl7nN3/dbCYJS4Th3ad66cDg7PFJebr9NMJYn58TkqtQ6q1zxxyrvhSPCd2iuv3PL1XdIFYFpzWdW4ywpgfiYfFfeJjc+MOUt6X9wI2urB8kXR0sFG8LJaIDeLG8kVN9Yj40PxPXGODI2G6NCN4VmwW55tn77A6TGwRD5SOXSc+F8cHVeL4V6ITpO42dxAOQNjp1eBJ8/+KDf8Q6+OaRjooeN3cu5N5+KnWUeIJ8Y640rx0NNXF4jcxu3QMg/1uXgV6VQKO/yMWBCnW+Ss+Ec79NWBdRBAsFVfF99q6XNwRfGfukFts9PrH4eJB8wxeaEVdr6NFYpu5Y1IniR/NqwJUieNVDmEd1nvIPHhfFJ8GZNUcq9drJoisGLPiT/0tnrLRdEiKyLvHirp+qw12DM/WyyFrgirhyCqHkBk7zNc90jxIKG2wyvx3Hovjp8Q9jXRtQArTVEddNPsXgtVW1PJe6ucQanyvOs/v/CzuD1KZOR0r1qGEAYMROsJ8WsXZBH4jkXrwtTiu69xUiNQlqplAzguaitJAc6fPPW1F46+jYR2CyJIvgjFxg1gntpuvi72wW5asY3bf5WLdH2yI8TfTlodt7M0aulfcZT4KXhrUFY6gz9HUae40+aYatoek0vmULdaYa17eGWnpbe+ZZwOQGSkcQtU5q3SsllqH9NdedUg2JaChT4d44HJTHKScoK4Wb5tPVzz4sMKIf5r3yRS9kpqPUXtt3gjOm81H1/L4erv41opStMIKG2LP1FAliymAxgVEUuo28Y1YLp4RrwTp7WPNd9Md8ag4UWwKXhPPm+/4GQF/Ml+LNQfpHPFmQEY1Hh0rxGRGhnVvDOkLGCsNdpG549iQosyiN4JDzAeIcfMde+oK8X1wZhzLpo4dyPLaYoTLTU33hIWH00nzgrfMowBnZGR1zKOPSIR3xenmpYk/0zRDpkPsCwiKxebN+RObuCFMh6SxyZCVJcgM3vHhsHKg8IzcAzR2rqPxs3MfNAFOEONc1YSAcEgakmiBcXGGuWMwNHsWONkKhxBN5Vo6Cg5BvFAcC+q+XKR0svsGnmFQ+TlV3GR+/aD90b/CWBj0JfMXYJ2gW2WHMF/D++blifKVGUJ9p+lNhUNYi9ES0tn94LrJ9JeREF7mNcla85du9JGqHSUOYfJiquAlH2Sas5PnO9PTUvOIyGntF/G4eRTyVvQz81TvLhFV+l86BLE5I2r7jZGZIfSMnHy6hTEaNa1Ww4mI/8D8dTITVat9rNYhIyaaMlMV/WYq9gKtWrVq1Wr/1y5Zh+9YY+kI/gAAAABJRU5ErkJggg==>

[image27]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAaCAYAAABsONZfAAAAtUlEQVR4XmNgGAUEgScQ7wHiR0DcB8UEgSYQTwXi/0C8EIqJAr4MtNCkAsWNQDwLiIuBOIOB2poygfgvFK8EYlUgDgLiOww4NCkC8RMgfg7FSkhy5Qw4NME8exWKRZDkCGo6AMU8SHI4NdkA8W8gfgjFkkhy1NUEcs4uIP4JxbZQcW4gXsEA0QSiQZgZKgcGMkB8CIr/MEBC8z4QH2eAaILhNUDMAtWDAlgZILbA2CimjwJKAQB+FUY1GhubVQAAAABJRU5ErkJggg==>

[image28]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAaCAYAAACHD21cAAABIElEQVR4Xu3SoUtDURQG8CMzKA6EKYhBhKHFYhsMhn/DQJjBf8G0oJgMYheLRWTDYJksDRbHwoJxIFgMFg0LZpHhvu+d777daVsS3Ac/eNz7zn3n3vvM/lfW5RpuIQMVeIZv6cN2KGC2oCOf5sVNOIVNOBcWXyUVUfLyDkM4hjnNhW5e4URjaUryBY+wEs3tS9d8gYkcCts5Mv/aDtThXnLp21EuhK3uQc98EbZ9KUvp21GmKlyAljQga76XXY2F67iBedUkWYMXqcYT5ot0hKc6cTg8zQ/h88+cCRfmR9LwFJ9kNZ4wb43tE/cZ7tYWoQ0Pcmf+JzF86cDG+1/WeJKpC4vmvdcknOAbDGx8Db+ugn97fFIbUIaC+TXN8vczAp+PSSYoj+QjAAAAAElFTkSuQmCC>

[image29]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAcCAYAAABRVo5BAAAA7klEQVR4Xu3SsQtBQRwH8JOIyKQMlI1sSpRi8AfYldHKrAxSZv+AxWQyKUoyGCxK/gBlY/AHmPn+3vvde3cXpbd63/oM7353737XnRD/mxws4Qpn6LAuVJV5WipwhAJ/h2DKbpDhcSdRRju1jFqNLSBi1KwdCLVXNmol1jfGrcjiE+aQUmrULgkrY07ibA8vdoeecI/xMZ4XyiRhAg/h/mDEfk4eLsLuglBHWurQYGYGsGMxo2YVm0xNAGbiS6t0oWsYM5osQ6/oAFmmJQ1bWLENtGEIJyi6U/V4XpgQ9hXI0Iuhs9IrCirjfvy4eQOlTzBCNl29+wAAAABJRU5ErkJggg==>

[image30]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAeCAYAAAD6t+QOAAAA2UlEQVR4Xu3SvQ7BUBwF8CtYfAwSidjEYrQwSMRkMRhswmjwAAZh8QQS8QI2E+8gMdlsBiQGi6fgnPY0zVULG3GSX9Le/2mb29aY700WZrKHuj22E4WaXKBsTV+Ed6MDZJ5mgbxVHssKIk8zKxyyRLyA4aZ7ktaaEz72KA0owQgWMvCr7u7P0pEC3KTtV98sd+EuS4hrnXsJbHYOa5nAFYpWQ0nCFvqSgA0MISdVt2pMHk5aIK/chJZUPirzYGfcF08hmBr3/XpflT+akzDEvBOFF6Q0o39+Ig+3Di3PGomtvQAAAABJRU5ErkJggg==>

[image31]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAcCAYAAABoMT8aAAAA2klEQVR4Xu3SvwsBcRjH8UcZRIpRmZRkViajwmKwGq02m92sjBaTzWozKBubP0FKERuD8uPzuOe67335OnWD5d71Wr7P956664iC9FpiaNARKfsBvYSowAX6ZF1mWXIWnaAoz3ysCXcoa+dpsYUJhN1jpwFZl/iyWkGcybAgLhYwhYh7TG1xg7o2e5UXR+gq5yEowUHwh+Szt3wvaIgHrGEuljCCnDDGH4/tIKPNPEvCSswg5h57Z78762mzn+Kfh9+d1bTZ16qwgSs5C/Ywhqhyz5jvBUFB/+8J5W44J4QIblIAAAAASUVORK5CYII=>

[image32]: <data:image/png;base64,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>

[image33]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABPklEQVR4Xu3TsUoDQRAG4BEVNKJBSGNpSkUstIloGsEuDxBEECwEsU4KG8FK0EohYGNloSSdPkOKtAZtLCzEwjew0f9n57Jzm/NINIWgP3yQzG42x9ysyJ/NlDqGB3iCBizCCUz7renJwp3ahiGt86AXuDS11HDTEZwr+yN+voJNU0vNQA/LQRuqKswZLIXFrzIDz+IaTsswbNYng++pGYEafBjvcAtzZl/PGYc9dS/+0DeYN/u+lTE4EHegbf6o4ih1hXO0FRY1eXiFkqmV1am49sSyK25Ik7IKjzAbLiQlmqEbcY9uwx6yXhG3j+vsJ68XLfitLpwvLvDetcS/gB1oiutZ9CcrUIS6Kmi9EzaRMxZ93jCSGszBvVZ88h/lEPbVGkzEVvsI39yF+Cu3Hl/uLwM9jOH9zKj//KZ8AvI+NrALxWx1AAAAAElFTkSuQmCC>

[image34]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAAbCAYAAAA3d3w1AAAB80lEQVR4Xu2WPUgcQRiGv6ARUQPxp1A0jURC0E7QJoKFEC0MJCQgWAULQbQyINqqYBMCNkEbtRAE01ppIQoWSSGEQGpDIJBgOi0Ef96X+Ybdm9vduz1chWMeeOCYb3dv3tn5WRGP566og9VuYxxj6mqM07BFvU8a4Vc47BbiKNtgj9WX8Bx+kiBIh5hw/9UevSfMA1jlNkZQGbIUOMDXcMYtFGIUXsEBp70N/la/SH7HOADzTlsUHGlrWp7CH2L6lzrYspjOM0iYbnim3kcw/t8SfA1P4EZuOZ5H6iHckfxdZxJeqq+cGsk6WB9cgK2SMthz9RTOhdq5dl7Af2LmN2WbS5bBuL1/hk/0977K3zSRNyoX5ncJbuYOtAaf2QtjyDIY1z0lNhhnlp1liXBt0T+w3akVQ1bB+Jb24Hv4Fo7AYzHTseDxUw+/qXxIbW65KG47GKc7nYUfxISyHkjwAhJfQtkGs5sGXXRqxdIkJlihw3dczBnpnpMuvepHyX8ezzAeOzyCaCxcmNw06JBTS8MUfKdG7ZwcwBUpvJs1wG21y6kRBrMfEZEDNAh/wQsJgv2Fm7AmdF2xVMAJdVfMt6dd8Nyu12GzvTgCLoEtye3PTzFfHITT/ShUt594pfa3JB7CTjHB+iX5DXk8Ho/H4yl3bgAxkXejgr2U9QAAAABJRU5ErkJggg==>

[image35]: <data:image/png;base64,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>

[image36]: <data:image/png;base64,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>

[image37]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAZCAYAAAA4/K6pAAABKUlEQVR4Xt3UMShFURzH8b96RCFKWRSrkI1FUvRisIiN2WZ4JRmUxWIxMVFKJjZleJMyvk0pqxKDsjPI9+/81Ln3ed69vcn71ade53/vufec/3nX7Pe0YAWPeMMHXrApXq+bHrRauHgIY/qd6eYmia91DTcoYzBRzZBR3GEfn1hIlutnC7cYxqyFjmROAZc4t5xtm5RVPFiYYNkyrt+fOiP++u/YsxwTxJnDK8ZT4+3SmRqvSsMTlHCPvtT4jvj5+DPHFrrg+5IrXeL99w38SQe2cSQ1lzAgT1iKxqctdOdC+qNaIlPybNUbOI8DqXm41qWC3mjcb/BXL8pEVPtezzVOcSa7Ud3jrTvEhozERV+PH9sTXInvQzr+Z2qTRBqewOMfzEV0yz/KF6uuMcIWUTELAAAAAElFTkSuQmCC>

[image38]: <data:image/png;base64,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>

[image39]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAZCAYAAAA14t7uAAABRElEQVR4Xu3UvytHURjH8UcoLAYKsSgGEoPNYCH5riYi/gGjKJSyGZQsJiSxkInFbGKWQQrJIosRg/fT86h77vf6dd27yKdeyzmnc8+v54r8JyENWHMbsb52HLlXLIXdnyeXiVtwjAe35e2VmMcemt0slr3/W9EV37gZ1OMAwyiJjPtxuvDkpnCCnmBEyhTw4h4xFHanj27/3l1iNOxOlzLsi12a2sWm/PJsNY24FlvluwvURcZ8lHJUu6LkNvGg2Nm2OX2vt2JP7auMYNEVZVWsqiqcnu0KTlETGaepRXesLTE68ByTsXatxjtMi31It6zWxXaiFz6BbTS5IP24Ett+PON4xiHO3JzYBzrRJ/aKOlyQVrFyToquVCtyQJIvSCfbEfunqMyiRTUmVvpKjyeTLIhN3usySymq4o1ZJLeJ/1DeABiaPtnOaQlGAAAAAElFTkSuQmCC>

[image40]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAZCAYAAAA14t7uAAABVUlEQVR4Xu3UvytFYRgH8EcobkoyWEzSneRHSjFYWC2Wmyizf4CSCJtRiSySLCaLMulmUlYZlGQyKIONhe+353nz3LfrdXHOIt/6DPd9znnOeX+cK/KfKqmDopmHXWcVBk19uKHW5NKYzc7hzNzBI+zBMbzCm7mCbr0tnQG4gX43tg9laLHfzbBs2NzXPs0GzIkuBS+msmhzn0ZzBM/QV1lOp8PcwkJUC5mGFxiOC6nwLYjrOx7VQibkB288aR6gK6qFLMIFtMaFVDbNCTRFtXbDpjNunOvOhyQflEvjNrg08cbxxPCjoR3RZiFTsGaqhrt8b3rcOM/wEmwZ/q45fKN10a+PuHFDog2voWTXUEgDzMIBdJqK8IJt+fhk6QlORY+Wn7ZPL4yJfkicoZ/lr8Nmh6LL860l+ircZJ6QEcPZZ5IV0eajJrPwv7kQD2aR3Br/obwDAZ9Co8K6vSgAAAAASUVORK5CYII=>

[image41]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAcCAYAAACK7SRjAAABeElEQVR4Xu3UTysFURgG8FcoRIiyoKwslH+FlMUt3Xu/gCyIsrSwoygpxdIGUbIg3VjIB5CtUrJWNhY2rGzkA3ie+77TPXOs7pyZkjz16945Z+bMnL8i//lNGYFzeIaCVxecBpiFd+j36lLJEjxCu18Rmhq4gDP7H5RamDCromPOr+bXB6UVrmDH9MEtfMG4c1+iZNY4x3MPbqDRMMvwBJ12nShcZh8w75UfwDXUeeX1oj11w/niiqLY5LPRTxh2ylrgDlacsihzsO2VDcKpaXYr1uEFupwy9uZNdGdOeXVVhQ3cS6VLtAavohO7CW2waErQU35S752GIyiaWNgNbpZd2Dcb8CA67jMwBHnD82ag/KQO5ZjoXuAQ/hjGTBtn2L0O0cOKGP5yOKKwQeKHRMuV4bMnosOb+PTkxNMCTEpliXKuuAG7TaJsGb4g55SPwqXEe111uFGoya6jxrhP+MJUcwyHoru416sLDr+am4vHQerJtPE/nG9vHT2mBD9UsAAAAABJRU5ErkJggg==>

[image42]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAcCAYAAAB2+A+pAAABoElEQVR4Xu2VwStEURTGP6EIKSlEGQtKKYSFhWLHgiQL/4KNrVI0JVslIjZ2tpTCirFUykrZWFha2PkDfF/nXO81zXuTzDTF/OrXNO/d7rn3nnPuA6r8NzLuBb2lq7Qm9r4s9NJ7d5i202vaFx9UaurpKc26opne0Tn/Xxam6BsdckUHfaXzYVCpUQ4P6A1tdMUg/UAZAyuXz/QK0Y6n6Q79pBPfI0tMxQJrYgVQoOWYWohyrFyXBeVQuVROA6roHKzS0/p4hJ74bz4ZuoeUrliHHbWOPKDjfqezsWdJbCC5AJdg8xdEL3OwXQay9BJRhaehiZMC63li4EnYDdWC6Mp8oKPRELTSLXcNtrBOf5cfeIAe00165O8Loltrn27DellqMQHleJcuuEIFeQY7kRBYi5PntN/HpR51xQILTd4GW4SMo9zrazXmii5YXeg3BNaHRT75c5Ga42LUwXantgitoQDqc+0wBO52c7THx/0qsNAn89BdgRXNOKx/H2EnknEXYcU3A1vwi48r1Os/ognpl4pogKWoFsXHVqnyR/gCP3pNRkwW8joAAAAASUVORK5CYII=>

[image43]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACMAAAAbCAYAAAD28DaZAAABtklEQVR4Xu3VTyhEURQG8KOQfyWxERt2otgSRaz8K0WKjZKUpKwsTcnCAoVJYoGisFGSlDTZUnayEcpONrZKvq9z7sybVyzovUa9r36NOe+Oe+a+O/eJRPmHKTSLcAEHUJw2IsRkTDOc9MwMWm0eYm5AWMmCOTgx+VafgVPIs/ehpA7eoNe4cGUSUOSpBZ4YPEGFYbgaXBXuHe6jUFIC13ALTYYrNQLPsJUcGULq4R22od8jBp8w7AaGkR74gGZfnZuX+6jGVw80bOYFKj01btiE6C3K9tQDT8Y1w41a7qm1wAPUemqhhL+cG9FmeArTOYzZ9QJYh2OYhA0zJXpYUheswjI0wJC5g33YhXvok9QpX2rSwtuwAmtwaCZEJ3Fho5eiZxD/Jp5BZaKrx2cYb201bIqeUcQfAb8AtwAb4PhO0QX4NpyYXbp/4g8n3xGd0DWTsFfe5itJHQmtol+QOOketIk23C16fv1pH/7UTKPoKrlHBlfPNcNnHJuIQ7vore6wcb8KV2oWHkUfpgvm1eqccBqWYBQG9GPJjBvuxSOoSr8cTHIg11+U1CoxvO7di1GiRAkkXxhzTWqXGsMFAAAAAElFTkSuQmCC>

[image44]: <data:image/png;base64,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>

[image45]: <data:image/png;base64,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>

[image46]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAbCAYAAAADDr0pAAABy0lEQVR4Xu2WvSuGURjGb0X5yEcoicIgi6J8lFIWi8FosojBwqKsNlmV0WCSgTLIH2CTDBYpUshkUTaLXFfnHO5u59V5HyXp/OrX6T3P6bnu937Oc95XJJPJZDL/gT64ANthnXcGzsGGz2U/xuYwo3BOD9yAy/ABHnqHxN30DHZ+rC5OLIcZhXPm4SRcgbew20vYmXs46z//hFhOoFBOI6yFB3AXVnjJAHwRF0a4dsyPtBxiOQGbQ5phjfocpRVewkUzzw68ievUtLhH3eZHyrlySMkZh9vwUdw2+paUG/7Jwrn4CY6oOT7KHXgqrtg9dZ0j5Vy1n0vB5oRtGXLC9uOev5CEwtmBZ9iv5kbhtR/tjcJpcC7uS5EueAePpPTetDm8t84J2LwoleJeGL7p++JeEHoCJ/wae6NQOOd4jfAou4I3ak4Ty2GGzgnYvCh63/Gxt3j1W8+usru2cN3xwJrEC4/l6BNMk1Q49x0fH8dSMIhdCms4Us7pPc5i1s1cICUnkFT4MXyFq7DDXNNwD27BXrjpHVbX2bkliRc2KOk5U+LOeZ7r/HXlXwT6BX47ykdeZa5Z2Emu5Wi7ysLr/WhpkvJyMplM5pd5Bwr5aQr8hFnaAAAAAElFTkSuQmCC>

[image47]: <data:image/png;base64,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>

[image48]: <data:image/png;base64,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>

[image49]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAYCAYAAAB9ejRwAAACIUlEQVR4Xu2UMUiVURTH/1KBoWChkJKQGdRQ4FDpIkIQLVZES0JLQxg4NOTgEjhJq0TRokhDaDRWSzkELUEQJFQiBM8Qg9qEGhqs//+de/ju9737XsRbJL4//Hjvne/e8/7fueceoNR/ol3kCBkOtOcfN1QL6YPta80/qmo36YKtc7WRzkBS3eQ5uUOuBl6Ty/GiOor3jpMVMppbAfSQdfKLfCGb5DsZDNRI7mfJvfDddYJ8IMejWFF7yVOyCKuGdIasksMBSabWyAb5TO6T3vAsqR1p6iCpwI4slnpApm4V4rEGyBaZimL95CuyNpBk6iH+oU9Pk5/kQiGuBK9gyepJe34jb8r7Zy7gMTe1D+nLkJMnrmdqGXZTUvIXSlVKJvyFVHVdhmdkHpZXLaO8ydx/MyXqlb2DvCF3o9hFWL7HAY0a/fE0suu/n7yFGRNxL1fVjCnpFPlIrpAh8oB8Q75SKelZJaC+zqmZnnKpEufICDkGOz4dqR+rzN6GVdalvD8CJ6N4VX77bhTiB2DXN+6XlGTmPLIj0FTX1ddIEZIMbJOz4bfHKoGaSimZZlRqTmneeGLNlU/kCez2CK/me1i/7CELsCPU3PLZdY1cR5Zfa9+hQU9Jh2CNdxNWSvGCTCDb4KaKfzgJa+gx8gg2SONjkmReZmdgs+slWYKtK67NSW+pptVxiIaLI8l0H+wI9Zl8a1j8KLmExutKlSpVKtYf+vlyhSM12wUAAAAASUVORK5CYII=>

[image50]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAYCAYAAAB9ejRwAAACL0lEQVR4Xu2Vv2sVQRDHJ6igKFgoqERIVMRCQUHFRiQhIoImhDQKgoVFBAsRLfwDLMRORbAJiIWIWoqNWDywCaRSMEkTiBAQU1rY+eP7cWZ9e7eXvCKNyH3hw3s3uzs3Ozs7Z9bqP9E6sU+cDLZUh1dVnxg0X7exOlRoqxgxn886aNRO8UbcFZeC92Iin7SC8rWT4qM4V5nh2iDuibfm/h+IG0EhIr0vHsX/pEPikziY2eraJF6L52J92IbFvNgTIPzeES/Ng9tu7rsTFKfyTwbVLxbNU5orLbxZs+c6LL6J25ltr/hi3TJAbPCrOB3PbOCKGA+KujouvovRmp3oO+JpzZ6LNb+sGtQu8VlMBYhxAt0vjooh63EhkuOVgnonNleH/iptqClTbAbIwjOxLB6bB3TZ/EIcCQr1CgqKMw9xvafFw8w2Zu7vRcCcjvgpzsYcAn0Sdij8ryUodEzMigvihHk2yErKFMdEyyB7ZDGJ7FKPQG1WtJaaSuJ4z4hT4oB5ALw0HSu1RZ1Rb0mM/QiGMvsfpdt3tWbfIRasWi9NIpjz1r1BdPUl8xsHCN/YdsczWjVTOKNHNfUp+k1yjMM58cr8SCBl84PYZt6DqBWOkGufehf9Cl/D8Zxqih4H9LtCA2JGXDe/ssDn4Jp1A01B1V94y7ygL5rfMhopxV0Xnyxqb9L8k8RnDJ959gqxS4qW44Amx00i6EHzI+Q3z3ZdZJPa5T28r1WrVq166TexIni/qyW/YgAAAABJRU5ErkJggg==>