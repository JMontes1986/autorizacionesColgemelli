/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('loadLateStudents', () => {
  let loadLateStudents;
  let mockSupabase;
  let dom;

  beforeEach(() => {
    const { JSDOM } = require('jsdom');
    dom = new JSDOM(`
      <select id="lateGradeSelect"></select>
      <div id="lateStudentList"></div>
    `);
    global.document = dom.window.document;
    global.window = dom.window;

    global.validateSession = jest.fn(() => true);
    global.sanitizeHtml = s => s;
    global.logSecurityEvent = jest.fn();

    const students = [
      { id: '1', nombre: 'Juan', apellidos: 'Perez' },
      { id: '2', nombre: 'Maria', apellidos: 'Lopez' }
    ];

    const mockOrderNombre = jest.fn(() => Promise.resolve({ data: students, error: null }));
    const mockOrderApellidos = jest.fn(() => ({ order: mockOrderNombre }));
    const mockEqActivo = jest.fn(() => ({ order: mockOrderApellidos }));
    const mockEqGrade = jest.fn(() => ({ eq: mockEqActivo, order: mockOrderApellidos }));
    const mockSelect = jest.fn(() => ({ eq: mockEqGrade }));
    const mockFrom = jest.fn(() => ({ select: mockSelect }));

    mockSupabase = { from: mockFrom };
    global.supabase = mockSupabase;

    const code = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const start = code.indexOf('async function loadLateStudents');
    const end = code.indexOf('async function saveLateArrival', start);
    const fnCode = code.slice(start, end);
    vm.runInThisContext(fnCode);
    loadLateStudents = global.loadLateStudents;
  });

  test('loads students for selected grade', async () => {
    document.getElementById('lateGradeSelect').value = '2';

    await loadLateStudents();

    expect(mockSupabase.from).toHaveBeenCalledWith('estudiantes');
    const inputs = Array.from(document.querySelectorAll('#lateStudentList input'));
    const texts = inputs.map(i => i.parentElement.textContent.trim());
    expect(texts).toEqual([
      'Perez, Juan',
      'Lopez, Maria'
    ]);
  });
});
