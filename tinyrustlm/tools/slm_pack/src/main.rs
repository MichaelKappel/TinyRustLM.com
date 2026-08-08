//! TinyRustLM `.slm` packing utility.
// The packer has many command/workflow helpers that intentionally keep evidence
// paths explicit at call sites. Refactoring all of them into option structs is a
// broader API-design pass, not a correctness lint fix.
#![allow(clippy::too_many_arguments)]

mod adapter;
mod admission;
mod blend;
mod browser_bundle;
mod candidate;
mod compatibility;
mod composition_graph;
mod crossover;
mod dare;
mod delta;
mod distillation;
mod federated;
mod gguf;
mod ledger;
mod lineage;
mod mutation;
mod parent_pool;
mod peer_offer;
mod population;
mod promotion;
mod provenance;
mod prune;
mod quant_writer;
mod safetensors;
mod selector;
mod sign_merge;
mod slm_validate;
mod soup;
mod sparse_delta;
mod tensor_writer;
mod tokenizer_writer;
mod trained_adapter_source;
mod trained_source;
mod writer;

use std::env;
use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use quant_writer::{
    pack_q4_pair, pack_q5_codes, quantize_q4_block, quantize_q5_block, quantize_q8_row,
};
use tensor_writer::{
    tiny_fixture_tensors, tiny_fixture_tensors_with_dtype, tiny_fixture_tied_tensors,
    tinylm16_f32_tensors, tinylm16_q4_tensors, tinylm16_q8_tensors, ModelShape, TensorSpec,
    DTYPE_F32, DTYPE_Q4_0, DTYPE_Q5_0, DTYPE_Q8_0,
};
use tokenizer_writer::{ByteTokenizerSection, TokenizerSection};
use writer::{align_to_64, write_f32, write_u32, write_u64};

const HEADER_LEN: usize = 108;
const TENSOR_ENTRY_LEN: usize = 64;
const FLAG_TIED_OUTPUT: u32 = 1;

fn main() {
    if let Err(error) = run() {
        eprintln!("tinyrustlm-slm-pack: {error}");
        std::process::exit(1);
    }
}

