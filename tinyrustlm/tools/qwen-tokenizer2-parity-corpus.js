"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "../..");
const corpusPath = path.join(
  repositoryRoot,
  "contracts/vnext/qwen-tokenizer2-parity-cases.v1.json"
);
const corpusSchema = "tinyrustlm.qwen_tokenizer2_parity_cases.v1";
const corpusId = "qwen3-0.6b-tokenizer2-parity-2048-v1";
const generatorProfileId = "tinyrustlm.qwen-tokenizer2-parity-corpus/1";
const seedHex = "6f2c4f41805f1297";
const sourceLockSha256 =
  "1641e8d4ab1fe9e4b6b3d24918c394fcf8d6e60d204be1f4c821f0f6570b1c70";
const artifactSha256 =
  "cbbf907ed95150c4db920c36cee9ab13eca2a3c6d2dcffb6bf5d7ac5b95b8f7b";

const categoryCounts = Object.freeze({
  "added-token-exact": 104,
  "added-token-near-miss": 104,
  "adversarial-boundary": 96,
  "chat-serialization": 64,
  "code-json": 128,
  "combining-boundary": 96,
  "contractions-case": 128,
  "empty-minimal": 16,
  "emoji-joiners": 96,
  "long-input": 16,
  "multilingual": 256,
  "numbers-units": 128,
  "ordinary-conversation": 240,
  "punctuation-symbols": 160,
  "randomized-unicode-mix": 96,
  "unicode-normalization": 160,
  "whitespace-linebreak": 160
});

