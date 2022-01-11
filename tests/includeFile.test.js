import DirectivePreprocessor from '../source/DirectivePreprocessor.js';

test('include should be replaced with file content', () => {
  const content = `// #include "sum.js"`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    baseDirectory: './tests/files'
  });

  expect(result).toBe(`function sum(a, b) {\r\n  return a + b;\r\n}`);
});

test('multiline include symbol should be replaced with file content', () => {
  const content = `console.log(/* #include "constant.js" */)`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    baseDirectory: './tests/files'
  });

  expect(result).toBe(`console.log("TEST")`);
});

test('include should apply line indent to the file content', () => {
  const content = `  // #include "sum.js"`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    baseDirectory: './tests/files'
  });

  expect(result).toBe(`  function sum(a, b) {\r\n    return a + b;\r\n  }`);
});