fn run() -> io::Result<()> {
    let mut args = env::args().skip(1);
    let Some(output) = args.next() else {
        print_usage();
        return Ok(());
    };
    if matches!(output.as_str(), "-h" | "--help" | "help") {
        print_usage();
        return Ok(());
    }
    if output == "validate" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate requires an input .slm path",
            ));
        };
        return slm_validate::validate_path(Path::new(&input));
    }
    if output == "composition-graph" {
        let Some(model) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "composition-graph requires an input .slm path",
            ));
        };
        let Some(authority) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "composition-graph requires an authority JSON path",
            ));
        };
        let Some(graph) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "composition-graph requires an output .acg1 path",
            ));
        };
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "composition-graph received too many arguments",
            ));
        }
        let outcome = composition_graph::write_path(
            Path::new(&model),
            Path::new(&authority),
            Path::new(&graph),
        )?;
        print_composition_graph_outcome(&outcome);
        return Ok(());
    }
    if output == "inspect-composition-graph" {
        let Some(model) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "inspect-composition-graph requires an input .slm path",
            ));
        };
        let Some(graph) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "inspect-composition-graph requires an input .acg1 path",
            ));
        };
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "inspect-composition-graph received too many arguments",
            ));
        }
        let outcome = composition_graph::inspect_path(Path::new(&model), Path::new(&graph))?;
        print_composition_graph_outcome(&outcome);
        return Ok(());
    }
    if output == "inspect-safetensors" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "inspect-safetensors requires an input .safetensors path",
            ));
        };
        let output_report = args.next();
        return safetensors::inspect_path(
            Path::new(&input),
            output_report.as_deref().map(Path::new),
        );
    }
    if output == "inspect-gguf" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "inspect-gguf requires an input .gguf path",
            ));
        };
        let output_report = args.next();
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "inspect-gguf received too many arguments",
            ));
        }
        return gguf::inspect_path(Path::new(&input), output_report.as_deref().map(Path::new));
    }
    if output == "plan-safetensors-source" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "plan-safetensors-source requires an input .safetensors path",
            ));
        };
        let Some(shape_name) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "plan-safetensors-source requires a target source shape",
            ));
        };
        let output_plan = args.next();
        return safetensors::plan_source_path(
            Path::new(&input),
            &shape_name,
            output_plan.as_deref().map(Path::new),
        );
    }
    if output == "plan-gguf-source" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "plan-gguf-source requires an input .gguf path",
            ));
        };
        let Some(shape_name) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "plan-gguf-source requires a target source shape",
            ));
        };
        let output_plan = args.next();
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "plan-gguf-source received too many arguments",
            ));
        }
        return gguf::plan_source_path(
            Path::new(&input),
            &shape_name,
            output_plan.as_deref().map(Path::new),
        );
    }
    if output == "review-safetensors-candidate" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "review-safetensors-candidate requires an input .safetensors path",
            ));
        };
        let Some(shape_name) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "review-safetensors-candidate requires a target source shape",
            ));
        };
        let Some(quantization) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "review-safetensors-candidate requires an output quantization",
            ));
        };
        let Some(source_model_id) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "review-safetensors-candidate requires a source model id",
            ));
        };
        let Some(source_model_sha) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "review-safetensors-candidate requires a source model sha",
            ));
        };
        let Some(source_config_checksum) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "review-safetensors-candidate requires a source config checksum",
            ));
        };
        let Some(source_tokenizer_checksum) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "review-safetensors-candidate requires a source tokenizer checksum",
            ));
        };
        let Some(source_license_route) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "review-safetensors-candidate requires a source license route",
            ));
        };
        let Some(output_review) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "review-safetensors-candidate requires an output review path",
            ));
        };
        let reference_prompt_route = optional_cli_arg(args.next());
        let reference_output_checksum = optional_cli_arg(args.next());
        let eval_cases_route = optional_cli_arg(args.next());
        let source_config_route = optional_cli_arg(args.next());
        let source_tokenizer_route = optional_cli_arg(args.next());
        return safetensors::review_candidate_path(
            Path::new(&input),
            &shape_name,
            &quantization,
            &source_model_id,
            &source_model_sha,
            &source_config_checksum,
            &source_tokenizer_checksum,
            &source_license_route,
            Path::new(&output_review),
            reference_prompt_route.as_deref(),
            reference_output_checksum.as_deref(),
            eval_cases_route.as_deref(),
            source_config_route.as_deref(),
            source_tokenizer_route.as_deref(),
        );
    }
    if output == "extract-safetensors-source" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "extract-safetensors-source requires an input .safetensors path",
            ));
        };
        let Some(shape_name) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "extract-safetensors-source requires a target source shape",
            ));
        };
        let Some(output_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "extract-safetensors-source requires an output source directory",
            ));
        };
        let candidate_review = args.next();
        return safetensors::extract_source_path_with_review(
            Path::new(&input),
            &shape_name,
            Path::new(&output_dir),
            candidate_review.as_deref().map(Path::new),
        );
    }
    if output == "extract-gguf-source" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "extract-gguf-source requires an input .gguf path",
            ));
        };
        let Some(shape_name) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "extract-gguf-source requires a target source shape",
            ));
        };
        let Some(output_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "extract-gguf-source requires an output source directory",
            ));
        };
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "extract-gguf-source received too many arguments",
            ));
        }
        return gguf::extract_source_path(Path::new(&input), &shape_name, Path::new(&output_dir));
    }
    if output == "convert-safetensors-trained" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-safetensors-trained requires an input .safetensors path",
            ));
        };
        let Some(shape_name) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-safetensors-trained requires a target source shape",
            ));
        };
        let Some(output_source_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-safetensors-trained requires an output source directory",
            ));
        };
        let Some(output_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-safetensors-trained requires an output .slm path",
            ));
        };
        let quantization = args.next().unwrap_or_else(|| "f32".to_string());
        let candidate_review = args.next();
        return safetensors::convert_source_path_with_review(
            Path::new(&input),
            &shape_name,
            Path::new(&output_source_dir),
            Path::new(&output_slm),
            &quantization,
            candidate_review.as_deref().map(Path::new),
        );
    }
    if output == "convert-gguf-trained" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-gguf-trained requires an input .gguf path",
            ));
        };
        let Some(shape_name) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-gguf-trained requires a target source shape",
            ));
        };
        let Some(output_source_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-gguf-trained requires an output source directory",
            ));
        };
        let Some(output_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-gguf-trained requires an output .slm path",
            ));
        };
        let quantization = args.next().unwrap_or_else(|| "f32".to_string());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-gguf-trained received too many arguments",
            ));
        }
        return gguf::convert_source_path(
            Path::new(&input),
            &shape_name,
            Path::new(&output_source_dir),
            Path::new(&output_slm),
            &quantization,
        );
    }
    if output == "convert-huggingface-request" {
        let Some(request_json) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-huggingface-request requires a conversion request JSON path",
            ));
        };
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-huggingface-request requires an input .safetensors path or shard directory",
            ));
        };
        let Some(output_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-huggingface-request requires an output directory",
            ));
        };
        let source_shape = args.next();
        let quantization = args.next();
        let candidate_review = optional_cli_arg(args.next());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-huggingface-request received too many arguments",
            ));
        }
        return safetensors::convert_huggingface_request_path(
            Path::new(&request_json),
            Path::new(&input),
            Path::new(&output_dir),
            source_shape.as_deref(),
            quantization.as_deref(),
            candidate_review.as_deref().map(Path::new),
        );
    }
    if output == "inspect-huggingface-conversion-request" {
        let Some(request_json) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "inspect-huggingface-conversion-request requires a conversion request JSON path",
            ));
        };
        let output_report = args.next();
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "inspect-huggingface-conversion-request received too many arguments",
            ));
        }
        return safetensors::inspect_huggingface_conversion_request_path(
            Path::new(&request_json),
            output_report.as_deref().map(Path::new),
        );
    }
    if output == "inspect-huggingface-conversion-receipt" {
        let Some(receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "inspect-huggingface-conversion-receipt requires a conversion receipt path",
            ));
        };
        let Some(request_json) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "inspect-huggingface-conversion-receipt requires a conversion request JSON path",
            ));
        };
        let Some(preflight) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "inspect-huggingface-conversion-receipt requires a conversion preflight path",
            ));
        };
        let Some(output_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "inspect-huggingface-conversion-receipt requires an output .slm path",
            ));
        };
        let Some(output_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "inspect-huggingface-conversion-receipt requires an output manifest path",
            ));
        };
        return safetensors::inspect_huggingface_conversion_receipt_path(
            Path::new(&receipt),
            Path::new(&request_json),
            Path::new(&preflight),
            Path::new(&output_slm),
            Path::new(&output_manifest),
        );
    }
    if output == "write-safetensors-fixture" {
        let Some(output_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-safetensors-fixture requires an output .safetensors path",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        let name_mode = args.next().unwrap_or_else(|| "huggingface".to_string());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-safetensors-fixture received too many arguments",
            ));
        }
        return safetensors::write_safetensors_fixture_path(
            Path::new(&output_path),
            &shape_name,
            &name_mode,
        );
    }
    if output == "write-safetensors-fixture-shards" {
        let Some(output_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-safetensors-fixture-shards requires an output directory",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        let name_mode = args.next().unwrap_or_else(|| "huggingface".to_string());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-safetensors-fixture-shards received too many arguments",
            ));
        }
        return safetensors::write_safetensors_fixture_shards_path(
            Path::new(&output_dir),
            &shape_name,
            &name_mode,
        );
    }
    if output == "write-gguf-fixture" {
        let Some(output_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-fixture requires an output .gguf path",
            ));
        };
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-fixture received too many arguments",
            ));
        }
        return gguf::write_fixture_path(Path::new(&output_path));
    }
    if output == "write-gguf-source-fixture" {
        let Some(output_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-source-fixture requires an output .gguf path",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-source-fixture received too many arguments",
            ));
        }
        return gguf::write_source_fixture_path(Path::new(&output_path), &shape_name);
    }
    if output == "write-gguf-q8-source-fixture" {
        let Some(output_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q8-source-fixture requires an output .gguf path",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q8-source-fixture received too many arguments",
            ));
        }
        return gguf::write_q8_source_fixture_path(Path::new(&output_path), &shape_name);
    }
    if output == "write-gguf-q8-1-source-fixture" {
        let Some(output_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q8-1-source-fixture requires an output .gguf path",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q8-1-source-fixture received too many arguments",
            ));
        }
        return gguf::write_q8_1_source_fixture_path(Path::new(&output_path), &shape_name);
    }
    if output == "write-gguf-q8-k-source-fixture" {
        let Some(output_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q8-k-source-fixture requires an output .gguf path",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q8-k-source-fixture received too many arguments",
            ));
        }
        return gguf::write_q8_k_source_fixture_path(Path::new(&output_path), &shape_name);
    }
    if output == "write-gguf-q2-k-source-fixture" {
        let Some(output_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q2-k-source-fixture requires an output .gguf path",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q2-k-source-fixture received too many arguments",
            ));
        }
        return gguf::write_q2_k_source_fixture_path(Path::new(&output_path), &shape_name);
    }
    if output == "write-gguf-q3-k-source-fixture" {
        let Some(output_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q3-k-source-fixture requires an output .gguf path",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q3-k-source-fixture received too many arguments",
            ));
        }
        return gguf::write_q3_k_source_fixture_path(Path::new(&output_path), &shape_name);
    }
    if output == "write-gguf-q6-k-source-fixture" {
        let Some(output_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q6-k-source-fixture requires an output .gguf path",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q6-k-source-fixture received too many arguments",
            ));
        }
        return gguf::write_q6_k_source_fixture_path(Path::new(&output_path), &shape_name);
    }
    if output == "write-gguf-q4-k-source-fixture" {
        let Some(output_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q4-k-source-fixture requires an output .gguf path",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q4-k-source-fixture received too many arguments",
            ));
        }
        return gguf::write_q4_k_source_fixture_path(Path::new(&output_path), &shape_name);
    }
    if output == "write-gguf-q4-source-fixture" {
        let Some(output_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q4-source-fixture requires an output .gguf path",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q4-source-fixture received too many arguments",
            ));
        }
        return gguf::write_q4_source_fixture_path(Path::new(&output_path), &shape_name);
    }
    if output == "write-gguf-q4-1-source-fixture" {
        let Some(output_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q4-1-source-fixture requires an output .gguf path",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q4-1-source-fixture received too many arguments",
            ));
        }
        return gguf::write_q4_1_source_fixture_path(Path::new(&output_path), &shape_name);
    }
    if output == "write-gguf-q5-source-fixture" {
        let Some(output_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q5-source-fixture requires an output .gguf path",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q5-source-fixture received too many arguments",
            ));
        }
        return gguf::write_q5_source_fixture_path(Path::new(&output_path), &shape_name);
    }
    if output == "write-gguf-q5-1-source-fixture" {
        let Some(output_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q5-1-source-fixture requires an output .gguf path",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q5-1-source-fixture received too many arguments",
            ));
        }
        return gguf::write_q5_1_source_fixture_path(Path::new(&output_path), &shape_name);
    }
    if output == "write-gguf-q5-k-source-fixture" {
        let Some(output_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q5-k-source-fixture requires an output .gguf path",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "write-gguf-q5-k-source-fixture received too many arguments",
            ));
        }
        return gguf::write_q5_k_source_fixture_path(Path::new(&output_path), &shape_name);
    }
    if output == "browser-converted-trained-bundle" {
        let Some(root) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "browser-converted-trained-bundle requires an output tinyrustlm root",
            ));
        };
        let Some(source_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "browser-converted-trained-bundle requires an input source directory",
            ));
        };
        let Some(composition_graph_root) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "browser-converted-trained-bundle requires a composition graph directory",
            ));
        };
        let quantization = args.next().unwrap_or_else(|| "q8_0".to_string());
        let eval_cases = args.next();
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "browser-converted-trained-bundle received too many arguments",
            ));
        }
        if let Some(eval_cases) = eval_cases {
            return browser_bundle::write_converted_trained_bundle_path_with_eval_cases(
                Path::new(&root),
                Path::new(&source_dir),
                Path::new(&composition_graph_root),
                &quantization,
                Path::new(&eval_cases),
            );
        }
        return browser_bundle::write_converted_trained_bundle_path(
            Path::new(&root),
            Path::new(&source_dir),
            Path::new(&composition_graph_root),
            &quantization,
        );
    }
    if output == "browser-safetensors-trained-bundle" {
        let Some(root) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "browser-safetensors-trained-bundle requires an output tinyrustlm root",
            ));
        };
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "browser-safetensors-trained-bundle requires an input .safetensors path",
            ));
        };
        let Some(shape_name) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "browser-safetensors-trained-bundle requires a target source shape",
            ));
        };
        let Some(output_source_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "browser-safetensors-trained-bundle requires an output source directory",
            ));
        };
        let Some(composition_graph_root) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "browser-safetensors-trained-bundle requires a composition graph directory",
            ));
        };
        let quantization = args.next().unwrap_or_else(|| "q8_0".to_string());
        let (eval_cases, candidate_review) =
            split_browser_safetensors_bundle_tail(args.next(), args.next());
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "browser-safetensors-trained-bundle received too many arguments",
            ));
        }
        return safetensors::browser_bundle_path_with_eval_cases_and_review(
            Path::new(&input),
            &shape_name,
            Path::new(&output_source_dir),
            Path::new(&root),
            Path::new(&composition_graph_root),
            &quantization,
            eval_cases.as_deref().map(Path::new),
            candidate_review.as_deref().map(Path::new),
        );
    }
    if output == "runtime-wasm-manifest" {
        let Some(wasm_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "runtime-wasm-manifest requires an input WASM path",
            ));
        };
        let Some(manifest_path) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "runtime-wasm-manifest requires an output manifest path",
            ));
        };
        return browser_bundle::write_runtime_wasm_manifest_path(
            Path::new(&wasm_path),
            Path::new(&manifest_path),
        );
    }
    if output == "compatibility" {
        let Some(left) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "compatibility requires a left parent .slm path",
            ));
        };
        let Some(right) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "compatibility requires a right parent .slm path",
            ));
        };
        let output_report = args.next();
        return compatibility::report_path(
            Path::new(&left),
            Path::new(&right),
            output_report.as_deref().map(Path::new),
        );
    }
    if output == "lineage-template" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "lineage-template requires an input compatibility report path",
            ));
        };
        let Some(output_lineage) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "lineage-template requires an output lineage path",
            ));
        };
        let Some(candidate_id) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "lineage-template requires a candidate id",
            ));
        };
        let Some(operator_id) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "lineage-template requires an operator id",
            ));
        };
        let resource_budget = args
            .next()
            .unwrap_or_else(|| "browser-local-constrained".to_string());
        return lineage::write_template_path(
            Path::new(&compatibility_report),
            Path::new(&output_lineage),
            &candidate_id,
            &operator_id,
            &resource_budget,
        );
    }
    if output == "validate-lineage" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-lineage requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-lineage requires an input lineage path",
            ));
        };
        return lineage::validate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
        );
    }
    if output == "blend-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "blend-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "blend-candidate requires an input lineage path",
            ));
        };
        let Some(left_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "blend-candidate requires a left parent .slm path",
            ));
        };
        let Some(right_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "blend-candidate requires a right parent .slm path",
            ));
        };
        let Some(output_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "blend-candidate requires an output candidate .slm path",
            ));
        };
        let Some(output_receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "blend-candidate requires an output operator receipt path",
            ));
        };
        let parent0_weight_ppm = args.next().unwrap_or_else(|| "500000".to_string());
        return blend::write_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&left_parent),
            Path::new(&right_parent),
            Path::new(&output_slm),
            Path::new(&output_receipt),
            &parent0_weight_ppm,
        );
    }
    if output == "validate-blend-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-blend-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-blend-candidate requires an input lineage path",
            ));
        };
        let Some(left_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-blend-candidate requires a left parent .slm path",
            ));
        };
        let Some(right_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-blend-candidate requires a right parent .slm path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-blend-candidate requires a candidate .slm path",
            ));
        };
        let Some(receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-blend-candidate requires an input operator receipt path",
            ));
        };
        return blend::validate_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&left_parent),
            Path::new(&right_parent),
            Path::new(&candidate_slm),
            Path::new(&receipt),
        );
    }
    if output == "crossover-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "crossover-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "crossover-candidate requires an input lineage path",
            ));
        };
        let Some(left_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "crossover-candidate requires a left parent .slm path",
            ));
        };
        let Some(right_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "crossover-candidate requires a right parent .slm path",
            ));
        };
        let Some(output_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "crossover-candidate requires an output candidate .slm path",
            ));
        };
        let Some(output_receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "crossover-candidate requires an output operator receipt path",
            ));
        };
        let crossover_seed = args.next();
        let parent0_keep_ppm = args.next();
        return crossover::write_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&left_parent),
            Path::new(&right_parent),
            Path::new(&output_slm),
            Path::new(&output_receipt),
            crossover_seed.as_deref(),
            parent0_keep_ppm.as_deref(),
        );
    }
    if output == "validate-crossover-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-crossover-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-crossover-candidate requires an input lineage path",
            ));
        };
        let Some(left_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-crossover-candidate requires a left parent .slm path",
            ));
        };
        let Some(right_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-crossover-candidate requires a right parent .slm path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-crossover-candidate requires a candidate .slm path",
            ));
        };
        let Some(receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-crossover-candidate requires an input operator receipt path",
            ));
        };
        return crossover::validate_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&left_parent),
            Path::new(&right_parent),
            Path::new(&candidate_slm),
            Path::new(&receipt),
        );
    }
    if output == "mutation-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "mutation-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "mutation-candidate requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "mutation-candidate requires a base parent .slm path",
            ));
        };
        let Some(reference_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "mutation-candidate requires a reference parent .slm path",
            ));
        };
        let Some(output_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "mutation-candidate requires an output candidate .slm path",
            ));
        };
        let Some(output_receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "mutation-candidate requires an output operator receipt path",
            ));
        };
        let mutation_seed = args.next();
        let mutation_rate_ppm = args.next();
        let mutation_magnitude_ppm = args.next();
        return mutation::write_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&reference_parent),
            Path::new(&output_slm),
            Path::new(&output_receipt),
            mutation_seed.as_deref(),
            mutation_rate_ppm.as_deref(),
            mutation_magnitude_ppm.as_deref(),
        );
    }
    if output == "validate-mutation-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-mutation-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-mutation-candidate requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-mutation-candidate requires a base parent .slm path",
            ));
        };
        let Some(reference_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-mutation-candidate requires a reference parent .slm path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-mutation-candidate requires a candidate .slm path",
            ));
        };
        let Some(receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-mutation-candidate requires an input operator receipt path",
            ));
        };
        return mutation::validate_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&reference_parent),
            Path::new(&candidate_slm),
            Path::new(&receipt),
        );
    }
    if output == "prune-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "prune-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "prune-candidate requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "prune-candidate requires a base parent .slm path",
            ));
        };
        let Some(reference_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "prune-candidate requires a reference parent .slm path",
            ));
        };
        let Some(output_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "prune-candidate requires an output candidate .slm path",
            ));
        };
        let Some(output_receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "prune-candidate requires an output operator receipt path",
            ));
        };
        let keep_ppm = args.next();
        let floor_ppm = args.next();
        return prune::write_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&reference_parent),
            Path::new(&output_slm),
            Path::new(&output_receipt),
            keep_ppm.as_deref(),
            floor_ppm.as_deref(),
        );
    }
    if output == "validate-prune-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-prune-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-prune-candidate requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-prune-candidate requires a base parent .slm path",
            ));
        };
        let Some(reference_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-prune-candidate requires a reference parent .slm path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-prune-candidate requires a candidate .slm path",
            ));
        };
        let Some(receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-prune-candidate requires an input operator receipt path",
            ));
        };
        return prune::validate_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&reference_parent),
            Path::new(&candidate_slm),
            Path::new(&receipt),
        );
    }
    if output == "federated-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "federated-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "federated-candidate requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "federated-candidate requires a base parent .slm path",
            ));
        };
        let Some(local_update_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "federated-candidate requires a local-update parent .slm path",
            ));
        };
        let Some(output_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "federated-candidate requires an output candidate .slm path",
            ));
        };
        let Some(output_receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "federated-candidate requires an output operator receipt path",
            ));
        };
        let local_update_weight_ppm = args.next();
        return federated::write_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&local_update_parent),
            Path::new(&output_slm),
            Path::new(&output_receipt),
            local_update_weight_ppm.as_deref(),
        );
    }
    if output == "validate-federated-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-federated-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-federated-candidate requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-federated-candidate requires a base parent .slm path",
            ));
        };
        let Some(local_update_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-federated-candidate requires a local-update parent .slm path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-federated-candidate requires a candidate .slm path",
            ));
        };
        let Some(receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-federated-candidate requires an input operator receipt path",
            ));
        };
        return federated::validate_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&local_update_parent),
            Path::new(&candidate_slm),
            Path::new(&receipt),
        );
    }
    if output == "delta-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "delta-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "delta-candidate requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "delta-candidate requires a base parent .slm path",
            ));
        };
        let Some(target_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "delta-candidate requires a target parent .slm path",
            ));
        };
        let Some(output_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "delta-candidate requires an output candidate .slm path",
            ));
        };
        let Some(output_receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "delta-candidate requires an output operator receipt path",
            ));
        };
        let delta_weight_ppm = args.next().unwrap_or_else(|| "1000000".to_string());
        return delta::write_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&target_parent),
            Path::new(&output_slm),
            Path::new(&output_receipt),
            &delta_weight_ppm,
        );
    }
    if output == "validate-delta-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-delta-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-delta-candidate requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-delta-candidate requires a base parent .slm path",
            ));
        };
        let Some(target_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-delta-candidate requires a target parent .slm path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-delta-candidate requires a candidate .slm path",
            ));
        };
        let Some(receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-delta-candidate requires an input operator receipt path",
            ));
        };
        return delta::validate_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&target_parent),
            Path::new(&candidate_slm),
            Path::new(&receipt),
        );
    }
    if output == "sparse-delta-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sparse-delta-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sparse-delta-candidate requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sparse-delta-candidate requires a base parent .slm path",
            ));
        };
        let Some(target_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sparse-delta-candidate requires a target parent .slm path",
            ));
        };
        let Some(output_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sparse-delta-candidate requires an output candidate .slm path",
            ));
        };
        let Some(output_receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sparse-delta-candidate requires an output operator receipt path",
            ));
        };
        let delta_weight_ppm = args.next();
        let keep_ppm = args.next();
        return sparse_delta::write_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&target_parent),
            Path::new(&output_slm),
            Path::new(&output_receipt),
            delta_weight_ppm.as_deref(),
            keep_ppm.as_deref(),
        );
    }
    if output == "validate-sparse-delta-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sparse-delta-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sparse-delta-candidate requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sparse-delta-candidate requires a base parent .slm path",
            ));
        };
        let Some(target_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sparse-delta-candidate requires a target parent .slm path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sparse-delta-candidate requires a candidate .slm path",
            ));
        };
        let Some(receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sparse-delta-candidate requires an input operator receipt path",
            ));
        };
        return sparse_delta::validate_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&target_parent),
            Path::new(&candidate_slm),
            Path::new(&receipt),
        );
    }
    if output == "dare-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "dare-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "dare-candidate requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "dare-candidate requires a base parent .slm path",
            ));
        };
        let Some(target_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "dare-candidate requires a target parent .slm path",
            ));
        };
        let Some(output_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "dare-candidate requires an output candidate .slm path",
            ));
        };
        let Some(output_receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "dare-candidate requires an output operator receipt path",
            ));
        };
        let delta_weight_ppm = args.next();
        let keep_ppm = args.next();
        let dropout_seed = args.next();
        return dare::write_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&target_parent),
            Path::new(&output_slm),
            Path::new(&output_receipt),
            delta_weight_ppm.as_deref(),
            keep_ppm.as_deref(),
            dropout_seed.as_deref(),
        );
    }
    if output == "validate-dare-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-dare-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-dare-candidate requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-dare-candidate requires a base parent .slm path",
            ));
        };
        let Some(target_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-dare-candidate requires a target parent .slm path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-dare-candidate requires a candidate .slm path",
            ));
        };
        let Some(receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-dare-candidate requires an input operator receipt path",
            ));
        };
        return dare::validate_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&target_parent),
            Path::new(&candidate_slm),
            Path::new(&receipt),
        );
    }
    if output == "adapter-delta" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "adapter-delta requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "adapter-delta requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "adapter-delta requires a base parent .slm path",
            ));
        };
        let Some(target_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "adapter-delta requires a target parent .slm path",
            ));
        };
        let Some(output_adapter) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "adapter-delta requires an output adapter artifact path",
            ));
        };
        let Some(output_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "adapter-delta requires an output adapter manifest path",
            ));
        };
        return adapter::write_artifact_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&target_parent),
            Path::new(&output_adapter),
            Path::new(&output_manifest),
        );
    }
    if output == "validate-adapter-delta" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-adapter-delta requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-adapter-delta requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-adapter-delta requires a base parent .slm path",
            ));
        };
        let Some(target_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-adapter-delta requires a target parent .slm path",
            ));
        };
        let Some(adapter_artifact) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-adapter-delta requires an input adapter artifact path",
            ));
        };
        let Some(adapter_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-adapter-delta requires an input adapter manifest path",
            ));
        };
        return adapter::validate_artifact_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&target_parent),
            Path::new(&adapter_artifact),
            Path::new(&adapter_manifest),
        );
    }
    if output == "sparse-adapter-delta" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sparse-adapter-delta requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sparse-adapter-delta requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sparse-adapter-delta requires a base parent .slm path",
            ));
        };
        let Some(target_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sparse-adapter-delta requires a target parent .slm path",
            ));
        };
        let Some(output_adapter) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sparse-adapter-delta requires an output adapter artifact path",
            ));
        };
        let Some(output_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sparse-adapter-delta requires an output adapter manifest path",
            ));
        };
        let delta_weight_ppm = args.next();
        let keep_ppm = args.next();
        return adapter::write_sparse_artifact_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&target_parent),
            Path::new(&output_adapter),
            Path::new(&output_manifest),
            delta_weight_ppm.as_deref(),
            keep_ppm.as_deref(),
        );
    }
    if output == "validate-sparse-adapter-delta" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sparse-adapter-delta requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sparse-adapter-delta requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sparse-adapter-delta requires a base parent .slm path",
            ));
        };
        let Some(target_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sparse-adapter-delta requires a target parent .slm path",
            ));
        };
        let Some(adapter_artifact) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sparse-adapter-delta requires an input adapter artifact path",
            ));
        };
        let Some(adapter_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sparse-adapter-delta requires an input adapter manifest path",
            ));
        };
        return adapter::validate_sparse_artifact_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&target_parent),
            Path::new(&adapter_artifact),
            Path::new(&adapter_manifest),
        );
    }
    if output == "low-rank-adapter-delta" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "low-rank-adapter-delta requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "low-rank-adapter-delta requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "low-rank-adapter-delta requires a base parent .slm path",
            ));
        };
        let Some(target_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "low-rank-adapter-delta requires a target parent .slm path",
            ));
        };
        let Some(output_adapter) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "low-rank-adapter-delta requires an output adapter artifact path",
            ));
        };
        let Some(output_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "low-rank-adapter-delta requires an output adapter manifest path",
            ));
        };
        let rank_limit = args.next();
        return adapter::write_low_rank_artifact_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&target_parent),
            Path::new(&output_adapter),
            Path::new(&output_manifest),
            rank_limit.as_deref(),
        );
    }
    if output == "validate-low-rank-adapter-delta" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-low-rank-adapter-delta requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-low-rank-adapter-delta requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-low-rank-adapter-delta requires a base parent .slm path",
            ));
        };
        let Some(target_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-low-rank-adapter-delta requires a target parent .slm path",
            ));
        };
        let Some(adapter_artifact) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-low-rank-adapter-delta requires an input adapter artifact path",
            ));
        };
        let Some(adapter_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-low-rank-adapter-delta requires an input adapter manifest path",
            ));
        };
        return adapter::validate_low_rank_artifact_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&target_parent),
            Path::new(&adapter_artifact),
            Path::new(&adapter_manifest),
        );
    }
    if output == "fuse-adapter-delta" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "fuse-adapter-delta requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "fuse-adapter-delta requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "fuse-adapter-delta requires a base parent .slm path",
            ));
        };
        let Some(target_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "fuse-adapter-delta requires a target parent .slm path",
            ));
        };
        let Some(adapter_artifact) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "fuse-adapter-delta requires an input adapter artifact path",
            ));
        };
        let Some(adapter_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "fuse-adapter-delta requires an input adapter manifest path",
            ));
        };
        let Some(output_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "fuse-adapter-delta requires an output .slm path",
            ));
        };
        let Some(output_receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "fuse-adapter-delta requires an output operator receipt path",
            ));
        };
        return adapter::fuse_artifact_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&target_parent),
            Path::new(&adapter_artifact),
            Path::new(&adapter_manifest),
            Path::new(&output_slm),
            Path::new(&output_receipt),
        );
    }
    if output == "validate-fuse-adapter-delta" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-fuse-adapter-delta requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-fuse-adapter-delta requires an input lineage path",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-fuse-adapter-delta requires a base parent .slm path",
            ));
        };
        let Some(target_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-fuse-adapter-delta requires a target parent .slm path",
            ));
        };
        let Some(adapter_artifact) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-fuse-adapter-delta requires an input adapter artifact path",
            ));
        };
        let Some(adapter_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-fuse-adapter-delta requires an input adapter manifest path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-fuse-adapter-delta requires a candidate .slm path",
            ));
        };
        let Some(receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-fuse-adapter-delta requires an input operator receipt path",
            ));
        };
        return adapter::validate_fused_candidate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&base_parent),
            Path::new(&target_parent),
            Path::new(&adapter_artifact),
            Path::new(&adapter_manifest),
            Path::new(&candidate_slm),
            Path::new(&receipt),
        );
    }
    if output == "candidate-manifest" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "candidate-manifest requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "candidate-manifest requires an input lineage path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "candidate-manifest requires a candidate .slm path",
            ));
        };
        let Some(output_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "candidate-manifest requires an output candidate manifest path",
            ));
        };
        let operator_receipt = args.next();
        return candidate::write_manifest_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&candidate_slm),
            Path::new(&output_manifest),
            operator_receipt.as_deref().map(Path::new),
        );
    }
    if output == "validate-candidate" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-candidate requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-candidate requires an input lineage path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-candidate requires a candidate .slm path",
            ));
        };
        let Some(candidate_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-candidate requires an input candidate manifest path",
            ));
        };
        let operator_receipt = args.next();
        return candidate::validate_manifest_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&candidate_slm),
            Path::new(&candidate_manifest),
            operator_receipt.as_deref().map(Path::new),
        );
    }
    if output == "promotion-template" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "promotion-template requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "promotion-template requires an input lineage path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "promotion-template requires a candidate .slm path",
            ));
        };
        let Some(candidate_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "promotion-template requires an input candidate manifest path",
            ));
        };
        let Some(output_promotion) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "promotion-template requires an output promotion path",
            ));
        };
        let promoter_id = args
            .next()
            .unwrap_or_else(|| "local-smoke-runner".to_string());
        let promotion_scope = args
            .next()
            .unwrap_or_else(|| promotion::DEFAULT_PROMOTION_SCOPE.to_string());
        let operator_receipt = args.next();
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "promotion-template received too many arguments",
            ));
        }
        return promotion::write_template_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&candidate_slm),
            Path::new(&candidate_manifest),
            Path::new(&output_promotion),
            &promoter_id,
            &promotion_scope,
            operator_receipt.as_deref().map(Path::new),
        );
    }
    if output == "validate-promotion" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-promotion requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-promotion requires an input lineage path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-promotion requires a candidate .slm path",
            ));
        };
        let Some(candidate_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-promotion requires an input candidate manifest path",
            ));
        };
        let Some(promotion_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-promotion requires an input promotion path",
            ));
        };
        let operator_receipt = args.next();
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-promotion received too many arguments",
            ));
        }
        return promotion::validate_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&candidate_slm),
            Path::new(&candidate_manifest),
            Path::new(&promotion_manifest),
            operator_receipt.as_deref().map(Path::new),
        );
    }
    if output == "admission-record" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "admission-record requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "admission-record requires an input lineage path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "admission-record requires a candidate .slm path",
            ));
        };
        let Some(candidate_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "admission-record requires an input candidate manifest path",
            ));
        };
        let Some(promotion_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "admission-record requires an input promotion path",
            ));
        };
        let Some(provenance_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "admission-record requires an input provenance manifest path",
            ));
        };
        let Some(runtime_smoke) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "admission-record requires an input runtime-smoke sidecar path",
            ));
        };
        let Some(eval_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "admission-record requires an input evaluation manifest path",
            ));
        };
        let Some(output_admission) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "admission-record requires an output admission path",
            ));
        };
        let selector_id = args
            .next()
            .unwrap_or_else(|| admission::DEFAULT_ADMISSION_SELECTOR_ID.to_string());
        let operator_receipt = args.next();
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "admission-record received too many arguments",
            ));
        }
        return admission::write_record_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&candidate_slm),
            Path::new(&candidate_manifest),
            Path::new(&promotion_manifest),
            Path::new(&provenance_manifest),
            Path::new(&runtime_smoke),
            Path::new(&eval_manifest),
            Path::new(&output_admission),
            &selector_id,
            operator_receipt.as_deref().map(Path::new),
        );
    }
    if output == "validate-admission" {
        let Some(compatibility_report) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-admission requires an input compatibility report path",
            ));
        };
        let Some(lineage_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-admission requires an input lineage path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-admission requires a candidate .slm path",
            ));
        };
        let Some(candidate_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-admission requires an input candidate manifest path",
            ));
        };
        let Some(promotion_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-admission requires an input promotion path",
            ));
        };
        let Some(provenance_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-admission requires an input provenance manifest path",
            ));
        };
        let Some(runtime_smoke) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-admission requires an input runtime-smoke sidecar path",
            ));
        };
        let Some(eval_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-admission requires an input evaluation manifest path",
            ));
        };
        let Some(admission_record) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-admission requires an input admission path",
            ));
        };
        let operator_receipt = args.next();
        if args.next().is_some() {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-admission received too many arguments",
            ));
        }
        return admission::validate_record_path(
            Path::new(&compatibility_report),
            Path::new(&lineage_manifest),
            Path::new(&candidate_slm),
            Path::new(&candidate_manifest),
            Path::new(&promotion_manifest),
            Path::new(&provenance_manifest),
            Path::new(&runtime_smoke),
            Path::new(&eval_manifest),
            Path::new(&admission_record),
            operator_receipt.as_deref().map(Path::new),
        );
    }
    if output == "selector-registry" {
        let Some(output_registry) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "selector-registry requires an output registry path",
            ));
        };
        let admission_records: Vec<String> = args.collect();
        return selector::write_registry_path(Path::new(&output_registry), &admission_records);
    }
    if output == "promotion-ledger" {
        let Some(output_ledger) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "promotion-ledger requires an output ledger path",
            ));
        };
        let admission_records: Vec<String> = args.collect();
        return ledger::write_ledger_path(Path::new(&output_ledger), &admission_records);
    }
    if output == "validate-promotion-ledger" {
        let Some(input_ledger) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-promotion-ledger requires an input ledger path",
            ));
        };
        let admission_records: Vec<String> = args.collect();
        return ledger::validate_ledger_path(Path::new(&input_ledger), &admission_records);
    }
    if output == "population-review" {
        let Some(input_ledger) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "population-review requires an input ledger path",
            ));
        };
        let Some(output_review) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "population-review requires an output review path",
            ));
        };
        let admission_records: Vec<String> = args.collect();
        return population::write_review_path(
            Path::new(&input_ledger),
            Path::new(&output_review),
            &admission_records,
        );
    }
    if output == "validate-population-review" {
        let Some(input_ledger) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-population-review requires an input ledger path",
            ));
        };
        let Some(input_review) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-population-review requires an input review path",
            ));
        };
        let admission_records: Vec<String> = args.collect();
        return population::validate_review_path(
            Path::new(&input_ledger),
            Path::new(&input_review),
            &admission_records,
        );
    }
    if output == "parent-pool-recipe" {
        let Some(input_ledger) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "parent-pool-recipe requires an input ledger path",
            ));
        };
        let Some(input_review) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "parent-pool-recipe requires an input review path",
            ));
        };
        let Some(output_recipe) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "parent-pool-recipe requires an output recipe path",
            ));
        };
        let admission_records: Vec<String> = args.collect();
        return parent_pool::write_recipe_path(
            Path::new(&input_ledger),
            Path::new(&input_review),
            Path::new(&output_recipe),
            &admission_records,
        );
    }
    if output == "validate-parent-pool-recipe" {
        let Some(input_ledger) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-parent-pool-recipe requires an input ledger path",
            ));
        };
        let Some(input_review) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-parent-pool-recipe requires an input review path",
            ));
        };
        let Some(input_recipe) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-parent-pool-recipe requires an input recipe path",
            ));
        };
        let admission_records: Vec<String> = args.collect();
        return parent_pool::validate_recipe_path(
            Path::new(&input_ledger),
            Path::new(&input_review),
            Path::new(&input_recipe),
            &admission_records,
        );
    }
    if output == "sign-merge-candidate" {
        let Some(input_ledger) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sign-merge-candidate requires an input ledger path",
            ));
        };
        let Some(input_review) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sign-merge-candidate requires an input review path",
            ));
        };
        let Some(input_recipe) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sign-merge-candidate requires an input parent-pool recipe path",
            ));
        };
        let Some(output_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sign-merge-candidate requires an output candidate .slm path",
            ));
        };
        let Some(output_receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "sign-merge-candidate requires an output operator receipt path",
            ));
        };
        let (parent_paths, admission_records) =
            split_parent_admission_args("sign-merge-candidate", args.collect())?;
        return sign_merge::write_candidate_path(
            Path::new(&input_ledger),
            Path::new(&input_review),
            Path::new(&input_recipe),
            Path::new(&output_slm),
            Path::new(&output_receipt),
            &parent_paths,
            &admission_records,
        );
    }
    if output == "validate-sign-merge-candidate" {
        let Some(input_ledger) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sign-merge-candidate requires an input ledger path",
            ));
        };
        let Some(input_review) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sign-merge-candidate requires an input review path",
            ));
        };
        let Some(input_recipe) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sign-merge-candidate requires an input parent-pool recipe path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sign-merge-candidate requires a candidate .slm path",
            ));
        };
        let Some(input_receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-sign-merge-candidate requires an input operator receipt path",
            ));
        };
        let (parent_paths, admission_records) =
            split_parent_admission_args("validate-sign-merge-candidate", args.collect())?;
        return sign_merge::validate_candidate_path(
            Path::new(&input_ledger),
            Path::new(&input_review),
            Path::new(&input_recipe),
            Path::new(&candidate_slm),
            Path::new(&input_receipt),
            &parent_paths,
            &admission_records,
        );
    }
    if output == "soup-candidate" {
        let Some(input_ledger) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "soup-candidate requires an input ledger path",
            ));
        };
        let Some(input_review) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "soup-candidate requires an input review path",
            ));
        };
        let Some(input_recipe) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "soup-candidate requires an input parent-pool recipe path",
            ));
        };
        let Some(output_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "soup-candidate requires an output candidate .slm path",
            ));
        };
        let Some(output_receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "soup-candidate requires an output operator receipt path",
            ));
        };
        let (parent_paths, admission_records) =
            split_parent_admission_args("soup-candidate", args.collect())?;
        return soup::write_candidate_path(
            Path::new(&input_ledger),
            Path::new(&input_review),
            Path::new(&input_recipe),
            Path::new(&output_slm),
            Path::new(&output_receipt),
            &parent_paths,
            &admission_records,
        );
    }
    if output == "validate-soup-candidate" {
        let Some(input_ledger) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-soup-candidate requires an input ledger path",
            ));
        };
        let Some(input_review) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-soup-candidate requires an input review path",
            ));
        };
        let Some(input_recipe) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-soup-candidate requires an input parent-pool recipe path",
            ));
        };
        let Some(candidate_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-soup-candidate requires a candidate .slm path",
            ));
        };
        let Some(input_receipt) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-soup-candidate requires an input operator receipt path",
            ));
        };
        let (parent_paths, admission_records) =
            split_parent_admission_args("validate-soup-candidate", args.collect())?;
        return soup::validate_candidate_path(
            Path::new(&input_ledger),
            Path::new(&input_review),
            Path::new(&input_recipe),
            Path::new(&candidate_slm),
            Path::new(&input_receipt),
            &parent_paths,
            &admission_records,
        );
    }
    if output == "validate-selector-registry" {
        let Some(input_registry) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-selector-registry requires an input registry path",
            ));
        };
        let admission_records: Vec<String> = args.collect();
        return selector::validate_registry_path(Path::new(&input_registry), &admission_records);
    }
    if output == "manifest" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "manifest requires an input .slm path",
            ));
        };
        let Some(manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "manifest requires an output manifest path",
            ));
        };
        let source_kind = args
            .next()
            .unwrap_or_else(|| "deterministic-smoke".to_string());
        return provenance::write_manifest_for_path(
            Path::new(&input),
            Path::new(&manifest),
            &source_kind,
        );
    }
    if output == "validate-manifest" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-manifest requires an input .slm path",
            ));
        };
        let Some(manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-manifest requires a manifest path",
            ));
        };
        return provenance::validate_manifest_path(Path::new(&input), Path::new(&manifest));
    }
    if output == "peer-offer" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "peer-offer requires an input .slm path",
            ));
        };
        let Some(offer) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "peer-offer requires an output peer-offer path",
            ));
        };
        let artifact_file_name = args.next();
        let chunk_size = args.next();
        return peer_offer::write_offer_path(
            Path::new(&input),
            Path::new(&offer),
            artifact_file_name.as_deref(),
            chunk_size.as_deref(),
        );
    }
    if output == "validate-peer-offer" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-peer-offer requires an input .slm path",
            ));
        };
        let Some(offer) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-peer-offer requires an input peer-offer path",
            ));
        };
        return peer_offer::validate_offer_path(Path::new(&input), Path::new(&offer));
    }
    if output == "runtime-smoke" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "runtime-smoke requires an input .slm path",
            ));
        };
        let Some(manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "runtime-smoke requires an input manifest path",
            ));
        };
        let Some(runtime_smoke) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "runtime-smoke requires an output sidecar path",
            ));
        };
        return provenance::write_runtime_smoke_for_path(
            Path::new(&input),
            Path::new(&manifest),
            Path::new(&runtime_smoke),
        );
    }
    if output == "validate-runtime-smoke" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-runtime-smoke requires an input .slm path",
            ));
        };
        let Some(manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-runtime-smoke requires an input manifest path",
            ));
        };
        let Some(runtime_smoke) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-runtime-smoke requires an input sidecar path",
            ));
        };
        return provenance::validate_runtime_smoke_path(
            Path::new(&input),
            Path::new(&manifest),
            Path::new(&runtime_smoke),
        );
    }
    if output == "eval-template" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "eval-template requires an input .slm path",
            ));
        };
        let Some(manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "eval-template requires an input manifest path",
            ));
        };
        let Some(eval_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "eval-template requires an output evaluation manifest path",
            ));
        };
        let gate = args
            .next()
            .unwrap_or_else(|| "assistant-quality".to_string());
        return provenance::write_eval_template_for_path(
            Path::new(&input),
            Path::new(&manifest),
            Path::new(&eval_manifest),
            &gate,
        );
    }
    if output == "quality-gate" {
        let Some(input) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "quality-gate requires an input .slm path",
            ));
        };
        let Some(manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "quality-gate requires an input manifest path",
            ));
        };
        let Some(gate) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "quality-gate requires runtime-smoke or assistant-quality",
            ));
        };
        let eval_manifest = args.next();
        return provenance::quality_gate_path(
            Path::new(&input),
            Path::new(&manifest),
            &gate,
            eval_manifest.as_deref().map(Path::new),
        );
    }
    if output == "freeze-distillation-dataset" {
        let Some(dataset_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "freeze-distillation-dataset requires a dataset directory",
            ));
        };
        let Some(output_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "freeze-distillation-dataset requires an output manifest path",
            ));
        };
        let exclusions = args.map(PathBuf::from).collect::<Vec<_>>();
        return distillation::freeze_dataset_path(
            Path::new(&dataset_dir),
            Path::new(&output_manifest),
            &exclusions,
        );
    }
    if output == "validate-distillation-dataset" {
        let Some(dataset_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-distillation-dataset requires a dataset directory",
            ));
        };
        let Some(frozen_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-distillation-dataset requires a frozen manifest path",
            ));
        };
        let exclusions = args.map(PathBuf::from).collect::<Vec<_>>();
        return distillation::validate_dataset_path(
            Path::new(&dataset_dir),
            Path::new(&frozen_manifest),
            &exclusions,
        );
    }
    if output == "source-template" {
        let Some(output_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "source-template requires an output source directory",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        return trained_source::write_source_template_path(Path::new(&output_dir), &shape_name);
    }
    if output == "adapter-source-template" {
        let Some(output_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "adapter-source-template requires an output adapter source directory",
            ));
        };
        let shape_name = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
        return trained_adapter_source::write_adapter_source_template_path(
            Path::new(&output_dir),
            &shape_name,
        );
    }
    if output == "validate-source" {
        let Some(input_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-source requires an input source directory",
            ));
        };
        return trained_source::validate_source_path(Path::new(&input_dir));
    }
    if output == "validate-adapter-source" {
        let Some(input_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-adapter-source requires an input adapter source directory",
            ));
        };
        return trained_adapter_source::validate_adapter_source_path(Path::new(&input_dir));
    }
    if output == "convert-adapter-source" {
        let Some(input_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-adapter-source requires an input adapter source directory",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-adapter-source requires a base parent .slm path",
            ));
        };
        let Some(output_adapter) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-adapter-source requires an output ALR1 adapter path",
            ));
        };
        let Some(output_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-adapter-source requires an output ALR1 manifest path",
            ));
        };
        return trained_adapter_source::convert_adapter_source_path(
            Path::new(&input_dir),
            Path::new(&base_parent),
            Path::new(&output_adapter),
            Path::new(&output_manifest),
        );
    }
    if output == "validate-converted-adapter-source" {
        let Some(input_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-converted-adapter-source requires an input adapter source directory",
            ));
        };
        let Some(base_parent) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-converted-adapter-source requires a base parent .slm path",
            ));
        };
        let Some(input_adapter) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-converted-adapter-source requires an input ALR1 adapter path",
            ));
        };
        let Some(input_manifest) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "validate-converted-adapter-source requires an input ALR1 manifest path",
            ));
        };
        return trained_adapter_source::validate_converted_adapter_source_path(
            Path::new(&input_dir),
            Path::new(&base_parent),
            Path::new(&input_adapter),
            Path::new(&input_manifest),
        );
    }
    if output == "convert-trained" {
        let Some(input_dir) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-trained requires an input source directory",
            ));
        };
        let Some(output_slm) = args.next() else {
            print_usage();
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "convert-trained requires an output .slm path",
            ));
        };
        let output_quantization = args.next().unwrap_or_else(|| "f32".to_string());
        return trained_source::convert_trained_path(
            Path::new(&input_dir),
            Path::new(&output_slm),
            &output_quantization,
        );
    }
    let mode = args.next().unwrap_or_else(|| "tiny-fixture".to_string());
    let (shape, tensors, tokenizer, flags) = match mode.as_str() {
        "tiny-fixture" => (
            ModelShape::tiny_fixture(),
            tiny_fixture_tensors(),
            ByteTokenizerSection::phase_one(),
            0,
        ),
        "tiny-fixture-tied" => (
            ModelShape::tiny_fixture(),
            tiny_fixture_tied_tensors(),
            ByteTokenizerSection::phase_one(),
            FLAG_TIED_OUTPUT,
        ),
        "tiny-fixture-q8" => (
            ModelShape::tiny_fixture(),
            tiny_fixture_tensors_with_dtype(DTYPE_Q8_0),
            ByteTokenizerSection::phase_one(),
            0,
        ),
        "tiny-fixture-q4" => (
            ModelShape::tiny_fixture(),
            tiny_fixture_tensors_with_dtype(DTYPE_Q4_0),
            ByteTokenizerSection::phase_one(),
            0,
        ),
        "tiny-fixture-q5" => (
            ModelShape::tiny_fixture(),
            tiny_fixture_tensors_with_dtype(DTYPE_Q5_0),
            ByteTokenizerSection::phase_one(),
            0,
        ),
        "tiny-fixture-bpe" => {
            let shape = ModelShape {
                vocab_size: 262,
                ..ModelShape::tiny_fixture()
            };
            let tensors = tensor_writer::tensors_for_shape(&shape, DTYPE_F32);
            (shape, tensors, TokenizerSection::tiny_bpe_demo(), 0)
        }
        "tinylm16-f32" => (
            ModelShape::tinylm16(),
            tinylm16_f32_tensors(),
            ByteTokenizerSection::phase_one(),
            0,
        ),
        "tinylm16-q8" => (
            ModelShape::tinylm16(),
            tinylm16_q8_tensors(),
            ByteTokenizerSection::phase_one(),
            0,
        ),
        "tinylm16-q4" => (
            ModelShape::tinylm16(),
            tinylm16_q4_tensors(),
            ByteTokenizerSection::phase_one(),
            0,
        ),
        _ => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "supported modes: tiny-fixture, tiny-fixture-tied, tiny-fixture-q8, tiny-fixture-q5, tiny-fixture-q4, tiny-fixture-bpe, tinylm16-f32, tinylm16-q8, tinylm16-q4",
            ));
        }
    };
    let bytes = if flags == 0 {
        build_model_file(&shape, &tensors, &tokenizer)?
    } else {
        build_model_file_with_flags(&shape, &tensors, &tokenizer, flags)?
    };
    let path = Path::new(&output);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut file = File::create(path)?;
    file.write_all(&bytes)?;
    Ok(())
}

