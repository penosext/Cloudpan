// 主题切换
function toggleTheme() {
  const current = document.body.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

function initTheme() {
  const saved = localStorage.getItem('theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.body.setAttribute('data-theme', saved);
}

// 滚动监听
function initScroll() {
  const themeBtn = document.getElementById('theme-toggle');
  const topBtn = document.getElementById('back-to-top');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const show = window.scrollY > 300;
        themeBtn.classList.toggle('hidden', show);
        topBtn.classList.toggle('show', show);
        ticking = false;
      });
      ticking = true;
    }
  });
}

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

// GitHub 统计 - 统计第一个仓库的数据
async function fetchGitHubStats() {
  try {
    let repoList = [];
    try {
      const res = await fetch('https://raw.githubusercontent.com/penosext/Cloudpan/main/repos.txt');
      if (res.ok) {
        const text = await res.text();
        repoList = text.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
      }
    } catch {}
    if (!repoList.length) repoList = ['penosext/Cloudpan'];
    
    const res = await fetch(`https://api.github.com/repos/${repoList[0]}`);
    const data = await res.json();
    document.getElementById('github-stars').textContent = data.stargazers_count;
    document.getElementById('github-forks').textContent = data.forks_count;
    document.getElementById('user-count').textContent = data.stargazers_count;
  } catch { ['github-stars','github-forks','user-count'].forEach(id => document.getElementById(id).textContent = 'N/A'); }
}

// 公告
async function fetchAnnouncement() {
  const div = document.getElementById('announcement-content');
  try {
    div.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';
    const res = await fetch('https://raw.githubusercontent.com/penosext/Cloudpan/main/notice.md');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const date = res.headers.get('last-modified');
    div.innerHTML = `<div class="announcement-content">${marked.parse(text || '暂无公告')}${date ? `<div class="announcement-meta"><i class="far fa-clock"></i> 更新: ${new Date(date).toLocaleDateString('zh-CN')}</div>` : ''}</div>`;
  } catch (e) {
    div.innerHTML = `<div style="text-align:center;padding:24px;color:var(--error)"><i class="fas fa-exclamation-triangle"></i> ${e.message}<br><button onclick="fetchAnnouncement()" class="btn-refresh" style="margin-top:8px">重试</button></div>`;
  }
}

// 文件发布 - 多仓库支持
let allReleases = [];
let REPOS = [];

async function fetchRepoList() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/penosext/Cloudpan/main/repo');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    REPOS = text.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
    if (!REPOS.length) throw new Error('仓库列表为空');
  } catch (e) {
    showToast('仓库列表加载失败，使用默认仓库: ' + e.message, 'warning');
    REPOS = ['penosext/Cloudpan'];
  }
}

async function fetchReleases() {
  try {
    // 先获取仓库列表
    await fetchRepoList();
    
    allReleases = [];
    document.getElementById('releases').innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';
    
    const promises = REPOS.map(repo =>
      fetch(`https://api.github.com/repos/${repo}/releases`)
        .then(res => {
          if (!res.ok) throw new Error(`${repo}: HTTP ${res.status}`);
          return res.json();
        })
        .catch(err => {
          console.warn(`加载仓库 ${repo} 失败:`, err.message);
          return [];
        })
    );
    
    const results = await Promise.all(promises);
    allReleases = results.flat();
    
    // 按发布日期排序（最新的在前）
    allReleases.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    
    document.getElementById('release-count').textContent = allReleases.length;
    document.getElementById('file-count').textContent = allReleases.reduce((a, r) => a + r.assets.length, 0);
    renderReleases(allReleases);
    
    if (allReleases.length === 0) {
      showToast('所有仓库均无可用文件', 'warning');
    }
  } catch (e) { 
    showToast('文件加载失败: ' + e.message, 'error'); 
  }
}

function renderReleases(releases, term = '') {
  const container = document.getElementById('releases');
  if (!releases.length && !term) { 
    container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>暂无文件</p></div>'; 
    return; 
  }
  container.innerHTML = releases.map(r => `
    <div class="release-item">
      <div class="release-header">
        <div class="release-name"><i class="fas fa-tag"></i> ${esc(r.name || r.tag_name)}</div>
        <div class="release-date"><i class="far fa-calendar-alt"></i> ${new Date(r.published_at).toLocaleDateString('zh-CN')}</div>
      </div>
      <div class="assets-list">${r.assets.map(a => {
        let name = esc(a.name);
        if (term) name = name.replace(new RegExp(`(${escRe(term)})`, 'gi'), '<span class="highlight">$1</span>');
        return `<div class="asset-item"><div class="file-info"><div class="file-name"><i class="fas fa-file"></i> ${name}</div><div class="file-size"><i class="fas fa-database"></i> ${fmtSize(a.size)}</div></div><div class="file-actions"><a href="${a.browser_download_url}" class="btn-download btn-download-normal" target="_blank"><i class="fas fa-download"></i> 普通</a><a href="${proxy(a.browser_download_url)}" class="btn-download btn-download-fast" target="_blank"><i class="fas fa-bolt"></i> 高速</a></div></div>`;
      }).join('')}</div>
      <button class="btn-toggle-assets" onclick="toggleAssets(this)"><i class="fas fa-layer-group"></i> 展开 (${r.assets.length})</button>
    </div>`).join('');
}

