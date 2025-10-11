const { useState, useEffect, useRef, useMemo, useCallback } = React;
const { createRoot } = ReactDOM;
const { useVirtualizer } = window.TanStackReactVirtual || window.ReactVirtual || {};

const PersonColors = [
    '#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a',
    '#30cfd0', '#a8edea', '#fed6e3', '#c1dfc4', '#d299c2',
    '#fda085', '#f6d365', '#96e6a1', '#764ba2', '#f79d00'
];

const getPersonColor = (personId) => PersonColors[personId % PersonColors.length];

const VirtualPhotoGrid = ({ 
    photos, 
    gridSize, 
    containerRef, 
    selectedPhotos,
    onPhotoClick,
    onPhotoDoubleClick,
    onPhotoContextMenu,
    onLoadMore,
    isLoading,
    hasMore
}) => {
    const [columns, setColumns] = useState(6);

    useEffect(() => {
        const updateColumns = () => {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth - 56;
                const cols = Math.max(1, Math.floor(width / gridSize));
                setColumns(cols);
            }
        };
        
        updateColumns();
        const resizeObserver = new ResizeObserver(updateColumns);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }
        
        return () => resizeObserver.disconnect();
    }, [gridSize, containerRef]);

    const rowVirtualizer = useVirtualizer({
        count: Math.ceil(photos.length / columns),
        getScrollElement: () => containerRef.current,
        estimateSize: () => gridSize + 16,
        overscan: 2,
    });

    useEffect(() => {
        const items = rowVirtualizer.getVirtualItems();
        if (items.length === 0) return;
        
        const lastItem = items[items.length - 1];
        const totalRows = Math.ceil(photos.length / columns);
        
        if (lastItem.index >= totalRows - 2 && hasMore && !isLoading) {
            onLoadMore();
        }
    }, [rowVirtualizer.getVirtualItems(), hasMore, isLoading, columns, photos.length]);

    return (
        <div
            style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
            }}
        >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const rowStartIndex = virtualRow.index * columns;
                const rowPhotos = photos.slice(rowStartIndex, rowStartIndex + columns);
                
                return (
                    <div
                        key={virtualRow.key}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                            display: 'grid',
                            gridTemplateColumns: `repeat(${columns}, 1fr)`,
                            gap: '16px',
                            padding: '0 28px',
                        }}
                    >
                        {rowPhotos.map((photo, colIndex) => {
                            const photoIndex = rowStartIndex + colIndex;
                            const isSelected = selectedPhotos.has(photo.face_id);
                            
                            return (
                                <div
                                    key={photo.face_id}
                                    className={`photo-item ${isSelected ? 'selected' : ''}`}
                                    onClick={(e) => onPhotoClick(e, photo, photoIndex)}
                                    onDoubleClick={() => onPhotoDoubleClick(photo)}
                                    onContextMenu={(e) => onPhotoContextMenu(e, photo)}
                                    style={{
                                        position: 'relative',
                                        aspectRatio: '1',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                                        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }}
                                >
                                    <img 
                                        src={photo.thumbnail} 
                                        alt={photo.name}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            borderRadius: '8px',
                                        }}
                                    />
                                    {photo.is_hidden && <div className="hidden-overlay" />}
                                </div>
                            );
                        })}
                    </div>
                );
            })}
            {isLoading && (
                <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    textAlign: 'center',
                    padding: '12px 24px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '8px',
                    color: '#3b82f6',
                    fontSize: '13px',
                    fontWeight: '500'
                }}>
                    Loading more photos...
                </div>
            )}
        </div>
    );
};

const ContextMenu = ({ x, y, photo, hasSelection, onClose, onAction }) => {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const menuItems = hasSelection ? [
        { label: `Remove/Transfer Tag (${hasSelection} photos)`, action: 'transfer' },
        { label: photo.is_hidden ? `Unhide photo` : `Hide photo`, action: photo.is_hidden ? 'unhide' : 'hide' }
    ] : [
        { label: 'Make primary photo', action: 'primary' },
        { label: 'Remove/Transfer Tag', action: 'transfer' },
        { label: photo.is_hidden ? 'Unhide photo' : 'Hide photo', action: photo.is_hidden ? 'unhide' : 'hide' }
    ];

    return (
        <div 
            ref={menuRef}
            className="context-menu show"
            style={{ left: `${x}px`, top: `${y}px` }}
        >
            {menuItems.map((item, i) => (
                <div 
                    key={i}
                    className="context-menu-item"
                    onClick={() => onAction(item.action, photo)}
                >
                    {item.label}
                </div>
            ))}
        </div>
    );
};