fn split_parent_admission_args(
    command: &str,
    rest: Vec<String>,
) -> io::Result<(Vec<String>, Vec<String>)> {
    let Some(parent_marker) = rest.iter().position(|arg| arg == "--parents") else {
        print_usage();
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("{command} requires --parents before parent .slm paths"),
        ));
    };
    let Some(admission_marker) = rest.iter().position(|arg| arg == "--admissions") else {
        print_usage();
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("{command} requires --admissions before admission records"),
        ));
    };
    if parent_marker != 0 || admission_marker <= parent_marker + 1 {
        print_usage();
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("{command} requires --parents <parent.slm> [...parent.slm]"),
        ));
    }
    if admission_marker + 1 >= rest.len() {
        print_usage();
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("{command} requires --admissions <input.admission> [...input.admission]"),
        ));
    }
    let parents = rest[parent_marker + 1..admission_marker].to_vec();
    let admissions = rest[admission_marker + 1..].to_vec();
    if parents.len() < 2 {
        print_usage();
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("{command} requires at least two parent .slm paths"),
        ));
    }
    if admissions
        .iter()
        .any(|arg| arg == "--parents" || arg == "--admissions")
    {
        print_usage();
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("{command} received duplicate list markers"),
        ));
    }
    Ok((parents, admissions))
}

