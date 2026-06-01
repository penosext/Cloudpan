// ===================== 主题切换 =====================
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

// ===================== 滚动监听 =====================
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

function scrollToTop() { 
  window.scrollTo({ top: 0, behavior: 'smooth' }); 
}

// ===================== 快捷导航按钮 =====================
function scrollToDiscussion() {
  const discussionCard = document.querySelector('.discussion-card');
  if (discussionCard) {
    discussionCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function focusSearch() {
  const searchInput = document.getElementById('file-search');
  const fileSidebar = document.querySelector('.file-sidebar');
  if (fileSidebar) {
    fileSidebar.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  setTimeout(() => {
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }, 400);
}

// ===================== GitHub Token 配置 =====================
function setGithubToken() {
  const currentToken = localStorage.getItem('github_token');
  const msg = currentToken 
    ? `当前已配置 Token: ${currentToken.substring(0, 8)}...\n\n输入新 Token 替换，或点取消保留：`
    : '请输入 GitHub Personal Access Token（需要 repo 权限）：\n\n获取方式：\nGitHub Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token\n\n勾选 public_repo 权限即可';
  const token = prompt(msg);
  if (token === null) return; // 用户点取消
  if (token.trim()) {
    localStorage.setItem('github_token', token.trim());
    showToast('✅ Token 已保存，现在可以直接回复评论了！', 'success');
  } else if (currentToken) {
    // 用户清空了输入，删除 token
    localStorage.removeItem('github_token');
    showToast('Token 已清除', 'info');
  }
}

// ===================== GitHub 统计 =====================
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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    document.getElementById('github-stars').textContent = data.stargazers_count;
    document.getElementById('github-forks').textContent = data.forks_count;
    document.getElementById('user-count').textContent = data.stargazers_count;
  } catch { 
    ['github-stars','github-forks','user-count'].forEach(id => document.getElementById(id).textContent = 'N/A'); 
  }
}

// ===================== 公告 =====================
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

// ===================== 文件发布 - 多仓库支持 =====================
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
    showToast('仓库列表加载失败，使用默认仓库', 'warning');
    REPOS = ['penosext/Cloudpan'];
  }
}

