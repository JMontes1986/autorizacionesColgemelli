/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('saveLateArrival', () => {
  let saveLateArrival;
  let mockSupabase;
  let dom;

  beforeEach(() => {
    const { JSDOM } = require('jsdom');
    dom = new JSDOM(`
      <form id="lateArrivalForm">
        <select id="lateGradeSelect"></select>
        <select id="lateStudentSelect"></select>
        <input id="lateTime" />
        <select id="lateExcuse">
          <option value="false">No</option>
          <option value="true">Si</option>
        </select>
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

    const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockFrom = jest.fn(() => ({ insert: mockInsert }));
    mockSupabase = { from: mockFrom };
    global.supabase = mockSupabase;

    const code = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const start = code.indexOf('async function saveLateArrival');
    const end = code.indexOf('function formatDate', start);
    const fnCode = code.slice(start, end);
    vm.runInThisContext(fnCode);
    saveLateArrival = global.saveLateArrival;
  });

  test('inserts arrival with new columns', async () => {
    document.getElementById('lateGradeSelect').value = '2';
    document.getElementById('lateStudentSelect').value = '3';
    document.getElementById('lateTime').value = '08:10';
    document.getElementById('lateExcuse').value = 'true';

    const event = new dom.window.Event('submit');
    event.target = document.getElementById('lateArrivalForm');
    event.preventDefault = () => {};

    await saveLateArrival(event);

    expect(mockSupabase.from).toHaveBeenCalledWith('llegadas_tarde');
    expect(mockSupabase.from().insert).toHaveBeenCalledWith([
      { estudiante_id: '3', grado_id: '2', fecha: '2024-05-01', hora: '08:10', excusa: true }
    ]);
    expect(showSuccess).toHaveBeenCalled();
  });
});
