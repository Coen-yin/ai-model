class ChatBot {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.initializeElements();
        this.attachEventListeners();
        this.messageInput.focus();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    initializeElements() {
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendMessage');
        this.chatMessages = document.getElementById('chatMessages');
        this.clearButton = document.getElementById('clearChat');
        this.trainButton = document.getElementById('trainBot');
        this.trainingModal = document.getElementById('trainingModal');
        this.trainingForm = document.getElementById('trainingForm');
        this.closeModal = document.querySelector('.close');
    }

    attachEventListeners() {
        // Send message events
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Clear chat
        this.clearButton.addEventListener('click', () => this.clearChat());

        // Training modal events
        this.trainButton.addEventListener('click', () => this.openTrainingModal());
        this.closeModal.addEventListener('click', () => this.closeTrainingModal());
        this.trainingForm.addEventListener('submit', (e) => this.submitTraining(e));

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.trainingModal) {
                this.closeTrainingModal();
            }
        });
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        // Disable input while processing
        this.setInputDisabled(true);

        // Add user message to chat
        this.addMessage(message, 'user');
        this.messageInput.value = '';

        // Show typing indicator
        const typingIndicator = this.addTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    sessionId: this.sessionId
                })
            });

            const data = await response.json();

            // Remove typing indicator
            typingIndicator.remove();

            if (response.ok) {
                this.addMessage(data.response, 'bot');
            } else {
                this.addMessage('Sorry, I encountered an error: ' + data.error, 'bot', true);
            }
        } catch (error) {
            typingIndicator.remove();
            this.addMessage('Sorry, I\'m having trouble connecting. Please try again.', 'bot', true);
            console.error('Chat error:', error);
        }

        // Re-enable input
        this.setInputDisabled(false);
        this.messageInput.focus();
    }

    addMessage(content, sender, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        if (sender === 'user') {
            messageContent.innerHTML = `<strong>You:</strong> ${this.escapeHtml(content)}`;
        } else {
            messageContent.innerHTML = `<strong>AI Bot:</strong> ${this.escapeHtml(content)}`;
            if (isError) {
                messageContent.style.color = '#e74c3c';
            }
        }

        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = new Date().toLocaleTimeString();

        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(messageTime);

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot-message';
        
        const typingContent = document.createElement('div');
        typingContent.className = 'typing-indicator';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            typingContent.appendChild(dot);
        }
        
        typingDiv.appendChild(typingContent);
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
        
        return typingDiv;
    }

    setInputDisabled(disabled) {
        this.messageInput.disabled = disabled;
        this.sendButton.disabled = disabled;
        if (disabled) {
            this.sendButton.textContent = 'Sending...';
        } else {
            this.sendButton.textContent = 'Send';
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    async clearChat() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            try {
                await fetch(`/api/conversation/${this.sessionId}`, {
                    method: 'DELETE'
                });
                
                // Clear chat messages except the initial greeting
                this.chatMessages.innerHTML = `
                    <div class="message bot-message">
                        <div class="message-content">
                            <strong>AI Bot:</strong> Hello! I'm your AI assistant. How can I help you today?
                        </div>
                        <div class="message-time">Just now</div>
                    </div>
                `;
                
                // Generate new session ID
                this.sessionId = this.generateSessionId();
            } catch (error) {
                console.error('Error clearing chat:', error);
                alert('Failed to clear chat history');
            }
        }
    }

    openTrainingModal() {
        this.trainingModal.style.display = 'block';
    }

    closeTrainingModal() {
        this.trainingModal.style.display = 'none';
        this.trainingForm.reset();
    }

    async submitTraining(e) {
        e.preventDefault();
        
        const input = document.getElementById('trainingInput').value.trim();
        const output = document.getElementById('trainingOutput').value.trim();
        const category = document.getElementById('trainingCategory').value;

        if (!input || !output) {
            alert('Please fill in both input and output fields');
            return;
        }

        try {
            const response = await fetch('/api/train', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: input,
                    output: output,
                    category: category
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert(`Training data added successfully! Total examples: ${data.totalExamples}`);
                this.closeTrainingModal();
            } else {
                alert('Error adding training data: ' + data.error);
            }
        } catch (error) {
            console.error('Training error:', error);
            alert('Failed to add training data');
        }
    }
}

// Initialize chatbot when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
});
