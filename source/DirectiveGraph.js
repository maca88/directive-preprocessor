import Directive from './Directive.js';

const symbolRegex = /([\w]+)/g;

export default class DirectiveGraph {
  source;
  children = [];
  symbols = [];
  current = null;

  constructor(source) {
    this.source = source;
  }

  getAllDirectives() {
    const result = [];
    for (let child of this.children) {
      child.fillAll(result);
    }

    return result;
  }

  getDisabledDirectives(definedSymbols, includeSymbols) {
    let script = '"use strict";';
    let initSymbols = {};
    for (let symbol of this.symbols) {
      script += `var ${symbol} = ${definedSymbols.indexOf(symbol) < 0 ? 'false' : 'true'};`;
      initSymbols[symbol] = true;
    }

    for (let symbol in includeSymbols) {
      const value = includeSymbols[symbol].replace(/["\r\n]/g, match => "\\" + match);
      script += `${initSymbols[symbol] ? '' : 'var '}${symbol} = "${value}";`;
    }

    const isEnabledFunc = (expression) => eval(Function(`${script}return ${expression};`))();
    const result = [];
    for (let child of this.children) {
      child.fillDisabledDirectives(isEnabledFunc, result);
    }

    return result;
  }

  addDirective(type, multiline, startIndex, endIndex, expression) {
    if ((type === 'if' || type === 'elif' || type === 'include') && expression === null) {
      throw new Error(`Missing expression for #${type}: ${this.source.substring(startIndex, startIndex + 50)}...`);
    }

    // Handle include directive
    if (type === 'include') {
      const includeDirective = new Directive(type, multiline, startIndex, endIndex, this.current, expression);
      includeDirective.endIndex = endIndex;
      if (this.current !== null) {
        this.current.children.push(includeDirective);
      } else {
        this.children.push(includeDirective);
      }

      return;
    }

    if (expression !== null) {
      for (let match of expression.matchAll(symbolRegex)) {
        if (this.symbols.indexOf(match[1]) < 0) {
          this.symbols.push(match[1]);
        }
      }
    }

    if (this.current === null) {
      if (type !== 'if') {
        throw new Error(`#if directive was expected, but was #${type}: ${this.source.substring(startIndex, startIndex + 50)}...`);
      }

      const rootDirective = new Directive(type, multiline, startIndex, endIndex, null, expression);
      this.current = rootDirective;
      this.children.push(rootDirective);
      return;
    }

    const currentType = this.current.type;
    switch(type) {
      case 'if':
        const ifDirective = new Directive(type, multiline, startIndex, endIndex, this.current, expression);
        this.current.children.push(ifDirective);
        this.current = ifDirective;
        return;
      case 'elif':
      case 'else':
        if (currentType !== 'if' && currentType !== 'elif') {
          throw new Error(`#${type} cannot be placed after #${currentType}: ${this.source.substring(startIndex, startIndex + 50)}...`);
        }

        const elseDirective = new Directive(type, multiline, startIndex, endIndex, this.current.parent, expression);
        this.current.endIndex = startIndex;
        this.current.next = elseDirective;
        this.current = elseDirective;
        return;
      case 'endif':
        if (currentType === 'endif') {
          throw new Error(`#endif directive cannot contain another #${type} : ${this.source.substring(startIndex, startIndex + 50)}...`);
        }

        const endDirective = new Directive(type, multiline, startIndex, endIndex, this.current.parent, expression);
        endDirective.endIndex = endIndex;
        this.current.next = endDirective;
        this.current.endIndex = startIndex;
        this.current = this.current.parent;
        return;
      default:
        throw new Error(`Unknown directive #${type}: ${this.source.substring(startIndex, startIndex + 50)}...`);
    }
  }

  toString() {
    let result = '';
    for (let child of this.children) {
      result += child.toString(0);
    }

    return result;
  }
}