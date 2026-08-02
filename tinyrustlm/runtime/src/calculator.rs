//! Bounded arithmetic evaluation for the browser-local calculator tool.

use crate::errors::ErrorCode;

/// Maximum UTF-8 byte length accepted by the calculator ABI.
pub const MAX_EXPRESSION_BYTES: usize = 256;

/// Evaluates one finite arithmetic expression without variables or functions.
///
/// Parsing and operator precedence are delegated to `fasteval`. TinyRustLM
/// deliberately narrows that language to numeric literals, parentheses, and
/// arithmetic operators so untrusted prompts cannot invoke functions, output,
/// variables, comparisons, or logical expressions.
pub fn evaluate(expression: &str) -> Result<String, ErrorCode> {
    let expression = expression.trim();
    if expression.is_empty() || expression.len() > MAX_EXPRESSION_BYTES {
        return Err(ErrorCode::InvalidLength);
    }
    if !expression.is_ascii()
        || !expression.bytes().all(|byte| {
            matches!(
                byte,
                b'0'..=b'9'
                    | b' '
                    | b'\t'
                    | b'\r'
                    | b'\n'
                    | b'.'
                    | b'+'
                    | b'-'
                    | b'*'
                    | b'/'
                    | b'%'
                    | b'^'
                    | b'('
                    | b')'
                    | b'e'
                    | b'E'
            )
        })
        || !expression.bytes().any(|byte| byte.is_ascii_digit())
    {
        return Err(ErrorCode::InvalidExpression);
    }

    let mut namespace = fasteval::EmptyNamespace;
    let value =
        fasteval::ez_eval(expression, &mut namespace).map_err(|_| ErrorCode::InvalidExpression)?;
    if !value.is_finite() {
        return Err(ErrorCode::NonFiniteResult);
    }
    Ok(format_result(value))
}

fn format_result(value: f64) -> String {
    let rounded = if value.abs() <= 1_000_000_000_000.0 {
        (value * 1_000_000_000_000.0).round() / 1_000_000_000_000.0
    } else {
        value
    };
    if rounded == 0.0 {
        "0".to_string()
    } else {
        rounded.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn evaluates_precedence_parentheses_and_decimal_results() {
        assert_eq!(evaluate("2 + 3 * 4").unwrap(), "14");
        assert_eq!(evaluate("(2 + 3) * 4").unwrap(), "20");
        assert_eq!(evaluate("0.1 + 0.2").unwrap(), "0.3");
        assert_eq!(evaluate("1 / 3").unwrap(), "0.333333333333");
        assert_eq!(evaluate("1e3 + 24").unwrap(), "1024");
    }

    #[test]
    fn rejects_functions_variables_and_non_arithmetic_operators() {
        for expression in ["print(1)", "pi()", "x + 1", "2 < 3", "1 && 1"] {
            assert_eq!(evaluate(expression), Err(ErrorCode::InvalidExpression));
        }
    }

    #[test]
    fn rejects_empty_oversized_and_non_finite_expressions() {
        assert_eq!(evaluate(" "), Err(ErrorCode::InvalidLength));
        assert_eq!(
            evaluate(&"1".repeat(MAX_EXPRESSION_BYTES + 1)),
            Err(ErrorCode::InvalidLength)
        );
        assert_eq!(evaluate("1 / 0"), Err(ErrorCode::NonFiniteResult));
        assert_eq!(evaluate("0 / 0"), Err(ErrorCode::NonFiniteResult));
    }
}