/// Splits the safetensors browser tail while allowing a lone review to supply eval routing.
fn split_browser_safetensors_bundle_tail(
    eval_cases_or_review: Option<String>,
    candidate_review: Option<String>,
) -> (Option<String>, Option<String>) {
    if candidate_review.is_some() {
        return (eval_cases_or_review, candidate_review);
    }
    if let Some(path) = eval_cases_or_review {
        if looks_like_safetensors_candidate_review(Path::new(&path)) {
            return (None, Some(path));
        }
        return (Some(path), None);
    }
    (None, None)
}

/// Detects a review file by its stable manifest version key without fully validating it.
fn looks_like_safetensors_candidate_review(path: &Path) -> bool {
    fs::read_to_string(path)
        .map(|text| {
            text.lines()
                .any(|line| line == "tinyrustlm_safetensors_candidate_review_version=1")
        })
        .unwrap_or(false)
}

fn optional_cli_arg(value: Option<String>) -> Option<String> {
    value.filter(|text| text != "-")
}

fn print_composition_graph_outcome(outcome: &composition_graph::CompositionGraphOutcome) {
    println!("TinyRustLM composition graph: PASS");
    println!("bundle_sha256: {}", outcome.bundle_sha256);
    println!("base_model_id: {}", outcome.base_model_id);
    println!("composition_id: {}", outcome.composition_id);
    println!("active_graph_digest: {}", outcome.active_graph_digest);
    println!("route_policy_id: {}", outcome.route_policy_id);
    println!("kv_format_id: {}", outcome.kv_format_id);
    println!("position_policy_sha256: {}", outcome.position_policy_sha256);
    println!("member_count: {}", outcome.member_count);
}

