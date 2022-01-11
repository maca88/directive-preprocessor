export default class Directive {
  type;
  multiline;
  startIndex;
  definitionEndIndex;
  endIndex;
  expression;
  parent = null;
  next = null; // elif
  children = []; // nested if

  constructor(type, multiline, startIndex, definitionEndIndex, parent, expression) {
    this.type = type;
    this.multiline = multiline;
    this.startIndex = startIndex;
    this.definitionEndIndex = definitionEndIndex;
    this.parent = parent;
    this.expression = expression;
  }

  fillAll(array) {
    array.push(this);
    const children = this.next !== null ? this.children.concat([this.next]) : this.children
    for (let child of children) {
      child.fillAll(array)
    }
  }

  getAllParents(filter) {
    const result = [];
    let parent = this.parent;
    while (parent !== null) {
      if (!filter || filter(parent)) {
        result.push(parent);
      }

      parent = parent.parent;
    }

    return result;
  }

  fillDisabledDirectives(isEnabledFunc, array) {
    if (this.type !== 'if' && this.type !== 'include') {
      throw new Error(`Method fillDisabledDirectives can only be called for #if and #include directives`);
    }

    // Include is always enabled as this method is not called for directives that we know are disabled
    if (this.type === 'include') {
      return;
    }

    let next = this.next;
    if (isEnabledFunc(this.expression)) {
      for (let child of this.children) {
        child.fillDisabledDirectives(isEnabledFunc, array);
      }

      // In case #if directive is enabled, mark #elif and #else as disabled
      while (next !== null && next.type !== 'endif') {
        array.push(next);
        next = next.next;
      }

      return;
    }

    array.push(this);
    // We have to check #elif and #else directives
    while (next !== null) {
      if (next.type === 'else') {
        for (let elseChild of next.children) {
          elseChild.fillDisabledDirectives(isEnabledFunc, array);
        }

        return;
      }

      if (next.type === 'endif') {
        array.push(next);
      }

      // #elif
      if (!isEnabledFunc(next.expression)) {
        array.push(next);
        next = next.next;
      } else {
        // In case #elif directive is enabled, mark other #elif and #else as disabled
        for (let nextChild of next.children) {
          nextChild.fillDisabledDirectives(isEnabledFunc, array);
        }

        next = next.next;
        while (next !== null && next.type !== 'endif') {
          array.push(next);
          next = next.next;
        }

        return;
      }
    }
  }

  toString(level) {
    let result = ' '.repeat(level);
    result += this.expression ? `#${this.type} ${this.expression}` : `#${this.type}`;
    result += '\r\n';
    for (let child of this.children) {
      result += child.toString(level + 1);
    }

    if (this.next !== null) {
      result += this.next.toString(level);
    }

    return result;
  }
}