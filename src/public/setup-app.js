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

  var showAllAuthMethods = false;

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
      
      // Filter out interactive OAuth options unless "Show all" is enabled
      var filteredOpts = [];
      var hiddenCount = 0;
      
      for (var k = 0; k < opts.length; k++) {
        var o = opts[k];
        var isInteractive = (
          o.value.toLowerCase().indexOf('cli') >= 0 ||
          o.value.toLowerCase().indexOf('oauth') >= 0 ||
          o.value.toLowerCase().indexOf('device') >= 0 ||
          o.value.toLowerCase().indexOf('codex') >= 0 ||
          o.value.toLowerCase().indexOf('antigravity') >= 0 ||
          o.value.toLowerCase().indexOf('gemini-cli') >= 0 ||
          o.value.toLowerCase().indexOf('qwen-portal') >= 0 ||
          o.value.toLowerCase().indexOf('github-copilot') >= 0
        );
        
        if (!isInteractive || showAllAuthMethods) {
          filteredOpts.push(o);
        } else {
          hiddenCount++;
        }
      }
      
      // Render filtered options
      for (var m = 0; m < filteredOpts.length; m++) {
        var opt2 = document.createElement('option');
        opt2.value = filteredOpts[m].value;
        opt2.textContent = filteredOpts[m].label + (filteredOpts[m].hint ? ' - ' + filteredOpts[m].hint : '');
        authChoiceEl.appendChild(opt2);
      }
      
      // Add "Show all auth methods" option if there are hidden options
      if (hiddenCount > 0 && !showAllAuthMethods) {
        var showAllOpt = document.createElement('option');
        showAllOpt.value = '__show_all__';
        showAllOpt.textContent = '⚠️ Show all auth methods (' + hiddenCount + ' hidden - require terminal/OAuth)';
        showAllOpt.style.fontWeight = 'bold';
        showAllOpt.style.color = '#ff9800';
        authChoiceEl.appendChild(showAllOpt);
      }
    };

    authGroupEl.onchange();
  }

  // Handle "Show all auth methods" selection
  authChoiceEl.onchange = function () {
    if (authChoiceEl.value === '__show_all__') {
      showAllAuthMethods = true;
      authGroupEl.onchange(); // Re-render with all options
    }
  };

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

  function loadAuthGroups() {
    return httpJson('/setup/api/auth-groups').then(function (j) {
      if (!j.authGroups || j.authGroups.length === 0) {
        console.warn('Auth groups empty, trying status endpoint...');
        throw new Error('Empty auth groups');
      }
      renderAuth(j.authGroups);
    }).catch(function (e) {
      console.error('Failed to load auth groups from fast endpoint:', e);
      // Fallback to loading from status if fast endpoint fails
      return httpJson('/setup/api/status').then(function (j) {
        if (!j.authGroups || j.authGroups.length === 0) {
          console.warn('Auth groups empty in status endpoint too');
          setStatus('Warning: Unable to load provider list. Setup wizard may not work correctly.');
        }
        renderAuth(j.authGroups || []);
      }).catch(function (e2) {
        console.error('Failed to load auth groups from status endpoint:', e2);
        setStatus('Warning: Unable to load provider list. Setup wizard may not work correctly.');
        renderAuth([]); // Render empty to unblock UI
      });
    });
  }

  function refreshStatus() {
    setStatus('Loading...');
    var statusDetailsEl = document.getElementById('statusDetails');
    if (statusDetailsEl) {
      statusDetailsEl.innerHTML = '';
    }

    return httpJson('/setup/api/status').then(function (j) {
      var ver = j.openclawVersion ? (' | ' + j.openclawVersion) : '';
      setStatus((j.configured ? 'Configured - open /openclaw' : 'Not configured - run setup below') + ver);
      
      // Show gateway target and health hints
      if (statusDetailsEl) {
        var detailsHtml = '<div class="muted" style="font-size: 0.9em;">';
        detailsHtml += '<strong>Gateway Target:</strong> <code>' + (j.gatewayTarget || 'unknown') + '</code><br/>';
        detailsHtml += '<strong>Health Check:</strong> <a href="/healthz" target="_blank">/healthz</a> (shows gateway diagnostics)';
        detailsHtml += '</div>';
        statusDetailsEl.innerHTML = detailsHtml;
      }

      // If channels are unsupported, surface it for debugging.
      if (j.channelsAddHelp && j.channelsAddHelp.indexOf('telegram') === -1) {
        logEl.textContent += '\nNote: this openclaw build does not list telegram in `channels add --help`. Telegram auto-add will be skipped.\n';
      }

    }).catch(function (e) {
      setStatus('Error: ' + String(e));
      if (statusDetailsEl) {
        statusDetailsEl.innerHTML = '<div style="color: #d32f2f;">Failed to load status details</div>';
      }
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
      slackAppToken: document.getElementById('slackAppToken').value,
      // Custom provider fields
      customProviderId: document.getElementById('customProviderId').value,
      customProviderBaseUrl: document.getElementById('customProviderBaseUrl').value,
      customProviderApi: document.getElementById('customProviderApi').value,
      customProviderApiKeyEnv: document.getElementById('customProviderApiKeyEnv').value,
      customProviderModelId: document.getElementById('customProviderModelId').value
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

  // ========== DEBUG CONSOLE ==========
  var consoleCommandEl = document.getElementById('consoleCommand');
  var consoleArgEl = document.getElementById('consoleArg');
  var consoleRunBtn = document.getElementById('consoleRun');
  var consoleOutputEl = document.getElementById('consoleOutput');

  function runConsoleCommand() {
    var command = consoleCommandEl.value;
    var arg = consoleArgEl.value.trim();

    if (!command) {
      consoleOutputEl.textContent = 'Error: Please select a command';
      return;
    }

    // Disable button and show loading state
    consoleRunBtn.disabled = true;
    consoleRunBtn.textContent = 'Running...';
    consoleOutputEl.textContent = 'Executing command...\n';

    fetch('/setup/api/console/run', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ command: command, arg: arg })
    })
      .then(function (res) {
        return res.text().then(function (text) {
          return { status: res.status, text: text };
        });
      })
      .then(function (result) {
        var j;
        try {
          j = JSON.parse(result.text);
        } catch (_e) {
          j = { ok: false, error: result.text };
        }

        if (j.ok) {
          consoleOutputEl.textContent = j.output || '(no output)';
        } else {
          consoleOutputEl.textContent = 'Error: ' + (j.error || j.output || 'Unknown error');
        }

        // Re-enable button
        consoleRunBtn.disabled = false;
        consoleRunBtn.textContent = 'Run Command';
      })
      .catch(function (e) {
        consoleOutputEl.textContent = 'Error: ' + String(e);
        consoleRunBtn.disabled = false;
        consoleRunBtn.textContent = 'Run Command';
      });
  }

  consoleRunBtn.onclick = runConsoleCommand;

  // Enter key in arg field executes command
  consoleArgEl.onkeydown = function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      runConsoleCommand();
    }
  };

  // ========== CONFIG EDITOR ==========
  var configPathEl = document.getElementById('configPath');
  var configContentEl = document.getElementById('configContent');
  var configReloadBtn = document.getElementById('configReload');
  var configSaveBtn = document.getElementById('configSave');
  var configOutputEl = document.getElementById('configOutput');

  function loadConfig() {
    configOutputEl.textContent = 'Loading config...';
    configReloadBtn.disabled = true;
    configSaveBtn.disabled = true;

    fetch('/setup/api/config/raw', {
      method: 'GET',
      credentials: 'same-origin'
    })
      .then(function (res) {
        return res.text().then(function (text) {
          return { status: res.status, text: text };
        });
      })
      .then(function (result) {
        var j;
        try {
          j = JSON.parse(result.text);
        } catch (_e) {
          j = { ok: false, error: result.text };
        }

        if (j.ok) {
          configPathEl.textContent = j.path || 'Unknown';
          configContentEl.value = j.content || '';
          if (j.exists) {
            configOutputEl.textContent = 'Config loaded successfully';
          } else {
            configOutputEl.textContent = 'Config file does not exist yet. Run onboarding first.';
          }
        } else {
          configOutputEl.textContent = 'Error: ' + (j.error || 'Unknown error');
        }

        configReloadBtn.disabled = false;
        configSaveBtn.disabled = false;
      })
      .catch(function (e) {
        configOutputEl.textContent = 'Error: ' + String(e);
        configReloadBtn.disabled = false;
        configSaveBtn.disabled = false;
      });
  }

  function saveConfig() {
    var content = configContentEl.value;

    configOutputEl.textContent = 'Saving config...';
    configReloadBtn.disabled = true;
    configSaveBtn.disabled = true;
    configSaveBtn.textContent = 'Saving...';

    fetch('/setup/api/config/raw', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: content })
    })
      .then(function (res) {
        return res.text().then(function (text) {
          return { status: res.status, text: text };
        });
      })
      .then(function (result) {
        var j;
        try {
          j = JSON.parse(result.text);
        } catch (_e) {
          j = { ok: false, error: result.text };
        }

        if (j.ok) {
          configOutputEl.textContent = 'Success: ' + (j.message || 'Config saved') + '\n' + (j.restartOutput || '');
        } else {
          configOutputEl.textContent = 'Error: ' + (j.error || 'Unknown error');
        }

        configReloadBtn.disabled = false;
        configSaveBtn.disabled = false;
        configSaveBtn.textContent = 'Save & restart gateway';
      })
      .catch(function (e) {
        configOutputEl.textContent = 'Error: ' + String(e);
        configReloadBtn.disabled = false;
        configSaveBtn.disabled = false;
        configSaveBtn.textContent = 'Save & restart gateway';
      });
  }

  if (configReloadBtn) {
    configReloadBtn.onclick = loadConfig;
  }

  if (configSaveBtn) {
    configSaveBtn.onclick = saveConfig;
  }

  // Auto-load config on page load
  loadConfig();

  // ========== DEVICE PAIRING HELPER ==========
  var devicesRefreshBtn = document.getElementById('devicesRefresh');
  var devicesListEl = document.getElementById('devicesList');

  function refreshDevices() {
    if (!devicesListEl) return;

    devicesListEl.innerHTML = '<p class="muted">Loading...</p>';
    if (devicesRefreshBtn) {
      devicesRefreshBtn.disabled = true;
      devicesRefreshBtn.textContent = 'Loading...';
    }

    fetch('/setup/api/devices/pending', {
      method: 'GET',
      credentials: 'same-origin'
    })
      .then(function (res) {
        return res.text().then(function (text) {
          return { status: res.status, text: text };
        });
      })
      .then(function (result) {
        var j;
        try {
          j = JSON.parse(result.text);
        } catch (_e) {
          j = { ok: false, error: result.text };
        }

        if (j.ok) {
          if (j.requestIds && j.requestIds.length > 0) {
            var html = '<p class="muted">Found ' + j.requestIds.length + ' pending device(s):</p>';
            html += '<ul style="list-style: none; padding: 0;">';
            for (var i = 0; i < j.requestIds.length; i++) {
              var reqId = j.requestIds[i];
              html += '<li id="device-' + reqId + '" style="padding: 0.5rem; margin-bottom: 0.5rem; background: #f5f5f5; border-radius: 4px;">';
              html += '<code style="font-weight: bold;">' + reqId + '</code> ';
              html += '<button class="approve-device" data-requestid="' + reqId + '" style="margin-left: 0.5rem;">Approve</button>';
              html += '</li>';
            }
            html += '</ul>';
            html += '<details style="margin-top: 0.75rem;"><summary style="cursor: pointer;">Show raw output</summary>';
            html += '<pre style="margin-top: 0.5rem; background: #f5f5f5; padding: 0.5rem; border-radius: 4px; font-size: 11px; max-height: 200px; overflow-y: auto;">' + (j.output || '(no output)') + '</pre>';
            html += '</details>';
            devicesListEl.innerHTML = html;

            // Attach click handlers to approve buttons
            var approveButtons = devicesListEl.querySelectorAll('.approve-device');
            for (var k = 0; k < approveButtons.length; k++) {
              approveButtons[k].onclick = function (e) {
                var btn = e.target;
                var reqId = btn.getAttribute('data-requestid');
                approveDevice(reqId, btn);
              };
            }
          } else {
            devicesListEl.innerHTML = '<p class="muted">No pending devices found.</p>';
            if (j.output) {
              devicesListEl.innerHTML += '<details style="margin-top: 0.5rem;"><summary style="cursor: pointer;">Show raw output</summary>';
              devicesListEl.innerHTML += '<pre style="margin-top: 0.5rem; background: #f5f5f5; padding: 0.5rem; border-radius: 4px; font-size: 11px; max-height: 200px; overflow-y: auto;">' + j.output + '</pre>';
              devicesListEl.innerHTML += '</details>';
            }
          }
        } else {
          devicesListEl.innerHTML = '<p style="color: #d32f2f;">Error: ' + (j.error || j.output || 'Unknown error') + '</p>';
        }

        if (devicesRefreshBtn) {
          devicesRefreshBtn.disabled = false;
          devicesRefreshBtn.textContent = 'Refresh pending devices';
        }
      })
      .catch(function (e) {
        devicesListEl.innerHTML = '<p style="color: #d32f2f;">Error: ' + String(e) + '</p>';
        if (devicesRefreshBtn) {
          devicesRefreshBtn.disabled = false;
          devicesRefreshBtn.textContent = 'Refresh pending devices';
        }
      });
  }

  function approveDevice(requestId, buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = 'Approving...';

    fetch('/setup/api/devices/approve', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId: requestId })
    })
      .then(function (res) {
        return res.text().then(function (text) {
          return { status: res.status, text: text };
        });
      })
      .then(function (result) {
        var j;
        try {
          j = JSON.parse(result.text);
        } catch (_e) {
          j = { ok: false, error: result.text };
        }

        if (j.ok) {
          // Visual feedback: green background and checkmark
          var deviceEl = document.getElementById('device-' + requestId);
          if (deviceEl) {
            deviceEl.style.background = '#4caf50';
            deviceEl.style.color = '#fff';
          }
          buttonEl.textContent = 'Approved ✓';
          buttonEl.disabled = true;
        } else {
          buttonEl.textContent = 'Failed';
          buttonEl.disabled = false;
          alert('Approval failed: ' + (j.error || j.output || 'Unknown error'));
        }
      })
      .catch(function (e) {
        buttonEl.textContent = 'Error';
        buttonEl.disabled = false;
        alert('Error: ' + String(e));
      });
  }

  if (devicesRefreshBtn) {
    devicesRefreshBtn.onclick = refreshDevices;
  }

  // ========== BACKUP IMPORT ==========
  var importFileEl = document.getElementById('importFile');
  var importButtonEl = document.getElementById('importButton');
  var importOutputEl = document.getElementById('importOutput');

  function importBackup() {
    var file = importFileEl.files[0];
    
    if (!file) {
      importOutputEl.textContent = 'Error: Please select a file';
      return;
    }

    // Validate file type
    var fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.tar.gz') && !fileName.endsWith('.tgz')) {
      importOutputEl.textContent = 'Error: File must be a .tar.gz or .tgz archive';
      return;
    }

    // Validate file size (1GB max)
    var maxSize = 1024 * 1024 * 1024;
    if (file.size > maxSize) {
      importOutputEl.textContent = 'Error: File size exceeds 1GB limit (got ' + Math.round(file.size / 1024 / 1024) + 'MB)';
      return;
    }

    // Confirmation dialog
    var confirmMsg = 'Import backup from "' + file.name + '"?\n\n' +
                     'This will:\n' +
                     '- Stop the gateway\n' +
                     '- Overwrite existing config and workspace\n' +
                     '- Restart the gateway\n' +
                     '- Reload this page\n\n' +
                     'Are you sure?';
    
    if (!confirm(confirmMsg)) {
      importOutputEl.textContent = 'Import cancelled';
      return;
    }

    // Disable button and show progress
    importButtonEl.disabled = true;
    importButtonEl.textContent = 'Importing...';
    importOutputEl.textContent = 'Uploading ' + file.name + ' (' + Math.round(file.size / 1024 / 1024) + 'MB)...\n';

    // Upload file
    fetch('/setup/import', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/gzip'
      },
      body: file
    })
      .then(function (res) {
        return res.text().then(function (text) {
          return { status: res.status, text: text };
        });
      })
      .then(function (result) {
        var j;
        try {
          j = JSON.parse(result.text);
        } catch (_e) {
          j = { ok: false, error: result.text };
        }

        if (j.ok) {
          importOutputEl.textContent = 'Success: ' + (j.message || 'Import completed') + '\n\nReloading page in 2 seconds...';
          
          // Reload page after successful import to show fresh state
          setTimeout(function () {
            window.location.reload();
          }, 2000);
        } else {
          importOutputEl.textContent = 'Error: ' + (j.error || 'Import failed');
          importButtonEl.disabled = false;
          importButtonEl.textContent = 'Import backup';
        }
      })
      .catch(function (e) {
        importOutputEl.textContent = 'Error: ' + String(e);
        importButtonEl.disabled = false;
        importButtonEl.textContent = 'Import backup';
      });
  }

  if (importButtonEl) {
    importButtonEl.onclick = importBackup;
  }

  // Load auth groups immediately (fast endpoint)
  loadAuthGroups();
  
  // Load status (slower, but needed for version info)
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