fn print_usage() {
    eprintln!("{}", primary_usage_text());
    eprintln!(
        "       tinyrustlm-slm-pack peer-offer <input.slm> <output.peer-offer> [artifact-file-name] [chunk-size]\n       tinyrustlm-slm-pack validate-peer-offer <input.slm> <input.peer-offer>"
    );
    eprintln!(
        "       review-safetensors-candidate optional route tail: [source-config-route] [source-tokenizer-route]"
    );
    eprintln!(
        "       standard-model intake tail: inspect-safetensors ... | inspect-gguf ... | plan-gguf-source ... | extract-gguf-source ... | convert-gguf-trained ... [f32|q8_0|q4_0] | write-gguf-fixture ... | write-gguf-source-fixture ... | write-gguf-q8-source-fixture ... | write-gguf-q8-1-source-fixture ... | write-gguf-q8-k-source-fixture ... | write-gguf-q2-k-source-fixture ... | write-gguf-q3-k-source-fixture ... | write-gguf-q6-k-source-fixture ... | write-gguf-q4-k-source-fixture ... | write-gguf-q4-source-fixture ... | write-gguf-q4-1-source-fixture ... | write-gguf-q5-source-fixture ... | write-gguf-q5-1-source-fixture ... | write-gguf-q5-k-source-fixture ... | extract-safetensors-source ... [candidate-review] | convert-safetensors-trained ... [f32|q8_0|q4_0] [candidate-review] | inspect-huggingface-conversion-request ... | convert-huggingface-request ... [source-shape] [f32|q8_0|q4_0] | inspect-huggingface-conversion-receipt ... | write-safetensors-fixture ... [local|huggingface] | write-safetensors-fixture-shards ... [local|huggingface] | browser-safetensors-trained-bundle ... [f32|q8_0|q4_0|all] [eval-cases.txt|candidate.review] [candidate-review]"
    );
    eprintln!(
        "       review-bound browser bundles use eval_cases_route when a lone candidate-review path is supplied; explicit eval-cases must match that reviewed route"
    );
    eprintln!(
        "       tinyrustlm-slm-pack candidate-manifest <input.compat> <input.lineage> <candidate.slm> <output.candidate> [input.operator]\n       tinyrustlm-slm-pack validate-candidate <input.compat> <input.lineage> <candidate.slm> <input.candidate> [input.operator]"
    );
    eprintln!(
        "       tinyrustlm-slm-pack promotion-template <input.compat> <input.lineage> <candidate.slm> <input.candidate> <output.promotion> [promoter-id] [promotion-scope] [input.operator]\n       tinyrustlm-slm-pack validate-promotion <input.compat> <input.lineage> <candidate.slm> <input.candidate> <input.promotion> [input.operator]"
    );
    eprintln!(
        "       tinyrustlm-slm-pack admission-record <input.compat> <input.lineage> <candidate.slm> <input.candidate> <input.promotion> <input.manifest> <input.runtime> <input.eval> <output.admission> [selector-id] [input.operator]\n       tinyrustlm-slm-pack validate-admission <input.compat> <input.lineage> <candidate.slm> <input.candidate> <input.promotion> <input.manifest> <input.runtime> <input.eval> <input.admission> [input.operator]"
    );
    eprintln!(
        "       tinyrustlm-slm-pack adapter-source-template <output-adapter-source-dir> [tiny-fixture|tiny-fixture-tied|tinylm16|tinylm16-tied]\n       tinyrustlm-slm-pack validate-adapter-source <input-adapter-source-dir>\n       tinyrustlm-slm-pack convert-adapter-source <input-adapter-source-dir> <base-parent.slm> <output.alr1> <output.alr1.manifest>\n       tinyrustlm-slm-pack validate-converted-adapter-source <input-adapter-source-dir> <base-parent.slm> <input.alr1> <input.alr1.manifest>"
    );
    eprintln!(
        "       tinyrustlm-slm-pack freeze-distillation-dataset <dataset-dir> <output.manifest> <materialized-eval-exclusion> [...materialized-eval-exclusion]\n       tinyrustlm-slm-pack validate-distillation-dataset <dataset-dir> <frozen.manifest> <materialized-eval-exclusion> [...materialized-eval-exclusion]"
    );
    eprintln!(
        "       tinyrustlm-slm-pack mutation-candidate <input.compat> <input.lineage> <base-parent.slm> <reference-parent.slm> <output.slm> <output.operator> [mutation-seed] [mutation-rate-ppm] [mutation-magnitude-ppm]\n       tinyrustlm-slm-pack validate-mutation-candidate <input.compat> <input.lineage> <base-parent.slm> <reference-parent.slm> <candidate.slm> <input.operator>"
    );
    eprintln!(
        "       tinyrustlm-slm-pack prune-candidate <input.compat> <input.lineage> <base-parent.slm> <reference-parent.slm> <output.slm> <output.operator> [keep-ppm] [floor-ppm]\n       tinyrustlm-slm-pack validate-prune-candidate <input.compat> <input.lineage> <base-parent.slm> <reference-parent.slm> <candidate.slm> <input.operator>"
    );
    eprintln!(
        "       tinyrustlm-slm-pack federated-candidate <input.compat> <input.lineage> <base-parent.slm> <local-update-parent.slm> <output.slm> <output.operator> [local-update-weight-ppm]\n       tinyrustlm-slm-pack validate-federated-candidate <input.compat> <input.lineage> <base-parent.slm> <local-update-parent.slm> <candidate.slm> <input.operator>"
    );
    eprintln!(
        "       tinyrustlm-slm-pack dare-candidate <input.compat> <input.lineage> <base-parent.slm> <target-parent.slm> <output.slm> <output.operator> [delta-weight-ppm] [keep-ppm] [dropout-seed]\n       tinyrustlm-slm-pack validate-dare-candidate <input.compat> <input.lineage> <base-parent.slm> <target-parent.slm> <candidate.slm> <input.operator>"
    );
    eprintln!(
        "       tinyrustlm-slm-pack low-rank-adapter-delta <input.compat> <input.lineage> <base-parent.slm> <target-parent.slm> <output.adapter> <output.adapter.manifest> [rank-limit]\n       tinyrustlm-slm-pack validate-low-rank-adapter-delta <input.compat> <input.lineage> <base-parent.slm> <target-parent.slm> <input.adapter> <input.adapter.manifest>"
    );
    eprintln!(
        "       tinyrustlm-slm-pack population-review <input.ledger> <output.review> <input.admission> [...input.admission]\n       tinyrustlm-slm-pack validate-population-review <input.ledger> <input.review> <input.admission> [...input.admission]"
    );
    eprintln!(
        "       tinyrustlm-slm-pack parent-pool-recipe <input.ledger> <input.review> <output.recipe> <input.admission> [...input.admission]\n       tinyrustlm-slm-pack validate-parent-pool-recipe <input.ledger> <input.review> <input.recipe> <input.admission> [...input.admission]"
    );
    eprintln!(
        "       tinyrustlm-slm-pack sign-merge-candidate <input.ledger> <input.review> <input.recipe> <output.slm> <output.operator> --parents <parent.slm> [...parent.slm] --admissions <input.admission> [...input.admission]\n       tinyrustlm-slm-pack validate-sign-merge-candidate <input.ledger> <input.review> <input.recipe> <candidate.slm> <input.operator> --parents <parent.slm> [...parent.slm] --admissions <input.admission> [...input.admission]"
    );
    eprintln!(
        "       tinyrustlm-slm-pack soup-candidate <input.ledger> <input.review> <input.recipe> <output.slm> <output.operator> --parents <parent.slm> [...parent.slm] --admissions <input.admission> [...input.admission]\n       tinyrustlm-slm-pack validate-soup-candidate <input.ledger> <input.review> <input.recipe> <candidate.slm> <input.operator> --parents <parent.slm> [...parent.slm] --admissions <input.admission> [...input.admission]"
    );
}

