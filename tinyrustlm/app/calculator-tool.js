(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TinyRustLMCalculator = factory();
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const maxExpressionCharacters = 256;
  const arithmeticCharacters = /^[0-9\s.+\-*/%^()eE]+$/;

  function normalizeExpression(value) {
    const expression = String(value || "").trim();
    if (
      !expression ||
      expression.length > maxExpressionCharacters ||
      !arithmeticCharacters.test(expression) ||
      !/[0-9]/.test(expression)
    ) {
      return null;
    }
    return expression.replace(/\s+/g, " ");
  }

  function stripQuestionMark(value) {
    return String(value || "").trim().replace(/\?\s*$/, "").trim();
  }

  function parseRequest(prompt) {
    const text = String(prompt || "").trim();
    if (!text) {
      return null;
    }

    const slashMatch = text.match(/^\/calc(?:ulator)?\s+([\s\S]+)$/i);
    if (slashMatch) {
      const expression = normalizeExpression(slashMatch[1]);
      return expression ? Object.freeze({ expression, route: "slash-command" }) : null;
    }

    const naturalMatch = text.match(/^(?:calculate|what\s+is)\s+([\s\S]+)$/i);
    if (naturalMatch) {
      const expression = normalizeExpression(stripQuestionMark(naturalMatch[1]));
      return expression ? Object.freeze({ expression, route: "natural-language" }) : null;
    }

    const expression = normalizeExpression(text);
    const binaryOperator = expression && /[+*/%^]|\d\s*-\s*\d/.test(expression);
    return expression && binaryOperator
      ? Object.freeze({ expression, route: "expression-only" })
      : null;
  }

  function formatResponse(expression, result) {
    const normalizedExpression = normalizeExpression(expression);
    const normalizedResult = String(result || "").trim();
    if (!normalizedExpression || !normalizedResult || /[\r\n]/.test(normalizedResult)) {
      throw new TypeError("calculator response inputs are invalid");
    }
    return `Calculator: ${normalizedExpression} = ${normalizedResult}`;
  }

  return Object.freeze({
    maxExpressionCharacters,
    parseRequest,
    formatResponse
  });
}));
