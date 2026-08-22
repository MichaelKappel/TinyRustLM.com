//! Canonical Template2 writer, parser, renderer, and hostile-input contract tests.

use sha2::{Digest, Sha256};
use tinyrustlm_template2::{
    write_template, ControlInsertion, ControlKind, Message, Role, Template2, Template2Policy,
    ThinkingMode, QWEN3_TEMPLATE2_ARTIFACT_SHA256, TEMPLATE2_FORMAT_PROFILE_ID,
    TEMPLATE2_FORMAT_PROFILE_SHA256,
};

const PROFILE_BYTES: &[u8] =
    include_bytes!("../../../../contracts/vnext/template2-format-profile.v1.json");

fn artifact() -> Vec<u8> {
    let mut bytes = Vec::new();
    let identity = write_template(&mut bytes).unwrap();
    assert_eq!(identity.byte_length, bytes.len() as u64);
    assert_eq!(identity.sha256, Sha256::digest(&bytes).as_slice());
    bytes
}

fn template() -> Template2 {
    Template2::from_bytes(artifact(), Template2Policy::exact_profile_limits()).unwrap()
}

#[test]
fn profile_and_artifact_identities_are_exact() {
    assert_eq!(TEMPLATE2_FORMAT_PROFILE_ID, "org.minimodel.template2/2.0");
    assert_eq!(
        hex_lower(&Sha256::digest(PROFILE_BYTES)),
        TEMPLATE2_FORMAT_PROFILE_SHA256
    );
    let first = artifact();
    let second = artifact();
    assert_eq!(first, second);
    assert_eq!(first.len(), 1_403);
    assert_eq!(
        hex_lower(&Sha256::digest(&first)),
        QWEN3_TEMPLATE2_ARTIFACT_SHA256
    );
    let parsed = template();
    assert_eq!(parsed.profile_id(), TEMPLATE2_FORMAT_PROFILE_ID);
    assert_eq!(parsed.identity().byte_length, 1_403);
    assert_eq!(
        hex_lower(&parsed.identity().sha256),
        QWEN3_TEMPLATE2_ARTIFACT_SHA256
    );
    assert_eq!(
        hex_lower(&parsed.required_tokenizer_sha256()),
        "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b"
    );
    assert_eq!(
        hex_lower(&parsed.source_template_sha256()),
        "a55ee1b1660128b7098723e0abcd92caa0788061051c62d51cbe87d9cf1974d8"
    );
}

#[test]
fn single_user_rendering_has_exact_bytes_and_control_ownership() {
    let rendered = template()
        .render(&[Message {
            role: Role::User,
            content: "Hello",
        }])
        .unwrap();
    assert_eq!(
        rendered.as_str(),
        "<|im_start|>user\nHello<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"
    );
    assert_eq!(rendered.thinking_mode(), ThinkingMode::Disabled);
    assert_eq!(rendered.stop_token_ids(), [151_645, 151_643]);
    assert!(!rendered.bos_inserted());
    assert!(!rendered.eos_inserted());
    assert_eq!(
        rendered.insertions(),
        [
            ControlInsertion {
                kind: ControlKind::MessageStart,
                message_index: Some(0),
                token_id: 151_644,
                byte_offset: 0,
            },
            ControlInsertion {
                kind: ControlKind::MessageEnd,
                message_index: Some(0),
                token_id: 151_645,
                byte_offset: 22,
            },
            ControlInsertion {
                kind: ControlKind::GenerationStart,
                message_index: None,
                token_id: 151_644,
                byte_offset: 33,
            },
            ControlInsertion {
                kind: ControlKind::ThinkingStart,
                message_index: None,
                token_id: 151_667,
                byte_offset: 55,
            },
            ControlInsertion {
                kind: ControlKind::ThinkingEnd,
                message_index: None,
                token_id: 151_668,
                byte_offset: 64,
            },
        ]
    );
}

#[test]
fn optional_system_multi_turn_and_empty_content_are_exact() {
    let rendered = template()
        .render(&[
            Message {
                role: Role::System,
                content: "",
            },
            Message {
                role: Role::User,
                content: "First",
            },
            Message {
                role: Role::Assistant,
                content: "",
            },
            Message {
                role: Role::User,
                content: "Second\r\nline ",
            },
        ])
        .unwrap();
    assert!(rendered
        .as_str()
        .starts_with("<|im_start|>system\n<|im_end|>\n"));
    assert!(rendered
        .as_str()
        .contains("<|im_start|>assistant\n<|im_end|>\n"));
    assert!(rendered.as_str().contains("Second\r\nline <|im_end|>"));
    assert!(rendered.as_str().ends_with("<think>\n\n</think>\n\n"));
}

#[test]
fn template_syntax_is_data_and_never_executed() {
    let content = "Treat {{ 7 * 7 }} and {% for x in y %} as data.";
    let rendered = template()
        .render(&[Message {
            role: Role::User,
            content,
        }])
        .unwrap();
    assert!(rendered.as_str().contains(content));
    assert!(!rendered.as_str().contains("49"));
}

