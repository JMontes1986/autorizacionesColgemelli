/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('loadSecurityLogs', () => {
  let loadSecurityLogs;
  let mockSupabase;
  let dom;

  beforeEach(() => {
    const { JSDOM } = require('jsdom');
    dom = new JSDOM(`
      <input id="logDateFrom" value="" />
      <input id="logDateTo" value="" />
      <select id="logType"></select>
      <select id="logUser"></select>
      <div id="loginInfo"></div>
      <div id="loginError"></div>
      <table id="securityLogsTable"><tbody></tbody></table>
    `);
    global.document = dom.window.document;
    global.window = dom.window;

    // Stub helper functions used inside loadSecurityLogs
    global.validateSession = jest.fn(() => true);
    global.showError = jest.fn();
    global.showSuccess = jest.fn();
    global.formatDateTime = (s) => s;
    global.sanitizeHtml = (s) => s;
    global.getLogTypeClass = () => '';
    global.setupTableScroll = jest.fn();
    global.logSecurityEvent = jest.fn();

    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      then: (resolve) => Promise.resolve({ data: mockQuery.__data, error: null }).then(resolve)
    };
    mockSupabase = {
      from: jest.fn(() => mockQuery)
    };
    global.supabase = mockSupabase;

    // Extract and evaluate the loadSecurityLogs function from app.js
    const appPath = path.join(__dirname, '..', 'app.js');
    const code = fs.readFileSync(appPath, 'utf8');
    const start = code.indexOf('async function loadSecurityLogs');
    const end = code.indexOf('function getLogTypeClass', start);
    const fnCode = code.slice(start, end);
    vm.runInThisContext(fnCode);
    loadSecurityLogs = global.loadSecurityLogs;
    mockQuery.__data = [];
  });

  test('retrieves logs within the provided date range', async () => {
    const tbody = document.querySelector('#securityLogsTable tbody');
    document.getElementById('logDateFrom').value = '2024-01-01';
    document.getElementById('logDateTo').value = '2024-01-05';

    const logs = [
      { timestamp: '2024-01-02T10:00:00', tipo: 'login', accion: 'test', detalles: '{}', usuario: { nombre: 'A' }, ip_address: '1.1.1.1' },
      { timestamp: '2024-01-04T12:00:00', tipo: 'logout', accion: 'test2', detalles: '{}', usuario: { nombre: 'B' }, ip_address: '1.1.1.2' }
    ];

    // Provide data for the promise resolution
    mockSupabase.from().__data = logs;

    await loadSecurityLogs();

    expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
    expect(mockSupabase.from().gte).toHaveBeenCalledWith('timestamp', '2024-01-01T00:00:00');
    expect(mockSupabase.from().lte).toHaveBeenCalledWith('timestamp', '2024-01-05T23:59:59');
    expect(tbody.querySelectorAll('tr').length).toBe(logs.length);
  });
});
