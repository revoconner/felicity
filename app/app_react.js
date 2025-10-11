const { useState, useEffect, useRef, useMemo, useCallback } = React;

const useSimpleVirtualizer = ({ count, estimateSize, getScrollElement, overscan = 2 }) => {
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);
    
    useEffect(() => {
        const element = getScrollElement();
        if (!element) return;
        
        const handleScroll = () => setScrollTop(element.scrollTop);
        const handleResize = () => setContainerHeight(element.clientHeight);
        
        handleResize();
        element.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize);
        
        return () => {
            element.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
        };
    }, [getScrollElement]);
    
    const itemSize = estimateSize();
    const totalSize = count * itemSize;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemSize) - overscan);
    const endIndex = Math.min(count - 1, Math.ceil((scrollTop + containerHeight) / itemSize) + overscan);
    
    const virtualItems = [];
    for (let i = startIndex; i <= endIndex; i++) {
        virtualItems.push({ key: i, index: i, start: i * itemSize, size: itemSize });
    }
    
    return {
        getVirtualItems: () => virtualItems,
        getTotalSize: () => totalSize,
        range: { startIndex, endIndex }
    };
};

const PersonColors = [
    '#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a',
    '#30cfd0', '#a8edea', '#fed6e3', '#c1dfc4', '#d299c2',
    '#fda085', '#f6d365', '#96e6a1', '#764ba2', '#f79d00'
];

const getPersonColor = (personId) => PersonColors[personId % PersonColors.length];

const VirtualPhotoGrid = ({ 
    photos, gridSize, containerRef, selectedPhotos,
    onPhotoClick, onPhotoDoubleClick, onKebabClick,
    onLoadMore, isLoading, hasMore
}) => {
    const [columns, setColumns] = useState(6);

    useEffect(() => {
        const updateColumns = () => {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth - 56;
                const cols = Math.max(1, Math.floor(width / (gridSize + 16)));
                setColumns(cols);
            }
        };
        
        updateColumns();
        const resizeObserver = new ResizeObserver(updateColumns);
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [gridSize, containerRef]);

    const rowVirtualizer = useSimpleVirtualizer({
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
    }, [rowVirtualizer.getVirtualItems().length, hasMore, isLoading, columns, photos.length]);

    return React.createElement('div', {
        style: {
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
        }
    },
        rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const rowStartIndex = virtualRow.index * columns;
            const rowPhotos = photos.slice(rowStartIndex, rowStartIndex + columns);
            
            return React.createElement('div', {
                key: virtualRow.key,
                style: {
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
                }
            },
                rowPhotos.map((photo, colIndex) => {
                    const photoIndex = rowStartIndex + colIndex;
                    const isSelected = selectedPhotos.has(photo.face_id);
                    
                    return React.createElement('div', {
                        key: photo.face_id,
                        className: `photo-item ${isSelected ? 'selected' : ''}`,
                        onClick: (e) => onPhotoClick(e, photo, photoIndex),
                        onDoubleClick: () => onPhotoDoubleClick(photo),
                        style: {
                            position: 'relative',
                            width: `${gridSize}px`,
                            height: `${gridSize}px`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        }
                    },
                        React.createElement('img', {
                            src: photo.thumbnail,
                            alt: photo.name,
                            style: {
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                borderRadius: '8px',
                            }
                        }),
                        photo.is_hidden && React.createElement('div', { className: 'hidden-overlay' }),
                        React.createElement('button', {
                            className: 'kebab-menu',
                            onClick: (e) => {
                                e.stopPropagation();
                                onKebabClick(e, photo);
                            }
                        },
                            React.createElement('span', { className: 'kebab-dot' }),
                            React.createElement('span', { className: 'kebab-dot' }),
                            React.createElement('span', { className: 'kebab-dot' })
                        )
                    );
                })
            );
        }),
        isLoading && React.createElement('div', {
            style: {
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
            }
        }, 'Loading more photos...')
    );
};

