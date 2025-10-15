const NodeEnvironment = require('jest-environment-node');
const { JSDOM } = require('jsdom');

class CustomJsdomEnvironment extends NodeEnvironment {
  async setup() {
    await super.setup();
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'http://localhost/'
    });

    this.dom = dom;
    this.global.window = dom.window;
    this.global.document = dom.window.document;
    this.global.HTMLElement = dom.window.HTMLElement;
    this.global.Node = dom.window.Node;
    this.global.navigator = dom.window.navigator;
  }

  async teardown() {
    if (this.dom) {
      this.dom.window.close();
    }
    await super.teardown();
  }
}

module.exports = CustomJsdomEnvironment;