/// Returns the primary CLI usage text without writing to stderr.
fn primary_usage_text() -> &'static str {
    concat!(
    "usage: tinyrustlm-slm-pack <output.slm> [tiny-fixture|tiny-fixture-tied|tiny-fixture-q8|tiny-fixture-q4|tiny-fixture-bpe|tinylm16-f32|tinylm16-q8|tinylm16-q4]\n       tinyrustlm-slm-pack validate <input.slm>\n       tinyrustlm-slm-pack inspect-safetensors <input.safetensors> [output.report]\n       tinyrustlm-slm-pack inspect-gguf <input.gguf> [output.report]\n       tinyrustlm-slm-pack plan-safetensors-source <input.safetensors> <tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe> [output.plan]\n       tinyrustlm-slm-pack plan-gguf-source <input.gguf> <tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe> [output.plan]\n       tinyrustlm-slm-pack review-safetensors-candidate <input.safetensors> <tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe> <f32|q8_0|q4_0> <source-model-id> <source-model-sha> <source-config-checksum> <source-tokenizer-checksum> <source-license-route> <output.review> [reference-prompt-route] [reference-output-checksum] [eval-cases-route] [source-config-route] [source-tokenizer-route]\n       tinyrustlm-slm-pack extract-safetensors-source <input.safetensors> <tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe> <output-source-dir> [candidate-review]\n       tinyrustlm-slm-pack extract-gguf-source <input.gguf> <tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe> <output-source-dir>\n       tinyrustlm-slm-pack convert-safetensors-trained <input.safetensors> <tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe> <output-source-dir> <output.slm> [f32|q8_0|q4_0] [candidate-review]\n       tinyrustlm-slm-pack convert-gguf-trained <input.gguf> <tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe> <output-source-dir> <output.slm> [f32|q8_0|q4_0]\n       tinyrustlm-slm-pack convert-huggingface-request <request.json> <input.safetensors-or-directory> <output-dir> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe] [f32|q8_0|q4_0]\n       tinyrustlm-slm-pack inspect-huggingface-conversion-receipt <receipt> <request.json> <preflight> <output.slm> <output.manifest>\n       tinyrustlm-slm-pack write-safetensors-fixture <output.safetensors> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe] [local|huggingface]\n       tinyrustlm-slm-pack write-safetensors-fixture-shards <output-dir> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe] [local|huggingface]\n       tinyrustlm-slm-pack write-gguf-fixture <output.gguf>\n       tinyrustlm-slm-pack write-gguf-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]\n       tinyrustlm-slm-pack browser-safetensors-trained-bundle <output-tinyrustlm-root> <input.safetensors> <tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe> <output-source-dir> <composition-graph-root> [f32|q8_0|q4_0|all] [eval-cases.txt|candidate.review] [candidate-review]\n       tinyrustlm-slm-pack browser-converted-trained-bundle <output-tinyrustlm-root> <input-source-dir> <composition-graph-root> [f32|q8_0|q4_0|all] [eval-cases.txt]\n       tinyrustlm-slm-pack runtime-wasm-manifest <input.wasm> <output.wasm.manifest>\n       tinyrustlm-slm-pack compatibility <left-parent.slm> <right-parent.slm> [output.compat]\n       tinyrustlm-slm-pack lineage-template <input.compat> <output.lineage> <candidate-id> <operator-id> [resource-budget]\n       tinyrustlm-slm-pack validate-lineage <input.compat> <input.lineage>\n       tinyrustlm-slm-pack blend-candidate <input.compat> <input.lineage> <left-parent.slm> <right-parent.slm> <output.slm> <output.operator> [parent0-weight-ppm]\n       tinyrustlm-slm-pack validate-blend-candidate <input.compat> <input.lineage> <left-parent.slm> <right-parent.slm> <candidate.slm> <input.operator>\n       tinyrustlm-slm-pack crossover-candidate <input.compat> <input.lineage> <left-parent.slm> <right-parent.slm> <output.slm> <output.operator> [crossover-seed] [parent0-keep-ppm]\n       tinyrustlm-slm-pack validate-crossover-candidate <input.compat> <input.lineage> <left-parent.slm> <right-parent.slm> <candidate.slm> <input.operator>\n       tinyrustlm-slm-pack delta-candidate <input.compat> <input.lineage> <base-parent.slm> <target-parent.slm> <output.slm> <output.operator> [delta-weight-ppm]\n       tinyrustlm-slm-pack validate-delta-candidate <input.compat> <input.lineage> <base-parent.slm> <target-parent.slm> <candidate.slm> <input.operator>\n       tinyrustlm-slm-pack sparse-delta-candidate <input.compat> <input.lineage> <base-parent.slm> <target-parent.slm> <output.slm> <output.operator> [delta-weight-ppm] [keep-ppm]\n       tinyrustlm-slm-pack validate-sparse-delta-candidate <input.compat> <input.lineage> <base-parent.slm> <target-parent.slm> <candidate.slm> <input.operator>\n       tinyrustlm-slm-pack adapter-delta <input.compat> <input.lineage> <base-parent.slm> <target-parent.slm> <output.adapter> <output.adapter.manifest>\n       tinyrustlm-slm-pack validate-adapter-delta <input.compat> <input.lineage> <base-parent.slm> <target-parent.slm> <input.adapter> <input.adapter.manifest>\n       tinyrustlm-slm-pack sparse-adapter-delta <input.compat> <input.lineage> <base-parent.slm> <target-parent.slm> <output.adapter> <output.adapter.manifest> [delta-weight-ppm] [keep-ppm]\n       tinyrustlm-slm-pack validate-sparse-adapter-delta <input.compat> <input.lineage> <base-parent.slm> <target-parent.slm> <input.adapter> <input.adapter.manifest>\n       tinyrustlm-slm-pack fuse-adapter-delta <input.compat> <input.lineage> <base-parent.slm> <target-parent.slm> <input.adapter> <input.adapter.manifest> <output.slm> <output.operator>\n       tinyrustlm-slm-pack validate-fuse-adapter-delta <input.compat> <input.lineage> <base-parent.slm> <target-parent.slm> <input.adapter> <input.adapter.manifest> <candidate.slm> <input.operator>\n       tinyrustlm-slm-pack candidate-manifest <input.compat> <input.lineage> <candidate.slm> <output.candidate> [input.operator]\n       tinyrustlm-slm-pack validate-candidate <input.compat> <input.lineage> <candidate.slm> <input.candidate> [input.operator]\n       tinyrustlm-slm-pack promotion-template <input.compat> <input.lineage> <candidate.slm> <input.candidate> <output.promotion> [promoter-id] [promotion-scope] [input.operator]\n       tinyrustlm-slm-pack validate-promotion <input.compat> <input.lineage> <candidate.slm> <input.candidate> <input.promotion> [input.operator]\n       tinyrustlm-slm-pack admission-record <input.compat> <input.lineage> <candidate.slm> <input.candidate> <input.promotion> <input.manifest> <input.runtime> <input.eval> <output.admission> [selector-id] [input.operator]\n       tinyrustlm-slm-pack validate-admission <input.compat> <input.lineage> <candidate.slm> <input.candidate> <input.promotion> <input.manifest> <input.runtime> <input.eval> <input.admission> [input.operator]\n       tinyrustlm-slm-pack promotion-ledger <output.ledger> <input.admission> [...input.admission]\n       tinyrustlm-slm-pack validate-promotion-ledger <input.ledger> <input.admission> [...input.admission]\n       tinyrustlm-slm-pack selector-registry <output.registry> <input.admission> [...input.admission]\n       tinyrustlm-slm-pack validate-selector-registry <input.registry> <input.admission> [...input.admission]\n       tinyrustlm-slm-pack manifest <input.slm> <output.manifest> [deterministic-smoke|converted-trained]\n       tinyrustlm-slm-pack validate-manifest <input.slm> <input.manifest>\n       tinyrustlm-slm-pack runtime-smoke <input.slm> <input.manifest> <output.runtime>\n       tinyrustlm-slm-pack validate-runtime-smoke <input.slm> <input.manifest> <input.runtime>\n       tinyrustlm-slm-pack eval-template <input.slm> <input.manifest> <output.eval> [assistant-quality]\n       tinyrustlm-slm-pack quality-gate <input.slm> <input.manifest> <runtime-smoke|assistant-quality> [input.eval]\n       tinyrustlm-slm-pack source-template <output-source-dir> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe]\n       tinyrustlm-slm-pack validate-source <input-source-dir>\n       tinyrustlm-slm-pack convert-trained <input-source-dir> <output.slm> [f32|q8_0|q4_0]"
        ,
        "\n       tinyrustlm-slm-pack composition-graph <input.slm> <authority.json> <output.acg1>"
        ,
        "\n       tinyrustlm-slm-pack inspect-huggingface-conversion-request <request.json> [output.report]"
        ,
        "\n       tinyrustlm-slm-pack write-gguf-q8-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ,
        "\n       tinyrustlm-slm-pack write-gguf-q8-1-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ,
        "\n       tinyrustlm-slm-pack write-gguf-q8-k-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ,
        "\n       tinyrustlm-slm-pack write-gguf-q2-k-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ,
        "\n       tinyrustlm-slm-pack write-gguf-q3-k-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ,
        "\n       tinyrustlm-slm-pack write-gguf-q6-k-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ,
        "\n       tinyrustlm-slm-pack write-gguf-q4-k-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ,
        "\n       tinyrustlm-slm-pack write-gguf-q4-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ,
        "\n       tinyrustlm-slm-pack write-gguf-q4-1-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ,
        "\n       tinyrustlm-slm-pack write-gguf-q5-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ,
        "\n       tinyrustlm-slm-pack write-gguf-q5-1-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ,
        "\n       tinyrustlm-slm-pack write-gguf-q5-k-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
    )
}

pub(crate) fn build_model_file(
    shape: &ModelShape,
    tensors: &[TensorSpec],
    tokenizer: &ByteTokenizerSection,
) -> io::Result<Vec<u8>> {
    build_model_file_with_flags(shape, tensors, tokenizer, 0)
}

