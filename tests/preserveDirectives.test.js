import DirectivePreprocessor from '../source/DirectivePreprocessor.js';

test('disabled #if directive should be preserved and its content removed', () => {
  const content = `// #if TEST
  console.log('test');
  // #endif`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    definedSymbols: [],
    preserveDirectives: true
  });

  expect(result).toBe(`// #if TEST
  // #endif`);
});

test('enabled #if directive should not be removed', () => {
  const content = `// #if TEST
  console.log('test');
  // #endif`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    definedSymbols: ['TEST'],
    preserveDirectives: true
  });

  expect(result).toBe(content);
});

test('enabled #elif directive should not be removed', () => {
  const content = `// #if TEST
  console.log('test');
  // #elif TEST2
  console.log('test2');
  // #endif`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    definedSymbols: ['TEST2'],
    preserveDirectives: true
  });

  expect(result).toBe(`// #if TEST
  // #elif TEST2
  console.log('test2');
  // #endif`);
});

test('No directives should be removed when using #if #elif and #else directives', () => {
  const content = `// #if TEST
  console.log('test');
  // #elif TEST2
  console.log('test2');
  // #else
  console.log('else');
  // #endif`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    definedSymbols: [],
    preserveDirectives: true
  });

  expect(result).toBe(`// #if TEST
  // #elif TEST2
  // #else
  console.log('else');
  // #endif`);
});
test('disabled nested #if should not be removed', () => {
  const content = `// #if TEST
  console.log('test');
  // #if TEST2
  console.log('test2');
  // #endif
  // #endif`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    definedSymbols: ['TEST'],
    preserveDirectives: true
  });

  expect(result).toBe(`// #if TEST
  console.log('test');
  // #if TEST2
  // #endif
  // #endif`);
});