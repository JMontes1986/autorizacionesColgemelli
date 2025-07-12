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
    global.showWarning = jest.fn();
    global.openModal = jest.fn();
    global.showSuccess = jest.fn();
    global.logSecurityEvent = jest.fn();
    global.logout = jest.fn();
    global.getColombiaDate = jest.fn(() => '2024-05-01');
    global.sanitizeHtml = s => s;
    global.sendNotification = jest.fn();
    global.resetAuthorizationForm = jest.fn();

    const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });

    const exitQuery = {
      insert: mockInsert,
      select: jest.fn(() => exitQuery),
      eq: jest.fn(() => exitQuery),
      is: jest.fn(() => exitQuery),
      limit: jest.fn(() => Promise.resolve({ data: [{ id: 1, hora_salida: '09:00', usuario_autorizador_id: 2 }], error: null }))
    };

    const userQuery = {
      select: jest.fn(() => userQuery),
      eq: jest.fn(() => userQuery),
      single: jest.fn(() => Promise.resolve({ data: { nombre: 'Luis' }, error: null }))
    };

    mockSupabase = {
      from: jest.fn((table) => (table === 'autorizaciones_salida' ? exitQuery : userQuery))
    };
    global.supabase = mockSupabase;

    const code = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const start = code.indexOf('async function authorizeExit');
    const end = code.indexOf('function resetAuthorizationForm', start);
    const fnCode = code.slice(start, end);
    vm.runInThisContext(fnCode);
    authorizeExit = global.authorizeExit;
  });

  test('shows notification when a pending record exists', async () => {
    document.getElementById('gradeSelect').value = '1';
    document.getElementById('studentSelect').value = '1';
    document.getElementById('reasonSelect').value = '1';
    document.getElementById('exitDate').value = '2024-05-01';
    document.getElementById('exitTime').value = '10:00';

    const event = new dom.window.Event('submit');
    event.preventDefault = () => {};
    event.target = document.getElementById('authorizeForm');

    await authorizeExit(event);

    const msg = 'El estudiante ya está registrado con salida pendiente a las 09:00 reportado por Luis.';
    expect(showWarning).toHaveBeenCalledWith(msg);
    expect(sendNotification).toHaveBeenCalledWith('Salida pendiente existente', msg);
    expect(mockSupabase.from().insert).not.toHaveBeenCalled();
  });
});
