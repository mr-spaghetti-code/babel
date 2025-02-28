// babel-3d-integration.js
// Integration between the 3D experience and the Library of Babel

// Store room identifiers for each hexagonal coordinate
const roomIdentifiers = new Map();

// Store book content for each book in each room
const bookContents = new Map();

// Current book being viewed
let currentBook = null;
let currentPage = 1;

// Book viewer element
let bookViewerElement = null;

// Event handler for escape key
let escapeKeyHandler = null;

// Book content cache
const bookContentCache = {};

// Flag to track if server API is available
let serverApiAvailable = true;

// English words list for highlighting
let englishWords = null;

/**
 * Fetch the list of English words for highlighting
 */
async function fetchEnglishWords() {
    if (englishWords !== null) {
        return englishWords;
    }
    
    try {
        const response = await fetch('/words.txt');
        if (!response.ok) {
            console.error(`Could not fetch words: ${response.status} ${response.statusText}`);
            return [];
        }
        
        const text = await response.text();
        englishWords = text.split('\n').filter(word => word.trim().length > 1);
        return englishWords;
    } catch (error) {
        console.error('Error fetching English words:', error);
        return [];
    }
}

/**
 * Create the book viewer HTML if it doesn't exist
 */
function createBookViewerHTML() {
    // Check if the book viewer already exists
    if (document.getElementById('book-viewer')) {
        return;
    }
    
    // Create the book viewer container
    const bookViewer = document.createElement('div');
    bookViewer.id = 'book-viewer';
    bookViewer.className = 'book-viewer hidden';
    
    // Create the book viewer content
    bookViewer.innerHTML = `
        <div class="book-viewer-header">
            <h2>Book Viewer</h2>
            <button id="close-book" class="close-button" style="cursor: pointer;">×</button>
        </div>
        <div class="book-viewer-content">
            <div id="book-identifier" class="book-identifier"></div>
            <div id="book-content" class="book-content"></div>
            <div class="book-navigation">
                <button id="prev-page" class="nav-button" style="cursor: pointer;">Previous Page</button>
                <span id="page-number" class="page-number"></span>
                <button id="next-page" class="nav-button" style="cursor: pointer;">Next Page</button>
            </div>
        </div>
    `;
    
    // Add the book viewer to the document
    document.body.appendChild(bookViewer);
    
    // Add styles if they don't exist
    if (!document.getElementById('book-viewer-styles')) {
        const styles = document.createElement('style');
        styles.id = 'book-viewer-styles';
        styles.textContent = `
            .book-viewer {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 80%;
                max-width: 800px;
                height: 80%;
                max-height: 600px;
                background-color: #f5f5dc;
                border: 2px solid #8b4513;
                border-radius: 5px;
                z-index: 1000;
                display: flex;
                flex-direction: column;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                font-family: 'Times New Roman', Times, serif;
            }
            
            .hidden {
                display: none !important;
            }
            
            .book-viewer-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 20px;
                background-color: #8b4513;
                color: #f5f5dc;
                border-bottom: 1px solid #5e2e0d;
            }
            
            .book-viewer-header h2 {
                margin: 0;
                font-size: 1.5em;
            }
            
            .close-button {
                background: none;
                border: none;
                color: #f5f5dc;
                font-size: 1.5em;
                cursor: pointer;
            }
            
            .book-viewer-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                padding: 20px;
                overflow: hidden;
            }
            
            .book-identifier {
                font-size: 0.9em;
                color: #8b4513;
                margin-bottom: 10px;
                font-style: italic;
            }
            
            .book-content {
                flex: 1;
                overflow-y: auto;
                padding: 10px;
                background-color: #fff;
                border: 1px solid #ddd;
                line-height: 1.6;
                white-space: pre-wrap;
                font-size: 1.1em;
                cursor: text;
            }
            
            .book-navigation {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 10px;
            }
            
            .nav-button {
                background-color: #8b4513;
                color: #f5f5dc;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                cursor: pointer;
            }
            
            .nav-button:disabled {
                background-color: #ccc;
                cursor: not-allowed;
            }
            
            .page-number {
                font-size: 0.9em;
                color: #8b4513;
            }
            
            .highlighted-word {
                background-color: rgba(255, 255, 0, 0.3);
                border-radius: 2px;
                padding: 0 2px;
                margin: 0 -2px;
            }
        `;
        document.head.appendChild(styles);
    }
}

/**
 * Initialize the book viewer UI
 */
