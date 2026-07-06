/* ===== Share shows: pick a list -> preview -> copy (email/text) or print =====
 * Injected verbatim into app.html by build.js. Relies on globals: favs, SHARE_DATA.
 * SHARE_DATA[favId] = { a:artist, w:[supporting], v:venue, vc:venueCity, c:market,
 *                       d:isoDate, dl:dateLabel, p:priceStr, u:ticketUrl, cat:category }
 */
(function () {
  var SHARE_CAP = 200;
  var shareState = { source: 'fav', format: 'email', excluded: {}, truncated: 0 };

  function shEsc(t) {
    return (t == null ? '' : String(t)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function shAttr(u) {
    return String(u == null ? '' : u).replace(/"/g, '%22');
  }
  function shareLoc(e) {
    return e.v + (e.vc ? ', ' + e.vc : '');
  }

  function shareGather() {
    var ids = [],
      seen = {};
    if (shareState.source === 'fav') {
      for (var id in favs) {
        if (favs[id] && SHARE_DATA[id] && !seen[id]) {
          seen[id] = 1;
          ids.push(id);
        }
      }
    } else {
      var cards = document.querySelectorAll('#view-city-content .event-card');
      for (var i = 0; i < cards.length; i++) {
        var el = cards[i];
        if (el.style.display === 'none') continue;
        var fid = el.getAttribute('data-fav-id');
        if (fid && SHARE_DATA[fid] && !seen[fid]) {
          seen[fid] = 1;
          ids.push(fid);
        }
      }
    }
    ids.sort(function (a, b) {
      return (SHARE_DATA[a].d || '').localeCompare(SHARE_DATA[b].d || '');
    });
    shareState.truncated = 0;
    if (ids.length > SHARE_CAP) {
      shareState.truncated = ids.length;
      ids = ids.slice(0, SHARE_CAP);
    }
    return ids;
  }
  function shareIncluded() {
    return shareGather().filter(function (id) {
      return !shareState.excluded[id];
    });
  }

  function buildShareText(ids) {
    var blocks = ids.map(function (id) {
      var e = SHARE_DATA[id];
      var s = e.a + (e.w && e.w.length ? ' w/ ' + e.w.join(', ') : '');
      s += '\n' + shareLoc(e) + ' · ' + e.dl;
      if (e.p) s += '\n' + e.p;
      if (e.u) s += '\n' + e.u;
      return s;
    });
    return "Shows I'm looking at:\n\n" + blocks.join('\n\n');
  }
  function buildShareEmail(ids) {
    var rows = ids
      .map(function (id) {
        var e = SHARE_DATA[id];
        var supp =
          e.w && e.w.length ? '<div style="font-size:13px;color:#666">w/ ' + shEsc(e.w.join(', ')) + '</div>' : '';
        var price = e.p ? ' &middot; ' + shEsc(e.p) : '';
        var link = e.u
          ? '<a href="' +
            shAttr(e.u) +
            '" style="font-size:14px;color:#ed1b2e;font-weight:700;text-decoration:none">Get tickets &rarr;</a>'
          : '';
        return (
          '<tr><td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-family:Arial,Helvetica,sans-serif">' +
          '<div style="font-size:16px;font-weight:700;color:#111">' +
          shEsc(e.a) +
          '</div>' +
          supp +
          '<div style="font-size:14px;color:#555;margin:2px 0">' +
          shEsc(shareLoc(e)) +
          ' &middot; ' +
          shEsc(e.dl) +
          price +
          '</div>' +
          link +
          '</td></tr>'
        );
      })
      .join('');
    return (
      '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px">' +
      '<div style="font-size:18px;font-weight:800;color:#111;margin-bottom:6px">Shows I\'m looking at</div>' +
      '<table style="width:100%;border-collapse:collapse">' +
      rows +
      '</table>' +
      '<div style="font-size:12px;color:#999;margin-top:10px">' +
      ids.length +
      ' show' +
      (ids.length !== 1 ? 's' : '') +
      '</div></div>'
    );
  }

  function renderShare() {
    document.getElementById('sh-src-fav').className = shareState.source === 'fav' ? 'on' : '';
    document.getElementById('sh-src-shown').className = shareState.source === 'shown' ? 'on' : '';
    document.getElementById('sh-fmt-email').className = shareState.format === 'email' ? 'on' : '';
    document.getElementById('sh-fmt-text').className = shareState.format === 'text' ? 'on' : '';

    var all = shareGather();
    var inc = all.filter(function (id) {
      return !shareState.excluded[id];
    });
    var listEl = document.getElementById('sh-list');

    if (all.length === 0) {
      listEl.innerHTML =
        '<div class="sh-empty">' +
        (shareState.source === 'fav'
          ? 'No favorites yet. Tap the &#9734; star on shows you like, then open Share again.'
          : 'Nothing is showing. Use the filters up top (city, month, category), then open Share again.') +
        '</div>';
    } else {
      listEl.innerHTML = all
        .map(function (id) {
          var e = SHARE_DATA[id];
          var off = shareState.excluded[id] ? ' off' : '';
          return (
            '<label class="sh-item' +
            off +
            '"><input type="checkbox" ' +
            (shareState.excluded[id] ? '' : 'checked') +
            ' onchange="shToggleItem(\'' +
            id +
            '\')"><span><span class="sh-a">' +
            shEsc(e.a) +
            '</span><br><span class="sh-d">' +
            shEsc(shareLoc(e)) +
            ' · ' +
            shEsc(e.dl) +
            '</span></span></label>'
          );
        })
        .join('');
    }

    var countTxt = inc.length + ' of ' + all.length + ' selected';
    if (shareState.truncated)
      countTxt += ' · showing first ' + all.length + ' of ' + shareState.truncated + ' (narrow with filters)';
    document.getElementById('sh-count').textContent = countTxt;

    var note = document.getElementById('sh-note');
    var prev = document.getElementById('sh-preview');
    if (inc.length === 0) {
      note.textContent = '';
      prev.className = 'sh-preview';
      prev.innerHTML = '<div class="sh-empty">Nothing selected.</div>';
    } else if (shareState.format === 'email') {
      note.textContent = 'Rich version. Paste into Gmail, Outlook, or Apple Mail and the links stay clickable.';
      prev.className = 'sh-preview';
      prev.innerHTML = buildShareEmail(inc);
    } else {
      note.textContent = 'Plain version. Paste into a text or iMessage and each web address becomes a tap link.';
      prev.className = 'sh-preview text';
      prev.textContent = buildShareText(inc);
    }
  }

  window.openShare = function () {
    shareState.excluded = {};
    shareState.source = (function () {
      for (var k in favs) {
        if (favs[k]) return 'fav';
      }
      return 'shown';
    })();
    shareState.format = 'email';
    renderShare();
    document.getElementById('share-modal').classList.add('active');
    document.getElementById('share-modal-content').style.display = 'flex';
    document.body.classList.add('modal-open');
  };
  window.closeShare = function () {
    document.getElementById('share-modal').classList.remove('active');
    document.getElementById('share-modal-content').style.display = 'none';
    document.body.classList.remove('modal-open');
  };
  window.setShareSource = function (s) {
    shareState.source = s;
    shareState.excluded = {};
    renderShare();
  };
  window.setShareFormat = function (f) {
    shareState.format = f;
    renderShare();
  };
  window.shToggleItem = function (id) {
    if (shareState.excluded[id]) delete shareState.excluded[id];
    else shareState.excluded[id] = 1;
    renderShare();
  };

  window.shareCopy = function () {
    var ids = shareIncluded();
    if (!ids.length) {
      shToast('Nothing selected');
      return;
    }
    var text = buildShareText(ids),
      html = buildShareEmail(ids);
    function done() {
      shToast('Copied. Now paste it.');
    }
    function plain() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {
          shToast('Copy blocked. Open in Chrome or Safari.');
        });
      } else {
        shToast('Copy blocked. Open in Chrome or Safari.');
      }
    }
    if (shareState.format === 'email' && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      try {
        var item = new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        });
        navigator.clipboard.write([item]).then(done, plain);
      } catch (e) {
        plain();
      }
    } else {
      plain();
    }
  };

  window.sharePrint = function () {
    var ids = shareIncluded();
    if (!ids.length) {
      shToast('Nothing selected');
      return;
    }
    var items = ids
      .map(function (id) {
        var e = SHARE_DATA[id];
        var supp = e.w && e.w.length ? ' w/ ' + shEsc(e.w.join(', ')) : '';
        var price = e.p ? ' · ' + shEsc(e.p) : '';
        var link = e.u ? '<a href="' + shAttr(e.u) + '">' + shEsc(e.u) + '</a>' : '';
        return (
          '<div class="sp-item"><div class="sp-a">' +
          shEsc(e.a) +
          supp +
          '</div><div class="sp-d">' +
          shEsc(shareLoc(e)) +
          ' · ' +
          shEsc(e.dl) +
          price +
          '</div>' +
          link +
          '</div>'
        );
      })
      .join('');
    document.getElementById('share-print').innerHTML =
      '<h2>My Shows</h2><div class="sp-meta">' +
      ids.length +
      ' show' +
      (ids.length !== 1 ? 's' : '') +
      ' · 2026 Music &amp; Comedy Shows</div>' +
      items;
    document.body.classList.add('printing-share');
    window.print();
  };
  window.addEventListener('afterprint', function () {
    document.body.classList.remove('printing-share');
  });

  window.shToast = function (msg) {
    var t = document.getElementById('sh-toast');
    if (!t) return;
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(window._shT);
    window._shT = setTimeout(function () {
      t.style.opacity = '0';
    }, 1900);
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.closeShare();
  });
})();