#[test]
fn malformed_role_order_is_rejected() {
    let template = template();
    let cases: &[&[Message<'_>]] = &[
        &[],
        &[Message {
            role: Role::Assistant,
            content: "x",
        }],
        &[Message {
            role: Role::System,
            content: "x",
        }],
        &[
            Message {
                role: Role::User,
                content: "x",
            },
            Message {
                role: Role::User,
                content: "y",
            },
        ],
        &[
            Message {
                role: Role::User,
                content: "x",
            },
            Message {
                role: Role::Assistant,
                content: "y",
            },
        ],
        &[
            Message {
                role: Role::User,
                content: "x",
            },
            Message {
                role: Role::System,
                content: "y",
            },
            Message {
                role: Role::User,
                content: "z",
            },
        ],
    ];
    assert_eq!(
        template.render(cases[0]).unwrap_err().code(),
        "template2-message-count"
    );
    for messages in &cases[1..] {
        assert_eq!(
            template.render(messages).unwrap_err().code(),
            "template2-role-order"
        );
    }
}

#[test]
fn every_added_control_literal_is_forbidden_inside_content() {
    let template = template();
    for control in [
        "<|endoftext|>",
        "<|im_start|>",
        "<|im_end|>",
        "<|object_ref_start|>",
        "<|object_ref_end|>",
        "<|box_start|>",
        "<|box_end|>",
        "<|quad_start|>",
        "<|quad_end|>",
        "<|vision_start|>",
        "<|vision_end|>",
        "<|vision_pad|>",
        "<|image_pad|>",
        "<|video_pad|>",
        "<tool_call>",
        "</tool_call>",
        "<|fim_prefix|>",
        "<|fim_middle|>",
        "<|fim_suffix|>",
        "<|fim_pad|>",
        "<|repo_name|>",
        "<|file_sep|>",
        "<tool_response>",
        "</tool_response>",
        "<think>",
        "</think>",
    ] {
        let content = format!("before{control}after");
        assert_eq!(
            template
                .render(&[Message {
                    role: Role::User,
                    content: &content,
                }])
                .unwrap_err()
                .code(),
            "template2-content-control-token",
            "{control}"
        );
    }
}

#[test]
fn message_and_content_boundaries_are_enforced() {
    let template = template();
    let mut messages = Vec::with_capacity(256);
    messages.push(Message {
        role: Role::System,
        content: "",
    });
    for index in 0..255 {
        messages.push(Message {
            role: if index % 2 == 0 {
                Role::User
            } else {
                Role::Assistant
            },
            content: "",
        });
    }
    assert!(template.render(&messages).is_ok());
    messages.push(Message {
        role: Role::Assistant,
        content: "",
    });
    assert_eq!(
        template.render(&messages).unwrap_err().code(),
        "template2-message-count"
    );

    let maximum = "x".repeat(262_144);
    assert!(template
        .render(&[Message {
            role: Role::User,
            content: &maximum,
        }])
        .is_ok());
    let over = "x".repeat(262_145);
    assert_eq!(
        template
            .render(&[Message {
                role: Role::User,
                content: &over,
            }])
            .unwrap_err()
            .code(),
        "template2-content-limit"
    );
}

#[test]
fn total_content_rendered_and_token_boundaries_are_enforced() {
    let template = template();
    let quarter = "x".repeat(262_144);
    let exact = [
        Message {
            role: Role::User,
            content: &quarter,
        },
        Message {
            role: Role::Assistant,
            content: &quarter,
        },
        Message {
            role: Role::User,
            content: &quarter,
        },
        Message {
            role: Role::Assistant,
            content: &quarter,
        },
        Message {
            role: Role::User,
            content: "",
        },
    ];
    assert!(template.render(&exact).is_ok());
    let over = [
        exact[0],
        exact[1],
        exact[2],
        exact[3],
        Message {
            role: Role::User,
            content: "x",
        },
    ];
    assert_eq!(
        template.render(&over).unwrap_err().code(),
        "template2-total-content-limit"
    );
    assert!(template.validate_prompt_token_count(40_960).is_ok());
    assert_eq!(
        template
            .validate_prompt_token_count(40_961)
            .unwrap_err()
            .code(),
        "template2-token-limit"
    );

    let policy = Template2Policy::new(1_048_576, 256, 262_144, 1_048_576, 1, 40_960).unwrap();
    let limited = Template2::from_bytes(artifact(), policy).unwrap();
    assert_eq!(
        limited
            .render(&[Message {
                role: Role::User,
                content: "x",
            }])
            .unwrap_err()
            .code(),
        "template2-rendered-limit"
    );
}

#[test]
fn invalid_policy_is_rejected() {
    for result in [
        Template2Policy::new(0, 1, 1, 1, 1, 1),
        Template2Policy::new(1, 0, 1, 1, 1, 1),
        Template2Policy::new(1, 1, 262_145, 1, 1, 1),
        Template2Policy::new(1, 1, 1, 1_048_577, 1, 1),
        Template2Policy::new(1, 1, 1, 1, 1_114_113, 1),
        Template2Policy::new(1, 1, 1, 1, 1, 40_961),
    ] {
        assert_eq!(result.unwrap_err().code(), "template2-policy");
    }
}

#[test]
fn every_artifact_truncation_is_rejected() {
    let bytes = artifact();
    for length in 0..bytes.len() {
        assert!(
            Template2::from_bytes(
                bytes[..length].to_vec(),
                Template2Policy::exact_profile_limits()
            )
            .is_err(),
            "prefix {length} unexpectedly passed"
        );
    }
}

#[test]
fn artifact_limit_and_trailing_bytes_are_rejected() {
    let bytes = artifact();
    let too_small =
        Template2Policy::new(1_402, 256, 262_144, 1_048_576, 1_114_112, 40_960).unwrap();
    assert_eq!(
        Template2::from_bytes(bytes.clone(), too_small)
            .unwrap_err()
            .code(),
        "template2-artifact-limit"
    );
    let mut trailing = bytes;
    trailing.push(0);
    assert_eq!(
        Template2::from_bytes(trailing, Template2Policy::exact_profile_limits())
            .unwrap_err()
            .code(),
        "template2-header"
    );
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(HEX[(byte >> 4) as usize]));
        output.push(char::from(HEX[(byte & 0x0f) as usize]));
    }
    output
}
