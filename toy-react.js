const RENDER_TO_DOM = Symbol('render to dom');

// vdom的创建和比对的逻辑都在Component基类中实现
export class Component {
  constructor() {
    this.props = Object.create(null);
    this.children = [];
    this._root = null;
    this._range = null;
  }

  setAttribute(name, value) {
    this.props[name] = value;
  }

  appendChild(component) {
    this.children.push(component);
  }

  get vdom() {
    return this.render().vdom;
  }

  // get vchildren() {
  //   return this.children.map(child => child.vdom);
  // }

  [RENDER_TO_DOM](range) {
    this._range = range;
    this._vdom = this.vdom; // 保存当时用的vdom，此处会触发vdom的getter方法，会重新render并且得到一颗新的vdom树
    this._vdom[RENDER_TO_DOM](range);
  }

  // 将新的vdom与旧的vdom进行对比，决定那一颗树的子树需要重新渲染
  update() {
    let isSameNode = (oldNode, newNode) => {
      if (oldNode.type !== newNode.type) {
        return false;
      }
      for (let name in newNode.props) {
        if (newNode.props[name] !== oldNode.props[name]) {
          return false;
        }
      }
      if (Object.keys(oldNode.props).length > Object.keys(newNode.props).length) {
        return false;
      }
      if (newNode.type === '#text')   {
        if (newNode.content !== oldNode.content) {
          return false;
        }
      }

      return true;
    }

    // 需要递归访问vdom的内容
    let update = (oldNode, newNode) => {
      // type, props, children
      // #text content
      // 先判断根节点
      if (!isSameNode(oldNode, newNode)) {
        newNode[RENDER_TO_DOM](oldNode._range);
        return;
      }
      newNode._range = oldNode._range; // node必须为Element类型才正确

      // 再判断children
      let newChildren = newNode.vchildren;
      let oldChildren = oldNode.vchildren;

      if (!newChildren || !newChildren.length) {
        return;
      }

      let tailRange = oldChildren[oldChildren.length - 1]._range;

      for (let i = 0; i < newChildren.length; i++) {
        let newChild = newChildren[i];
        let oldChild = oldChildren[i];
        if (i < oldChildren.length) {
          update(oldChild, newChild);
        } else {
          // oldChildren的数量小于newChildren的数量，需要执行插入
          let range = document.createRange();
          range.setStart(tailRange.endContainer, tailRange.endOffset);
          range.setEnd(tailRange.endContainer, tailRange.endOffset);
          newChild[RENDER_TO_DOM](range); // 把newChild追加到oldChildren后面了
          tailRange = range;
        }
      }
    };

    let vdom = this.vdom;
    update(this._vdom, vdom);
    this._vdom = vdom;
  }

  /*
  rerender() {
    let oldRange = this._range;

    let range = document.createRange();
    range.setStart(oldRange.startContainer, oldRange.startOffset);
    range.setEnd(oldRange.startContainer, oldRange.startOffset);
    this[RENDER_TO_DOM](range);

    oldRange.setStart(range.endContainer, range.endOffset);
    oldRange.deleteContents();

    // this._range.deleteContents();
    // this[RENDER_TO_DOM](this._range);
  }
  */

  setState(newState) {
    if (this.state === null || typeof this.state !== 'object') {
      this.state = newState;
      this.rerender();
      return;
    }

    let merge = (oState, nState) => {
      for (let p in nState) {
        if (oState[p] === null || typeof oState[p] !== 'object') {
          oState[p] = nState[p];
        } else {
          merge(oState[p], nState[p]);
        }
      }
    };

    merge(this.state, newState);
    this.update();
  }
}

class ElementWrapper extends Component {
  constructor(type) {
    super();
    this.type = type;
  }
/*
  // 存props
  setAttribute(name, value) {
    if (name.match(/^on([\s\S]+)$/)) {
      this.root.addEventListener(RegExp.$1.replace(/^[\s\S]/, c => c.toLowerCase()), value);
    } else {
      if (name === 'className') {
        this.root.setAttribute('class', value);
      } else {
        this.root.setAttribute(name, value);
      }
    }
  }

  // 存children
  appendChild(component) {
    let range = document.createRange();
    range.setStart(this.root, this.root.childNodes.length);
    range.setEnd(this.root, this.root.childNodes.length);
    component[RENDER_TO_DOM](range);
  }
*/
  get vdom () {
    this.vchildren = this.children.map(child => child.vdom); // 递归调用
    return this;
    /* {
      type: this.type,
      props: this.props,
      children: this.children.map(child => child.vdom)
    } */
  }

  // 根据vdom创建实dom
  [RENDER_TO_DOM](range) {
    this._range = range;
    // range.deleteContents();

    let root = document.createElement(this.type);

    for (let name in this.props) {
      let value = this.props[name];
      if (name.match(/^on([\s\S]+)$/)) {
        root.addEventListener(RegExp.$1.replace(/^[\s\S]/, c => c.toLowerCase()), value);
      } else {
        if (name === 'className') {
          root.setAttribute('class', value);
        } else {
          root.setAttribute(name, value);
        }
      }
    }

    if (!this.vchildren) { // 避免上来直接RENDER_TO_DOM，没有取过vdom
      this.vchildren = this.children.map(child => child.vdom);
    }

    for (let child of this.vchildren) {
      let childRange = document.createRange();
      childRange.setStart(root, root.childNodes.length);
      childRange.setEnd(root, root.childNodes.length);
      child[RENDER_TO_DOM](childRange);
    }

    // range.insertNode(root);
    replaceContent(range, root);
  }
}

class TextWrapper extends Component {
  constructor(content) {
    super();
    this.type = '#text';
    this.content = content;
  }

  get vdom() {
    return this;
    /* {
      type: '#text',
      content: this.content
    }; */
  }

  [RENDER_TO_DOM](range) {
    this._range = range;
    // range.deleteContents();
    // range.insertNode(this.root);
    let root = document.createTextNode(this.content);
    replaceContent(range, root);
  }
}

function replaceContent(range, node) {
  range.insertNode(node);
  range.setStartAfter(node);
  range.deleteContents();

  range.setStartBefore(node);
  range.setEndAfter(node);
}

export function createElement(type, attributes, ...children) {
  let e;
  if (typeof type === 'string') {
    e = new ElementWrapper(type);
  } else {
    e = new type;
  }
  
  for (let p in attributes) {
    e.setAttribute(p, attributes[p]);
  }

  let insertChildren = (childs) => {
    for (let child of childs) {
      if (typeof child === 'string') {
        child = new TextWrapper(child);
      }
      if (child === null) {
        continue;
      }
      if ((typeof child === 'object') && (child instanceof Array)) {
        insertChildren(child);
      } else {
        e.appendChild(child);
      }
    }
  };
  insertChildren(children);
  
  return e;
}

export function render(component, parentElement) {
  let range = document.createRange();
  range.setStart(parentElement, 0);
  range.setEnd(parentElement, parentElement.childNodes.length);
  range.deleteContents();
  component[RENDER_TO_DOM](range);
}

