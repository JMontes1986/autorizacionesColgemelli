/** @jest-environment ./custom-jsdom-environment */
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
    global.isExitEditUser = jest.fn(() => false);
    global.validateText = jest.fn(() => true);
    global.lockStudentSelection = jest.fn();
    global.getOptionTextByValue = jest.fn(() => null);
    global.currentExitLockedStudentId = null;
    global.currentExitLockedGradeId = null;
    global.currentExitAuthId = null;
    global.currentExitOriginalData = null;

    const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });

    const exitQuery = {
      insert: mockInsert,
      select: jest.fn(() => exitQuery),
      eq: jest.fn(() => exitQuery),
      is: jest.fn(() => exitQuery),
      limit: jest.fn(() => Promise.resolve({ data: [{ id: 1, hora_salida: '09:00', motivo_id: 1, fecha_salida: '2024-05-01', observaciones: 'prev', usuario_autorizador_id: 2 }], error: null }))
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

  test('loads existing authorization for editing when a pending record exists', async () => {
    document.getElementById('gradeSelect').value = '1';
    document.getElementById('studentSelect').value = '1';
    document.getElementById('reasonSelect').value = '1';
    document.getElementById('exitDate').value = '2024-05-01';
    document.getElementById('exitTime').value = '10:00';

    const event = new dom.window.Event('submit');
    event.preventDefault = () => {};
    event.target = document.getElementById('authorizeForm');

    await authorizeExit(event);

    const msg = 'El estudiante ya está registrado con salida pendiente a las 09:00 reportado por Luis. Se cargaron los datos para editar.';
    expect(showWarning).toHaveBeenCalledWith(msg);
    expect(sendNotification).toHaveBeenCalledWith('Salida pendiente existente', msg);
    expect(dom.window.document.getElementById('reasonSelect').value).toBe('1');
    expect(dom.window.document.getElementById('exitTime').value).toBe('09:00');
    expect(dom.window.document.getElementById('exitDate').value).toBe('2024-05-01');
    expect(mockSupabase.from().insert).not.toHaveBeenCalled();
  });
  
  test('captures modification summary when editing an authorization', async () => {
    const gradeSelect = document.getElementById('gradeSelect');
    gradeSelect.innerHTML = '<option value="1">1A</option>';
    document.getElementById('studentSelect').innerHTML = '<option value="1">Juan</option>';
    const reasonSelect = document.getElementById('reasonSelect');
    reasonSelect.innerHTML = '<option value="1">Médico</option><option value="2">Evento</option>';

    document.getElementById('gradeSelect').value = '1';
    document.getElementById('studentSelect').value = '1';
    document.getElementById('reasonSelect').value = '2';
    document.getElementById('exitDate').value = '2024-05-01';
    document.getElementById('exitTime').value = '09:30';
    document.getElementById('observations').value = 'Trae documentos';

    global.currentExitAuthId = 5;
    global.currentExitLockedStudentId = '1';
    global.currentExitLockedGradeId = '1';
    global.currentExitOriginalData = {
      motivo_id: '1',
      motivo_nombre: 'Médico',
      hora_salida: '08:00',
      observaciones: ''
    };
    global.currentUser = { id: 99, email: 'sistemas@colgemelli.edu.co', nombre: 'Sistemas' };
    global.isExitEditUser.mockReturnValue(true);
    global.getOptionTextByValue = (select, value) => {
      const options = Array.from(select.options);
      const match = options.find(option => option.value === String(value));
      return match ? match.text : null;
    };

    let capturedPayload;
    const eqMock = jest.fn(() => Promise.resolve({ data: null, error: null }));
    const updateMock = jest.fn((payload) => {
      capturedPayload = payload;
      return { eq: eqMock };
    });

    mockSupabase.from = jest.fn((table) => {
      if (table === 'autorizaciones_salida') {
        return {
          update: updateMock,
          insert: jest.fn(),
          select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn() })) }))
        };
      }
      return {
        select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn() })) }))
      };
    });

    const event = new dom.window.Event('submit');
    event.preventDefault = () => {};
    event.target = document.getElementById('authorizeForm');

    await authorizeExit(event);

    expect(updateMock).toHaveBeenCalled();
    expect(capturedPayload).toBeDefined();
    expect(capturedPayload.detalle_modificaciones).toContain('Hora modificada');
    expect(capturedPayload.detalle_modificaciones).toContain('Motivo modificado');
    expect(capturedPayload.detalle_modificaciones).toContain('Observación actualizada');
    expect(capturedPayload.usuario_modifico_id).toBe(99);
    expect(capturedPayload.ultima_modificacion).toBeDefined();

    // Restaurar valores por defecto
    global.isExitEditUser.mockReturnValue(false);
    global.currentExitOriginalData = null;
    global.currentExitAuthId = null;
    global.currentExitLockedStudentId = null;
    global.currentExitLockedGradeId = null;
    global.currentUser = null;
  });
});
