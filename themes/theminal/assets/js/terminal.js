// Theminal - Terminal Widget & Theme Toggle
(function() {
  'use strict';

  // ============================================
  // SEARCH FUNCTIONALITY
  // ============================================
  let searchIndex = null;
  const searchResults = document.getElementById('search-results');

  async function loadSearchIndex() {
    if (searchIndex) return searchIndex;
    try {
      const response = await fetch(new URL('index.json', document.baseURI).href);
      searchIndex = await response.json();
      return searchIndex;
    } catch (error) {
      console.error('Failed to load search index:', error);
      return [];
    }
  }

  function performSearch(query) {
    if (!searchIndex || !query.trim()) return [];
    const q = query.toLowerCase().trim();
    return searchIndex.filter(item => {
      const titleMatch = item.title && item.title.toLowerCase().includes(q);
      const contentMatch = item.content && item.content.toLowerCase().includes(q);
      const descMatch = item.description && item.description.toLowerCase().includes(q);
      const tagMatch = item.tags && item.tags.some(tag => tag.toLowerCase().includes(q));
      return titleMatch || contentMatch || descMatch || tagMatch;
    });
  }

  function renderSearchResults(results, query) {
    if (!searchResults) return;

    if (results.length === 0) {
      searchResults.innerHTML = `
        <div class="search-header">
          <span class="search-count">0 results</span>
          <span class="search-query">for "${escapeHtml(query)}"</span>
          <button class="search-close" onclick="window.clearSearch()">[x] close</button>
        </div>
        <div class="search-no-results">
          <span class="search-icon">?</span>
          No results found for "<strong>${escapeHtml(query)}</strong>"
        </div>
      `;
    } else {
      searchResults.innerHTML = `
        <div class="search-header">
          <span class="search-count">${results.length} result${results.length === 1 ? '' : 's'}</span>
          <span class="search-query">for "${escapeHtml(query)}"</span>
          <button class="search-close" onclick="window.clearSearch()">[x] close</button>
        </div>
        <div class="search-items">
          ${results.map(item => `
            <a href="${item.url}" class="search-result-item">
              <span class="search-result-title">${highlightMatch(item.title, query)}</span>
              <span class="search-result-date">${item.date || ''}</span>
              ${item.description ? `<span class="search-result-desc">${highlightMatch(item.description, query)}</span>` : ''}
              ${item.tags ? `<span class="search-result-tags">${item.tags.map(t => `<span class="tag">${t}</span>`).join('')}</span>` : ''}
            </a>
          `).join('')}
        </div>
      `;
    }
    searchResults.classList.add('visible');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function highlightMatch(text, query) {
    if (!text || !query) return escapeHtml(text || '');
    const escaped = escapeHtml(text);
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  window.clearSearch = function() {
    if (searchResults) {
      searchResults.classList.remove('visible');
      searchResults.innerHTML = '';
    }
    const input = document.getElementById('terminal-input');
    if (input) input.value = '';
  };

  async function handleSearch(query) {
    await loadSearchIndex();
    const results = performSearch(query);
    renderSearchResults(results, query);
  }

  // ============================================
  // THEME TOGGLE
  // ============================================
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = themeToggle ? themeToggle.querySelector('.theme-icon') : null;

  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }

  function setTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theminal-theme', theme);
    updateThemeIcon(theme);
  }

  function updateThemeIcon(theme) {
    if (themeIcon) {
      // Use @ for dark (like a moon/night), * for light (like a sun/star)
      themeIcon.textContent = theme === 'light' ? '*' : '@';
    }
  }

  function toggleTheme() {
    const current = getCurrentTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
    // Initialize icon based on current theme
    updateThemeIcon(getCurrentTheme());
  }

  // Global keyboard shortcut for theme toggle (works on all pages)
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    if (e.key === 't' || e.key === 'T') {
      toggleTheme();
    }
  });

  // ============================================
  // MINI TERMINAL WIDGET
  // ============================================
  const input = document.getElementById('terminal-input');
  const suggestions = document.getElementById('terminal-suggestions');

  if (!input || !suggestions) return;

  const suggestionItems = suggestions.querySelectorAll('.suggestion-item');
  let selectedIndex = -1;
  let filteredItems = [];

  function filterSuggestions(query) {
    const normalizedQuery = query.toLowerCase().trim();

    filteredItems = [];
    suggestionItems.forEach((item) => {
      const cmd = item.getAttribute('data-cmd').toLowerCase();
      const desc = item.querySelector('.suggestion-desc').textContent.toLowerCase();

      if (normalizedQuery === '' ||
          cmd.includes(normalizedQuery) ||
          desc.includes(normalizedQuery)) {
        item.style.display = 'flex';
        filteredItems.push(item);
      } else {
        item.style.display = 'none';
      }
    });

    selectedIndex = -1;
    updateSelection();
  }

  function updateSelection() {
    filteredItems.forEach((item, index) => {
      if (index === selectedIndex) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  function executeCommand(item, inputValue) {
    const url = item.getAttribute('data-url');
    const isExternal = item.getAttribute('data-external') === 'true';
    const isSearch = item.getAttribute('data-search') === 'true';

    // Special command: /theme - toggle theme
    const cmd = item.getAttribute('data-cmd');
    if (cmd === '/theme') {
      toggleTheme();
      hideSuggestions();
      input.value = '';
      return;
    }

    // Special command: /search - search articles
    if (isSearch && inputValue) {
      const searchQuery = inputValue.replace(/^\/search\s*/i, '').trim();
      if (searchQuery) {
        handleSearch(searchQuery);
        hideSuggestions();
        return;
      }
    }

    if (isExternal) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = url;
    }
  }

  function showSuggestions() {
    suggestions.classList.add('visible');
  }

  function hideSuggestions() {
    suggestions.classList.remove('visible');
  }

  // Event Listeners
  input.addEventListener('focus', function() {
    showSuggestions();
    filterSuggestions(this.value);
  });

  input.addEventListener('blur', function() {
    // Delay hiding to allow click events on suggestions
    setTimeout(hideSuggestions, 150);
  });

  input.addEventListener('input', function() {
    filterSuggestions(this.value);
    showSuggestions();
  });

  input.addEventListener('keydown', function(e) {
    if (!suggestions.classList.contains('visible')) {
      if (e.key === '/' || e.key === 'ArrowDown') {
        showSuggestions();
        filterSuggestions(this.value);
        e.preventDefault();
        return;
      }
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (filteredItems.length > 0) {
          selectedIndex = Math.min(selectedIndex + 1, filteredItems.length - 1);
          updateSelection();
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (filteredItems.length > 0) {
          selectedIndex = Math.max(selectedIndex - 1, 0);
          updateSelection();
        }
        break;

      case 'Enter':
        e.preventDefault();
        const inputValue = this.value;

        // Check if it's a search command
        if (inputValue.toLowerCase().startsWith('/search ')) {
          const searchItem = Array.from(suggestionItems).find(
            item => item.getAttribute('data-search') === 'true'
          );
          if (searchItem) {
            executeCommand(searchItem, inputValue);
            return;
          }
        }

        if (selectedIndex >= 0 && filteredItems[selectedIndex]) {
          executeCommand(filteredItems[selectedIndex], inputValue);
        } else if (filteredItems.length === 1) {
          executeCommand(filteredItems[0], inputValue);
        } else {
          // Try to match exact command
          const value = inputValue.toLowerCase().trim();
          const exactMatch = Array.from(suggestionItems).find(
            item => item.getAttribute('data-cmd').toLowerCase() === value
          );
          if (exactMatch) {
            executeCommand(exactMatch, inputValue);
          }
        }
        break;

      case 'Escape':
        hideSuggestions();
        this.blur();
        break;

      case 'Tab':
        if (filteredItems.length > 0 && selectedIndex >= 0) {
          e.preventDefault();
          const cmd = filteredItems[selectedIndex].getAttribute('data-cmd');
          this.value = cmd;
          filterSuggestions(cmd);
        }
        break;
    }
  });

  // Click on suggestion
  suggestionItems.forEach((item) => {
    item.addEventListener('click', function() {
      executeCommand(this);
    });

    item.addEventListener('mouseenter', function() {
      selectedIndex = filteredItems.indexOf(this);
      updateSelection();
    });
  });

  // Global keyboard shortcut for terminal focus (only when terminal exists)
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // Press / to focus terminal
    if (e.key === '/') {
      e.preventDefault();
      input.focus();
      input.value = '/';
      filterSuggestions('/');
      showSuggestions();
    }
  });
})();