pub(crate) fn build_model_file_with_flags(
    shape: &ModelShape,
    tensors: &[TensorSpec],
    tokenizer: &ByteTokenizerSection,
    flags: u32,
) -> io::Result<Vec<u8>> {
    validate_model_numerical_configuration(shape)?;
    let tokenizer_offset = HEADER_LEN as u64;
    let tokenizer_length = tokenizer.bytes.len() as u64;
    let tensor_directory_offset = align_to_64(HEADER_LEN + tokenizer.bytes.len()) as u64;
    let tensor_data_offset =
        align_to_64(tensor_directory_offset as usize + tensors.len() * TENSOR_ENTRY_LEN) as u64;

    let mut tensor_offsets = Vec::with_capacity(tensors.len());
    let mut scale_offsets = Vec::with_capacity(tensors.len());
    let mut cursor = tensor_data_offset as usize;
    for tensor in tensors {
        cursor = align_to_64(cursor);
        tensor_offsets.push(cursor as u64);
        cursor += tensor.byte_len();
        let scale_len = tensor.scale_byte_len();
        if scale_len > 0 {
            cursor = align_to_64(cursor);
            scale_offsets.push(cursor as u64);
            cursor += scale_len;
        } else {
            scale_offsets.push(0);
        }
    }

    let mut bytes = vec![0u8; cursor];
    bytes[0..4].copy_from_slice(b"SLM1");
    write_u32(&mut bytes, 4, 1)?;
    write_u32(&mut bytes, 8, HEADER_LEN as u32)?;
    write_u32(&mut bytes, 12, 1)?;
    write_u32(&mut bytes, 16, flags)?;
    write_u32(&mut bytes, 20, shape.vocab_size)?;
    write_u32(&mut bytes, 24, shape.special_token_count)?;
    write_u32(&mut bytes, 28, shape.hidden_size)?;
    write_u32(&mut bytes, 32, shape.layer_count)?;
    write_u32(&mut bytes, 36, shape.head_count)?;
    write_u32(&mut bytes, 40, shape.kv_head_count)?;
    write_u32(&mut bytes, 44, shape.head_dim)?;
    write_u32(&mut bytes, 48, shape.ffn_size)?;
    write_u32(&mut bytes, 52, shape.max_context)?;
    write_f32(&mut bytes, 56, shape.rope_theta)?;
    write_f32(&mut bytes, 60, shape.rms_norm_epsilon)?;
    write_u64(&mut bytes, 64, tokenizer_offset)?;
    write_u64(&mut bytes, 72, tokenizer_length)?;
    write_u64(&mut bytes, 80, tensor_directory_offset)?;
    write_u32(&mut bytes, 88, tensors.len() as u32)?;
    write_u64(&mut bytes, 92, tensor_data_offset)?;
    write_u64(&mut bytes, 100, 0)?;

    let tokenizer_start = tokenizer_offset as usize;
    bytes[tokenizer_start..tokenizer_start + tokenizer.bytes.len()]
        .copy_from_slice(&tokenizer.bytes);

    for (index, tensor) in tensors.iter().enumerate() {
        let entry = tensor_directory_offset as usize + index * TENSOR_ENTRY_LEN;
        write_u64(&mut bytes, entry, tensor.name_hash)?;
        write_u32(&mut bytes, entry + 8, tensor.dtype)?;
        write_u32(&mut bytes, entry + 12, tensor.rank)?;
        write_u32(&mut bytes, entry + 16, tensor.dims[0])?;
        write_u32(&mut bytes, entry + 20, tensor.dims[1])?;
        write_u32(&mut bytes, entry + 24, tensor.dims[2])?;
        write_u32(&mut bytes, entry + 28, tensor.dims[3])?;
        write_u64(&mut bytes, entry + 32, tensor_offsets[index])?;
        write_u64(&mut bytes, entry + 40, tensor.byte_len() as u64)?;
        write_u64(&mut bytes, entry + 48, scale_offsets[index])?;
        write_u32(&mut bytes, entry + 56, tensor.block_size)?;

        write_tensor_payload(
            &mut bytes,
            tensor,
            tensor_offsets[index],
            scale_offsets[index],
        )?;
    }

    let checksum = simple_checksum(&bytes);
    write_u64(&mut bytes, 100, checksum)?;

    Ok(bytes)
}

pub(crate) fn build_model_file_from_values_with_flags(
    shape: &ModelShape,
    tensors: &[TensorSpec],
    tokenizer: &ByteTokenizerSection,
    values: &[Vec<f32>],
    flags: u32,
) -> io::Result<Vec<u8>> {
    validate_model_numerical_configuration(shape)?;
    if tensors.len() != values.len() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "tensor specs and source value lists must have the same length",
        ));
    }
    for (tensor, tensor_values) in tensors.iter().zip(values.iter()) {
        if tensor.element_count() != tensor_values.len() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "source tensor value count does not match tensor shape",
            ));
        }
    }

    let tokenizer_offset = HEADER_LEN as u64;
    let tokenizer_length = tokenizer.bytes.len() as u64;
    let tensor_directory_offset = align_to_64(HEADER_LEN + tokenizer.bytes.len()) as u64;
    let tensor_data_offset =
        align_to_64(tensor_directory_offset as usize + tensors.len() * TENSOR_ENTRY_LEN) as u64;

    let mut tensor_offsets = Vec::with_capacity(tensors.len());
    let mut scale_offsets = Vec::with_capacity(tensors.len());
    let mut cursor = tensor_data_offset as usize;
    for tensor in tensors {
        cursor = align_to_64(cursor);
        tensor_offsets.push(cursor as u64);
        cursor += tensor.byte_len();
        let scale_len = tensor.scale_byte_len();
        if scale_len > 0 {
            cursor = align_to_64(cursor);
            scale_offsets.push(cursor as u64);
            cursor += scale_len;
        } else {
            scale_offsets.push(0);
        }
    }

    let mut bytes = vec![0u8; cursor];
    bytes[0..4].copy_from_slice(b"SLM1");
    write_u32(&mut bytes, 4, 1)?;
    write_u32(&mut bytes, 8, HEADER_LEN as u32)?;
    write_u32(&mut bytes, 12, 1)?;
    write_u32(&mut bytes, 16, flags)?;
    write_u32(&mut bytes, 20, shape.vocab_size)?;
    write_u32(&mut bytes, 24, shape.special_token_count)?;
    write_u32(&mut bytes, 28, shape.hidden_size)?;
    write_u32(&mut bytes, 32, shape.layer_count)?;
    write_u32(&mut bytes, 36, shape.head_count)?;
    write_u32(&mut bytes, 40, shape.kv_head_count)?;
    write_u32(&mut bytes, 44, shape.head_dim)?;
    write_u32(&mut bytes, 48, shape.ffn_size)?;
    write_u32(&mut bytes, 52, shape.max_context)?;
    write_f32(&mut bytes, 56, shape.rope_theta)?;
    write_f32(&mut bytes, 60, shape.rms_norm_epsilon)?;
    write_u64(&mut bytes, 64, tokenizer_offset)?;
    write_u64(&mut bytes, 72, tokenizer_length)?;
    write_u64(&mut bytes, 80, tensor_directory_offset)?;
    write_u32(&mut bytes, 88, tensors.len() as u32)?;
    write_u64(&mut bytes, 92, tensor_data_offset)?;
    write_u64(&mut bytes, 100, 0)?;

    let tokenizer_start = tokenizer_offset as usize;
    bytes[tokenizer_start..tokenizer_start + tokenizer.bytes.len()]
        .copy_from_slice(&tokenizer.bytes);

    for (index, tensor) in tensors.iter().enumerate() {
        let entry = tensor_directory_offset as usize + index * TENSOR_ENTRY_LEN;
        write_u64(&mut bytes, entry, tensor.name_hash)?;
        write_u32(&mut bytes, entry + 8, tensor.dtype)?;
        write_u32(&mut bytes, entry + 12, tensor.rank)?;
        write_u32(&mut bytes, entry + 16, tensor.dims[0])?;
        write_u32(&mut bytes, entry + 20, tensor.dims[1])?;
        write_u32(&mut bytes, entry + 24, tensor.dims[2])?;
        write_u32(&mut bytes, entry + 28, tensor.dims[3])?;
        write_u64(&mut bytes, entry + 32, tensor_offsets[index])?;
        write_u64(&mut bytes, entry + 40, tensor.byte_len() as u64)?;
        write_u64(&mut bytes, entry + 48, scale_offsets[index])?;
        write_u32(&mut bytes, entry + 56, tensor.block_size)?;

        write_tensor_payload_from_values(
            &mut bytes,
            tensor,
            &values[index],
            tensor_offsets[index],
            scale_offsets[index],
        )?;
    }

    let checksum = simple_checksum(&bytes);
    write_u64(&mut bytes, 100, checksum)?;

    Ok(bytes)
}

fn validate_model_numerical_configuration(shape: &ModelShape) -> io::Result<()> {
    if !shape.rope_theta.is_finite() || shape.rope_theta <= 0.0 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "model rope_theta must be finite and greater than zero",
        ));
    }
    if !shape.rms_norm_epsilon.is_finite() || shape.rms_norm_epsilon <= 0.0 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "model rms_norm_epsilon must be finite and greater than zero",
        ));
    }
    Ok(())
}

fn simple_checksum(bytes: &[u8]) -> u64 {
    let mut acc = 0x9e3779b97f4a7c15u64;
    for (index, byte) in bytes.iter().enumerate() {
        let value = if (100..108).contains(&index) {
            0
        } else {
            *byte
        };
        acc ^= u64::from(value).wrapping_add((index as u64) << 1);
        acc = acc.rotate_left(7).wrapping_mul(0x100000001b3);
    }
    acc
}

fn write_tensor_payload(
    bytes: &mut [u8],
    tensor: &TensorSpec,
    tensor_offset: u64,
    scale_offset: u64,
) -> io::Result<()> {
    match tensor.dtype {
        DTYPE_F32 => write_f32_tensor(bytes, tensor, tensor_offset),
        DTYPE_Q8_0 => write_q8_tensor(bytes, tensor, tensor_offset, scale_offset),
        DTYPE_Q4_0 => write_q4_tensor(bytes, tensor, tensor_offset, scale_offset),
        DTYPE_Q5_0 => write_q5_tensor(bytes, tensor, tensor_offset, scale_offset),
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "unsupported tensor dtype",
        )),
    }
}

fn write_f32_tensor(bytes: &mut [u8], tensor: &TensorSpec, tensor_offset: u64) -> io::Result<()> {
    let start = tensor_offset as usize;
    for elem in 0..tensor.element_count() {
        write_f32(bytes, start + elem * 4, fixture_value(tensor, elem))?;
    }
    Ok(())
}

fn write_q8_tensor(
    bytes: &mut [u8],
    tensor: &TensorSpec,
    tensor_offset: u64,
    scale_offset: u64,
) -> io::Result<()> {
    let rows = tensor.rows();
    let cols = tensor.cols_per_row();
    let start = tensor_offset as usize;
    let scale_start = scale_offset as usize;
    let mut row_values = vec![0.0; cols];
    let mut quantized = vec![0i8; cols];
    for row in 0..rows {
        for (col, row_value) in row_values.iter_mut().enumerate().take(cols) {
            *row_value = fixture_value(tensor, row * cols + col);
        }
        let scale = quantize_q8_row(&row_values, &mut quantized);
        write_f32(bytes, scale_start + row * 4, scale)?;
        for col in 0..cols {
            bytes[start + row * cols + col] = quantized[col] as u8;
        }
    }
    Ok(())
}

fn write_q4_tensor(
    bytes: &mut [u8],
    tensor: &TensorSpec,
    tensor_offset: u64,
    scale_offset: u64,
) -> io::Result<()> {
    let rows = tensor.rows();
    let cols = tensor.cols_per_row();
    let block = tensor.block_size as usize;
    if block == 0 || !block.is_multiple_of(2) || !cols.is_multiple_of(block) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "q4 tensor columns must divide into even blocks",
        ));
    }
    let blocks_per_row = cols / block;
    let start = tensor_offset as usize;
    let scale_start = scale_offset as usize;
    let mut block_values = vec![0.0; block];
    let mut quantized = vec![0i8; block];
    for row in 0..rows {
        for block_index in 0..blocks_per_row {
            let value_start = row * cols + block_index * block;
            for (col, block_value) in block_values.iter_mut().enumerate().take(block) {
                *block_value = fixture_value(tensor, value_start + col);
            }
            let scale = quantize_q4_block(&block_values, &mut quantized);
            write_f32(
                bytes,
                scale_start + (row * blocks_per_row + block_index) * 4,
                scale,
            )?;
            let byte_start = start + (row * cols + block_index * block) / 2;
            for pair in 0..(block / 2) {
                bytes[byte_start + pair] =
                    pack_q4_pair(quantized[pair * 2], quantized[pair * 2 + 1]);
            }
        }
    }
    Ok(())
}

fn write_q5_tensor(
    bytes: &mut [u8],
    tensor: &TensorSpec,
    tensor_offset: u64,
    scale_offset: u64,
) -> io::Result<()> {
    let rows = tensor.rows();
    let cols = tensor.cols_per_row();
    let block = tensor.block_size as usize;
    if block == 0 || !block.is_multiple_of(8) || !cols.is_multiple_of(block) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "q5 tensor columns must divide into byte-aligned blocks",
        ));
    }
    let blocks_per_row = cols / block;
    let bytes_per_block = block * 5 / 8;
    let start = tensor_offset as usize;
    let scale_start = scale_offset as usize;
    let mut block_values = vec![0.0; block];
    let mut quantized = vec![0i8; block];
    let mut packed = vec![0u8; bytes_per_block];
    for row in 0..rows {
        for block_index in 0..blocks_per_row {
            let value_start = row * cols + block_index * block;
            for (col, block_value) in block_values.iter_mut().enumerate().take(block) {
                *block_value = fixture_value(tensor, value_start + col);
            }
            let scale = quantize_q5_block(&block_values, &mut quantized);
            write_f32(
                bytes,
                scale_start + (row * blocks_per_row + block_index) * 4,
                scale,
            )?;
            pack_q5_codes(&quantized, &mut packed)
                .map_err(|message| io::Error::new(io::ErrorKind::InvalidInput, message))?;
            let byte_start = start + (row * blocks_per_row + block_index) * bytes_per_block;
            bytes[byte_start..byte_start + bytes_per_block].copy_from_slice(&packed);
        }
    }
    Ok(())
}

