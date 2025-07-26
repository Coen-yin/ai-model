const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Initialize OpenAI (or you can use other AI providers)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// In-memory storage for conversations (use database in production)
const conversations = new Map();
let trainingData = [];

// Load training data on startup
async function loadTrainingData() {
    try {
        const data = await fs.readFile('./data/training.json', 'utf8');
        trainingData = JSON.parse(data);
        console.log(`Loaded ${trainingData.length} training examples`);
    } catch (error) {
        console.log('No training data found, starting with empty dataset');
        trainingData = [];
    }
}

// Save training data
async function saveTrainingData() {
    try {
        await fs.mkdir('./data', { recursive: true });
        await fs.writeFile('./data/training.json', JSON.stringify(trainingData, null, 2));
    } catch (error) {
        console.error('Error saving training data:', error);
    }
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    const { message, sessionId = 'default', userId = 'anonymous' } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        // Get or create conversation history
        if (!conversations.has(sessionId)) {
            conversations.set(sessionId, []);
        }
        const conversation = conversations.get(sessionId);

        // Add user message to conversation
        conversation.push({ role: 'user', content: message });

        // Create system prompt with training data context
        const systemPrompt = createSystemPrompt();
        
        // Prepare messages for AI
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversation.slice(-10) // Keep last 10 messages for context
        ];

        // Get AI response
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: messages,
            max_tokens: 500,
            temperature: 0.7,
        });

        const aiResponse = completion.choices[0].message.content;

        // Add AI response to conversation
        conversation.push({ role: 'assistant', content: aiResponse });

        // Keep conversation history manageable
        if (conversation.length > 20) {
            conversation.splice(0, 2); // Remove oldest pair
        }

        res.json({
            response: aiResponse,
            sessionId: sessionId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ 
            error: 'Failed to process chat message',
            details: error.message 
        });
    }
});

// Training endpoint
app.post('/api/train', async (req, res) => {
    const { input, output, category = 'general' } = req.body;

    if (!input || !output) {
        return res.status(400).json({ error: 'Both input and output are required' });
    }

    try {
        trainingData.push({
            id: Date.now(),
            input: input.trim(),
            output: output.trim(),
            category,
            timestamp: new Date().toISOString()
        });

        await saveTrainingData();

        res.json({ 
            message: 'Training data added successfully',
            totalExamples: trainingData.length 
        });
    } catch (error) {
        console.error('Training error:', error);
        res.status(500).json({ error: 'Failed to add training data' });
    }
});

// Get training data
app.get('/api/training', (req, res) => {
    res.json({
        data: trainingData,
        count: trainingData.length
    });
});

// Clear conversation
app.delete('/api/conversation/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    conversations.delete(sessionId);
    res.json({ message: 'Conversation cleared' });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        trainingExamples: trainingData.length
    });
});

function createSystemPrompt() {
    let prompt = `You are a helpful AI chatbot assistant for a chat website. Be friendly, helpful, and conversational.`;
    
    if (trainingData.length > 0) {
        prompt += `\n\nHere are some examples of how you should respond based on training data:\n`;
        trainingData.slice(-10).forEach(example => {
            prompt += `\nUser: ${example.input}\nAssistant: ${example.output}\n`;
        });
    }
    
    prompt += `\n\nAlways be helpful, accurate, and maintain a friendly tone. If you don't know something, admit it honestly.`;
    
    return prompt;
}

// Start server
loadTrainingData().then(() => {
    app.listen(PORT, () => {
        console.log(`🤖 AI Chatbot server running on port ${PORT}`);
        console.log(`📊 Loaded ${trainingData.length} training examples`);
    });
});
