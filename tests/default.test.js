import DirectivePreprocessor from '../source/DirectivePreprocessor.js';

test('disabled #if directive should be removed along with its content', () => {
  const content = `// #if TEST
  console.log('test');
  // #endif`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    definedSymbols: []
  });

  expect(result).toBe('');
});

test('by default enabled #if directive should be removed', () => {
  const content = `// #if TEST
  console.log('test');
  // #endif`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    definedSymbols: ['TEST']
  });

  expect(result).toBe(`  console.log('test');`);
});

test('by default enabled #elif directive should be removed', () => {
  const content = `// #if TEST
  console.log('test');
  // #elif TEST2
  console.log('test2');
  // #endif`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    definedSymbols: ['TEST2']
  });

  expect(result).toBe(`  console.log('test2');`);
});

test('#else directive content should not be removed in case all #if and #elif siblings are disabled', () => {
  const content = `// #if TEST
  console.log('test');
  // #elif TEST2
  console.log('test2');
  // #else
  console.log('else');
  // #endif`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    definedSymbols: []
  });

  expect(result).toBe(`  console.log('else');`);
});
test('disabled nested #if should be removed', () => {
  const content = `// #if TEST
  console.log('test');
  // #if TEST2
  console.log('test2');
  // #endif
  // #endif`;
  const processor = new DirectivePreprocessor();
  const result = processor.preprocess(content, {
    definedSymbols: ['TEST']
  });

  expect(result).toBe(`  console.log('test');`);
});