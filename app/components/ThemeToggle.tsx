'use client';

import React, { useEffect, useState } from 'react';
import styles from '../fileserver.module.scss';

const ThemeToggle = () => {
    const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');

    useEffect(() => {
        // Check for saved theme preference
        const savedTheme = localStorage.getItem('theme');

        console.log(savedTheme);

        // Check system preference if no saved preference
        if (!savedTheme) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setIsDarkMode(prefersDark);
            localStorage.setItem('theme', prefersDark ? 'dark' : 'light');
        } else {
            setIsDarkMode(savedTheme === 'dark');
        }
    }, []);

    useEffect(() => {
        // Apply theme class to the themeVariables container
        const container = document.querySelector(`.${styles.themeVariables}`);
        if (container) {
            if (isDarkMode) {
                container.classList.add(styles.darkTheme);
            } else {
                container.classList.remove(styles.darkTheme);
            }
        }

        // Save preference
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode, styles.darkTheme, styles.themeVariables]);

    return (
        <button
            className={styles.themeToggle}
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
        >
            {isDarkMode ? '☀️' : '🌙'}
        </button>
    );
};

export default ThemeToggle;