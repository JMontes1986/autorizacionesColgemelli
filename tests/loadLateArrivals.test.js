/** @jest-environment ./custom-jsdom-environment */
const vm = require('vm');

describe('loadLateArrivals page', () => {
  let loadLateArrivals;
  let exportarCSV;
  let mockSupabase;
  let dom;

  beforeEach(() => {
    const { JSDOM } = require('jsdom');
    dom = new JSDOM(`
      <input id="desdeFiltro" />
      <input id="hastaFiltro" />
      <select id="estudianteFiltro"></select>
      <table id="lateArrivalsTable"><tbody></tbody></table>
    `);
    global.document = dom.window.document;
    global.window = dom.window;
    global.sanitizeHtml = s => s;
    global.URL.createObjectURL = jest.fn(() => 'blob:url');

    const mockQuery = {
      select: jest.fn(() => mockQuery),
      gte: jest.fn(() => mockQuery),
      lte: jest.fn(() => mockQuery),
      eq: jest.fn(() => mockQuery),
      order: jest.fn(() => mockQuery),
      then: (resolve) => Promise.resolve({ data: mockQuery.__data, error: null }).then(resolve)
    };
    mockSupabase = { from: jest.fn(() => mockQuery) };
    global.supabase = mockSupabase;

    const code = `
      async function loadLateArrivals() {
        const from = document.getElementById('desdeFiltro').value;
        const to = document.getElementById('hastaFiltro').value;
        const student = document.getElementById('estudianteFiltro').value;
        let q = supabase
          .from('llegadas_tarde')
          .select('id, fecha, hora, estudiante_id');
        if (from) q = q.gte('fecha', from);
        if (to) q = q.lte('fecha', to);
        if (student) q = q.eq('estudiante_id', student);
        const { data } = await q;
        const tbody = document.querySelector('#lateArrivalsTable tbody');
        tbody.innerHTML = '';
        (data || []).forEach(r => {
          const tr = document.createElement('tr');
          tr.textContent = r.id + '-' + r.fecha;
          tbody.appendChild(tr);
        });
      }
      function exportarCSV() {
        const filas = document.querySelectorAll('#lateArrivalsTable tr');
        const csv = Array.from(filas).map(f => `"${f.textContent}"`).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'late_arrivals.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    `;
    vm.runInThisContext(code);
    loadLateArrivals = global.loadLateArrivals;
    exportarCSV = global.exportarCSV;
    mockQuery.__data = [];
  });

  test('filters by date and student and renders rows', async () => {
    document.getElementById('desdeFiltro').value = '2024-01-01';
    document.getElementById('hastaFiltro').value = '2024-01-10';
    document.getElementById('estudianteFiltro').value = '2';

    const rows = [
      { id: 1, fecha: '2024-01-05', hora: '08:00', estudiante_id: '2' }
    ];
    mockSupabase.from().__data = rows;

    await loadLateArrivals();

    expect(mockSupabase.from).toHaveBeenCalledWith('llegadas_tarde');
    expect(mockSupabase.from().gte).toHaveBeenCalledWith('fecha', '2024-01-01');
    expect(mockSupabase.from().lte).toHaveBeenCalledWith('fecha', '2024-01-10');
    expect(mockSupabase.from().eq).toHaveBeenCalledWith('estudiante_id', '2');
    expect(document.querySelectorAll('#lateArrivalsTable tbody tr').length).toBe(1);
  });

  test('CSV export creates expected blob', async () => {
    const tbody = document.querySelector('#lateArrivalsTable tbody');
    tbody.innerHTML = '<tr><td>1-2024-01-05</td></tr>';

    exportarCSV();

    expect(URL.createObjectURL).toHaveBeenCalled();
    const blobArg = URL.createObjectURL.mock.calls[0][0];
    expect(blobArg instanceof Blob).toBe(true);
    const text = await blobArg.text();
    expect(text.trim()).toBe('"1-2024-01-05"');
  });
});
