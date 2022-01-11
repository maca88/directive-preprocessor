import DirectivePreprocessor from '../source/DirectivePreprocessor.js';

test('include symbol should be replaced', () => {
  const content = `// #include TEST`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    includeSymbols: 'TEST=console.log("=");'
  });

  expect(result).toBe('console.log("=");');
});

test('multiline include symbol should be replaced', () => {
  const content = `/* #include TEST */`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    includeSymbols: 'TEST=console.log("=");'
  });

  expect(result).toBe('console.log("=");');
});

test('include inside enabled #if directive should be replaced', () => {
  const content = `// #if TEST
  // #include TEST
  // #endif`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    definedSymbols: ['TEST'],
    includeSymbols: 'TEST=console.log("=");'
  });

  expect(result).toBe('  console.log("=");');
});

test('include symbol should work on if directive', () => {
  const content = `// #if TEST
  // #include TEST
  // #endif`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    includeSymbols: 'TEST=console.log("=");'
  });

  expect(result).toBe('  console.log("=");');
});

test('include inside disabled #if directive should be removed', () => {
  const content = `// #if TEST2
  // #include TEST
  // #endif`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    includeSymbols: 'TEST=console.log("=");'
  });

  expect(result).toBe('');
});

test('include should apply line ident to all symbol value lines', () => {
  const content = `  \t// #include TEST`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    includeSymbols: 'TEST=A\nB\r\nC'
  });

  expect(result).toBe('  \tA\n  \tB\r\n  \tC');
});