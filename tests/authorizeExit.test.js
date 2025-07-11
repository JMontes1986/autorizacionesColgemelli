/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('authorizeExit duplicate check', () => {
  let authorizeExit;
  let mockSupabase;
  let dom;

  beforeEach(() => {
    const { JSDOM } = require('jsdom');
    dom = new JSDOM(`
      <form id="authorizeForm">
        <select id="gradeSelect"><option value="1">1A</option></select>
        <select id="studentSelect"><option value="1">Juan</option></select>
        <select id="reasonSelect"><option value="1">Médico</option></select>
        <input id="exitDate" />
        <input id="exitTime" />
        <textarea id="observations"></textarea>
      </form>
    `);
    global.document = dom.window.document;
    global.window = dom.window;

    global.validateSession = jest.fn(() => true);
    global.showError = jest.fn();
    global.showSuccess = jest.fn();
    global.logSecurityEvent = jest.fn();
    global.logout = jest.fn();
    global.getColombiaDate = jest.fn(() => '2024-05-01');
    global.sanitizeHtml = s => s;
    global.sendNotification = jest.fn();
    global.resetAuthorizationForm = jest.fn();

    const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockQuery = {
      insert: mockInsert,
      select: jest.fn(() => mockQuery),
      eq: jest.fn(() => mockQuery),
      is: jest.fn(() => mockQuery),
      limit: jest.fn(() => Promise.resolve({ data: [{ id: 1 }], error: null }))
    };
    mockSupabase = { from: jest.fn(() => mockQuery) };
    global.supabase = mockSupabase;

    const code = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const start = code.indexOf('async function authorizeExit');
    const end = code.indexOf('function resetAuthorizationForm', start);
    const fnCode = code.slice(start, end);
    vm.runInThisContext(fnCode);
    authorizeExit = global.authorizeExit;
  });

  test('shows error when a pending record exists', async () => {
    document.getElementById('gradeSelect').value = '1';
    document.getElementById('studentSelect').value = '1';
    document.getElementById('reasonSelect').value = '1';
    document.getElementById('exitDate').value = '2024-05-01';
    document.getElementById('exitTime').value = '10:00';

    const event = new dom.window.Event('submit');
    event.preventDefault = () => {};
    event.target = document.getElementById('authorizeForm');

    await authorizeExit(event);

    expect(showError).toHaveBeenCalled();
    expect(mockSupabase.from().insert).not.toHaveBeenCalled();
  });
});
