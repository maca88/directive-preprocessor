import { readFileSync, mkdirSync } from 'fs';
import { chdir, cwd } from 'process';
import DirectiveGraph from './DirectiveGraph.js';

const getEndLineLength = (chars, index, backwardSearch) => {
  let length = 0;
  let cr = false;
  let lf = false;
  while (true) {
    if (index < 0 || index >= chars.length) {
      return length;
    }

    switch (chars[index]) {
      case ' ':
        if (backwardSearch) {
          length++;
          break;
        } else {
          return length;
        }
      case '\r':
        if (cr) {
          return length;
        } else {
          cr = true;
          length++;
        }
        break;
      case '\n':
        if (lf) {
          return length;
        } else {
          lf = true;
          length++;
        }
        break;
      default:
        return length;
    }

    index = backwardSearch ? index - 1 : index + 1;
  }
}

const getLineIndent = (chars, index) => {
  let indent = '';
  while (chars[index] === ' ' || chars[index] === '\t') {
    indent += chars[index];
    index++;
  }

  return indent;
}

export default class DirectiveProcessor {
  ifRegex = /^.*\/\/\s*#(if|elif)\s+(.*)$/gm;
  ifMultilineRegex = /\/\*\s*#(if|elif)([\s\S]*?)\*\//g;

  endRegex = /^.*\/\/\s*#(endif|else).*$/gm;
  endMultilineRegex = /\/\*\s*#(else|endif)[\s\S]*?\*\//g;

  includeRegex = /^.*\/\/\s*#(include)\s+(.*)$/gm;
  includeMultilineRegex = /\/\*\s*#(include)([\s\S]*?)\*\//mg;

  expressionRegex = /(^.*\/\/|\/\*)\s*#(if|elif|endif|else|include)/gm;

  preprocess(source, options) {
    return this.transform(this.parse(source), options);
  }

  parse(source) {
    const graph = new DirectiveGraph(source);
    let expMatch, dirMatch;
    while ((expMatch = this.expressionRegex.exec(source)) !== null) {
      const isMultiline = expMatch[1] === '/*';
      const dirType = expMatch[2];
      let dirRegex = null;
      switch(dirType) {
        case 'if':
        case 'elif':
          dirRegex = isMultiline ? this.ifMultilineRegex : this.ifRegex;
          break;
        case 'endif':
        case 'else':
          dirRegex = isMultiline ? this.endMultilineRegex : this.endRegex;
          break;
        case 'include':
          dirRegex = isMultiline ? this.includeMultilineRegex : this.includeRegex;
          break;
      }

      dirRegex.lastIndex = expMatch.index;
      if ((dirMatch = dirRegex.exec(source)) === null) {
        throw new Error(`Illegal #${dirType}: ${source.substring(expMatch.index, expMatch.index+50)}...`);
      }

      const expression = dirMatch.length === 3 ? dirMatch[2].trim() : null;
      this.expressionRegex.lastIndex = dirRegex.lastIndex;
      graph.addDirective(dirType, isMultiline, expMatch.index, dirRegex.lastIndex, expression);
    }

    if (graph.current !== null) {
      throw new Error(`One or more directives were not ended with #endif`);
    }

    return graph;
  }

  transform(graph, options) {
    let definedSymbols = options.definedSymbols || [];
    let includeSymbols = options.includeSymbols || {};
    if (typeof includeSymbols === 'string') {
      includeSymbols = includeSymbols.split(' ');
    }

    if (Array.isArray(includeSymbols)) {
      includeSymbols = includeSymbols.reduce((obj, currValue) => {
        const eqIndex = currValue.indexOf('=');
        if (eqIndex < 0) {
          throw new Error(`Invalid value for includeSymbols option`);
        }

        return (obj[currValue.substring(0, eqIndex)] = currValue.substring(eqIndex + 1), obj);
      }, {});
    }

    const sourceArray = Array.from(graph.source);
    const directives = graph.getAllDirectives().reverse();
    const disabledDirectives = graph.getDisabledDirectives(definedSymbols, includeSymbols);
    for (let directive of directives) {
      if (disabledDirectives.indexOf(directive) < 0) {
        // We have to skip in case any of the parent directives is disabled, otherwise the parent endIndex won't be correct anymore
        if (directive.getAllParents(parent => disabledDirectives.indexOf(parent) >= 0).length) {
          continue;
        }

        if (directive.type === 'include') {
          const includeSymbol = directive.expression.trim();
          let symbolValue;
          const pathMatch = includeSymbol.match(/"(.*)"/);
          if (pathMatch) {
            const originalDirectory = cwd();
            if (options.baseDirectory) {
              chdir(options.baseDirectory);
            }

            symbolValue = readFileSync(pathMatch[1], 'utf8');
            chdir(originalDirectory);
          } else {
            symbolValue = includeSymbols[directive.expression.trim()];
            if (!symbolValue) {
              throw new Error(`Include symbol ${includeSymbol} is not defined`);
            }
          }

          const lineIndent = directive.multiline ? '' : getLineIndent(sourceArray, directive.startIndex);
          if (!directive.multiline) {
            symbolValue = lineIndent + symbolValue.replaceAll(/\r\n|\n/g, (match) => {
              return match + lineIndent;
            });
          }

          const deleteCount = options.preserveDirectives
            ? lineIndent.length
            : directive.definitionEndIndex - directive.startIndex;
          sourceArray.splice(directive.startIndex, deleteCount, ...Array.from(symbolValue));
          continue;
        }

        if (options.preserveDirectives) {
          continue;
        }

        const startIndex = directive.definitionEndIndex >= sourceArray.length - 1
          ? directive.startIndex - getEndLineLength(sourceArray, directive.startIndex - 1, true)
          : directive.startIndex;
        const length = directive.definitionEndIndex - startIndex;
        const endLineLength = directive.multiline ? 0 : getEndLineLength(sourceArray, directive.definitionEndIndex, false);
        sourceArray.splice(startIndex, length + endLineLength);
      } else {
        let startIndex = options.preserveDirectives
          ? directive.definitionEndIndex + getEndLineLength(sourceArray, directive.definitionEndIndex, false)
          : directive.startIndex;
        if (directive.endIndex >= sourceArray.length - 1) {
          startIndex -= getEndLineLength(sourceArray, startIndex - 1, true);
        }

        const length = directive.endIndex - startIndex;
        const endLineLength = directive.multiline ? 0 : getEndLineLength(sourceArray, directive.endIndex, false);
        sourceArray.splice(startIndex, length + endLineLength);
      }
    }

    return sourceArray.join('');
  }
}