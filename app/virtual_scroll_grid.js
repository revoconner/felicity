class VirtualPhotoGrid {
    constructor(container, options = {}) {
        this.container = container;
        this.itemHeight = options.itemHeight || 200;
        this.itemsPerRow = options.itemsPerRow || 5;
        this.gap = options.gap || 16;
        this.overscan = options.overscan || 3;
        
        this.allPhotos = [];
        this.visibleItems = new Map();
        this.scrollTop = 0;
        this.containerHeight = 0;
        
        this.viewport = null;
        this.spacer = null;
        this.content = null;
        this.contextMenu = null;
        
        this.init();
    }
    
    init() {
        this.container.innerHTML = '';
        this.container.style.overflow = 'auto';
        this.container.style.position = 'relative';
        
        this.viewport = document.createElement('div');
        this.viewport.style.position = 'relative';
        this.viewport.style.width = '100%';
        
        this.spacer = document.createElement('div');
        this.spacer.style.position = 'absolute';
        this.spacer.style.top = '0';
        this.spacer.style.left = '0';
        this.spacer.style.width = '1px';
        this.spacer.style.height = '1px';
        this.spacer.style.pointerEvents = 'none';
        
        this.content = document.createElement('div');
        this.content.className = 'photo-grid';
        this.content.style.position = 'relative';
        this.content.style.willChange = 'transform';
        
        this.viewport.appendChild(this.spacer);
        this.viewport.appendChild(this.content);
        this.container.appendChild(this.viewport);
        
        this.createContextMenu();
        
        this.container.addEventListener('scroll', this.onScroll.bind(this), { passive: true });
        
        const resizeObserver = new ResizeObserver(() => this.updateLayout());
        resizeObserver.observe(this.container);
    }
    
    createContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
        }
        
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'context-menu';
        document.body.appendChild(this.contextMenu);
        
        this.contextMenu.addEventListener('mouseenter', () => {
            if (window.menuCloseTimeout) {
                clearTimeout(window.menuCloseTimeout);
                window.menuCloseTimeout = null;
            }
        });
        
        this.contextMenu.addEventListener('mouseleave', () => {
            window.menuCloseTimeout = setTimeout(() => {
                this.closeContextMenu();
            }, 200);
        });
    }
    
    setPhotos(photos) {
        this.allPhotos = photos;
        this.visibleItems.clear();
        this.updateLayout();
    }
    
    updateLayout() {
        if (this.allPhotos.length === 0) {
            this.content.innerHTML = '<div style="color: #a0a0a0; padding: 20px;">No photos found</div>';
            return;
        }
        
        this.containerHeight = this.container.clientHeight;
        
        const totalRows = Math.ceil(this.allPhotos.length / this.itemsPerRow);
        const totalHeight = totalRows * (this.itemHeight + this.gap);
        
        this.spacer.style.height = totalHeight + 'px';
        
        this.render();
    }
    
    onScroll() {
        this.scrollTop = this.container.scrollTop;
        this.render();
    }
    
    render() {
        const scrollTop = this.scrollTop;
        const viewportHeight = this.containerHeight;
        
        const rowHeight = this.itemHeight + this.gap;
        
        const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - this.overscan);
        const endRow = Math.min(
            Math.ceil(this.allPhotos.length / this.itemsPerRow),
            Math.ceil((scrollTop + viewportHeight) / rowHeight) + this.overscan
        );
        
        const startIndex = startRow * this.itemsPerRow;
        const endIndex = Math.min(this.allPhotos.length, endRow * this.itemsPerRow);
        
        const visibleSet = new Set();
        
        for (let i = startIndex; i < endIndex; i++) {
            visibleSet.add(i);
            
            if (!this.visibleItems.has(i)) {
                this.createPhotoElement(i);
            }
        }
        
        for (const [index, element] of this.visibleItems.entries()) {
            if (!visibleSet.has(index)) {
                element.remove();
                this.visibleItems.delete(index);
            }
        }
        
        const offsetY = startRow * rowHeight;
        this.content.style.transform = `translateY(${offsetY}px)`;
    }
    
    createPhotoElement(index) {
        const photo = this.allPhotos[index];
        if (!photo) return;
        
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.setAttribute('data-face-id', photo.face_id);
        photoItem.setAttribute('data-index', index);
        photoItem.style.position = 'absolute';
        
        const row = Math.floor(index / this.itemsPerRow);
        const col = index % this.itemsPerRow;
        const itemWidth = (this.container.clientWidth - (this.itemsPerRow - 1) * this.gap) / this.itemsPerRow;
        
        photoItem.style.left = col * (itemWidth + this.gap) + 'px';
        photoItem.style.top = ((row - Math.floor(this.scrollTop / (this.itemHeight + this.gap)) + this.overscan) * (this.itemHeight + this.gap)) + 'px';
        photoItem.style.width = itemWidth + 'px';
        photoItem.style.height = this.itemHeight + 'px';
        
        const img = document.createElement('img');
        img.className = 'photo-placeholder';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.loading = 'lazy';
        img.src = photo.thumbnail;
        
        photoItem.appendChild(img);
        
        if (photo.is_hidden) {
            const overlay = document.createElement('div');
            overlay.className = 'hidden-overlay';
            photoItem.appendChild(overlay);
        }
        
        const kebab = this.createKebabMenu(photo, photoItem, index);
        photoItem.appendChild(kebab);
        
        photoItem.addEventListener('click', (e) => this.handlePhotoClick(e, photo, photoItem, index));
        photoItem.addEventListener('dblclick', (e) => this.handlePhotoDblClick(e, photo));
        
        this.content.appendChild(photoItem);
        this.visibleItems.set(index, photoItem);
    }
    
    createKebabMenu(photo, photoItem, index) {
        const kebab = document.createElement('button');
        kebab.className = 'kebab-menu';
        kebab.innerHTML = '<span class="kebab-dot"></span><span class="kebab-dot"></span><span class="kebab-dot"></span>';
        
        kebab.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showContextMenu(photo, photoItem, kebab);
        });
        
        kebab.addEventListener('mouseenter', () => {
            if (window.menuCloseTimeout) {
                clearTimeout(window.menuCloseTimeout);
                window.menuCloseTimeout = null;
            }
        });
        
        kebab.addEventListener('mouseleave', () => {
            window.menuCloseTimeout = setTimeout(() => {
                this.closeContextMenu();
            }, 200);
        });
        
        return kebab;
    }
    
    showContextMenu(photo, photoItem, button) {
        this.closeContextMenu();
        
        window.currentPhotoContext = {
            person_name: window.currentPerson?.name || '',
            face_id: photo.face_id,
            path: photo.path,
            is_hidden: photo.is_hidden
        };
        
        const hasSelection = window.selectedPhotos?.size > 0;
        const isPhotoSelected = window.selectedPhotos?.has(photo.face_id);
        
        if (hasSelection && !isPhotoSelected) {
            window.selectedPhotos.add(photo.face_id);
            photoItem.classList.add('selected');
            window.updateSelectionInfo();
        }
        
        let menuHTML = '';
        
        if (hasSelection) {
            const count = window.selectedPhotos.size;
            if (photo.is_hidden) {
                menuHTML = `
                    <div class="context-menu-item" data-action="transfer-tag">Remove/Transfer Tag (${count} photos)</div>
                    <div class="context-menu-item" data-action="unhide-photo">Unhide photo (${count} photos)</div>
                `;
            } else {
                menuHTML = `
                    <div class="context-menu-item" data-action="transfer-tag">Remove/Transfer Tag (${count} photos)</div>
                    <div class="context-menu-item" data-action="hide-photo">Hide photo (${count} photos)</div>
                `;
            }
        } else {
            if (photo.is_hidden) {
                menuHTML = `
                    <div class="context-menu-item" data-action="make-primary">Make primary photo</div>
                    <div class="context-menu-item" data-action="unhide-photo">Unhide photo</div>
                `;
            } else {
                menuHTML = `
                    <div class="context-menu-item" data-action="make-primary">Make primary photo</div>
                    <div class="context-menu-item" data-action="transfer-tag">Remove/Transfer Tag</div>
                    <div class="context-menu-item" data-action="hide-photo">Hide photo</div>
                `;
            }
        }
        
        this.contextMenu.innerHTML = menuHTML;
        this.contextMenu.classList.add('show');
        photoItem.classList.add('menu-active');
        window.activeMenu = { element: this.contextMenu, parent: photoItem };
        
        this.positionContextMenu(button);
        
        this.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.getAttribute('data-action');
                this.handleContextAction(action);
            });
        });
    }
    
    positionContextMenu(button) {
        const buttonRect = button.getBoundingClientRect();
        const menuRect = this.contextMenu.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        
        let top = buttonRect.bottom + 4;
        let left = buttonRect.right - menuRect.width;
        
        if (top + menuRect.height > viewportHeight) {
            top = buttonRect.top - menuRect.height - 4;
        }
        
        if (left < 0) {
            left = buttonRect.left;
        }
        
        if (left + menuRect.width > viewportWidth) {
            left = viewportWidth - menuRect.width - 8;
        }
        
        this.contextMenu.style.top = top + 'px';
        this.contextMenu.style.left = left + 'px';
    }
    
    closeContextMenu() {
        this.contextMenu.classList.remove('show');
        document.querySelectorAll('.photo-item.menu-active').forEach(item => {
            item.classList.remove('menu-active');
        });
        window.activeMenu = null;
    }
    
    handleContextAction(action) {
        if (action === 'make-primary') {
            window.makePrimaryPhoto();
        } else if (action === 'hide-photo') {
            window.hidePhotos();
        } else if (action === 'unhide-photo') {
            window.unhidePhotos();
        } else if (action === 'transfer-tag') {
            window.openTransferDialog();
        }
    }
    
    handlePhotoClick(e, photo, photoItem, index) {
        if (e.ctrlKey || e.metaKey) {
            window.togglePhotoSelection(photo.face_id, index, photoItem);
        } else if (e.shiftKey) {
            if (window.lastSelectedIndex >= 0) {
                window.selectPhotoRange(window.lastSelectedIndex, index);
            } else {
                window.selectedPhotos.add(photo.face_id);
                photoItem.classList.add('selected');
                window.lastSelectedIndex = index;
                window.updateSelectionInfo();
            }
        } else {
            if (window.selectedPhotos?.size === 0) {
                window.openLightbox(index);
            } else {
                window.clearSelection();
            }
        }
    }
    
    handlePhotoDblClick(e, photo) {
        if (window.pywebview?.api) {
            window.pywebview.api.open_photo(photo.path);
        }
    }
    
    destroy() {
        this.visibleItems.clear();
        if (this.contextMenu) {
            this.contextMenu.remove();
        }
    }
}

window.VirtualPhotoGrid = VirtualPhotoGrid;
