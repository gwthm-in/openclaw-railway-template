// Served at /setup/app.js
// No fancy syntax: keep it maximally compatible.

(function () {
  var statusEl = document.getElementById('status');
  var authGroupEl = document.getElementById('authGroup');
  var authChoiceEl = document.getElementById('authChoice');
  var logEl = document.getElementById('log');

  function setStatus(s) {
    statusEl.textContent = s;
  }

  function renderAuth(groups) {
    authGroupEl.innerHTML = '';
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var opt = document.createElement('option');
      opt.value = g.value;
      opt.textContent = g.label + (g.hint ? ' - ' + g.hint : '');
      authGroupEl.appendChild(opt);
    }

    authGroupEl.onchange = function () {
      var sel = null;
      for (var j = 0; j < groups.length; j++) {
        if (groups[j].value === authGroupEl.value) sel = groups[j];
      }
      authChoiceEl.innerHTML = '';
      var opts = (sel && sel.options) ? sel.options : [];
      for (var k = 0; k < opts.length; k++) {
        var o = opts[k];
        var opt2 = document.createElement('option');
        opt2.value = o.value;
        opt2.textContent = o.label + (o.hint ? ' - ' + o.hint : '');
        authChoiceEl.appendChild(opt2);
      }
    };

    authGroupEl.onchange();
  }

  function httpJson(url, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    return fetch(url, opts).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error('HTTP ' + res.status + ': ' + (t || res.statusText));
        });
      }
      return res.json();
    });
  }

  function refreshStatus() {
    setStatus('Loading...');
    return httpJson('/setup/api/status').then(function (j) {
      var ver = j.openclawVersion ? (' | ' + j.openclawVersion) : '';
      setStatus((j.configured ? 'Configured - open /openclaw' : 'Not configured - run setup below') + ver);
      renderAuth(j.authGroups || []);
      // If channels are unsupported, surface it for debugging.
      if (j.channelsAddHelp && j.channelsAddHelp.indexOf('telegram') === -1) {
        logEl.textContent += '\nNote: this openclaw build does not list telegram in `channels add --help`. Telegram auto-add will be skipped.\n';
      }

    }).catch(function (e) {
      setStatus('Error: ' + String(e));
    });
  }

  document.getElementById('run').onclick = function () {
    var payload = {
      flow: document.getElementById('flow').value,
      authChoice: authChoiceEl.value,
      authSecret: document.getElementById('authSecret').value,
      telegramToken: document.getElementById('telegramToken').value,
      discordToken: document.getElementById('discordToken').value,
      slackBotToken: document.getElementById('slackBotToken').value,
      slackAppToken: document.getElementById('slackAppToken').value
    };

    logEl.textContent = 'Running...\n';

    fetch('/setup/api/run', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.text();
    }).then(function (text) {
      var j;
      try { j = JSON.parse(text); } catch (_e) { j = { ok: false, output: text }; }
      logEl.textContent += (j.output || JSON.stringify(j, null, 2));
      return refreshStatus();
    }).catch(function (e) {
      logEl.textContent += '\nError: ' + String(e) + '\n';
    });
  };

  // Pairing approve helper
  var pairingBtn = document.getElementById('pairingApprove');
  if (pairingBtn) {
    pairingBtn.onclick = function () {
      var channel = prompt('Enter channel (telegram or discord):');
      if (!channel) return;
      channel = channel.trim().toLowerCase();
      if (channel !== 'telegram' && channel !== 'discord') {
        alert('Channel must be "telegram" or "discord"');
        return;
      }
      var code = prompt('Enter pairing code (e.g. 3EY4PUYS):');
      if (!code) return;
      logEl.textContent += '\nApproving pairing for ' + channel + '...\n';
      fetch('/setup/api/pairing/approve', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel: channel, code: code.trim() })
      }).then(function (r) { return r.text(); })
        .then(function (t) { logEl.textContent += t + '\n'; })
        .catch(function (e) { logEl.textContent += 'Error: ' + String(e) + '\n'; });
    };
  }

  document.getElementById('reset').onclick = function () {
    if (!confirm('Reset setup? This deletes the config file so onboarding can run again.')) return;
    logEl.textContent = 'Resetting...\n';
    fetch('/setup/api/reset', { method: 'POST', credentials: 'same-origin' })
      .then(function (res) { return res.text(); })
      .then(function (t) { logEl.textContent += t + '\n'; return refreshStatus(); })
      .catch(function (e) { logEl.textContent += 'Error: ' + String(e) + '\n'; });
  };

  refreshStatus();

  // ========== Disk Management ==========
  var diskLogEl = document.getElementById('diskLog');
  var diskBarEl = document.getElementById('diskBar');
  var diskBrowserEl = document.getElementById('diskBrowser');
  var diskBarFillEl = document.getElementById('diskBarFill');
  var diskBarLabelEl = document.getElementById('diskBarLabel');
  var diskTableBodyEl = document.getElementById('diskTableBody');
  var diskBreadcrumbEl = document.getElementById('diskBreadcrumb');
  var currentDiskDir = '.';

  function showDiskLog(msg) {
    diskLogEl.style.display = 'block';
    diskLogEl.textContent += msg + '\n';
  }

  function renderDiskBar(volume) {
    diskBarEl.style.display = 'block';
    var pct = volume.usedPercent || 0;
    diskBarFillEl.style.width = pct + '%';
    diskBarFillEl.className = 'disk-bar-fill' +
      (pct >= 90 ? ' critical' : pct >= 70 ? ' warning' : '');
    diskBarLabelEl.textContent = volume.usedHuman + ' used of ' +
      volume.totalHuman + ' (' + pct + '%) \u2014 ' +
      volume.availableHuman + ' available';
  }

  function renderBreadcrumb(dir) {
    var parts = dir === '.' ? [] : dir.split('/');
    var html = '<span class="dir-link" data-disk-dir=".">data</span>';
    var cumulative = '';
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      cumulative += (cumulative ? '/' : '') + parts[i];
      html += ' / <span class="dir-link" data-disk-dir="' + cumulative + '">' + parts[i] + '</span>';
    }
    diskBreadcrumbEl.innerHTML = html;
    var links = diskBreadcrumbEl.querySelectorAll('.dir-link');
    for (var j = 0; j < links.length; j++) {
      links[j].onclick = function () {
        browseDiskDir(this.getAttribute('data-disk-dir'));
      };
    }
  }

  function browseDiskDir(dir) {
    currentDiskDir = dir || '.';
    diskTableBodyEl.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
    diskBrowserEl.style.display = 'block';
    renderBreadcrumb(currentDiskDir);

    httpJson('/setup/api/disk/browse?dir=' + encodeURIComponent(currentDiskDir))
      .then(function (data) {
        diskTableBodyEl.innerHTML = '';

        if (data.parentDir !== null && data.parentDir !== undefined) {
          var parentRow = document.createElement('tr');
          parentRow.innerHTML = '<td class="dir-link" colspan="2">..</td><td></td>';
          parentRow.querySelector('.dir-link').onclick = function () {
            browseDiskDir(data.parentDir === '.' ? '.' : data.parentDir);
          };
          diskTableBodyEl.appendChild(parentRow);
        }

        for (var i = 0; i < data.items.length; i++) {
          var item = data.items[i];
          var row = document.createElement('tr');

          var nameCell = document.createElement('td');
          if (item.isDirectory) {
            var dirSpan = document.createElement('span');
            dirSpan.className = 'dir-link';
            dirSpan.textContent = '\uD83D\uDCC1 ' + item.name;
            dirSpan.setAttribute('data-disk-path', item.path);
            dirSpan.onclick = function () {
              browseDiskDir(this.getAttribute('data-disk-path'));
            };
            nameCell.appendChild(dirSpan);
          } else {
            nameCell.textContent = '\uD83D\uDCC4 ' + item.name;
          }
          if (item.protected) {
            var badge = document.createElement('span');
            badge.className = 'protected-badge';
            badge.textContent = 'protected';
            nameCell.appendChild(badge);
          }
          if (item.isSymlink) {
            var symBadge = document.createElement('span');
            symBadge.className = 'protected-badge';
            symBadge.textContent = 'symlink';
            nameCell.appendChild(symBadge);
          }
          row.appendChild(nameCell);

          var sizeCell = document.createElement('td');
          sizeCell.style.textAlign = 'right';
          sizeCell.style.whiteSpace = 'nowrap';
          sizeCell.textContent = item.sizeHuman;
          row.appendChild(sizeCell);

          var actionCell = document.createElement('td');
          actionCell.style.textAlign = 'right';
          if (!item.protected) {
            var btn = document.createElement('button');
            btn.className = 'delete-btn';
            btn.textContent = 'Delete';
            btn.setAttribute('data-disk-path', item.path);
            btn.setAttribute('data-disk-name', item.name);
            btn.onclick = function () {
              var p = this.getAttribute('data-disk-path');
              var n = this.getAttribute('data-disk-name');
              if (!confirm('Delete "' + n + '"? This cannot be undone.')) return;
              deleteDiskItem(p);
            };
            actionCell.appendChild(btn);
          }
          row.appendChild(actionCell);

          diskTableBodyEl.appendChild(row);
        }

        if (data.items.length === 0) {
          diskTableBodyEl.innerHTML = '<tr><td colspan="3" class="muted">Empty directory</td></tr>';
        }
      })
      .catch(function (e) {
        showDiskLog('Error browsing: ' + String(e));
      });
  }

  function deleteDiskItem(relPath) {
    showDiskLog('Deleting: ' + relPath + '...');
    fetch('/setup/api/disk/delete', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: relPath }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) {
          showDiskLog('Deleted ' + data.deleted + ' (freed ' + data.freedHuman + ')');
        } else {
          showDiskLog('Failed: ' + (data.error || 'unknown error'));
        }
        loadDiskUsage();
        browseDiskDir(currentDiskDir);
      })
      .catch(function (e) {
        showDiskLog('Error: ' + String(e));
      });
  }

  function loadDiskUsage() {
    httpJson('/setup/api/disk/usage')
      .then(function (data) {
        renderDiskBar(data.volume);
        if (!diskBrowserEl.style.display || diskBrowserEl.style.display === 'none') {
          browseDiskDir('.');
        }
      })
      .catch(function (e) {
        showDiskLog('Error loading disk usage: ' + String(e));
      });
  }

  document.getElementById('diskRefresh').onclick = function () {
    diskLogEl.textContent = '';
    loadDiskUsage();
    browseDiskDir(currentDiskDir);
  };
})();
