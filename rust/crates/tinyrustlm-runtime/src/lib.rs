#![forbid(unsafe_code)]
#![doc = "Canonical SLM2 conversation runtime and scalar correctness authority."]

mod conversation;
mod scalar;

pub use conversation::{
    ConversationPolicy, ConversationRuntime, RuntimeError, RuntimeMemberResolver, RuntimeOutput,
    RuntimeState, RuntimeStep,
};
pub use scalar::{
    select_greedy, MemoryPlan, RuntimePolicy, ScalarModel, ScalarRuntimeError, ScalarSession,
    ScalarTraceSink, ScalarTraceStage,
};