const Lightbox = ({ photos, currentIndex, onClose, onPrev, onNext, onOpenExternal }) => {
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') onPrev();
            if (e.key === 'ArrowRight') onNext();
        };
        
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose, onPrev, onNext]);

    const photo = photos[currentIndex];
    
    return (
        <div className="lightbox-overlay active" onClick={onClose}>
            <button className="lightbox-close" onClick={onClose}>
                <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M2 2 L22 22 M22 2 L2 22" stroke="currentColor" strokeWidth="2"/>
                </svg>
            </button>
            
            {currentIndex > 0 && (
                <button className="lightbox-nav lightbox-prev" onClick={(e) => { e.stopPropagation(); onPrev(); }}>
                    <svg width="32" height="32" viewBox="0 0 32 32">
                        <path d="M20 4 L8 16 L20 28" stroke="currentColor" strokeWidth="3" fill="none"/>
                    </svg>
                </button>
            )}
            
            <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                <img src={photo.thumbnail} alt={photo.name} />
            </div>
            
            {currentIndex < photos.length - 1 && (
                <button className="lightbox-nav lightbox-next" onClick={(e) => { e.stopPropagation(); onNext(); }}>
                    <svg width="32" height="32" viewBox="0 0 32 32">
                        <path d="M12 4 L24 16 L12 28" stroke="currentColor" strokeWidth="3" fill="none"/>
                    </svg>
                </button>
            )}
            
            <div className="lightbox-counter">{currentIndex + 1} of {photos.length}</div>
            
            <div className="lightbox-actions">
                <button className="lightbox-action-btn" onClick={onOpenExternal} title="Open in default app">
                    <svg width="20" height="20" viewBox="0 0 20 20">
                        <path d="M10 2 L10 12 M10 2 L6 6 M10 2 L14 6" stroke="currentColor" strokeWidth="2" fill="none"/>
                        <rect x="2" y="12" width="16" height="6" stroke="currentColor" strokeWidth="2" fill="none"/>
                    </svg>
                </button>
            </div>
        </div>
    );
};