const ContextMenu = ({ x, y, items, onClose, onAction }) => {
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

    return React.createElement('div', {
        ref: menuRef,
        className: 'context-menu show',
        style: { left: `${x}px`, top: `${y}px` }
    },
        items.map((item, i) =>
            React.createElement('div', {
                key: i,
                className: 'context-menu-item',
                onClick: () => onAction(item.action, item.data)
            }, item.label)
        )
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
    
    return React.createElement('div', {
        className: 'lightbox-overlay active',
        onClick: onClose
    },
        React.createElement('button', {
            className: 'lightbox-close',
            onClick: onClose
        },
            React.createElement('svg', { width: '24', height: '24', viewBox: '0 0 24 24' },
                React.createElement('path', { d: 'M2 2 L22 22 M22 2 L2 22', stroke: 'currentColor', strokeWidth: '2' })
            )
        ),
        currentIndex > 0 && React.createElement('button', {
            className: 'lightbox-nav lightbox-prev',
            onClick: (e) => { e.stopPropagation(); onPrev(); }
        },
            React.createElement('svg', { width: '32', height: '32', viewBox: '0 0 32 32' },
                React.createElement('path', { d: 'M20 4 L8 16 L20 28', stroke: 'currentColor', strokeWidth: '3', fill: 'none' })
            )
        ),
        React.createElement('div', {
            className: 'lightbox-content',
            onClick: (e) => e.stopPropagation()
        },
            React.createElement('img', { src: photo.thumbnail, alt: photo.name })
        ),
        currentIndex < photos.length - 1 && React.createElement('button', {
            className: 'lightbox-nav lightbox-next',
            onClick: (e) => { e.stopPropagation(); onNext(); }
        },
            React.createElement('svg', { width: '32', height: '32', viewBox: '0 0 32 32' },
                React.createElement('path', { d: 'M12 4 L24 16 L12 28', stroke: 'currentColor', strokeWidth: '3', fill: 'none' })
            )
        ),
        React.createElement('div', { className: 'lightbox-counter' }, `${currentIndex + 1} of ${photos.length}`),
        React.createElement('div', { className: 'lightbox-actions' },
            React.createElement('button', {
                className: 'lightbox-action-btn',
                onClick: onOpenExternal,
                title: 'Open in default app'
            },
                React.createElement('svg', { width: '20', height: '20', viewBox: '0 0 20 20' },
                    React.createElement('path', { d: 'M10 2 L10 12 M10 2 L6 6 M10 2 L14 6', stroke: 'currentColor', strokeWidth: '2', fill: 'none' }),
                    React.createElement('rect', { x: '2', y: '12', width: '16', height: '6', stroke: 'currentColor', strokeWidth: '2', fill: 'none' })
                )
            )
        )
    );
};

const SettingsDialog = ({ active, onClose, activePanel, setActivePanel }) => {
    const [threshold, setThreshold] = useState(50);
    const [includeFolders, setIncludeFolders] = useState([]);
    const [excludeFolders, setExcludeFolders] = useState([]);
    const [selectedInclude, setSelectedInclude] = useState(null);
    const [selectedExclude, setSelectedExclude] = useState(null);
    const [wildcardInput, setWildcardInput] = useState('');
    const [settings, setSettings] = useState({
        closeToTray: true,
        dynamicResources: true,
        showUnmatched: false,
        showHidden: false,
        showHiddenPhotos: false,
        showDevOptions: false,
        minPhotosEnabled: false,
        minPhotosCount: 2,
        hideUnnamed: false,
        scanFrequency: 'restart_1_day',
        showFaceTagsPreview: true
    });

    useEffect(() => {
        if (active && window.pywebview) {
            loadSettings();
        }
    }, [active]);

    const loadSettings = async () => {
        const thresh = await window.pywebview.api.get_threshold();
        const incFolders = await window.pywebview.api.get_include_folders();
        const excFolders = await window.pywebview.api.get_exclude_folders();
        const wildcards = await window.pywebview.api.get_wildcard_exclusions();
        const closeToTray = await window.pywebview.api.get_close_to_tray();
        const dynamicResources = await window.pywebview.api.get_dynamic_resources();
        const showUnmatched = await window.pywebview.api.get_show_unmatched();
        const showHidden = await window.pywebview.api.get_show_hidden();
        const showHiddenPhotos = await window.pywebview.api.get_show_hidden_photos();
        const showDevOptions = await window.pywebview.api.get_show_dev_options();
        const minPhotosEnabled = await window.pywebview.api.get_min_photos_enabled();
        const minPhotosCount = await window.pywebview.api.get_min_photos_count();
        const hideUnnamed = await window.pywebview.api.get_hide_unnamed_persons();
        const scanFrequency = await window.pywebview.api.get_scan_frequency();
        const showFaceTagsPreview = await window.pywebview.api.get_show_face_tags_preview();
        
        setThreshold(thresh);
        setIncludeFolders(incFolders);
        setExcludeFolders(excFolders);
        setWildcardInput(wildcards);
        setSettings({
            closeToTray, dynamicResources, showUnmatched, showHidden, showHiddenPhotos,
            showDevOptions, minPhotosEnabled, minPhotosCount, hideUnnamed, scanFrequency,
            showFaceTagsPreview
        });
    };

    const handleRecalibrate = async () => {
        onClose();
        await window.pywebview.api.recalibrate(threshold);
    };

    const handleAddInclude = async () => {
        const folder = await window.pywebview.api.select_folder();
        if (folder && !includeFolders.includes(folder)) {
            const newFolders = [...includeFolders, folder];
            setIncludeFolders(newFolders);
            await window.pywebview.api.set_include_folders(newFolders);
        }
    };

    const handleRemoveInclude = async () => {
        if (selectedInclude !== null) {
            const newFolders = includeFolders.filter((_, i) => i !== selectedInclude);
            setIncludeFolders(newFolders);
            setSelectedInclude(null);
            await window.pywebview.api.set_include_folders(newFolders);
        }
    };

    const handleAddExclude = async () => {
        const folder = await window.pywebview.api.select_folder();
        if (folder && !excludeFolders.includes(folder)) {
            const newFolders = [...excludeFolders, folder];
            setExcludeFolders(newFolders);
            await window.pywebview.api.set_exclude_folders(newFolders);
        }
    };

    const handleRemoveExclude = async () => {
        if (selectedExclude !== null) {
            const newFolders = excludeFolders.filter((_, i) => i !== selectedExclude);
            setExcludeFolders(newFolders);
            setSelectedExclude(null);
            await window.pywebview.api.set_exclude_folders(newFolders);
        }
    };

    const handleRescan = async () => {
        onClose();
        await window.pywebview.api.start_scanning();
    };

    if (!active) return null;

    return React.createElement('div', {
        className: 'settings-overlay active',
        onClick: (e) => {
            if (e.target.className === 'settings-overlay active') onClose();
        }
    },
        React.createElement('div', { className: 'settings-container', onClick: (e) => e.stopPropagation() },
            React.createElement('div', { className: 'settings-sidebar' },
                React.createElement('div', { className: 'settings-header' },
                    React.createElement('div', { className: 'settings-title' }, 'Settings')
                ),
                React.createElement('div', { className: 'settings-nav' },
                    React.createElement('div', {
                        className: `nav-item ${activePanel === 'general' ? 'active' : ''}`,
                        onClick: () => setActivePanel('general')
                    }, 'General Settings'),
                    React.createElement('div', {
                        className: `nav-item ${activePanel === 'folders' ? 'active' : ''}`,
                        onClick: () => setActivePanel('folders')
                    }, 'Folders to Scan'),
                    React.createElement('div', {
                        className: `nav-item ${activePanel === 'log' ? 'active' : ''}`,
                        onClick: () => setActivePanel('log')
                    }, 'View Log')
                ),
                React.createElement('div', { className: 'settings-footer' },
                    React.createElement('button', {
                        className: 'close-settings-btn',
                        onClick: onClose
                    }, 'Close Settings'),
                    React.createElement('div', { className: 'footer-credit' }, 'For personal use only - Free license', React.createElement('br'), 'Version: 0.7.0.b')
                )
            ),
            React.createElement('div', { className: 'settings-content' },
                activePanel === 'general' && React.createElement('div', { className: 'content-panel active' },
                    React.createElement('div', { className: 'panel-title' }, 'General Settings'),
                    React.createElement('div', { className: 'setting-group' },
                        React.createElement('div', { className: 'setting-row' },
                            React.createElement('div', { className: 'setting-label' },
                                React.createElement('span', null, 'Threshold')
                            ),
                            React.createElement('div', { className: 'threshold-control' },
                                React.createElement('div', { className: 'threshold-slider-wrapper' },
                                    React.createElement('input', {
                                        type: 'range',
                                        className: 'threshold-slider',
                                        min: '10',
                                        max: '90',
                                        value: threshold,
                                        onChange: (e) => {
                                            const val = parseInt(e.target.value);
                                            setThreshold(val);
                                            window.pywebview.api.set_threshold(val);
                                        }
                                    }),
                                    React.createElement('span', { className: 'threshold-value' }, `${threshold}%`)
                                ),
                                React.createElement('button', {
                                    className: 'recalibrate-btn',
                                    onClick: handleRecalibrate
                                }, 'Recalibrate')
                            )
                        )
                    ),
                    React.createElement('div', { className: 'setting-group' },
                        React.createElement('div', { className: 'setting-row' },
                            React.createElement('div', { className: 'setting-label' },
                                React.createElement('span', null, 'Use system resources dynamically')
                            ),
                            React.createElement('label', { className: 'toggle-switch' },
                                React.createElement('input', {
                                    type: 'checkbox',
                                    checked: settings.dynamicResources,
                                    onChange: async (e) => {
                                        const val = e.target.checked;
                                        setSettings({...settings, dynamicResources: val});
                                        await window.pywebview.api.set_dynamic_resources(val);
                                    }
                                }),
                                React.createElement('span', { className: 'toggle-slider' })
                            )
                        ),
                        React.createElement('div', { className: 'setting-row' },
                            React.createElement('div', { className: 'setting-label' },
                                React.createElement('span', null, 'Show single unmatched images')
                            ),
                            React.createElement('label', { className: 'toggle-switch' },
                                React.createElement('input', {
                                    type: 'checkbox',
                                    checked: settings.showUnmatched,
                                    onChange: async (e) => {
                                        const val = e.target.checked;
                                        setSettings({...settings, showUnmatched: val});
                                        await window.pywebview.api.set_show_unmatched(val);
                                        window.location.reload();
                                    }
                                }),
                                React.createElement('span', { className: 'toggle-slider' })
                            )
                        ),
                        React.createElement('div', { className: 'setting-row' },
                            React.createElement('div', { className: 'setting-label' },
                                React.createElement('span', null, 'Hide persons with less than')
                            ),
                            React.createElement('div', { className: 'min-photos-control' },
                                React.createElement('label', { className: 'toggle-switch' },
                                    React.createElement('input', {
                                        type: 'checkbox',
                                        checked: settings.minPhotosEnabled,
                                        onChange: async (e) => {
                                            const val = e.target.checked;
                                            setSettings({...settings, minPhotosEnabled: val});
                                            await window.pywebview.api.set_min_photos_enabled(val);
                                            window.location.reload();
                                        }
                                    }),
                                    React.createElement('span', { className: 'toggle-slider' })
                                ),
                                React.createElement('input', {
                                    type: 'number',
                                    className: 'min-photos-input',
                                    min: '0',
                                    max: '999',
                                    value: settings.minPhotosCount,
                                    disabled: !settings.minPhotosEnabled,
                                    onChange: async (e) => {
                                        const val = parseInt(e.target.value);
                                        if (val >= 0 && val <= 999) {
                                            setSettings({...settings, minPhotosCount: val});
                                            await window.pywebview.api.set_min_photos_count(val);
                                            window.location.reload();
                                        }
                                    }
                                }),
                                React.createElement('span', { style: { color: '#a0a0a0', fontSize: '13px' } }, 'photos')
                            )
                        ),
                        React.createElement('div', { className: 'setting-row' },
                            React.createElement('div', { className: 'setting-label' },
                                React.createElement('span', null, 'Show face tags in full screen image previews')
                            ),
                            React.createElement('label', { className: 'toggle-switch' },
                                React.createElement('input', {
                                    type: 'checkbox',
                                    checked: settings.showFaceTagsPreview,
                                    onChange: async (e) => {
                                        const val = e.target.checked;
                                        setSettings({...settings, showFaceTagsPreview: val});
                                        await window.pywebview.api.set_show_face_tags_preview(val);
                                    }
                                }),
                                React.createElement('span', { className: 'toggle-slider' })
                            )
                        ),
                        React.createElement('div', { className: 'setting-row' },
                            React.createElement('div', { className: 'setting-label' },
                                React.createElement('span', null, 'Close to tray')
                            ),
                            React.createElement('label', { className: 'toggle-switch' },
                                React.createElement('input', {
                                    type: 'checkbox',
                                    checked: settings.closeToTray,
                                    onChange: async (e) => {
                                        const val = e.target.checked;
                                        setSettings({...settings, closeToTray: val});
                                        await window.pywebview.api.set_close_to_tray(val);
                                    }
                                }),
                                React.createElement('span', { className: 'toggle-slider' })
                            )
                        ),
                        React.createElement('div', { className: 'setting-row' },
                            React.createElement('div', { className: 'setting-label' },
                                React.createElement('span', null, 'Show hidden person')
                            ),
                            React.createElement('label', { className: 'toggle-switch' },
                                React.createElement('input', {
                                    type: 'checkbox',
                                    checked: settings.showHidden,
                                    onChange: async (e) => {
                                        const val = e.target.checked;
                                        setSettings({...settings, showHidden: val});
                                        await window.pywebview.api.set_show_hidden(val);
                                        window.location.reload();
                                    }
                                }),
                                React.createElement('span', { className: 'toggle-slider' })
                            )
                        ),
                        React.createElement('div', { className: 'setting-row' },
                            React.createElement('div', { className: 'setting-label' },
                                React.createElement('span', null, 'Show hidden photos')
                            ),
                            React.createElement('label', { className: 'toggle-switch' },
                                React.createElement('input', {
                                    type: 'checkbox',
                                    checked: settings.showHiddenPhotos,
                                    onChange: async (e) => {
                                        const val = e.target.checked;
                                        setSettings({...settings, showHiddenPhotos: val});
                                        await window.pywebview.api.set_show_hidden_photos(val);
                                    }
                                }),
                                React.createElement('span', { className: 'toggle-slider' })
                            )
                        ),
                        React.createElement('div', { className: 'setting-row' },
                            React.createElement('div', { className: 'setting-label' },
                                React.createElement('span', null, 'Hide unnamed persons')
                            ),
                            React.createElement('label', { className: 'toggle-switch' },
                                React.createElement('input', {
                                    type: 'checkbox',
                                    checked: settings.hideUnnamed,
                                    onChange: async (e) => {
                                        const val = e.target.checked;
                                        setSettings({...settings, hideUnnamed: val});
                                        await window.pywebview.api.set_hide_unnamed_persons(val);
                                        window.location.reload();
                                    }
                                }),
                                React.createElement('span', { className: 'toggle-slider' })
                            )
                        ),
                        React.createElement('div', { className: 'setting-row' },
                            React.createElement('div', { className: 'setting-label' },
                                React.createElement('span', null, 'Find changes in photos in the drive')
                            ),
                            React.createElement('select', {
                                className: 'view-dropdown',
                                style: { minWidth: '200px' },
                                value: settings.scanFrequency,
                                onChange: async (e) => {
                                    const val = e.target.value;
                                    setSettings({...settings, scanFrequency: val});
                                    await window.pywebview.api.set_scan_frequency(val);
                                }
                            },
                                React.createElement('option', { value: 'every_restart' }, 'After Every restart'),
                                React.createElement('option', { value: 'restart_1_day' }, 'On Every Restart after 1 day'),
                                React.createElement('option', { value: 'restart_1_week' }, 'On Every Restart after 1 week'),
                                React.createElement('option', { value: 'manual' }, 'Manually (Not Recommended)')
                            )
                        ),
                        React.createElement('div', { className: 'setting-row' },
                            React.createElement('div', { className: 'setting-label' },
                                React.createElement('span', null, 'Show development options')
                            ),
                            React.createElement('label', { className: 'toggle-switch' },
                                React.createElement('input', {
                                    type: 'checkbox',
                                    checked: settings.showDevOptions,
                                    onChange: async (e) => {
                                        const val = e.target.checked;
                                        setSettings({...settings, showDevOptions: val});
                                        await window.pywebview.api.set_show_dev_options(val);
                                        window.location.reload();
                                    }
                                }),
                                React.createElement('span', { className: 'toggle-slider' })
                            )
                        )
                    )
                ),
                activePanel === 'folders' && React.createElement('div', { className: 'content-panel active' },
                    React.createElement('div', { className: 'panel-title' }, 'Folders to Scan'),
                    React.createElement('div', { className: 'folder-section' },
                        React.createElement('div', { className: 'folder-section-title' },
                            React.createElement('span', null, 'Include folders for scanning')
                        ),
                        React.createElement('div', { className: 'folder-list-container' },
                            includeFolders.length === 0 
                                ? React.createElement('div', { style: { color: '#606060', padding: '12px', textAlign: 'center', fontSize: '13px' } }, 'No folders added yet')
                                : includeFolders.map((folder, i) =>
                                    React.createElement('div', {
                                        key: i,
                                        className: `folder-item ${selectedInclude === i ? 'selected' : ''}`,
                                        onClick: () => setSelectedInclude(i)
                                    }, folder)
                                )
                        ),
                        React.createElement('div', { className: 'folder-controls' },
                            React.createElement('button', {
                                className: 'folder-btn',
                                onClick: handleAddInclude
                            },
                                React.createElement('span', null, '+'),
                                React.createElement('span', null, 'Add Folder')
                            ),
                            React.createElement('button', {
                                className: 'folder-btn remove',
                                onClick: handleRemoveInclude
                            },
                                React.createElement('span', null, '-'),
                                React.createElement('span', null, 'Remove Folder')
                            )
                        )
                    ),
                    React.createElement('div', { className: 'folder-section' },
                        React.createElement('div', { className: 'folder-section-title' },
                            React.createElement('span', null, 'Exclude subfolders from scanning')
                        ),
                        React.createElement('div', { className: 'folder-list-container' },
                            excludeFolders.length === 0
                                ? React.createElement('div', { style: { color: '#606060', padding: '12px', textAlign: 'center', fontSize: '13px' } }, 'No folders excluded yet')
                                : excludeFolders.map((folder, i) =>
                                    React.createElement('div', {
                                        key: i,
                                        className: `folder-item ${selectedExclude === i ? 'selected' : ''}`,
                                        onClick: () => setSelectedExclude(i)
                                    }, folder)
                                )
                        ),
                        React.createElement('div', { className: 'folder-controls' },
                            React.createElement('button', {
                                className: 'folder-btn',
                                onClick: handleAddExclude
                            },
                                React.createElement('span', null, '+'),
                                React.createElement('span', null, 'Add Folder')
                            ),
                            React.createElement('button', {
                                className: 'folder-btn remove',
                                onClick: handleRemoveExclude
                            },
                                React.createElement('span', null, '-'),
                                React.createElement('span', null, 'Remove Folder')
                            )
                        )
                    ),
                    React.createElement('div', { className: 'folder-section' },
                        React.createElement('div', { className: 'folder-section-title' },
                            React.createElement('span', null, 'Wildcard Exclusion')
                        ),
                        React.createElement('input', {
                            type: 'text',
                            className: 'wildcard-input',
                            placeholder: 'e.g., *.gif, *thumbnail, *cache*, C:\\Photos\\private photos',
                            value: wildcardInput,
                            onChange: async (e) => {
                                const val = e.target.value;
                                setWildcardInput(val);
                                await window.pywebview.api.set_wildcard_exclusions(val);
                            }
                        })
                    ),
                    React.createElement('div', { className: 'folder-section' },
                        React.createElement('button', {
                            className: 'recalibrate-btn',
                            style: { width: '100%', padding: '12px' },
                            onClick: handleRescan
                        }, 'Rescan For Changes')
                    )
                ),
                activePanel === 'log' && React.createElement('div', { className: 'content-panel active' },
                    React.createElement('div', { className: 'panel-title' }, 'View Log'),
                    React.createElement('div', { className: 'log-viewer', id: 'logViewer' },
                        React.createElement('div', { className: 'log-entry' }, 'Application started')
                    )
                )
            )
        )
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
    const [sortMode, setSortMode] = useState('names_asc');
    const [contextMenu, setContextMenu] = useState(null);
    const [lightbox, setLightbox] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [activeSettingsPanel, setActiveSettingsPanel] = useState('general');
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMorePhotos, setHasMorePhotos] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [progressInfo, setProgressInfo] = useState({
        visible: false,
        percent: 0,
        text: 'Initializing...'
    });
    const [statusInfo, setStatusInfo] = useState({
        pytorch: 'PyTorch',
        gpu: 'Checking...',
        cuda: 'CUDA: N/A',
        faces: 'Found: 0 faces'
    });
    
    const gridContainerRef = useRef(null);

    useEffect(() => {
        if (window.pywebview) {
            loadAllSettings();
            loadPeople();
            loadSystemInfo();
            
            window.updateStatusMessage = (msg) => {
                addLogEntry(msg);
            };
            
            window.updateProgress = (current, total, percent) => {
                setProgressInfo({
                    visible: true,
                    percent: percent,
                    text: `Scanning: ${current}/${total}`
                });
            };
            
            window.hideProgress = () => {
                setProgressInfo({...progressInfo, visible: false});
                loadPeople();
            };
            
            window.loadPeople = loadPeople;
            window.reloadCurrentPhotos = reloadCurrentPhotos;
        }
    }, []);

    const addLogEntry = (message) => {
        const logViewer = document.getElementById('logViewer');
        if (logViewer) {
            const now = new Date();
            const timestamp = now.toLocaleString();
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.textContent = `[${timestamp}] ${message}`;
            logViewer.appendChild(entry);
            logViewer.scrollTop = logViewer.scrollHeight;
        }
    };

    const loadSystemInfo = async () => {
        const info = await window.pywebview.api.get_system_info();
        setStatusInfo({
            pytorch: `PyTorch ${info.pytorch_version}`,
            gpu: info.gpu_available ? 'GPU Available' : 'CPU Only',
            cuda: `CUDA: ${info.cuda_version}`,
            faces: `Found: ${info.total_faces} faces`
        });
    };

    const loadAllSettings = async () => {
        const gridSizeValue = await window.pywebview.api.get_grid_size();
        const viewModeValue = await window.pywebview.api.get_view_mode();
        const sortModeValue = await window.pywebview.api.get_sort_mode();
        
        setGridSize(gridSizeValue);
        setViewMode(viewModeValue);
        setSortMode(sortModeValue);
    };

    const loadPeople = async () => {
        const peopleData = await window.pywebview.api.get_people();
        setPeople(peopleData);
        if (peopleData.length > 0 && !currentPerson) {
            const firstPerson = peopleData.find(p => p.id !== 0) || peopleData[0];
            selectPerson(firstPerson);
        }
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

    const reloadCurrentPhotos = async () => {
        if (currentPerson) {
            setAllPhotos([]);
            setCurrentPage(1);
            setHasMorePhotos(true);
            await loadPhotos(currentPerson, 1, true);
        }
    };

    const visiblePhotos = useMemo(() => {
        return allPhotos;
    }, [allPhotos]);

    const sortedPeople = useMemo(() => {
        const sorted = [...people];
        switch(sortMode) {
            case 'names_asc':
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'names_desc':
                sorted.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'photos_asc':
                sorted.sort((a, b) => a.count - b.count);
                break;
            case 'photos_desc':
                sorted.sort((a, b) => b.count - a.count);
                break;
        }
        return sorted;
    }, [people, sortMode]);

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

    const handlePhotoKebabClick = (e, photo) => {
        const hasSelection = selectedPhotos.size > 0;
        const isPhotoSelected = selectedPhotos.has(photo.face_id);
        
        if (hasSelection && !isPhotoSelected) {
            const newSelection = new Set(selectedPhotos);
            newSelection.add(photo.face_id);
            setSelectedPhotos(newSelection);
        }
        
        const count = selectedPhotos.size + (isPhotoSelected ? 0 : 1);
        const items = hasSelection ? [
            { label: `Remove/Transfer Tag (${count} photos)`, action: 'transfer', data: photo },
            { label: photo.is_hidden ? `Unhide photo (${count} photos)` : `Hide photo (${count} photos)`, action: photo.is_hidden ? 'unhide' : 'hide', data: photo }
        ] : [
            { label: 'Make primary photo', action: 'primary', data: photo },
            { label: 'Remove/Transfer Tag', action: 'transfer', data: photo },
            { label: photo.is_hidden ? 'Unhide photo' : 'Hide photo', action: photo.is_hidden ? 'unhide' : 'hide', data: photo }
        ];
        
        const rect = e.currentTarget.getBoundingClientRect();
        setContextMenu({
            x: rect.right - 200,
            y: rect.bottom + 4,
            items
        });
    };

    const handlePersonKebabClick = (e, person) => {
        const items = person.is_hidden ? [
            { label: 'Rename', action: 'rename', data: person },
            { label: 'Unhide person', action: 'unhide_person', data: person }
        ] : [
            { label: 'Rename', action: 'rename', data: person },
            { label: 'Hide person', action: 'hide_person', data: person }
        ];
        
        const rect = e.currentTarget.getBoundingClientRect();
        setContextMenu({
            x: rect.right - 200,
            y: rect.bottom + 4,
            items
        });
    };

    const handleFilterClick = (e) => {
        const items = [
            { label: 'By Names (A to Z)', action: 'sort_names_asc' },
            { label: 'By Names (Z to A)', action: 'sort_names_desc' },
            { label: 'By Photos (Low to High)', action: 'sort_photos_asc' },
            { label: 'By Photos (High to Low)', action: 'sort_photos_desc' }
        ];
        
        const rect = e.currentTarget.getBoundingClientRect();
        setContextMenu({
            x: rect.left,
            y: rect.bottom + 4,
            items
        });
    };

    const handleContextAction = async (action, data) => {
        setContextMenu(null);
        
        if (action.startsWith('sort_')) {
            const mode = action.replace('sort_', '');
            setSortMode(mode);
            await window.pywebview.api.set_sort_mode(mode);
            return;
        }
        
        if (action === 'hide_person') {
            await window.pywebview.api.hide_person(data.clustering_id, data.id);
            loadPeople();
            return;
        }
        
        if (action === 'unhide_person') {
            await window.pywebview.api.unhide_person(data.clustering_id, data.id);
            loadPeople();
            return;
        }
        
        const faceIds = selectedPhotos.size > 0 ? Array.from(selectedPhotos) : [data.face_id];
        
        switch(action) {
            case 'primary':
                await window.pywebview.api.set_primary_photo(currentPerson.name, data.face_id);
                loadPeople();
                break;
            case 'hide':
                for (const faceId of faceIds) {
                    await window.pywebview.api.hide_photo(faceId);
                }
                clearSelection();
                await reloadCurrentPhotos();
                break;
            case 'unhide':
                for (const faceId of faceIds) {
                    await window.pywebview.api.unhide_photo(faceId);
                }
                clearSelection();
                await reloadCurrentPhotos();
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

    return React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'title-bar' },
            React.createElement('div', { className: 'title-bar-drag', style: { WebkitAppRegion: 'drag' } },
                React.createElement('div', { className: 'title-bar-title' }, 'Face Recognition Photo Organizer')
            ),
            React.createElement('div', { className: 'title-bar-controls' },
                React.createElement('button', {
                    className: 'title-bar-btn minimize-btn',
                    onClick: () => window.pywebview.api.minimize_window()
                },
                    React.createElement('svg', { width: '12', height: '12', viewBox: '0 0 12 12' },
                        React.createElement('rect', { x: '0', y: '5', width: '12', height: '2', fill: 'currentColor' })
                    )
                ),
                React.createElement('button', {
                    className: 'title-bar-btn maximize-btn',
                    onClick: () => window.pywebview.api.maximize_window()
                },
                    React.createElement('svg', { width: '12', height: '12', viewBox: '0 0 12 12' },
                        React.createElement('rect', { x: '1', y: '1', width: '10', height: '10', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5' })
                    )
                ),
                React.createElement('button', {
                    className: 'title-bar-btn close-btn',
                    onClick: () => window.pywebview.api.close_window()
                },
                    React.createElement('svg', { width: '12', height: '12', viewBox: '0 0 12 12' },
                        React.createElement('path', { d: 'M1 1 L11 11 M11 1 L1 11', stroke: 'currentColor', strokeWidth: '1.5' })
                    )
                )
            )
        ),
        
        React.createElement('div', { className: 'app-container' },
            React.createElement('div', { className: 'main-content' },
                React.createElement('div', { className: 'sidebar' },
                    React.createElement('div', { className: 'sidebar-header' },
                        React.createElement('div', { className: 'sidebar-title-row' },
                            React.createElement('div', { className: 'sidebar-title' }, 'People'),
                            React.createElement('div', { className: 'sidebar-controls' },
                                React.createElement('button', {
                                    className: 'icon-btn',
                                    onClick: handleFilterClick,
                                    title: 'Filter'
                                },
                                    React.createElement('div', { className: 'doner-icon' },
                                        React.createElement('div', { className: 'doner-line' }),
                                        React.createElement('div', { className: 'doner-line' }),
                                        React.createElement('div', { className: 'doner-line' })
                                    )
                                ),
                                React.createElement('button', {
                                    className: 'icon-btn',
                                    title: 'Jump to'
                                },
                                    React.createElement('div', { className: 'bento-icon' },
                                        React.createElement('div', { className: 'bento-dot' }),
                                        React.createElement('div', { className: 'bento-dot' }),
                                        React.createElement('div', { className: 'bento-dot' }),
                                        React.createElement('div', { className: 'bento-dot' }),
                                        React.createElement('div', { className: 'bento-dot' }),
                                        React.createElement('div', { className: 'bento-dot' }),
                                        React.createElement('div', { className: 'bento-dot' }),
                                        React.createElement('div', { className: 'bento-dot' }),
                                        React.createElement('div', { className: 'bento-dot' })
                                    )
                                )
                            )
                        )
                    ),
                    React.createElement('div', { className: 'people-list' },
                        sortedPeople.map(person =>
                            React.createElement('div', {
                                key: person.id,
                                className: `person-item ${currentPerson?.id === person.id ? 'active' : ''}`,
                                onClick: () => selectPerson(person)
                            },
                                person.thumbnail ? React.createElement('img', {
                                    src: person.thumbnail,
                                    className: 'person-avatar',
                                    alt: person.name,
                                    style: {
                                        width: '44px',
                                        height: '44px',
                                        objectFit: 'cover',
                                        borderRadius: '50%'
                                    }
                                }) : React.createElement('div', {
                                    className: 'person-avatar',
                                    style: {
                                        background: `linear-gradient(135deg, ${getPersonColor(person.id)} 0%, ${getPersonColor(person.id)}99 100%)`
                                    }
                                }, person.name.charAt(0)),
                                React.createElement('div', { className: 'person-info' },
                                    React.createElement('div', { className: 'person-name' }, person.name),
                                    React.createElement('div', { className: 'person-count' }, `${person.count} photos`)
                                ),
                                React.createElement('button', {
                                    className: 'kebab-menu',
                                    onClick: (e) => {
                                        e.stopPropagation();
                                        handlePersonKebabClick(e, person);
                                    }
                                },
                                    React.createElement('span', { className: 'kebab-dot' }),
                                    React.createElement('span', { className: 'kebab-dot' }),
                                    React.createElement('span', { className: 'kebab-dot' })
                                )
                            )
                        )
                    )
                ),
                
                React.createElement('div', { className: 'content-area' },
                    React.createElement('div', { className: 'content-header' },
                        React.createElement('div', { className: 'content-title' },
                            currentPerson ? `${currentPerson.name}'s Photos` : 'Select a person'
                        ),
                        React.createElement('div', { className: 'content-controls' },
                            React.createElement('div', { className: 'size-control' },
                                React.createElement('span', { className: 'size-label' }, 'Size:'),
                                React.createElement('input', {
                                    type: 'range',
                                    className: 'size-slider',
                                    min: '100',
                                    max: '300',
                                    value: gridSize,
                                    onChange: (e) => {
                                        const size = parseInt(e.target.value);
                                        setGridSize(size);
                                        window.pywebview.api.set_grid_size(size);
                                    }
                                })
                            ),
                            React.createElement('select', {
                                className: 'view-dropdown',
                                value: viewMode,
                                onChange: async (e) => {
                                    const mode = e.target.value;
                                    setViewMode(mode);
                                    await window.pywebview.api.set_view_mode(mode);
                                    if (currentPerson) {
                                        await reloadCurrentPhotos();
                                    }
                                }
                            },
                                React.createElement('option', { value: 'entire_photo' }, 'Show entire photo'),
                                React.createElement('option', { value: 'zoom_to_faces' }, 'Zoom to tagged faces')
                            )
                        )
                    ),
                    
                    React.createElement('div', { ref: gridContainerRef, className: 'photo-grid-container' },
                        currentPerson && visiblePhotos.length > 0 && React.createElement(VirtualPhotoGrid, {
                            photos: visiblePhotos,
                            gridSize: gridSize,
                            containerRef: gridContainerRef,
                            selectedPhotos: selectedPhotos,
                            onPhotoClick: handlePhotoClick,
                            onPhotoDoubleClick: handlePhotoDoubleClick,
                            onKebabClick: handlePhotoKebabClick,
                            onLoadMore: handleLoadMore,
                            isLoading: isLoadingMore,
                            hasMore: hasMorePhotos
                        })
                    )
                )
            ),
            
            React.createElement('div', { className: 'bottom-bar' },
                React.createElement('div', { className: 'bottom-content' },
                    React.createElement('button', {
                        className: 'settings-btn',
                        onClick: () => setSettingsOpen(true)
                    }, 'Settings'),
                    progressInfo.visible && React.createElement('div', { className: 'progress-section' },
                        React.createElement('div', { className: 'progress-bar' },
                            React.createElement('div', { className: 'progress-fill', style: { width: `${progressInfo.percent}%` } })
                        ),
                        React.createElement('div', { className: 'progress-text' }, progressInfo.text)
                    )
                ),
                React.createElement('div', { className: 'status-bar' },
                    React.createElement('div', { className: 'status-info' },
                        React.createElement('span', { className: 'status-badge' },
                            React.createElement('span', { className: 'status-indicator' }),
                            React.createElement('span', null, statusInfo.pytorch)
                        ),
                        React.createElement('span', null, statusInfo.gpu),
                        React.createElement('span', null, statusInfo.cuda),
                        React.createElement('span', null, statusInfo.faces)
                    ),
                    React.createElement('button', { className: 'help-btn', title: 'Quick Help' },
                        React.createElement('svg', { width: '14', height: '14', viewBox: '0 0 14 14' },
                            React.createElement('circle', { cx: '7', cy: '7', r: '6', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5' }),
                            React.createElement('path', { d: 'M5 5.5 C5 4 6 3.5 7 3.5 C8 3.5 9 4 9 5.5 C9 6.5 8 7 7 7 L7 8.5', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5' }),
                            React.createElement('circle', { cx: '7', cy: '10.5', r: '0.5', fill: 'currentColor' })
                        )
                    )
                )
            )
        ),
        
        selectedPhotos.size > 0 && React.createElement('div', { className: 'selection-info show' },
            React.createElement('div', { className: 'selection-info-text' },
                React.createElement('span', null, selectedPhotos.size),
                ' photos selected',
                React.createElement('button', { className: 'clear-selection-btn', onClick: clearSelection }, 'Clear')
            )
        ),
        
        React.createElement(SettingsDialog, {
            active: settingsOpen,
            onClose: () => setSettingsOpen(false),
            activePanel: activeSettingsPanel,
            setActivePanel: setActiveSettingsPanel
        }),
        
        contextMenu && React.createElement(ContextMenu, {
            x: contextMenu.x,
            y: contextMenu.y,
            items: contextMenu.items,
            onClose: () => setContextMenu(null),
            onAction: handleContextAction
        }),
        
        lightbox && React.createElement(Lightbox, {
            photos: visiblePhotos,
            currentIndex: lightbox.currentIndex,
            onClose: () => setLightbox(null),
            onPrev: () => setLightbox(prev => ({ currentIndex: Math.max(0, prev.currentIndex - 1) })),
            onNext: () => setLightbox(prev => ({ currentIndex: Math.min(visiblePhotos.length - 1, prev.currentIndex + 1) })),
            onOpenExternal: () => window.pywebview.api.open_photo(visiblePhotos[lightbox.currentIndex].path)
        })
    );
};

window.addEventListener('pywebviewready', () => {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App));
});