/** @jest-environment ./custom-jsdom-environment */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('admin security button', () => {
  let dom;
  let showAdminSection;

  beforeEach(() => {
    const { JSDOM } = require('jsdom');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    dom = new JSDOM(html);
    global.window = dom.window;
    global.document = dom.window.document;

    global.validateSession = jest.fn(() => true);
    global.showError = jest.fn();
    global.logout = jest.fn();
    global.renewSession = jest.fn();
    global.loadSecurityStats = jest.fn();
    global.loadSecurityLogs = jest.fn();
    global.currentUser = { rol: { nombre: 'administrador' } };

    const code = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const startShow = code.indexOf('function showAdminSection');
    const endShow = code.indexOf('async function loadSecurityStats', startShow);
    const startAttach = code.indexOf('function attachEventHandlers');
    const endAttach = code.indexOf('document.addEventListener', startAttach);
    const fnCode = code.slice(startShow, endShow) + code.slice(startAttach, endAttach);
    vm.runInThisContext(fnCode);
    showAdminSection = global.showAdminSection;
    global.attachEventHandlers();
  });

  test('clicking security button triggers handlers', () => {
    const spy = jest.spyOn(global, 'showAdminSection');
    dom.window.document.getElementById('btnAdminSecurity').click();
    expect(spy).toHaveBeenCalledWith('security');
    expect(global.loadSecurityLogs).toHaveBeenCalled();
  });
});
