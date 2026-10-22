// Stand-alone stand-in for the dashboard runtime: loads data/<id>.csv files and
// offers the same dash.data / dash.calc / dash.onData calls the page uses.
(function () {
  const DATASETS = window.DASH_DATASETS || [];
  const store = {}, calcs = {}, listeners = [];
  DATASETS.forEach(id => { store[id] = { status: 'loading', data: [], columns: [] }; });

  function runCalcs() {
    Object.entries(calcs).forEach(([id, c]) => {
      const ins = c.inputs.map(i => store[i] || calcs[i]);
      if (ins.some(x => !x || x.status !== 'ok')) {
        c.status = ins.some(x => x && x.status === 'error') ? 'error' : 'loading';
        return;
      }
      try { c.data = c.fn(...ins.map(x => x.data)); c.status = 'ok'; }
      catch (e) { c.status = 'error'; console.error(id, e); }
    });
  }
  function notify() { runCalcs(); listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }

  const css = getComputedStyle(document.documentElement);
  window.dash = {
    colors: ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'],
    data(id) {
      const d = store[id] || calcs[id];
      if (!d) return { status: 'missing', data: [], columns: [] };
      return { status: d.status, data: d.data || [], columns: d.columns || [], refreshing: false, meta: [] };
    },
    calc(id, spec) { calcs[id] = { inputs: spec.inputs, fn: spec.fn, status: 'loading', data: [] }; },
    loader() {},
    onData(fn) { listeners.push(fn); runCalcs(); try { fn(); } catch (e) { console.error(e); } },
    setLink(id) { try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ } },
    params() { return {}; }, setParams() {}, resetParams() {}, refresh() {}
  };

  const v = window.DASH_VERSION || '';
  DATASETS.forEach(id => {
    fetch(`data/${id}.csv?v=${v}`).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(t => { const rows = d3.csvParse(t); store[id] = { status: 'ok', data: rows, columns: rows.columns }; })
      .catch(() => { store[id] = { status: 'error', data: [], columns: [] }; })
      .finally(() => {
        document.querySelectorAll(`[data-source~="${id}"]`).forEach(el => el.removeAttribute('data-dash-source-state'));
        notify();
      });
  });

  let w = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - w) < 20) return;
    w = window.innerWidth; notify();
  });
})();
