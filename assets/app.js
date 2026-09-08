/**
 * R862 原型：侧边栏 + 单页内多页面切换（SPA 路由）
 * 用法：<script src="assets/app.js" data-page="list"></script>
 * data-page 取值：list / refund / payment / withdraw
 *
 * 切换时不整页刷新，只替换 #appContent 内的主体内容，
 * 并把目标页面（index.html / refund.html / ...）的样式与脚本一起载入执行。
 */
(function () {
  var PAGES = {
    maintain: { icon: '\u{1F6E0}', text: 'GD-付款账号维护', href: 'maintain.html', tab: '付款账号维护' },
    list:     { icon: '\u{1F4B3}', text: 'GD-付款账户列表', href: 'index.html',   tab: '付款账户列表' },
    refund:   { icon: '↩️',        text: 'GD-客户退款',     href: 'refund.html',  tab: '客户退款-新增' },
    payment:  { icon: '\u{1F4B0}', text: 'GCF-Payment',     href: 'payment.html', tab: 'GCF-Payment' },
    withdraw: { icon: '\u{1F3E7}', text: 'GCF-Withdraw',    href: 'withdraw.html', tab: 'GCF-Withdraw' },
    fps:      { icon: '\u{1F4B8}', text: 'FPS-应付结算',    href: 'fps.html',     tab: 'FPS-应付结算' }
  };
  var ORDER = ['maintain', 'list', 'refund', 'payment', 'withdraw', 'fps'];

  var script = document.currentScript || document.querySelector('script[data-page]');
  var homeKey = script ? (script.getAttribute('data-page') || 'list') : 'list';
  if (!PAGES[homeKey]) homeKey = 'list';

  var sider = document.getElementById('sider');
  var headerEl = document.getElementById('appHeader');
  var tabsEl = document.getElementById('appTabs');
  var contentEl = document.getElementById('appContent');

  /* ---------- 渲染侧边栏 ---------- */
  sider.innerHTML =
    '<div class="sider-logo">' +
      '<span class="logo-text">R862产品原型</span>' +
      '<button class="collapse-btn" id="collapseBtn" title="收起/展开菜单"></button>' +
    '</div>' +
    '<ul class="sider-menu">' +
      ORDER.map(function (k) {
        return '<li class="menu-item" data-key="' + k + '" data-href="' + PAGES[k].href + '" title="' + PAGES[k].text + '">' +
               '<i class="mi-icon">' + PAGES[k].icon + '</i><span class="mi-text">' + PAGES[k].text + '</span></li>';
      }).join('') +
    '</ul>';

  /* ---------- 折叠 / 展开（状态记忆） ---------- */
  var btn = document.getElementById('collapseBtn');
  function applyCollapse(collapsed) {
    sider.classList.toggle('collapsed', collapsed);
    btn.textContent = collapsed ? '▶' : '◀';
    btn.title = collapsed ? '展开菜单' : '收起菜单';
  }
  try { applyCollapse(localStorage.getItem('siderCollapsed') === '1'); }
  catch (e) { applyCollapse(false); }
  btn.addEventListener('click', function () {
    var collapsed = !sider.classList.contains('collapsed');
    applyCollapse(collapsed);
    try { localStorage.setItem('siderCollapsed', collapsed ? '1' : '0'); } catch (e) {}
  });

  /* ---------- 缓存当前页面自带的内容，避免重复请求 ---------- */
  var inlineCache = {};
  if (contentEl) {
    var first = contentEl.querySelector('.page');
    if (first) {
      inlineCache[homeKey] = { html: first.outerHTML, styles: collectLocalStyles(), scripts: collectLocalScripts() };
    }
  }

  function collectLocalStyles() {
    return Array.prototype.map.call(document.querySelectorAll('style'), function (s) { return s.textContent; }).join('\n');
  }
  function collectLocalScripts() {
    return Array.prototype.filter.call(document.querySelectorAll('script'), function (s) {
      return !s.src && s.getAttribute('data-page') === null;
    }).map(function (s) { return s.textContent; });
  }

  var pageStyleEl = document.createElement('style');
  pageStyleEl.id = 'pageStyle';
  document.head.appendChild(pageStyleEl);

  /* ---------- 表格列宽拖拽 ---------- */
  function enhanceTables(root) {
    var tables = (root || document).querySelectorAll('table');
    Array.prototype.forEach.call(tables, function (table) {
      if (table.getAttribute('data-resizable') === '1') return;
      table.setAttribute('data-resizable', '1');
      table.style.tableLayout = 'fixed';

      var cols = table.querySelectorAll('colgroup col');

      Array.prototype.forEach.call(table.querySelectorAll('thead th'), function (th, idx) {
        if (th.querySelector('.col-resizer')) return;

        var handle = document.createElement('span');
        handle.className = 'col-resizer';
        handle.title = '拖拽调整列宽，双击恢复默认';
        th.appendChild(handle);

        var startX = 0, startW = 0, dragging = false;

        handle.addEventListener('mousedown', function (e) {
          dragging = true;
          startX = e.clientX;
          startW = th.getBoundingClientRect().width;
          handle.classList.add('dragging');
          document.body.classList.add('col-resizing');
          e.preventDefault();
          e.stopPropagation();
        });

        handle.addEventListener('dblclick', function (e) {
          th.style.width = '';
          if (cols[idx]) cols[idx].style.width = '';
          e.stopPropagation();
        });

        document.addEventListener('mousemove', function (e) {
          if (!dragging) return;
          var w = Math.max(48, Math.round(startW + (e.clientX - startX)));
          th.style.width = w + 'px';
          if (cols[idx]) cols[idx].style.width = w + 'px';
        });

        document.addEventListener('mouseup', function () {
          if (!dragging) return;
          dragging = false;
          handle.classList.remove('dragging');
          document.body.classList.remove('col-resizing');
        });
      });
    });
  }

  /* ---------- 解析目标页面 ---------- */
  function parsePage(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var page = doc.querySelector('#appContent .page') || doc.querySelector('.page');
    var styles = Array.prototype.map.call(doc.querySelectorAll('style'), function (s) { return s.textContent; }).join('\n');
    var scripts = Array.prototype.filter.call(doc.querySelectorAll('script'), function (s) {
      return !s.src && s.getAttribute('data-page') === null;
    }).map(function (s) { return s.textContent; });
    /* .page 之外的弹窗（.modal-mask）也一并注入，保证单页切换后弹窗可用 */
    var extras = Array.prototype.map.call(doc.querySelectorAll('.modal-mask'), function (m) {
      return m.outerHTML;
    }).join('');
    return { html: (page ? page.outerHTML : '') + extras, styles: styles, scripts: scripts };
  }

  /* ---------- 渲染到主区域 ---------- */
  function render(key, data, execScripts) {
    /* 更新菜单高亮 */
    Array.prototype.forEach.call(document.querySelectorAll('.menu-item'), function (li) {
      li.classList.toggle('active', li.getAttribute('data-key') === key);
    });

    /* 更新头部与页签 */
    var p = PAGES[key];
    if (headerEl) headerEl.innerHTML = '<span class="header-title">' + p.text + '</span>';
    if (tabsEl) {
      tabsEl.innerHTML =
        '<span class="tab" data-href="' + PAGES.list.href + '">首页</span>' +
        '<span class="tab active">' + p.tab + ' <span style="color:#999;">×</span></span>';
      var homeTab = tabsEl.querySelector('.tab[data-href]');
      if (homeTab) homeTab.addEventListener('click', function () { go('list'); });
    }

    /* 注入样式与内容 */
    pageStyleEl.textContent = data.styles || '';
    contentEl.innerHTML = data.html || '';

    /* 为表格加上列宽拖拽 */
    enhanceTables(contentEl);

    /* 执行页面脚本（首屏脚本已被浏览器执行过，跳过） */
    if (execScripts !== false) {
      (data.scripts || []).forEach(function (code) {
        var s = document.createElement('script');
        s.textContent = code;
        document.body.appendChild(s);
      });
    }
  }

  /* ---------- 路由 ---------- */
  var currentKey = null;

  function go(key, pushHash) {
    if (!PAGES[key]) key = 'list';
    if (key === currentKey) return;
    if (pushHash !== false) {
      var target = '#/' + key;
      if (location.hash !== target) {
        location.hash = target;   /* 触发 hashchange -> 由 route() 真正执行 */
        return;
      }
    }
    currentKey = key;

    if (inlineCache[key]) { render(key, inlineCache[key]); return; }

    fetch(PAGES[key].href, { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var data = parsePage(html);
        inlineCache[key] = data;          /* 缓存，二次切换无需再请求 */
        if (currentKey === key) render(key, data);
      })
      .catch(function () {
        /* file:// 等无法 fetch 的场景，退回整页跳转 */
        location.href = PAGES[key].href;
      });
  }

  /* 菜单点击 */
  Array.prototype.forEach.call(document.querySelectorAll('.menu-item'), function (li) {
    li.addEventListener('click', function () {
      go(li.getAttribute('data-key'));
    });
  });

  /* 浏览器前进/后退 */
  window.addEventListener('hashchange', function () {
    currentKey = null;
    var m = (location.hash || '').match(/^#\/(\w+)/);
    go(m && PAGES[m[1]] ? m[1] : homeKey, false);
  });

  /* 首次进入 */
  var m0 = (location.hash || '').match(/^#\/(\w+)/);
  var startKey = m0 && PAGES[m0[1]] ? m0[1] : homeKey;
  if (startKey === homeKey) {
    currentKey = homeKey;
    render(homeKey, inlineCache[homeKey] || { html: '', styles: '', scripts: [] }, false);
  } else {
    go(startKey, false);
  }
})();
