// SPA Navigation System
class SPANavigation {
    constructor() {
        this.contentContainer = document.getElementById('contentContainer');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebarToggle');
        this.mainContent = document.getElementById('mainContent');
        this.currentPath = window.location.pathname;
        this.sidebarHidden = false;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateActiveNavLinks();
        this.setupSidebarToggle();
        
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.path) {
                this.loadContent(e.state.path, false);
            }
        });
        
        // Save initial state
        history.replaceState({ path: this.currentPath }, '', this.currentPath);
    }
    
    setupEventListeners() {
        // Intercept all internal links
        document.addEventListener('click', (e) => {
            // Skip if it's the sidebar toggle button or its children
            if (e.target.closest('.sidebar-toggle')) {
                return;
            }
            
            const link = e.target.closest('a');
            if (!link) return;
            
            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) {
                return; // Skip external links, anchors, and email links
            }
            
            // Check if it's an internal link
            if (href.startsWith('/') || href.startsWith('./') || !href.includes('://')) {
                e.preventDefault();
                this.navigate(href);
            }
        });
    }
    
    setupSidebarToggle() {
        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleSidebar();
            });
        }
        
        // Close mobile menu when clicking on overlay
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('sidebar-overlay')) {
                this.closeMobileMenu();
            }
        });
        
        // Close mobile menu when navigation link is clicked on mobile
        if (window.innerWidth <= 992) {
            this.sidebar.addEventListener('click', (e) => {
                if (e.target.closest('a')) {
                    this.closeMobileMenu();
                }
            });
        }
    }
    
    toggleSidebar() {
        if (window.innerWidth <= 992) {
            // Mobile behavior - toggle overlay
            this.toggleMobileMenu();
        } else {
            // Desktop behavior - hide/show sidebar
            this.sidebarHidden = !this.sidebarHidden;
            
            if (this.sidebarHidden) {
                this.sidebar.classList.add('hidden');
                this.mainContent.classList.add('expanded');
                this.sidebarToggle.classList.add('expanded');
            } else {
                this.sidebar.classList.remove('hidden');
                this.mainContent.classList.remove('expanded');
                this.sidebarToggle.classList.remove('expanded');
            }
        }
    }
    
    toggleMobileMenu() {
        this.sidebar.classList.toggle('open');
        
        // Add/remove overlay
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }
        
        overlay.classList.toggle('active');
    }
    
    closeMobileMenu() {
        this.sidebar.classList.remove('open');
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }
    
    async navigate(path) {
        // Normalize path
        const normalizedPath = this.normalizePath(path);
        
        if (normalizedPath === this.currentPath) {
            return; // Already on this page
        }
        
        try {
            await this.loadContent(normalizedPath, true);
            
            // Update URL and browser history
            history.pushState({ path: normalizedPath }, '', normalizedPath);
            this.currentPath = normalizedPath;
            
            // Update active navigation links
            this.updateActiveNavLinks();
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
        } catch (error) {
            console.error('Navigation failed:', error);
            // Fallback to regular navigation
            window.location.href = path;
        }
    }
    
    async loadContent(path, showLoading = true) {
        if (showLoading) {
            this.showLoading();
        }
        
        try {
            // Convert path to content URL
            const contentUrl = this.getContentUrl(path);
            
            const response = await fetch(contentUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const html = await response.text();
            
            // Extract content from the response
            const content = this.extractContent(html);
            
            // Update content with fade effect
            await this.updateContent(content);
            
            // Update page title
            this.updateTitle(html);
            
            // Re-initialize any dynamic components
            this.reinitializeComponents();
            
        } catch (error) {
            console.error('Failed to load content:', error);
            throw error;
        } finally {
            this.hideLoading();
        }
    }
    
    getContentUrl(path) {
        // For Jekyll, we can fetch the full page and extract content
        // Ensure path ends with / if it's a directory
        if (path !== '/' && !path.includes('.') && !path.endsWith('/')) {
            path += '/';
        }
        return path;
    }
    
    extractContent(html) {
        // Create a temporary DOM to parse the response
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Try to find the main content area
        let content = tempDiv.querySelector('.post-listing, .content-container, main, article');
        
        if (!content) {
            // Fallback: look for content in common Jekyll structures
            content = tempDiv.querySelector('.col.s12.m9, .content, .post');
        }
        
        if (!content) {
            // Last resort: get body content but exclude sidebar
            const body = tempDiv.querySelector('body');
            if (body) {
                // Remove sidebar and navigation elements
                const elementsToRemove = body.querySelectorAll('.sidebar, nav, .col.s12.m3');
                elementsToRemove.forEach(el => el.remove());
                content = body;
            }
        }
        
        return content ? content.innerHTML : html;
    }
    
    updateTitle(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const titleEl = tempDiv.querySelector('title');
        if (titleEl) {
            document.title = titleEl.textContent;
        }
    }
    
    async updateContent(content) {
        return new Promise((resolve) => {
            // Fade out
            this.contentContainer.style.opacity = '0';
            
            setTimeout(() => {
                // Update content
                this.contentContainer.innerHTML = content;
                
                // Fade in
                this.contentContainer.style.opacity = '1';
                resolve();
            }, 150);
        });
    }
    
    showLoading() {
        this.loadingIndicator.style.display = 'flex';
        this.contentContainer.classList.add('loading');
    }
    
    hideLoading() {
        this.loadingIndicator.style.display = 'none';
        this.contentContainer.classList.remove('loading');
    }
    
    updateActiveNavLinks() {
        // Remove active class from all nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Add active class to current page link
        const currentLink = document.querySelector(`a[href="${this.currentPath}"], a[href="${this.currentPath.replace(/\/$/, '')}"]`);
        if (currentLink) {
            currentLink.classList.add('active');
        }
    }
    
    normalizePath(path) {
        // Handle relative paths
        if (path.startsWith('./')) {
            path = path.substring(2);
        }
        
        // Ensure path starts with /
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        
        // Remove double slashes
        path = path.replace(/\/+/g, '/');
        
        return path;
    }
    
    reinitializeComponents() {
        // Re-run any initialization code for dynamic components
        // This could include syntax highlighting, image lazy loading, etc.
        
        // Example: Re-initialize syntax highlighting if using Prism or similar
        if (window.Prism) {
            Prism.highlightAll();
        }
        
        // Dispatch custom event for other scripts to hook into
        window.dispatchEvent(new CustomEvent('spa:contentLoaded'));
    }
}

// Initialize SPA navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're using the SPA layout
    if (document.body.classList.contains('spa-layout')) {
        new SPANavigation();
    }
});

// Export for potential external use
window.SPANavigation = SPANavigation;