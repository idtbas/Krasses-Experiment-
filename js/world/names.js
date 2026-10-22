/* KYTHERA · MANDAT · Namensgenerator für Staaten, Städte und Personen (frei erfunden) */
(function (root) {
  'use strict';
  const C = {
    nord: {
      pre: ['Skar', 'Vel', 'Hol', 'Brann', 'Tor', 'Ul', 'Fjel', 'Eir', 'Gun', 'Ask', 'Rø', 'Sval', 'Hed', 'Kald', 'Ves', 'Ny', 'Lys', 'Grå', 'Hvit', 'Sol'],
      suf: ['heim', 'vik', 'mark', 'dal', 'by', 'sund', 'holm', 'strøm', 'fjord', 'stad', 'berg', 'havn', 'nes', 'vang'],
      land: ['ia', 'land', 'mark', 'heim'],
      first: ['Ingrid', 'Henrik', 'Sigrid', 'Torvald', 'Astrid', 'Leif', 'Maren', 'Eirik', 'Solveig', 'Halvard', 'Liv', 'Anders', 'Tove', 'Ragnar', 'Kari', 'Ivar'],
      last: ['Halvorsen', 'Brekke', 'Lindqvist', 'Nyström', 'Solberg', 'Aasen', 'Dahlgren', 'Fjeldstad', 'Skogen', 'Vik', 'Holmberg', 'Rønning', 'Ekdal', 'Hvidsten'],
    },
    lat: {
      pre: ['Val', 'Cor', 'Mar', 'Ser', 'Lu', 'Aur', 'Ta', 'Bel', 'Ver', 'Cal', 'Pra', 'Sol', 'Ar', 'Mon', 'San', 'Lir', 'Ost', 'Fio', 'Ras', 'Car'],
      suf: ['ena', 'ia', 'ano', 'esa', 'ora', 'ino', 'ara', 'ella', 'ona', 'ento', 'ezia', 'urno', 'iva', 'osta'],
      land: ['ia', 'ana', 'ella', 'ora'],
      first: ['Lucía', 'Marco', 'Elena', 'Teodoro', 'Chiara', 'Alessio', 'Valeria', 'Rafael', 'Inés', 'Matteo', 'Paola', 'Esteban', 'Giulia', 'Andrés', 'Bianca', 'Duarte'],
      last: ['Serrano', 'Valdés', 'Moretti', 'Fontana', 'Barrantes', 'Corvino', 'Aurelio', 'Marchetti', 'Ruiz-Calvo', 'Benedetti', 'Ostrova', 'Lirani', 'Castellan', 'Vidal'],
    },
    slav: {
      pre: ['Vel', 'Dob', 'Kra', 'Zor', 'Mir', 'Rad', 'Bor', 'Sto', 'Lub', 'Vy', 'Pol', 'Ner', 'Gor', 'Svet', 'Zla', 'Bel'],
      suf: ['ovo', 'ina', 'grad', 'ava', 'ice', 'ovka', 'sk', 'ec', 'yn', 'opol', 'ava', 'ny'],
      land: ['ija', 'ovia', 'ania', 'ska'],
      first: ['Milena', 'Bogdan', 'Vesna', 'Radek', 'Zora', 'Mirko', 'Jelena', 'Tomasz', 'Danica', 'Vladan', 'Irena', 'Luka', 'Nadia', 'Stanko'],
      last: ['Dobrev', 'Kravčik', 'Novak', 'Wierzba', 'Zorić', 'Mirov', 'Stojan', 'Borowska', 'Radić', 'Volkov', 'Lubić', 'Poljak', 'Svetlov', 'Gorska'],
    },
    arab: {
      pre: ['Al', 'Qa', 'Za', 'Ha', 'Ra', 'Su', 'Ma', 'Ya', 'Ba', 'Na', 'Ka', 'Sa', 'Ta', 'Ja', 'Da'],
      suf: ['dir', 'hra', 'mir', 'rah', 'sir', 'bat', 'lim', 'far', 'ziz', 'shan', 'kar', 'nun', 'wah', 'dun'],
      land: ['ia', 'stan', 'iyah', 'an'],
      first: ['Yusuf', 'Leila', 'Karim', 'Noor', 'Samir', 'Amira', 'Tariq', 'Yasmin', 'Idris', 'Salma', 'Faris', 'Rania', 'Omar', 'Hana'],
      last: ['al-Qasimi', 'Haddad', 'Barakzai', 'Mansour', 'Darwish', 'al-Rahim', 'Saleh', 'Khoury', 'Nasser', 'Zayani', 'Farouk', 'Hamdan', 'Suleiman', 'Kassar'],
    },
    east: {
      pre: ['Shi', 'Ka', 'Ren', 'Yo', 'Tai', 'Hai', 'Mei', 'Sen', 'Ryo', 'Lan', 'Kyo', 'Jin', 'Hua', 'Sa', 'Ki'],
      suf: ['ren', 'shan', 'kai', 'dao', 'mura', 'jin', 'ho', 'wan', 'zhou', 'saki', 'ning', 'yama', 'lin', 'gawa'],
      land: ['an', 'dan', 'wa', 'ka'],
      first: ['Meilin', 'Kenji', 'Hana', 'Tao', 'Yuki', 'Ren', 'Sora', 'Lian', 'Haruto', 'Xia', 'Daiki', 'Aiko', 'Wei', 'Mio'],
      last: ['Arakawa', 'Zhou', 'Sato', 'Lin', 'Takeda', 'Huang', 'Morita', 'Chen', 'Kobayashi', 'Wen', 'Fujita', 'Tang', 'Nakamura', 'Qiao'],
    },
    afr: {
      pre: ['Ka', 'Mbo', 'Za', 'Nya', 'Ulu', 'Ki', 'Tem', 'Ama', 'Lo', 'Ba', 'Ndo', 'Sa', 'Ko', 'Ma', 'Twa'],
      suf: ['ndi', 'mba', 'ra', 'goma', 'lele', 'we', 'sika', 'zana', 'kuru', 'nde', 'tali', 'buye', 'mora', 'ngo'],
      land: ['ia', 'ra', 'we', 'ndi'],
      first: ['Amara', 'Kwame', 'Fatou', 'Tendai', 'Zola', 'Jabari', 'Nia', 'Kofi', 'Imani', 'Sefu', 'Ayo', 'Thandiwe', 'Bakari', 'Lindiwe'],
      last: ['Okonkwo', 'Mwangi', 'Diallo', 'Banda', 'Oyelaran', 'Achebe', 'Ndlovu', 'Kamara', 'Mensah', 'Tembo', 'Abara', 'Sibanda', 'Kariuki', 'Nkosi'],
    },
    poly: {
      pre: ['Ta', 'Mo', 'Ka', 'Pa', 'Hei', 'Lu', 'Ra', 'Vai', 'Ma', 'Oa', 'Ke', 'Ha', 'Ri', 'Nu'],
      suf: ['nui', 'lani', 'koa', 'hiti', 'mau', 'vai', 'rua', 'pele', 'roa', 'tea', 'kai', 'ola'],
      land: ['a', 'i', 'ua'],
      first: ['Leilani', 'Kai', 'Moana', 'Tane', 'Nalani', 'Keoni', 'Hina', 'Rangi', 'Malia', 'Koa', 'Aroha', 'Ikaika'],
      last: ['Kahale', 'Tuilagi', 'Makoa', 'Ranginui', 'Kealoha', 'Tavita', 'Hohepa', 'Akana', 'Mahoe', 'Palakiko'],
    },
    celt: {
      pre: ['Bryn', 'Dun', 'Kel', 'Mor', 'Glen', 'Ard', 'Lach', 'Tre', 'Pen', 'Car', 'Ros', 'Aber'],
      suf: ['wyn', 'mor', 'ach', 'gal', 'dorn', 'wick', 'ley', 'ross', 'more', 'lin', 'tor'],
      land: ['ia', 'wy', 'ach', 'ar'],
      first: ['Siobhan', 'Callum', 'Morwenna', 'Rhys', 'Eilidh', 'Ewan', 'Niamh', 'Aled', 'Isla', 'Declan', 'Bronwen', 'Fergus'],
      last: ['Mac Ardle', 'Penrose', 'Brennan', 'Morgan-Lach', 'Kellow', 'Dunmore', 'Trevelyan', 'Glenaster', 'Rosser', 'Aberley'],
    },
  };
  const CULTURES = Object.keys(C);
  const GOV = [
    { t: 'Republik', f: n => 'Republik ' + n, w: 4 },
    { t: 'Föderation', f: n => 'Föderation ' + n, w: 2 },
    { t: 'Konstitutionelle Monarchie', f: n => 'Königreich ' + n, w: 2 },
    { t: 'Präsidialrepublik', f: n => n, w: 3 },
    { t: 'Bundesstaat', f: n => 'Vereinigte Provinzen von ' + n, w: 1 },
    { t: 'Freistaat', f: n => 'Freistaat ' + n, w: 1 },
    { t: 'Parlamentarische Republik', f: n => n, w: 3 },
  ];

  function word(r, c, minLen) {
    const d = C[c];
    for (let k = 0; k < 20; k++) {
      const w = d.pre[Math.floor(r() * d.pre.length)] + d.suf[Math.floor(r() * d.suf.length)];
      if (w.length >= (minLen || 4)) return w;
    }
    return d.pre[0] + d.suf[0];
  }
  function landName(r, c, used) {
    const d = C[c];
    for (let k = 0; k < 40; k++) {
      let base = d.pre[Math.floor(r() * d.pre.length)];
      if (r() < 0.5) base += d.suf[Math.floor(r() * d.suf.length)].replace(/(a|e|o|ia)$/, '');
      const n = base + d.land[Math.floor(r() * d.land.length)];
      if (!used.has(n) && n.length >= 5 && n.length <= 12) { used.add(n); return n; }
    }
    const n = word(r, c) + 'ia';
    used.add(n);
    return n;
  }
  function cityName(r, c, used) {
    for (let k = 0; k < 40; k++) {
      let n = word(r, c, 4);
      if (r() < 0.12) n = (r() < 0.5 ? 'Port ' : r() < 0.5 ? 'San ' : 'Neu-') + n;
      if (!used.has(n)) { used.add(n); return n; }
    }
    const n = word(r, c) + ' ' + Math.floor(r() * 9 + 2);
    used.add(n);
    return n;
  }
  function person(r, c) {
    const d = C[c] || C.lat;
    return d.first[Math.floor(r() * d.first.length)] + ' ' + d.last[Math.floor(r() * d.last.length)];
  }
  function gov(r) {
    const tot = GOV.reduce((s, g) => s + g.w, 0);
    let x = r() * tot;
    for (const g of GOV) { x -= g.w; if (x <= 0) return g; }
    return GOV[0];
  }
  const HANDLES_A = ['nachtfalke', 'stadtkind', 'kuestenwind', 'datenkatze', 'gruenlicht', 'bahnfan', 'zeitzeugin', 'lokalreporter', 'dreiundzwanzig', 'ostwind', 'fernglas', 'kompass', 'morgenkaffee', 'leuchtturm', 'kartograph', 'steuerzahler', 'zukunftsmusik', 'skeptiker', 'wolkenbruch', 'feldnotiz'];
  function handle(r) { return '@' + HANDLES_A[Math.floor(r() * HANDLES_A.length)] + Math.floor(r() * 900 + 10); }

  const api = { CULTURES, landName, cityName, person, gov, handle, word };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.KY = root.KY || {}; root.KY.names = api; }
})(typeof window !== 'undefined' ? window : globalThis);