const addedTokens = Object.freeze([
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
  "</think>"
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonicalBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function xorshift64(seed) {
  let state = seed;
  return () => {
    state ^= state << 13n;
    state ^= state >> 7n;
    state ^= state << 17n;
    state &= 0xffffffffffffffffn;
    return state;
  };
}

function pad(index) {
  return String(index).padStart(4, "0");
}

function addCases(cases, category, expectedCount, factory, allowEmpty = false) {
  const start = cases.length;
  for (let index = 0; index < expectedCount; index += 1) {
    const text = factory(index);
    invariant(typeof text === "string" && (allowEmpty || text.length > 0),
      `${category} case ${index} is empty`);
    cases.push(Object.freeze({
      caseId: `${category}-${pad(index)}`,
      category,
      text
    }));
  }
  invariant(cases.length - start === expectedCount,
    `${category} count is invalid`);
}

function ordinaryCases(cases) {
  const names = ["Ari", "Bea", "Chen", "Dara", "Emil", "Fatima", "Gita", "Hugo"];
  const tasks = [
    "compare two train routes", "rewrite a short note", "plan a quiet dinner",
    "summarize the meeting", "explain a Rust iterator", "choose a backup charger",
    "organize tomorrow's errands", "draft a direct answer"
  ];
  const constraints = [
    "without a car", "before 17:30", "using only pantry staples",
    "in three bullets", "for a new programmer", "with no wall outlet",
    "after the museum closes", "without changing the quoted text"
  ];
  addCases(cases, "ordinary-conversation", categoryCounts["ordinary-conversation"],
    (index) => `${names[index % names.length]} asks: Please ${tasks[(index * 3) % tasks.length]} ` +
      `${constraints[(index * 5) % constraints.length]}. Case ${index}: what should happen next?`);
}

function contractionCases(cases) {
  const stems = [
    "I can't believe we're late", "she'll say it's ready", "they've already left",
    "we'd rather wait", "you aren't required", "HE'S HERE", "I'd've checked",
    "That won't work", "who're you asking", "it mustn't drift"
  ];
  const suffixes = ["today", "AGAIN", "at 07:05", "... really?", "because it isn't safe"];
  addCases(cases, "contractions-case", categoryCounts["contractions-case"],
    (index) => `${stems[index % stems.length]} ${suffixes[(index * 7) % suffixes.length]} #${index}`);
}

function emptyMinimalCases(cases) {
  const values = [
    "", " ", "\n", "\r", "\r\n", "\t", "!", "0", "a", "Z", "'", "\u00a0",
    "\u0301", "\ud83d\ude00", "\u4e2d", "<"
  ];
  addCases(cases, "empty-minimal", categoryCounts["empty-minimal"],
    (index) => values[index], true);
}

function whitespaceCases(cases) {
  const forms = [
    (i) => ` leading ${i}`,
    (i) => `trailing ${i}   `,
    (i) => `\talpha\tbeta\t${i}`,
    (i) => `line one ${i}\nline two\n`,
    (i) => `line one ${i}\r\nline two\r\n`,
    (i) => `a\n\n\n b ${i}`,
    (i) => `a\r\rb ${i}`,
    (i) => `a\u00a0b\u2003c\u202fd ${i}`,
    (i) => `\n  indented ${i}\n    deeper`,
    (i) => `space-before-newline ${i}   \nnext`
  ];
  addCases(cases, "whitespace-linebreak", categoryCounts["whitespace-linebreak"],
    (index) => forms[index % forms.length](index));
}

function punctuationCases(cases) {
  const groups = [
    "!?.:,;", "()[]{}", "<>/\\|", "@#$%^&*", "-_+=~`", "'\"",
    "\u00a1\u00bf\u00ab\u00bb", "\u2018\u2019\u201c\u201d", "\u2013\u2014\u2026",
    "\u2190\u2191\u2192\u2193", "\u2200\u2202\u2203\u2211\u221a", "\u2600\u2605\u2665"
  ];
  addCases(cases, "punctuation-symbols", categoryCounts["punctuation-symbols"],
    (index) => `${groups[index % groups.length]} token-boundary-${index} ` +
      `${groups[(index * 5 + 3) % groups.length]}`);
}

function numberCases(cases) {
  const values = [
    "0", "7", "42", "0031", "-19", "+8", "3.14159", "1,024", "6.02e23",
    "99%", "$12.50", "EUR 9.95", "07:05", "2026-08-20", "0x7f", "0b1011"
  ];
  const units = ["ms", "GiB", "km/h", "deg C", "kg", "mL", "kWh", "tokens/s"];
  addCases(cases, "numbers-units", categoryCounts["numbers-units"],
    (index) => `measurement ${index}: ${values[index % values.length]} ` +
      `${units[(index * 3) % units.length]}; range ${index}-${index + 17}`);
}

function multilingualCases(cases) {
  const phrases = [
    "Bonjour, ou est la gare ?", "El nino pidio pinata y cafe.",
    "Fur grossere Genauigkeit prufe die Quelle.", "Istanbul'da yarin yagmur var mi?",
    "Privet, kak dela segodnya?", "Kalimera kosme", "Shalom olam",
    "Marhaban bil-alam", "Namaste duniya", "Nomoskar prithibi",
    "Sat sri akaal duniya", "Vanakkam ulakam", "Namaskaram lokam",
    "Sawasdee lok", "Xin chao the gioi", "Halo dunia", "Habari dunia",
    "Sannu duniya", "Mo ki gbogbo aye", "Ndewo uwa", "Sawubona mhlaba",
    "Hello world", "Dia dhuit a dhomhain", "Helo byd", "Kaixo mundua",
    "Ola mundo", "Czesc swiecie", "Ahoj svete", "Helló vilag",
    "Hei maailma", "Hej varlden", "Hallo wereld", "Saluton mondo",
    "\u4f60\u597d\uff0c\u4e16\u754c", "\u3053\u3093\u306b\u3061\u306f\u4e16\u754c",
    "\uc548\ub155\ud558\uc138\uc694 \uc138\uacc4", "\u0e2a\u0e27\u0e31\u0e2a\u0e14\u0e35\u0e0a\u0e32\u0e27\u0e42\u0e25\u0e01",
    "\u10d2\u10d0\u10db\u10d0\u10e0\u10ef\u10dd\u10d1\u10d0 \u10db\u10e1\u10dd\u10e4\u10da\u10d8\u10dd",
    "\u0532\u0561\u0580\u0565\u0582 \u0561\u0577\u056d\u0561\u0580\u0570",
    "\u1230\u120b\u121d \u12d3\u1208\u121d", "\u0393\u03b5\u03b9\u03ac \u03c3\u03bf\u03c5 \u03ba\u03cc\u03c3\u03bc\u03b5"
  ];
  addCases(cases, "multilingual", categoryCounts.multilingual,
    (index) => `${phrases[index % phrases.length]} [${index}] ` +
      `${phrases[(index * 11 + 7) % phrases.length]}`);
}

function normalizationCases(cases) {
  const pairs = [
    ["cafe\u0301", "caf\u00e9"], ["A\u030a", "\u00c5"],
    ["n\u0303", "\u00f1"], ["o\u0308", "\u00f6"],
    ["u\u0308\u0301", "\u01d8"], ["a\u0308\u0304", "\u01df"],
    ["\u03b1\u0313\u0301", "\u1f04"], ["\u03a9\u0345", "\u1ffc"],
    ["\u1100\u1161", "\uac00"], ["\u1102\u1161\u11ab", "\ub09c"]
  ];
  addCases(cases, "unicode-normalization", categoryCounts["unicode-normalization"],
    (index) => {
      const pair = pairs[index % pairs.length];
      return index % 2 === 0
        ? `decomposed:${pair[0]}:${index}:composed:${pair[1]}`
        : `composed:${pair[1]}:${index}:decomposed:${pair[0]}`;
    });
}

function combiningCases(cases) {
  const bases = ["a", "e", "i", "o", "u", "n", "\u03b1", "\u0438", "\u05d0", "\u0915"];
  const marks = ["\u0300", "\u0301", "\u0302", "\u0303", "\u0308", "\u0327", "\u0338", "\u034f"];
  addCases(cases, "combining-boundary", categoryCounts["combining-boundary"],
    (index) => `${bases[index % bases.length]}${marks[index % marks.length]}` +
      `${marks[(index * 3 + 1) % marks.length]}|${index}|` +
      `${marks[(index * 5 + 2) % marks.length]}${bases[(index + 4) % bases.length]}`);
}

function emojiCases(cases) {
  const values = [
    "\ud83d\ude00", "\ud83e\udd14", "\ud83d\ude80", "\ud83c\udf0d", "\u2764\ufe0f",
    "\ud83d\udc4d\ud83c\udffd", "\ud83d\udc69\u200d\ud83d\udcbb",
    "\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67",
    "\ud83c\uddfa\ud83c\uddf8", "\ud83c\uddef\ud83c\uddf5", "1\ufe0f\u20e3",
    "\ud83c\udff3\ufe0f\u200d\ud83c\udf08", "\ud83e\uddd1\u200d\ud83d\ude80"
  ];
  addCases(cases, "emoji-joiners", categoryCounts["emoji-joiners"],
    (index) => `emoji-${index}:${values[index % values.length]}` +
      `${values[(index * 7 + 2) % values.length]}:end`);
}

function addedTokenCases(cases) {
  addCases(cases, "added-token-exact", categoryCounts["added-token-exact"],
    (index) => {
      const token = addedTokens[Math.floor(index / 4)];
      const mode = index % 4;
      if (mode === 0) return token;
      if (mode === 1) return `left${token}right`;
      if (mode === 2) return `${token}${token}`;
      return ` ${token}\n${index}`;
    });
  addCases(cases, "added-token-near-miss", categoryCounts["added-token-near-miss"],
    (index) => {
      const token = addedTokens[Math.floor(index / 4)];
      const mode = index % 4;
      if (mode === 0) return token.replace("<", "<<");
      if (mode === 1) return token.replace(">", " >");
      if (mode === 2) return `${token.slice(0, -1)}x>`;
      return token.replace(/[A-Za-z]/u, (letter) =>
        letter === letter.toUpperCase() ? letter.toLowerCase() : letter.toUpperCase());
    });
}

function codeCases(cases) {
  const snippets = [
    (i) => `fn item_${i}(x: u32) -> u32 { x.checked_add(${i}).unwrap_or(0) }`,
    (i) => `{"case":${i},"ok":true,"items":[1,2,3],"text":"a\\nb"}`,
    (i) => `const value_${i} = input?.map(x => x + ${i}) ?? [];`,
    (i) => `SELECT id, name FROM items WHERE revision = ${i} ORDER BY id;`,
    (i) => `def f_${i}(value):\n    return {"id": ${i}, "value": value}`,
    (i) => `<section data-case="${i}"><p>Hello &amp; goodbye</p></section>`,
    (i) => `curl -H 'Range: bytes=${i}-${i + 31}' https://example.invalid/piece`,
    (i) => `path\\to\\file_${i}.rs /tmp/example_${i} C:\\work\\${i}`
  ];
  addCases(cases, "code-json", categoryCounts["code-json"],
    (index) => snippets[index % snippets.length](index));
}

function adversarialCases(cases) {
  const controls = ["\u0000", "\u0001", "\u0007", "\u0008", "\u000b", "\u000c", "\u001b", "\u001f", "\u007f", "\u0085"];
  const boundaries = ["'s", "'t", "'re", "'ve", "'m", "'ll", "'d", "'S", "'RE"];
  addCases(cases, "adversarial-boundary", categoryCounts["adversarial-boundary"],
    (index) => `A${controls[index % controls.length]}B${boundaries[index % boundaries.length]}` +
      ` ${index}\r\n\t${boundaries[(index * 5 + 1) % boundaries.length]}Z`);
}

function randomizedCases(cases) {
  const random = xorshift64(BigInt(`0x${seedHex}`));
  const pool = [
    "a", "Z", "7", " ", "\n", "\t", "!", "?", "'", "-", "_",
    "\u00e9", "e\u0301", "\u03a9", "\u0436", "\u05d0", "\u0634", "\u0915",
    "\u0e01", "\u3042", "\u4e2d", "\ud55c", "\ud83d\ude00", "\ud83d\udc69\u200d\ud83d\udcbb",
    "\u00a0", "\u2003", "\u2028", "\u2060", "\u0301", "\ufe0f"
  ];
  addCases(cases, "randomized-unicode-mix", categoryCounts["randomized-unicode-mix"],
    (index) => {
      const length = 12 + Number(random() % 53n);
      let text = `mix-${index}:`;
      for (let item = 0; item < length; item += 1) {
        text += pool[Number(random() % BigInt(pool.length))];
      }
      return text;
    });
}

function longCases(cases) {
  const patterns = [
    "alpha beta gamma 123! ", "e\u0301 cafe\u0301 \ud83d\ude00 ",
    "\u4f60\u597d\u4e16\u754c ", "\tline one\r\nline two\n", "<think>data</think> "
  ];
  addCases(cases, "long-input", categoryCounts["long-input"], (index) => {
    const target = 1024 * (index + 1);
    const pattern = patterns[index % patterns.length];
    let text = `long-${index}:`;
    while (Buffer.byteLength(text, "utf8") < target) text += pattern;
    return text;
  });
}

function chatCases(cases) {
  const roles = ["system", "user", "assistant", "tool"];
  addCases(cases, "chat-serialization", categoryCounts["chat-serialization"],
    (index) => `<|im_start|>${roles[index % roles.length]}\n` +
      `Message ${index}: quoted <|im_end|> text and ${index % 2 ? "<think>plan</think>" : "plain data"}.` +
      `<|im_end|>\n<|im_start|>${roles[(index + 1) % roles.length]}\n`);
}

function buildCorpus() {
  const cases = [];
  ordinaryCases(cases);
  contractionCases(cases);
  emptyMinimalCases(cases);
  whitespaceCases(cases);
  punctuationCases(cases);
  numberCases(cases);
  multilingualCases(cases);
  normalizationCases(cases);
  combiningCases(cases);
  emojiCases(cases);
  addedTokenCases(cases);
  codeCases(cases);
  adversarialCases(cases);
  randomizedCases(cases);
  longCases(cases);
  chatCases(cases);

  invariant(cases.length === 2048, "case count is not 2048");
  invariant(new Set(cases.map((entry) => entry.caseId)).size === cases.length,
    "case IDs are not unique");
  invariant(new Set(cases.map((entry) => entry.text)).size === cases.length,
    "case text is not unique");
  const actualCounts = Object.fromEntries(Object.keys(categoryCounts).map((category) => [
    category,
    cases.filter((entry) => entry.category === category).length
  ]));
  invariant(JSON.stringify(actualCounts) === JSON.stringify(categoryCounts),
    "category counts are invalid");
  invariant(cases.every((entry) => Buffer.byteLength(entry.text, "utf8") <= 32768),
    "case exceeds the preregistered input limit");

  return Object.freeze({
    schema: corpusSchema,
    corpusId,
    generatorProfileId,
    seedHex,
    sourceLockSha256,
    tokenizerArtifactSha256: artifactSha256,
    caseCount: cases.length,
    categoryCounts,
    cases
  });
}

function main(argumentsList) {
  invariant(argumentsList.length === 1 && ["--check", "--write"].includes(argumentsList[0]),
    "usage: node qwen-tokenizer2-parity-corpus.js --check|--write");
  const bytes = canonicalBytes(buildCorpus());
  if (argumentsList[0] === "--write") {
    fs.writeFileSync(corpusPath, bytes, { flag: "wx" });
  } else {
    invariant(fs.existsSync(corpusPath), "checked-in corpus is missing");
    invariant(fs.readFileSync(corpusPath).equals(bytes), "checked-in corpus has drifted");
  }
  process.stdout.write(`${JSON.stringify({
    schema: corpusSchema,
    corpusId,
    caseCount: 2048,
    bytes: bytes.length,
    sha256: sha256(bytes)
  }, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Qwen Tokenizer2 parity corpus failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({
  addedTokens,
  artifactSha256,
  buildCorpus,
  canonicalBytes,
  categoryCounts,
  corpusId,
  corpusPath,
  corpusSchema,
  generatorProfileId,
  seedHex,
  sourceLockSha256
});