function toggleAssets(btn) {
  const list = btn.previousElementSibling;
  list.classList.toggle('show');
  const n = list.querySelectorAll('.asset-item').length;
  btn.innerHTML = list.classList.contains('show') ? `<i class="fas fa-layer-group"></i> 收起 (${n})` : `<i class="fas fa-layer-group"></i> 展开 (${n})`;
}

// 搜索
function initSearch() {
  document.getElementById('file-search').addEventListener('input', debounce(function() {
    const term = this.value.trim().toLowerCase();
    const info = document.getElementById('search-results-info');
    const noRes = document.getElementById('no-results');
    if (!term) { info.classList.remove('show'); noRes.classList.remove('show'); renderReleases(allReleases); return; }
    info.classList.add('show');
    let count = 0;
    const filtered = allReleases.map(r => {
      const assets = r.assets.filter(a => a.name.toLowerCase().includes(term));
      count += assets.length;
      return { ...r, assets };
    }).filter(r => r.assets.length);
    document.getElementById('search-count').textContent = `找到 ${count} 个结果`;
    renderReleases(filtered, term);
    noRes.classList.toggle('show', !count);
  }, 300));
}

function clearSearch() {
  document.getElementById('file-search').value = '';
  document.getElementById('search-results-info').classList.remove('show');
  document.getElementById('no-results').classList.remove('show');
  renderReleases(allReleases);
}

// 讨论区
async function fetchDiscussions() {
  try {
    const issues = await (await fetch('https://api.github.com/repos/penosext/Cloudpan/issues')).json();
    document.getElementById('discussions').innerHTML = issues.map(i => `
      <div class="discussion-item">
        <div class="discussion-header"><img src="${i.user.avatar_url}" class="avatar" alt=""><div><div class="discussion-author">${i.user.login}</div><div class="discussion-date">${new Date(i.created_at).toLocaleString('zh-CN')}</div></div></div>
        <div class="discussion-title"><i class="fas fa-comment-dots"></i> ${esc(i.title)}</div>
        <div class="comment-markdown">${marked.parse(i.body || '')}</div>
        <button class="btn-load-comments" onclick="loadComments(this,${i.number})"><i class="fas fa-comments"></i> 评论 (${i.comments})</button>
        <div class="comments-container"></div>
      </div>`).join('');
  } catch { showToast('加载讨论失败', 'error'); }
}

async function loadComments(btn, num) {
  const container = btn.nextElementSibling;
  if (container.children.length) { container.classList.toggle('show'); return; }
  try {
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';
    const comments = await (await fetch(`https://api.github.com/repos/penosext/Cloudpan/issues/${num}/comments`)).json();
    container.innerHTML = comments.map(c => `
      <div class="comment-item"><img src="${c.user.avatar_url}" class="avatar" alt=""><div><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span class="discussion-author">${c.user.login}</span><span class="discussion-date">${new Date(c.created_at).toLocaleString('zh-CN')}</span></div><div class="comment-markdown">${marked.parse(c.body || '')}</div></div></div>`).join('');
    btn.innerHTML = `<i class="fas fa-comments"></i> 隐藏 (${comments.length})`;
    container.classList.add('show');
  } catch { container.innerHTML = '<div style="text-align:center;color:var(--error);padding:16px">加载失败</div>'; }
  finally { btn.disabled = false; }
}

function createNewIssue() {
  const title = document.getElementById('issueTitle'), body = document.getElementById('issueBody');
  if (!title.value.trim()) { title.style.borderColor = 'var(--error)'; title.focus(); showToast('请填写标题', 'error'); setTimeout(() => title.style.borderColor = '', 2000); return; }
  window.open(`https://github.com/penosext/Cloudpan/issues/new?${new URLSearchParams({ title: title.value.trim(), body: body.value.trim(), labels: 'user-generated' })}`, '_blank');
  title.value = body.value = '';
  showToast('讨论创建成功！请在GitHub完成提交');
}

// 工具函数
const esc = s => (''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const proxy = u => `https://ghproxy.net/${encodeURI(u)}`;
const fmtSize = b => { if(!b) return '0 Bytes'; const u = ['Bytes','KB','MB','GB'], e = Math.floor(Math.log(b)/Math.log(1024)); return (b/Math.pow(1024,e)).toFixed(2)+' '+u[e]; };
const debounce = (f, w) => { let t; return function(...a) { clearTimeout(t); t = setTimeout(() => f.apply(this, a), w); }; };

function showToast(msg, type = 'success') {
  const old = document.querySelector('.toast'); if (old) old.remove();
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':'exclamation-circle'}"></i> ${esc(msg)}`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 5000);
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initTheme(); initScroll();
  Promise.all([fetchAnnouncement(), fetchReleases(), fetchDiscussions(), fetchGitHubStats()]);
  initSearch();
});