function initBookViewer() {
    // Create the book viewer HTML if it doesn't exist
    createBookViewerHTML();
    
    // Get the book viewer element
    bookViewerElement = document.getElementById('book-viewer');
    
    // Set up event listeners
    document.getElementById('prev-page').addEventListener('click', prevPage);
    document.getElementById('next-page').addEventListener('click', nextPage);
    document.getElementById('close-book').addEventListener('click', closeBookViewer);
    
    // Initialize the escape key handler
    escapeKeyHandler = (event) => {
        if (event.key === 'Escape' && !bookViewerElement.classList.contains('hidden')) {
            closeBookViewer();
        }
    };
    
    // Hide the book viewer initially
    bookViewerElement.classList.add('hidden');
}

/**
 * Initialize when the DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    initBookViewer();
});

/**
 * Add CSS styles for the book viewer
 */
function addBookViewerStyles() {
    const style = document.createElement('style');
    style.textContent = `
        #book-viewer {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 80%;
            max-width: 800px;
            height: 80%;
            background-color: #f8f4e5;
            border: 2px solid #5c4033;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            z-index: 1000;
            font-family: 'Times New Roman', serif;
            padding: 20px;
            overflow: hidden;
        }
        
        #book-viewer.hidden {
            display: none;
        }
        
        #book-content {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            font-size: 16px;
            line-height: 1.6;
            white-space: pre-wrap;
            background-color: #fff;
            border: 1px solid #ddd;
            margin-bottom: 10px;
        }
        
        #book-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-top: 1px solid #ddd;
        }
        
        #book-controls button {
            background-color: #5c4033;
            color: white;
            border: none;
            padding: 8px 15px;
            cursor: pointer;
            font-family: inherit;
        }
        
        #book-controls button:hover {
            background-color: #7d5642;
        }
        
        #close-book {
            position: absolute;
            top: 10px;
            right: 10px;
            background-color: transparent !important;
            color: #5c4033 !important;
            font-size: 20px;
            padding: 5px 10px !important;
        }
        
        #book-identifier {
            font-size: 12px;
            color: #666;
            text-align: center;
            margin-top: 10px;
            word-break: break-all;
        }
        
        #page-indicator {
            font-style: italic;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Generate a shorter random room identifier
 * @returns {string} A random alphanumeric string of reasonable length
 */
function generateShortRandomIdentifier() {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    const length = 8 + Math.floor(Math.random() * 8); // 8-16 characters
    let result = '';
    
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
}

/**
 * Fetch a random room identifier from the server
 */
async function fetchRandomIdentifier() {
    try {
        // Instead of fetching from server, generate a shorter identifier locally
        const shortIdentifier = generateShortRandomIdentifier();
        
        // Format: room.wall.shelf.book.page
        return `${shortIdentifier}.1.1.1.1`;
    } catch (error) {
        console.error('Error generating random identifier:', error);
        // Fallback to a default identifier if there's an error
        return 'abc123.1.1.1.1';
    }
}

/**
 * Generate deterministic content for a book based on its identifier
 * @param {string} identifier - The book identifier in format room.wall.shelf.book.page
 * @returns {Promise<object>} The book content object
 */
function generateBookContent(identifier) {
    const [room, wall, shelf, book, page] = identifier.split('.');
    
    // If we already know the server API is unavailable, use fallback immediately
    if (!serverApiAvailable) {
        return Promise.resolve(generateFallbackContent(identifier));
    }
    
    // Try to fetch from the server first
    return fetchContentFromServer(identifier)
        .then(content => {
            return content;
        })
        .catch(error => {
            console.warn('Failed to fetch content from server, using fallback generation:', error);
            // Mark the server API as unavailable after a failure
            serverApiAvailable = false;
            
            // After 30 seconds, try the server again
            setTimeout(() => {
                serverApiAvailable = true;
            }, 30000);
            
            return generateFallbackContent(identifier);
        });
}

/**
 * Fetch content from the server API
 * @param {string} identifier - The book identifier
 * @returns {Promise<object>} The book content object
 */
async function fetchContentFromServer(identifier) {
    try {
        // Add a timeout to the fetch to avoid hanging if the server is unresponsive
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`/api/book-content/${identifier}`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // If we don't have the expected data structure, throw an error
        if (!data.content) {
            throw new Error('Invalid response from server: missing content');
        }
        
        return {
            content: data.content,
            totalPages: 410,
            roomShort: data.roomShort || room,
            room: data.room || room,
            wall: data.wall || wall,
            shelf: data.shelf || shelf,
            book: data.book || book,
            page: data.page || page,
            nextIdentifier: data.nextIdentifier || generateNextIdentifier(identifier),
            prevIdentifier: data.prevIdentifier || generatePrevIdentifier(identifier)
        };
    } catch (error) {
        console.error('Error fetching content from server:', error);
        throw error;
    }
}

/**
 * Generate fallback content when server is unavailable
 * @param {string} identifier - The book identifier
 * @returns {object} The book content object
 */
function generateFallbackContent(identifier) {
    const [room, wall, shelf, book, page] = identifier.split('.');
    const requestedPage = parseInt(page);
    
    // Create a seed from the identifier for deterministic content
    let baseSeed = 0;
    for (let i = 0; i < room.length; i++) {
        baseSeed = ((baseSeed << 5) - baseSeed) + room.charCodeAt(i);
        baseSeed = baseSeed & baseSeed; // Convert to 32bit integer
    }
    
    // Add wall, shelf, and book to the base seed
    baseSeed = Math.abs(baseSeed) + (parseInt(wall) * 1000) + (parseInt(shelf) * 100) + (parseInt(book) * 10);
    
    // Generate a single page of content
    function generatePageContent(pageNum) {
        // Create a unique seed for this specific page
        // Multiply by a large prime to ensure different pages have very different seeds
        let pageSeed = baseSeed * 31 + pageNum * 7919;
        
        // Use the seed to generate deterministic "random" content
        const seededRandom = function() {
            pageSeed = (pageSeed * 9301 + 49297) % 233280;
            return pageSeed / 233280;
        };
        
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        const punctuation = '.,!?;:';
        let pageContent = '';
        const maxLines = 40;
        const lineLength = 80;
        
        // Generate content line by line
        for (let line = 0; line < maxLines; line++) {
            let lineContent = '';
            
            // Fill the line with words and punctuation
            while (lineContent.length < lineLength - 12) { // Leave room for the longest possible word
                // Generate a word (3-12 characters)
                const wordLength = Math.floor(seededRandom() * 10) + 3;
                let word = '';
                
                for (let i = 0; i < wordLength; i++) {
                    const charIndex = Math.floor(seededRandom() * chars.length);
                    word += chars[charIndex];
                }
                
                // Add the word
                lineContent += word;
                
                // If adding another word would exceed line length, break
                if (lineContent.length >= lineLength - 2) {
                    break;
                }
                
                // Add punctuation occasionally (10% chance)
                if (seededRandom() < 0.1) {
                    const punctIndex = Math.floor(seededRandom() * punctuation.length);
                    lineContent += punctuation[punctIndex];
                    
                    // Add a space after punctuation
                    lineContent += ' ';
                } else {
                    // Just add a space between words
                    lineContent += ' ';
                }
            }
            
            // Add the line to the page content
            pageContent += lineContent.trim() + '\n';
        }
        
        return pageContent;
    }
    
    // Generate the requested page
    const content = generatePageContent(requestedPage);
    
    return {
        content: content,
        totalPages: 410,
        roomShort: room.length > 16 ? room.substring(0, 8) + '...' + room.substring(room.length - 8) : room,
        room: room,
        wall: wall,
        shelf: shelf,
        book: book,
        page: page,
        nextIdentifier: generateNextIdentifier(identifier),
        prevIdentifier: generatePrevIdentifier(identifier)
    };
}

/**
 * Generate the next page identifier
 */
function generateNextIdentifier(identifier) {
    const [room, wall, shelf, book, page] = identifier.split('.').map((part, index) => index === 4 ? parseInt(part) : part);
    
    let nextPage = parseInt(page) + 1;
    let nextBook = book;
    let nextShelf = shelf;
    let nextWall = wall;
    
    if (nextPage > 410) {
        nextPage = 1;
        nextBook = parseInt(nextBook) + 1;
        
        if (nextBook > 32) {
            nextBook = 1;
            nextShelf = parseInt(nextShelf) + 1;
            
            if (nextShelf > 5) {
                nextShelf = 1;
                nextWall = parseInt(nextWall) + 1;
                
                if (nextWall > 4) {
                    nextWall = 1;
                    // Room stays the same, we just wrap around
                }
            }
        }
    }
    
    return `${room}.${nextWall}.${nextShelf}.${nextBook}.${nextPage}`;
}

/**
 * Generate the previous page identifier
 */
function generatePrevIdentifier(identifier) {
    const [room, wall, shelf, book, page] = identifier.split('.').map((part, index) => index === 4 ? parseInt(part) : part);
    
    let prevPage = parseInt(page) - 1;
    let prevBook = book;
    let prevShelf = shelf;
    let prevWall = wall;
    
    if (prevPage < 1) {
        prevPage = 410;
        prevBook = parseInt(prevBook) - 1;
        
        if (prevBook < 1) {
            prevBook = 32;
            prevShelf = parseInt(prevShelf) - 1;
            
            if (prevShelf < 1) {
                prevShelf = 5;
                prevWall = parseInt(prevWall) - 1;
                
                if (prevWall < 1) {
                    prevWall = 4;
                    // Room stays the same, we just wrap around
                }
            }
        }
    }
    
    return `${room}.${prevWall}.${prevShelf}.${prevBook}.${prevPage}`;
}

/**
 * Fetch book content for a specific identifier
 */
async function fetchBookContent(identifier) {
    try {
        // Use our generateBookContent function which tries server first, then fallback
        return await generateBookContent(identifier);
    } catch (error) {
        console.error('Error fetching book content:', error);
        // Return placeholder content if there's an error
        return generateFallbackContent(identifier);
    }
}

/**
 * Set the room identifier for a specific hexagonal coordinate
 */
function setRoomIdentifier(q, r, identifier) {
    const key = `${q},${r}`;
    roomIdentifiers.set(key, identifier);
}

/**
 * Get the room identifier for a specific hexagonal coordinate
 */
function getRoomIdentifier(q, r) {
    const key = `${q},${r}`;
    return roomIdentifiers.get(key);
}

/**
 * Store book content in the cache
 */
function storeBookContent(q, r, wallIndex, shelfIndex, bookIndex, content) {
    const key = `${q},${r},${wallIndex},${shelfIndex},${bookIndex}`;
    bookContentCache[key] = content;
}

/**
 * Get book content from the cache
 */
function getBookContent(q, r, wallIndex, shelfIndex, bookIndex) {
    const key = `${q},${r},${wallIndex},${shelfIndex},${bookIndex}`;
    return bookContentCache[key];
}

/**
 * Open the book viewer with the specified book
 */
function openBookViewer(q, r, wallIndex, shelfIndex, bookIndex) {
    // Get the room identifier
    const roomIdentifier = getRoomIdentifier(q, r);
    if (!roomIdentifier) {
        console.error('No room identifier found for', q, r);
        return;
    }
    
    // Construct the full identifier
    const [room] = roomIdentifier.split('.');
    
    // Adjust wall, shelf, book based on the clicked book
    // Convert from zero-based to one-based indexing
    const adjustedWall = ((wallIndex % 6) + 1);
    const adjustedShelf = ((shelfIndex % 5) + 1);
    const adjustedBook = ((bookIndex % 32) + 1);
    
    const fullIdentifier = `${room}.${adjustedWall}.${adjustedShelf}.${adjustedBook}.1`;
    
    // Set current book and reset to page 1
    currentBook = {
        identifier: fullIdentifier,
        q, r, wallIndex, shelfIndex, bookIndex
    };
    currentPage = 1;
    
    // Show the book viewer immediately with loading indicator
    bookViewerElement.classList.remove('hidden');
    
    // Unlock pointer controls to show cursor for book interaction
    if (window.controls && window.controls.isLocked) {
        window.controls.unlock();
    }
    
    // Add cursor-visible class to body to show cursor
    document.body.classList.add('cursor-visible');
    
    // Hide the crosshair when book viewer is open
    const crosshairContainer = document.getElementById('crosshair-container');
    if (crosshairContainer) {
        crosshairContainer.style.display = 'none';
    }
    
    // Add escape key event listener
    if (escapeKeyHandler) {
        document.addEventListener('keydown', escapeKeyHandler);
    }
    
    // Update the book viewer content
    updateBookViewer();
}

/**
 * Update the book viewer with the current book and page
 */
function updateBookViewer() {
    if (!currentBook) return;
    
    // Show loading indicator
    document.getElementById('book-content').textContent = 'Loading content...';
    
    // Get the base identifier (without page)
    const parts = currentBook.identifier.split('.');
    parts[4] = currentPage.toString();
    const fullIdentifier = parts.join('.');
    
    // Generate content for the current page
    generateBookContent(fullIdentifier)
        .then(async content => {
            // Get the book content element
            const bookContentElement = document.getElementById('book-content');
            
            // Highlight English words in the content
            const highlightedContent = await highlightEnglishWords(content.content);
            
            // Update the page content with HTML instead of text
            bookContentElement.innerHTML = highlightedContent;
            
            // Update the page number
            document.getElementById('page-number').textContent = `Page ${currentPage} of ${content.totalPages}`;
            
            // Update the identifier display
            document.getElementById('book-identifier').textContent = `Location: ${content.room}.${content.wall}.${content.shelf}.${content.book}.${content.page}`;
            
            // Update navigation buttons
            document.getElementById('prev-page').disabled = currentPage <= 1;
            document.getElementById('next-page').disabled = currentPage >= content.totalPages;
        })
        .catch(error => {
            console.error('Error updating book viewer:', error);
            // Use fallback content in case of error
            const fallbackContent = generateFallbackContent(fullIdentifier);
            
            // Try to highlight words in the fallback content as well
            highlightEnglishWords(fallbackContent.content)
                .then(highlightedContent => {
                    document.getElementById('book-content').innerHTML = highlightedContent;
                })
                .catch(() => {
                    // If highlighting fails, just use the plain text
                    document.getElementById('book-content').textContent = fallbackContent.content;
                });
                
            document.getElementById('page-number').textContent = `Page ${currentPage} of 410`;
            document.getElementById('book-identifier').textContent = `Location: ${fullIdentifier}`;
            
            // Update navigation buttons
            document.getElementById('prev-page').disabled = currentPage <= 1;
            document.getElementById('next-page').disabled = currentPage >= 410;
        });
}

/**
 * Navigate to the previous page
 */
function prevPage() {
    if (currentBook && currentPage > 1) {
        currentPage--;
        updateBookViewer();
    }
}

/**
 * Navigate to the next page
 */
function nextPage() {
    if (currentBook && currentPage < 410) {
        currentPage++;
        updateBookViewer();
    }
}

/**
 * Close the book viewer
 */
function closeBookViewer() {
    bookViewerElement.classList.add('hidden');
    currentBook = null;
    
    // Remove cursor-visible class from body to hide cursor
    document.body.classList.remove('cursor-visible');
    
    // Show the crosshair again when returning to 3D view
    const crosshairContainer = document.getElementById('crosshair-container');
    if (crosshairContainer) {
        crosshairContainer.style.display = 'block';
    }
    
    // Remove escape key event listener
    if (escapeKeyHandler) {
        document.removeEventListener('keydown', escapeKeyHandler);
    }
    
    // Lock pointer controls again to hide cursor and return to 3D navigation
    if (window.controls && !window.controls.isLocked) {
        // Small delay to ensure the book viewer is fully hidden before locking controls
        setTimeout(() => {
            window.controls.lock();
        }, 100);
    }
}

/**
 * Initialize a room with a random identifier
 */
async function initializeRoomWithRandomIdentifier(q, r) {
    const identifier = await fetchRandomIdentifier();
    setRoomIdentifier(q, r, identifier);
    return identifier;
}

/**
 * Highlight English words in the book content
 * @param {string} content - The book content text
 * @returns {string} - The content with HTML highlighting for English words
 */
async function highlightEnglishWords(content) {
    const words = await fetchEnglishWords();
    if (!words || words.length === 0) {
        return content;
    }
    
    // Create a copy of the content to modify
    let highlightedContent = content;
    
    // Split words into two groups: longer words (>3 chars) and shorter words
    const longerWords = words.filter(word => word.length > 3);
    const shorterWords = words.filter(word => word.length > 1 && word.length <= 3);
    
    // Create a single regex for longer words (more efficient than looping)
    if (longerWords.length > 0) {
        // Sort by length (descending) to match longer words first
        longerWords.sort((a, b) => b.length - a.length);
        
        // Escape special regex characters
        const escapedWords = longerWords.map(word => 
            word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        );
        
        // Create a single regex pattern for all longer words
        const longerWordsPattern = new RegExp(escapedWords.join('|'), 'gi');
        
        // Replace all occurrences with highlighted version
        highlightedContent = highlightedContent.replace(longerWordsPattern, match => 
            `<span class="highlighted-word">${match}</span>`);
    }
    
    // Process shorter words with word boundary checks
    if (shorterWords.length > 0) {
        // Process in batches to avoid regex pattern too large
        const BATCH_SIZE = 50;
        for (let i = 0; i < shorterWords.length; i += BATCH_SIZE) {
            const batch = shorterWords.slice(i, i + BATCH_SIZE);
            
            // Escape special regex characters
            const escapedWords = batch.map(word => 
                word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            );
            
            // Create a pattern with word boundaries
            const shorterWordsPattern = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');
            
            // Replace all occurrences with highlighted version
            highlightedContent = highlightedContent.replace(shorterWordsPattern, match => 
                `<span class="highlighted-word">${match}</span>`);
        }
    }
    
    return highlightedContent;
}

// Export functions
export {
    initBookViewer,
    fetchRandomIdentifier,
    fetchBookContent,
    setRoomIdentifier,
    getRoomIdentifier,
    storeBookContent,
    getBookContent,
    openBookViewer,
    closeBookViewer,
    initializeRoomWithRandomIdentifier,
    fetchEnglishWords,
    highlightEnglishWords
}; 