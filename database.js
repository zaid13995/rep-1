// Database handling using IndexedDB
class PortkeyDatabase {
    constructor() {
        this.dbName = 'portkeyDB';
        this.dbVersion = 1;
        this.db = null;
        this.initDB();
    }

    // Initialize the database
    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject('Error opening database');
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object store for conversations
                if (!db.objectStoreNames.contains('conversations')) {
                    const objectStore = db.createObjectStore('conversations', { keyPath: 'id', autoIncrement: true });
                    
                    // Create indexes
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                    
                    console.log('Object store created');
                }
            };
        });
    }

    // Add a new conversation to the database
    async addConversation(data) {
        // Make sure DB is initialized
        if (!this.db) {
            await this.initDB();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['conversations'], 'readwrite');
            const store = transaction.objectStore('conversations');
            
            // Add timestamp if not present
            if (!data.timestamp) {
                data.timestamp = new Date().getTime();
            }

            const request = store.add(data);
            
            request.onsuccess = (event) => {
                resolve(event.target.result); // Returns the ID of the new record
            };
            
            request.onerror = (event) => {
                console.error('Error adding conversation:', event.target.error);
                reject('Error adding conversation to database');
            };
        });
    }

    // Get all conversations
    async getAllConversations() {
        // Make sure DB is initialized
        if (!this.db) {
            await this.initDB();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['conversations'], 'readonly');
            const store = transaction.objectStore('conversations');
            const index = store.index('timestamp');
            
            // Get all records, sorted by timestamp (newest first)
            const request = index.openCursor(null, 'prev');
            const conversations = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    conversations.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(conversations);
                }
            };
            
            request.onerror = (event) => {
                console.error('Error getting conversations:', event.target.error);
                reject('Error retrieving conversations from database');
            };
        });
    }

    // Get a specific conversation by ID
    async getConversation(id) {
        // Make sure DB is initialized
        if (!this.db) {
            await this.initDB();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['conversations'], 'readonly');
            const store = transaction.objectStore('conversations');
            const request = store.get(id);
            
            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
            
            request.onerror = (event) => {
                console.error('Error getting conversation:', event.target.error);
                reject('Error retrieving conversation from database');
            };
        });
    }

    // Export all conversations as JSON
    async exportToJson() {
        const conversations = await this.getAllConversations();
        return JSON.stringify(conversations, null, 2);
    }

    // Import conversations from JSON
    async importFromJson(jsonString) {
        try {
            const conversations = JSON.parse(jsonString);
            
            // Make sure DB is initialized
            if (!this.db) {
                await this.initDB();
            }
            
            const transaction = this.db.transaction(['conversations'], 'readwrite');
            const store = transaction.objectStore('conversations');
            
            for (const conversation of conversations) {
                // Remove the ID to avoid conflicts
                const { id, ...conversationData } = conversation;
                store.add(conversationData);
            }
            
            return true;
        } catch (error) {
            console.error('Error importing conversations:', error);
            return false;
        }
    }
}

// Create and export a singleton instance
const db = new PortkeyDatabase();