// Builds a clearly labeled demo team and match so a new user (or a demo)
// can see the box score, log and score flow without tagging first.
const Sample = (() => {
  function rng(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }

  function build() {
    const r = rng(20261108);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const weighted = (pairs) => { let x = r(); for (const [v, w] of pairs) { if ((x -= w) < 0) return v; } return pairs[pairs.length - 1][0]; };
    const uid = Store.uid;

    const roster = [
      ['1', 'Libero Lee', 'L'], ['3', 'Dana Diaz', 'DS'], ['4', 'Sam Setter', 'S'], ['7', 'Olivia Hart', 'OH'],
      ['9', 'Riley Stone', 'OH'], ['10', 'Jo Opposite', 'OPP'], ['12', 'Mia Middle', 'MB'], ['15', 'Ava Banks', 'MB']
    ].map(([number, name, pos]) => ({ id: uid(), number, name, pos }));
    const by = (pos) => roster.filter((p) => p.pos === pos);
    const team = { id: uid(), name: 'Sample Team', sample: true, players: roster };
    const hitters = [...by('OH'), ...by('OH'), ...by('OPP'), ...by('MB')];
    const passers = [...by('L'), ...by('L'), ...by('OH'), by('DS')[0]];
    const diggers = [...by('L'), by('DS')[0], ...by('OH')];
    const servers = [by('S')[0], ...by('OH'), by('OPP')[0], by('DS')[0], ...by('MB')];
    const setter = by('S')[0];

    const events = [];
    let t = 95;
    const add = (set, p, skill, result, point = null) => {
      events.push({ id: uid(), t: Math.round(t * 10) / 10, set, playerId: p ? p.id : null, skill, result, point });
      t += 1.4 + r() * 1.2;
    };

    function attackSeq(set) {
      add(set, setter, 'set', 'in');
      const h = pick(hitters);
      const res = weighted([['kill', 0.42], ['in', 0.36], ['err', 0.14], ['blk', 0.08]]);
      if (res === 'kill') { events[events.length - 1].result = 'ast'; add(set, h, 'attack', 'kill', 'us'); return 'us'; }
      if (res === 'err' || res === 'blk') { add(set, h, 'attack', res, 'them'); return 'them'; }
      add(set, h, 'attack', 'in');
      return null;
    }

    function defend(set) {
      // Opponent attacks: block, dig, or they score.
      const x = r();
      if (x < 0.1) { const mb = pick(by('MB')); add(set, mb, 'block', 'solo', 'us'); return 'us'; }
      if (x < 0.32) { add(set, null, 'team', 'opppt', 'them'); return 'them'; }
      if (x < 0.42) { add(set, pick(diggers), 'dig', 'err', 'them'); return 'them'; }
      if (x < 0.5) { add(set, null, 'team', 'opperr', 'us'); return 'us'; }
      add(set, pick(diggers), 'dig', 'dig');
      return null;
    }

    function rally(set, weServe) {
      if (weServe) {
        const s = pick(servers);
        const res = weighted([['ace', 0.09], ['err', 0.11], ['in', 0.8]]);
        if (res !== 'in') { add(set, s, 'serve', res, res === 'ace' ? 'us' : 'them'); return events[events.length - 1].point; }
        add(set, s, 'serve', 'in');
        const d = defend(set);
        if (d) return d;
      } else {
        const rating = weighted([['3', 0.38], ['2', 0.34], ['1', 0.2], ['0', 0.08]]);
        add(set, pick(passers), 'pass', rating, rating === '0' ? 'them' : null);
        if (rating === '0') return 'them';
      }
      for (let i = 0; i < 4; i++) {
        const a = attackSeq(set);
        if (a) return a;
        const d = defend(set);
        if (d) return d;
      }
      return r() < 0.5 ? (add(set, null, 'team', 'opperr', 'us'), 'us') : (add(set, null, 'team', 'opppt', 'them'), 'them');
    }

    let setsUs = 0, setsThem = 0, set = 1, weServe = true;
    while (setsUs < 2 && setsThem < 2) {
      let us = 0, them = 0;
      while (!isSetOver(us, them, set)) {
        const winner = rally(set, weServe);
        if (winner === 'us') us++; else them++;
        weServe = winner === 'us';
        t += 14 + r() * 12;
      }
      if (us > them) setsUs++; else setsThem++;
      set++;
      t += 180;
    }

    const match = {
      id: uid(), teamId: team.id, opponent: 'Sample Opponent', sample: true,
      date: new Date().toISOString().slice(0, 10), title: 'Sample match (made-up data)',
      events, curSet: set - 1, video: null
    };
    return { team, match };
  }

  return { build };
})();
