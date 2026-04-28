// CPU Scheduling Engine — algorithms.js
// Shared by index.html and compare.html

// Build a fresh stats object from a process array
function buildStats(processes) {
  const s = {};
  processes.forEach(p => {
    s[p.pid] = { ...p, remaining: p.burst, finish: 0, response: -1 };
  });
  return s;
}

// Compute turnaround and waiting after finish times are set
function computeStats(stats) {
  Object.values(stats).forEach(s => {
    s.turnaround = s.finish - s.arrival;
    s.waiting    = s.turnaround - s.burst;
  });
}

// Route to the correct algorithm
function runAlgo(key, stats, quantum) {
  if (key === 'fcfs')       return fcfs(stats);
  if (key === 'sjf')        return sjf(stats);
  if (key === 'srtf')       return srtf(stats);
  if (key === 'rr')         return rr(stats, quantum || 2);
  if (key === 'priority')   return prioritySched(stats, false);
  if (key === 'priority_p') return prioritySched(stats, true);
  return [];
}

// FCFS
function fcfs(stats) {
  var t = 0, tl = [];
  Object.values(stats)
    .slice()
    .sort(function(a, b) { return a.arrival - b.arrival || a.pid.localeCompare(b.pid); })
    .forEach(function(p) {
      if (t < p.arrival) { tl.push({ pid: 'idle', start: t, end: p.arrival }); t = p.arrival; }
      if (p.response === -1) p.response = t - p.arrival;
      tl.push({ pid: p.pid, start: t, end: t + p.burst, color: p.color });
      t += p.burst;
      p.finish = t;
    });
  return tl;
}

// SJF (non-preemptive)
function sjf(stats) {
  var t = 0, tl = [], done = [];
  var all = Object.values(stats);
  while (done.length < all.length) {
    var ready = all.filter(function(p) { return p.arrival <= t && done.indexOf(p.pid) === -1; });
    ready.sort(function(a, b) { return a.burst - b.burst || a.arrival - b.arrival; });
    if (!ready.length) {
      var rem = all.filter(function(p) { return done.indexOf(p.pid) === -1; });
      rem.sort(function(a, b) { return a.arrival - b.arrival; });
      tl.push({ pid: 'idle', start: t, end: rem[0].arrival });
      t = rem[0].arrival;
      continue;
    }
    var p = ready[0];
    if (p.response === -1) p.response = t - p.arrival;
    tl.push({ pid: p.pid, start: t, end: t + p.burst, color: p.color });
    t += p.burst;
    p.finish = t;
    done.push(p.pid);
  }
  return tl;
}

// SRTF (preemptive SJF)
function srtf(stats) {
  var t = 0, tl = [], done = [];
  var all = Object.values(stats);
  var rem = {};
  all.forEach(function(p) { rem[p.pid] = p.burst; });

  while (done.length < all.length) {
    var ready = all.filter(function(p) { return p.arrival <= t && done.indexOf(p.pid) === -1; });
    ready.sort(function(a, b) { return rem[a.pid] - rem[b.pid] || a.arrival - b.arrival; });
    if (!ready.length) {
      var notDone = all.filter(function(p) { return done.indexOf(p.pid) === -1; });
      notDone.sort(function(a, b) { return a.arrival - b.arrival; });
      t = notDone[0].arrival;
      continue;
    }
    var p = ready[0];
    if (p.response === -1) p.response = t - p.arrival;
    var future = all.filter(function(q) { return q.arrival > t && done.indexOf(q.pid) === -1; });
    future.sort(function(a, b) { return a.arrival - b.arrival; });
    var until = future.length ? Math.min(future[0].arrival, t + rem[p.pid]) : t + rem[p.pid];
    if (tl.length && tl[tl.length - 1].pid === p.pid) {
      tl[tl.length - 1].end = until;
    } else {
      tl.push({ pid: p.pid, start: t, end: until, color: p.color });
    }
    rem[p.pid] -= (until - t);
    t = until;
    if (rem[p.pid] <= 0) { p.finish = t; done.push(p.pid); }
  }
  return tl;
}

// Round Robin
function rr(stats, quantum) {
  var t = 0, tl = [], queue = [], done = [];
  var all = Object.values(stats).slice();
  all.sort(function(a, b) { return a.arrival - b.arrival; });
  var rem = {};
  all.forEach(function(p) { rem[p.pid] = p.burst; });
  var idx = 0;

  while (done.length < all.length) {
    while (idx < all.length && all[idx].arrival <= t) { queue.push(all[idx]); idx++; }
    if (!queue.length) {
      if (idx < all.length) { t = all[idx].arrival; continue; }
      break;
    }
    var p = queue.shift();
    if (p.response === -1) p.response = t - p.arrival;
    var run = Math.min(quantum, rem[p.pid]);
    tl.push({ pid: p.pid, start: t, end: t + run, color: p.color });
    t += run;
    rem[p.pid] -= run;
    while (idx < all.length && all[idx].arrival <= t) { queue.push(all[idx]); idx++; }
    if (rem[p.pid] > 0) {
      queue.push(p);
    } else {
      p.finish = t;
      done.push(p.pid);
    }
  }
  return tl;
}

// Priority Scheduling (preemptive and non-preemptive)
function prioritySched(stats, preemptive) {
  var t = 0, tl = [], done = [];
  var all = Object.values(stats);
  var rem = {};
  all.forEach(function(p) { rem[p.pid] = p.burst; });

  while (done.length < all.length) {
    var ready = all.filter(function(p) { return p.arrival <= t && done.indexOf(p.pid) === -1; });
    ready.sort(function(a, b) { return a.priority - b.priority || a.arrival - b.arrival; });
    if (!ready.length) {
      var notDone = all.filter(function(p) { return done.indexOf(p.pid) === -1; });
      notDone.sort(function(a, b) { return a.arrival - b.arrival; });
      tl.push({ pid: 'idle', start: t, end: notDone[0].arrival });
      t = notDone[0].arrival;
      continue;
    }
    var p = ready[0];
    if (p.response === -1) p.response = t - p.arrival;

    if (preemptive) {
      var future = all.filter(function(q) { return q.arrival > t && done.indexOf(q.pid) === -1; });
      future.sort(function(a, b) { return a.arrival - b.arrival; });
      var until = future.length ? Math.min(future[0].arrival, t + rem[p.pid]) : t + rem[p.pid];
      if (tl.length && tl[tl.length - 1].pid === p.pid) {
        tl[tl.length - 1].end = until;
      } else {
        tl.push({ pid: p.pid, start: t, end: until, color: p.color });
      }
      rem[p.pid] -= (until - t);
      t = until;
      if (rem[p.pid] <= 0) { p.finish = t; done.push(p.pid); }
    } else {
      tl.push({ pid: p.pid, start: t, end: t + rem[p.pid], color: p.color });
      t += rem[p.pid];
      rem[p.pid] = 0;
      p.finish = t;
      done.push(p.pid);
    }
  }
  return tl;
}
