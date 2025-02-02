import React, { useState, useEffect, useRef } from 'react';
import config from '../config';

const styles = {
    container: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: config.theme.spacing.sm,
        padding: config.theme.spacing.sm,
        backgroundColor: config.theme.colors.background,
        border: `1px solid ${config.theme.colors.border}`,
        borderRadius: config.theme.radius.md,
        minHeight: '40px'
    },
    tag: {
        display: 'flex',
        alignItems: 'center',
        gap: config.theme.spacing.xs,
        padding: `${config.theme.spacing.xs} ${config.theme.spacing.sm}`,
        backgroundColor: config.theme.colors.primary,
        color: '#fff',
        borderRadius: config.theme.radius.sm,
        fontSize: config.theme.fontSize.sm
    },
    input: {
        flex: 1,
        minWidth: '100px',
        border: 'none',
        outline: 'none',
        backgroundColor: 'transparent',
        color: config.theme.colors.text.primary,
        fontSize: config.theme.fontSize.md
    },
    removeButton: {
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.7)',
        cursor: 'pointer',
        padding: '0 4px',
        fontSize: config.theme.fontSize.sm,
        '&:hover': {
            color: '#fff'
        }
    },
    suggestions: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: config.theme.colors.surface,
        border: `1px solid ${config.theme.colors.border}`,
        borderRadius: config.theme.radius.md,
        marginTop: config.theme.spacing.xs,
        maxHeight: '200px',
        overflowY: 'auto',
        zIndex: 1000
    },
    suggestion: {
        padding: config.theme.spacing.sm,
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: config.theme.colors.primary
        }
    }
};

const TagInput = ({ value = [], onChange, suggestions = [], onFetchSuggestions }) => {
    const [inputValue, setInputValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        if (onFetchSuggestions) {
            onFetchSuggestions(newValue);
        }
        setShowSuggestions(true);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && inputValue) {
            e.preventDefault();
            if (!value.includes(inputValue.toLowerCase())) {
                onChange([...value, inputValue.toLowerCase()]);
            }
            setInputValue('');
            setShowSuggestions(false);
        } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
            onChange(value.slice(0, -1));
        }
    };

    const removeTag = (tagToRemove) => {
        onChange(value.filter(tag => tag !== tagToRemove));
    };

    const addSuggestion = (suggestion) => {
        if (!value.includes(suggestion.toLowerCase())) {
            onChange([...value, suggestion.toLowerCase()]);
        }
        setInputValue('');
        setShowSuggestions(false);
    };

    return (
        <div style={{ position: 'relative' }} ref={containerRef}>
            <div style={styles.container}>
                {value.map(tag => (
                    <span key={tag} style={styles.tag}>
                        {tag}
                        <button
                            onClick={() => removeTag(tag)}
                            style={styles.removeButton}
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Add tags..."
                    style={styles.input}
                />
            </div>
            {showSuggestions && suggestions.length > 0 && (
                <div style={styles.suggestions}>
                    {suggestions.map(suggestion => (
                        <div
                            key={suggestion}
                            style={styles.suggestion}
                            onClick={() => addSuggestion(suggestion)}
                        >
                            {suggestion}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TagInput; 