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
        this.containerWidth = 0;
        this.isRendering = false;
        
        this.viewport = null;
        this.content = null;
        this.contextMenu = null;
        
        this.scrollTimeout = null;
        
        this.init();
    }
    
    init() {
        this.container.style.overflow = 'auto';
        this.container.style.position = 'relative';
        
        this.viewport = document.createElement('div');
        this.viewport.style.position = 'relative';
        this.viewport.style.width = '100%';
        this.viewport.style.minHeight = '100px';
        
        this.content = document.createElement('div');
        this.content.className = 'photo-grid';
        this.content.style.position = 'absolute';
        this.content.style.top = '0';
        this.content.style.left = '0';
        this.content.style.width = '100%';
        this.content.style.pointerEvents = 'none';
        
        this.viewport.appendChild(this.content);
        this.container.innerHTML = '';
        this.container.appendChild(this.viewport);
        
        this.createContextMenu();
        
        this.container.addEventListener('scroll', () => {
            if (this.scrollTimeout) {
                clearTimeout(this.scrollTimeout);
            }
            this.scrollTimeout = setTimeout(() => this.onScroll(), 16);
        }, { passive: true });
        
        const resizeObserver = new ResizeObserver(() => {
            if (!this.isRendering) {
                this.updateLayout();
            }
        });
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
        
        for (const [index, element] of this.visibleItems.entries()) {
            element.remove();
        }
        this.visibleItems.clear();
        
        this.updateLayout();
    }
    
    updateLayout() {
        if (this.allPhotos.length === 0) {
            this.content.innerHTML = '<div style="color: #a0a0a0; padding: 20px; pointer-events: auto;">No photos found</div>';
            this.viewport.style.height = '100px';
            return;
        }
        
        if (this.visibleItems.size === 0) {
            this.content.innerHTML = '';
        }
        
        this.containerHeight = this.container.clientHeight;
        this.containerWidth = this.container.clientWidth - 56;
        
        const totalRows = Math.ceil(this.allPhotos.length / this.itemsPerRow);
        const totalHeight = totalRows * (this.itemHeight + this.gap);
        
        this.viewport.style.height = totalHeight + 'px';
        
        this.render();
    }
    
    onScroll() {
        this.scrollTop = this.container.scrollTop;
        this.render();
    }
    
    render() {
        if (this.isRendering || this.allPhotos.length === 0) return;
        
        this.isRendering = true;
        
        requestAnimationFrame(() => {
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
                } else {
                    this.updatePhotoPosition(i);
                }
            }
            
            for (const [index, element] of this.visibleItems.entries()) {
                if (!visibleSet.has(index)) {
                    element.remove();
                    this.visibleItems.delete(index);
                }
            }
            
            this.isRendering = false;
        });
    }
    
    updatePhotoPosition(index) {
        const element = this.visibleItems.get(index);
        if (!element) return;
        
        const row = Math.floor(index / this.itemsPerRow);
        const col = index % this.itemsPerRow;
        const itemWidth = (this.containerWidth - (this.itemsPerRow - 1) * this.gap) / this.itemsPerRow;
        
        element.style.left = (col * (itemWidth + this.gap)) + 'px';
        element.style.top = (row * (this.itemHeight + this.gap)) + 'px';
        element.style.width = itemWidth + 'px';
        element.style.height = this.itemHeight + 'px';
    }
    
    createPhotoElement(index) {
        const photo = this.allPhotos[index];
        if (!photo) return;
        
        const row = Math.floor(index / this.itemsPerRow);
        const col = index % this.itemsPerRow;
        const itemWidth = (this.containerWidth - (this.itemsPerRow - 1) * this.gap) / this.itemsPerRow;
        
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.setAttribute('data-face-id', photo.face_id);
        photoItem.setAttribute('data-index', index);
        photoItem.style.position = 'absolute';
        photoItem.style.left = (col * (itemWidth + this.gap)) + 'px';
        photoItem.style.top = (row * (this.itemHeight + this.gap)) + 'px';
        photoItem.style.width = itemWidth + 'px';
        photoItem.style.height = this.itemHeight + 'px';
        photoItem.style.pointerEvents = 'auto';
        
        if (window.selectedPhotos?.has(photo.face_id)) {
            photoItem.classList.add('selected');
        }
        
        const img = document.createElement('img');
        img.className = 'photo-placeholder';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        img.loading = 'lazy';
        img.src = photo.thumbnail;
        img.draggable = false;
        
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
        kebab.style.pointerEvents = 'auto';
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
            if (window.updateSelectionInfo) window.updateSelectionInfo();
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
        if (action === 'make-primary' && window.makePrimaryPhoto) {
            window.makePrimaryPhoto();
        } else if (action === 'hide-photo' && window.hidePhotos) {
            window.hidePhotos();
        } else if (action === 'unhide-photo' && window.unhidePhotos) {
            window.unhidePhotos();
        } else if (action === 'transfer-tag' && window.openTransferDialog) {
            window.openTransferDialog();
        }
    }
    
    handlePhotoClick(e, photo, photoItem, index) {
        if (e.ctrlKey || e.metaKey) {
            if (window.togglePhotoSelection) {
                window.togglePhotoSelection(photo.face_id, index, photoItem);
            }
        } else if (e.shiftKey) {
            if (window.lastSelectedIndex >= 0 && window.selectPhotoRange) {
                window.selectPhotoRange(window.lastSelectedIndex, index);
            } else if (window.selectedPhotos) {
                window.selectedPhotos.add(photo.face_id);
                photoItem.classList.add('selected');
                window.lastSelectedIndex = index;
                if (window.updateSelectionInfo) window.updateSelectionInfo();
            }
        } else {
            if (window.selectedPhotos?.size === 0 || !window.selectedPhotos) {
                if (window.openLightbox) window.openLightbox(index);
            } else {
                if (window.clearSelection) window.clearSelection();
            }
        }
    }
    
    handlePhotoDblClick(e, photo) {
        if (window.pywebview?.api) {
            window.pywebview.api.open_photo(photo.path);
        }
    }
    
    updateSelections() {
        for (const [index, element] of this.visibleItems.entries()) {
            const photo = this.allPhotos[index];
            if (photo && window.selectedPhotos?.has(photo.face_id)) {
                element.classList.add('selected');
            } else {
                element.classList.remove('selected');
            }
        }
    }
    
    destroy() {
        for (const [index, element] of this.visibleItems.entries()) {
            element.remove();
        }
        this.visibleItems.clear();
        if (this.contextMenu) {
            this.contextMenu.remove();
        }
        this.container.innerHTML = '';
    }
}

window.VirtualPhotoGrid = VirtualPhotoGrid;
