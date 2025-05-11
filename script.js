// Main script for Portkey integration

// DOM Elements
const messageInput = document.getElementById('message-input');
const imageInput = document.getElementById('image-input');
const imagePreview = document.getElementById('image-preview');
const sendButton = document.getElementById('send-button');
const responseDisplay = document.getElementById('response-display');
const historyList = document.getElementById('history-list');

// Portkey API configuration
const PORTKEY_API_URL = 'https://api.portkey.ai/v1/'; // Replace with actual Portkey API endpoint
const PORTKEY_API_KEY = 'YOUR_PORTKEY_API_KEY'; // Replace with your Portkey API key

// Global variables
let selectedImage = null;

// Initialize the application
function initApp() {
    // Set up event listeners
    imageInput.addEventListener('change', handleImageSelect);
    sendButton.addEventListener('click', sendToPortkey);
    
    // Load conversation history
    loadHistory();
}

// Handle image selection
function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check if the file is an image
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        imageInput.value = '';
        return;
    }
    
    // Store the selected image for later use
    selectedImage = file;
    
    // Display image preview
    const reader = new FileReader();
    reader.onload = function(event) {
        imagePreview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
}

// Send message and image to Portkey
async function sendToPortkey() {
    // Validate inputs
    const message = messageInput.value.trim();
    if (!message && !selectedImage) {
        alert('Please enter a message or select an image.');
        return;
    }
    
    // Show loading state
    sendButton.disabled = true;
    sendButton.textContent = 'Sending...';
    responseDisplay.innerHTML = '<p class="placeholder">Loading response...</p>';
    
    try {
        // Prepare form data
        const formData = new FormData();
        formData.append('message', message);
        
        if (selectedImage) {
            formData.append('image', selectedImage);
        }

        // Add your Portkey API key
        formData.append('api_key', PORTKEY_API_KEY);
        
        // Send request to Portkey
        const response = await fetch(PORTKEY_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PORTKEY_API_KEY}`
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Display the response
        displayResponse(data);
        
        // Save the conversation to database
        saveConversation(message, selectedImage, data);
        
        // Reset the form
        resetForm();
    } catch (error) {
        console.error('Error sending request to Portkey:', error);
        responseDisplay.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    } finally {
        // Reset button state
        sendButton.disabled = false;
        sendButton.textContent = 'Send to Portkey';
    }
}

// Display response from Portkey
function displayResponse(data) {
    // Extract the response text
    const responseText = data.response || data.message || JSON.stringify(data);
    
    // Format and display the text
    responseDisplay.innerHTML = `
        <div class="response-content">
            <p>${formatResponse(responseText)}</p>
        </div>
        <div class="response-meta">
            <small>Response received at: ${new Date().toLocaleString()}</small>
        </div>
    `;
}

// Format the response text (replace newlines with <br>, etc.)
function formatResponse(text) {
    return text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

// Save conversation to database
async function saveConversation(message, image, response) {
    // Convert image to base64 if exists
    let imageData = null;
    if (image) {
        imageData = await fileToBase64(image);
    }
    
    // Create conversation object
    const conversation = {
        timestamp: new Date().getTime(),
        message: message,
        image: imageData,
        response: response,
        imageFilename: image ? image.name : null
    };
    
    // Add to database
    try {
        await db.addConversation(conversation);
        // Refresh history list
        loadHistory();
    } catch (error) {
        console.error('Error saving conversation:', error);
    }
}

// Convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Load conversation history
async function loadHistory() {
    try {
        const conversations = await db.getAllConversations();
        
        // Clear history list
        historyList.innerHTML = '';
        
        if (conversations.length === 0) {
            historyList.innerHTML = '<p class="placeholder">No conversation history yet.</p>';
            return;
        }
        
        // Add conversations to history list
        conversations.forEach(conversation => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.dataset.id = conversation.id;
            
            // Format timestamp
            const timestamp = new Date(conversation.timestamp).toLocaleString();
            
            // Create HTML for history item
            historyItem.innerHTML = `
                <div class="history-meta">
                    <span class="history-date">${timestamp}</span>
                </div>
                <div class="history-content">
                    <div class="history-message">
                        <p>${conversation.message.substring(0, 100)}${conversation.message.length > 100 ? '...' : ''}</p>
                    </div>
                    ${conversation.image ? 
                        `<img class="history-thumbnail" src="${conversation.image}" alt="Uploaded image">` : ''}
                </div>
            `;
            
            // Add click event to load conversation
            historyItem.addEventListener('click', () => loadConversation(conversation.id));
            
            // Add to history list
            historyList.appendChild(historyItem);
        });
    } catch (error) {
        console.error('Error loading history:', error);
        historyList.innerHTML = '<p class="error">Error loading conversation history.</p>';
    }
}

// Load conversation details
async function loadConversation(id) {
    try {
        const conversation = await db.getConversation(id);
        
        if (!conversation) {
            console.error('Conversation not found:', id);
            return;
        }
        
        // Display the message
        messageInput.value = conversation.message;
        
        // Display the image if exists
        if (conversation.image) {
            imagePreview.innerHTML = `<img src="${conversation.image}" alt="Preview">`;
        } else {
            imagePreview.innerHTML = '';
        }
        
        // Display the response
        displayResponse(conversation.response);
        
        // Scroll to the response section
        document.querySelector('.response-section').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Error loading conversation:', error);
    }
}

// Reset the form
function resetForm() {
    // Clear message input
    messageInput.value = '';
    
    // Clear image input and preview
    imageInput.value = '';
    imagePreview.innerHTML = '';
    selectedImage = null;
}

// Export conversation history
async function exportHistory() {
    try {
        const jsonData = await db.exportToJson();
        
        // Create download link
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'portkey-conversations.json';
        a.click();
        
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting history:', error);
        alert('Error exporting conversation history.');
    }
}

// Initialize the app when the page loads
window.addEventListener('DOMContentLoaded', initApp);