const App = () => {
    const [people, setPeople] = useState([]);
    const [currentPerson, setCurrentPerson] = useState(null);
    const [allPhotos, setAllPhotos] = useState([]);
    const [selectedPhotos, setSelectedPhotos] = useState(new Set());
    const [lastSelectedIndex, setLastSelectedIndex] = useState(-1);
    const [gridSize, setGridSize] = useState(180);
    const [viewMode, setViewMode] = useState('entire_photo');
    const [contextMenu, setContextMenu] = useState(null);
    const [lightbox, setLightbox] = useState(null);
    const [settings, setSettings] = useState({
        showHiddenPhotos: false,
    });
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMorePhotos, setHasMorePhotos] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    
    const gridContainerRef = useRef(null);

    useEffect(() => {
        if (window.pywebview) {
            loadAllSettings();
            loadPeople();
        }
    }, []);

    const loadAllSettings = async () => {
        const gridSizeValue = await window.pywebview.api.get_grid_size();
        const viewModeValue = await window.pywebview.api.get_view_mode();
        const showHiddenPhotos = await window.pywebview.api.get_show_hidden_photos();
        
        setGridSize(gridSizeValue);
        setViewMode(viewModeValue);
        setSettings({ showHiddenPhotos });
    };

    const loadPeople = async () => {
        const peopleData = await window.pywebview.api.get_people();
        setPeople(peopleData);
    };

    const selectPerson = async (person) => {
        setCurrentPerson(person);
        setAllPhotos([]);
        setSelectedPhotos(new Set());
        setLastSelectedIndex(-1);
        setCurrentPage(1);
        setHasMorePhotos(true);
        await loadPhotos(person, 1, true);
    };

    const loadPhotos = async (person, page, reset = false) => {
        if (isLoadingMore && !reset) return;
        if (!hasMorePhotos && !reset) return;
        
        setIsLoadingMore(true);
        
        try {
            const result = await window.pywebview.api.get_photos(
                person.clustering_id,
                person.id,
                page,
                100
            );
            
            if (reset) {
                setAllPhotos(result.photos);
            } else {
                setAllPhotos(prev => [...prev, ...result.photos]);
            }
            
            setHasMorePhotos(result.has_more);
            setCurrentPage(page);
        } catch (error) {
            console.error('Error loading photos:', error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const visiblePhotos = useMemo(() => {
        return allPhotos.filter(photo => {
            if (photo.is_hidden && !settings.showHiddenPhotos) {
                return false;
            }
            return true;
        });
    }, [allPhotos, settings.showHiddenPhotos]);

    const handlePhotoClick = useCallback((e, photo, index) => {
        e.stopPropagation();
        
        if (e.ctrlKey || e.metaKey) {
            const newSelection = new Set(selectedPhotos);
            if (newSelection.has(photo.face_id)) {
                newSelection.delete(photo.face_id);
            } else {
                newSelection.add(photo.face_id);
            }
            setSelectedPhotos(newSelection);
            setLastSelectedIndex(index);
        } else if (e.shiftKey) {
            if (lastSelectedIndex >= 0) {
                const start = Math.min(lastSelectedIndex, index);
                const end = Math.max(lastSelectedIndex, index);
                const newSelection = new Set();
                for (let i = start; i <= end; i++) {
                    if (visiblePhotos[i]) {
                        newSelection.add(visiblePhotos[i].face_id);
                    }
                }
                setSelectedPhotos(newSelection);
            } else {
                setSelectedPhotos(new Set([photo.face_id]));
                setLastSelectedIndex(index);
            }
        } else {
            if (selectedPhotos.size === 0) {
                setLightbox({ currentIndex: index });
            } else {
                clearSelection();
            }
        }
    }, [selectedPhotos, lastSelectedIndex, visiblePhotos]);

    const handlePhotoDoubleClick = (photo) => {
        window.pywebview.api.open_photo(photo.path);
    };

    const handlePhotoContextMenu = (e, photo) => {
        e.preventDefault();
        const hasSelection = selectedPhotos.size > 0;
        const isPhotoSelected = selectedPhotos.has(photo.face_id);
        
        if (hasSelection && !isPhotoSelected) {
            const newSelection = new Set(selectedPhotos);
            newSelection.add(photo.face_id);
            setSelectedPhotos(newSelection);
        }
        
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            photo,
            hasSelection: selectedPhotos.size + (isPhotoSelected ? 0 : 1)
        });
    };

    const handleContextAction = async (action, photo) => {
        setContextMenu(null);
        
        const faceIds = selectedPhotos.size > 0 ? Array.from(selectedPhotos) : [photo.face_id];
        
        switch(action) {
            case 'primary':
                await window.pywebview.api.set_primary_photo(currentPerson.name, photo.face_id);
                loadPeople();
                break;
            case 'hide':
                for (const faceId of faceIds) {
                    await window.pywebview.api.hide_photo(faceId);
                }
                clearSelection();
                break;
            case 'unhide':
                for (const faceId of faceIds) {
                    await window.pywebview.api.unhide_photo(faceId);
                }
                clearSelection();
                break;
            case 'transfer':
                console.log('Transfer action');
                break;
        }
    };

    const clearSelection = () => {
        setSelectedPhotos(new Set());
        setLastSelectedIndex(-1);
    };

    const handleLoadMore = () => {
        if (currentPerson && hasMorePhotos && !isLoadingMore) {
            loadPhotos(currentPerson, currentPage + 1, false);
        }
    };

    return (
        <>
            <div className="title-bar">
                <div className="title-bar-drag pywebview-drag-region">
                    <div className="title-bar-title">Face Recognition Photo Organizer</div>
                </div>
                <div className="title-bar-controls">
                    <button className="title-bar-btn minimize-btn" onClick={() => window.pywebview.api.minimize_window()}>
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <rect x="0" y="5" width="12" height="2" fill="currentColor"/>
                        </svg>
                    </button>
                    <button className="title-bar-btn maximize-btn" onClick={() => window.pywebview.api.maximize_window()}>
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                    </button>
                    <button className="title-bar-btn close-btn" onClick={() => window.pywebview.api.close_window()}>
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div className="app-container">
                <div className="main-content">
                    <div className="sidebar">
                        <div className="sidebar-header">
                            <div className="sidebar-title-row">
                                <div className="sidebar-title">People</div>
                            </div>
                        </div>
                        <div className="people-list">
                            {people.map(person => (
                                <div
                                    key={person.id}
                                    className={`person-item ${currentPerson?.id === person.id ? 'active' : ''}`}
                                    onClick={() => selectPerson(person)}
                                >
                                    {person.thumbnail ? (
                                        <img src={person.thumbnail} className="person-avatar" alt={person.name} style={{
                                            width: '44px',
                                            height: '44px',
                                            objectFit: 'cover',
                                            borderRadius: '50%'
                                        }} />
                                    ) : (
                                        <div className="person-avatar" style={{
                                            background: `linear-gradient(135deg, ${getPersonColor(person.id)} 0%, ${getPersonColor(person.id)}99 100%)`
                                        }}>
                                            {person.name.charAt(0)}
                                        </div>
                                    )}
                                    <div className="person-info">
                                        <div className="person-name">{person.name}</div>
                                        <div className="person-count">{person.count} photos</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="content-area">
                        <div className="content-header">
                            <div className="content-title">
                                {currentPerson ? `${currentPerson.name}'s Photos` : 'Select a person'}
                            </div>
                            <div className="content-controls">
                                <div className="size-control">
                                    <span className="size-label">Size:</span>
                                    <input 
                                        type="range" 
                                        className="size-slider" 
                                        min="100" 
                                        max="300" 
                                        value={gridSize}
                                        onChange={(e) => {
                                            const size = parseInt(e.target.value);
                                            setGridSize(size);
                                            window.pywebview.api.set_grid_size(size);
                                        }}
                                    />
                                </div>
                                <select 
                                    className="view-dropdown"
                                    value={viewMode}
                                    onChange={async (e) => {
                                        setViewMode(e.target.value);
                                        await window.pywebview.api.set_view_mode(e.target.value);
                                        if (currentPerson) {
                                            setAllPhotos([]);
                                            setCurrentPage(1);
                                            await loadPhotos(currentPerson, 1, true);
                                        }
                                    }}
                                >
                                    <option value="entire_photo">Show entire photo</option>
                                    <option value="zoom_to_faces">Zoom to tagged faces</option>
                                </select>
                            </div>
                        </div>
                        
                        <div ref={gridContainerRef} className="photo-grid-container">
                            {currentPerson && visiblePhotos.length > 0 && (
                                <VirtualPhotoGrid
                                    photos={visiblePhotos}
                                    gridSize={gridSize}
                                    containerRef={gridContainerRef}
                                    selectedPhotos={selectedPhotos}
                                    onPhotoClick={handlePhotoClick}
                                    onPhotoDoubleClick={handlePhotoDoubleClick}
                                    onPhotoContextMenu={handlePhotoContextMenu}
                                    onLoadMore={handleLoadMore}
                                    isLoading={isLoadingMore}
                                    hasMore={hasMorePhotos}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {selectedPhotos.size > 0 && (
                <div className="selection-info show">
                    <div className="selection-info-text">
                        <span>{selectedPhotos.size}</span> photos selected
                        <button className="clear-selection-btn" onClick={clearSelection}>Clear</button>
                    </div>
                </div>
            )}
            
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    photo={contextMenu.photo}
                    hasSelection={contextMenu.hasSelection}
                    onClose={() => setContextMenu(null)}
                    onAction={handleContextAction}
                />
            )}
            
            {lightbox && (
                <Lightbox
                    photos={visiblePhotos}
                    currentIndex={lightbox.currentIndex}
                    onClose={() => setLightbox(null)}
                    onPrev={() => setLightbox(prev => ({ currentIndex: Math.max(0, prev.currentIndex - 1) }))}
                    onNext={() => setLightbox(prev => ({ currentIndex: Math.min(visiblePhotos.length - 1, prev.currentIndex + 1) }))}
                    onOpenExternal={() => window.pywebview.api.open_photo(visiblePhotos[lightbox.currentIndex].path)}
                />
            )}
        </>
    );
};

window.addEventListener('pywebviewready', () => {
    const root = createRoot(document.getElementById('root'));
    root.render(<App />);
});