pub(crate) fn fixture_value(tensor: &TensorSpec, elem: usize) -> f32 {
    match tensor.seed {
        1 => 0.125,
        2 | 4 | 5 => 1.0,
        3 => output_fixture_value(tensor, elem),
        6..=9 => square_identity_value(tensor, elem, 0.25),
        10 | 12 => 0.0625,
        11 => 0.0625,
        13 => tied_embedding_fixture_value(tensor, elem),
        _ => 0.0,
    }
}

fn write_tensor_payload_from_values(
    bytes: &mut [u8],
    tensor: &TensorSpec,
    values: &[f32],
    tensor_offset: u64,
    scale_offset: u64,
) -> io::Result<()> {
    match tensor.dtype {
        DTYPE_F32 => write_f32_tensor_from_values(bytes, values, tensor_offset),
        DTYPE_Q8_0 => {
            write_q8_tensor_from_values(bytes, tensor, values, tensor_offset, scale_offset)
        }
        DTYPE_Q4_0 => {
            write_q4_tensor_from_values(bytes, tensor, values, tensor_offset, scale_offset)
        }
        DTYPE_Q5_0 => {
            write_q5_tensor_from_values(bytes, tensor, values, tensor_offset, scale_offset)
        }
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "unsupported tensor dtype",
        )),
    }
}

fn write_f32_tensor_from_values(
    bytes: &mut [u8],
    values: &[f32],
    tensor_offset: u64,
) -> io::Result<()> {
    let start = tensor_offset as usize;
    for (elem, value) in values.iter().enumerate() {
        write_f32(bytes, start + elem * 4, *value)?;
    }
    Ok(())
}

fn write_q8_tensor_from_values(
    bytes: &mut [u8],
    tensor: &TensorSpec,
    values: &[f32],
    tensor_offset: u64,
    scale_offset: u64,
) -> io::Result<()> {
    let rows = tensor.rows();
    let cols = tensor.cols_per_row();
    let start = tensor_offset as usize;
    let scale_start = scale_offset as usize;
    let mut quantized = vec![0i8; cols];
    for row in 0..rows {
        let row_start = row * cols;
        let scale = quantize_q8_row(&values[row_start..row_start + cols], &mut quantized);
        write_f32(bytes, scale_start + row * 4, scale)?;
        for col in 0..cols {
            bytes[start + row * cols + col] = quantized[col] as u8;
        }
    }
    Ok(())
}

fn write_q4_tensor_from_values(
    bytes: &mut [u8],
    tensor: &TensorSpec,
    values: &[f32],
    tensor_offset: u64,
    scale_offset: u64,
) -> io::Result<()> {
    let rows = tensor.rows();
    let cols = tensor.cols_per_row();
    let block = tensor.block_size as usize;
    if block == 0 || !block.is_multiple_of(2) || !cols.is_multiple_of(block) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "q4 tensor columns must divide into even blocks",
        ));
    }
    let blocks_per_row = cols / block;
    let start = tensor_offset as usize;
    let scale_start = scale_offset as usize;
    let mut quantized = vec![0i8; block];
    for row in 0..rows {
        for block_index in 0..blocks_per_row {
            let value_start = row * cols + block_index * block;
            let block_values = &values[value_start..value_start + block];
            let scale = quantize_q4_block(block_values, &mut quantized);
            write_f32(
                bytes,
                scale_start + (row * blocks_per_row + block_index) * 4,
                scale,
            )?;
            let byte_start = start + (row * cols + block_index * block) / 2;
            for pair in 0..(block / 2) {
                bytes[byte_start + pair] =
                    pack_q4_pair(quantized[pair * 2], quantized[pair * 2 + 1]);
            }
        }
    }
    Ok(())
}

fn write_q5_tensor_from_values(
    bytes: &mut [u8],
    tensor: &TensorSpec,
    values: &[f32],
    tensor_offset: u64,
    scale_offset: u64,
) -> io::Result<()> {
    let rows = tensor.rows();
    let cols = tensor.cols_per_row();
    let block = tensor.block_size as usize;
    if block == 0 || !block.is_multiple_of(8) || !cols.is_multiple_of(block) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "q5 tensor columns must divide into byte-aligned blocks",
        ));
    }
    let blocks_per_row = cols / block;
    let bytes_per_block = block * 5 / 8;
    let start = tensor_offset as usize;
    let scale_start = scale_offset as usize;
    let mut quantized = vec![0i8; block];
    let mut packed = vec![0u8; bytes_per_block];
    for row in 0..rows {
        for block_index in 0..blocks_per_row {
            let value_start = row * cols + block_index * block;
            let block_values = &values[value_start..value_start + block];
            let scale = quantize_q5_block(block_values, &mut quantized);
            write_f32(
                bytes,
                scale_start + (row * blocks_per_row + block_index) * 4,
                scale,
            )?;
            pack_q5_codes(&quantized, &mut packed)
                .map_err(|message| io::Error::new(io::ErrorKind::InvalidInput, message))?;
            let byte_start = start + (row * blocks_per_row + block_index) * bytes_per_block;
            bytes[byte_start..byte_start + bytes_per_block].copy_from_slice(&packed);
        }
    }
    Ok(())
}

fn output_fixture_value(tensor: &TensorSpec, elem: usize) -> f32 {
    let hidden = tensor.dims[1] as usize;
    let row = elem / hidden;
    match row {
        101 => 1.0,
        257 => 0.25,
        _ => -0.01,
    }
}

fn tied_embedding_fixture_value(tensor: &TensorSpec, elem: usize) -> f32 {
    let hidden = tensor.dims[1] as usize;
    let row = elem / hidden;
    match row {
        101 => 1.0,
        257 => 0.25,
        _ => 0.125,
    }
}

fn square_identity_value(tensor: &TensorSpec, elem: usize, scale: f32) -> f32 {
    let rows = tensor.dims[0] as usize;
    let cols = tensor.dims[1] as usize;
    if rows == cols && elem / cols == elem % cols {
        scale
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn model_writer_preserves_model_specific_rope_and_rms_values() {
        let mut shape = ModelShape::tiny_fixture();
        shape.rope_theta = 100_000.0;
        shape.rms_norm_epsilon = 1e-6;
        let tensors = tensor_writer::tensors_for_shape(&shape, DTYPE_F32);

        let bytes = build_model_file(&shape, &tensors, &TokenizerSection::phase_one()).unwrap();

        assert_eq!(
            f32::from_bits(u32::from_le_bytes(bytes[56..60].try_into().unwrap())),
            100_000.0
        );
        assert_eq!(
            f32::from_bits(u32::from_le_bytes(bytes[60..64].try_into().unwrap())),
            1e-6
        );
    }

    #[test]
    fn model_writer_rejects_invalid_numerical_configuration() {
        for (rope_theta, rms_norm_epsilon) in [
            (0.0, 1e-5),
            (f32::NAN, 1e-5),
            (10_000.0, 0.0),
            (10_000.0, f32::INFINITY),
        ] {
            let mut shape = ModelShape::tiny_fixture();
            shape.rope_theta = rope_theta;
            shape.rms_norm_epsilon = rms_norm_epsilon;
            let tensors = tensor_writer::tensors_for_shape(&shape, DTYPE_F32);

            let error = build_model_file(&shape, &tensors, &TokenizerSection::phase_one())
                .expect_err("invalid model numerical configuration must fail closed");

            assert_eq!(error.kind(), io::ErrorKind::InvalidInput);
        }
    }

    // Keeps temporary parser fixtures outside the repository tree.
    fn unique_tail_test_path(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "tinyrustlm-slm-pack-main-{name}-{}-{nanos}.txt",
            std::process::id()
        ))
    }

    // Preserves the historical single-tail eval-cases interpretation.
    #[test]
    fn browser_safetensors_tail_keeps_single_eval_cases_path() {
        let eval_cases = unique_tail_test_path("eval-cases");
        fs::write(&eval_cases, "tinyrustlm_eval_cases_version=1\n").unwrap();
        let eval_cases_arg = eval_cases.display().to_string();

        let (eval_cases_tail, review_tail) =
            split_browser_safetensors_bundle_tail(Some(eval_cases_arg.clone()), None);

        assert_eq!(eval_cases_tail.as_deref(), Some(eval_cases_arg.as_str()));
        assert!(review_tail.is_none());
        fs::remove_file(eval_cases).unwrap();
    }

    // Allows a lone candidate-review path to drive eval routing from eval_cases_route.
    #[test]
    fn browser_safetensors_tail_routes_single_candidate_review_path() {
        let review = unique_tail_test_path("candidate-review");
        fs::write(
            &review,
            "tinyrustlm_safetensors_candidate_review_version=1\n",
        )
        .unwrap();
        let review_arg = review.display().to_string();

        let (eval_cases_tail, review_tail) =
            split_browser_safetensors_bundle_tail(Some(review_arg.clone()), None);

        assert!(eval_cases_tail.is_none());
        assert_eq!(review_tail.as_deref(), Some(review_arg.as_str()));
        fs::remove_file(review).unwrap();
    }

    // Keeps the explicit eval-cases plus candidate-review tail unchanged.
    #[test]
    fn browser_safetensors_tail_keeps_explicit_eval_and_review_paths() {
        let eval_cases_arg = "cases.txt".to_string();
        let review_arg = "candidate.review".to_string();

        let (eval_cases_tail, review_tail) = split_browser_safetensors_bundle_tail(
            Some(eval_cases_arg.clone()),
            Some(review_arg.clone()),
        );

        assert_eq!(eval_cases_tail.as_deref(), Some(eval_cases_arg.as_str()));
        assert_eq!(review_tail.as_deref(), Some(review_arg.as_str()));
    }

    // Keeps the printed safetensors handoff route aligned with accepted CLI tails.
    #[test]
    fn primary_usage_lists_review_bound_safetensors_tails() {
        let usage = primary_usage_text();

        assert!(usage.contains("[eval-cases-route] [source-config-route] [source-tokenizer-route]"));
        assert!(usage.contains(
            "extract-safetensors-source <input.safetensors> <tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe> <output-source-dir> [candidate-review]"
        ));
        assert!(usage.contains("inspect-gguf <input.gguf> [output.report]"));
        assert!(usage.contains(
            "plan-gguf-source <input.gguf> <tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe> [output.plan]"
        ));
        assert!(usage.contains(
            "extract-gguf-source <input.gguf> <tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe> <output-source-dir>"
        ));
        assert!(usage.contains(
            "convert-safetensors-trained <input.safetensors> <tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe> <output-source-dir> <output.slm> [f32|q8_0|q4_0] [candidate-review]"
        ));
        assert!(usage.contains(
            "convert-gguf-trained <input.gguf> <tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe> <output-source-dir> <output.slm> [f32|q8_0|q4_0]"
        ));
        assert!(usage.contains(
            "convert-huggingface-request <request.json> <input.safetensors-or-directory> <output-dir> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe] [f32|q8_0|q4_0]"
        ));
        assert!(
            usage.contains("inspect-huggingface-conversion-request <request.json> [output.report]")
        );
        assert!(usage.contains(
            "inspect-huggingface-conversion-receipt <receipt> <request.json> <preflight> <output.slm> <output.manifest>"
        ));
        assert!(usage.contains(
            "write-safetensors-fixture <output.safetensors> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe] [local|huggingface]"
        ));
        assert!(usage.contains(
            "write-safetensors-fixture-shards <output-dir> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe] [local|huggingface]"
        ));
        assert!(usage.contains("write-gguf-fixture <output.gguf>"));
        assert!(usage.contains(
            "write-gguf-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ));
        assert!(usage.contains(
            "write-gguf-q8-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ));
        assert!(usage.contains(
            "write-gguf-q8-1-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ));
        assert!(usage.contains(
            "write-gguf-q8-k-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ));
        assert!(usage.contains(
            "write-gguf-q2-k-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ));
        assert!(usage.contains(
            "write-gguf-q3-k-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ));
        assert!(usage.contains(
            "write-gguf-q6-k-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ));
        assert!(usage.contains(
            "write-gguf-q4-k-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ));
        assert!(usage.contains(
            "write-gguf-q4-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ));
        assert!(usage.contains(
            "write-gguf-q4-1-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ));
        assert!(usage.contains(
            "write-gguf-q5-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ));
        assert!(usage.contains(
            "write-gguf-q5-1-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ));
        assert!(usage.contains(
            "write-gguf-q5-k-source-fixture <output.gguf> [tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe]"
        ));
        assert!(usage.contains(
            "browser-safetensors-trained-bundle <output-tinyrustlm-root> <input.safetensors> <tiny-fixture|tiny-fixture-tied|tiny-fixture-bpe|tinylm16|tinylm16-tied|tinylm16-bpe|stories15m-bpe|smollm2-135m-instruct-bpe|smollm2-360m-instruct-bpe> <output-source-dir> <composition-graph-root> [f32|q8_0|q4_0|all] [eval-cases.txt|candidate.review] [candidate-review]"
        ));
        assert!(usage.contains(
            "browser-converted-trained-bundle <output-tinyrustlm-root> <input-source-dir> <composition-graph-root> [f32|q8_0|q4_0|all] [eval-cases.txt]"
        ));
    }
}
