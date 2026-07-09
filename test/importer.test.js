import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store } from "../server/store.js";
import { ImportService, parseStructuredQuestions } from "../server/importer.js";

const fixtureText = `
基础逻辑
1.【选择题】二进制转换
专题：基础逻辑
题干：二进制数 (110101)2 转换为十进制数是：
A. 51
B. 53
C. 55
D. 57
答案：B
解析：1101012 = 32 + 16 + 4 + 1 = 53。
知识点：数制与编码；二进制转换
难度：1

2.【填空题】逻辑函数化简
专题：基础逻辑
题干：逻辑函数 F=A'B+AB 可以化简为 ________。
答案：B
解析：F=B(A'+A)=B。
知识点：逻辑函数化简；逻辑代数
难度：2
`;

function fixture() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "digital-circuit-import-"));
  const store = new Store(dataDir);
  const importer = new ImportService(store, { parseQuestions: async () => [] });
  return {
    store,
    importer,
    cleanup: () => fs.rmSync(dataDir, { recursive: true, force: true })
  };
}

test("structured text imports as separate questions", async () => {
  const questions = parseStructuredQuestions(fixtureText, "数字电路题库导入演示.docx");
  assert.equal(questions.length, 2);
  assert.equal(questions[0].title, "二进制转换");
  assert.equal(questions[0].answer, 1);
  assert.deepEqual(questions[0].options, ["51", "53", "55", "57"]);
  assert.equal(questions[1].type, "fill_blank");
});

test("uploaded Chinese filename is normalized before saving", async () => {
  const { store, importer, cleanup } = fixture();
  try {
    const original = "数字电路题库导入演示.docx";
    const mojibake = Buffer.from(original, "utf8").toString("latin1");
    importer.extract = async () => fixtureText;
    const result = await importer.import({
      originalname: mojibake,
      buffer: Buffer.from(fixtureText, "utf8")
    });
    assert.equal(result.count, 2);
    assert.equal(store.imported[0].source, original);
  } finally {
    cleanup();
  }
});