async function fetchReleases() {
  try {
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

// ===================== 搜索 =====================
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

// ===================== 讨论区 =====================
async function fetchDiscussions() {
  try {
    const issues = await (await fetch('https://api.github.com/repos/penosext/Cloudpan/issues')).json();
    document.getElementById('discussions').innerHTML = issues.map(i => {
      const safeUser = esc(i.user.login).replace(/'/g, "\\'");
      const safeBody = esc((i.body || '').substring(0, 200)).replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/`/g, '\\`');
      return `
      <div class="discussion-item">
        <div class="discussion-header"><img src="${i.user.avatar_url}" class="avatar" alt=""><div><div class="discussion-author">${i.user.login}</div><div class="discussion-date">${new Date(i.created_at).toLocaleString('zh-CN')}</div></div></div>
        <div class="discussion-title"><i class="fas fa-comment-dots"></i> ${esc(i.title)}</div>
        <div class="comment-markdown">${marked.parse(i.body || '')}</div>
        <div style="display:flex;gap:var(--spacing-sm);flex-wrap:wrap;">
          <button class="btn-load-comments" onclick="loadComments(this,${i.number})"><i class="fas fa-comments"></i> 评论 (${i.comments})</button>
          <button class="btn-reply" onclick="openReplyModal(${i.number}, '${safeUser}', '${safeBody}')"><i class="fas fa-reply"></i> 回复楼主</button>
        </div>
        <div class="comments-container"></div>
      </div>`;
    }).join('');
  } catch { 
    showToast('加载讨论失败', 'error'); 
  }
}

async function loadComments(btn, num) {
  const discussionItem = btn.closest('.discussion-item');
  const container = discussionItem.querySelector('.comments-container');
  
  if (container.children.length) { 
    container.classList.toggle('show'); 
    return; 
  }
  
  try {
    btn.disabled = true; 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';
    const comments = await (await fetch(`https://api.github.com/repos/penosext/Cloudpan/issues/${num}/comments`)).json();
    container.innerHTML = comments.map(c => {
      const safeUser = esc(c.user.login).replace(/'/g, "\\'");
      const safeBody = esc((c.body || '').substring(0, 200)).replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/`/g, '\\`');
      return `
      <div class="comment-item">
        <img src="${c.user.avatar_url}" class="avatar" alt="">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
            <span class="discussion-author">${c.user.login}</span>
            <span class="discussion-date">${new Date(c.created_at).toLocaleString('zh-CN')}</span>
          </div>
          <div class="comment-markdown">${marked.parse(c.body || '')}</div>
          <button class="btn-reply" onclick="openReplyModal(${num}, '${safeUser}', '${safeBody}')"><i class="fas fa-reply"></i> 回复</button>
        </div>
      </div>`;
    }).join('');
    if (comments.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--on-surface-variant);">暂无评论，快来参与讨论吧</div>';
    }
    btn.innerHTML = `<i class="fas fa-comments"></i> 隐藏 (${comments.length})`;
    container.classList.add('show');
  } catch { 
    container.innerHTML = '<div style="text-align:center;color:var(--error);padding:16px">加载失败</div>'; 
  } finally { 
    btn.disabled = false; 
  }
}

// ===================== 创建议题 =====================
function createNewIssue() {
  const titleEl = document.getElementById('issueTitle');
  const bodyEl = document.getElementById('issueBody');
  const title = titleEl.value.trim();
  const body = bodyEl.value.trim();
  
  if (!title) { 
    titleEl.style.borderColor = 'var(--error)'; 
    titleEl.focus(); 
    showToast('请填写标题', 'error'); 
    setTimeout(() => titleEl.style.borderColor = '', 2000); 
    return; 
  }
  
  const params = new URLSearchParams();
  params.set('title', title);
  if (body) params.set('body', body);
  params.set('labels', 'user-generated');
  
  window.open('https://github.com/penosext/Cloudpan/issues/new?' + params.toString(), '_blank');
  
  titleEl.value = '';
  bodyEl.value = '';
  showToast('已跳转到 GitHub，请点击 Submit new issue 完成提交', 'info');
}

// ===================== 回复功能 =====================
let replyTarget = { issueNumber: null, replyToUser: null };

function openReplyModal(issueNumber, commentUser, commentBody) {
  replyTarget.issueNumber = issueNumber;
  replyTarget.replyToUser = commentUser;
  document.getElementById('reply-context').innerHTML = `
    <div style="font-weight:500;margin-bottom:4px;display:flex;align-items:center;gap:8px;"><i class="fas fa-reply"></i> 回复 @${esc(commentUser)}</div>
    <div style="opacity:.8;font-size:.85rem;">${marked.parse(commentBody || '（无内容）')}</div>
  `;
  document.getElementById('replyBody').value = `@${commentUser} `;
  document.getElementById('reply-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('replyBody').focus(), 100);
}

function closeReplyModal() {
  document.getElementById('reply-modal').style.display = 'none';
  replyTarget = { issueNumber: null, replyToUser: null };
}

async function submitReply() {
  const body = document.getElementById('replyBody').value.trim();
  if (!body) {
    showToast('请输入回复内容', 'error');
    return;
  }
  const btn = document.getElementById('btn-submit-reply');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';
  
  try {
    const token = localStorage.getItem('github_token');
    if (token) {
      // 有 Token：直接通过 API 提交
      const res = await fetch(`https://api.github.com/repos/penosext/Cloudpan/issues/${replyTarget.issueNumber}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({ body: body })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }
      showToast('✅ 回复成功！', 'success');
      closeReplyModal();
      await fetchDiscussions();
    } else {
      // 无 Token：复制到剪贴板 + 跳转
      try {
        await navigator.clipboard.writeText(body);
        showToast('📋 回复内容已复制，请在 GitHub 页面粘贴提交', 'info');
      } catch {
        showToast('已跳转到 GitHub，请手动粘贴回复内容', 'info');
      }
      closeReplyModal();
      setTimeout(() => {
        window.open(`https://github.com/penosext/Cloudpan/issues/${replyTarget.issueNumber}`, '_blank');
      }, 400);
    }
  } catch (e) {
    showToast('回复失败: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> 提交回复';
  }
}

// 点击弹窗遮罩关闭
document.addEventListener('click', function(e) {
  if (e.target.id === 'reply-modal') {
    closeReplyModal();
  }
});

// ESC 关闭弹窗
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && document.getElementById('reply-modal').style.display === 'flex') {
    closeReplyModal();
  }
});

// ===================== 工具函数 =====================
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const proxy = u => `https://ghproxy.net/${encodeURI(u)}`;
const fmtSize = b => { if(!b) return '0 Bytes'; const u = ['Bytes','KB','MB','GB']; const e = Math.floor(Math.log(b)/Math.log(1024)); return (b/Math.pow(1024,e)).toFixed(2)+' '+u[e]; };
const debounce = (f, w) => { let t; return function(...a) { clearTimeout(t); t = setTimeout(() => f.apply(this, a), w); }; };

function showToast(msg, type = 'success') {
  const old = document.querySelector('.toast'); if (old) old.remove();
  const icons = {
    success: 'check-circle',
    error: 'exclamation-circle',
    warning: 'exclamation-triangle',
    info: 'info-circle'
  };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="fas fa-${icons[type] || icons.success}"></i> ${esc(msg)}`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 5000);
}

// ===================== 初始化 =====================
document.addEventListener('DOMContentLoaded', () => {
  initTheme(); 
  initScroll();
  Promise.all([fetchAnnouncement(), fetchReleases(), fetchDiscussions(), fetchGitHubStats()]);
  initSearch();
});
